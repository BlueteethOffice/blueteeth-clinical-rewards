'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { ChevronRight, Home, ArrowLeft } from 'lucide-react';
import { motion } from 'framer-motion';

// Pages where back button should NOT appear
const HUB_PATHS = [
  '/dashboard/admin',
  '/dashboard/clinician',
  '/dashboard/associate',
  '/dashboard/profile',
  '/dashboard/notifications',
  '/dashboard/settings',
];

export default function Breadcrumb() {
  const pathname = usePathname();
  const router = useRouter();
  const segments = pathname.split('/').filter(Boolean);

  // Skip rendering if we're on the root or unexpected path
  if (segments.length === 0) return null;

  // 🛡️ LOGIC: Hide back button on main hubs and shared top-level pages
  const isHubPage = HUB_PATHS.some(hub => pathname === hub) || segments.length <= 1;

  return (
    <div className="flex flex-row items-center justify-between gap-4 mb-8">
      {/* 🧭 LEFT: BREADCRUMBS */}
      <nav className="flex flex-wrap items-center gap-3 text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">
        <Link href="/dashboard" className="group flex items-center justify-center">
          <div className="w-8 h-8 bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 rounded-lg flex items-center justify-center group-hover:bg-cyan-50 dark:group-hover:bg-cyan-500/10 group-hover:border-cyan-100 dark:group-hover:border-cyan-500/20 transition-all shadow-sm">
            <Home size={14} className="text-cyan-600" />
          </div>
        </Link>
        
        {segments.map((segment, index) => {
          // Skip IDs in breadcrumbs (UUID/Firestore IDs are usually long)
          if (segment.length > 15) return null;

          const href = `/${segments.slice(0, index + 1).join('/')}`;
          const isLast = index === segments.length - 1;
          const name = segment.replace(/-/g, ' ');

          return (
            <div key={href} className="flex items-center gap-3">
              <ChevronRight size={12} className="text-slate-200 dark:text-slate-700" strokeWidth={3} />
              {isLast ? (
                <motion.span 
                  initial={{ opacity: 0, x: -5 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="text-slate-900 dark:text-white font-black whitespace-nowrap"
                >
                  {name}
                </motion.span>
              ) : (
                <Link 
                  href={href} 
                  className="hover:text-cyan-600 dark:hover:text-cyan-400 transition-all whitespace-nowrap"
                >
                  {name}
                </Link>
              )}
            </div>
          );
        })}
      </nav>

      {/* 🔙 RIGHT: GO BACK BUTTON */}
      {!isHubPage && (
        <button 
          onClick={() => router.back()}
          className="hidden sm:flex group items-center gap-2 px-3.5 py-1.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl text-[10px] font-black text-slate-500 dark:text-slate-400 hover:text-cyan-600 dark:hover:text-cyan-400 hover:border-cyan-200 dark:hover:border-cyan-500/30 transition-all shadow-sm hover:shadow-md active:scale-95 uppercase tracking-widest shrink-0"
        >
          <span>Go Back</span>
          <div className="w-4 h-4 bg-cyan-50 dark:bg-cyan-500/15 rounded flex items-center justify-center group-hover:bg-cyan-100 dark:group-hover:bg-cyan-500/25 transition-colors">
            <ArrowLeft size={10} className="text-cyan-500 transition-transform group-hover:-translate-x-0.5" />
          </div>
        </button>
      )}
    </div>
  );
}
