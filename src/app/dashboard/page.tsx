'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading) {
      if (user && user.role) {
        router.replace(`/dashboard/${user.role}`);
      } else if (!user) {
        router.replace('/login');
      }
    }
    return () => {};
  }, [user, loading, router]);

  return <div className="h-screen bg-slate-50 dark:bg-[#020617]" />;
}
