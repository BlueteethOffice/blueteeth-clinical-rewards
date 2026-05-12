import * as admin from 'firebase-admin';

/**
 * 🚀 PRODUCTION-READY FIREBASE ADMIN SINGLETON
 * Handles environment variable normalization and singleton instance management.
 */

const getAdminInstance = () => {
  try {
    if (admin.apps.length > 0) {
      return {
        db: admin.firestore(),
        auth: admin.auth(),
        error: null
      };
    }

    const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
      return { db: null, auth: null, error: "Missing Firebase environment variables (Project ID, Client Email, or Private Key)" };
    }

    // 🛠️ EXTREME KEY NORMALIZATION:
    // Some environments wrap the key in quotes, some escaped newlines.
    // This logic handles all common variations found in .env files.
    privateKey = privateKey.trim();
    if (privateKey.startsWith('"') && privateKey.endsWith('"')) {
      privateKey = privateKey.substring(1, privateKey.length - 1);
    }
    if (privateKey.startsWith("'") && privateKey.endsWith("'")) {
      privateKey = privateKey.substring(1, privateKey.length - 1);
    }
    
    // Replace literal "\n" string with actual newline character
    const normalizedKey = privateKey.replace(/\\n/g, '\n');

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey: normalizedKey,
      }),
    });

    console.log("✅ Firebase Admin: Initialized Successfully");
    
    return {
      db: admin.firestore(),
      auth: admin.auth(),
      error: null
    };
  } catch (error: any) {
    console.error("❌ Firebase Admin Initialization Failed:", error.message);
    return {
      db: null,
      auth: null,
      error: `Initialization Error: ${error.message}`
    };
  }
};

// Export dynamic getters to ensure we always have the freshest instance state
export const getAdminDb = () => getAdminInstance().db;
export const getAdminAuth = () => getAdminInstance().auth;
export const getAdminError = () => getAdminInstance().error;

// Keep legacy exports for compatibility but use the getters for stability
export const adminDb = getAdminInstance().db;
export const adminAuth = getAdminInstance().auth;
export const initError = getAdminInstance().error;
