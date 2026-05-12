import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, adminAuth } from '@/lib/firebase-admin';
import { rateLimit, logAuditAction } from '@/lib/security';
import * as admin from 'firebase-admin';

export async function POST(request: NextRequest) {
  try {
    const { success: rateOk } = await rateLimit(request, 20, 60000);
    if (!rateOk) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    
    const db = getAdminDb()!;
    const adminUser = await db.collection('users').doc(decodedToken.uid).get();
    if (adminUser.data()?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { caseId, status } = await request.json();
    if (status !== 'approved' && status !== 'rejected') {
      return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
    }

    const caseRef = db.collection('cases').doc(caseId);
    const caseSnap = await caseRef.get();
    if (!caseSnap.exists) return NextResponse.json({ error: 'Case not found' }, { status: 404 });
    
    const caseData = caseSnap.data();
    if (caseData?.status === 'approved') {
      return NextResponse.json({ error: 'Case already approved' }, { status: 400 });
    }

    // --- ATOMIC TRANSACTION ---
    await db.runTransaction(async (transaction) => {
      transaction.update(caseRef, {
        status,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });

      if (status === 'approved') {
        const points = caseData?.points || 0;
        const POINT_VALUE = 1; // Adjust if needed

        // Update Clinician Earnings
        if (caseData?.clinicianId) {
          const clinRef = db.collection('users').doc(caseData.clinicianId);
          transaction.update(clinRef, {
            totalEarnings: admin.firestore.FieldValue.increment(points * POINT_VALUE)
          });
        }

        // Update Associate Earnings (if applicable)
        if (caseData?.associateId) {
          const assocRef = db.collection('users').doc(caseData.associateId);
          // Associates might get a different percentage, but for now using points
          transaction.update(assocRef, {
            totalEarnings: admin.firestore.FieldValue.increment(points * 0.1) // 10% for associates
          });
        }
      }
    });

    // ✅ AUDIT LOG
    await logAuditAction({
      userId: decodedToken.uid,
      userRole: 'admin',
      action: `CASE_${status.toUpperCase()}`,
      resource: 'CASE',
      resourceId: caseId,
      metadata: { points: caseData?.points }
    });

    return NextResponse.json({ success: true });

  } catch (error: any) {
    console.error('Case Update Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
