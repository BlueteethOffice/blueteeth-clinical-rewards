'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, addDoc, query, where, onSnapshot, orderBy } from 'firebase/firestore';
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

export default function AssociatePayoutPage() {
  const { user } = useAuth();
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);
  const [requesting, setRequesting] = useState(false);

  const earnings = (user?.totalPoints || 0) * 50;

  useEffect(() => {
    if (!user?.uid) return;

    const q = query(
      collection(db, 'payouts'),
      where('userId', '==', user.uid)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Payout[];
      
      const sortedData = data.sort((a, b) => {
        const dateA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const dateB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return dateB - dateA;
      });

      setPayouts(sortedData);
      setLoading(false);
    }, (error) => {
      console.error("Firestore Error:", error);
      toast.error('Failed to load payouts');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [user]);

  const handleRequestPayout = async () => {
    if (earnings < 500) {
      return toast.error('Minimum ₹500 required to request payout');
    }

    setRequesting(true);
    try {
      await addDoc(collection(db, 'payouts'), {
        userId: user?.uid,
        userName: user?.name,
        amount: earnings,
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
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-slate-900">Payouts & Earnings</h1>
        <p className="text-slate-500">Withdraw your B-Points as real cash</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
        <div className="lg:col-span-1 premium-gradient rounded-3xl p-8 text-white shadow-xl shadow-cyan-500/20 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16" />
          
          <Wallet size={32} className="mb-4 text-cyan-100" />
          <p className="text-cyan-100 font-medium text-sm">Withdrawable Balance</p>
          <h2 className="text-5xl font-black mb-6">₹{earnings}</h2>
          
          <div className="flex items-center gap-2 mb-8 text-xs font-bold bg-black/10 w-fit px-3 py-1.5 rounded-lg border border-white/10">
            <AlertCircle size={14} /> Min. Withdrawal: ₹500
          </div>

          <button 
            onClick={handleRequestPayout}
            disabled={requesting || earnings < 500}
            className="w-full py-4 bg-white text-cyan-600 rounded-2xl font-bold flex items-center justify-center gap-2 hover:bg-cyan-50 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100"
          >
            {requesting ? <Loader2 className="animate-spin" size={20} /> : <><ArrowUpRight size={20} /> Withdraw Now</>}
          </button>
        </div>

        <div className="lg:col-span-2 glass-card rounded-3xl p-8">
          <div className="flex items-center gap-2 mb-6">
            <History className="text-cyan-500" size={20} />
            <h3 className="text-xl font-bold text-slate-900">Transaction History</h3>
          </div>

          <div className="overflow-x-auto custom-scrollbar -mx-8 sm:mx-0 px-8 sm:px-0">
            {loading ? (
              <div className="py-10 flex justify-center"><Loader2 className="animate-spin text-slate-300" /></div>
            ) : payouts.length > 0 ? (
              <table className="w-full text-left whitespace-nowrap min-w-[500px]">
                <thead>
                  <tr className="border-b border-slate-100">
                    <th className="px-2 sm:px-4 pb-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Amount</th>
                    <th className="px-2 sm:px-4 pb-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Date</th>
                    <th className="px-2 sm:px-4 pb-4 text-xs font-bold text-slate-400 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {payouts.map((p) => (
                    <tr key={p.id}>
                      <td className="px-2 sm:px-4 py-4 font-bold text-slate-900">₹{p.amount}</td>
                      <td className="px-2 sm:px-4 py-4 text-sm text-slate-500 font-medium">
                        {p.createdAt?.toDate ? format(p.createdAt.toDate(), 'dd MMM, yyyy') : 'Recently'}
                      </td>
                      <td className="px-2 sm:px-4 py-4">
                        <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase inline-flex items-center gap-1 ${
                          p.status === 'pending' ? 'bg-amber-50 text-amber-600' :
                          p.status === 'approved' ? 'bg-blue-50 text-blue-600' :
                          'bg-emerald-50 text-emerald-600'
                        }`}>
                          {p.status === 'pending' ? <Clock size={12} /> : <CheckCircle2 size={12} />}
                          {p.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <div className="py-10 text-center text-slate-400">
                <p className="text-sm font-medium">No payout requests found</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
