'use client';

import React, { createContext, useContext, useEffect, useState } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
import { doc, getDoc, onSnapshot } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { User as AppUser } from '@/types';
import { formatName } from '@/lib/utils';

interface AuthContextType {
  user: AppUser | null;
  loading: boolean;
  firebaseUser: FirebaseUser | null;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: true,
  firebaseUser: null,
  refreshUser: async () => {},
});

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<AppUser | null>(() => {
    // ⚡ INSTANT LOAD: Try to recover basic user info from cache immediately
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('cached_user');
      if (cached) {
        try {
          return JSON.parse(cached);
        } catch (e) {
          return null;
        }
      }
    }
    return null;
  });
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Still keep refreshUser for manual triggers, but onSnapshot will do the heavy lifting
  const fetchUserData = async (uid: string) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        const userData = userDoc.data() as AppUser;
        const displayName = formatName(userData.name, userData.role);
        setUser({ ...userData, uid, displayName } as AppUser);
      }
    } catch (error) {
      console.error("Error fetching user data:", error);
    }
  };

  const refreshUser = async () => {
    if (firebaseUser) {
      await fetchUserData(firebaseUser.uid);
    }
  };

  useEffect(() => {
    let unsubscribeSnapshot: (() => void) | null = null;
    
    // ⚡ INITIALIZATION: If we have a cached user, we can set loading to false earlier
    const hasCache = typeof window !== 'undefined' && !!localStorage.getItem('cached_user');
    if (hasCache) {
      setLoading(false);
    }
    
    // 🛡️ CRITICAL SAFETY TIMEOUT:
    // If Firebase SDK hangs or network is slow, don't leave user spinning forever.
    const globalTimeoutId = setTimeout(() => {
      console.warn("Auth check: Global safety timeout reached. Clearing session...");
      
      // If we are still loading after 4s, something is wrong.
      // Clear session cookie and local storage to break potential redirect loops.
      fetch('/api/auth/session', { method: 'DELETE' }).catch(() => {});
      document.cookie = "user_role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
      localStorage.removeItem('cached_user');
      localStorage.removeItem('cached_user_role');
      
      setLoading(false);
    }, 4000);

    const unsubscribeAuth = onAuthStateChanged(auth, async (fUser) => {
      // 🛡️ IMMEDIATE CLEANUP: Stop listening to profile data before changing auth state
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
      }

      setFirebaseUser(fUser);
      
      // 🛡️ SPEED OPTIMIZATION: Stop loading immediately if no user (logged out)
      if (!fUser) {
        clearTimeout(globalTimeoutId);
        setUser(null);
        localStorage.removeItem('cached_user'); // Clear cache on logout
        localStorage.removeItem('cached_user_role');
        
        // Clear cookies
        document.cookie = "user_role=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        fetch('/api/auth/session', { method: 'DELETE' }).catch(() => {});
        
        setLoading(false);
        return;
      }

      // Sync session cookie
      try {
        const idToken = await fUser.getIdToken();
        await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken })
        });
      } catch (e) {
        console.error("Failed to sync session:", e);
      }

      // Clear previous snapshot listener if any
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
      }

      // ⚡ REAL-TIME SNAPSHOT LISTENER
      unsubscribeSnapshot = onSnapshot(doc(db, 'users', fUser.uid), (docSnap) => {
        clearTimeout(globalTimeoutId);
        if (docSnap.exists()) {
          const userData = docSnap.data() as AppUser;
          const displayName = formatName(userData.name, userData.role);
          const fullUser = { ...userData, uid: fUser.uid, displayName };
          setUser(fullUser);
          
          // 💾 PERSIST FOR INSTANT LOAD: Store basic identity
          localStorage.setItem('cached_user', JSON.stringify({
            uid: fUser.uid,
            role: userData.role,
            name: userData.name
          }));
          localStorage.setItem('cached_user_role', userData.role);

          // 🛡️ SYNC ROLE TO COOKIE for Middleware RBAC
          document.cookie = `user_role=${userData.role}; path=/; max-age=3600; SameSite=Lax`;
        }
        // EAGER LOADING: Stop spinner as soon as we have the first snapshot
        setLoading(false);
      }, (error) => {
        clearTimeout(globalTimeoutId);
        console.error("Auth Snapshot Error:", error);
        setLoading(false);
      });
    });

    return () => {
      clearTimeout(globalTimeoutId);
      unsubscribeAuth();
      if (unsubscribeSnapshot) unsubscribeSnapshot();
    };
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, firebaseUser, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);
