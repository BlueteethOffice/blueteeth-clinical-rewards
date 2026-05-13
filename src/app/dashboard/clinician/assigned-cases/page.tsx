'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { Case } from '@/types';
import { 
  ClipboardList, 
  Clock, 
  Loader2,
  Stethoscope,
  ChevronRight,
  ShieldCheck,
  MapPin,
  Calendar,
  Phone
} from 'lucide-react';
import { format } from 'date-fns';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';

export default function AssignedCasesPage() {
  const { user } = useAuth();
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('all');
  
  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const casesPerPage = 5;

  useEffect(() => {
    if (!user?.uid) return;

    // ⚡ PERFORMANCE FIX: Added client-side slice to prevent rendering lag with large case history.
    const q = query(
      collection(db, 'cases'),
      where('clinicianId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const casesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Case[];
      
      casesData.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return dateB - dateA;
      });

      // Show max 50 recent cases to prevent browser lag
      setCases(casesData.slice(0, 50));
      setLoading(false);
    }, (error) => {
      console.error("Clinical sync error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const filteredCases = cases.filter(c => {
    const matchesSearch = 
      c.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
      c.mobile.includes(searchTerm) ||
      c.treatmentType.toLowerCase().includes(searchTerm.toLowerCase());
    
    if (filterStatus === 'all') return matchesSearch;
    if (filterStatus === 'self') return matchesSearch && c.selfAssigned;
    return matchesSearch && c.status === filterStatus;
  });

  // Pagination Logic
  const totalPages = Math.ceil(filteredCases.length / casesPerPage);
  const indexOfLastCase = currentPage * casesPerPage;
  const indexOfFirstCase = indexOfLastCase - casesPerPage;
  const currentCases = filteredCases.slice(indexOfFirstCase, indexOfLastCase);

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'approved': return { color: 'bg-emerald-500', text: 'Approved', bg: 'bg-emerald-50 text-emerald-600 border-emerald-100' };
      case 'completed': return { color: 'bg-indigo-500', text: 'Completed', bg: 'bg-indigo-50 text-indigo-600 border-indigo-100' };
      case 'assigned': return { color: 'bg-blue-500', text: 'Assigned', bg: 'bg-blue-50 text-blue-600 border-blue-100' };
      case 'pending': return { color: 'bg-amber-500', text: 'Pending', bg: 'bg-amber-50 text-amber-600 border-amber-100' };
      case 'rejected': return { color: 'bg-rose-500', text: 'Rejected', bg: 'bg-rose-50 text-rose-600 border-rose-100' };
      default: return { color: 'bg-slate-400', text: status, bg: 'bg-slate-50 text-slate-600 border-slate-100' };
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto pb-20 px-2 sm:px-0">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 md:gap-6 mb-8 sm:mb-10 lg:mb-12 mt-2 sm:mt-0">
          <div>
            <h1 className="text-2xl min-[400px]:text-3xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">Assigned Cases</h1>
            <p className="text-[9px] sm:text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] sm:tracking-[0.3em] mt-2 flex items-center gap-2">
              <ShieldCheck size={14} className="text-cyan-500" /> Clinical Registry
            </p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-2 overflow-x-auto pb-4 no-scrollbar mb-8 sm:mb-10">
          {['all', 'assigned', 'completed', 'approved', 'self'].map((s) => (
            <button 
              key={s}
              onClick={() => { setFilterStatus(s); setCurrentPage(1); }}
              className={`px-5 sm:px-6 py-3 sm:py-4 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest whitespace-nowrap border transition-all ${
                filterStatus === s 
                  ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-transparent shadow-xl' 
                  : 'bg-white dark:bg-slate-900 text-slate-400 border-slate-200 dark:border-white/5'
              }`}
            >
              {s === 'self' ? 'Self Assigned' : s}
            </button>
          ))}
        </div>

        {/* Case Grid */}
        <div className="grid grid-cols-1 gap-4 sm:gap-6">
          {loading ? (
            <div className="py-32 flex flex-col items-center justify-center text-slate-400">
              <Loader2 className="animate-spin mb-6 text-cyan-600" size={48} />
              <p className="font-black uppercase tracking-[0.3em] text-[10px]">Syncing Records...</p>
            </div>
          ) : currentCases.length > 0 ? (
            <AnimatePresence mode='popLayout'>
              {currentCases.map((c) => {
                const status = getStatusConfig(c.status);
                return (
                  <motion.div layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} key={c.id}>
                    <Link 
                      href={`/dashboard/clinician/assigned-cases/${c.id}`}
                      className="block bg-white dark:bg-slate-900/40 border border-slate-200 dark:border-white/5 rounded-xl transition-all duration-300 hover:border-cyan-500/50 group relative overflow-hidden active:scale-[0.98]"
                    >
                      <div className="p-5 sm:p-8 flex flex-col lg:flex-row gap-6 lg:gap-8 lg:items-center relative">
                        <div className={`absolute top-0 left-0 w-1 sm:w-1.5 h-full ${status.color}`} />
                        
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-2 sm:gap-3 mb-5 sm:mb-6">
                            <span className={`px-3 sm:px-4 py-1 sm:py-1.5 rounded text-[8px] sm:text-[9px] font-black uppercase tracking-widest border ${status.bg}`}>
                              {status.text}
                            </span>
                            {c.selfAssigned && (
                              <span className="px-3 sm:px-4 py-1 sm:py-1.5 rounded bg-purple-600 text-white text-[8px] sm:text-[9px] font-black uppercase tracking-widest shadow-lg shadow-purple-500/20">
                                Self
                              </span>
                            )}
                            <span className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest ml-auto">
                              ID: {c.id.slice(-8).toUpperCase()}
                            </span>
                          </div>

                          <div className="flex flex-col lg:flex-row lg:items-center gap-5 sm:gap-6 lg:gap-16">
                            <div>
                              <h3 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white tracking-tight uppercase group-hover:text-cyan-600 transition-colors">
                                {c.patientName}
                              </h3>
                              <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-2">
                                <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                  {c.gender} • {c.age} Y
                                </span>
                                <span className="text-[9px] sm:text-[10px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                  <Phone size={12} className="text-cyan-500" /> {c.mobile}
                                </span>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-8 lg:gap-12 flex-1 sm:border-l border-slate-100 dark:border-white/5 sm:pl-8">
                              <div>
                                <p className="text-[8px] sm:text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1 sm:mb-1.5 flex items-center gap-1.5">
                                  <Stethoscope size={12} className="text-cyan-500" /> Treatment
                                </p>
                                <p className="text-[11px] sm:text-xs font-black text-slate-700 dark:text-slate-300 uppercase truncate">{c.treatmentType}</p>
                              </div>
                              <div className="hidden sm:block">
                                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1.5 flex items-center gap-1.5">
                                  <MapPin size={12} className="text-cyan-500" /> Location
                                </p>
                                <p className="text-xs font-black text-slate-700 dark:text-slate-300 uppercase truncate">{c.clinicLocation}</p>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="lg:w-12 flex items-center justify-end lg:justify-center">
                          <div className="w-8 h-8 sm:w-10 sm:h-10 bg-slate-50 dark:bg-slate-800 rounded-lg flex items-center justify-center text-slate-300 group-hover:bg-cyan-500 group-hover:text-white active:scale-90 transition-all duration-300">
                            <ChevronRight size={18} />
                          </div>
                        </div>
                      </div>
                    </Link>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          ) : (
            <div className="py-24 sm:py-32 bg-white dark:bg-slate-900/20 border-2 border-dashed border-slate-100 dark:border-white/5 rounded-xl flex flex-col items-center justify-center text-center p-8 sm:p-10">
              <ClipboardList size={40} className="text-slate-200 mb-4" />
              <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white uppercase">No Assignments</h2>
              <p className="max-w-xs text-slate-400 mt-2 font-bold text-[9px] sm:text-[10px] uppercase tracking-widest">Your professional queue is currently empty.</p>
            </div>
          )}
        </div>

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="mt-12 flex items-center justify-center gap-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-lg text-[10px] font-black uppercase tracking-widest disabled:opacity-30"
            >
              Prev
            </button>
            <div className="flex gap-1">
              {[...Array(totalPages)].map((_, i) => (
                <button
                  key={i}
                  onClick={() => setCurrentPage(i + 1)}
                  className={`w-10 h-10 rounded-lg text-[10px] font-black transition-all ${
                    currentPage === i + 1 
                      ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-lg' 
                      : 'bg-white dark:bg-slate-900 text-slate-400 border border-slate-100 dark:border-white/5'
                  }`}
                >
                  {i + 1}
                </button>
              ))}
            </div>
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 rounded-lg text-[10px] font-black uppercase tracking-widest disabled:opacity-30"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </DashboardLayout>
  );
}
