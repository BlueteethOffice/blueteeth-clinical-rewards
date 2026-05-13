'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import Breadcrumb from '../shared/Breadcrumb';
import { Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

export default function DashboardLayout({ children, hideNavbar = false }: { children: React.ReactNode, hideNavbar?: boolean }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // ⚡ PREFETCH: Background load relevant hubs
    if (user?.role) {
      router.prefetch(`/dashboard/${user.role}`);
      router.prefetch('/dashboard/profile');
    }
  }, [user]);

  // Handle Auth Redirects (Faster Logic)
  useEffect(() => {
    if (!loading) {
      if (!user) {
        router.replace('/login');
      } else if (user.twoFAEnabled && sessionStorage.getItem('2fa_verified') !== 'true') {
        router.replace('/login');
      }
    }
  }, [user, loading, router]);

  if (!mounted) return <div className="h-screen bg-slate-50 dark:bg-[#020617]" />;

  // ⚡ ANTI-STUCK: Never show a full-screen spinner that blocks the user
  if (!user && loading && mounted) {
    // Show a minimal skeleton or nothing instead of a blocking spinner
    return <div className="min-h-screen bg-slate-50 dark:bg-[#020617]" />;
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#020617] flex">
      <Sidebar />
      
      <div className="flex-1 flex flex-col min-h-screen relative overflow-x-hidden">
        {!hideNavbar && <Navbar />}
        
        <main className={`flex-1 ${hideNavbar ? '' : 'p-3 sm:p-6'} relative z-10`}>
          {!hideNavbar && <Breadcrumb />}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.3 }}
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
