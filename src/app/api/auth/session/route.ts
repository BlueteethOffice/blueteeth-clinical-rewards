import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, getAdminDb } from '@/lib/firebase-admin';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const { idToken } = await request.json();
    
    if (!idToken) {
      return NextResponse.json({ error: 'ID Token required' }, { status: 400 });
    }

    if (!adminAuth) {
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 503 });
    }

    // Set session expiration to 5 days.
    const expiresIn = 60 * 60 * 24 * 5 * 1000;
    
    // Create the session cookie. This will also verify the ID token.
    const sessionCookie = await adminAuth.createSessionCookie(idToken, { expiresIn });
    
    // Set cookie options
    const cookieOptions = {
      name: 'session',
      value: sessionCookie,
      maxAge: expiresIn,
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      sameSite: 'lax' as const,
    };

    // Use next/headers to set the cookie
    (await cookies()).set(cookieOptions);

    // ✅ AUDIT LOG
    try {
      const decodedToken = await adminAuth.verifyIdToken(idToken);
      const db = getAdminDb();
      if (!db) throw new Error("DB not found");
      const userDoc = await db.collection('users').doc(decodedToken.uid).get();
      const userData = userDoc.data();
      
      const { logAuditAction } = await import('@/lib/security');
      await logAuditAction({
        userId: decodedToken.uid,
        userRole: userData?.role || 'unknown',
        action: 'USER_LOGIN',
        resource: 'AUTH',
        metadata: { email: userData?.email, userAgent: request.headers.get('user-agent') }
      });
    } catch (e) {
      console.error('Audit Log Error (Login):', e);
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Session API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 401 });
  }
}

export async function DELETE() {
  (await cookies()).set({
    name: 'session',
    value: '',
    maxAge: 0,
    path: '/',
  });
  return NextResponse.json({ success: true });
}
