'use client';

import { useEffect, useState, useMemo } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import StatCard from '@/components/dashboard/StatCard';
import { 
  Clock, 
  CheckCircle2, 
  Wallet, 
  Plus,
  ArrowRight,
  Stethoscope,
  Loader2,
  Activity
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import Link from 'next/link';
import { db } from '@/lib/firebase';
import { collection, query, where, onSnapshot, limit } from 'firebase/firestore';
import { Case } from '@/types';
import { format } from 'date-fns';

export default function ClinicianDashboard() {
  const { user } = useAuth();
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user?.uid) return;

    // ⚡ PERFORMANCE: Limit to 30 cases for the overview dashboard
    const q = query(
      collection(db, 'cases'),
      where('clinicianId', '==', user.uid),
      limit(30)
    );

    const unsubscribe = onSnapshot(q, { includeMetadataChanges: false }, (snapshot) => {
      const casesData = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Case[];
      
      setCases(casesData);
      setLoading(false);
    }, (error) => {
      if (error.code === 'permission-denied') {
        console.log("[CLINICIAN] Dashboard listener detached (Auth required)");
      } else {
        console.error("Clinician Dashboard Fetch Error:", error);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user?.uid]);

  // ✅ Memoized Stats - Prevents heavy re-calculations on every render
  const stats = useMemo(() => {
    const safeCases = Array.isArray(cases) ? cases : [];
    return {
      assigned: safeCases.filter(c => c.status === 'assigned').length,
      pending: safeCases.filter(c => c.status === 'pending' || c.status === 'in_progress').length,
      completed: safeCases.filter(c => c.status === 'completed' || c.status === 'approved').length,
      earnings: user?.totalEarnings || 0
    };
  }, [cases, user?.totalEarnings]);

  // ✅ Memoized Recent Cases - Smoother sorting and slicing
  const recentCases = useMemo(() => {
    return [...cases].sort((a, b) => {
      const timeA = a.createdAt?.seconds || 0;
      const timeB = b.createdAt?.seconds || 0;
      return timeB - timeA;
    }).slice(0, 5);
  }, [cases]);

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto pb-10 mt-4 sm:mt-12 px-2 sm:px-6 lg:px-0">
        {/* Header Section */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-10 sm:mb-16">
          <div className="space-y-1 sm:space-y-2">
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight uppercase leading-none whitespace-nowrap">
              Clinician <span className="text-cyan-600">Dashboard</span>
            </h1>
            <div className="flex items-center gap-3">
              <div className="w-2 h-2 sm:w-2.5 sm:h-2.5 bg-emerald-500 rounded-full animate-pulse shadow-sm shadow-emerald-200" />
              <p className="text-[9px] sm:text-xs font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] sm:tracking-[0.3em]">
                Session: {user?.displayName || user?.name} • Practitioner
              </p>
            </div>
          </div>
          <Link href="/dashboard/clinician/submit-case" className="w-full sm:w-auto">
            <button className="w-full sm:w-auto justify-center bg-slate-900 dark:bg-white text-white dark:text-slate-900 px-6 sm:px-8 py-3.5 sm:py-4 rounded-xl font-bold text-[10px] sm:text-xs uppercase tracking-[0.2em] shadow-xl shadow-slate-200 dark:shadow-none flex items-center gap-3 hover:scale-[1.02] active:scale-95 transition-all">
              <Plus size={16} strokeWidth={3} />
              Submit Own Case
            </button>
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 md:gap-8 mb-10 sm:mb-12">
          <StatCard 
            title="Assigned" 
            value={loading ? '...' : stats.assigned.toString()} 
            icon={Stethoscope} 
            color="bg-blue-600"
          />
          <StatCard 
            title="Pending" 
            value={loading ? '...' : stats.pending.toString()} 
            icon={Clock} 
            color="bg-amber-500"
          />
          <StatCard 
            title="Completed" 
            value={loading ? '...' : stats.completed.toString()} 
            icon={CheckCircle2} 
            color="bg-emerald-500"
          />
          <StatCard 
            title="Earnings" 
            value={`₹${stats.earnings}`} 
            icon={Wallet} 
            color="bg-cyan-600"
          />
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 sm:gap-8 items-start">
          {/* Assignments Table */}
          <div className="xl:col-span-8 glass-card rounded-2xl sm:rounded-3xl p-5 sm:p-10 bg-white border border-slate-100 shadow-sm overflow-hidden">
            <div className="flex items-center justify-between mb-8 px-1">
              <h2 className="text-[10px] sm:text-xs font-bold text-slate-900 dark:text-white uppercase tracking-[0.2em] flex items-center gap-2">
                <Activity size={18} className="text-cyan-600" /> Recent Assignments
              </h2>
              <Link href="/dashboard/clinician/assigned-cases" className="text-cyan-600 font-bold text-[9px] sm:text-[10px] uppercase tracking-wider flex items-center gap-1 hover:underline">
                View All <ArrowRight size={14} />
              </Link>
            </div>
            
            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto custom-scrollbar -mx-5 px-5">
              <table className="w-full text-left whitespace-nowrap min-w-[500px]">
                <thead>
                  <tr className="border-b border-slate-100 dark:border-white/5">
                    <th className="pb-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Patient</th>
                    <th className="pb-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Treatment</th>
                    <th className="pb-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                    <th className="pb-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                  {loading ? (
                    <tr>
                      <td colSpan={4} className="py-12 text-center">
                        <Loader2 className="animate-spin mx-auto text-slate-200" size={32} />
                      </td>
                    </tr>
                  ) : recentCases.length > 0 ? (
                    recentCases.map((c) => (
                      <tr key={c.id} className="group hover:bg-slate-50/50 dark:hover:bg-white/5 transition-all">
                        <td className="py-5 font-bold text-slate-900 dark:text-white text-sm tracking-tight uppercase">
                          <div className="truncate max-w-[150px]">{c.patientName}</div>
                        </td>
                        <td className="py-5 text-[11px] font-bold text-slate-500 uppercase tracking-tight">{c.treatmentType}</td>
                        <td className="py-5">
                          <span className={`px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-wider border ${
                            c.status === 'completed' || c.status === 'approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                            c.status === 'assigned' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                            'bg-amber-50 text-amber-600 border-amber-100'
                          }`}>
                            {c.status}
                          </span>
                        </td>
                        <td className="py-5 text-right">
                          <Link href={`/dashboard/clinician/assigned-cases/${c.id}`}>
                            <button className="px-4 py-2 bg-slate-50 dark:bg-white/5 text-slate-600 dark:text-slate-400 rounded-lg text-[10px] font-bold uppercase tracking-wider hover:bg-cyan-600 hover:text-white transition-all">Manage</button>
                          </Link>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={4} className="py-20 text-center">
                        <div className="flex flex-col items-center gap-3">
                          <div className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center text-slate-200">
                            <Stethoscope size={28} />
                          </div>
                          <p className="text-[9px] font-bold text-slate-300 uppercase tracking-wider">No cases assigned yet</p>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile Card View */}
            <div className="sm:hidden space-y-4">
              {loading ? (
                <div className="py-12 text-center">
                  <Loader2 className="animate-spin mx-auto text-slate-200" size={32} />
                </div>
              ) : recentCases.length > 0 ? (
                recentCases.map((c) => (
                  <div key={c.id} className="p-4 bg-slate-50/50 dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-2xl space-y-4">
                    <div className="flex justify-between items-start">
                      <div>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Patient</p>
                        <h4 className="font-bold text-slate-900 dark:text-white text-sm uppercase">{c.patientName}</h4>
                      </div>
                      <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider border ${
                        c.status === 'completed' || c.status === 'approved' ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                        c.status === 'assigned' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                        'bg-amber-50 text-amber-600 border-amber-100'
                      }`}>
                        {c.status}
                      </span>
                    </div>
                    <div>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Treatment</p>
                      <p className="text-[11px] font-bold text-slate-500 uppercase">{c.treatmentType}</p>
                    </div>
                    <Link href={`/dashboard/clinician/assigned-cases/${c.id}`} className="block">
                      <button className="w-full py-3 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/5 text-slate-900 dark:text-white rounded-xl text-[10px] font-bold uppercase tracking-wider shadow-sm">
                        Manage Case
                      </button>
                    </Link>
                  </div>
                ))
              ) : (
                <div className="py-20 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <div className="w-14 h-14 bg-slate-50 rounded-full flex items-center justify-center text-slate-200">
                      <Stethoscope size={28} />
                    </div>
                    <p className="text-[9px] font-bold text-slate-300 uppercase tracking-wider">No cases assigned yet</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Payout Card */}
          <div className="xl:col-span-4 glass-card rounded-2xl sm:rounded-3xl p-6 sm:p-8 bg-slate-900 text-white flex flex-col justify-between shadow-2xl relative overflow-hidden h-full min-h-[350px] sm:min-h-[400px]">
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-3xl -mr-16 -mt-16" />
            <div className="relative z-10">
              <h3 className="text-[10px] font-bold text-cyan-500 uppercase tracking-[0.2em] mb-8">Payout Intel</h3>
              <div className="space-y-6">
                <div className="p-5 sm:p-6 bg-white/5 border border-white/5 rounded-2xl backdrop-blur-md">
                  <p className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Accumulated Balance</p>
                  <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold tracking-tight">₹{stats.earnings}</span>
                    <span className="text-[9px] font-bold text-emerald-500 uppercase tracking-wider">Unlocked</span>
                  </div>
                  <div className="mt-4 pt-4 border-t border-white/5 flex items-center justify-between">
                    <span className="text-[8px] sm:text-[9px] font-bold text-slate-500 uppercase tracking-wider">Status</span>
                    <span className="px-2 py-0.5 bg-amber-500/20 text-amber-500 text-[8px] font-bold rounded uppercase tracking-wider">Awaiting Payout</span>
                  </div>
                </div>
              </div>
            </div>
            
            <button className="w-full py-4 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-bold text-[10px] sm:text-xs uppercase tracking-[0.2em] transition-all mt-8 sm:mt-10 shadow-lg shadow-cyan-900/20">
              Request Payout
            </button>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
