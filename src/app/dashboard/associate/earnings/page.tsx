'use client';

import { useState, useEffect, useMemo } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot, 
  serverTimestamp,
  doc,
  getDoc,
  getDocs
} from 'firebase/firestore';
import { Payout, Case, POINT_VALUE } from '@/types';
import { 
  Wallet, 
  ArrowUpRight, 
  History, 
  CheckCircle2, 
  Clock, 
  Loader2,
  Coins,
  IndianRupee,
  ShieldCheck,
  CreditCard,
  QrCode,
  Info,
  X
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { sendSystemNotification } from '@/lib/notifications';

export default function AssociateEarningsPage() {
  const { user } = useAuth();
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [showWithdrawModal, setShowWithdrawModal] = useState(false);
  const [requesting, setRequesting] = useState(false);
  const [pointValue, setPointValue] = useState(POINT_VALUE);

  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'bank'>('upi');
  const [upiId, setUpiId] = useState('');
  const [bankDetails, setBankDetails] = useState({
    holderName: '',
    accountNumber: '',
    ifsc: ''
  });

  useEffect(() => {
    if (!user?.uid) return;

    const fetchConfig = async () => {
      try {
        const configDoc = await getDoc(doc(db, 'config', 'points'));
        if (configDoc.exists()) setPointValue(configDoc.data().value || POINT_VALUE);
      } catch (e) { console.log("Config not found"); }
    };
    fetchConfig();

    const payoutsQuery = query(collection(db, 'payouts'), where('userId', '==', user.uid));
    const unsubPayouts = onSnapshot(payoutsQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Payout[];
      setPayouts(data.sort((a, b) => {
        const dateA = a.createdAt?.toDate?.() || 0;
        const dateB = b.createdAt?.toDate?.() || 0;
        return dateB - dateA;
      }));
    });

    const casesQuery = query(collection(db, 'cases'), where('associateId', '==', user.uid));
    const unsubCases = onSnapshot(casesQuery, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Case[];
      setCases(data);
      setLoading(false);
    });

    return () => {
      unsubPayouts();
      unsubCases();
    };
  }, [user]);

  const stats = useMemo(() => {
    const approvedCases = cases.filter(c => c.status === 'approved');
    const pendingCases = cases.filter(c => c.status !== 'approved' && c.status !== 'rejected');
    const totalApprovedPoints = approvedCases.reduce((sum, c) => sum + (c.points || 0), 0);
    const totalPendingPoints = pendingCases.reduce((sum, c) => sum + (c.points || 0), 0);
    const totalGrossEarnings = totalApprovedPoints * pointValue;
    const alreadyWithdrawn = payouts.filter(p => p.status === 'completed' || p.status === 'approved').reduce((sum, p) => sum + p.amount, 0);
    const pendingWithdrawal = payouts.filter(p => p.status === 'pending' || p.status === 'processing').reduce((sum, p) => sum + p.amount, 0);
    const withdrawableAmount = totalGrossEarnings - alreadyWithdrawn - pendingWithdrawal;

    return {
      approvedPoints: totalApprovedPoints,
      pendingPoints: totalPendingPoints,
      grossEarnings: totalGrossEarnings,
      withdrawableAmount: Math.max(0, withdrawableAmount),
      totalWithdrawn: alreadyWithdrawn,
      pendingPayouts: pendingWithdrawal
    };
  }, [cases, payouts, pointValue]);

  const handleWithdraw = async (e: React.FormEvent) => {
    e.preventDefault();
    const amount = Number(withdrawAmount);
    if (amount < 500) return toast.error('Minimum ₹500');
    if (amount > stats.withdrawableAmount) return toast.error('Insufficient balance');

    setRequesting(true);
    try {
      await addDoc(collection(db, 'payouts'), {
        userId: user?.uid,
        userName: user?.name,
        amount,
        status: 'pending',
        paymentMethod,
        upiId: paymentMethod === 'upi' ? upiId : null,
        bankDetails: paymentMethod === 'bank' ? bankDetails : null,
        createdAt: serverTimestamp(),
      });
      
      const adminQuery = query(collection(db, 'users'), where('role', '==', 'admin'));
      const adminSnapshot = await getDocs(adminQuery);
      adminSnapshot.docs.forEach(async (adminDoc) => {
        await sendSystemNotification(adminDoc.id, {
          title: 'New Payout Request',
          message: `${user?.name} requested ₹${amount.toLocaleString()}.`,
          type: 'warning',
          link: '/dashboard/admin/payouts'
        });
      });

      toast.success('Request Submitted');
      setShowWithdrawModal(false);
      setWithdrawAmount('');
    } catch (error) {
      toast.error('Failed to submit');
    } finally {
      setRequesting(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
          <Loader2 className="w-10 h-10 text-cyan-600 animate-spin" />
          <p className="text-slate-400 font-bold text-[10px] uppercase tracking-wider">Loading Wallet...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <div className="max-w-6xl mx-auto pb-10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8 sm:mb-10 px-4 lg:px-0">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-slate-900 dark:text-white tracking-tight uppercase">Earnings Log</h1>
            <p className="text-slate-500 dark:text-slate-400 font-bold text-[9px] sm:text-[10px] mt-1 flex items-center gap-2 uppercase tracking-[0.2em]">
              <ShieldCheck size={14} className="text-emerald-500" /> Secure Financial Sync Active
            </p>
          </div>
          <div className="inline-flex flex-col sm:items-end px-5 py-3 bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-white/5 rounded-xl self-start sm:self-auto">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Standard Rate</p>
            <p className="text-sm sm:text-base font-bold text-slate-900 dark:text-white tracking-tight">₹{pointValue} <span className="text-[10px] text-slate-400">/ PT</span></p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6 mb-8 sm:mb-10">
          <div className="glass-card p-6 sm:p-8 rounded-xl border border-slate-100 dark:border-white/5 relative overflow-hidden group bg-white dark:bg-slate-900/40">
            <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-50/50 dark:bg-cyan-500/10 rounded-full blur-2xl -mr-16 -mt-16" />
            <div className="relative z-10">
              <div className="w-10 h-10 sm:w-12 sm:h-12 bg-cyan-600 text-white rounded-xl flex items-center justify-center shadow-lg mb-4 sm:mb-6"><Coins size={20} className="sm:w-6 sm:h-6" /></div>
              <p className="text-slate-400 dark:text-slate-500 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">Total Approved Points</p>
              <h3 className="text-3xl sm:text-4xl font-bold text-slate-900 dark:text-white mt-1 tracking-tight">{stats.approvedPoints} <span className="text-[10px] sm:text-xs text-slate-400 tracking-wider uppercase">Points</span></h3>
              <div className="mt-3 sm:mt-4 flex items-center gap-3">
                <span className="flex items-center gap-1 text-[8px] sm:text-[9px] font-bold text-amber-500 bg-amber-50 dark:bg-amber-500/10 px-2 sm:px-2.5 py-1 rounded-lg uppercase tracking-wider"><Clock size={10} /> {stats.pendingPoints} Pending</span>
              </div>
            </div>
          </div>

          <div className="md:col-span-2 relative overflow-hidden rounded-xl p-6 sm:p-8 shadow-xl shadow-slate-200 dark:shadow-none group bg-slate-900 border-none">
            <div className="absolute top-0 right-0 w-96 h-96 bg-white/5 rounded-full blur-3xl -mr-48 -mt-48" />
            <div className="relative z-10 h-full flex flex-col sm:flex-row sm:items-center justify-between gap-6 sm:gap-8">
              <div>
                <p className="text-cyan-400 font-bold text-[9px] sm:text-[10px] uppercase tracking-[0.3em] mb-3 sm:mb-4">Available for Payout</p>
                <h2 className="text-4xl sm:text-5xl md:text-6xl font-bold text-white tracking-tight flex items-center gap-2">
                  <IndianRupee size={32} className="text-cyan-500 sm:w-10 sm:h-10" strokeWidth={3} />
                  {stats.withdrawableAmount.toLocaleString()}
                </h2>
                <div className="mt-4 sm:mt-6 flex items-center gap-3 sm:gap-4 text-[8px] sm:text-[9px] font-bold text-slate-500 uppercase tracking-wider">
                  <span className="flex items-center gap-1.5"><CheckCircle2 size={12} className="text-cyan-500" /> Verified</span>
                  <span className="flex items-center gap-1.5"><ShieldCheck size={12} className="text-cyan-500" /> Secured</span>
                </div>
              </div>
              <button 
                onClick={() => setShowWithdrawModal(true)}
                disabled={stats.withdrawableAmount < 500}
                className="w-full sm:w-auto px-6 sm:px-8 py-4 sm:py-5 bg-cyan-600 text-white rounded-xl font-bold text-[10px] sm:text-xs uppercase tracking-[0.2em] shadow-xl shadow-cyan-900/40 hover:bg-cyan-500 transition-all disabled:opacity-50 active:scale-95 whitespace-nowrap"
              >
                Withdraw Funds
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="glass-card rounded-xl p-6 sm:p-8 border border-slate-100 dark:border-white/5 bg-white dark:bg-slate-900/40 overflow-hidden">
              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-6 sm:mb-8 flex items-center gap-3">
                <History size={16} /> Payout History
              </h3>
              {payouts.length > 0 ? (
                <>
                  {/* Desktop Table View */}
                  <div className="hidden sm:block overflow-x-auto custom-scrollbar">
                    <table className="w-full text-left whitespace-nowrap min-w-[500px]">
                      <thead>
                        <tr className="border-b border-slate-50 dark:border-white/5">
                          <th className="px-4 pb-4 text-[9px] font-bold text-slate-400 uppercase tracking-wider text-left">ID</th>
                          <th className="px-4 pb-4 text-[9px] font-bold text-slate-400 uppercase tracking-wider text-left">Amount</th>
                          <th className="px-4 pb-4 text-[9px] font-bold text-slate-400 uppercase tracking-wider text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                        {payouts.map(p => (
                          <tr key={p.id} className="group">
                            <td className="px-4 py-4">
                              <p className="text-xs font-bold text-slate-700 dark:text-slate-300 uppercase tracking-tight">PAY-{p.id.slice(-6).toUpperCase()}</p>
                              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{p.createdAt?.toDate ? format(p.createdAt.toDate(), 'dd MMM') : 'Just now'}</p>
                            </td>
                            <td className="px-4 py-4">
                              <p className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">₹{p.amount.toLocaleString()}</p>
                              <p className="text-[9px] font-bold text-slate-400 uppercase">{p.paymentMethod}</p>
                            </td>
                            <td className="px-4 py-4 text-right">
                              <span className={`px-2.5 py-1 rounded text-[9px] font-bold uppercase tracking-wider ${
                                p.status === 'completed' ? 'bg-emerald-500 text-white' :
                                p.status === 'pending' ? 'bg-amber-500 text-white' :
                                'bg-cyan-500 text-white'
                              }`}>
                                {p.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Card View */}
                  <div className="sm:hidden space-y-4">
                    {payouts.map(p => (
                      <div key={p.id} className="p-4 rounded-xl border border-slate-100 dark:border-white/5 bg-slate-50/30 dark:bg-white/2 space-y-3">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="text-[10px] font-bold text-slate-900 dark:text-white uppercase tracking-tight">PAY-{p.id.slice(-6).toUpperCase()}</p>
                            <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider">{p.createdAt?.toDate ? format(p.createdAt.toDate(), 'dd MMM, HH:mm') : 'Just now'}</p>
                          </div>
                          <span className={`px-2 py-0.5 rounded text-[8px] font-bold uppercase tracking-wider ${
                            p.status === 'completed' ? 'bg-emerald-500 text-white' :
                            p.status === 'pending' ? 'bg-amber-500 text-white' :
                            'bg-cyan-500 text-white'
                          }`}>
                            {p.status}
                          </span>
                        </div>
                        <div className="flex items-center justify-between pt-2 border-t border-slate-100 dark:border-white/5">
                          <p className="text-sm font-bold text-slate-900 dark:text-white tracking-tight">₹{p.amount.toLocaleString()}</p>
                          <p className="text-[8px] font-bold text-slate-400 uppercase">{p.paymentMethod}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="py-16 text-center text-slate-400 font-bold text-[10px] uppercase tracking-wider">No payout records found.</div>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="glass-card p-8 rounded-xl bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-white/5">
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-6">Ledger Summary</p>
              <div className="space-y-6">
                <div>
                  <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">Lifetime Earned</p>
                  <p className="text-2xl font-bold text-slate-900 dark:text-white mt-1 tracking-tight">₹{stats.grossEarnings.toLocaleString()}</p>
                </div>
                <div className="h-px bg-slate-200 dark:bg-white/5" />
                <div>
                  <p className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider">Total Settled</p>
                  <p className="text-2xl font-bold text-emerald-600 mt-1 tracking-tight">₹{stats.totalWithdrawn.toLocaleString()}</p>
                </div>
                <div className="h-px bg-slate-200 dark:bg-white/5" />
                <div>
                  <p className="text-[9px] font-bold text-amber-500 uppercase tracking-wider">In Pipeline</p>
                  <p className="text-2xl font-bold text-amber-500 mt-1 tracking-tight">₹{stats.pendingPayouts.toLocaleString()}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <AnimatePresence>
        {showWithdrawModal && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowWithdrawModal(false)} className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-xl shadow-2xl overflow-hidden border border-slate-100 dark:border-white/5">
              <div className="p-8 bg-slate-900 text-white flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-bold uppercase tracking-tight">Withdraw Funds</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Available: ₹{stats.withdrawableAmount.toLocaleString()}</p>
                </div>
                <button onClick={() => setShowWithdrawModal(false)} className="w-10 h-10 bg-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-all"><X size={20} /></button>
              </div>

              <form onSubmit={handleWithdraw} className="p-8 space-y-6">
                <div className="space-y-1.5">
                  <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">Amount (INR)</label>
                  <div className="relative">
                    <span className="absolute left-4 top-1/2 -translate-y-1/2 font-bold text-slate-400">₹</span>
                    <input type="number" required min={500} max={stats.withdrawableAmount} value={withdrawAmount} onChange={(e) => setWithdrawAmount(e.target.value)} className="w-full pl-8 pr-4 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-white/5 rounded-xl font-bold text-sm outline-none focus:border-cyan-600 text-slate-900 dark:text-white" placeholder="Min 500" />
                  </div>
                </div>

                <div className="flex p-1 bg-slate-100 dark:bg-slate-800 rounded-lg">
                  <button type="button" onClick={() => setPaymentMethod('upi')} className={`flex-1 py-3 rounded text-[10px] font-bold uppercase tracking-wider transition-all ${paymentMethod === 'upi' ? 'bg-white dark:bg-slate-700 text-cyan-600 shadow-sm' : 'text-slate-400'}`}>UPI</button>
                  <button type="button" onClick={() => setPaymentMethod('bank')} className={`flex-1 py-3 rounded text-[10px] font-bold uppercase tracking-wider transition-all ${paymentMethod === 'bank' ? 'bg-white dark:bg-slate-700 text-indigo-600 shadow-sm' : 'text-slate-400'}`}>Bank Transfer</button>
                </div>

                {paymentMethod === 'upi' ? (
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider ml-1">UPI ID</label>
                    <input type="text" placeholder="e.g. name@upi" value={upiId} onChange={(e) => setUpiId(e.target.value)} className="w-full px-4 py-4 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-white/5 rounded-xl font-bold text-sm outline-none focus:border-cyan-600 text-slate-900 dark:text-white" />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <input type="text" placeholder="Holder Name" value={bankDetails.holderName} onChange={(e) => setBankDetails({...bankDetails, holderName: e.target.value})} className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-white/5 rounded-xl font-bold text-xs outline-none focus:border-indigo-600" />
                    <div className="grid grid-cols-2 gap-4">
                      <input type="text" placeholder="A/C No" value={bankDetails.accountNumber} onChange={(e) => setBankDetails({...bankDetails, accountNumber: e.target.value})} className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-white/5 rounded-xl font-bold text-xs outline-none focus:border-indigo-600" />
                      <input type="text" placeholder="IFSC" value={bankDetails.ifsc} onChange={(e) => setBankDetails({...bankDetails, ifsc: e.target.value})} className="w-full px-4 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-white/5 rounded-xl font-bold text-xs outline-none focus:border-indigo-600" />
                    </div>
                  </div>
                )}

                <button type="submit" disabled={requesting} className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold text-xs uppercase tracking-[0.2em] shadow-xl hover:scale-[1.01] transition-all flex items-center justify-center gap-2">
                  {requesting ? <Loader2 size={18} className="animate-spin" /> : 'Confirm Withdrawal'}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
