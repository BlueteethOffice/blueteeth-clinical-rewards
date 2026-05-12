import { NextRequest, NextResponse } from 'next/server';
import { getAdminDb, adminAuth } from '@/lib/firebase-admin';
import { rateLimit, logAuditAction } from '@/lib/security';
import * as admin from 'firebase-admin';

export async function POST(request: NextRequest) {
  try {
    const { success: rateOk } = await rateLimit(request, 10, 60000);
    if (!rateOk) return NextResponse.json({ error: 'Too many requests' }, { status: 429 });

    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const token = authHeader.split('Bearer ')[1];
    const decodedToken = await adminAuth.verifyIdToken(token);
    
    // Check if user is Admin
    const userDoc = await getAdminDb()!.collection('users').doc(decodedToken.uid).get();
    const userData = userDoc.data();
    if (userData?.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const { payoutId, status, remarks, transactionId } = await request.json();

    if (!payoutId || !status) {
      return NextResponse.json({ error: 'Missing data' }, { status: 400 });
    }

    const db = getAdminDb()!;
    
    // --- ATOMIC TRANSACTION ---
    await db.runTransaction(async (transaction) => {
      const payoutRef = db.collection('clinicianPayouts').doc(payoutId);
      const payoutSnap = await transaction.get(payoutRef);
      if (!payoutSnap.exists) throw new Error('Payout not found');
      
      const payoutData = payoutSnap.data();
      if (payoutData?.status === 'paid') throw new Error('Payout already settled');

      if (status === 'paid') {
        const userId = payoutData?.clinicianId;
        const amount = payoutData?.amount || 0;

        if (!userId) throw new Error('User ID missing in payout record');

        const userRef = db.collection('users').doc(userId);
        const userSnap = await transaction.get(userRef);
        const userData = userSnap.data();

        if ((userData?.totalEarnings || 0) < amount) {
          throw new Error('Insufficient user balance for this payout');
        }

        // Decrement earnings
        transaction.update(userRef, {
          totalEarnings: admin.firestore.FieldValue.increment(-amount)
        });
      }

      const updateData: any = { status, remarks };
      if (transactionId) updateData.transactionId = transactionId;
      if (status === 'paid') updateData.paidAt = admin.firestore.FieldValue.serverTimestamp();
      if (status === 'approved') updateData.approvedAt = admin.firestore.FieldValue.serverTimestamp();

      transaction.update(payoutRef, updateData);
    });

    // ✅ AUDIT LOG
    await logAuditAction({
      userId: decodedToken.uid,
      userRole: 'admin',
      action: `PAYOUT_${status.toUpperCase()}`,
      resource: 'PAYOUT',
      resourceId: payoutId,
      metadata: { remarks, transactionId }
    });

    return NextResponse.json({ success: true });

  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
