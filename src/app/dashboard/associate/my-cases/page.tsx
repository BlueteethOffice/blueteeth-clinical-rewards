'use client';

import { useEffect, useState, useMemo } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { Case } from '@/types';
import { useRouter } from 'next/navigation';
import { 
  Search, 
  ExternalLink, 
  Clock, 
  CheckCircle2, 
  XCircle,
  Loader2,
  AlertCircle,
  Plus,
  User,
  ArrowRight,
  ArrowUpRight,
  FileText,
  MapPin,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';

export default function MyCasesPage() {
  const { user } = useAuth();
  const router = useRouter();
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeTab, setActiveTab] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  useEffect(() => {
    if (!user?.uid) return;

    // ⚡ PERFORMANCE FIX: Limit rendered cases to prevent UI lag
    const q = query(
      collection(db, 'cases'),
      where('associateId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const casesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Case[];
      
      // Sort newest first: Handle null timestamps (pending sync) by treating them as current time
      casesData.sort((a, b) => {
        const dateA = (a as any).createdAt?.toMillis ? (a as any).createdAt.toMillis() : Date.now();
        const dateB = (b as any).createdAt?.toMillis ? (b as any).createdAt.toMillis() : Date.now();
        return dateB - dateA;
      });

      setCases(casesData);
      setLoading(false);
    }, (error) => {
      console.error("Firestore Error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  // ⚡ WORKABLE SEARCH & FILTER LOGIC
  const { paginatedCases, totalPages } = useMemo(() => {
    let result = [...cases].sort((a, b) => {
      const timeA = a.createdAt?.toDate?.()?.getTime() || 0;
      const timeB = b.createdAt?.toDate?.()?.getTime() || 0;
      return timeB - timeA;
    });

    if (activeTab !== 'all') {
      result = result.filter(c => c.status === activeTab);
    }

    if (searchTerm.trim()) {
      const term = searchTerm.toLowerCase();
      result = result.filter(c => 
        c.patientName.toLowerCase().includes(term) ||
        c.treatmentType.toLowerCase().includes(term) ||
        c.id.toLowerCase().includes(term)
      );
    }

    const total = Math.ceil(result.length / itemsPerPage);
    const sliced = result.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage);

    return { paginatedCases: sliced, totalPages: total };
  }, [cases, searchTerm, activeTab, currentPage]);

  // Reset to page 1 when search or tab changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, activeTab]);

  return (
    <DashboardLayout>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-10">
        <div className="min-w-0">
          <h1 className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight uppercase">Clinical Records</h1>
          <p className="text-[10px] sm:text-sm text-slate-500 font-bold mt-1 uppercase tracking-wide">Manage and track your patient submissions in real-time.</p>
        </div>
        <Link href="/dashboard/associate/submit-case" className="shrink-0">
          <button className="bg-slate-900 dark:bg-slate-100 dark:text-slate-900 text-white px-5 sm:px-8 py-3 sm:py-3.5 rounded-lg sm:rounded-xl font-bold text-[10px] sm:text-xs uppercase tracking-wider shadow-xl shadow-slate-200 dark:shadow-none flex items-center justify-center gap-2 hover:bg-slate-800 dark:hover:bg-white active:scale-95 transition-all w-full sm:w-auto">
            <Plus size={18} strokeWidth={3} className="w-4 h-4 sm:w-[18px] sm:h-[18px]" />
            Submit New Case
          </button>
        </Link>
      </div>

      <div className="space-y-6">
        {/* Search & Filter Bar */}
        <div className="glass-card p-3 sm:p-4 rounded-lg sm:rounded-xl border-slate-100/50 bg-white shadow-sm">
          <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
            <div className="relative flex-1">
              <Search className="absolute left-3 sm:left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="Search patient, treatment..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-10 sm:pl-12 pr-3 sm:pr-4 py-2 sm:py-3 bg-slate-50 border border-slate-100 rounded-lg sm:rounded-xl focus:border-cyan-600 focus:bg-white transition-all outline-none font-bold text-[11px] sm:text-sm"
              />
            </div>
            
            <div className="flex items-center p-0.5 sm:p-1 bg-slate-50 rounded-lg sm:rounded-xl overflow-x-auto no-scrollbar whitespace-nowrap">
              {['all', 'pending', 'assigned', 'approved', 'rejected'].map((tab) => (
                <button
                  key={tab}
                  onClick={() => setActiveTab(tab)}
                  className={`px-2.5 sm:px-4 py-1.5 sm:py-2 rounded-md sm:rounded-lg text-[9px] sm:text-[10px] font-bold uppercase tracking-wider transition-all ${
                    activeTab === tab ? 'bg-white text-cyan-600 shadow-sm' : 'text-slate-400 hover:text-slate-600'
                  }`}
                >
                  {tab}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* 📋 CASE CARDS GRID */}
        <div className="grid grid-cols-1 gap-4">
          {loading ? (
            <div className="py-24 flex flex-col items-center justify-center text-slate-400 gap-4 bg-white rounded-xl border border-dashed border-slate-200">
              <Loader2 className="animate-spin text-cyan-600" size={40} />
              <p className="text-[10px] font-bold uppercase tracking-[0.2em]">Syncing Data...</p>
            </div>
          ) : paginatedCases.length > 0 ? (
            <>
              <AnimatePresence mode="popLayout">
                {paginatedCases.map((c, index) => (
                  <motion.div
                    key={c.id}
                    layout
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, scale: 0.95 }}
                    transition={{ delay: index * 0.03 }}
                  >
                    <Link href={`/dashboard/associate/my-cases/${c.id}`} className="block transition-transform active:scale-[0.98]">
                      <div className="glass-card p-4 sm:p-5 sm:pr-6 rounded-xl border-slate-100/50 dark:border-white/5 hover:border-cyan-200 dark:hover:border-cyan-500/30 hover:shadow-xl hover:shadow-cyan-500/5 dark:hover:shadow-none transition-all duration-300 group bg-white dark:bg-slate-900/50 cursor-pointer">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                          {/* 👤 Patient Info */}
                          <div className="flex items-center gap-3 sm:gap-4 min-w-0 sm:min-w-[280px]">
                            <div className="w-12 h-12 sm:w-14 sm:h-14 bg-linear-to-br from-cyan-500/10 to-blue-500/10 dark:from-cyan-500/20 dark:to-blue-500/20 backdrop-blur-md rounded-xl sm:rounded-2xl flex items-center justify-center text-cyan-600 dark:text-cyan-400 shrink-0 border border-cyan-100/50 dark:border-cyan-500/20 group-hover:scale-110 transition-all duration-500 shadow-sm">
                              <User size={24} className="w-5 h-5 sm:w-6 sm:h-6" />
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-sm sm:text-base font-bold text-slate-900 dark:text-white group-hover:text-cyan-600 transition-colors truncate uppercase tracking-tight">{c.patientName}</span>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded text-[8px] sm:text-[9px] font-bold font-mono tracking-tight uppercase">#{c.id.slice(-8)}</span>
                                <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 flex items-center gap-1 uppercase">
                                  <Clock size={10} /> {c.createdAt?.toDate ? format(c.createdAt.toDate(), 'dd MMM, HH:mm') : 'Recently'}
                                </span>
                              </div>
                            </div>
                          </div>

                          {/* 🦷 Treatment Info */}
                          <div className="flex-1 grid grid-cols-2 gap-4 sm:gap-6">
                            <div className="flex flex-col">
                              <p className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Procedure</p>
                              <div className="flex items-center gap-1.5 text-slate-700 dark:text-slate-300">
                                <FileText size={14} className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-300 dark:text-slate-600" />
                                <span className="text-[11px] sm:text-sm font-bold tracking-tight truncate">{c.treatmentType}</span>
                              </div>
                            </div>
                            <div className="flex flex-col">
                              <p className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Location</p>
                              <div className="flex items-center gap-1.5 text-slate-500 dark:text-slate-400">
                                <MapPin size={14} className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-slate-300 dark:text-slate-600" />
                                <span className="text-[10px] sm:text-[11px] font-bold truncate">{c.clinicLocation}</span>
                              </div>
                            </div>
                          </div>

                          {/* 💰 Rewards & Status */}
                          <div className="flex items-center gap-4 sm:gap-8 justify-between md:justify-end min-w-0 sm:min-w-[200px]">
                            <div className="text-left md:text-right">
                              <p className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-wider">Points</p>
                              <div className="flex items-center gap-1 mt-0.5">
                                <span className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">{c.points || 0}</span>
                                <span className="text-[9px] sm:text-[10px] font-bold text-cyan-600 uppercase">PTS</span>
                              </div>
                            </div>

                            <div className="flex flex-col items-end gap-2">
                              <span className={`px-2 sm:px-3 py-1 sm:py-1.5 rounded-lg text-[8px] sm:text-[9px] font-bold uppercase tracking-[0.1em] inline-flex items-center gap-1.5 shadow-sm ${
                                c.status === 'approved' ? 'bg-emerald-500 text-white' :
                                c.status === 'pending' ? 'bg-amber-400 text-white' :
                                c.status === 'rejected' ? 'bg-rose-500 text-white' :
                                c.status === 'assigned' ? 'bg-blue-500 text-white' :
                                'bg-cyan-500 text-white'
                              }`}>
                                <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse block" />
                                {c.status}
                              </span>
                              <div className="w-8 h-8 sm:w-10 sm:h-10 bg-slate-50 dark:bg-slate-800 text-slate-300 rounded-lg sm:rounded-xl flex items-center justify-center group-hover:bg-cyan-600 group-hover:text-white group-hover:rotate-45 active:scale-90 transition-all duration-300 shadow-sm border border-transparent group-hover:border-cyan-400/30">
                                <ArrowUpRight className="w-4 h-4 sm:w-5 sm:h-5" strokeWidth={3} />
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                ))}
              </AnimatePresence>

              {/* 📟 PAGINATION CONTROLS */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between pt-6 border-t border-slate-100">
                  <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Showing Page {currentPage} of {totalPages}
                  </div>
                  <div className="flex gap-2">
                    <button 
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="w-10 h-10 bg-white border border-slate-100 rounded-xl flex items-center justify-center text-slate-400 hover:text-cyan-600 hover:border-cyan-100 disabled:opacity-30 disabled:hover:text-slate-400 transition-all shadow-sm"
                    >
                      <ChevronLeft size={18} />
                    </button>
                    <button 
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="w-10 h-10 bg-white border border-slate-100 rounded-xl flex items-center justify-center text-slate-400 hover:text-cyan-600 hover:border-cyan-100 disabled:opacity-30 disabled:hover:text-slate-400 transition-all shadow-sm"
                    >
                      <ChevronRight size={18} />
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="py-24 text-center glass-card rounded-xl border-dashed border-2 border-slate-100 bg-slate-50/50">
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="flex flex-col items-center gap-4 max-w-sm mx-auto"
              >
                <div className="w-20 h-20 bg-white rounded-full flex items-center justify-center text-slate-200 shadow-sm">
                  <AlertCircle size={40} />
                </div>
                <div>
                  <h4 className="text-sm font-bold text-slate-900 uppercase tracking-[0.2em]">No Records Found</h4>
                  <p className="text-xs text-slate-400 font-bold mt-2 leading-relaxed uppercase tracking-tight">
                    We couldn't find any cases matching "{searchTerm}". Try adjusting your filters.
                  </p>
                </div>
              </motion.div>
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
