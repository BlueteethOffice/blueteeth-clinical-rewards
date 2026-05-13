'use client';

import { useEffect, useState, useMemo } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { 
  collection, 
  query, 
  where, 
  onSnapshot, 
  addDoc, 
  serverTimestamp,
  doc,
  setDoc,
  getDoc
} from 'firebase/firestore';
import { 
  Wallet, 
  TrendingUp, 
  Clock, 
  CheckCircle2, 
  IndianRupee,
  Smartphone,
  Banknote,
  Plus,
  Loader2,
  ChevronRight,
  Info,
  X,
  Stethoscope,
  ArrowRight,
  CreditCard,
  AlertCircle,
  Building2,
  User,
  ShieldCheck,
  Check,
  Fingerprint,
  FileText
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';

interface PayoutRequest {
  id: string;
  amount: number;
  method: 'upi' | 'bank';
  status: 'pending' | 'approved' | 'rejected' | 'processing' | 'paid';
  createdAt: any;
  details: any;
}

const UPI_HANDLES = ['@ybl', '@paytm', '@okhdfcbank', '@okaxis', '@okicici', '@oksbi', '@ibl', '@axl', '@upi'];

const APP_CONFIG: Record<string, { name: string, color: string, bg: string }> = {
  '@ybl': { name: 'PhonePe', color: 'text-[#5f259f]', bg: 'bg-[#5f259f]/10' },
  '@ibl': { name: 'PhonePe', color: 'text-[#5f259f]', bg: 'bg-[#5f259f]/10' },
  '@paytm': { name: 'Paytm', color: 'text-[#00B9F1]', bg: 'bg-[#00B9F1]/10' },
  '@okhdfcbank': { name: 'Google Pay', color: 'text-[#4285F4]', bg: 'bg-[#4285F4]/10' },
  '@okaxis': { name: 'Google Pay', color: 'text-[#4285F4]', bg: 'bg-[#4285F4]/10' },
  '@okicici': { name: 'Google Pay', color: 'text-[#4285F4]', bg: 'bg-[#4285F4]/10' },
  '@oksbi': { name: 'Google Pay', color: 'text-[#4285F4]', bg: 'bg-[#4285F4]/10' },
  '@axl': { name: 'Amazon Pay', color: 'text-[#FF9900]', bg: 'bg-[#FF9900]/10' },
  '@upi': { name: 'BHIM UPI', color: 'text-[#007b5e]', bg: 'bg-[#007b5e]/10' }
};

export default function ClinicianEarningsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [payouts, setPayouts] = useState<PayoutRequest[]>([]);
  const [stats, setStats] = useState({ total: 0, approved: 0, completed: 0 });
  const [totalApprovedFees, setTotalApprovedFees] = useState(0);
  const [minWithdrawal, setMinWithdrawal] = useState(1000);
  
  const [showModal, setShowModal] = useState(false);
  const [withdrawAmount, setWithdrawAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'upi' | 'bank'>('upi');
  const [isRequesting, setIsRequesting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isFetchingIFSC, setIsFetchingIFSC] = useState(false);
  const [showUpiSuggestions, setShowUpiSuggestions] = useState(false);
  
  const [bankDetails, setBankDetails] = useState({
    upiId: '',
    accountHolder: '',
    accountNumber: '',
    confirmAccountNumber: '',
    bankName: '',
    ifscCode: '',
    aadhaarNumber: '',
    panNumber: ''
  });

  useEffect(() => {
    if (!user?.uid) return;

    const casesQuery = query(collection(db, 'cases'), where('clinicianId', '==', user.uid));
    const unsubCases = onSnapshot(casesQuery, (snap) => {
      let fees = 0;
      let t = 0, a = 0, c = 0;
      snap.docs.forEach(doc => {
        const d = doc.data();
        t++;
        if (d.status === 'approved') { a++; fees += (d.consultationFee || 0); }
        else if (d.status === 'completed') c++;
      });
      setStats({ total: t, approved: a, completed: c });
      setTotalApprovedFees(fees);
    });

    const payoutQuery = query(collection(db, 'clinicianPayouts'), where('clinicianId', '==', user.uid));
    const unsubPayouts = onSnapshot(payoutQuery, (snap) => {
      const data = snap.docs.map(d => ({ id: d.id, ...d.data() })) as PayoutRequest[];
      setPayouts(data.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0)));
      setLoading(false);
    });

    const unsubSettings = onSnapshot(doc(db, 'adminSettings', 'financials'), (snap) => {
      if (snap.exists()) setMinWithdrawal(snap.data().minWithdrawal || 1000);
    });

    const fetchBank = async () => {
      const snap = await getDoc(doc(db, 'clinicianBankDetails', user.uid));
      if (snap.exists()) setBankDetails(prev => ({ ...prev, ...snap.data() }));
    };
    fetchBank();

    return () => { unsubCases(); unsubPayouts(); unsubSettings(); };
  }, [user]);

  // Lock body scroll when modal is open
  useEffect(() => {
    if (showModal) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showModal]);

  // Validation Logic
  const upiRegex = /^[a-zA-Z0-9.\-_]{2,256}@[a-zA-Z]{2,64}$/;
  const panRegex = /^[A-Z]{5}[0-9]{4}[A-Z]{1}$/;
  const aadhaarRegex = /^\d{12}$/;
  const ifscRegex = /^[A-Z]{4}0[A-Z0-9]{6}$/;

  const availableBalance = useMemo(() => {
    const totalDeducted = payouts.reduce((acc, p) => p.status !== 'rejected' ? acc + p.amount : acc, 0);
    return Math.max(0, totalApprovedFees - totalDeducted);
  }, [totalApprovedFees, payouts]);

  const isUpiValid = useMemo(() => upiRegex.test(bankDetails.upiId), [bankDetails.upiId]);
  const isPanValid = useMemo(() => panRegex.test(bankDetails.panNumber), [bankDetails.panNumber]);
  const isAadhaarValid = useMemo(() => aadhaarRegex.test(bankDetails.aadhaarNumber), [bankDetails.aadhaarNumber]);
  const isIfscValid = useMemo(() => ifscRegex.test(bankDetails.ifscCode), [bankDetails.ifscCode]);
  const isBankMatch = useMemo(() => bankDetails.accountNumber && bankDetails.accountNumber === bankDetails.confirmAccountNumber, [bankDetails.accountNumber, bankDetails.confirmAccountNumber]);

  const isValid = useMemo(() => {
    const amt = Number(withdrawAmount);
    if (!amt || amt < minWithdrawal || amt > availableBalance) return false;
    if (!isPanValid || !isAadhaarValid) return false;
    
    if (paymentMethod === 'upi') return isUpiValid;
    return isBankMatch && isIfscValid && bankDetails.accountHolder.length > 2 && bankDetails.bankName;
  }, [withdrawAmount, availableBalance, minWithdrawal, paymentMethod, bankDetails, isUpiValid, isPanValid, isAadhaarValid, isBankMatch, isIfscValid]);

  // Auto-detect Bank via IFSC
  useEffect(() => {
    if (isIfscValid && !bankDetails.bankName) {
      const fetchBankName = async () => {
        setIsFetchingIFSC(true);
        try {
          const res = await fetch(`https://ifsc.razorpay.com/${bankDetails.ifscCode}`);
          if (res.ok) {
            const data = await res.json();
            setBankDetails(prev => ({ ...prev, bankName: data.BANK }));
          }
        } catch (e) { console.error(e); }
        finally { setIsFetchingIFSC(false); }
      };
      fetchBankName();
    }
  }, [bankDetails.ifscCode, isIfscValid]);

  const handleRequestPayout = async () => {
    if (!isValid) return;
    setIsRequesting(true);
    try {
      await addDoc(collection(db, 'clinicianPayouts'), {
        clinicianId: user?.uid,
        clinicianName: user?.name,
        amount: Number(withdrawAmount),
        method: paymentMethod,
        details: {
          ...bankDetails,
          methodUsed: paymentMethod
        },
        status: 'pending',
        createdAt: serverTimestamp()
      });

      // Save for next time
      await setDoc(doc(db, 'clinicianBankDetails', user!.uid), {
        ...bankDetails,
        updatedAt: serverTimestamp()
      });

      setIsSuccess(true);
      toast.success('Payout request submitted successfully!');
      setTimeout(() => {
        setShowModal(false);
        setIsSuccess(false);
        setWithdrawAmount('');
      }, 2000);
    } catch (error: any) {
      toast.error('Failed: ' + error.message);
    } finally {
      setIsRequesting(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-amber-500/10 text-amber-600 border-amber-500/20';
      case 'paid': return 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20';
      case 'rejected': return 'bg-rose-500/10 text-rose-600 border-rose-500/20';
      default: return 'bg-slate-500/10 text-slate-500 border-slate-500/20';
    }
  };

  const detectApp = (upi: string) => {
    const handle = upi.substring(upi.indexOf('@'));
    return APP_CONFIG[handle] || { name: 'Bank UPI', color: 'text-slate-500', bg: 'bg-slate-500/10' };
  };

  return (
    <DashboardLayout hideNavbar={showModal}>
      <div className="max-w-7xl mx-auto pb-8 px-2 sm:px-0">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-6 mb-8 pt-4 sm:pt-8">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight uppercase mb-1">Earnings & Payouts</h1>
            <p className="text-slate-500 dark:text-slate-400 text-[9px] sm:text-[10px] font-bold uppercase tracking-wider">Real-time settlement portal</p>
          </div>
          <button 
            onClick={() => setShowModal(true)}
            className="w-full sm:w-auto flex items-center justify-center gap-2 px-6 py-4 sm:py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold text-[10px] uppercase tracking-wider shadow-lg hover:bg-slate-800 transition-all"
          >
            <Plus size={16} /> Request Payout
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-8">
          <div className="bg-slate-900 rounded-xl p-6 text-white shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full blur-2xl -mr-16 -mt-16 group-hover:bg-white/10 transition-all" />
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Balance</p>
            <h3 className="text-3xl font-bold tracking-tight">₹{availableBalance.toLocaleString()}</h3>
            <Wallet className="absolute right-4 top-4 text-white/5" size={40} />
          </div>
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-white/5 flex flex-col justify-between">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Total Earned</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">₹{totalApprovedFees.toLocaleString()}</h3>
          </div>
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-white/5 flex flex-col justify-between">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Treated Cases</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">{stats.total}</h3>
          </div>
          <div className="bg-white dark:bg-slate-900 p-6 rounded-xl border border-slate-200 dark:border-white/5 flex flex-col justify-between">
            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider mb-1">Min. Withdrawal</p>
            <h3 className="text-2xl font-bold text-slate-900 dark:text-white tracking-tight">₹{minWithdrawal}</h3>
          </div>
        </div>

        {/* History */}
        <div className="bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-white/5 overflow-hidden">
          <div className="p-6 border-b border-slate-100 dark:border-white/5">
            <h2 className="text-lg font-bold text-slate-900 dark:text-white uppercase tracking-tight">Withdrawal Ledger</h2>
          </div>
          <div className="overflow-x-auto custom-scrollbar">
            {loading ? (
              <div className="py-20 flex justify-center"><Loader2 className="animate-spin text-slate-300" size={32} /></div>
            ) : payouts.length > 0 ? (
              <>
                {/* Desktop View */}
                <table className="hidden sm:table w-full text-left whitespace-nowrap min-w-[500px]">
                  <thead>
                    <tr className="bg-slate-50 dark:bg-white/2">
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Amount</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Method</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider text-center">Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-white/5">
                    {payouts.map((p) => (
                      <tr key={p.id} className="hover:bg-slate-50/50 dark:hover:bg-white/2 transition-colors">
                        <td className="px-6 py-4 text-sm font-bold text-slate-900 dark:text-white">₹{p.amount.toLocaleString()}</td>
                        <td className="px-6 py-4 text-[10px] font-bold text-slate-500 uppercase tracking-wider">{p.method}</td>
                        <td className="px-6 py-4 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          {p.createdAt?.toDate ? format(p.createdAt.toDate(), 'dd/MM/yyyy') : 'Now'}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`px-3 py-1 border rounded-lg text-[9px] font-bold uppercase tracking-wider ${getStatusColor(p.status)}`}>
                            {p.status}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {/* Mobile View */}
                <div className="sm:hidden divide-y divide-slate-100 dark:divide-white/5">
                  {payouts.map((p) => (
                    <div key={p.id} className="p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${p.method === 'upi' ? 'bg-indigo-50 text-indigo-600' : 'bg-blue-50 text-blue-600'}`}>
                            {p.method === 'upi' ? <Smartphone size={14} /> : <Banknote size={14} />}
                          </div>
                          <div>
                            <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{p.createdAt?.toDate ? format(p.createdAt.toDate(), 'dd MMM, yyyy') : 'Recently'}</p>
                            <p className="text-[8px] font-bold text-slate-500 uppercase">via {p.method}</p>
                          </div>
                        </div>
                        <span className={`px-2 py-0.5 border rounded-md text-[8px] font-bold uppercase tracking-wider ${getStatusColor(p.status)}`}>
                          {p.status}
                        </span>
                      </div>
                      <div className="flex items-center justify-between pl-10">
                        <p className="text-base font-bold text-slate-900 dark:text-white tracking-tight">₹{p.amount.toLocaleString()}</p>
                        <ChevronRight size={14} className="text-slate-300" />
                      </div>
                    </div>
                  ))}
                </div>
              </>
            ) : (
              <div className="py-40 text-center text-slate-400"><p className="text-[10px] font-bold uppercase tracking-wider">No settlement history</p></div>
            )}
          </div>
        </div>
      </div>

      {/* SECURE PAYOUT MODAL */}
      <AnimatePresence>
        {showModal && (
          <div className="fixed inset-0 z-[999] flex items-center justify-center p-4 overflow-hidden">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowModal(false)} className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm transition-all" />
            <motion.div initial={{ scale: 0.98, opacity: 0, y: 10 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.98, opacity: 0, y: 10 }} className="relative w-full max-w-[440px] bg-white dark:bg-slate-950 rounded-xl overflow-hidden shadow-[0_20px_60px_rgba(0,0,0,0.3)] border border-slate-200 dark:border-white/10 flex flex-col max-h-[90vh]">
              
              {/* Header */}
              <div className="px-6 py-5 border-b border-slate-100 dark:border-white/5 flex items-center justify-between bg-slate-50/50 dark:bg-white/2">
                <div>
                  <h3 className="text-sm font-bold text-slate-900 dark:text-white uppercase tracking-tight">Settlement Request</h3>
                  <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-wider">Limit: ₹{availableBalance.toLocaleString()}</p>
                </div>
                <button 
                  onClick={() => setShowModal(false)}
                  className="p-2 hover:bg-rose-500 hover:text-white rounded-lg transition-colors group"
                >
                  <X size={16} className="text-slate-400 group-hover:text-white" />
                </button>
              </div>

              <div className="p-6 space-y-5 overflow-y-auto no-scrollbar">
                {/* 1. KYC Section */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1"><FileText size={8} /> PAN Number</label>
                    <input 
                      type="text" 
                      maxLength={10}
                      value={bankDetails.panNumber} 
                      onChange={(e) => setBankDetails({...bankDetails, panNumber: e.target.value.toUpperCase().trim()})}
                      placeholder="ABCDE1234F"
                      className={`w-full px-3 py-2 bg-slate-50 dark:bg-white/5 border rounded-lg text-xs font-bold uppercase focus:outline-none transition-all ${isPanValid ? 'border-emerald-500/30' : 'border-slate-100 dark:border-white/5'}`}
                    />
                  </div>
                  <div>
                    <label className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5 flex items-center gap-1"><Fingerprint size={8} /> Aadhaar Number</label>
                    <input 
                      type="text" 
                      maxLength={12}
                      value={bankDetails.aadhaarNumber} 
                      onChange={(e) => setBankDetails({...bankDetails, aadhaarNumber: e.target.value.replace(/\D/g, '')})}
                      placeholder="12 Digit ID"
                      className={`w-full px-3 py-2 bg-slate-50 dark:bg-white/5 border rounded-lg text-xs font-bold focus:outline-none transition-all ${isAadhaarValid ? 'border-emerald-500/30' : 'border-slate-100 dark:border-white/5'}`}
                    />
                  </div>
                </div>

                {/* 2. Amount Input */}
                <div>
                  <label className="text-[8px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">Withdrawal Amount</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-lg font-bold text-slate-300">₹</span>
                    <input 
                      type="number"
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      placeholder="0"
                      className="w-full pl-8 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-xl text-lg font-bold focus:outline-none focus:border-slate-900 transition-all"
                    />
                  </div>
                </div>

                {/* 3. Transfer Method */}
                <div className="flex gap-2 p-1 bg-slate-100 dark:bg-white/5 rounded-lg border border-slate-200 dark:border-white/5">
                  <button onClick={() => setPaymentMethod('upi')} className={`flex-1 py-1.5 rounded text-[9px] font-bold uppercase tracking-wider transition-all ${paymentMethod === 'upi' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400'}`}>UPI Node</button>
                  <button onClick={() => setPaymentMethod('bank')} className={`flex-1 py-1.5 rounded text-[9px] font-bold uppercase tracking-wider transition-all ${paymentMethod === 'bank' ? 'bg-white dark:bg-slate-800 text-slate-900 dark:text-white shadow-sm' : 'text-slate-400'}`}>Bank Wire</button>
                </div>

                {/* 4. Smart Forms */}
                <div className="p-4 bg-slate-50 dark:bg-white/2 rounded-xl border border-slate-200 dark:border-white/5">
                  {paymentMethod === 'upi' ? (
                    <div className="relative">
                      <div className="flex items-center justify-between mb-2">
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">UPI ID Identity</label>
                        {isUpiValid && (
                          <span className={`text-[8px] font-bold uppercase tracking-wider flex items-center gap-1.5 px-2 py-0.5 rounded-full ${detectApp(bankDetails.upiId).bg} ${detectApp(bankDetails.upiId).color}`}>
                            <Check size={10} /> {detectApp(bankDetails.upiId).name} Verified
                          </span>
                        )}
                      </div>
                      <input 
                        type="text"
                        value={bankDetails.upiId}
                        onChange={(e) => {
                          const val = e.target.value.toLowerCase().replace(/\s/g, '');
                          setBankDetails({...bankDetails, upiId: val});
                          setShowUpiSuggestions(val.includes('@') && !UPI_HANDLES.includes(val.substring(val.indexOf('@'))));
                        }}
                        onFocus={() => bankDetails.upiId.includes('@') && setShowUpiSuggestions(true)}
                        placeholder="username@bank"
                        className={`w-full px-4 py-2.5 bg-white dark:bg-slate-900 border rounded-lg text-sm font-bold focus:outline-none transition-all ${isUpiValid ? 'border-emerald-500/50' : 'border-slate-200 dark:border-white/10'}`}
                      />
                      
                      {/* UPI Suggestions Dropdown */}
                      <AnimatePresence>
                        {showUpiSuggestions && (
                          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute z-50 left-0 right-0 mt-1 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg shadow-xl overflow-hidden">
                            {UPI_HANDLES.map(handle => (
                              <button 
                                key={handle} 
                                onClick={() => {
                                  const prefix = bankDetails.upiId.substring(0, bankDetails.upiId.indexOf('@'));
                                  setBankDetails({...bankDetails, upiId: prefix + handle});
                                  setShowUpiSuggestions(false);
                                }}
                                className="w-full text-left px-4 py-2 text-[10px] font-bold text-slate-500 hover:bg-slate-50 dark:hover:bg-white/5 border-b border-slate-50 dark:border-white/5 last:border-0"
                              >
                                {bankDetails.upiId.substring(0, bankDetails.upiId.indexOf('@'))}{handle} <span className={`float-right text-[8px] font-bold uppercase ${APP_CONFIG[handle]?.color || 'text-slate-400'}`}>{APP_CONFIG[handle]?.name || 'Bank'}</span>
                              </button>
                            ))}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <div>
                        <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Account Holder Name</label>
                        <input 
                          type="text"
                          value={bankDetails.accountHolder}
                          onChange={(e) => setBankDetails({...bankDetails, accountHolder: e.target.value.replace(/[^a-zA-Z\s]/g, '').replace(/\b\w/g, l => l.toUpperCase())})}
                          placeholder="AS PER PASSBOOK"
                          className="w-full px-4 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg text-[10px] font-bold uppercase focus:outline-none"
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Account Number</label>
                          <input 
                            type="text"
                            value={bankDetails.accountNumber}
                            onChange={(e) => setBankDetails({...bankDetails, accountNumber: e.target.value.replace(/\D/g, '')})}
                            placeholder="NUMBER"
                            className="w-full px-3 py-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/10 rounded-lg text-[10px] font-bold focus:outline-none"
                          />
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Confirm Number</label>
                          <input 
                            type="text"
                            value={bankDetails.confirmAccountNumber}
                            onChange={(e) => setBankDetails({...bankDetails, confirmAccountNumber: e.target.value.replace(/\D/g, '')})}
                            placeholder="MATCH"
                            className={`w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-lg text-[10px] font-bold focus:outline-none transition-all ${isBankMatch ? 'border-emerald-500/50' : bankDetails.confirmAccountNumber ? 'border-rose-500/50' : 'border-slate-200 dark:border-white/10'}`}
                          />
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">IFSC Code</label>
                          <div className="relative">
                            <input 
                              type="text"
                              value={bankDetails.ifscCode}
                              onChange={(e) => setBankDetails({...bankDetails, ifscCode: e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '')})}
                              placeholder="IFSC0001234"
                              className={`w-full px-3 py-2 bg-white dark:bg-slate-900 border rounded-lg text-[10px] font-bold uppercase focus:outline-none transition-all ${isIfscValid ? 'border-emerald-500/50' : 'border-slate-200 dark:border-white/10'}`}
                            />
                            {isFetchingIFSC && <Loader2 className="absolute right-2 top-1/2 -translate-y-1/2 animate-spin text-cyan-500" size={10} />}
                          </div>
                        </div>
                        <div>
                          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-1">Detected Bank</label>
                          <div className="w-full px-3 py-2.5 bg-slate-100 dark:bg-white/5 rounded-lg text-[8px] font-bold text-slate-500 truncate uppercase">
                            {bankDetails.bankName || 'AUTO DETECT'}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Action Bar */}
              <div className="px-6 py-6 border-t border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/2">
                <button 
                  onClick={handleRequestPayout}
                  disabled={!isValid || isRequesting || isSuccess}
                  className={`w-full py-3.5 rounded-xl font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-lg ${
                    isSuccess 
                      ? 'bg-emerald-500 text-white' 
                      : isValid 
                        ? 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 shadow-md' 
                        : 'bg-slate-200 dark:bg-white/5 text-slate-400 cursor-not-allowed'
                  }`}
                >
                  {isRequesting ? <Loader2 className="animate-spin" size={16} /> : isSuccess ? <CheckCircle2 size={16} /> : 'Confirm Payout Request'}
                </button>
                <p className="mt-4 text-center text-[8px] font-bold text-slate-400 uppercase tracking-wider flex items-center justify-center gap-1">
                  <ShieldCheck size={10} className="text-emerald-500" /> AES-256 Bit Secured Node
                </p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </DashboardLayout>
  );
}
