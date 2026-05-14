import { NextResponse } from 'next/server';
import { adminAuth, getAdminDb } from '@/lib/firebase-admin';
import { rateLimit, registerFile, logAuditAction } from '@/lib/security';
import { v2 as cloudinary } from 'cloudinary';

// ✅ PDF-ONLY magic byte check (strict security for documents)
const PDF_SIGNATURE = [0x25, 0x50, 0x44, 0x46]; // %PDF

// ✅ All allowed image MIME types (browsers reliably detect these)
const ALLOWED_IMAGE_MIMES = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/gif',
  'image/bmp',
  'image/tiff',
];

const ALLOWED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'gif', 'bmp', 'tiff'];
const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15MB for high-res medical photos

// ✅ Validates a file is safe to upload
function validateFile(file: File, buffer: Buffer): { valid: boolean; error?: string } {
  const ext = (file.name.toLowerCase().split('.').pop() || '');
  const mime = file.type.toLowerCase();

  // Check extension is in allowlist
  if (!ALLOWED_EXTENSIONS.includes(ext)) {
    return { valid: false, error: `File type .${ext} is not supported. Please upload JPG, PNG, WEBP, HEIC, or PDF.` };
  }

  // PDFs: Strict magic byte validation (prevent malicious files disguised as PDFs)
  if (mime === 'application/pdf' || ext === 'pdf') {
    const sig = buffer.slice(0, 4);
    const isPdf = PDF_SIGNATURE.every((byte, i) => sig[i] === byte);
    if (!isPdf) {
      return { valid: false, error: 'Invalid PDF file. The file does not appear to be a valid PDF document.' };
    }
    return { valid: true };
  }

  // Images: Trust the browser MIME type + extension (browsers are reliable for images)
  // This covers JPEG, PNG, WEBP, HEIC (iPhone), HEIF, GIF, BMP, TIFF
  const isImageMime = ALLOWED_IMAGE_MIMES.includes(mime);
  const isImageExt = ALLOWED_EXTENSIONS.filter(e => e !== 'pdf').includes(ext);

  if (!isImageMime && !isImageExt) {
    return { valid: false, error: 'Unsupported file type. Please upload a JPG, PNG, WEBP, HEIC, or PDF file.' };
  }

  // Basic size sanity (buffer must not be empty)
  if (buffer.length < 10) {
    return { valid: false, error: 'The uploaded file appears to be empty or corrupted.' };
  }

  return { valid: true };
}

export async function POST(request: Request) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ success: false, error: 'Unauthorized: Missing token' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    if (!adminAuth) {
      return NextResponse.json({ success: false, error: 'Server misconfiguration: Auth unavailable' }, { status: 503 });
    }

    const decodedToken = await adminAuth.verifyIdToken(token);

    const { success: rateOk } = await rateLimit(request as any, 10, 60000); // Relaxed rate limit
    if (!rateOk) return NextResponse.json({ success: false, error: 'Too many uploads. Please wait.' }, { status: 429 });

    const data = await request.formData();
    const file: File | null = data.get('file') as any;
    const caseId = data.get('caseId') as string;

    if (!file) return NextResponse.json({ success: false, error: 'No file provided' }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // ✅ VALIDATION: Check file type and content
    const validation = validateFile(file, buffer);
    if (!validation.valid) {
      console.warn(`[UPLOAD] Rejected file: ${file.name} (${file.type}) — ${validation.error}`);
      return NextResponse.json({ success: false, error: validation.error }, { status: 400 });
    }

    // ✅ CLOUDINARY CONFIG
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      return NextResponse.json({ success: false, error: 'Storage provider not configured' }, { status: 500 });
    }

    cloudinary.config({ cloud_name: cloudName, api_key: apiKey, api_secret: apiSecret, secure: true });

    // PDFs MUST use 'raw' to avoid conversion issues; images should use 'image' or 'auto'
    const isPdf = file.name.toLowerCase().endsWith('.pdf') || file.type === 'application/pdf';
    const resourceType = isPdf ? 'raw' : 'image'; // Explicitly use 'image' for non-PDFs to ensure processing

    // 🚀 UPLOAD — no format conversion to ensure maximum compatibility
    const uploadResponse = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'blueteeth_proofs',
          resource_type: resourceType,
          // ⚠️ Do NOT add format/quality transforms here — they cause silent failures
          // for HEIC, certain JPEG variants, and low-memory environments.
        },
        (error, result) => {
          if (error) {
            console.error('[CLOUDINARY] Upload stream error:', error);
            return reject(error);
          }
          resolve(result);
        }
      );
      uploadStream.end(buffer);
    }).catch(err => {
      console.error('[CLOUDINARY] Upload failed:', err.message);
      throw new Error(`Upload failed: ${err.message || 'Check Cloudinary credentials'}`);
    }) as any;

    const fileId = uploadResponse.public_id.split('/').pop() || uploadResponse.public_id;
    const storagePath = uploadResponse.secure_url;

    // ✅ REGISTER FILE
    const db = getAdminDb();
    if (!db) throw new Error('Firestore Database unavailable');

    const userDoc = await db.collection('users').doc(decodedToken.uid).get();
    const userRole = userDoc.data()?.role || 'unknown';
    
    await registerFile({
      fileId,
      ownerId: decodedToken.uid,
      uploaderRole: userRole,
      caseId: caseId || undefined,
      storagePath: storagePath
    });

    await logAuditAction({
      userId: decodedToken.uid,
      userRole: userRole,
      action: 'FILE_UPLOAD',
      resource: 'FILE',
      resourceId: fileId,
      metadata: { filename: file.name, provider: 'cloudinary' }
    });

    return NextResponse.json({ success: true, fileId, url: storagePath });
  } catch (error: any) {
    console.error('🔥 UPLOAD_ERROR:', error.message);
    return NextResponse.json({ 
      success: false, 
      error: error.message.includes('Database') ? 'Database Error' : `Upload Failed: ${error.message}` 
    }, { status: 500 });
  }
}
