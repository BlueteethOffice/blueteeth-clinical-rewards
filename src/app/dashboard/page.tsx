'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { Loader2 } from 'lucide-react';

export default function DashboardPage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    // Safety timeout: If auth takes more than 5s, redirect to login
    const safetyTimeout = setTimeout(() => {
      if (loading) {
        console.warn("Auth check timed out, redirecting to login...");
        router.push('/login');
      }
    }, 5000);

    if (!loading) {
      clearTimeout(safetyTimeout);
      if (user && user.role) {
        router.push(`/dashboard/${user.role}`);
      } else {
        router.push('/login');
      }
    }

    return () => clearTimeout(safetyTimeout);
  }, [user, loading, router]);

  return (
    <div className="h-screen flex items-center justify-center">
      <Loader2 className="animate-spin text-cyan-500" size={32} />
    </div>
  );
}
