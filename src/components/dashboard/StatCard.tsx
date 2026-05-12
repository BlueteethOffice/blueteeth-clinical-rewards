'use client';

import { motion } from 'framer-motion';
import { LucideIcon } from 'lucide-react';

interface StatCardProps {
  title: string;
  value: string | number;
  icon: LucideIcon;
  trend?: string;
  color: string;
  className?: string;
}

export default function StatCard({ title, value, icon: Icon, trend, color, className }: StatCardProps) {
  return (
    <motion.div
      whileHover={{ y: typeof window !== 'undefined' && window.innerWidth > 768 ? -5 : 0 }}
      className={`glass-card p-4 sm:p-5 md:p-6 rounded-xl border border-slate-100 dark:border-white/5 shadow-sm bg-white dark:bg-slate-900/50 transition-all ${className}`}
    >
      <div className="flex items-center justify-between mb-4 sm:mb-5 md:mb-6">
        <div className={`p-3 sm:p-3.5 rounded-lg ${color} text-white shadow-lg shadow-black/5`}>
          <Icon size={18} strokeWidth={2.5} />
        </div>
        {trend && (
          <span className="text-[9px] sm:text-[10px] font-black text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400 px-2 py-0.5 sm:py-1 rounded-md uppercase tracking-widest">
            {trend}
          </span>
        )}
      </div>
      <p className="text-slate-400 dark:text-slate-500 text-[9px] sm:text-[10px] font-black uppercase tracking-[0.2em]">{title}</p>
      <h3 className="text-lg sm:text-xl md:text-2xl font-black text-slate-900 dark:text-white mt-1.5 tracking-tight uppercase">{value}</h3>
    </motion.div>
  );
}
