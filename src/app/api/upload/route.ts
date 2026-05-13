import { NextResponse } from 'next/server';
import { adminAuth, getAdminDb } from '@/lib/firebase-admin';
import { rateLimit, registerFile, logAuditAction } from '@/lib/security';
import { v2 as cloudinary } from 'cloudinary';

// ✅ SECURITY FIX: Allowed file types by magic bytes
const ALLOWED_SIGNATURES = [
  { mime: 'application/pdf', bytes: [0x25, 0x50, 0x44, 0x46] },
  { mime: 'image/jpeg', bytes: [0xFF, 0xD8, 0xFF] },
  { mime: 'image/png', bytes: [0x89, 0x50, 0x4E, 0x47] },
  { mime: 'image/webp', bytes: [0x52, 0x49, 0x46, 0x46] },
];

const ALLOWED_EXTENSIONS = ['pdf', 'jpg', 'jpeg', 'png', 'webp'];
const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

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

    const { success: rateOk } = await rateLimit(request as any, 5, 60000);
    if (!rateOk) return NextResponse.json({ success: false, error: 'Too many uploads.' }, { status: 429 });

    const data = await request.formData();
    const file: File | null = data.get('file') as any;
    const caseId = data.get('caseId') as string;

    if (!file) return NextResponse.json({ success: false, error: 'No file' }, { status: 400 });

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // ✅ SECURITY FIX: Validate file signature (magic bytes)
    const fileSignature = buffer.slice(0, 4);
    const isValidSignature = ALLOWED_SIGNATURES.some(sig => {
      return sig.bytes.every((byte, i) => fileSignature[i] === byte);
    });

    if (!isValidSignature) {
      return NextResponse.json({ success: false, error: 'Invalid file content: Signature mismatch' }, { status: 400 });
    }

    // ✅ CLOUDINARY CONFIG CHECK & INITIALIZATION
    const cloudName = process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
    const apiKey = process.env.CLOUDINARY_API_KEY;
    const apiSecret = process.env.CLOUDINARY_API_SECRET;

    if (!cloudName || !apiKey || !apiSecret) {
      return NextResponse.json({ 
        success: false, 
        error: `Cloudinary configuration missing: ${!cloudName ? 'CloudName ' : ''}${!apiKey ? 'ApiKey ' : ''}${!apiSecret ? 'ApiSecret' : ''}` 
      }, { status: 500 });
    }

    // Initialize config explicitly for this request
    cloudinary.config({
      cloud_name: cloudName,
      api_key: apiKey,
      api_secret: apiSecret,
      secure: true
    });

    // Detect file type for correct Cloudinary resource_type
    // PDFs MUST use 'raw' so they get a raw/upload URL browsers can open directly
    const isPdfUpload = file.name.toLowerCase().endsWith('.pdf') || 
                        file.type === 'application/pdf';
    const cloudinaryResourceType = isPdfUpload ? 'raw' : 'auto';

    // 🚀 HIGH-SPEED STREAM UPLOAD
    const uploadResponse = await new Promise((resolve, reject) => {
      const uploadStream = cloudinary.uploader.upload_stream(
        {
          folder: 'blueteeth_proofs',
          resource_type: cloudinaryResourceType,
        },
        (error, result) => {
          if (error) return reject(error);
          resolve(result);
        }
      );
      uploadStream.end(buffer);
    }).catch(err => {
      if (err.message?.includes('Signature')) {
        throw new Error(`Cloudinary Error: Invalid Signature. Please check if CLOUDINARY_API_SECRET in .env.local is correct.`);
      }
      throw new Error(`Cloudinary Error: ${err.message || 'Upload failed'}`);
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
