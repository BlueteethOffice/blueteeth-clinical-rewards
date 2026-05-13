'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // If we're done loading and have no user/role, go to login
    if (!loading) {
      if (user && user.role) {
        router.push(`/dashboard/${user.role}`);
      } else if (!user) {
        router.push('/login');
      }
    }
  }, [user, loading, router]);

  return (
    <div className="h-screen flex items-center justify-center">
      <Loader2 className="animate-spin text-cyan-500" size={32} />
    </div>
  );
}
