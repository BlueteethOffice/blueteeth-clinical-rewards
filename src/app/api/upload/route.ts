import { NextResponse } from 'next/server';
import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { adminAuth, getAdminDb } from '@/lib/firebase-admin';
import { rateLimit, registerFile, logAuditAction } from '@/lib/security';

// ✅ SECURITY FIX: Allowed file types by magic bytes (first bytes of file)
const ALLOWED_SIGNATURES: { mime: string; bytes: number[]; offset?: number }[] = [
  { mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] }, // %PDF
  { mime: 'image/jpeg', bytes: [0xFF, 0xD8, 0xFF] },
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4E, 0x47] },
  { mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46], offset: 0 }, // RIFF
];

const ALLOWED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

function detectMimeFromBuffer(buffer: Buffer): string | null {
  for (const sig of ALLOWED_SIGNATURES) {
    const offset = sig.offset || 0;
    const match = sig.bytes.every((b, i) => buffer[offset + i] === b);
    if (match) return sig.mime;
  }
  return null;
}

export async function POST(request: Request) {
  try {
    // ✅ SECURITY FIX: Always require Firebase token — no dev bypass
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Missing token' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    let decodedToken: { uid: string };
    try {
      if (!adminAuth) {
        // Log warning but still reject — do not bypass in any environment
        console.warn('⚠️ Firebase Admin Auth not initialized — upload blocked.');
        return NextResponse.json({ success: false, error: 'Server misconfiguration: upload unavailable' }, { status: 503 });
      }
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (e: any) {
      return NextResponse.json({ success: false, error: `Unauthorized: ${e.message}` }, { status: 401 });
    }

    // ✅ RATE LIMITING
    const { success: rateOk } = await rateLimit(request as any, 5, 60000); // 5 uploads per minute
    if (!rateOk) {
      return NextResponse.json({ success: false, error: 'Too many uploads. Please wait.' }, { status: 429 });
    }

    const data = await request.formData();
    const file: File | null = data.get('file') as unknown as File;
    const caseId = data.get('caseId') as string;

    if (!file) {
      return NextResponse.json({ success: false, error: 'No file uploaded' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // ✅ VALIDATION: Magic Byte Detection
    const detectedMime = detectMimeFromBuffer(buffer);
    const fileExt = file.name.split('.').pop()?.toLowerCase();

    if (!detectedMime || !ALLOWED_EXTENSIONS.includes(fileExt || '')) {
      return NextResponse.json({ success: false, error: 'Invalid file type' }, { status: 400 });
    }

    if (buffer.byteLength > MAX_FILE_SIZE) {
      return NextResponse.json({ success: false, error: 'File too large (Max 10MB)' }, { status: 400 });
    }

    const safeExt = fileExt;

    // ✅ UNIQUE FILE ID
    const fileId = `${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const uniqueFilename = `${fileId}.${safeExt}`;
    
    // Ensure public/uploads directory exists
    const uploadDir = join(process.cwd(), 'public', 'uploads');
    try {
      await mkdir(uploadDir, { recursive: true });
    } catch (e) {
      // Ignore if directory already exists
    }

    // Write file to public/uploads
    const storagePath = `uploads/${uniqueFilename}`;
    const absolutePath = join(uploadDir, uniqueFilename);
    await writeFile(absolutePath, buffer);

    // ✅ REGISTER FILE OWNERSHIP
    const userRole = (await getAdminDb()?.collection('users').doc(decodedToken.uid).get())?.data()?.role || 'unknown';
    
    await registerFile({
      fileId,
      ownerId: decodedToken.uid,
      uploaderRole: userRole,
      caseId: caseId || undefined,
      storagePath: storagePath
    });

    // ✅ AUDIT LOG
    await logAuditAction({
      userId: decodedToken.uid,
      userRole: userRole,
      action: 'FILE_UPLOAD',
      resource: 'FILE',
      resourceId: fileId,
      metadata: { filename: file.name, size: buffer.byteLength }
    });

    return NextResponse.json({ success: true, fileId, url: `/api/view-file?id=${fileId}` });
  } catch (error: any) {
    console.error('🔥 Local Upload Error:', error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
