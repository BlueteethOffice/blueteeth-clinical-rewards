'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { motion } from 'framer-motion';
import { 
  LayoutDashboard, 
  PlusCircle, 
  FileText, 
  Wallet, 
  Users, 
  BarChart3, 
  Settings, 
  ClipboardList,
  Activity,
  X
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import SupportCard from './SupportCard';

export default function Sidebar({ 
  isMobileMenuOpen = false, 
  setIsMobileMenuOpen 
}: { 
  isMobileMenuOpen?: boolean; 
  setIsMobileMenuOpen?: (open: boolean) => void 
}) {
  const { user } = useAuth();
  const pathname = usePathname();

  const menuItems = {
    associate: [
      { name: 'Dashboard', icon: LayoutDashboard, href: '/dashboard/associate' },
      { name: 'Submit Case', icon: PlusCircle, href: '/dashboard/associate/submit-case' },
      { name: 'My Cases', icon: ClipboardList, href: '/dashboard/associate/my-cases' },
      { name: 'Earnings', icon: Wallet, href: '/dashboard/associate/earnings' },
    ],
    clinician: [
      { name: 'Dashboard', icon: LayoutDashboard, href: '/dashboard/clinician' },
      { name: 'Submit Case', icon: PlusCircle, href: '/dashboard/clinician/submit-case' },
      { name: 'Assigned Cases', icon: ClipboardList, href: '/dashboard/clinician/assigned-cases' },
      { name: 'Earnings', icon: Wallet, href: '/dashboard/clinician/earnings' },
    ],
    admin: [
      { name: 'Dashboard', icon: LayoutDashboard, href: '/dashboard/admin' },
      { name: 'Manage Cases', icon: ClipboardList, href: '/dashboard/admin/cases' },
      { name: 'Users', icon: Users, href: '/dashboard/admin/users' },
      { name: 'Payouts', icon: Wallet, href: '/dashboard/admin/payouts' },
      { name: 'Reports', icon: BarChart3, href: '/dashboard/admin/reports' },
    ],
  };

  const cachedUser = typeof window !== 'undefined' ? localStorage.getItem('cached_user') : null;
  const parsedCachedUser = cachedUser ? JSON.parse(cachedUser) : null;
  const activeRole = user?.role || parsedCachedUser?.role;
  const currentMenu = activeRole ? menuItems[activeRole as keyof typeof menuItems] : [];

  return (
    <div className={`
      w-64 sm:w-72 md:w-80 h-screen inset-y-0 bg-[hsl(var(--sidebar))] border-r border-[hsl(var(--sidebar-border))] 
      flex flex-col shrink-0 transition-transform duration-300 ease-in-out z-[70]
      fixed lg:sticky top-0 left-0
      ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'}
    `}>
      <div className="p-6 sm:p-8 md:p-10 pb-4 sm:pb-6 shrink-0 flex items-center justify-between relative">
        <Link href="/dashboard" className="flex items-center gap-2.5 sm:gap-3.5 group" onClick={() => setIsMobileMenuOpen && setIsMobileMenuOpen(false)}>
          <div className="shrink-0 w-12 h-12 sm:w-14 sm:h-14 md:w-16 md:h-16 bg-slate-50 dark:bg-slate-900 rounded-lg flex items-center justify-center border border-slate-200 dark:border-slate-700 p-2 shadow-sm transition-colors">
            <img 
              src="/logo.png" 
              alt="Logo" 
              className="w-full h-full object-contain transition-transform group-hover:scale-110 duration-300" 
            />
          </div>
          <div className="flex flex-col justify-center">
            <span className="text-[20px] sm:text-[24px] md:text-[28px] font-bold bg-linear-to-r from-cyan-600 to-blue-700 bg-clip-text text-transparent tracking-tight leading-none pb-1">BLUETEETH</span>
            <span className="text-[8px] sm:text-[9px] md:text-[10px] font-bold text-cyan-600 tracking-[0.3em] uppercase leading-none">CLINICAL PLATFORM</span>
          </div>
        </Link>

        {/* Close Button for Mobile */}
        <button 
          onClick={() => setIsMobileMenuOpen && setIsMobileMenuOpen(false)}
          className="lg:hidden p-2 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 transition-colors"
        >
          <X size={20} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar px-4 py-2 space-y-4 sm:space-y-6">
        <nav className="space-y-1 sm:space-y-2">
          {currentMenu.map((item) => {
            const isActive = pathname === item.href;
            return (
              <Link 
                key={item.name} 
                href={item.href} 
                prefetch={false} // ⚡ PERFORMANCE: Don't clog network with background fetches
                onClick={() => setIsMobileMenuOpen && setIsMobileMenuOpen(false)}
              >
                <div
                  className={`flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all duration-100 ${
                    isActive 
                      ? 'bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 shadow-sm' 
                      : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800/50 hover:text-slate-900 dark:hover:text-slate-100'
                  }`}
                >
                  <item.icon size={20} className={`shrink-0 ${isActive ? 'text-cyan-600' : 'text-slate-400'}`} />
                  <span className="text-sm tracking-tight">{item.name}</span>
                </div>
              </Link>
            );
          })}
        </nav>

        {activeRole === 'admin' ? (
          <div className="px-3 pb-0 mt-auto pt-10 sm:pt-4">
            <div className="bg-slate-900 dark:bg-slate-900/50 rounded-xl sm:rounded-2xl p-5 border border-slate-800 relative overflow-hidden group shadow-2xl shadow-cyan-900/30 mb-1">
              {/* Animated Glow Background */}
              <div className="absolute -top-24 -right-24 w-48 h-48 bg-cyan-500/10 blur-[80px] rounded-full group-hover:bg-cyan-500/20 transition-all duration-700" />
              
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-5">
                  <div className="w-10 h-10 bg-cyan-500/10 rounded-xl flex items-center justify-center border border-cyan-500/20 shadow-inner">
                    <Activity size={20} className="text-cyan-400 animate-pulse" />
                  </div>
                  <div>
                    <h3 className="font-bold text-xs uppercase tracking-[0.2em] text-white">System Core</h3>
                    <div className="flex items-center gap-1.5">
                      <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                      <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Active</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  {/* Metric 1: Performance */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-wider text-slate-500">
                      <span>Performance</span>
                      <span className="text-cyan-400">99.8%</span>
                    </div>
                    <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: '99.8%' }}
                        className="h-full bg-linear-to-r from-cyan-500 to-blue-600" 
                      />
                    </div>
                  </div>

                  {/* Metric 2: Server Load */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between items-center text-[9px] font-bold uppercase tracking-wider text-slate-500">
                      <span>Server Load</span>
                      <span className="text-emerald-400">12%</span>
                    </div>
                    <div className="h-1 bg-slate-800 rounded-full overflow-hidden">
                      <motion.div 
                        initial={{ width: 0 }}
                        animate={{ width: '12%' }}
                        className="h-full bg-emerald-500" 
                      />
                    </div>
                  </div>

                  {/* Grid Stats */}
                  <div className="grid grid-cols-2 gap-2 pt-2 border-t border-slate-800/50 mt-2">
                    <div className="p-2 bg-slate-800/30 rounded-lg border border-slate-800/50">
                      <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Uptime</p>
                      <p className="text-[10px] font-bold text-white tracking-tight">14d 6h</p>
                    </div>
                    <div className="p-2 bg-slate-800/30 rounded-lg border border-slate-800/50">
                      <p className="text-[8px] font-bold text-slate-500 uppercase tracking-wider mb-0.5">Latency</p>
                      <p className="text-[10px] font-bold text-white tracking-tight">24ms</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Decorative Background Icon */}
              <div className="absolute -bottom-6 -right-6 opacity-5 pointer-events-none">
                <LayoutDashboard size={120} className="text-white rotate-12" />
              </div>
            </div>
          </div>
        ) : (
          <SupportCard />
        )}
      </div>
    </div>
  );
}
