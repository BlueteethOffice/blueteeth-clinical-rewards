'use client';

import { useAuth } from '@/context/AuthContext';
import { Menu, Bell, Search, User, LogOut, Settings as SettingsIcon, ChevronDown, Sparkles, CheckCheck, Clock, AlertCircle as InfoIcon, CheckCircle2, AlertTriangle, XCircle, Loader2, BellRing, MoreVertical, Trash2, Hash, Phone, Users } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { signOut } from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { useNotifications } from '@/hooks/useNotifications';
import { formatDistanceToNow } from 'date-fns';
import { collection, query, where, getDocs, limit, doc, updateDoc } from 'firebase/firestore';
import { Case, User as AppUser } from '@/types';
import { formatName } from '@/lib/utils';

export default function Navbar({ setIsMobileMenuOpen }: { setIsMobileMenuOpen?: (val: boolean) => void }) {
  const { user } = useAuth();
  const router = useRouter();
  const { notifications, unreadCount, markAsRead, markAllAsRead } = useNotifications();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showLogoutModal, setShowLogoutModal] = useState(false);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const notificationRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLDivElement>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<{ cases: Case[], users: AppUser[], pages: any[] }>({ cases: [], users: [], pages: [] });
  const [isSearching, setIsSearching] = useState(false);
  const [showSearchResults, setShowSearchResults] = useState(false);

  // ... (keep all the existing functions like handleLogout, useEffects, handleCaseSelect)

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      // 1. Fire and forget server-side cleanup
      fetch('/api/auth/session', { method: 'DELETE' }).catch(() => {});
      
      // 2. Clear Firebase client-side auth
      await signOut(auth);
      
      // 3. Clean all caches (Unified)
      localStorage.removeItem('cached_user');
      localStorage.removeItem('user_role_hint');
      localStorage.removeItem('user_name_hint');
      sessionStorage.removeItem('2fa_verified');
      
      toast.success('Signed out');
      
      // 4. FAST REDIRECT: SPA transition instead of full reload
      router.push('/login');
    } catch (error) {
      toast.error('Logout failed. Please try again.');
      setIsLoggingOut(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target as Node)) setShowProfileMenu(false);
      if (notificationRef.current && !notificationRef.current.contains(e.target as Node)) setShowNotifications(false);
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowSearchResults(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const performSearch = async () => {
      if (!user?.uid) return;
      const qText = searchQuery.trim().toLowerCase();
      if (qText.length < 2) {
        setSearchResults({ cases: [], users: [], pages: [] });
        return;
      }
      setIsSearching(true);
      try {
        // 1. Search Pages (Local)
        const allPages = [
          { name: 'Dashboard', href: `/dashboard/${user.role}`, roles: ['admin', 'clinician', 'associate'] },
          { name: 'Submit Case', href: `/dashboard/${user.role}/submit-case`, roles: ['clinician', 'associate'] },
          { name: 'Assigned Cases', href: '/dashboard/clinician/assigned-cases', roles: ['clinician'] },
          { name: 'My Cases', href: '/dashboard/associate/my-cases', roles: ['associate'] },
          { name: 'Manage Cases', href: '/dashboard/admin/cases', roles: ['admin'] },
          { name: 'Users List', href: '/dashboard/admin/users', roles: ['admin'] },
          { name: 'Earnings & Payouts', href: `/dashboard/${user.role}/earnings`, roles: ['admin', 'clinician', 'associate'] },
          { name: 'Reports', href: '/dashboard/admin/reports', roles: ['admin'] },
          { name: 'Profile Settings', href: '/dashboard/profile', roles: ['admin', 'clinician', 'associate'] },
          { name: 'Account Settings', href: '/dashboard/settings', roles: ['admin', 'clinician', 'associate'] },
          { name: 'Notifications', href: '/dashboard/notifications', roles: ['admin', 'clinician', 'associate'] },
        ];

        const matchedPages = allPages.filter(p => 
          p.roles.includes(user.role as string) && 
          p.name.toLowerCase().includes(qText)
        );

        // 2. Search Firebase Records
        const casesRef = collection(db, 'cases');
        let matchedCases: Case[] = [];
        let matchedUsers: AppUser[] = [];
        
        let baseQuery;
        if (user?.role === 'admin') baseQuery = query(casesRef, limit(20));
        else if (user?.role === 'clinician') baseQuery = query(casesRef, where('clinicianId', '==', user.uid), limit(20));
        else baseQuery = query(casesRef, where('associateId', '==', user.uid), limit(20));

        const casesSnap = await getDocs(baseQuery);
        const allFetchedCases = casesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Case[];
        matchedCases = allFetchedCases.filter(c => 
          c.patientName?.toLowerCase().includes(qText) ||
          c.mobile?.includes(qText) ||
          c.treatmentType?.toLowerCase().includes(qText) ||
          c.id.toLowerCase().includes(qText)
        ).slice(0, 5);

        if (user?.role === 'admin') {
          const usersRef = collection(db, 'users');
          const usersSnap = await getDocs(query(usersRef, limit(20)));
          const allUsers = usersSnap.docs.map(doc => ({ uid: doc.id, ...doc.data() })) as AppUser[];
          matchedUsers = allUsers.filter(u => 
            u.name?.toLowerCase().includes(qText) ||
            u.email?.toLowerCase().includes(qText)
          ).slice(0, 5);
        }

        // Store results including pages
        setSearchResults({ 
          cases: matchedCases, 
          users: matchedUsers, 
          pages: matchedPages 
        });
      } catch (error) {
        console.error("Search failed:", error);
      } finally {
        setIsSearching(true); // Wait, this should be false, fixing it in the next chunk or here
        setIsSearching(false);
      }
    };
    const timer = setTimeout(performSearch, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, user]);

  const handleCaseSelect = (c: Case) => {
    const pathMap: Record<string, string> = { 'associate': 'my-cases', 'clinician': 'assigned-cases', 'admin': 'cases' };
    router.push(`/dashboard/${user?.role}/${pathMap[user?.role || 'associate'] || 'cases'}?id=${c.id}`);
    setSearchQuery('');
    setShowSearchResults(false);
  };

  return (
    <>
    <div className="w-full h-16 lg:h-20 bg-[hsl(var(--navbar))]/90 backdrop-blur-xl border-b border-[hsl(var(--sidebar-border))] flex items-center justify-between px-4 sm:px-8 sticky top-0 z-50 transition-all duration-300">
      
      <div className="flex items-center gap-2 lg:gap-4 flex-1">
        {/* Mobile Hamburger Menu */}
        <button 
          onClick={() => setIsMobileMenuOpen && setIsMobileMenuOpen(true)}
          className="lg:hidden p-2 -ml-2 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
        >
          <Menu size={24} />
        </button>

        {/* 🔎 SHARP SEARCH BAR */}
        <div className="relative flex-none w-[16rem] sm:w-[22rem] lg:w-[28rem]" ref={searchRef}>
          <div className={`flex items-center gap-2 sm:gap-4 bg-slate-100/50 dark:bg-slate-900/50 px-3 sm:px-5 py-1.5 sm:py-2.5 rounded-lg sm:rounded-xl w-full border transition-all duration-300 ${
            showSearchResults ? 'border-cyan-500 bg-white dark:bg-slate-900 shadow-xl' : 'border-slate-200 dark:border-slate-800'
          }`}>
            <Search size={18} className={`shrink-0 ${isSearching ? 'text-cyan-500 animate-pulse' : 'text-slate-400'}`} />
            <input 
              type="text" 
              placeholder="Search..." 
              value={searchQuery}
              onChange={(e) => { setSearchQuery(e.target.value); setShowSearchResults(true); }}
              onFocus={() => setShowSearchResults(true)}
              className="bg-transparent border-none outline-none text-xs sm:text-sm w-full text-slate-900 dark:text-white font-bold placeholder:text-slate-400 focus:ring-0 min-w-0"
            />
            {searchQuery && (
              <button onClick={() => setSearchQuery('')} className="shrink-0 text-slate-400 hover:text-slate-600 transition-colors">
                <XCircle size={16} />
              </button>
            )}
          </div>

        <AnimatePresence>
          {showSearchResults && searchQuery.length >= 2 && (
            <motion.div initial={{ opacity: 0, y: 10, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.98 }} className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-100 dark:border-slate-800 overflow-hidden z-50 p-1">
              {isSearching ? (
                <div className="p-8 flex flex-col items-center justify-center gap-2 text-slate-400">
                  <Loader2 className="animate-spin" size={20} />
                  <p className="text-[10px] font-black uppercase tracking-widest">Searching...</p>
                </div>
              ) : (searchResults.cases.length > 0 || searchResults.users.length > 0 || searchResults.pages.length > 0) ? (
                <div className="max-h-[28rem] overflow-y-auto custom-scrollbar">
                  {searchResults.pages.length > 0 && (
                    <div className="p-1">
                      <p className="px-3 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">Navigation</p>
                      {searchResults.pages.map(p => (
                        <button 
                          key={p.href} 
                          onClick={() => {
                            router.push(p.href);
                            setShowSearchResults(false);
                            setSearchQuery('');
                          }}
                          className="w-full text-left p-3 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg transition-all group flex items-center gap-3"
                        >
                          <div className="w-9 h-9 bg-slate-50 dark:bg-slate-800 rounded flex items-center justify-center text-slate-400 group-hover:bg-cyan-500 group-hover:text-white transition-all shadow-sm">
                            <SettingsIcon size={16} />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">{p.name}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Open Page</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {searchResults.cases.length > 0 && (
                    <div className="p-1">
                      <p className="px-3 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">Clinical Cases</p>
                      {searchResults.cases.map(c => (
                        <button key={c.id} onClick={() => handleCaseSelect(c)} className="w-full text-left p-3 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg transition-all group flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-slate-50 dark:bg-slate-800 rounded flex items-center justify-center text-slate-400 group-hover:bg-cyan-50 group-hover:text-cyan-600 transition-colors"><User size={16} /></div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-slate-900 dark:text-white truncate tracking-tight">{c.patientName}</p>
                              <p className="text-[10px] text-slate-400 font-bold">{c.mobile}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="text-[9px] font-black uppercase text-slate-400 block">{c.status}</span>
                            <span className="text-[8px] font-bold text-slate-300">ID: {c.id.slice(0, 8)}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}

                  {searchResults.users.length > 0 && (
                    <div className="p-1 border-t border-slate-50 dark:border-white/5 mt-1">
                      <p className="px-3 py-2 text-[9px] font-black text-slate-400 uppercase tracking-widest">Platform Users</p>
                      {searchResults.users.map(u => (
                        <button 
                          key={u.uid} 
                          onClick={() => {
                            router.push(`/dashboard/admin/users?search=${u.uid}`);
                            setShowSearchResults(false);
                            setSearchQuery('');
                          }}
                          className="w-full text-left p-3 hover:bg-slate-50 dark:hover:bg-white/5 rounded-lg transition-all group flex items-center justify-between"
                        >
                          <div className="flex items-center gap-3">
                            <div className="w-9 h-9 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-400 group-hover:bg-emerald-50 group-hover:text-emerald-600 transition-colors border-2 border-white dark:border-slate-700 overflow-hidden">
                              {u.photoURL ? <img src={u.photoURL} className="w-full h-full object-cover" /> : <Users size={16} />}
                            </div>
                            <div className="min-w-0">
                              <p className="text-sm font-bold text-slate-900 dark:text-white truncate tracking-tight">{u.name}</p>
                              <p className="text-[10px] text-slate-400 font-bold">{u.email}</p>
                            </div>
                          </div>
                          <span className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 rounded-full text-[8px] font-black text-slate-400 uppercase tracking-widest">{u.role}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-10 text-center text-slate-400 font-bold text-[10px] uppercase tracking-widest">No matching records</div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>

      <div className="flex items-center gap-2 sm:gap-4 lg:gap-8">
        {/* SHARP NOTIFICATIONS */}
        <div className="relative" ref={notificationRef}>
          <button 
            onClick={() => setShowNotifications(!showNotifications)}
            className={`relative w-9 h-9 sm:w-10 sm:h-10 flex items-center justify-center rounded-lg sm:rounded-full transition-all border ${
              showNotifications ? 'bg-cyan-50 border-cyan-200 text-cyan-600' : 'bg-transparent sm:bg-slate-50 dark:sm:bg-slate-900/50 border-transparent sm:border-slate-100 dark:sm:border-slate-800 text-slate-500 hover:bg-slate-100 hover:border-slate-200'
            }`}
          >
            <Bell size={18} className={unreadCount > 0 ? 'animate-pulse' : ''} />
            {unreadCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 sm:-top-1 sm:-right-1 min-w-4 h-4 px-1 bg-red-600 text-white text-[9px] font-black rounded-full border-2 border-white dark:border-slate-900 flex items-center justify-center shadow-sm leading-none">
                {unreadCount > 9 ? '9+' : unreadCount}
              </span>
            )}
          </button>

          <AnimatePresence>
            {showNotifications && (
              <motion.div 
                initial={{ opacity: 0, y: 10, scale: 0.95 }} 
                animate={{ opacity: 1, y: 0, scale: 1 }} 
                exit={{ opacity: 0, y: 10, scale: 0.95 }} 
                className="fixed lg:absolute left-4 right-4 lg:left-auto lg:right-0 top-[72px] lg:top-full mt-0 lg:mt-3 lg:w-80 bg-white dark:bg-slate-900 rounded-2xl shadow-2xl border border-slate-100 dark:border-slate-800 z-[100] overflow-hidden"
              >
                <div className="p-4 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-slate-50/50">
                  <h3 className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest">Notifications</h3>
                  {unreadCount > 0 && <button onClick={markAllAsRead} className="text-[9px] font-black text-cyan-600 uppercase tracking-widest">Clear All</button>}
                </div>
                <div className="max-h-[70vh] lg:max-h-96 overflow-y-auto custom-scrollbar">
                  {notifications.length > 0 ? (
                    <div className="divide-y divide-slate-50 dark:divide-white/5">
                      {notifications.map((n) => (
                        <button key={n.id} onClick={async () => { if (!n.isRead) await markAsRead(n.id); if (n.link) router.push(n.link); setShowNotifications(false); }} className={`w-full text-left p-4 hover:bg-slate-50 dark:hover:bg-white/5 transition-all flex gap-3 ${!n.isRead ? 'bg-cyan-50/20' : ''}`}>
                          <div className={`w-8 h-8 rounded flex-shrink-0 flex items-center justify-center ${n.type === 'success' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                            {n.type === 'success' ? <CheckCircle2 size={14} /> : <InfoIcon size={14} />}
                          </div>
                          <div className="min-w-0">
                            <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{n.title}</p>
                            <p className="text-[10px] text-slate-500 line-clamp-1">{n.message}</p>
                          </div>
                        </button>
                      ))}
                    </div>
                  ) : <div className="p-8 text-center text-slate-400 font-bold text-[10px] uppercase">All caught up</div>}
                </div>
                <Link href="/dashboard/notifications" onClick={() => setShowNotifications(false)}>
                  <div className="p-3 bg-slate-50 dark:bg-white/5 text-center text-[9px] font-black text-slate-400 uppercase tracking-widest border-t">View All activity</div>
                </Link>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* SIMPLE PROFILE */}
        <div className="relative" ref={profileMenuRef}>
          <button onClick={() => setShowProfileMenu(!showProfileMenu)} className="flex items-center gap-2 sm:gap-4 pl-1 sm:pl-6 sm:border-l sm:border-slate-100 sm:dark:border-slate-800 group">
            <div className="text-right hidden md:block">
              <p className="text-xs font-black text-slate-900 dark:text-slate-100 group-hover:text-cyan-600 transition-colors">{formatName(user?.displayName || user?.name || 'User', user?.role || '')}</p>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">{user?.role}</p>
            </div>
            <div className="w-9 h-9 sm:w-11 sm:h-11 bg-transparent sm:bg-slate-100 dark:sm:bg-slate-800 rounded-xl md:rounded-full flex items-center justify-center text-slate-500 overflow-hidden sm:ring-2 ring-transparent md:group-hover:ring-cyan-100 dark:md:group-hover:ring-cyan-500/30 transition-all sm:shadow-sm">
              {user?.photoURL ? <img src={user.photoURL} alt="Profile" className="w-full h-full object-cover" /> : <User size={18} />}
            </div>
            <ChevronDown size={16} className={`text-slate-500 ml-1 transition-transform duration-300 hidden sm:block ${showProfileMenu ? 'rotate-180' : ''}`} />
          </button>
          <AnimatePresence>
            {showProfileMenu && (
              <motion.div initial={{ opacity: 0, y: 10, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 10, scale: 0.95 }} className="absolute right-0 mt-3 w-56 bg-white dark:bg-slate-900 rounded-xl shadow-2xl border border-slate-100 dark:border-slate-800 p-2 z-50">
                <div className="px-3 py-2 bg-slate-50 dark:bg-slate-800 rounded-lg mb-2">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Session ID</p>
                  <p className="text-[10px] font-bold text-slate-900 dark:text-white truncate">{user?.email}</p>
                </div>
                <div className="space-y-0.5">
                  <Link href="/dashboard/profile" onClick={() => setShowProfileMenu(false)}><button className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 rounded-lg transition-all"><User size={16} /> My Profile</button></Link>
                  <Link href="/dashboard/settings" onClick={() => setShowProfileMenu(false)}><button className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold text-slate-600 hover:bg-slate-50 rounded-lg transition-all"><SettingsIcon size={16} /> Settings</button></Link>
                  <button onClick={() => { setShowProfileMenu(false); setShowLogoutModal(true); }} className="w-full flex items-center gap-3 px-3 py-2 text-xs font-bold text-red-500 hover:bg-red-50 rounded-lg transition-all mt-2 pt-2 border-t border-slate-50"><LogOut size={16} /> Sign Out</button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        </div>
    </div>

    {/* Logout Confirmation Modal */}
    <AnimatePresence>
      {showLogoutModal && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={() => !isLoggingOut && setShowLogoutModal(false)} />
          <motion.div initial={{ opacity: 0, scale: 0.9, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.9, y: 20 }} className="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl p-10 w-full max-w-sm z-10 border border-slate-100 dark:border-white/5">
            <h2 className="text-base font-black text-slate-900 dark:text-white text-center mb-8 uppercase tracking-[0.2em]">Confirm Exit?</h2>
            <div className="flex gap-3">
              <button onClick={() => setShowLogoutModal(false)} disabled={isLoggingOut} className="flex-1 py-3.5 text-[10px] font-black uppercase tracking-widest bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl hover:bg-slate-200 transition-all">No</button>
              <button onClick={handleLogout} disabled={isLoggingOut} className="flex-1 py-3.5 text-[10px] font-black uppercase tracking-widest bg-red-500 text-white rounded-xl shadow-lg shadow-red-500/20 hover:bg-red-600 transition-all flex items-center justify-center gap-2">
                {isLoggingOut ? <Loader2 size={14} className="animate-spin" /> : 'Sign Out'}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
}
