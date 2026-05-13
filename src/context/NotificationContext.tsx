'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { db } from '@/lib/firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  limit, 
  updateDoc, 
  doc, 
  writeBatch 
} from 'firebase/firestore';
import { useAuth } from './AuthContext';
import toast from 'react-hot-toast';
import { BellRing } from 'lucide-react';

interface Notification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'success' | 'info' | 'warning' | 'error';
  isRead: boolean;
  createdAt: any;
  link?: string;
  relatedCaseId?: string;
}

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  loading: boolean;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) {
      setNotifications([]);
      setUnreadCount(0);
      setLoading(false);
      return;
    }

    // 🚀 NO-INDEX QUERY: Removed 'orderBy' to prevent Firebase Index Errors
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', user.uid),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const notifsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Notification[];

      // 🔄 Client-Side Sorting (No Index Required)
      notifsData.sort((a, b) => {
        const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return timeB - timeA;
      });

      // Show toast for brand new entries
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added' && !loading) {
          const newNotif = change.doc.data() as Notification;
          const isRecent = newNotif.createdAt?.toDate ? (Date.now() - newNotif.createdAt.toDate().getTime() < 8000) : false;
          
          if (isRecent) {
            toast.custom((t) => (
              <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-white dark:bg-slate-900 shadow-2xl rounded-2xl pointer-events-auto flex ring-1 ring-black ring-opacity-5 border-l-4 border-cyan-500`}>
                <div className="flex-1 w-0 p-4">
                  <div className="flex items-start">
                    <div className="flex-shrink-0 pt-0.5">
                      <div className="w-10 h-10 bg-cyan-50 dark:bg-cyan-900/30 rounded-xl flex items-center justify-center text-cyan-600">
                        <BellRing size={20} className="animate-bounce" />
                      </div>
                    </div>
                    <div className="ml-3 flex-1">
                      <p className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-widest">{newNotif.title}</p>
                      <p className="mt-1 text-sm font-medium text-slate-500 dark:text-slate-400 leading-relaxed line-clamp-2">{newNotif.message}</p>
                    </div>
                  </div>
                </div>
                <div className="flex border-l border-slate-100 dark:border-white/5">
                  <button onClick={() => toast.dismiss(t.id)} className="w-full border border-transparent rounded-none rounded-r-2xl p-4 flex items-center justify-center text-sm font-black text-slate-400 hover:text-slate-600 dark:hover:text-white transition-colors uppercase tracking-widest">Close</button>
                </div>
              </div>
            ), { duration: 5000 });
          }
        }
      });

      setNotifications(notifsData);
      setUnreadCount(notifsData.filter(n => !n.isRead).length);
      setLoading(false);
    }, (error) => {
      // 🛡️ SILENT PERMISSION ERRORS: Gracefully handle auth revocation during logout
      if (error.code === 'permission-denied') {
        console.log("Notification listener gracefully detached.");
      } else {
        console.error("Notification Error:", error);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { isRead: true });
    } catch (e) {
      console.error("Mark read failed", e);
    }
  };

  const markAllAsRead = async () => {
    if (!user || unreadCount === 0) return;
    try {
      const batch = writeBatch(db);
      notifications.filter(n => !n.isRead).forEach(n => {
        batch.update(doc(db, 'notifications', n.id), { isRead: true });
      });
      await batch.commit();
      toast.success('Clearance complete');
    } catch (e) {
      console.error("Batch clear failed", e);
    }
  };

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, loading, markAsRead, markAllAsRead }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (context === undefined) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
}
