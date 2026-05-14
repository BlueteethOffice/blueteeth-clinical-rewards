'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { db, auth } from '@/lib/firebase';
import { doc, onSnapshot, serverTimestamp, getDoc } from 'firebase/firestore';
import { Case, User as AppUser, CaseStatus, CaseSourceType } from '@/types';
import { 
  ArrowLeft, 
  User, 
  Phone, 
  Stethoscope, 
  MapPin, 
  Calendar, 
  FileText, 
  Clock, 
  CheckCircle2, 
  XCircle,
  AlertCircle,
  Download,
  ExternalLink,
  ShieldCheck,
  ClipboardList,
  Copy,
  IndianRupee,
  Activity,
  Check,
  Building2,
  MoreVertical,
  Upload,
  MessageSquare,
  History,
  Trash2,
  BadgeCheck,
  Eye,
  Loader2
} from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';
import { sendSystemNotification } from '@/lib/notifications';
 
// ✅ Robust PDF detection — handles API links, Data URLs, and direct paths
const isPdf = (url: string): boolean => {
  if (!url) return false;
  const lowerUrl = url.toLowerCase();
  return (
    lowerUrl.includes('.pdf') || 
    lowerUrl.includes('%2fpdf') || 
    lowerUrl.includes('/pdf') || 
    lowerUrl.startsWith('data:application/pdf') ||
    lowerUrl.includes('/api/view-file') ||
    lowerUrl.includes('/raw/upload/') || // Cloudinary raw = PDF in our system
    lowerUrl.includes('/api/view-pdf')
  );
};

export default function AdminCaseDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [associate, setAssociate] = useState<AppUser | null>(null);
  const [clinician, setClinician] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [feeInput, setFeeInput] = useState<string>('0');
  const [pdfViewer, setPdfViewer] = useState<string | null>(null);
  const [viewerMimeType, setViewerMimeType] = useState<string>('application/pdf');

  useEffect(() => {
    if (!id) return;

    const unsubscribe = onSnapshot(doc(db, 'cases', id as string), async (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        
        // Infer source type if missing
        let sourceType = data.sourceType;
        if (!sourceType) {
          if (data.associateId && data.clinicianId) sourceType = 'assigned';
          else if (!data.associateId && data.clinicianId) sourceType = 'clinician_self';
          else sourceType = 'associate';
        }

        const newCaseData = { id: snapshot.id, ...data, sourceType } as Case;
        setCaseData(newCaseData);
        setFeeInput(data.consultationFee?.toString() || '0');

        // Fetch associate details if available
        if (data.associateId) {
          const assocSnap = await getDoc(doc(db, 'users', data.associateId));
          if (assocSnap.exists()) setAssociate(assocSnap.data() as AppUser);
        }

        // Fetch clinician details if available
        if (data.clinicianId) {
          const clinSnap = await getDoc(doc(db, 'users', data.clinicianId));
          if (clinSnap.exists()) setClinician(clinSnap.data() as AppUser);
        }
      } else {
        toast.error('Case not found');
        router.push('/dashboard/admin/cases');
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [id, router]);

  const handleStatusUpdate = async (newStatus: CaseStatus) => {
    if (!id) return;

    if (newStatus === 'approved' && caseData?.sourceType === 'clinician_self' && (!feeInput || isNaN(Number(feeInput)))) {
      return toast.error('Please enter a valid consultation fee');
    }

    try {
      const token = await auth.currentUser?.getIdToken();
      const res = await fetch('/api/cases/update', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ 
          caseId: id, 
          status: newStatus,
          consultationFee: Number(feeInput)
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Update failed');

      // Notify Associate
      if (caseData?.associateId) {
        await sendSystemNotification(caseData.associateId, {
          title: `Case ${newStatus.toUpperCase()}`,
          message: `The case for ${caseData.patientName} has been ${newStatus}.`,
          type: newStatus === 'approved' ? 'success' : newStatus === 'rejected' ? 'error' : 'info',
          link: `/dashboard/associate/my-cases/${id}`
        });
      }

      // Notify Clinician
      if (caseData?.clinicianId) {
        await sendSystemNotification(caseData.clinicianId, {
          title: `Case ${newStatus.toUpperCase()}`,
          message: `The case for ${caseData.patientName} has been ${newStatus}.`,
          type: newStatus === 'approved' ? 'success' : newStatus === 'rejected' ? 'error' : 'info',
          link: `/dashboard/clinician/assigned-cases/${id}`
        });
      }

      toast.success(`Case ${newStatus}`);
    } catch (error: any) {
      toast.error(error.message || 'Update failed');
    }
  };

  const copyCaseId = () => {
    navigator.clipboard.writeText(id as string);
    toast.success('Full ID Copied');
  };

  const openProof = (url: string) => {
    if (!url) return;
    try {
      // 1. For base64 data URLs — show in built-in viewer
      if (url.startsWith('data:')) {
        const [header, base64Data] = url.split(',');
        const mimeType = header.split(':')[1].split(';')[0];
        const byteChars = atob(base64Data);
        const byteArray = new Uint8Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i++) byteArray[i] = byteChars.charCodeAt(i);
        const blobUrl = URL.createObjectURL(new Blob([byteArray], { type: mimeType }));
        setViewerMimeType(mimeType);
        setPdfViewer(blobUrl);
        return;
      }

      // 2. Determine if it's a PDF or Image
      const isPdfFile = isPdf(url);
      if (isPdfFile) {
        window.open(`/api/view-pdf?url=${encodeURIComponent(url)}`, '_blank');
      } else {
        // Direct opening for images to ensure speed and bypass hangs
        const newTab = window.open();
        if (newTab) {
          newTab.location.href = url;
        } else {
          // Fallback if popup blocked
          window.open(url, '_blank');
        }
      }
    } catch (e) {
      console.error("Open proof failed:", e);
      window.open(url, '_blank');
    }
  };

  if (loading && !caseData) {
    return (
      <DashboardLayout>
        <div className="max-w-7xl mx-auto pb-10 px-1 sm:px-4 animate-pulse">
          <div className="flex justify-between items-center mb-10">
            <div className="space-y-3">
              <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800 rounded-lg" />
              <div className="h-4 w-32 bg-slate-100 dark:bg-slate-900 rounded" />
            </div>
            <div className="h-12 w-32 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            <div className="lg:col-span-8 space-y-6">
              <div className="h-64 bg-slate-100 dark:bg-slate-900 rounded-2xl" />
              <div className="grid grid-cols-2 gap-6">
                <div className="h-32 bg-slate-100 dark:bg-slate-900 rounded-2xl" />
                <div className="h-32 bg-slate-100 dark:bg-slate-900 rounded-2xl" />
              </div>
            </div>
            <div className="lg:col-span-4 h-96 bg-slate-100 dark:bg-slate-900 rounded-2xl" />
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!caseData) return null;

  // Timeline logic based on Case Source
  const getTimelineSteps = () => {
    if (caseData.sourceType === 'clinician_self') {
      return [
        { label: 'Self Submitted', key: 'pending', icon: User, color: 'purple' },
        { label: 'Proofs Uploaded', key: 'completed', icon: ShieldCheck, color: 'indigo' },
        { label: 'Waiting Approval', key: 'completed', icon: Clock, color: 'amber' },
        { label: 'Approved', key: 'approved', icon: CheckCircle2, color: 'emerald' },
      ];
    }
    
    return [
      { label: 'Associate Submitted', key: 'pending', icon: ClipboardList, color: 'blue' },
      { label: 'Clinician Assigned', key: 'assigned', icon: Stethoscope, color: 'emerald' },
      { label: 'Treatment Completed', key: 'treatment_completed', icon: Activity, color: 'indigo' },
      { label: 'Final Approval', key: 'approved', icon: BadgeCheck, color: 'cyan' },
    ];
  };

  const statusMap: Record<string, number> = { 
    pending: 1, 
    assigned: 2, 
    treatment_completed: 3, 
    completed: 3.5, // for clinician self cases
    approved: 4, 
    rejected: 0 
  };

  const timelineSteps = getTimelineSteps();
  const currentStep = statusMap[caseData.status] || 1;

  return (
    <>
      <DashboardLayout>
        <div className="max-w-7xl mx-auto pb-10 px-1 sm:px-4">
          {/* Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 mb-6 sm:mb-10 px-1 sm:px-0">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center gap-3">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase leading-none">Case Audit</h1>
                <span className={`px-2 py-0.5 rounded text-[8px] sm:text-[9px] font-black uppercase tracking-widest border shadow-sm ${
                  caseData.status === 'approved' ? 'bg-emerald-500 text-white border-emerald-600' :
                  caseData.status === 'rejected' ? 'bg-red-500 text-white border-red-600' :
                  'bg-amber-100 text-amber-700 border-amber-200'
                }`}>
                  {caseData.status.replace('_', ' ')}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest truncate max-w-[200px]">ID: {id}</span>
                <button onClick={copyCaseId} className="text-cyan-600 active:scale-90 transition-transform"><Copy size={12} /></button>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* ✅ Fee Input for Clinician Self-Cases */}
              {caseData.sourceType === 'clinician_self' && (caseData.status !== 'approved' && caseData.status !== 'rejected') && (
                <div className="flex flex-col gap-1 w-full sm:w-40 mb-2 sm:mb-0">
                  <label className="text-[8px] font-black text-slate-400 uppercase tracking-widest ml-1">Consultation Fee</label>
                  <div className="relative">
                    <IndianRupee size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-emerald-600" />
                    <input 
                      type="number"
                      value={feeInput}
                      onChange={(e) => setFeeInput(e.target.value)}
                      placeholder="0"
                      className="w-full pl-8 pr-3 py-2.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-white/5 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500/20 text-xs font-bold text-slate-900 dark:text-white transition-all shadow-sm"
                    />
                  </div>
                </div>
              )}

              {(caseData.status !== 'approved' && caseData.status !== 'rejected') && (
                <>
                  {/* ✅ Enforce Rule: Associate cases must be 'completed' or 'treatment_completed' before approval */}
                  {/* ✅ Clinician self-cases can be approved directly */}
                  {(() => {
                    const isAssociateCase = caseData.sourceType === 'associate' || caseData.sourceType === 'assigned';
                    const isTreatmentDone = caseData.status === 'treatment_completed' || caseData.status === 'completed';
                    const canApprove = caseData.sourceType === 'clinician_self' || isTreatmentDone;

                    return (
                      <button 
                        onClick={() => handleStatusUpdate('approved')}
                        disabled={!canApprove}
                        className={`flex-1 sm:flex-none px-6 py-3 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2 ${
                          canApprove 
                            ? 'bg-emerald-500 text-white hover:bg-emerald-600 shadow-emerald-500/10' 
                            : 'bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200 shadow-none'
                        }`}
                      >
                        <CheckCircle2 size={16} /> 
                        <span className="sm:inline">
                          {canApprove ? 'Approve' : 'Waiting for Clinician'}
                        </span>
                      </button>
                    );
                  })()}
                  
                  <button 
                    onClick={() => handleStatusUpdate('rejected')}
                    className="flex-1 sm:flex-none px-6 py-3 bg-red-50 text-red-600 border border-red-100 rounded-xl font-bold text-[10px] uppercase tracking-widest hover:bg-red-600 hover:text-white transition-all flex items-center justify-center gap-2"
                  >
                    <Trash2 size={16} /> <span className="sm:inline">Reject</span>
                  </button>
                </>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left Column - Details */}
            <div className="lg:col-span-8 space-y-6">
              
              {/* Patient & Treatment Card */}
              <div className="glass-card p-3 sm:p-6 rounded-xl sm:rounded-lg bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 shadow-sm relative overflow-hidden mx-0 sm:mx-0">
                <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 blur-[40px] -mr-16 -mt-16" />
                
                <div className="relative z-10 flex flex-col lg:flex-row justify-between gap-8">
                  <div className="flex-1">
                    <div className="flex items-center gap-4 mb-6">
                      <div className="w-12 h-12 bg-slate-100 dark:bg-slate-800 rounded-xl flex items-center justify-center text-slate-400">
                        <User size={24} />
                      </div>
                      <div>
                        <h2 className="text-xl font-black text-slate-900 dark:text-white tracking-tight uppercase leading-tight">{caseData.patientName}</h2>
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 mt-1.5 text-slate-500 font-bold uppercase text-[9px] tracking-widest">
                          <span className="flex items-center gap-1"><Calendar size={12} className="text-cyan-500" /> {caseData.age || 'N/A'} YRS</span>
                          <span className="hidden xs:inline w-1 h-1 bg-slate-200 rounded-full" />
                          <span className="flex items-center gap-1"><Phone size={12} className="text-emerald-500" /> {caseData.mobile}</span>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 pt-6 border-t border-slate-50 dark:border-white/5">
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Location</label>
                        <p className="text-xs font-bold text-slate-800 dark:text-white flex items-center gap-2 uppercase"><MapPin size={14} className="text-rose-500" /> {caseData.clinicLocation}</p>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Consultation</label>
                        <p className="text-xs font-bold text-emerald-600 flex items-center gap-1 uppercase"><IndianRupee size={14} /> {caseData.consultationFee || 0}</p>
                      </div>
                    </div>
                  </div>

                  <div className="w-full lg:w-56 bg-slate-900 dark:bg-slate-800 p-6 rounded-2xl text-white flex flex-col items-center justify-center text-center shadow-xl relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/10 blur-[30px] -mr-12 -mt-12" />
                    <Stethoscope size={24} className="text-cyan-400 mb-3" />
                    <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest mb-1">Diagnosis</p>
                    <h4 className="text-sm font-black tracking-tight uppercase leading-tight mb-3">{caseData.treatmentType}</h4>
                    <div className="px-4 py-1.5 bg-cyan-500 text-slate-900 rounded-full text-[9px] font-black uppercase tracking-widest">
                      {caseData.points} Points
                    </div>
                  </div>
                </div>
              </div>

              {/* Provider Information */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mx-0 sm:mx-0">
                <div className="glass-card p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 shadow-sm">
                  <h3 className="text-[9px] font-black text-slate-900 dark:text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                    <User size={14} className="text-blue-500" /> Submission Source
                  </h3>
                  {associate ? (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center text-slate-400 overflow-hidden">
                        {associate.photoURL ? <img src={associate.photoURL} className="w-full h-full object-cover" /> : <User size={20} />}
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-900 dark:text-white uppercase">{associate.name}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase">
                          {caseData.sourceType === 'clinician_self' ? 'Clinician Self-Submission' : 'Associate Partner'}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-purple-50 dark:bg-purple-500/10 text-purple-600 rounded-lg flex items-center justify-center">
                        <Stethoscope size={20} />
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-900 dark:text-white uppercase">{caseData.clinicianName || 'Self'}</p>
                        <p className="text-[9px] font-bold text-slate-400 uppercase">Clinician Self-Entry</p>
                      </div>
                    </div>
                  )}
                </div>

                <div className="glass-card p-5 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 shadow-sm">
                  <h3 className="text-[9px] font-black text-slate-900 dark:text-white uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Stethoscope size={14} className="text-emerald-500" /> Clinical Provider
                  </h3>
                  {clinician ? (
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center text-slate-400 overflow-hidden">
                        {clinician.photoURL ? <img src={clinician.photoURL} className="w-full h-full object-cover" /> : <User size={20} />}
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-tight">{clinician.name}</p>
                        <p className="text-[9px] font-bold text-emerald-500 uppercase tracking-widest">Reg: {clinician.registrationNumber || 'N/A'}</p>
                      </div>
                    </div>
                  ) : (
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest py-2">No Clinician Assigned</p>
                  )}
                </div>
              </div>

              {/* Proof Gallery */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 sm:gap-6 mx-0 sm:mx-0">
                <div className="glass-card p-5 rounded-xl shadow-sm bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5">
                  <h3 className="text-[9px] font-black text-slate-900 dark:text-white uppercase tracking-widest mb-5 flex items-center gap-2">
                    <FileText size={14} className="text-cyan-600" /> Pre-Treatment Evidence
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {caseData.initialProof?.map((url, i) => (
                      <div key={i} onClick={() => openProof(url)} className="relative group aspect-square rounded-lg overflow-hidden border border-slate-100 dark:border-white/5 bg-slate-50 cursor-pointer shadow-sm flex items-center justify-center">
                        <img 
                          src={url.startsWith('data:') ? url : `/api/view-file?id=${url.split('/').pop()?.split('.')[0] || 'file'}`} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300" 
                          alt="Initial Evidence" 
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.parentElement?.classList.add('bg-slate-100');
                            const iconHtml = `
                              <div class="flex flex-col items-center gap-2 text-slate-400">
                                <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><line x1="10" y1="9" x2="8" y2="9"></line></svg>
                                <span class="text-[9px] font-black uppercase tracking-[0.2em]">Clinical Asset</span>
                              </div>
                            `;
                            const container = e.currentTarget.parentElement;
                            if (container) container.innerHTML += iconHtml;
                          }}
                        />
                        <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center text-white">
                          <Eye size={16} />
                        </div>
                      </div>
                    ))}
                    {(!caseData.initialProof || caseData.initialProof.length === 0) && (
                      <div className="col-span-2 py-8 text-center border border-dashed border-slate-200 dark:border-white/5 rounded-lg text-slate-400 text-[9px] font-bold uppercase">No Evidence</div>
                    )}
                  </div>
                </div>

                <div className="glass-card p-5 rounded-xl shadow-sm bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5">
                  <h3 className="text-[9px] font-black text-slate-900 dark:text-white uppercase tracking-widest mb-5 flex items-center gap-2">
                    <BadgeCheck size={14} className="text-emerald-600" /> Clinical Outcome
                  </h3>
                  <div className="grid grid-cols-2 gap-3">
                    {caseData.finalProof?.map((url, i) => (
                      <div key={i} onClick={() => openProof(url)} className="relative group aspect-square rounded-lg overflow-hidden border border-slate-100 dark:border-white/5 bg-slate-50 cursor-pointer shadow-sm flex items-center justify-center">
                        <img 
                          src={url.startsWith('data:') ? url : `/api/view-file?id=${url.split('/').pop()?.split('.')[0] || 'file'}`} 
                          className="w-full h-full object-cover group-hover:scale-105 transition-all duration-300" 
                          alt="Outcome" 
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.parentElement?.classList.add('bg-slate-100');
                            const iconHtml = `
                              <div class="flex flex-col items-center gap-2 text-emerald-500">
                                <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><line x1="10" y1="9" x2="8" y2="9"></line></svg>
                                <span class="text-[9px] font-black uppercase tracking-[0.2em]">Outcome Proof</span>
                              </div>
                            `;
                            const container = e.currentTarget.parentElement;
                            if (container) container.innerHTML += iconHtml;
                          }}
                        />
                        <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center text-white">
                          <Eye size={16} />
                        </div>
                      </div>
                    ))}
                    {(!caseData.finalProof || caseData.finalProof.length === 0) && (
                      <div className="col-span-2 py-8 text-center border border-dashed border-slate-200 dark:border-white/5 rounded-lg text-slate-400 text-[9px] font-bold uppercase tracking-widest">Waiting for Outcome</div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column - Status & Timeline */}
            <div className="lg:col-span-4 space-y-6 mx-0 sm:mx-0">
              {/* Timeline Card */}
              <div className="glass-card p-6 rounded-xl bg-white dark:bg-slate-900 border border-slate-100 dark:border-white/5 shadow-sm">
                <h3 className="text-[9px] font-black text-slate-900 dark:text-white uppercase tracking-widest mb-10 flex items-center gap-2">
                  <Activity size={14} className="text-cyan-600" /> Progression Log
                </h3>
                
                <div className="relative space-y-10">
                  <div className="absolute left-[11px] top-2 bottom-2 w-[1.5px] bg-slate-100 dark:bg-white/5" />
                  
                  {timelineSteps.map((step, i) => {
                    const isDone = statusMap[caseData.status] >= statusMap[step.key];
                    const isActive = caseData.status === step.key;
                    
                    return (
                      <div key={i} className="relative flex items-center gap-6 group">
                        <div className={`z-10 w-6 h-6 rounded-full flex items-center justify-center transition-all
                          ${isDone ? 'bg-emerald-500 text-white' : isActive ? 'bg-cyan-600 text-white' : 'bg-slate-50 dark:bg-slate-800 text-slate-200 border border-slate-100 dark:border-white/5'}
                        `}>
                          {isDone ? <Check size={14} strokeWidth={3} /> : <step.icon size={12} />}
                        </div>
                        <div className="flex-1">
                          <p className={`text-[10px] font-black uppercase tracking-tight ${isDone ? 'text-slate-900 dark:text-white' : isActive ? 'text-cyan-600' : 'text-slate-300 dark:text-slate-700'}`}>
                            {step.label}
                          </p>
                          {isActive && (
                            <div className="inline-flex items-center gap-1 px-1.5 py-0.5 bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 text-[8px] font-black uppercase mt-1 rounded">Live</div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Notes Card */}
              <div className="glass-card p-6 rounded-xl bg-slate-900 text-white shadow-xl relative overflow-hidden space-y-6">
                <div>
                  <h3 className="text-[8px] font-black text-cyan-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <FileText size={14} /> {caseData.sourceType === 'clinician_self' ? 'Initial Notes' : "Associate's Notes"}
                  </h3>
                  <p className="text-xs font-medium leading-relaxed text-slate-300 italic">
                    {caseData.notes ? `"${caseData.notes}"` : 'No initial notes provided.'}
                  </p>
                </div>
                
                {caseData.clinicianNotes && (
                  <div className="pt-4 border-t border-white/5">
                    <h3 className="text-[8px] font-black text-emerald-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <Stethoscope size={14} /> Clinician Resolution
                    </h3>
                    <p className="text-xs font-medium leading-relaxed text-slate-300 italic">
                      "{caseData.clinicianNotes}"
                    </p>
                  </div>
                )}
                <div className="mt-6 pt-6 border-t border-white/5 flex items-center gap-2">
                   <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest">Updated:</p>
                   <p className="text-[8px] font-bold text-white uppercase">{caseData.updatedAt ? format(caseData.updatedAt.toDate(), 'dd MMM yyyy') : 'Recently'}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </DashboardLayout>

      {/* PDF Viewer */}
      <AnimatePresence>
        {pdfViewer && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[200] flex flex-col bg-slate-950/98">
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 border-b border-white/5">
              <div className="flex items-center gap-3">
                <FileText size={20} className="text-cyan-500" />
                <h3 className="text-xs font-black text-white uppercase tracking-widest">Document Viewer</h3>
              </div>
              <button onClick={() => setPdfViewer(null)} className="p-2.5 bg-white/5 hover:bg-red-500 text-white rounded-lg transition-all">✕</button>
            </div>
            <div className="flex-1 flex items-center justify-center p-6">
              {viewerMimeType.startsWith('image/') ? (
                <img src={pdfViewer} className="max-w-full max-h-full object-contain" />
              ) : (
                <iframe src={pdfViewer} className="w-full h-full border-none rounded-lg bg-white" />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
