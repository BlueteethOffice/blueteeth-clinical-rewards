'use client';

import { useEffect, useState, useMemo } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { 
  collection, 
  query, 
  onSnapshot, 
  updateDoc, 
  doc, 
  getDocs, 
  where, 
  serverTimestamp,
  writeBatch,
  orderBy,
  limit
} from 'firebase/firestore';
import { Case, User as AppUser, CaseStatus, CaseSourceType } from '@/types';
import { 
  Search, 
  Filter, 
  Clock, 
  CheckCircle2, 
  XCircle,
  Loader2,
  UserCheck,
  MoreVertical,
  Stethoscope,
  ChevronRight,
  ChevronLeft,
  ShieldCheck,
  IndianRupee,
  Eye,
  User,
  ArrowUpRight,
  Calendar,
  AlertCircle,
  FileText,
  BadgeCheck,
  LayoutGrid,
  List,
  ChevronDown,
  Database,
  RefreshCw
} from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import Link from 'next/link';

export default function AdminCasesPage() {
  const { user } = useAuth();
  const [cases, setCases] = useState<Case[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState<CaseStatus | 'all'>('all');
  const [filterType, setFilterType] = useState<CaseSourceType | 'all'>('all');
  const [viewMode, setViewMode] = useState<'table' | 'grid'>('table');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [showSyncModal, setShowSyncModal] = useState(false);
  const [selectedCase, setSelectedCase] = useState<Case | null>(null);
  const [clinicians, setClinicians] = useState<AppUser[]>([]);
  const [assignmentFee, setAssignmentFee] = useState<string>('');
  const [selectedClinician, setSelectedClinician] = useState<AppUser | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 6;

  // Real-time Fetch
  useEffect(() => {
    if (!user || user.role !== 'admin') return;

    // ⚡ PERFORMANCE FIX: Limit initial fetch and order by date
    // Fetching all cases at once causes significant lag as the DB grows.
    const q = query(
      collection(db, 'cases'), 
      orderBy('createdAt', 'desc'), 
      limit(50) 
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const casesData = snapshot.docs.map(doc => {
        const data = doc.data();
        
        // Infer sourceType for legacy records
        let sourceType = data.sourceType;
        if (!sourceType) {
          const hasAssoc = data.associateId && data.associateId.trim() !== '';
          const hasClinician = data.clinicianId && data.clinicianId.trim() !== '';

          if (hasAssoc && hasClinician) {
            sourceType = data.associateId === data.clinicianId ? 'clinician_self' : 'assigned';
          }
          else if (hasClinician) sourceType = 'clinician_self';
          else sourceType = 'associate';
        }

        // Fix Dr. Dr. issue in data mapping
        const clinicianName = data.clinicianName?.replace(/^Dr\.\s+/i, '').replace(/^Dr\s+/i, '');
        const associateName = data.associateName?.replace(/^Dr\.\s+/i, '').replace(/^Dr\s+/i, '');

        return { id: doc.id, ...data, sourceType, clinicianName, associateName } as Case;
      });
      setCases(casesData);
      setLoading(false);
    }, (error) => {
      console.error("Cases Listener Error:", error);
      setLoading(false);
    });

    // Fetch Clinicians for Assignment
    const fetchClinicians = async () => {
      const q = query(collection(db, 'users'), where('role', '==', 'clinician'));
      const snap = await getDocs(q);
      setClinicians(snap.docs.map(doc => ({ id: doc.id, ...doc.data() } as unknown as AppUser)));
    };
    fetchClinicians();

    return () => unsubscribe();
  }, []);

  // Filter Logic
  const filteredCases = useMemo(() => {
    return cases.filter(c => {
      const matchesSearch = 
        c.patientName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.id.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.mobile?.includes(searchTerm) ||
        c.clinicianName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.associateName?.toLowerCase().includes(searchTerm.toLowerCase());
      
      const matchesStatus = filterStatus === 'all' || c.status === filterStatus;
      const matchesType = filterType === 'all' || c.sourceType === filterType;
      
      return matchesSearch && matchesStatus && matchesType;
    }).sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
  }, [cases, searchTerm, filterStatus, filterType]);

  // Pagination Logic
  const totalPages = Math.ceil(filteredCases.length / itemsPerPage);
  const paginatedCases = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return filteredCases.slice(start, start + itemsPerPage);
  }, [filteredCases, currentPage]);

  // Reset to page 1 on search/filter
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, filterStatus, filterType]);

  // Smart Lookup for missing Reg IDs
  const getRegNo = (c: Case) => {
    if (c.clinicianRegNo && c.clinicianRegNo !== 'N/A') return c.clinicianRegNo;
    const clinician = clinicians.find(cl => (cl as any).id === c.clinicianId || cl.uid === c.clinicianId);
    return clinician?.registrationNumber || 'N/A';
  };

  const handleSyncContacts = async () => {
    setShowSyncModal(false);
    setLoading(true);
    try {
      console.log("Starting sync contacts...");
      const usersSnap = await getDocs(collection(db, 'users'));
      const userMap = new Map(usersSnap.docs.map(d => {
        const data = d.data();
        return [d.id, data.phone || data.mobile];
      }));
      
      const casesToUpdate = cases.filter(c => 
        c.associateId && !c.associateMobile && userMap.get(c.associateId)
      );

      console.log(`Found ${casesToUpdate.length} cases to backfill.`);

      if (casesToUpdate.length === 0) {
        toast.error('No records found that require syncing');
        setLoading(false);
        return;
      }

      // Process in chunks of 450 (Firestore limit is 500)
      const chunkSize = 450;
      let updatedTotal = 0;

      for (let i = 0; i < casesToUpdate.length; i += chunkSize) {
        const chunk = casesToUpdate.slice(i, i + chunkSize);
        const batch = writeBatch(db);
        
        chunk.forEach(c => {
          const docRef = doc(db, 'cases', c.id);
          batch.update(docRef, { associateMobile: userMap.get(c.associateId!) });
        });

        await batch.commit();
        updatedTotal += chunk.length;
        console.log(`Committed batch of ${chunk.length} cases.`);
      }

      toast.success(`Successfully backfilled ${updatedTotal} contacts`);
    } catch (e) {
      console.error('Sync Error Details:', e);
      toast.error(`Sync failed: ${e?.message || 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAssign = async () => {
    if (!selectedCase || !selectedClinician) return;
    if (!assignmentFee || isNaN(Number(assignmentFee))) {
      toast.error('Please enter a valid consultation fee');
      return;
    }

    if (Number(assignmentFee) > 100000) {
      toast.error('Fee cannot exceed 1,0,00,000 INR');
      return;
    }

    try {
      await updateDoc(doc(db, 'cases', selectedCase.id), {
        clinicianId: (selectedClinician as any).id || selectedClinician.uid,
        clinicianName: selectedClinician.name,
        clinicianRegNo: selectedClinician.registrationNumber || '',
        status: 'assigned',
        sourceType: 'assigned',
        consultationFee: Number(assignmentFee),
        updatedAt: serverTimestamp()
      });
      setShowAssignModal(false);
      setAssignmentFee('');
      setSelectedClinician(null);
      toast.success(`Case assigned to Dr. ${selectedClinician.name}`);
    } catch (error) {
      toast.error('Assignment failed');
    }
  };

  const getStatusBadge = (status: string) => {
    const styles = {
      pending: 'bg-amber-50 text-amber-600 border-amber-100',
      assigned: 'bg-blue-50 text-blue-600 border-blue-100',
      treatment_completed: 'bg-indigo-50 text-indigo-600 border-indigo-100',
      completed: 'bg-emerald-50 text-emerald-600 border-emerald-100',
      approved: 'bg-emerald-500 text-white border-emerald-600',
      rejected: 'bg-red-50 text-red-600 border-red-100'
    };
    return styles[status as keyof typeof styles] || 'bg-slate-100 text-slate-600';
  };

  const getTypeBadge = (type: string) => {
    const styles = {
      associate: 'bg-blue-500 text-white',
      clinician_self: 'bg-purple-500 text-white',
      assigned: 'bg-emerald-500 text-white'
    };
    const labels = { associate: 'Associate', clinician_self: 'Self', assigned: 'Assigned' };
    return {
      style: styles[type as keyof typeof styles] || 'bg-slate-500',
      label: labels[type as keyof typeof labels] || 'Case'
    };
  };

  return (
    <DashboardLayout hideNavbar={showAssignModal || showSyncModal}>
      <div className="max-w-7xl mx-auto px-1 sm:px-4 py-4 sm:py-8">
        
        {/* 🔥 Clean Executive Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-8 px-1 sm:px-0">
          <div className="flex items-center gap-3 sm:gap-4 min-w-0">
            <div className="w-11 h-11 sm:w-12 sm:h-12 bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white rounded-lg flex items-center justify-center border border-slate-200 dark:border-white/5 shrink-0 shadow-sm">
              <ShieldCheck size={24} />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white uppercase tracking-tight">Central Registry</h1>
              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Clinical Case Management</p>
            </div>
          </div>
          
          <div className="flex items-center gap-2 sm:gap-3">
            <button 
              onClick={() => setShowSyncModal(true)}
              disabled={loading}
              className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 sm:px-5 py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-indigo-500/20 transition-all disabled:opacity-50 active:scale-95"
            >
              {loading ? <RefreshCw className="animate-spin" size={14} /> : <Database size={14} />}
              <span className="sm:inline">Sync Contacts</span>
            </button>
            <div className="flex bg-white dark:bg-slate-800 p-1 rounded-lg border border-slate-100 dark:border-white/5 shadow-sm">
              <button 
                onClick={() => setViewMode('table')}
                className={`px-3 py-1.5 rounded-md transition-all ${viewMode === 'table' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}
              >
                <List size={16} />
              </button>
              <button 
                onClick={() => setViewMode('grid')}
                className={`px-3 py-1.5 rounded-md transition-all ${viewMode === 'grid' ? 'bg-slate-900 text-white shadow-lg' : 'text-slate-400'}`}
              >
                <LayoutGrid size={16} />
              </button>
            </div>
          </div>
        </div>

        {/* 🛠️ Modern Integrated Filter Card */}
        <div className="bg-white/50 dark:bg-slate-900/50 backdrop-blur-xl rounded-xl border border-slate-100 dark:border-white/5 p-4 mb-6 sm:mb-8 shadow-sm mx-1 sm:mx-0">
          <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
            {/* Search Box */}
            <div className="w-full sm:max-w-xs relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="Search cases..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 rounded-lg outline-none focus:border-cyan-500 transition-all font-bold text-sm shadow-xs"
              />
            </div>
            
            <div className="flex w-full sm:w-auto gap-2">
              {/* Status Dropdown */}
              <div className="relative flex-1 sm:w-40">
                <select 
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="w-full appearance-none pl-4 pr-10 py-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 rounded-lg outline-none text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-slate-50 transition-all shadow-xs"
                >
                  <option value="all">Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="assigned">Assigned</option>
                  <option value="completed">Done</option>
                  <option value="approved">Approved</option>
                </select>
                <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>

              {/* Type Dropdown */}
              <div className="relative flex-1 sm:w-40">
                <select 
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value as any)}
                  className="w-full appearance-none pl-4 pr-10 py-3 bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/10 rounded-lg outline-none text-[10px] font-black uppercase tracking-widest cursor-pointer hover:bg-slate-50 transition-all shadow-xs"
                >
                  <option value="all">Sources</option>
                  <option value="associate">Associate</option>
                  <option value="clinician_self">Self</option>
                  <option value="assigned">Assigned</option>
                </select>
                <ChevronDown size={14} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              </div>
            </div>

            <div className="hidden sm:flex items-center gap-2 ml-auto">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                Matches: <span className="text-slate-900 dark:text-white">{filteredCases.length}</span>
              </span>
            </div>
          </div>
        </div>

        {/* 📋 Data Rendering */}
        {loading ? (
          <div className="py-24 flex flex-col items-center justify-center gap-6">
            <div className="relative">
              <div className="w-14 h-14 border-4 border-cyan-100 dark:border-white/5 rounded-full" />
              <div className="absolute inset-0 border-4 border-t-cyan-500 rounded-full animate-spin" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-[0.3em] animate-pulse">Syncing Intel...</p>
              <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest">Accessing Clinical Ledger</p>
            </div>
          </div>
        ) : viewMode === 'table' ? (
          <div className="bg-white dark:bg-slate-900 rounded-t-2xl overflow-hidden border border-slate-100 dark:border-white/5 shadow-sm mx-1 sm:mx-0">
            
            {/* Mobile Card Layout for Table View */}
            <div className="sm:hidden divide-y divide-slate-50 dark:divide-white/5">
              {paginatedCases.map((c) => (
                <div key={c.id} className="p-4 relative border-l-4" style={{ borderLeftColor: c.sourceType === 'associate' ? '#3b82f6' : c.sourceType === 'clinician_self' ? '#a855f7' : '#10b981' }}>
                   <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500"><User size={16} /></div>
                      <div>
                        <p className="text-sm font-black text-slate-900 dark:text-white uppercase leading-none">{c.patientName}</p>
                        <p className="text-[9px] font-bold text-slate-400 mt-1">ID: {c.id.slice(0, 8)}</p>
                      </div>
                    </div>
                    <span className={`px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border ${getStatusBadge(c.status)}`}>
                      {c.status.replace('_', ' ')}
                    </span>
                  </div>
                  <div className="flex justify-between items-center bg-slate-50 dark:bg-slate-800/50 p-2.5 rounded-lg mb-4">
                    <p className="text-[10px] font-bold text-slate-600 dark:text-slate-400">
                      {c.sourceType === 'associate' ? `Associate: ${c.associateName}` : `Dr. ${c.clinicianName}`}
                    </p>
                    {c.sourceType !== 'associate' && (
                      <p className="text-[9px] font-black text-emerald-500 uppercase">Reg: {getRegNo(c)}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/dashboard/admin/cases/${c.id}`} className="flex-1">
                      <button className="w-full py-2.5 bg-slate-900 text-white rounded-lg text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all">Review</button>
                    </Link>
                    {c.status === 'pending' && !c.clinicianId && (
                      <button onClick={() => { setSelectedCase(c); setShowAssignModal(true); }} className="px-4 py-2.5 bg-white border border-slate-200 text-slate-900 rounded-lg text-[9px] font-black uppercase tracking-widest active:scale-95 transition-all">Assign</button>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Desktop Table View */}
            <div className="hidden sm:block overflow-x-auto custom-scrollbar">
              <table className="w-full text-left border-collapse min-w-[800px]">
                <thead>
                  <tr className="bg-slate-900 dark:bg-slate-800 border-l-4 border-l-slate-900 dark:border-l-slate-800">
                    <th className="px-4 sm:px-6 py-5 text-[10px] font-black text-slate-300 uppercase tracking-widest">Patient Profile</th>
                    <th className="px-4 sm:px-6 py-5 text-[10px] font-black text-slate-300 uppercase tracking-widest">Provider Context</th>
                    <th className="px-4 sm:px-6 py-5 text-[10px] font-black text-slate-300 uppercase tracking-widest text-center">Status</th>
                    <th className="px-4 sm:px-6 py-5 text-[10px] font-black text-slate-300 uppercase tracking-widest text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                  <AnimatePresence mode="popLayout">
                    {paginatedCases.map((c) => (
                      <motion.tr 
                        key={c.id} 
                        initial={{ opacity: 0 }} 
                        animate={{ opacity: 1 }}
                        className={`group hover:bg-slate-50/50 dark:hover:bg-white/[0.02] transition-all relative border-l-4 ${
                          c.sourceType === 'associate' ? 'border-l-blue-500' :
                          c.sourceType === 'clinician_self' ? 'border-l-purple-500' :
                          'border-l-emerald-500'
                        }`}
                      >
                        <td className="px-6 py-5">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 group-hover:bg-slate-900 group-hover:text-white transition-all">
                              <User size={20} />
                            </div>
                            <div>
                              <p className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">{c.patientName}</p>
                              <p className="text-[10px] font-bold text-slate-400 mt-0.5 italic">ID: {c.id.slice(0, 8)}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-5">
                          <div className="space-y-1">
                            <p className="text-xs font-bold text-slate-600 dark:text-slate-400">
                              {c.sourceType === 'associate' ? `By ${c.associateName}` : `Clinician: Dr. ${c.clinicianName}`}
                            </p>
                            {c.sourceType !== 'associate' && (
                              <p className="text-[9px] font-black text-emerald-500 uppercase tracking-widest mt-0.5">
                                Reg ID: {getRegNo(c)}
                              </p>
                            )}
                          </div>
                        </td>
                        <td className="px-6 py-5 text-center">
                          <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border shadow-sm ${getStatusBadge(c.status)}`}>
                            {c.status.replace('_', ' ')}
                          </span>
                        </td>
                        <td className="px-6 py-5">
                          <div className="flex items-center justify-end gap-3">
                            {c.status === 'pending' && !c.clinicianId && (
                              <button 
                                onClick={() => { setSelectedCase(c); setShowAssignModal(true); }}
                                className="px-4 py-2 bg-slate-900 text-white rounded-lg text-[9px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-md shadow-slate-900/10"
                              >
                                Assign Specialist
                              </button>
                            )}
                            <Link href={`/dashboard/admin/cases/${c.id}`}>
                              <button className="w-9 h-9 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-lg flex items-center justify-center hover:bg-cyan-500 hover:text-white transition-all shadow-sm">
                                <Eye size={18} />
                              </button>
                            </Link>
                          </div>
                        </td>
                      </motion.tr>
                    ))}
                  </AnimatePresence>
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
            {paginatedCases.map((c) => (
              <motion.div 
                key={c.id} 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative group"
              >
                <Link href={`/dashboard/admin/cases/${c.id}`} className="block transition-transform active:scale-[0.98]">
                  <div className={`bg-white dark:bg-slate-900 rounded-lg p-4 sm:p-6 border border-slate-100 dark:border-white/5 shadow-sm relative overflow-hidden transition-all duration-300 hover:border-cyan-500/50 hover:shadow-xl hover:shadow-cyan-500/5 cursor-pointer border-l-4 ${
                    c.sourceType === 'associate' ? 'border-l-blue-500' :
                    c.sourceType === 'clinician_self' ? 'border-l-purple-500' :
                    'border-l-emerald-500'
                  }`}>
                    <div className="flex items-start justify-between gap-3 mb-6">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="w-10 h-10 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center text-slate-500 group-hover:bg-slate-900 group-hover:text-white transition-all duration-500">
                          <User size={20} />
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight leading-none truncate group-hover:text-cyan-600 transition-colors">{c.patientName}</h3>
                          <p className="text-[9px] font-bold text-slate-400 uppercase mt-1 italic tracking-widest">{c.id.slice(0, 8)}</p>
                        </div>
                      </div>
                      <span className={`shrink-0 px-2.5 py-1 rounded-md text-[8px] font-black uppercase tracking-widest border ${getStatusBadge(c.status)} shadow-sm`}>
                        {c.status.replace('_', ' ')}
                      </span>
                    </div>

                    <div className="space-y-4 mb-6">
                      <div className="flex items-center gap-3 text-slate-600 dark:text-slate-400">
                        <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg"><Stethoscope size={14} /></div>
                        <span className="text-xs font-bold uppercase tracking-tight">{c.treatmentType}</span>
                      </div>
                      <div className="flex items-center gap-3 text-slate-500">
                        <div className="p-2 bg-slate-50 dark:bg-slate-800 rounded-lg"><UserCheck size={14} /></div>
                        <div className="flex flex-col">
                          <p className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-tight truncate">
                            {c.sourceType === 'associate' ? `By ${c.associateName}` : `Dr. ${c.clinicianName || 'Self'}`}
                          </p>
                          {c.sourceType !== 'associate' && (
                            <p className="text-[8px] font-bold text-emerald-500 uppercase tracking-widest">
                              Reg: {getRegNo(c)}
                            </p>
                          )}
                        </div>
                      </div>
                    </div>

                    <div className="pt-4 border-t border-slate-50 dark:border-white/5 flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <div className={`w-2 h-2 rounded-full ${getTypeBadge(c.sourceType).style} shadow-sm`} />
                        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{getTypeBadge(c.sourceType).label}</span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px] font-black text-cyan-600 uppercase tracking-widest group-hover:text-cyan-500 transition-all">
                        Review Audit <ArrowUpRight size={14} className="group-hover:rotate-45 active:scale-90 transition-transform" />
                      </div>
                    </div>
                  </div>
                </Link>
              </motion.div>
            ))}
          </div>
        )}

        {/* 🔢 Pagination Footer (Attached) */}
        {totalPages > 1 && (
          <div className={`flex flex-col sm:flex-row items-center justify-between gap-6 bg-slate-900 dark:bg-slate-950 p-6 sm:p-6 ${
            viewMode === 'table' 
              ? 'rounded-b-2xl border-x border-b sm:border-l-4 sm:border-l-cyan-500' 
              : 'rounded-2xl border mt-8'
          } border-slate-800 shadow-xl backdrop-blur-md transition-all text-white mx-1 sm:mx-0`}>
            
            <div className="flex flex-col items-center sm:items-start gap-2 w-full sm:w-auto">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center sm:text-left">
                Showing <span className="text-white">{(currentPage - 1) * itemsPerPage + 1}</span> to <span className="text-white">{Math.min(currentPage * itemsPerPage, filteredCases.length)}</span> of <span className="text-white">{filteredCases.length}</span> entries
              </p>
              <div className="flex gap-1 justify-center sm:justify-start">
                {Array.from({ length: totalPages }).map((_, i) => (
                  <div key={i} className={`h-1 rounded-full transition-all ${currentPage === i + 1 ? 'w-4 bg-cyan-500' : 'w-1 bg-slate-700'}`} />
                ))}
              </div>
            </div>
            
            <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
              <button 
                onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                disabled={currentPage === 1}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-20 transition-all border border-white/5"
              >
                <ChevronLeft size={14} /> <span className="hidden xs:inline">Prev</span>
              </button>
              
              <div className="flex items-center gap-1 bg-white/5 px-4 py-3 rounded-xl border border-white/5 min-w-[60px] justify-center">
                <span className="text-[10px] font-black text-white">{currentPage}</span>
                <span className="text-[10px] font-black text-slate-600">/ {totalPages}</span>
              </div>
              
              <button 
                onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                disabled={currentPage === totalPages}
                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-3 bg-white/5 hover:bg-white/10 text-white rounded-xl text-[10px] font-black uppercase tracking-widest disabled:opacity-20 transition-all border border-white/5"
              >
                <span className="hidden xs:inline">Next</span> <ChevronRight size={14} />
              </button>
            </div>
          </div>
        )}

        {/* 🛑 Assign Modal */}
        {showAssignModal && (
          <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} onClick={() => setShowAssignModal(false)} className="absolute inset-0 bg-slate-950/95 backdrop-blur-xl" />
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-lg shadow-2xl overflow-hidden border border-slate-100 dark:border-white/5 flex flex-col max-h-[85vh]">
              <div className="p-5 flex-1 flex flex-col min-h-0">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-base font-black uppercase tracking-tight leading-none text-slate-900 dark:text-white">Assign Specialist</h3>
                    <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">Select clinician for this case</p>
                  </div>
                  <button onClick={() => setShowAssignModal(false)} className="w-7 h-7 flex items-center justify-center rounded-full bg-slate-50 dark:bg-slate-800 text-slate-400 hover:bg-slate-900 hover:text-white transition-all text-xs">✕</button>
                </div>

                {/* 💰 Consultation Fee Input - More Compact */}
                <div className="mb-4 p-3 bg-emerald-50 dark:bg-emerald-500/5 rounded-lg border border-emerald-100 dark:border-emerald-500/10">
                  <label className="text-[9px] font-black text-emerald-700 dark:text-emerald-400 uppercase tracking-widest mb-1.5 block">Consultation Fee (INR)</label>
                  <div className="relative">
                    <IndianRupee className="absolute left-2.5 top-1/2 -translate-y-1/2 text-emerald-600" size={14} />
                    <input 
                      type="number" 
                      placeholder="Amount"
                      max="100000"
                      value={assignmentFee}
                      onChange={(e) => setAssignmentFee(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 bg-white dark:bg-slate-900 border border-emerald-200 dark:border-emerald-500/20 rounded-md outline-none focus:ring-2 focus:ring-emerald-500/20 text-xs font-bold text-slate-900 dark:text-white transition-all"
                    />
                  </div>
                </div>

                <div className="overflow-y-auto no-scrollbar flex-1 min-h-0 mb-4">
                <div className="space-y-1.5 pb-2">
                  {clinicians.map((clinician) => (
                    <button 
                      key={clinician.id}
                      onClick={() => setSelectedClinician(clinician)}
                      className={`w-full p-2 rounded-lg text-left transition-all group flex items-center justify-between border ${
                        selectedClinician?.id === clinician.id 
                        ? 'bg-slate-900 text-white border-slate-900 shadow-lg' 
                        : 'bg-slate-50 dark:bg-slate-800/50 hover:bg-slate-100 border-transparent text-slate-900 dark:text-slate-300'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <div className={`w-7 h-7 rounded flex items-center justify-center transition-colors ${
                          selectedClinician?.id === clinician.id ? 'bg-white/10 text-white' : 'bg-white dark:bg-slate-700 text-slate-400'
                        }`}>
                          <Stethoscope size={14} />
                        </div>
                        <div>
                          <p className="text-[11px] font-black uppercase tracking-tight">{clinician.name}</p>
                          <p className={`text-[8px] font-bold uppercase ${
                            selectedClinician?.id === clinician.id ? 'text-slate-400' : 'text-slate-400 group-hover:text-slate-400/60'
                          }`}>{clinician.registrationNumber || 'No Registration'}</p>
                        </div>
                      </div>
                      {selectedClinician?.id === clinician.id && <CheckCircle2 size={14} className="text-emerald-500" />}
                    </button>
                  ))}
                </div>
              </div>

              {/* 🚀 Action Button */}
              <button 
                disabled={!selectedClinician || !assignmentFee}
                onClick={handleAssign}
                className={`w-full py-3 rounded-lg font-black text-[10px] uppercase tracking-[0.2em] transition-all flex items-center justify-center gap-2 ${
                  selectedClinician && assignmentFee 
                  ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-xl shadow-emerald-500/20' 
                  : 'bg-slate-100 dark:bg-slate-800 text-slate-400 cursor-not-allowed'
                }`}
              >
                <UserCheck size={16} /> Confirm Assignment
              </button>
            </div>
          </motion.div>
        </div>
        )}

        {/* 🔄 Sync Contacts Modal */}
        <AnimatePresence>
          {showSyncModal && (
            <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowSyncModal(false)} className="absolute inset-0 bg-slate-950/80 backdrop-blur-md" />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }} 
                animate={{ scale: 1, opacity: 1, y: 0 }} 
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="relative w-full max-w-sm bg-white dark:bg-slate-900 rounded-2xl shadow-2xl overflow-hidden border border-slate-100 dark:border-white/5 p-8"
              >
                <div className="flex flex-col items-center text-center">
                  <div className="w-16 h-16 bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 rounded-full flex items-center justify-center mb-6">
                    <Database size={32} />
                  </div>
                  <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight">Sync Contacts?</h3>
                  <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 font-medium leading-relaxed">
                    This will backfill missing associate contact information for all legacy case records in the database.
                  </p>
                  
                  <div className="grid grid-cols-2 gap-3 w-full mt-8">
                    <button 
                      onClick={() => setShowSyncModal(false)}
                      className="py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all"
                    >
                      Cancel
                    </button>
                    <button 
                      onClick={handleSyncContacts}
                      className="py-3 bg-indigo-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-indigo-700 shadow-lg shadow-indigo-500/20 transition-all"
                    >
                      Start Sync
                    </button>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}
