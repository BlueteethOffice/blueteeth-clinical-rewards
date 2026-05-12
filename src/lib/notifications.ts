import { db } from './firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

interface NotificationPayload {
  title: string;
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
  link?: string;
}

/**
 * Sends a system notification to a specific user.
 * This both adds to Firestore and triggers external delivery (Email/WhatsApp) via API.
 */
export const sendSystemNotification = async (userId: string, payload: NotificationPayload) => {
  try {
    // 1. Add to Firestore for in-app notification list
    await addDoc(collection(db, 'notifications'), {
      userId,
      title: payload.title,
      message: payload.message,
      type: payload.type,
      link: payload.link || '',
      isRead: false,
      createdAt: serverTimestamp(),
    });

    // 2. Trigger external dispatch (Email/WhatsApp) via our API route
    // We do this via an internal fetch to keep the UI snappy
    try {
      fetch(`${window.location.origin}/api/notifications/dispatch`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          title: payload.title,
          message: payload.message,
        }),
      }).catch(e => console.error("Notification Dispatch Trigger Failed:", e));
    } catch (e) {
      // Silent fail for background dispatch
    }

    return { success: true };
  } catch (error) {
    console.error("Error sending notification:", error);
    return { success: false, error };
  }
};
