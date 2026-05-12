import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, adminAuth } from '@/lib/firebase-admin';
import { rateLimit } from '@/lib/security';

export async function GET(req: NextRequest) {
  try {
    // 🛡️ Security Check: Validate Firebase Token
    const authHeader = req.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized: Missing token' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    let decodedToken;
    try {
      if (!adminAuth) throw new Error("Admin Auth not initialized");
      decodedToken = await adminAuth.verifyIdToken(token);
    } catch (e) {
      return NextResponse.json({ error: 'Unauthorized: Invalid token' }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const userId = searchParams.get('userId');

    if (!userId) {
      return NextResponse.json({ error: 'User ID is required' }, { status: 400 });
    }

    // ✅ RATE LIMITING
    const { success: rateOk } = await rateLimit(req as any, 30, 60000);
    if (!rateOk) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

    // ✅ PRIVACY FIX: Only Admin can lookup anyone, or self-lookup
    const db = getAdminDb()!;
    const requesterDoc = await db.collection('users').doc(decodedToken.uid).get();
    const requesterRole = requesterDoc.data()?.role || 'unknown';

    if (requesterRole !== 'admin' && decodedToken.uid !== userId) {
      return NextResponse.json({ error: 'Forbidden: Privacy protection' }, { status: 403 });
    }

    if (!adminDb) {
      return NextResponse.json({ error: 'Database connection failed. Please contact Admin to set FIREBASE_PRIVATE_KEY.' }, { status: 500 });
    }

    // Server-side Admin SDK bypasses client security rules
    let userSnap = await adminDb.collection('users').doc(userId).get();
    
    // Secondary search: If doc ID isn't UID, search by uid field
    if (!userSnap.exists) {
      const q = await adminDb.collection('users').where('uid', '==', userId).limit(1).get();
      if (!q.empty) {
        userSnap = q.docs[0];
      }
    }

    if (!userSnap.exists) {
      return NextResponse.json({ error: `User ID ${userId} not found in database.` }, { status: 404 });
    }

    const userData = userSnap.data();
    const phone = userData?.phone || userData?.mobile || userData?.phoneNumber || null;

    if (!phone) {
      return NextResponse.json({ error: 'Contact number missing in profile' }, { status: 404 });
    }

    return NextResponse.json({ phone });
  } catch (error: any) {
    console.error('Contact lookup error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
