'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import Breadcrumb from '../shared/Breadcrumb';
import { Loader2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  if (!mounted) return <div className="h-screen bg-slate-50 dark:bg-[#020617]" />;

  // ⚡ ANTI-STUCK: Only show loader if we have NO user AND we are still loading
  if (!user && loading && mounted) {
    return (
      <div className="min-h-screen bg-slate-50 dark:bg-[#020617] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 bg-cyan-500/10 rounded-xl flex items-center justify-center border border-cyan-500/20 animate-pulse">
            <div className="w-6 h-6 bg-cyan-500 rounded-lg opacity-40" />
          </div>
          <p className="text-[10px] font-bold text-cyan-600/40 uppercase tracking-[0.4em] animate-pulse">Syncing Intel...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#020617] flex">
      {/* Mobile Backdrop */}
      <AnimatePresence>
        {isMobileMenuOpen && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsMobileMenuOpen(false)}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm z-60 lg:hidden"
          />
        )}
      </AnimatePresence>

      <Sidebar isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />
      
      <div className="flex-1 flex flex-col min-h-screen relative overflow-x-hidden">
        {!hideNavbar && <Navbar setIsMobileMenuOpen={setIsMobileMenuOpen} />}
        
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
