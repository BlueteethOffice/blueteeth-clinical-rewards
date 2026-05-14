'use client';

import { useEffect, useState, useMemo } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import StatCard from '@/components/dashboard/StatCard';
import { 
  ClipboardList, 
  Clock, 
  CheckCircle2, 
  Coins, 
  Plus,
  ArrowRight,
  Loader2,
  TrendingUp,
  Activity,
  User,
  ArrowUpRight,
  FileText,
  ChevronLeft,
  ChevronRight,
  Wallet,
  IndianRupee,
  ArrowDownCircle
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot } from 'firebase/firestore';
import { Case, POINT_VALUE, Payout } from '@/types';
import { format } from 'date-fns';
import { motion } from 'framer-motion';

export default function AssociateDashboard() {
  const { user } = useAuth();
  const [cases, setCases] = useState<Case[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);

  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 5;

  const [hasMore, setHasMore] = useState(false);
  const [lastId, setLastId] = useState<string | null>(null);

  const fetchCases = async (isNext = false) => {
    if (!user?.uid) return;
    setLoading(true);
    try {
      const url = `/api/cases?userId=${user.uid}&role=associate&limit=${itemsPerPage}${isNext && lastId ? `&lastId=${lastId}` : ''}`;
      const res = await fetch(url);
      const data = await res.json();
      
      if (!res.ok) {
        console.error("API Error:", data.error);
        return;
      }

      const newCases = Array.isArray(data.cases) ? data.cases : [];
      
      if (isNext) {
        setCases(prev => [...(Array.isArray(prev) ? prev : []), ...newCases]);
      } else {
        setCases(newCases);
      }
      
      setLastId(data.lastId);
      setHasMore(data.hasMore);
    } catch (error) {
      console.error("Fetch cases error:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCases();
    
    // Still keep payout listener as it's usually smaller
    if (!user?.uid) return;
    const qPayouts = query(
      collection(db, 'payouts'),
      where('associateId', '==', user.uid)
    );

    const unsubPayouts = onSnapshot(qPayouts, (snapshot) => {
      const payoutsData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Payout[];
      setPayouts(payoutsData);
    }, (err) => {
      if (err.code === 'permission-denied') {
        console.log("[ASSOCIATE] Payouts listener detached (Auth required)");
      } else {
        console.error("Payouts stream error:", err);
      }
    });

    return () => unsubPayouts();
  }, [user]);

  const stats = useMemo(() => {
    const safeCases = Array.isArray(cases) ? cases : [];
    const safePayouts = Array.isArray(payouts) ? payouts : [];

    const approved = safeCases.filter(c => c.status === 'approved');
    const pending = safeCases.filter(c => c.status === 'pending');
    const inProgress = safeCases.filter(c => c.status === 'assigned' || c.status === 'in_progress');
    
    const grossEarnings = (approved.reduce((sum, c) => sum + (c.points || 0), 0) * POINT_VALUE) || 0;
    const totalWithdrawn = (safePayouts
      .filter(p => p.status === 'completed' || p.status === 'approved' || p.status === 'processing')
      .reduce((sum, p) => sum + (p.amount || 0), 0)) || 0;

    const withdrawableAmount = Math.max(0, grossEarnings - totalWithdrawn);

    return {
      total: safeCases.length || 0,
      pending: pending.length || 0,
      approved: approved.length || 0,
      active: inProgress.length || 0,
      grossEarnings,
      totalWithdrawn,
      withdrawableAmount,
      pendingPoints: pending.reduce((sum, c) => sum + (c.points || 0), 0) || 0
    };
  }, [cases, payouts]);

  const { paginatedCases } = useMemo(() => {
    return { paginatedCases: cases };
  }, [cases]);

  // Removed full-screen loading block to allow instant layout shell rendering

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 sm:gap-6 mb-8 sm:mb-10">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight uppercase">Associate Hub</h1>
            <div className="text-slate-500 dark:text-slate-400 font-bold mt-1 uppercase text-[9px] sm:text-[10px] tracking-wider flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              Live performance monitoring for {user?.name}
            </div>
          </div>
          <Link href="/dashboard/associate/submit-case">
            <button className="bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 sm:px-8 py-3 sm:py-4 rounded-lg sm:rounded-xl font-bold text-[10px] sm:text-xs uppercase tracking-[0.16em] shadow-xl shadow-slate-200 dark:shadow-none flex items-center justify-center gap-2 sm:gap-3 hover:scale-[1.02] active:scale-95 transition-all w-full sm:w-auto min-w-40">
              <Plus size={16} strokeWidth={3} />
              Submit Case
            </button>
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 md:gap-6 mb-10">
          <StatCard title="Submissions" value={loading ? '...' : stats.total.toString()} icon={ClipboardList} color="bg-blue-600" />
          <StatCard title="Reviewing" value={loading ? '...' : stats.pending.toString()} icon={Clock} color="bg-amber-500" />
          <StatCard title="Active" value={loading ? '...' : stats.active.toString()} icon={Activity} color="bg-indigo-600" />
          <StatCard title="Approved" value={loading ? '...' : stats.approved.toString()} icon={CheckCircle2} color="bg-emerald-500" />
        </div>

        <div className="mb-6 flex items-center gap-4">
          <p className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider whitespace-nowrap">Finance Engine</p>
          <div className="h-px bg-slate-100 dark:bg-white/5 w-full" />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 md:gap-6 mb-12">
          <StatCard title="Earnings" value={loading ? '...' : `₹${(stats.grossEarnings || 0).toLocaleString()}`} icon={TrendingUp} color="bg-cyan-600" />
          <StatCard title="Payout" value={loading ? '...' : `₹${(stats.withdrawableAmount || 0).toLocaleString()}`} icon={Wallet} color="bg-emerald-600" />
          <StatCard title="Paid Out" value={loading ? '...' : `₹${(stats.totalWithdrawn || 0).toLocaleString()}`} icon={ArrowDownCircle} color="bg-slate-900" />
          <StatCard title="Points" value={loading ? '...' : `${stats.pendingPoints || 0} PTS`} icon={Coins} color="bg-amber-600" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-slate-900 dark:bg-slate-800 text-white rounded-xl flex items-center justify-center shadow-lg shrink-0">
                  <Activity size={20} />
                </div>
                <div className="min-w-0">
                  <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white uppercase tracking-tight whitespace-nowrap">Recent Cases</h3>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider whitespace-nowrap">Real-time update</p>
                </div>
              </div>
              <Link href="/dashboard/associate/my-cases" className="group flex items-center gap-2 text-cyan-600 font-bold text-[10px] uppercase tracking-wider hover:text-cyan-700 transition-all sm:ml-auto">
                View Archives <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            <div className="space-y-4">
              {loading && paginatedCases.length === 0 ? (
                <div className="py-20 text-center">
                  <Loader2 className="animate-spin mx-auto text-slate-200" size={32} />
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-4">Syncing Cases...</p>
                </div>
              ) : paginatedCases.length > 0 ? (
                <>
                  {paginatedCases.map((c, index) => (
                    <motion.div key={c.id} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * 0.05, 0.3) }}>
                      <Link href={`/dashboard/associate/my-cases/${c.id}`} className="block transition-transform active:scale-[0.98]">
                        <div className="glass-card p-5 rounded-xl border border-slate-100 dark:border-white/5 hover:border-cyan-500/50 transition-all duration-300 group relative overflow-hidden bg-white dark:bg-slate-900/40 cursor-pointer">
                          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                            <div className="flex items-center gap-4">
                              <div className="w-12 h-12 bg-slate-50 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 group-hover:text-cyan-500 group-hover:scale-110 transition-all duration-500 shrink-0">
                                <User size={24} />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-base font-bold text-slate-900 dark:text-white uppercase tracking-tight group-hover:text-cyan-600 transition-colors">{c.patientName}</span>
                                  <span className="text-[9px] font-bold text-slate-400 bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded">#{c.id.slice(-6).toUpperCase()}</span>
                                </div>
                                <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 mt-1 flex items-center gap-2">
                                  <FileText size={12} className="text-cyan-500" /> {c.treatmentType}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-6">
                              <div className="text-right hidden sm:block">
                                <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Reward Value</p>
                                <p className="text-sm font-bold text-slate-900 dark:text-white mt-0.5">₹{(c.points || 0) * 50}</p>
                              </div>
                              <div className="text-right min-w-[100px]">
                                <span className={`px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider mb-1 inline-block ${
                                  c.status === 'approved' ? 'bg-emerald-500 text-white' :
                                  c.status === 'pending' ? 'bg-amber-500 text-white' :
                                  'bg-cyan-500 text-white'
                                }`}>
                                  {c.status}
                                </span>
                                <p className="text-[9px] font-bold text-slate-400 block">{c.createdAt?.toDate ? format(c.createdAt.toDate(), 'dd MMM, HH:mm') : 'Just now'}</p>
                              </div>
                              <div className="p-2.5 bg-slate-50 dark:bg-slate-800 text-slate-300 rounded-lg group-hover:bg-cyan-600 group-hover:text-white group-hover:rotate-45 active:scale-90 transition-all duration-300 shadow-sm">
                                <ArrowUpRight size={18} strokeWidth={3} />
                              </div>
                            </div>
                          </div>
                        </div>
                      </Link>
                    </motion.div>
                  ))}

                  {hasMore && (
                    <div className="flex items-center justify-center pt-6">
                      <button 
                        onClick={() => fetchCases(true)} 
                        disabled={loading}
                        className="px-8 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-[10px] font-bold uppercase tracking-wider hover:scale-[1.02] active:scale-95 transition-all shadow-lg flex items-center gap-2"
                      >
                        {loading ? <Loader2 className="animate-spin" size={14} /> : 'Load More Cases'}
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="glass-card p-16 rounded-2xl border-dashed border-2 border-slate-200 dark:border-slate-800 text-center flex flex-col items-center gap-4 bg-slate-50/50 dark:bg-white/5">
                  <ClipboardList size={40} className="text-slate-200" />
                  <h4 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-wider">Log is Empty</h4>
                  <p className="text-[10px] text-slate-400 font-bold max-w-xs mx-auto leading-relaxed uppercase">Start recording cases to see your live activity feed here.</p>
                </div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="glass-card rounded-2xl p-6 sm:p-8 bg-slate-900 text-white relative overflow-hidden shadow-2xl min-h-[300px] sm:min-h-[320px] flex flex-col justify-between border-none">
              <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/20 rounded-full blur-3xl -mr-16 -mt-16" />
              <div>
                <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center mb-6 border border-white/10 backdrop-blur-sm">
                  <IndianRupee size={24} className="text-cyan-400" />
                </div>
                <p className="text-slate-500 text-[10px] font-bold uppercase tracking-[0.2em]">Withdrawable Balance</p>
                <h2 className="text-4xl font-bold tracking-tight mt-1">₹{(stats.withdrawableAmount || 0).toLocaleString()}</h2>
              </div>
              <Link href="/dashboard/associate/earnings" className="block w-full">
                <button className="w-full py-4 bg-cyan-600 text-white rounded-xl font-bold text-xs uppercase tracking-[0.2em] hover:bg-cyan-700 transition-all flex items-center justify-center gap-2">
                  Request Payout <ArrowRight size={14} />
                </button>
              </Link>
            </div>

            <div className="glass-card p-6 min-h-44 rounded-2xl border border-slate-100 dark:border-white/5 flex items-center justify-end gap-4 text-right">
              <div className="w-10 h-10 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
                <TrendingUp size={20} />
              </div>
              <div className="max-w-60">
                <h4 className="text-[10px] font-bold text-slate-900 dark:text-white uppercase tracking-wider">Earning Tip</h4>
                <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold mt-1 leading-snug uppercase">High-value cases like Aligners earn 3x points instantly.</p>
                <div className="mt-4 inline-flex items-center justify-center rounded-lg bg-indigo-50 dark:bg-indigo-500/10 px-3 py-2 text-[9px] font-bold uppercase tracking-wider text-indigo-600 dark:text-indigo-300">
                  Bonus: Faster approvals unlock quick payout
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
