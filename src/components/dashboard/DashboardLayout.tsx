'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import Sidebar from './Sidebar';
import Navbar from './Navbar';
import Breadcrumb from '../shared/Breadcrumb';
import { Loader2, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';

export default function DashboardLayout({ children, hideNavbar = false }: { children: React.ReactNode, hideNavbar?: boolean }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [mounted, setMounted] = useState(false);

  // 🌓 GLOBAL THEME SYNC
  useEffect(() => {
    setMounted(true);
    const syncTheme = () => {
      const savedTheme = localStorage.getItem('theme');
      if (savedTheme === 'dark') {
        document.documentElement.classList.add('dark');
      } else {
        document.documentElement.classList.remove('dark');
      }
    };

    syncTheme();
    // Listen for storage changes (if theme is changed in another tab)
    window.addEventListener('storage', syncTheme);
    return () => window.removeEventListener('storage', syncTheme);
  }, []);

  useEffect(() => {
    // 🛡️ Safety Timeout
    const timer = setTimeout(() => {
      if (loading) console.warn("Auth timeout");
    }, 5000);

    if (!loading) {
      if (!user) {
        router.push('/login');
      } else if (user.twoFAEnabled && sessionStorage.getItem('2fa_verified') !== 'true') {
        router.push('/login');
      } else {
        // 🔒 ROLE PROTECTION
        const currentRole = user.role;
        const targetDashboard = pathname.split('/')[2]; // e.g., 'associate', 'clinician', 'profile'
        
        const universalPages = ['profile', 'settings', 'notifications'];
        
        if (targetDashboard && !universalPages.includes(targetDashboard) && targetDashboard !== currentRole) {
          console.warn(`🛡️ Role Mismatch: Redirecting ${currentRole} to their hub.`);
          router.replace(`/dashboard/${currentRole}`);
        }
      }
    }

    return () => clearTimeout(timer);
  }, [user, loading, router]);

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  useEffect(() => {
    // 🔒 BODY SCROLL LOCK
    if (isMobileMenuOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => { document.body.style.overflow = 'unset'; };
  }, [isMobileMenuOpen]);

  // ⚡ INSTANT SHELL LOGIC: Read once, memoize — don't parse localStorage on every render
  const parsedUser = useMemo(() => {
    try {
      const cachedUser = typeof window !== 'undefined' ? localStorage.getItem('cached_user') : null;
      return cachedUser ? JSON.parse(cachedUser) : null;
    } catch {
      if (typeof window !== 'undefined') localStorage.removeItem('cached_user');
      return null;
    }
  }, []); // Empty deps — only compute once on mount

  if (!mounted) return (
    <div className="h-screen bg-slate-50 dark:bg-[#020617]" />
  );

  // If loading and no cached user, show the high-quality pulse loader
  if (loading && !parsedUser) {
    return (
      <div className="h-screen flex items-center justify-center bg-slate-50 dark:bg-[#020617] transition-colors duration-200">
        <div className="text-center animate-pulse">
          <div className="relative w-16 h-16 mx-auto mb-6">
            <div className="absolute inset-0 border-4 border-cyan-100 dark:border-white/5 rounded-full" />
            <div className="absolute inset-0 border-4 border-t-cyan-500 rounded-full animate-spin" />
          </div>
          <p className="text-slate-400 dark:text-slate-500 font-black uppercase text-[9px] tracking-[0.3em]">Syncing Intel...</p>
        </div>
      </div>
    );
  }

  // Final fallback for missing auth after loading
  if (!loading && !user) {
    // router.push handles redirect, but we return null to stop rendering
    return null;
  }

  return (
    <div className="flex h-screen w-full bg-[hsl(var(--background))] dark:bg-[#020617] transition-all duration-300 overflow-hidden print:h-auto print:overflow-visible">
      <style jsx global>{`
        @media print {
          html, body { height: auto !important; overflow: visible !important; }
          .flex.h-screen { height: auto !important; overflow: visible !important; display: block !important; }
          main { overflow: visible !important; height: auto !important; padding: 0 !important; }
          .mesh-bg { background: none !important; }
        }
      `}</style>
      {/* Mobile Backdrop */}
      {isMobileMenuOpen && (
        <div 
          className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[60] lg:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}
      
      <Sidebar isMobileMenuOpen={isMobileMenuOpen} setIsMobileMenuOpen={setIsMobileMenuOpen} />
      
      <div className="flex-1 flex flex-col min-w-0 h-screen overflow-hidden">
        {!hideNavbar && <Navbar setIsMobileMenuOpen={setIsMobileMenuOpen} />}
        <main className={`flex-1 p-3 sm:p-8 pb-6 relative overflow-y-auto overflow-x-hidden mesh-bg ${hideNavbar ? 'pt-12' : 'pt-2 lg:pt-4'}`}>
          {!hideNavbar && (
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4 sm:mb-2">
              <Breadcrumb />
              <motion.button 
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => router.back()}
                className="group hidden sm:flex items-center justify-center gap-2 px-5 py-2.5 bg-cyan-50 dark:bg-cyan-500/10 border border-cyan-100 dark:border-cyan-500/20 rounded-md text-[10px] font-black text-cyan-600 dark:text-cyan-400 hover:bg-cyan-600 hover:text-white transition-all uppercase tracking-[0.2em] mb-2 sm:mb-6 shadow-sm w-full sm:w-auto"
              >
                <ArrowLeft size={14} className="group-hover:-translate-x-1 transition-transform" /> 
                Back
              </motion.button>
            </div>
          )}
          <div className="relative z-10">
            {children}
          </div>
        </main>
      </div>
    </div>
  );
}
