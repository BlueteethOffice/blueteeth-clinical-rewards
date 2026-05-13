'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // 🛡️ TIMEOUT FALLBACK: If loading is stuck for more than 2s, force a role check
    const timer = setTimeout(() => {
      const cached = localStorage.getItem('cached_user');
      if (cached) {
        const p = JSON.parse(cached);
        if (p.role) router.replace(`/dashboard/${p.role}`);
      }
    }, 2000);

    if (!loading) {
      if (user && user.role) {
        router.replace(`/dashboard/${user.role}`);
      } else if (!user) {
        router.replace('/login');
      }
    }
    return () => clearTimeout(timer);
  }, [user, loading, router]);

  return <div className="h-screen bg-slate-50 dark:bg-[#020617]" />;
}
