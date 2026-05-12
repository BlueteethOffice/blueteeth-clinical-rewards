import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb } from '@/lib/firebase-admin';
import { rateLimit } from '@/lib/security';

export async function GET(request: NextRequest) {
  try {
    const { success: rateOk } = await rateLimit(request, 50, 60000);
    if (!rateOk) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const role = searchParams.get('role');
    const limit = parseInt(searchParams.get('limit') || '10');
    const lastId = searchParams.get('lastId');

    if (!userId || !role) {
      return NextResponse.json({ error: 'Missing parameters' }, { status: 400 });
    }

    const db = getAdminDb();
    if (!db) return NextResponse.json({ error: 'DB error' }, { status: 500 });

    let q = db.collection('cases');

    // Role-based filtering
    if (role === 'associate') {
      q = q.where('associateId', '==', userId) as any;
    } else if (role === 'clinician') {
      q = q.where('clinicianId', '==', userId) as any;
    }
    // Admins see all

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
