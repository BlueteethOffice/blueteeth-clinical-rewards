'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { db, auth } from '@/lib/firebase';
import { 
  collection, 
  query, 
  onSnapshot, 
  orderBy, 
  updateDoc, 
  doc, 
  getDoc, 
  increment,
  Timestamp,
  serverTimestamp
} from 'firebase/firestore';
import { 
  Wallet, 
  Clock, 
  CheckCircle2, 
  Loader2,
  DollarSign,
  ChevronRight,
  ArrowUpRight,
  User,
  Smartphone,
  Banknote,
  XCircle,
  Eye,
  Check,
  Edit3,
  X,
  CreditCard,
  ExternalLink,
  MessageSquare,
  Shield
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';

export default function AdminPayoutsPage() {
  const [payouts, setPayouts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedPayout, setSelectedPayout] = useState<any>(null);
  const [processingId, setProcessingId] = useState<string | null>(null);
  const { user: currentUser, loading: authLoading } = useAuth();
  
  // Security Check: Only Admin can access
  useEffect(() => {
    if (!authLoading && (!currentUser || currentUser.role !== 'admin')) {
      toast.error('Unauthorized access');
      window.location.href = '/dashboard';
    }
  }, [currentUser, authLoading]);

  // Edit State
  const [txId, setTxId] = useState('');
  const [remarks, setRemarks] = useState('');

  useEffect(() => {
    // Listen to both collections or just a unified one
    // For now, let's listen to clinicianPayouts as per the new system
    const q = query(collection(db, 'clinicianPayouts'), orderBy('createdAt', 'desc'));
    
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPayouts(data);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const handleUpdateStatus = async (payoutId: string, status: string) => {
    setProcessingId(payoutId);
    try {
      if (!currentUser) throw new Error('Not authenticated');
      const token = await auth.currentUser?.getIdToken();
      
      const res = await fetch('/api/payouts/update', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          payoutId, 
          status, 
          remarks: remarks || '',
          transactionId: status === 'paid' ? txId : undefined
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');
      
      toast.success(`Payout ${status} successfully`);
      setSelectedPayout(null);
      setTxId('');
      setRemarks('');
    } catch (error: any) {
      toast.error(error.message || 'Update failed');
    } finally {
      setProcessingId(null);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20';
      case 'approved': return 'bg-blue-500/10 text-blue-600 border-blue-500/20';
      case 'rejected': return 'bg-red-500/10 text-red-600 border-red-500/20';
      case 'processing': return 'bg-indigo-500/10 text-indigo-600 border-indigo-500/20';
      case 'paid': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
      default: return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
    }
  };

  return (
    <DashboardLayout hideNavbar={!!selectedPayout}>
      <div className="max-w-7xl mx-auto px-1 sm:px-4">
        <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight uppercase">Payout Management</h1>
            <p className="text-[9px] sm:text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-1">Settle clinician consultation fees & rewards.</p>
          </div>
          <div className="flex items-center gap-2 px-3 py-1.5 sm:px-4 sm:py-2 bg-slate-50 dark:bg-slate-800 rounded-lg border border-slate-100 dark:border-white/5 w-fit">
            <Shield size={14} className="text-cyan-500" />
            <span className="text-[8px] sm:text-[9px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider">Admin Control</span>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 sm:gap-4 mb-8">
          <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-xl border border-slate-100 dark:border-white/5 shadow-sm">
            <p className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Pending</p>
            <h3 className="text-xl sm:text-2xl font-bold text-yellow-500 tracking-tight">{payouts.filter(p => p.status === 'pending').length}</h3>
          </div>
          <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-xl border border-slate-100 dark:border-white/5 shadow-sm">
            <p className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Approved</p>
            <h3 className="text-xl sm:text-2xl font-bold text-blue-500 tracking-tight">{payouts.filter(p => p.status === 'approved' || p.status === 'processing').length}</h3>
          </div>
          <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-xl border border-slate-100 dark:border-white/5 shadow-sm">
            <p className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Settled</p>
            <h3 className="text-xl sm:text-2xl font-bold text-emerald-500 tracking-tight">{payouts.filter(p => p.status === 'paid').length}</h3>
          </div>
          <div className="bg-white dark:bg-slate-900 p-4 sm:p-5 rounded-xl border border-slate-100 dark:border-white/5 shadow-sm">
            <p className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Declined</p>
            <h3 className="text-xl sm:text-2xl font-bold text-red-500 tracking-tight">{payouts.filter(p => p.status === 'rejected').length}</h3>
          </div>
        </div>

        {/* Requests Table & Cards */}
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/5 overflow-hidden shadow-sm">
          {loading ? (
            <div className="py-20 flex flex-col items-center gap-4">
              <Loader2 className="animate-spin text-cyan-600" size={32} />
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Synchronizing Payout Stream...</p>
            </div>
          ) : payouts.length > 0 ? (
            <>
              {/* Desktop Table */}
              <div className="hidden sm:block overflow-x-auto custom-scrollbar">
                <table className="w-full text-left whitespace-nowrap">
                  <thead>
                    <tr className="bg-slate-50/50 dark:bg-white/5 border-b border-slate-100 dark:border-white/5">
                      <th className="px-6 py-4 text-[9px] font-bold text-slate-400 uppercase tracking-wider">Clinician Entity</th>
                      <th className="px-6 py-4 text-[9px] font-bold text-slate-400 uppercase tracking-wider">Amount</th>
                      <th className="px-6 py-4 text-[9px] font-bold text-slate-400 uppercase tracking-wider">Settlement</th>
                      <th className="px-6 py-4 text-[9px] font-bold text-slate-400 uppercase tracking-wider">Timeline</th>
                      <th className="px-6 py-4 text-[9px] font-bold text-slate-400 uppercase tracking-wider">Status</th>
                      <th className="px-6 py-4 text-[9px] font-bold text-slate-400 uppercase tracking-wider text-right">Operations</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {payouts.map((p) => (
                      <motion.tr layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors group">
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center text-slate-400 font-bold text-sm uppercase">
                              {p.clinicianName?.[0] || 'C'}
                            </div>
                            <div>
                              <p className="text-sm font-bold text-slate-900 dark:text-white leading-none uppercase">{p.clinicianName}</p>
                              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-tight mt-1">ID: {p.clinicianId?.slice(-8).toUpperCase()}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className="text-base font-bold text-slate-900 dark:text-white tracking-tight">₹{p.amount.toLocaleString()}</span>
                        </td>
                        <td className="px-6 py-4">
                          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-50 dark:bg-slate-800 rounded-md text-[9px] font-bold text-slate-500 uppercase border border-slate-100 dark:border-white/5">
                            {p.method === 'upi' ? <Smartphone size={10} className="text-cyan-500" /> : <Banknote size={10} className="text-emerald-500" />}
                            {p.method}
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-[9px] font-bold text-slate-400 uppercase">
                            {p.createdAt?.toDate ? format(p.createdAt.toDate(), 'dd MMM, yyyy') : 'Recently'}
                          </p>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-2 py-0.5 border rounded-md text-[8px] font-bold uppercase tracking-wider flex items-center gap-1.5 w-fit ${getStatusColor(p.status)}`}>
                            <span className={`w-1 h-1 rounded-full ${p.status === 'pending' ? 'bg-yellow-500' : p.status === 'paid' ? 'bg-emerald-500' : 'bg-current'}`} />
                            {p.status}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button onClick={() => setSelectedPayout(p)} className="px-4 py-2 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl text-[9px] font-bold uppercase tracking-wider hover:opacity-80 transition-all opacity-0 group-hover:opacity-100">Review</button>
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile Card List */}
              <div className="sm:hidden divide-y divide-slate-100 dark:divide-white/5">
                {payouts.map((p) => (
                  <div key={p.id} onClick={() => setSelectedPayout(p)} className="p-4 active:bg-slate-50 transition-colors">
                    <div className="flex justify-between items-start mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-400 font-bold text-sm uppercase">
                          {p.clinicianName?.[0] || 'C'}
                        </div>
                        <div>
                          <p className="text-xs font-bold text-slate-900 dark:text-white uppercase leading-tight truncate max-w-[150px]">{p.clinicianName}</p>
                          <p className="text-[8px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">ID: {p.clinicianId?.slice(-8).toUpperCase()}</p>
                        </div>
                      </div>
                      <span className="text-base font-bold text-slate-900 dark:text-white tracking-tight">₹{p.amount.toLocaleString()}</span>
                    </div>

                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className={`px-2 py-0.5 border rounded-md text-[8px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${getStatusColor(p.status)}`}>
                          {p.status}
                        </span>
                        <div className="flex items-center gap-1 text-[8px] font-bold text-slate-400 uppercase">
                          <Clock size={10} /> {p.createdAt?.toDate ? format(p.createdAt.toDate(), 'dd MMM') : 'Recently'}
                        </div>
                      </div>
                      <ChevronRight size={16} className="text-slate-300" />
                    </div>
                  </div>
                ))}
              </div>
            </>
          ) : (
            <div className="py-32 text-center text-slate-400 px-4">
              <Wallet size={48} className="mx-auto mb-4 opacity-10" />
              <p className="text-[10px] font-bold uppercase tracking-wider">No payout requests found</p>
            </div>
          )}
        </div>
      </div>

      {/* Review Modal */}
      <AnimatePresence>
        {selectedPayout && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedPayout(null)}
              className="absolute inset-0 bg-slate-900/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-2xl bg-white dark:bg-slate-950 rounded-2xl sm:rounded-3xl overflow-hidden shadow-2xl border border-white/10 max-h-[95vh] flex flex-col"
            >
              <div className="p-5 sm:p-8 overflow-y-auto custom-scrollbar">
                <div className="flex items-center justify-between mb-6 sm:mb-8">
                  <div>
                    <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white tracking-tight uppercase">Review Payout</h3>
                    <p className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-0.5">Ref: {selectedPayout.id.toUpperCase()}</p>
                  </div>
                  <button onClick={() => setSelectedPayout(null)} className="w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:text-red-500 transition-colors">
                    <X size={18} />
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6 mb-6 sm:mb-8">
                  {/* Payout Info */}
                  <div className="bg-slate-50 dark:bg-white/5 p-4 sm:p-5 rounded-xl border border-slate-100 dark:border-white/5">
                    <p className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Withdrawal Amount</p>
                    <p className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight">₹{selectedPayout.amount.toLocaleString()}</p>
                  </div>
                  <div className="bg-slate-50 dark:bg-white/5 p-4 sm:p-5 rounded-xl border border-slate-100 dark:border-white/5">
                    <p className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Clinician</p>
                    <p className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white uppercase tracking-tight">{selectedPayout.clinicianName}</p>
                    <p className="text-[8px] font-bold text-emerald-500 uppercase tracking-wider">Reg: {selectedPayout.registrationNumber || 'N/A'}</p>
                  </div>

                  {/* Payment Details */}
                  <div className="col-span-1 sm:col-span-2 bg-slate-900 text-white p-5 sm:p-6 rounded-2xl relative overflow-hidden">
                    <div className="relative z-10">
                      <div className="flex items-center gap-2 mb-4">
                        <CreditCard className="text-cyan-400" size={16} />
                        <h4 className="text-[8px] sm:text-[9px] font-bold uppercase tracking-wider">Settlement Details</h4>
                      </div>
                      
                      {selectedPayout.method === 'upi' ? (
                        <div className="space-y-4">
                          <div className="flex justify-between items-center">
                            <span className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase">UPI ID</span>
                            <span className="text-xs sm:text-sm font-bold text-cyan-400 select-all">{selectedPayout.details.upiId}</span>
                          </div>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 gap-4">
                          <div className="col-span-2 sm:col-span-1">
                            <p className="text-[7px] sm:text-[8px] font-bold text-slate-400 uppercase mb-0.5">Account Holder</p>
                            <p className="text-[9px] sm:text-[10px] font-bold uppercase truncate">{selectedPayout.details.accountHolder}</p>
                          </div>
                          <div className="col-span-2 sm:col-span-1">
                            <p className="text-[7px] sm:text-[8px] font-bold text-slate-400 uppercase mb-0.5">Bank Name</p>
                            <p className="text-[9px] sm:text-[10px] font-bold uppercase truncate">{selectedPayout.details.bankName}</p>
                          </div>
                          <div className="col-span-2 sm:col-span-1">
                            <p className="text-[7px] sm:text-[8px] font-bold text-slate-400 uppercase mb-0.5">Account Number</p>
                            <p className="text-[9px] sm:text-[10px] font-bold select-all">{selectedPayout.details.accountNumber}</p>
                          </div>
                          <div className="col-span-2 sm:col-span-1">
                            <p className="text-[7px] sm:text-[8px] font-bold text-slate-400 uppercase mb-0.5">IFSC Code</p>
                            <p className="text-[9px] sm:text-[10px] font-bold select-all uppercase">{selectedPayout.details.ifscCode}</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* Processing Inputs */}
                <div className="space-y-4">
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Transaction ID (Required for paid)</label>
                    <input 
                      type="text"
                      value={txId}
                      onChange={(e) => setTxId(e.target.value)}
                      placeholder="TXN-1234567890"
                      className="w-full px-5 py-3 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-xl text-sm font-bold text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500 transition-all"
                    />
                  </div>
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Admin Remarks</label>
                    <textarea 
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="Enter status update details..."
                      className="w-full px-5 py-3 bg-slate-50 dark:bg-white/5 border border-slate-100 dark:border-white/5 rounded-xl text-xs font-medium text-slate-900 dark:text-white focus:outline-none focus:border-cyan-500 transition-all h-20 resize-none"
                    />
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-col sm:grid sm:grid-cols-3 gap-3 mt-8">
                  <button 
                    onClick={() => handleUpdateStatus(selectedPayout.id, 'rejected')}
                    className="order-3 sm:order-1 py-3.5 bg-red-500/10 text-red-600 rounded-xl font-bold text-[9px] uppercase tracking-wider border border-red-500/20 hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-1.5"
                  >
                    <XCircle size={14} /> Reject
                  </button>
                  <button 
                    onClick={() => handleUpdateStatus(selectedPayout.id, 'approved')}
                    className="order-2 sm:order-2 py-3.5 bg-blue-500/10 text-blue-600 rounded-xl font-bold text-[9px] uppercase tracking-wider border border-blue-500/20 hover:bg-blue-500 hover:text-white transition-all flex items-center justify-center gap-1.5"
                  >
                    <CheckCircle2 size={14} /> Approve
                  </button>
                  <button 
                    onClick={() => handleUpdateStatus(selectedPayout.id, 'paid')}
                    disabled={!txId}
                    className="order-1 sm:order-3 py-4 bg-emerald-500 text-white rounded-xl font-bold text-[10px] uppercase tracking-wider shadow-lg shadow-emerald-500/20 hover:bg-emerald-600 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    <Check size={16} /> Mark Paid
                  </button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
