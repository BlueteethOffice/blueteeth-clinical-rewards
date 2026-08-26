import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from './firebase-admin';

export type UserRole = 'admin' | 'clinician' | 'associate';

export const ROLE_PERMISSIONS: Record<UserRole, string[]> = {
  admin: ['*'],
  clinician: ['/dashboard/clinician', '/dashboard/profile', '/dashboard/settings', '/dashboard/notifications'],
  associate: ['/dashboard/associate', '/dashboard/profile', '/dashboard/settings', '/dashboard/notifications'],
};

export async function checkRolePermission(role: UserRole, pathname: string): Promise<boolean> {
  if (role === 'admin') return true;
  
  const allowedPaths = ROLE_PERMISSIONS[role] || [];
  return allowedPaths.some(path => pathname.startsWith(path));
}

export async function getSessionRole(req: NextRequest): Promise<UserRole | null> {
  const session = req.cookies.get('session')?.value;
  if (!session) return null;
  
  try {
    const decodedToken = await adminAuth.verifySessionCookie(session);
    // Fetch role from Firestore if not in custom claims
    // For performance, you should set this in custom claims during login
    return decodedToken.role as UserRole;
  } catch (e) {
    return null;
  }
}
