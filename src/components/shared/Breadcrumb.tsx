'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ChevronRight, Home } from 'lucide-react';
import { motion } from 'framer-motion';

export default function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split('/').filter(Boolean);

  // Skip rendering if we're on the root or unexpected path
  if (segments.length === 0) return null;

  return (
    <nav className="flex flex-wrap items-center gap-3 text-[10px] font-bold text-slate-400 mb-6 uppercase tracking-[0.2em]">
      <Link href="/dashboard" className="group flex items-center justify-center">
        <div className="w-8 h-8 bg-white border border-slate-100 rounded-lg flex items-center justify-center group-hover:bg-cyan-50 group-hover:border-cyan-100 transition-all shadow-sm">
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
            <ChevronRight size={12} className="text-slate-200" strokeWidth={3} />
            {isLast ? (
              <motion.span 
                initial={{ opacity: 0, x: -5 }}
                animate={{ opacity: 1, x: 0 }}
                className="text-slate-900 font-bold whitespace-nowrap"
              >
                {name}
              </motion.span>
            ) : (
              <Link 
                href={href} 
                className="hover:text-cyan-600 transition-all whitespace-nowrap"
              >
                {name}
              </Link>
            )}
          </div>
        );
      })}
    </nav>
  );
}
