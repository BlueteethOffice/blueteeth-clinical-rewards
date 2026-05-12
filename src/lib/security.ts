import { getAdminDb } from './firebase-admin';
import { NextRequest, NextResponse } from 'next/server';

// --- RATE LIMITING ---
// In-memory fallback for development; in production, use Redis (Upstash/ioredis)
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export async function rateLimit(req: NextRequest, limit: number = 10, windowMs: number = 60000) {
  const ip = req.headers.get('x-forwarded-for') || '127.0.0.1';
  const now = Date.now();
  const key = `${ip}:${req.nextUrl.pathname}`;
  
  const entry = rateLimitMap.get(key);
  
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(key, { count: 1, resetAt: now + windowMs });
    return { success: true, remaining: limit - 1 };
  }
  
  if (entry.count >= limit) {
    return { success: false, remaining: 0 };
  }
  
  entry.count++;
  return { success: true, remaining: limit - entry.count };
}

// --- AUDIT LOGGING ---
export async function logAuditAction(action: {
  userId: string;
  userRole: string;
  action: string;
  resource: string;
  resourceId?: string;
  metadata?: any;
}) {
  const db = getAdminDb();
  if (!db) return;
  
  try {
    await db.collection('audit_logs').add({
      ...action,
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Audit Log Error:', error);
  }
}

// --- FILE OWNERSHIP ---
export async function registerFile(data: {
  fileId: string;
  ownerId: string;
  uploaderRole: string;
  caseId?: string;
  storagePath: string;
}) {
  const db = getAdminDb();
  if (!db) throw new Error('Database unavailable');
  
  // ✅ CLEAN DATA: Firestore doesn't allow undefined values
  const cleanData = Object.entries(data).reduce((acc, [key, value]) => {
    if (value !== undefined) acc[key] = value;
    return acc;
  }, {} as any);

  await db.collection('files').doc(data.fileId).set({
    ...cleanData,
    createdAt: new Date(),
  });
}

export async function checkFileAccess(fileId: string, userId: string, userRole: string) {
  const db = getAdminDb();
  if (!db) throw new Error('Database unavailable');
  
  const fileDoc = await db.collection('files').doc(fileId).get();
  if (!fileDoc.exists) return null;
  
  const fileData = fileDoc.data();
  
  // ✅ SECURITY: Allow if owner OR if admin
  if (fileData?.ownerId === userId || userRole === 'admin') {
    return fileData?.storagePath;
  }

  // ✅ SECURITY: Allow if user is related to the case (Associate or Clinician)
  if (fileData?.caseId) {
    const caseDoc = await db.collection('cases').doc(fileData.caseId).get();
    if (caseDoc.exists) {
      const caseData = caseDoc.data();
      if (caseData?.associateId === userId || caseData?.clinicianId === userId) {
        return fileData?.storagePath;
      }
    }
  }
  
  return null;
}
export async function checkFileAccessByPath(storagePath: string, userId: string, userRole: string) {
  const db = getAdminDb();
  if (!db) throw new Error('Database unavailable');
  
  const cleanPath = storagePath.replace(/^\//, '');
  const filesQuery = await db.collection('files').where('storagePath', '==', cleanPath).limit(1).get();
  
  if (filesQuery.empty) {
    // Fallback for legacy files: if it's in public/uploads, admins can see it anyway
    // but for specific users, we must have a record.
    return userRole === 'admin';
  }
  
  const fileData = filesQuery.docs[0].data();
  
  // Allow if owner OR admin
  if (fileData?.ownerId === userId || userRole === 'admin') return true;

  // Allow if related to case
  if (fileData?.caseId) {
    const caseDoc = await db.collection('cases').doc(fileData.caseId).get();
    if (caseDoc.exists) {
      const caseData = caseDoc.data();
      return caseData?.associateId === userId || caseData?.clinicianId === userId;
    }
  }

  return false;
}

export function isTrustedDomain(url: string, allowedDomains: string[]) {
  try {
    const { hostname } = new URL(url);
    return allowedDomains.includes(hostname);
  } catch {
    return false;
  }
}
