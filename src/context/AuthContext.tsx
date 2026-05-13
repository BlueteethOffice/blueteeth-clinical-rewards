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
    // ⚡ INSTANT BOOT: Use unified cache for immediate UI shell
    if (typeof window !== 'undefined') {
      const cached = localStorage.getItem('cached_user');
      if (cached) {
        try { return JSON.parse(cached); } catch { return null; }
      }
    }
    return null;
  });
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserData = async (uid: string) => {
    try {
      const userDoc = await getDoc(doc(db, 'users', uid));
      if (userDoc.exists()) {
        const userData = userDoc.data() as AppUser;
        const displayName = formatName(userData.name, userData.role);
        const fullUser = { ...userData, uid, displayName } as AppUser;
        setUser(fullUser);
        localStorage.setItem('cached_user', JSON.stringify(fullUser));
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
    
    // 🛡️ SPEED MODE: If we have a cached user, we can stop the initial spinner faster
    if (user) {
      setLoading(false);
    }

    // 🛡️ FAIL-SAFE: Force loading to false after 3 seconds no matter what
    const forceLoadTimeout = setTimeout(() => {
      setLoading(false);
    }, 3000);

    const unsubscribeAuth = onAuthStateChanged(auth, async (fUser) => {
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
      }

      setFirebaseUser(fUser);
      
      if (!fUser) {
        setUser(null);
        localStorage.removeItem('cached_user');
        setLoading(false);
        return;
      }

      // ⚡ REAL-TIME SNAPSHOT (Low Latency)
      unsubscribeSnapshot = onSnapshot(doc(db, 'users', fUser.uid), (docSnap) => {
        if (docSnap.exists()) {
          const userData = docSnap.data() as AppUser;
          const displayName = formatName(userData.name, userData.role);
          const fullUser = { ...userData, uid: fUser.uid, displayName };
          setUser(fullUser);
          localStorage.setItem('cached_user', JSON.stringify(fullUser));
          setLoading(false);
        }
      });
    });

    return () => {
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
