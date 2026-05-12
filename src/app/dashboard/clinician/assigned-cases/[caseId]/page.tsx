'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, getDoc, onSnapshot, updateDoc, serverTimestamp, query, collection, where, getDocs } from 'firebase/firestore';
import { Case } from '@/types';
import { 
  User, 
  Phone, 
  MapPin, 
  Stethoscope, 
  IndianRupee, 
  FileText, 
  Upload, 
  CheckCircle2, 
  Loader2,
  Clock,
  ExternalLink,
  ShieldCheck,
  Activity,
  MessageSquare,
  AlertCircle,
  Check
} from 'lucide-react';
import { format } from 'date-fns';
import toast from 'react-hot-toast';
import { TREATMENT_POINTS } from '@/types';
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
    lowerUrl.includes('/api/view-file') // Assume API served files might be PDFs if image load fails
  );
};

// ✅ Secure file opener - Robust version with data URL support
const openFile = (url: string) => {
  try {
    // For base64 data URLs — decode in browser RAM
    if (url.startsWith('data:')) {
      const [header, base64Data] = url.split(',');
      const mimeType = header.split(':')[1].split(';')[0];
      const byteChars = atob(base64Data);
      const byteArray = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) byteArray[i] = byteChars.charCodeAt(i);
      const blob = new Blob([byteArray], { type: mimeType });
      const blobUrl = URL.createObjectURL(blob);
      window.open(blobUrl, '_blank');
      return;
    }

    // For /api/view-file links
    if (url.includes('/api/view-file')) {
      window.open(url, '_blank');
      return;
    }

    // Fallback for legacy /uploads/ paths
    if (url.startsWith('/uploads/')) {
      const fileId = url.split('/').pop()?.split('.')[0] || 'legacy';
      window.open(`/api/view-file?id=${fileId}`, '_blank');
      return;
    }

    // Default: open directly
    window.open(url, '_blank', 'noopener,noreferrer');
  } catch (err) {
    console.error("File Open Error:", err);
    toast.error("Could not open file.");
  }
};

export default function CaseDetailPage() {
  const { caseId } = useParams();
  const router = useRouter();
  const { user, firebaseUser } = useAuth();
  const [caseData, setCaseData] = useState<Case | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [clinicianNotes, setClinicianNotes] = useState('');
  const [isCompleting, setIsCompleting] = useState(false);
  const [associatePhone, setAssociatePhone] = useState<string | null>(null);
  const [associatePhoneError, setAssociatePhoneError] = useState<string | null>(null);

  useEffect(() => {
    if (!caseId || !user?.uid) return;
    
    const unsubscribe = onSnapshot(doc(db, 'cases', caseId as string), async (snapshot) => {
      try {
        if (!snapshot.exists()) {
          toast.error('Case not found');
          router.push('/dashboard/clinician/assigned-cases');
          return;
        }

        const data = { id: snapshot.id, ...snapshot.data() } as Case;
        setCaseData(data);
        if (data.clinicianNotes) setClinicianNotes(data.clinicianNotes);
        
        // Fetch associate phone if it's a referred case (has associateId)
        // Use optional chaining and double check user existence
        if (data.associateId && user?.uid && data.associateId !== user.uid) {
          try {
            const associateDoc = await getDoc(doc(db, 'users', data.associateId));
            if (associateDoc.exists()) {
              const associateData = associateDoc.data();
              const phone = associateData.phone || associateData.mobile || associateData.phoneNumber;
              if (phone) {
                setAssociatePhone(phone);
                setAssociatePhoneError(null);
              } else {
                setAssociatePhoneError('Contact number missing in associate profile');
              }
            } else {
              setAssociatePhoneError(`Associate profile not found.`);
            }
          } catch (err: any) {
            console.warn('⚠️ Client-side Contact Lookup Failed:', err.message);
            // Fallback to whatever was saved in the case if possible
            if (!(data as any).associateMobile) {
              setAssociatePhoneError('Permission denied to read associate contact.');
            }
          }
        }
      } catch (err) {
        console.error('Snapshot processing error:', err);
      } finally {
        setLoading(false);
      }
    });

    return () => {
      if (unsubscribe) unsubscribe();
    };
  }, [caseId, user?.uid]); // Removed router to keep size stable and constant

  const handleFileUpload = async (file: File) => {
    if (!file) return;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      // 🛡️ SECURITY: Fetch token
      const token = await firebaseUser?.getIdToken();
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/upload', { 
        method: 'POST', 
        headers,
        body: formData 
      });
      if (!res.ok) throw new Error('Upload failed');
      const uploadData = await res.json();
      await updateDoc(doc(db, 'cases', caseId as string), {
        finalProof: [uploadData.url],
        updatedAt: serverTimestamp()
      });
      toast.success('Final Proof Uploaded');
    } catch {
      toast.error('Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleMarkCompleted = async () => {
    if (!caseData?.finalProof || caseData.finalProof.length === 0) {
      return toast.error('Bhai, please upload Final Proof first! 📄');
    }
    
    setIsCompleting(true);
    try {
      // 1. Core database update (Primary task)
      await updateDoc(doc(db, 'cases', caseId as string), {
        status: 'completed',
        clinicianNotes,
        updatedAt: serverTimestamp()
      });
      
      // 2. Background tasks: Notify admins (Async Parallel)
      const notifyAdmins = async () => {
        try {
          const adminQuery = query(collection(db, 'users'), where('role', '==', 'admin'));
          const adminSnapshot = await getDocs(adminQuery);
          
          const notificationPromises = adminSnapshot.docs.map(adminDoc => 
            sendSystemNotification(adminDoc.id, {
              title: 'Case Ready for Approval',
              message: `Dr. ${user?.name} completed treatment for ${caseData.patientName}.`,
              type: 'info',
              link: `/dashboard/admin/cases/${caseId}`
            })
          );
          
          await Promise.all(notificationPromises);
        } catch (e) {
          console.error("Background notification failed:", e);
        }
      };

      // Fire and forget (optional) or await it? Let's await for reliability but in parallel
      // To make it feel "Turbo", we can show success immediately after the updateDoc
      toast.success('Treatment Completed Successfully! 🎉');
      notifyAdmins(); // Start this in background
      
    } catch (error: any) {
      toast.error('Submission failed: ' + error.message);
    } finally {
      setIsCompleting(false);
    }
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="min-h-[60vh] flex flex-col items-center justify-center text-slate-400">
          <Loader2 className="animate-spin mb-4 text-cyan-600" size={48} />
          <p className="font-black uppercase tracking-[0.3em] text-[10px]">Syncing Workflow...</p>
        </div>
      </DashboardLayout>
    );
  }

  if (!caseData) return null;

  const points = TREATMENT_POINTS[caseData.treatmentType] || 0;

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto pb-8 px-2 sm:px-0">
        {/* Header */}
        <div className="mb-8 sm:mb-12 mt-2 sm:mt-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6">
            <div>
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <h1 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tighter uppercase break-words">
                  {caseData.patientName}
                </h1>
                {caseData.selfAssigned && (
                  <span className="px-3 py-1 bg-purple-600 text-white text-[8px] sm:text-[9px] font-black uppercase tracking-[0.2em] rounded shadow-lg">
                    Self
                  </span>
                )}
              </div>
              <p className="text-[9px] sm:text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-[0.2em] sm:tracking-[0.3em] flex items-center gap-2">
                <Clock size={14} className="text-cyan-500" /> Workflow #{caseData.id.slice(-8).toUpperCase()}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 sm:gap-4">
              <span className={`px-4 sm:px-5 py-2 sm:py-2.5 rounded-xl text-[9px] sm:text-[10px] font-black uppercase tracking-widest border ${
                caseData.status === 'approved' ? 'bg-emerald-500 text-white border-transparent' :
                caseData.status === 'completed' ? 'bg-indigo-500 text-white border-transparent' :
                'bg-blue-50 text-blue-600 border-blue-100'
              }`}>
                {caseData.status}
              </span>
              {caseData.status === 'completed' && (
                <div className="flex items-center gap-2 px-3 sm:px-4 py-2 sm:py-2.5 bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 rounded-xl text-[8px] sm:text-[9px] font-black text-amber-600 uppercase tracking-widest">
                  <AlertCircle size={14} /> Waiting Approval
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Consultation Fee - Sleek Premium Banner */}
        {caseData.consultationFee > 0 && (
          <div className="bg-gradient-to-r from-emerald-600 to-teal-600 p-5 sm:p-6 rounded-2xl text-white shadow-2xl mb-8 sm:mb-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6 relative overflow-hidden group">
            <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full blur-3xl -mr-24 -mt-24 group-hover:scale-110 transition-transform duration-700" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-black/5 rounded-full blur-2xl -ml-16 -mb-16" />
            
            <div className="flex items-center gap-4 sm:gap-6 relative z-10">
              <div className="w-12 h-12 sm:w-14 sm:h-14 bg-white/10 rounded-xl flex items-center justify-center backdrop-blur-md border border-white/20 shadow-inner">
                <IndianRupee className="w-6 h-6 sm:w-7 sm:h-7" strokeWidth={2.5} />
              </div>
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <p className="text-[8px] sm:text-[9px] font-black uppercase tracking-[0.2em] sm:tracking-[0.3em] text-emerald-100">Approved Consultation Fee</p>
                  <div className="w-1 h-1 bg-emerald-300 rounded-full animate-pulse" />
                </div>
                <div className="flex items-baseline gap-2">
                  <h4 className="text-3xl sm:text-4xl font-black tracking-tighter">₹{caseData.consultationFee}</h4>
                  <span className="text-[9px] sm:text-[10px] font-bold text-emerald-200 uppercase tracking-widest">Earned</span>
                </div>
              </div>
            </div>

            <div className="flex flex-row sm:flex-col items-center sm:items-end justify-between sm:justify-start w-full sm:w-auto gap-3 relative z-10 border-t sm:border-t-0 border-white/10 pt-4 sm:pt-0">
              <div className="px-3 sm:px-4 py-1.5 bg-black/20 rounded-lg border border-white/10 backdrop-blur-sm flex items-center gap-2">
                <ShieldCheck size={12} className="text-emerald-300" />
                <span className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest">Verified Reward</span>
              </div>
              <div className="text-[8px] sm:text-[9px] font-black uppercase tracking-widest opacity-60 flex items-center gap-2">
                <div className="hidden sm:block w-4 h-[1px] bg-white/30" /> Subject to Payout Cycle
              </div>
            </div>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column */}
          <div className="lg:col-span-8 space-y-8">
            {/* Patient & Treatment Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
              <div className="bg-white dark:bg-slate-900/40 p-5 sm:p-8 rounded-xl border border-slate-200 dark:border-white/5">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mb-8 flex items-center gap-2">
                  <User size={14} className="text-cyan-500" /> Patient Registry
                </h3>
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Mobile</span>
                    <span className="text-sm font-black text-slate-900 dark:text-white">{caseData.mobile}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Age / Gender</span>
                    <span className="text-sm font-black text-slate-900 dark:text-white uppercase">{caseData.age} Y • {caseData.gender}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Location</span>
                    <span className="text-sm font-black text-slate-900 dark:text-white uppercase">{caseData.clinicLocation}</span>
                  </div>
                </div>
              </div>

              <div className="bg-white dark:bg-slate-900/40 p-5 sm:p-8 rounded-xl border border-slate-200 dark:border-white/5">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.25em] mb-8 flex items-center gap-2">
                  <Stethoscope size={14} className="text-indigo-500" /> Treatment Ledger
                </h3>
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Procedure</span>
                    <span className="text-sm font-black text-indigo-600 dark:text-indigo-400 uppercase truncate max-w-[140px] text-right">{caseData.treatmentType}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Charge</span>
                    <span className="text-sm font-black text-slate-900 dark:text-white">₹{caseData.treatmentCharge}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Consultation Fee</span>
                    <span className="text-sm font-black text-emerald-500 text-right">₹{caseData.consultationFee || 0}</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Asset Verification */}
            <div className="bg-white dark:bg-slate-900/40 p-6 sm:p-10 rounded-xl border border-slate-200 dark:border-white/5">
              <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-[0.2em] mb-10 flex items-center gap-3">
                <ShieldCheck className="text-cyan-500" size={18} /> Asset Verification
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                {/* Initial Proof */}
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4">Initial Proof</p>
                  {caseData.initialProof && caseData.initialProof[0] ? (
                    isPdf(caseData.initialProof[0]) ? (
                      <a
                        onClick={(e) => { e.preventDefault(); openFile(caseData.initialProof![0]); }}
                        href="#"
                        className="aspect-video bg-rose-50 dark:bg-rose-500/10 border-2 border-rose-100 dark:border-rose-500/20 rounded-xl flex flex-col items-center justify-center gap-3 hover:border-rose-400 active:scale-95 transition-all group cursor-pointer"
                      >
                        <div className="w-14 h-14 bg-rose-100 dark:bg-rose-500/20 rounded-xl flex items-center justify-center text-rose-500 group-hover:scale-110 transition-transform">
                          <FileText size={32} />
                        </div>
                        <div className="text-center">
                          <p className="text-[10px] font-black text-rose-600 uppercase tracking-widest">PDF Document</p>
                          <p className="text-[9px] text-rose-400 uppercase tracking-widest mt-1 flex items-center gap-1 justify-center">
                            <ExternalLink size={10} /> Click to View
                          </p>
                        </div>
                      </a>
                    ) : (
                      <div className="aspect-video bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-white/5 overflow-hidden group relative flex items-center justify-center">
                        <img 
                          src={caseData.initialProof[0]} 
                          className="w-full h-full object-cover" 
                          alt="Initial Evidence" 
                          onError={(e) => {
                            // If image fails, show the PDF/File icon instead
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.parentElement?.classList.add('bg-slate-100');
                            const iconHtml = `
                              <div class="flex flex-col items-center gap-3 text-slate-400">
                                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><line x1="10" y1="9" x2="8" y2="9"></line></svg>
                                <span class="text-xs font-black uppercase tracking-[0.2em]">PDF Document</span>
                                <span class="text-[9px] font-bold opacity-60">CLICK TO VIEW</span>
                              </div>
                            `;
                            const container = e.currentTarget.parentElement;
                            if (container) container.innerHTML += iconHtml;
                          }}
                        />
                        <a href={caseData.initialProof[0]} target="_blank" rel="noopener noreferrer" className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity z-10">
                          <ExternalLink className="text-white" size={24} />
                        </a>
                      </div>
                    )
                  ) : (
                    <div className="aspect-video bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 flex items-center justify-center text-slate-300 font-black text-[10px] uppercase">
                      No Proof Uploaded
                    </div>
                  )}
                </div>

                {/* Final Proof */}
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mb-4">Final Proof</p>
                  {caseData.finalProof && caseData.finalProof[0] ? (
                    isPdf(caseData.finalProof[0]) ? (
                      <div className="aspect-video bg-blue-50 dark:bg-blue-500/10 border-2 border-blue-100 dark:border-blue-500/20 rounded-xl flex flex-col items-center justify-center gap-3 group relative overflow-hidden">
                        <a
                          onClick={(e) => { e.preventDefault(); openFile(caseData.finalProof![0]); }}
                          href="#"
                          className="flex flex-col items-center gap-3 hover:scale-105 active:scale-95 transition-transform cursor-pointer"
                        >
                          <div className="w-14 h-14 bg-blue-100 dark:bg-blue-500/20 rounded-xl flex items-center justify-center text-blue-500">
                            <FileText size={32} />
                          </div>
                          <div className="text-center">
                            <p className="text-[10px] font-black text-blue-600 uppercase tracking-widest">PDF Document</p>
                            <p className="text-[9px] text-blue-400 uppercase tracking-widest mt-1 flex items-center gap-1 justify-center">
                              <ExternalLink size={10} /> Click to View
                            </p>
                          </div>
                        </a>
                        {!(caseData.status === 'completed' || caseData.status === 'approved') && (
                          <label className="absolute bottom-3 right-3 px-3 py-1.5 bg-white/90 text-slate-700 rounded-lg text-[9px] font-black uppercase cursor-pointer hover:bg-cyan-500 hover:text-white transition-all shadow-sm">
                            Replace
                            <input type="file" className="hidden" onChange={(e) => e.target.files && handleFileUpload(e.target.files[0])} />
                          </label>
                        )}
                      </div>
                    ) : (
                      <div className="aspect-video bg-slate-50 dark:bg-slate-800 rounded-xl border border-emerald-500/20 overflow-hidden group relative flex items-center justify-center">
                        <img 
                          src={caseData.finalProof[0]} 
                          className="w-full h-full object-cover" 
                          alt="Final Outcome" 
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                            e.currentTarget.parentElement?.classList.add('bg-slate-100');
                            const iconHtml = `
                              <div class="flex flex-col items-center gap-3 text-cyan-500">
                                <svg xmlns="http://www.w3.org/2000/svg" width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><line x1="10" y1="9" x2="8" y2="9"></line></svg>
                                <span class="text-xs font-black uppercase tracking-[0.2em]">PDF Document</span>
                                <span class="text-[9px] font-bold opacity-60">CLICK TO VIEW</span>
                              </div>
                            `;
                            const container = e.currentTarget.parentElement;
                            if (container) container.innerHTML += iconHtml;
                          }}
                        />
                        {!(caseData.status === 'completed' || caseData.status === 'approved') && (
                          <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 flex items-center justify-center gap-3 transition-opacity z-10">
                            <label className="px-5 py-2.5 bg-white text-slate-900 rounded-lg text-[10px] font-black uppercase cursor-pointer hover:bg-cyan-500 hover:text-white transition-all">
                              Replace
                              <input type="file" className="hidden" onChange={(e) => e.target.files && handleFileUpload(e.target.files[0])} />
                            </label>
                          </div>
                        )}
                        <a href={caseData.finalProof[0]} target="_blank" rel="noopener noreferrer" className="absolute inset-0 bg-slate-900/40 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity z-10 pointer-events-none group-hover:pointer-events-auto">
                           {/* Empty clickable area if not replacing */}
                        </a>
                      </div>
                    )
                  ) : (
                    caseData.status === 'completed' || caseData.status === 'approved' ? (
                      <div className="aspect-video border-2 border-dashed border-slate-100 rounded-xl flex flex-col items-center justify-center gap-3 bg-slate-50/50">
                        <AlertCircle size={24} className="text-slate-300" />
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">No Final Proof Uploaded</span>
                      </div>
                    ) : (
                      <label className="aspect-video border-2 border-dashed border-slate-200 rounded-xl flex flex-col items-center justify-center gap-3 cursor-pointer group hover:border-cyan-500 transition-all">
                        {uploading
                          ? <Loader2 className="animate-spin text-cyan-600" size={32} />
                          : <>
                              <Upload size={24} className="text-slate-300 group-hover:text-cyan-500" />
                              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Upload Final</span>
                            </>
                        }
                        <input type="file" className="hidden" onChange={(e) => e.target.files && handleFileUpload(e.target.files[0])} />
                      </label>
                    )
                  )}
                </div>
              </div>
            </div>

            {/* Clinical Notes */}
            <div className="bg-white dark:bg-slate-900/40 p-6 rounded-xl border border-slate-200 dark:border-white/5">
              <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.25em] mb-6 flex items-center gap-3">
                <FileText size={16} className="text-cyan-500" /> Clinical Notes
              </h3>

              {caseData.notes && (
                <div className="mb-4">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                    {caseData.selfAssigned ? 'Initial Notes' : "Associate's Notes"}
                  </p>
                  <div className="p-4 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-white/5 rounded-xl text-sm font-medium text-slate-700 dark:text-slate-300">
                    {caseData.notes}
                  </div>
                </div>
              )}

              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                Your Resolution Notes
              </p>
              <textarea
                value={clinicianNotes}
                onChange={(e) => setClinicianNotes(e.target.value)}
                placeholder="Resolution details..."
                readOnly={caseData.status === 'approved'}
                className={`w-full h-20 px-6 py-4 border rounded-xl font-medium outline-none transition-all resize-none ${
                  caseData.status === 'completed' || caseData.status === 'approved'
                    ? 'bg-slate-100 dark:bg-white/5 border-transparent text-slate-500 cursor-not-allowed'
                    : 'bg-slate-50 dark:bg-slate-800/50 border-slate-200 dark:border-white/5 text-slate-900 dark:text-white focus:border-cyan-500'
                }`}
              />
              <button
                onClick={handleMarkCompleted}
                disabled={isCompleting || caseData.status === 'completed' || caseData.status === 'approved' || !clinicianNotes.trim()}
                className={`w-full mt-6 py-5 rounded-xl font-black text-xs uppercase tracking-[0.2em] shadow-xl transition-all ${
                  caseData.status === 'completed' || caseData.status === 'approved'
                    ? 'bg-emerald-500/20 text-emerald-600 border border-emerald-500/20 cursor-not-allowed shadow-none' 
                    : !clinicianNotes.trim()
                    ? 'bg-slate-100 dark:bg-slate-800 text-slate-400 dark:text-slate-500 cursor-not-allowed shadow-none border border-slate-200 dark:border-white/5'
                    : 'bg-slate-900 dark:bg-white text-white dark:text-slate-900 hover:scale-[1.01] active:scale-95 shadow-cyan-500/10'
                }`}
              >
                {isCompleting ? (
                  <div className="flex items-center justify-center gap-2">
                    <Loader2 className="animate-spin" size={16} /> Processing...
                  </div>
                ) : caseData.status === 'completed' || caseData.status === 'approved' ? (
                  <div className="flex items-center justify-center gap-2">
                    <CheckCircle2 size={16} /> Case Finalized
                  </div>
                ) : !clinicianNotes.trim() ? (
                  <div className="flex items-center justify-center gap-2">
                    <FileText size={16} /> Write Notes to Complete
                  </div>
                ) : (
                  <div className="flex items-center justify-center gap-2">
                    <Check size={16} /> Mark Treatment Completed
                  </div>
                )}
              </button>
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="lg:col-span-4 space-y-8">
            {/* Glassmorphism Reward Card */}
            <div className="relative overflow-hidden group">
              <div className="absolute -inset-1 bg-gradient-to-r from-cyan-500 to-purple-600 rounded-2xl blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200"></div>
              <div className="relative bg-white/40 dark:bg-slate-900/40 backdrop-blur-xl p-8 rounded-2xl border border-white/20 dark:border-white/10 flex flex-col gap-6">
                <div className="flex items-center justify-between">
                  <div className="p-3 bg-cyan-500/10 rounded-xl">
                    <Activity size={20} className="text-cyan-500" />
                  </div>
                  <span className="text-[10px] font-black text-cyan-500 uppercase tracking-widest bg-cyan-500/10 px-3 py-1 rounded-full border border-cyan-500/20">
                    {caseData.selfAssigned ? 'Self Case' : 'Associate Case'}
                  </span>
                </div>

                {!caseData.selfAssigned ? (
                  <>
                    <div>
                      <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Potential Reward</h3>
                      <div className="flex items-baseline gap-2">
                        <span className="text-4xl font-black text-slate-900 dark:text-white tracking-tighter">{points}</span>
                        <span className="text-xs font-bold text-slate-400 uppercase tracking-widest">Points</span>
                      </div>
                    </div>
                    <div className="h-px w-full bg-gradient-to-r from-transparent via-slate-200 dark:via-white/10 to-transparent"></div>
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Consultation Fee</span>
                      <span className="text-sm font-black text-slate-900 dark:text-white">₹{caseData.consultationFee || 0}</span>
                    </div>
                  </>
                ) : (
                  <div>
                    <h3 className="text-xs font-black text-slate-500 dark:text-slate-400 uppercase tracking-widest mb-1">Consultation Fee</h3>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-black text-slate-900 dark:text-white tracking-tighter">₹{caseData.consultationFee || 0}</span>
                      <span className="text-[10px] font-bold text-cyan-500 uppercase tracking-widest bg-cyan-500/10 px-2 py-0.5 rounded">Admin Managed</span>
                    </div>
                  </div>
                )}

                <p className="text-[11px] text-slate-500 dark:text-slate-400 font-medium leading-relaxed italic opacity-80">
                  {caseData.selfAssigned 
                    ? "Consultation fee will be finalized and updated after administrative review."
                    : "Points and fees will be credited to your dashboard upon case approval."}
                </p>
              </div>
            </div>

            {/* Timeline */}
            <div className="bg-white dark:bg-slate-900/40 p-8 rounded-xl border border-slate-200 dark:border-white/5">
              <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-[0.2em] mb-10 flex items-center gap-3">
                <Activity size={18} className="text-cyan-500" /> Timeline
              </h3>
              <div className="space-y-10 relative">
                <div className="absolute left-[17px] top-2 bottom-2 w-0.5 bg-slate-100 dark:bg-slate-800" />
                {[
                  { label: 'Submitted', date: caseData.createdAt, done: true },
                  { label: 'Assigned', date: caseData.updatedAt, done: !!caseData.clinicianId },
                  { label: 'Finished', date: caseData.status === 'completed' ? caseData.updatedAt : null, done: caseData.status === 'completed' || caseData.status === 'approved' },
                  { label: 'Approved', date: caseData.status === 'approved' ? caseData.updatedAt : null, done: caseData.status === 'approved' },
                ].map((step, i) => (
                  <div key={i} className="flex items-start gap-5 relative z-10">
                    <div className={`w-9 h-9 rounded-full flex items-center justify-center shadow-lg ${step.done ? 'bg-emerald-500 text-white' : 'bg-slate-100 text-slate-300'}`}>
                      {step.done ? <CheckCircle2 size={18} /> : <Clock size={18} />}
                    </div>
                    <div>
                      <p className={`text-[11px] font-black uppercase tracking-widest ${step.done ? 'text-slate-900 dark:text-white' : 'text-slate-400'}`}>
                        {step.label}
                      </p>
                      {step.date && (
                        <p className="text-[9px] font-bold text-slate-400 uppercase mt-1">
                          {format(step.date.toDate ? step.date.toDate() : new Date(), 'dd MMM, hh:mm a')}
                        </p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Operations */}
            <div className="bg-slate-900 p-8 rounded-xl text-white shadow-2xl">
              <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-8">Operations</h3>
              <div className="space-y-4">
                {!caseData.selfAssigned && (
                  <button 
                    onClick={async () => {
                      let finalPhone = associatePhone || (caseData as any).associateMobile;
                      
                      // If state is stale or missing, try a fresh direct fetch
                      if (!finalPhone) {
                        try {
                          const docSnap = await getDoc(doc(db, 'users', caseData.associateId!));
                          if (docSnap.exists()) {
                            const data = docSnap.data();
                            finalPhone = data.phone || data.mobile || data.phoneNumber;
                          }
                        } catch (e) {
                          console.error("Failed to fetch fresh associate contact", e);
                        }
                      }

                      if (!finalPhone) {
                        return toast.error(`Associate contact number not found (ID: ${caseData.associateId || 'MISSING'}). Please ask admin to update their profile.`);
                      }
                      
                      const msg = encodeURIComponent(`Hi, this is Dr. ${user?.name} regarding case ${caseData.patientName} (ID: ${caseData.id.slice(-8).toUpperCase()})`);
                      window.open(`https://wa.me/${finalPhone.replace(/\D/g, '')}?text=${msg}`, '_blank');
                    }}
                    className="w-full py-4 bg-white/5 border border-white/5 rounded-xl flex items-center justify-between px-6 hover:bg-white/10 transition-all text-[10px] font-black uppercase tracking-widest group"
                  >
                    <span>Contact Associate</span>
                    <MessageSquare size={16} className="text-cyan-500 group-hover:scale-125 transition-transform" />
                  </button>
                )}
              </div>
            </div>

          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
