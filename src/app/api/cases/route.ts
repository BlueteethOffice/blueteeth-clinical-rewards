import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, adminAuth } from '@/lib/firebase-admin';
import { rateLimit } from '@/lib/security';

export async function GET(request: NextRequest) {
  try {
    const { success: rateOk } = await rateLimit(request, 50, 60000);
    if (!rateOk) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

    // ✅ SECURITY FIX: Verify token and get UID/Role from it
    const authHeader = request.headers.get('authorization');
    const sessionCookie = request.cookies.get('session')?.value;
    
    let decodedToken;
    try {
      const auth = adminAuth;
      if (!auth) throw new Error('Auth unavailable');

      if (authHeader?.startsWith('Bearer ')) {
        decodedToken = await auth.verifyIdToken(authHeader.split('Bearer ')[1]);
      } else if (sessionCookie) {
        decodedToken = await auth.verifySessionCookie(sessionCookie);
      } else {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
    } catch (e) {
      return NextResponse.json({ error: 'Invalid session' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10');
    const lastId = searchParams.get('lastId');

    const db = getAdminDb();
    if (!db) return NextResponse.json({ error: 'DB error' }, { status: 500 });

    // Fetch user role from DB for strict check
    const userDoc = await db.collection('users').doc(decodedToken.uid).get();
    const role = userDoc.data()?.role;

    let q = db.collection('cases');

    // Role-based filtering (Strictly enforced by server state)
    if (role === 'associate') {
      q = q.where('associateId', '==', decodedToken.uid) as any;
    } else if (role === 'clinician') {
      q = q.where('clinicianId', '==', decodedToken.uid) as any;
    } else if (role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    q = q.orderBy('createdAt', 'desc') as any;

    if (lastId) {
      const lastDoc = await db.collection('cases').doc(lastId).get();
      if (lastDoc.exists) {
        q = q.startAfter(lastDoc) as any;
      }
    }

    const snapshot = await q.limit(limit).get();
    const cases = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    return NextResponse.json({ 
      cases,
      lastId: cases.length > 0 ? cases[cases.length - 1].id : null,
      hasMore: cases.length === limit
    });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
