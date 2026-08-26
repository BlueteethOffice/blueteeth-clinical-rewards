'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, addDoc, query, where, onSnapshot } from 'firebase/firestore';
import { Payout } from '@/types';
import { 
  Wallet, 
  ArrowUpRight, 
  History, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';

export default function ClinicianPayoutPage() {
  const { user } = useAuth();
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);

  const earnings = user?.totalEarnings || 0;

  useEffect(() => {
    if (!user?.uid) return;

    // 🚀 NO-INDEX QUERY: Removed 'orderBy' to prevent index errors
    const q = query(
      collection(db, 'clinicianPayouts'),
      where('clinicianId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Payout[];
      
      // 🔄 Client-Side Sorting
      data.sort((a, b) => {
        const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return timeB - timeA;
      });

      setPayouts(data);
      setLoading(false);
    }, (error) => {
      console.error("Payout Listener Error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleRequestPayout = async () => {
    if (earnings < 1000) {
      return toast.error('Minimum ₹1000 required to request payout');
    }

    setRequesting(true);
    try {
      await addDoc(collection(db, 'clinicianPayouts'), {
        clinicianId: user?.uid,
        clinicianName: user?.name,
        registrationNumber: user?.registrationNumber || '',
        amount: earnings,
        method: 'upi', // Default method
        details: { upiId: user?.phone + '@upi' }, // Placeholder or fetch from profile
        status: 'pending',
        createdAt: new Date(),
      });
      toast.success('Payout Request Sent');
    } catch (error) {
      toast.error('Request failed');
    } finally {
      setRequesting(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto">
        <div className="mb-10">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white tracking-tight uppercase">Earnings Vault</h1>
          <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] mt-1">Manage your professional consultation fees.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-10">
          <div className="lg:col-span-1 bg-slate-900 rounded-xl p-8 text-white shadow-2xl relative overflow-hidden group">
            <div className="absolute bottom-0 right-0 w-32 h-32 bg-cyan-500/20 rounded-full blur-3xl -mr-16 -mb-16" />
            
            <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center mb-6 border border-white/10 backdrop-blur-sm">
              <Wallet size={24} className="text-cyan-400" />
            </div>
            <p className="text-slate-500 font-bold text-[10px] uppercase tracking-wider">Available Earnings</p>
            <h2 className="text-5xl font-bold mb-6 tracking-tight">₹{earnings}</h2>
            
            <div className="flex items-center gap-2 mb-8 text-[9px] font-bold uppercase tracking-wider bg-white/5 w-fit px-3 py-2 rounded-lg border border-white/5">
              <AlertCircle size={14} className="text-amber-500" /> Min: ₹1000
            </div>

            <button 
              onClick={handleRequestPayout}
              disabled={requesting || earnings < 1000}
              className="w-full py-4 bg-cyan-600 text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-xl shadow-cyan-900/20 hover:bg-cyan-500 active:scale-95 transition-all disabled:opacity-50"
            >
              {requesting ? <Loader2 className="animate-spin mx-auto" size={18} /> : 'Request Withdrawal'}
            </button>
          </div>

          <div className="lg:col-span-2 glass-card rounded-xl p-8 border border-slate-100 dark:border-white/5 bg-white dark:bg-slate-900/40">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-[10px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-[0.2em] flex items-center gap-3">
                <History className="text-cyan-500" size={16} /> Withdrawal Statement
              </h3>
              <div className="px-3 py-1 bg-slate-50 dark:bg-slate-800 rounded-lg text-[9px] font-bold text-slate-400 uppercase">
                {payouts.length} Records
              </div>
            </div>

            <div className="overflow-x-auto custom-scrollbar -mx-6 sm:mx-0 px-6 sm:px-0">
              {loading ? (
                <div className="py-20 flex flex-col items-center gap-4">
                  <Loader2 className="animate-spin text-cyan-600" size={32} />
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Syncing History...</p>
                </div>
              ) : payouts.length > 0 ? (
                <table className="w-full text-left whitespace-nowrap min-w-[500px]">
                  <thead>
                    <tr className="border-b border-slate-50 dark:border-white/5">
                      <th className="pb-4 text-[9px] font-bold text-slate-400 uppercase tracking-wider">Amount</th>
                      <th className="pb-4 text-[9px] font-bold text-slate-400 uppercase tracking-wider">Date</th>
                      <th className="pb-4 text-[9px] font-bold text-slate-400 uppercase tracking-wider text-right">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                    {payouts.map((p) => (
                      <tr key={p.id} className="group transition-colors">
                        <td className="py-5 font-bold text-slate-900 dark:text-white">₹{p.amount}</td>
                        <td className="py-5 text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-tight">
                          {p.createdAt?.toDate ? format(p.createdAt.toDate(), 'dd MMM, yyyy') : 'Recently'}
                        </td>
                        <td className="py-5 text-right">
                          <span className={`px-2.5 py-1 rounded text-[9px] font-bold uppercase tracking-wider inline-flex items-center gap-1.5 ${
                            p.status === 'pending' ? 'bg-amber-500 text-white shadow-sm' :
                            p.status === 'approved' ? 'bg-blue-500 text-white shadow-sm' :
                            'bg-emerald-500 text-white shadow-sm'
                          }`}>
                            {p.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="py-20 text-center flex flex-col items-center gap-4">
                  <div className="w-16 h-16 bg-slate-50 dark:bg-slate-800 rounded-full flex items-center justify-center text-slate-200">
                    <History size={32} />
                  </div>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">No activity history found</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
