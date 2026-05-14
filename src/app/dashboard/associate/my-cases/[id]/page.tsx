'use client';

import { useEffect, useState, useRef } from 'react';
import { useParams, useRouter } from 'next/navigation';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, onSnapshot, getDoc, updateDoc } from 'firebase/firestore';
import { Case } from '@/types';
import { 
  User, 
  Phone, 
  Stethoscope, 
  MapPin, 
  Calendar, 
  FileText, 
  Clock, 
  CheckCircle2, 
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
  Upload,
  Loader2,
  RefreshCw,
  ImagePlus
} from 'lucide-react';
import { format } from 'date-fns';
import { formatName } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import toast from 'react-hot-toast';

export default function CaseDetailsPage() {
  const { id } = useParams();
  const router = useRouter();
  const { firebaseUser } = useAuth();

  const [caseData, setCaseData] = useState<Case | null>(null);
  const [clinicianProfile, setClinicianProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [pdfViewer, setPdfViewer] = useState<string | null>(null);
  const [currentOriginalUrl, setCurrentOriginalUrl] = useState<string | null>(null);
  const [viewerMimeType, setViewerMimeType] = useState<string>('application/pdf');
  const [uploading, setUploading] = useState(false);
  const reuploadRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!id) return;

    const unsubscribe = onSnapshot(doc(db, 'cases', id as string), async (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        const newCaseData = { id: snapshot.id, ...data } as Case;
        
        // Instant visual feedback when proofs arrive
        if (caseData && !caseData.initialProof?.length && newCaseData.initialProof?.length) {
          toast.success('Evidence synced successfully!', { icon: '🖼️' });
        }
        
        setCaseData(newCaseData);

        // 🛡️ FETCH CLINICIAN PROFILE (REAL-TIME)
        if (newCaseData.clinicianId) {
          try {
            const clinSnap = await getDoc(doc(db, 'users', newCaseData.clinicianId));
            if (clinSnap.exists()) {
              setClinicianProfile(clinSnap.data());
            }
          } catch (e) {
            console.error("Failed to fetch clinician profile:", e);
          }
        }
      } else {
        toast.error('Case not found');
        router.push('/dashboard/associate/my-cases');
      }
      setLoading(false);
    }, (error) => {
      if (error.code === 'permission-denied') {
        console.log("[CASE] Case listener detached (Auth required)");
      } else {
        console.error("[CASE] Case sync error:", error);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [id]);

  // ✅ RE-UPLOAD: Allows associates to fix cases where background sync failed
  const handleReupload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !id || !firebaseUser) return;

    // Validate file type
    const ext = file.name.toLowerCase().split('.').pop() || '';
    const allowedExts = ['jpg', 'jpeg', 'png', 'webp', 'heic', 'heif', 'gif', 'bmp', 'pdf'];
    if (!allowedExts.includes(ext)) {
      toast.error('Only JPG, PNG, WEBP, HEIC, or PDF files are allowed');
      return;
    }

    setUploading(true);
    const loadingToast = toast.loading('Uploading evidence...');
    try {
      const token = await firebaseUser.getIdToken();
      const formData = new FormData();
      formData.append('file', file);
      formData.append('caseId', id as string);

      const res = await fetch('/api/upload', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}` },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.url) throw new Error(data.error || 'Upload failed');

      // Save to Firestore
      await updateDoc(doc(db, 'cases', id as string), {
        initialProof: [data.url],
      });

      toast.success('Evidence uploaded successfully!', { id: loadingToast });
    } catch (err: any) {
      console.error('Re-upload failed:', err);
      toast.error(err.message || 'Upload failed. Please try again.', { id: loadingToast });
    } finally {
      setUploading(false);
      // Reset the input so the same file can be re-selected if needed
      if (reuploadRef.current) reuploadRef.current.value = '';
    }
  };

  const copyCaseId = () => {
    const shortId = `BTC-${(id as string).slice(-6).toUpperCase()}`;
    navigator.clipboard.writeText(shortId);
    toast.success('Case ID copied!');
  };

  // ✅ FIXED: Direct URL opening avoids popup blocker.
  // /api/view-file accepts the session cookie, so no Bearer token fetch needed.
  // window.open() after any 'await' is always blocked by browsers.
  // ✅ ROBUST FILE OPENER: Strictly prevents new tabs for PDFs
  const isPDF = (url: string) => {
    const lower = url.toLowerCase();
    return lower.includes('.pdf') || 
           lower.startsWith('data:application/pdf') || 
           lower.includes('/api/view-pdf') ||
           lower.includes('/raw/upload/');
  };

  const openProof = (url: string) => {
    if (!url) return;
    try {
      const isPdfFile = isPDF(url);
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

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-amber-100 text-amber-600 border-amber-200',
      assigned: 'bg-blue-100 text-blue-600 border-blue-200',
      completed: 'bg-indigo-100 text-indigo-600 border-indigo-200',
      approved: 'bg-emerald-100 text-emerald-600 border-emerald-200',
      rejected: 'bg-red-100 text-red-600 border-red-200',
    };
    return (
      <span className={`px-4 py-1.5 rounded-full border text-[10px] font-black uppercase tracking-widest ${styles[status] || 'bg-slate-100 text-slate-600'}`}>
        {status}
      </span>
    );
  };


  const ProofThumbnail = ({ url }: { url: string }) => {
    const [hasError, setHasError] = useState(false);
    const isApiFile = url.includes('/api/view-file') || url.includes('/api/proof-proxy');
    const isImageUrl = !isApiFile && !isPDF(url) && (
      url.startsWith('data:image') ||
      /\.(jpg|jpeg|png|gif|webp|heic|heif)(\?|$)/i.test(url) ||
      url.includes('res.cloudinary.com/image/') ||
      url.includes('firebasestorage.googleapis.com') ||
      url.includes('cloudinary.com') // Fallback for any cloudinary link not explicitly raw
    );

    // API-served files and PDFs always show the document icon
    if (isPDF(url) || isApiFile || hasError) {
      return (
        <div className="w-full h-full flex flex-col items-center justify-center bg-red-50/50 text-red-600 p-4 transition-transform group-hover:scale-105">
          <FileText size={36} strokeWidth={2} />
          <span className="text-[9px] font-black mt-2 uppercase tracking-widest text-center text-red-500">
            View Document
          </span>
        </div>
      );
    }

    // Direct image URLs — try to load as img
    return (
      <div className="w-full h-full relative bg-slate-100/50">
        <img
          src={url}
          className="w-full h-full object-cover transition-opacity duration-500 group-hover:scale-110"
          onError={() => setHasError(true)}
          alt="Evidence"
        />
      </div>
    );
  };

  if (loading && !caseData) {
    return (
      <DashboardLayout>
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-10 space-y-8 animate-pulse">
          {/* Header Skeleton */}
          <div className="flex justify-between items-center mb-10">
            <div className="space-y-3">
              <div className="h-8 w-48 bg-slate-200 dark:bg-slate-800 rounded-lg" />
              <div className="h-4 w-32 bg-slate-100 dark:bg-slate-800/50 rounded" />
            </div>
            <div className="h-10 w-32 bg-slate-200 dark:bg-slate-800 rounded-xl" />
          </div>

          {/* Main Card Skeleton */}
          <div className="h-64 w-full bg-slate-100 dark:bg-slate-800/40 rounded-2xl border border-slate-200 dark:border-white/5" />

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 space-y-8">
              <div className="h-48 w-full bg-slate-100 dark:bg-slate-800/40 rounded-xl" />
              <div className="grid grid-cols-2 gap-8">
                <div className="h-64 bg-slate-50 dark:bg-slate-800/20 rounded-xl" />
                <div className="h-64 bg-slate-50 dark:bg-slate-800/20 rounded-xl" />
              </div>
            </div>
            <div className="space-y-8">
              <div className="h-96 w-full bg-slate-100 dark:bg-slate-800/40 rounded-xl" />
            </div>
          </div>
        </div>
      </DashboardLayout>
    );
  }

  if (!caseData) return null;

  const timelineSteps = [
    { label: 'Case Submitted', key: 'pending', icon: ClipboardList, color: 'emerald' },
    { label: 'Clinician Assigned', key: 'assigned', icon: User, color: 'blue' },
    { label: 'Treatment Finished', key: 'completed', icon: Activity, color: 'indigo' },
    { label: 'Quality Approval', key: 'approved', icon: ShieldCheck, color: 'cyan' },
  ];

  const statusMap: Record<string, number> = { pending: 1, assigned: 2, completed: 3, approved: 4, rejected: 0 };
  const currentStep = statusMap[caseData.status] || 1;

  return (
    <>
    <DashboardLayout>
      <style jsx global>{`
        @media print {
          /* 🚫 Hide all UI/Navigation elements */
          nav, aside, header, footer, [role="navigation"], .no-print, button, 
          .breadcrumb-container, .search-bar, .sidebar-container,
          [class*="Sidebar"], [class*="Navbar"], [class*="Breadcrumb"],
          .flex.gap-2, .fixed, .sticky, .fixed-bottom,
          .z-50, .z-70, #sidebar, #navbar {
            display: none !important;
            visibility: hidden !important;
            height: 0 !important;
            width: 0 !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          /* 📄 Force Page Layout */
          @page { 
            margin: 15mm 10mm; 
            size: A4; 
          }
          
          html, body, #__next, .min-h-screen, [class*="Layout"] {
            overflow: visible !important;
            height: auto !important;
            min-height: 0 !important;
            background: white !important;
            color: #000 !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
            display: block !important;
          }

          /* Reset Layout Flexbox */
          .min-h-screen { min-height: 0 !important; }
          .flex { display: block !important; }
          .flex-1 { width: 100% !important; flex: none !important; }
          main { padding: 0 !important; margin: 0 !important; }

          .max-w-6xl { 
            max-width: 100% !important; 
            width: 100% !important; 
            padding: 0 !important; 
            margin: 0 !important; 
          }

          .print-header {
            display: flex !important;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #0891b2;
            padding-bottom: 15px;
            margin-bottom: 30px;
          }

          .glass-card {
            border: 1px solid #e2e8f0 !important;
            box-shadow: none !important;
            padding: 20px !important;
            margin-bottom: 20px !important;
            break-inside: avoid;
            background: #fff !important;
            border-radius: 8px !important;
            display: block !important;
          }

          /* Force Grid for Info Sections */
          .print-grid {
            display: grid !important;
            grid-template-cols: repeat(2, 1fr) !important;
            gap: 20px !important;
          }

          .lg\:grid-cols-3 { 
            display: block !important; 
          }
          
          .lg\:col-span-2 {
            width: 100% !important;
          }

          .print-footer {
            display: block !important;
            margin-top: 40px;
            padding-top: 15px;
            border-top: 1px solid #e2e8f0;
            text-align: center;
            font-size: 9px;
            color: #64748b;
          }
          
          /* Optimization for Images */
          img, .aspect-square {
            max-width: 100% !important;
            break-inside: avoid;
          }

          /* Remove Dark Mode background forces */
          .dark {
            background-color: white !important;
            color: black !important;
          }
        }
        .print-header, .print-footer { display: none; }
      `}</style>
      
      <div className="max-w-6xl mx-auto pb-10">
        {/* Professional Print Header */}
        <div className="print-header">
          <div>
            <h1 className="text-2xl font-black text-cyan-600 tracking-tighter">BLUETEETH</h1>
            <p className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">Clinical Case Report</p>
          </div>
          <div className="text-right text-[10px] text-slate-500 font-bold uppercase">
            <p className="text-slate-900">Case ID: BTC-{(id as string).slice(-6).toUpperCase()}</p>
            <p>Generated: {format(new Date(), 'dd MMM, yyyy')}</p>
          </div>
        </div>

        {/* Navigation & Status - Hiddable in Print */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-10 no-print">
          <div className="flex items-center gap-4">
            <div>
              <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight uppercase">Case Details</h1>
                {getStatusBadge(caseData.status)}
              </div>
              <div className="flex items-center gap-2 mt-1.5">
                <div className="px-1.5 sm:px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded text-[9px] sm:text-[10px] font-mono font-bold tracking-wider flex items-center gap-1 border border-slate-200 dark:border-white/10 cursor-pointer hover:bg-slate-200 transition-all" onClick={copyCaseId}>
                  BTC-{(id as string).slice(-6).toUpperCase()} <Copy size={10} />
                </div>
                <div className="w-1 h-1 bg-slate-200 dark:bg-slate-800 rounded-full" />
                <span className="text-[9px] sm:text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                  Submitted {caseData.createdAt?.toDate ? format(caseData.createdAt.toDate(), 'dd MMM, yyyy') : 'Recently'}
                </span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => window.print()}
              className="w-full sm:w-auto px-5 sm:px-6 py-2.5 bg-cyan-600 text-white rounded-lg sm:rounded-xl font-black text-xs sm:text-sm hover:bg-cyan-700 transition-all flex items-center justify-center gap-2 shadow-lg shadow-cyan-100 dark:shadow-none uppercase tracking-widest"
            >
              <Download size={18} className="w-4 h-4 sm:w-[18px] sm:h-[18px]" /> Export PDF
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Info Column */}
          <div className="lg:col-span-2 space-y-8">
            
            {/* Core Patient Info */}
            <div className="glass-card p-5 sm:p-8 rounded-xl bg-white dark:bg-slate-900/50 border border-slate-100 dark:border-white/5 shadow-sm overflow-hidden">
              <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-8 xl:gap-12">
                {/* Information Side */}
                <div className="flex-1 space-y-6 sm:space-y-8">
                  <div>
                    <div className="flex items-center gap-3 mb-2">
                      <h2 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase">{caseData.patientName}</h2>
                      <div className="px-2 py-0.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded text-[9px] font-mono font-bold tracking-wider border border-slate-200 dark:border-white/10">
                        BTC-{(id as string).slice(-6).toUpperCase()}
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-4 sm:gap-x-6 gap-y-2 text-[11px] sm:text-sm font-bold text-slate-500">
                      <span className="flex items-center gap-1.5"><User size={14} className="text-cyan-500" /> {caseData.age} Y, {caseData.gender}</span>
                      <span className="flex items-center gap-1.5"><Phone size={14} className="text-emerald-500" /> {caseData.mobile}</span>
                    </div>
                  </div>

                  <div className="grid print-grid grid-cols-2 md:grid-cols-3 gap-6 sm:gap-8 pt-6 sm:pt-8 border-t border-slate-50 dark:border-white/5">
                    <div className="space-y-1">
                      <label className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest">Clinic Branch</label>
                      <div className="flex items-center gap-2 font-black text-slate-800 dark:text-slate-200 text-[11px] sm:text-sm whitespace-nowrap uppercase tracking-tight">
                        <MapPin size={14} className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-rose-500" /> {caseData.clinicLocation}
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest">Treatment Cost</label>
                      <div className="flex items-center gap-1.5 font-black text-slate-900 dark:text-white whitespace-nowrap text-[11px] sm:text-sm">
                        <IndianRupee size={14} className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-amber-500" /> {caseData.treatmentCharge}
                      </div>
                    </div>
                    <div className="space-y-1 col-span-2 md:col-span-1">
                      <label className="text-[9px] sm:text-[10px] font-bold text-slate-400 uppercase tracking-widest">Service Date</label>
                      <div className="flex items-center gap-2 font-black text-slate-800 dark:text-slate-200 text-[11px] sm:text-sm whitespace-nowrap uppercase tracking-tight">
                        <Calendar size={14} className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-blue-500" /> {caseData.bookingDate ? format(new Date(caseData.bookingDate), 'dd MMM, yyyy') : 'N/A'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Treatment Card Side - Isolated & Compact */}
                <div className="w-full xl:w-52 bg-linear-to-br from-white to-cyan-50/50 dark:from-slate-800/50 dark:to-cyan-900/10 p-5 rounded-2xl border border-cyan-100/50 dark:border-cyan-500/10 flex flex-col items-center justify-center text-center shadow-sm relative shrink-0">
                  <div className="w-12 h-12 bg-white dark:bg-slate-900 rounded-xl flex items-center justify-center text-cyan-600 shadow-sm border border-cyan-50 dark:border-white/5 mb-3">
                    <Stethoscope size={24} strokeWidth={2.5} />
                  </div>
                  <label className="text-[9px] font-black text-cyan-600 dark:text-cyan-400 uppercase tracking-[0.25em] mb-1">Treatment</label>
                  <h4 className="text-lg font-black text-slate-900 dark:text-white leading-tight mb-4 uppercase tracking-tight">{caseData.treatmentType}</h4>
                  <div className="px-4 py-1.5 bg-cyan-600 text-white rounded-lg text-[10px] font-black uppercase tracking-widest shadow-md shadow-cyan-100 dark:shadow-none">
                    {caseData.points} Points
                  </div>
                </div>
              </div>
            </div>

            {/* Clinician Card */}
            <AnimatePresence>
              {caseData.clinicianId && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="glass-card p-8 rounded-xl border border-blue-100 bg-gradient-to-r from-white to-blue-50/30 shadow-sm"
                >
                  <div className="flex flex-col md:flex-row items-center gap-8">
                    <div className="relative">
                      <div className="w-20 h-20 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-200">
                        <User size={40} strokeWidth={2.5} />
                      </div>
                      <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-emerald-500 border-4 border-white rounded-full flex items-center justify-center text-white">
                        <ShieldCheck size={14} />
                      </div>
                    </div>
                    
                    <div className="flex-1 text-center md:text-left min-w-0">
                      <div className="flex items-center justify-center md:justify-start gap-3 mb-1">
                        <h3 className="text-xl sm:text-2xl font-black text-slate-900 dark:text-white tracking-tight uppercase whitespace-nowrap">
                          {clinicianProfile?.name ? formatName(clinicianProfile.name, 'clinician') : caseData.clinicianName ? formatName(caseData.clinicianName, 'clinician') : 'Dr. Specialists'}
                        </h3>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="px-1.5 py-0.5 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded text-[8px] font-black uppercase tracking-widest">Verified</span>
                          <button className="text-[9px] font-bold text-blue-600 hover:underline flex items-center gap-1">
                            View <ExternalLink size={10} />
                          </button>
                        </div>
                      </div>
                      <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-4">
                        {clinicianProfile?.specialization || 'Senior Consultant • Oral Surgery'}
                      </p>
                      
                      <div className="flex flex-wrap items-center justify-center md:justify-start gap-x-4 gap-y-2 text-[10px] font-bold text-slate-500 mt-2">
                        <div className="flex items-center gap-1.5">
                          <ClipboardList size={12} className="text-blue-500" /> 
                          <span className="text-slate-400 uppercase tracking-widest">Reg:</span>
                          <span className="text-slate-900 dark:text-slate-200 font-black tracking-tight">{clinicianProfile?.registrationNumber || caseData.clinicianRegNo || 'Pending'}</span>
                        </div>
                        <div className="w-1 h-1 bg-slate-200 dark:bg-slate-800 rounded-full hidden sm:block" />
                        <div className="flex items-center gap-1.5">
                          <Building2 size={12} className="text-blue-500" /> 
                          <span className="text-slate-400 uppercase tracking-widest">Clinic:</span>
                          <span className="text-slate-900 dark:text-slate-200">{clinicianProfile?.clinicName || 'Blueteeth Premier'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 justify-center md:justify-start mt-4">
                      <a 
                        href={`tel:${clinicianProfile?.phone || caseData.clinicianMobile || ''}`}
                        className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-blue-200 hover:bg-blue-700 transition-all flex items-center gap-2"
                      >
                        <Phone size={14} /> Call Doctor
                      </a>
                      <a 
                        href={`https://wa.me/91${(clinicianProfile?.phone || caseData.clinicianMobile || '').replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-5 py-2.5 bg-emerald-500 text-white rounded-xl font-black text-[10px] uppercase tracking-widest shadow-lg shadow-emerald-200 hover:bg-emerald-600 transition-all flex items-center gap-2"
                      >
                        <Activity size={14} /> WhatsApp
                      </a>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Proof Gallery */}
            <div className="grid print-grid grid-cols-1 md:grid-cols-2 gap-8">
              {/* Initial Proof */}
              <div className="glass-card p-8 rounded-xl shadow-sm bg-white dark:bg-slate-900/40 border border-slate-100 dark:border-white/5">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-[0.2em] flex items-center gap-2">
                    <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 rounded-lg flex items-center justify-center"><Upload size={16} /></div>
                    Initial Evidence
                  </h3>
                  <span className="text-[10px] font-bold text-slate-400">{caseData.initialProof?.length || 0} Files</span>
                </div>
                <div className="grid print-grid grid-cols-2 gap-4">
                  {caseData.initialProof?.map((url, i) => (
                    <div
                      key={i}
                      onClick={() => openProof(url)}
                      className="relative group aspect-square rounded-xl overflow-hidden border border-slate-100 dark:border-white/10 shadow-sm bg-slate-50 dark:bg-slate-800 cursor-pointer"
                    >
                      <ProofThumbnail url={url} />
                      <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center text-white p-4">
                        <ExternalLink size={20} className="mb-2" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">View</span>
                      </div>
                    </div>
                  ))}

                  {/* 🔴 NO EVIDENCE — Show re-upload button if pending */}
                  {(!caseData.initialProof || caseData.initialProof.length === 0) && (
                    <div className="col-span-2">
                      {caseData.status === 'pending' || caseData.status === 'assigned' ? (
                        <label className="cursor-pointer group block">
                          <input
                            ref={reuploadRef}
                            type="file"
                            accept="image/*,.pdf"
                            className="hidden"
                            onChange={handleReupload}
                            disabled={uploading}
                          />
                          <div className="py-10 flex flex-col items-center justify-center gap-4 border-2 border-dashed border-amber-200 dark:border-amber-500/30 rounded-xl bg-amber-50/50 dark:bg-amber-500/5 hover:border-amber-400 hover:bg-amber-50 dark:hover:bg-amber-500/10 transition-all">
                            {uploading ? (
                              <>
                                <Loader2 size={28} className="text-amber-500 animate-spin" />
                                <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest">Uploading...</span>
                              </>
                            ) : (
                              <>
                                <div className="w-12 h-12 bg-amber-100 dark:bg-amber-500/20 rounded-xl flex items-center justify-center text-amber-600 group-hover:scale-110 transition-transform">
                                  <ImagePlus size={24} />
                                </div>
                                <div className="text-center">
                                  <p className="text-[11px] font-black text-amber-700 dark:text-amber-400 uppercase tracking-widest">Upload Missing Proof</p>
                                  <p className="text-[9px] font-bold text-amber-500 mt-1 uppercase tracking-wider">Tap to select image or PDF</p>
                                </div>
                              </>
                            )}
                          </div>
                        </label>
                      ) : (
                        <div className="py-12 flex flex-col items-center justify-center gap-3 border-2 border-dashed border-slate-100 dark:border-white/5 rounded-xl bg-slate-50/50">
                          <FileText size={24} className="text-slate-200" />
                          <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] block">No Evidence</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {/* Final Proof */}
              <div className="glass-card p-8 rounded-xl shadow-sm bg-white dark:bg-slate-900/40 border border-slate-100 dark:border-white/5">
                <div className="flex items-center justify-between mb-8">
                  <h3 className="text-xs font-black text-slate-900 dark:text-white uppercase tracking-[0.2em] flex items-center gap-2">
                    <div className="w-8 h-8 bg-indigo-100 dark:bg-indigo-500/20 text-indigo-600 dark:text-indigo-400 rounded-lg flex items-center justify-center"><ShieldCheck size={16} /></div>
                    Clinical Outcome
                  </h3>
                  <span className="text-[10px] font-bold text-slate-400">{caseData.finalProof?.length || 0} Files</span>
                </div>
                <div className="grid print-grid grid-cols-2 gap-4">
                  {caseData.finalProof?.map((url, i) => (
                    <div
                      key={i}
                      onClick={() => openProof(url)}
                      className="relative group aspect-square rounded-xl overflow-hidden border border-slate-100 dark:border-white/10 shadow-sm bg-slate-50 dark:bg-slate-800 cursor-pointer"
                    >
                      <ProofThumbnail url={url} />
                      <div className="absolute inset-0 bg-slate-900/60 opacity-0 group-hover:opacity-100 transition-all flex flex-col items-center justify-center text-white p-4">
                        <ExternalLink size={20} className="mb-2" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Result</span>
                      </div>
                    </div>
                  ))}
                  {(!caseData.finalProof || caseData.finalProof.length === 0) && (
                    <div className="col-span-2 py-10 flex flex-col items-center justify-center gap-3 border-2 border-dashed border-slate-100 dark:border-white/5 rounded-xl bg-slate-50/50">
                      <Clock size={24} className="text-slate-200 animate-pulse" />
                      <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest">Waiting for Clinician</span>
                      <span className="text-[9px] font-bold text-slate-300 uppercase tracking-wider">Outcome uploaded after treatment</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Timeline & Notes */}
          <div className="lg:col-span-1 space-y-8">
            

            <div className="glass-card p-8 rounded-xl bg-white shadow-sm">
              <h3 className="text-xs font-black text-slate-900 uppercase tracking-[0.2em] mb-12 flex items-center gap-2">
                <Activity size={18} className="text-cyan-600" /> Real-time Tracking
              </h3>
              
              <div className="relative space-y-12">
                {/* Vertical Progress Line */}
                <div className="absolute left-[15px] top-2 bottom-2 w-[2px] bg-slate-100" />
                
                {timelineSteps.map((step, i) => {
                  const isDone = statusMap[caseData.status] >= statusMap[step.key];
                  const isActive = caseData.status === step.key;
                  
                  return (
                    <div key={i} className="relative flex items-center gap-8 group">
                      {/* Node */}
                      <div className={`z-10 w-8 h-8 rounded-full flex items-center justify-center transition-all duration-700
                        ${isDone ? 'bg-emerald-500 text-white shadow-lg shadow-emerald-100 dark:shadow-none' : isActive ? 'bg-cyan-600 text-white scale-125 shadow-xl shadow-cyan-200 dark:shadow-none' : 'bg-white text-slate-200 border-2 border-slate-100'}
                      `}>
                        {isDone ? <Check size={18} strokeWidth={3} /> : <step.icon size={16} strokeWidth={2.5} />}
                      </div>

                      {/* Content */}
                      <div className="flex-1">
                        <p className={`text-sm font-black tracking-tight transition-all duration-300 ${isDone ? 'text-slate-900' : isActive ? 'text-cyan-600' : 'text-slate-300'}`}>
                          {step.label}
                        </p>
                        {isActive && (
                          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-cyan-50 text-cyan-600 text-[9px] font-black uppercase tracking-widest mt-1 rounded">
                            <span className="w-1.5 h-1.5 bg-cyan-600 rounded-full animate-ping" /> Currently Here
                          </div>
                        )}
                        {isDone && !isActive && (
                          <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-widest mt-0.5">Step Verified</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>

              {caseData.status === 'rejected' && (
                <div className="mt-12 p-4 bg-red-50 border border-red-100 rounded-xl flex items-start gap-3">
                  <AlertCircle size={20} className="text-red-500 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-black text-red-600 uppercase tracking-widest">Case Rejected</p>
                    <p className="text-[10px] font-bold text-red-400 mt-1">Please contact support for more details regarding the rejection.</p>
                  </div>
                </div>
              )}
            </div>

            {/* ✅ FIXED: Morphism Element in the Right Gap */}
            <div className="glass-card p-8 rounded-xl bg-linear-to-br from-cyan-600 to-blue-700 text-white shadow-xl shadow-cyan-100/50 dark:shadow-none border-none relative overflow-hidden flex flex-col justify-between group min-h-[280px]">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16 blur-2xl group-hover:scale-150 transition-transform duration-700" />
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-cyan-400/20 rounded-full -ml-12 -mb-12 blur-xl" />
              
              <div className="relative z-10">
                <div className="w-10 h-10 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center mb-6 border border-white/20">
                  <Activity size={20} className="text-cyan-100" />
                </div>
                <h3 className="text-sm font-black uppercase tracking-[0.2em] mb-3">Clinical Trust</h3>
                <p className="text-[10px] font-bold text-cyan-50/80 leading-relaxed uppercase tracking-wider">
                  Verified clinical rewards platform with real-time tracking and automated processing.
                </p>
              </div>

              <div className="relative z-10 pt-8 mt-auto">
                <div className="flex items-center justify-between bg-white/10 backdrop-blur-md p-4 rounded-xl border border-white/10">
                  <div className="text-center">
                    <p className="text-[16px] font-black">99%</p>
                    <p className="text-[8px] font-bold uppercase tracking-widest opacity-70">Accuracy</p>
                  </div>
                  <div className="w-[1px] h-8 bg-white/10" />
                  <div className="text-center">
                    <p className="text-[16px] font-black">24/7</p>
                    <p className="text-[8px] font-bold uppercase tracking-widest opacity-70">Support</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="glass-card p-8 rounded-xl bg-slate-900 text-white overflow-hidden relative shadow-lg space-y-8">
              <div className="absolute -right-4 -bottom-4 opacity-10 pointer-events-none">
                <ClipboardList size={80} />
              </div>
              
              <div>
                <h3 className="text-[10px] font-black text-cyan-500 uppercase tracking-widest mb-4 flex items-center gap-2 relative z-10">
                  <FileText size={14} /> Your Initial Notes
                </h3>
                <p className="text-sm text-slate-300 font-bold leading-relaxed relative z-10 italic">
                  "{caseData.notes || 'No initial notes provided.'}"
                </p>
              </div>

              {caseData.clinicianNotes && (
                <div className="pt-6 border-t border-white/5 relative z-10">
                  <h3 className="text-[10px] font-black text-emerald-500 uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Stethoscope size={14} /> Clinician Resolution
                  </h3>
                  <p className="text-sm text-slate-300 font-bold leading-relaxed italic">
                    "{caseData.clinicianNotes}"
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* Professional Print Footer */}
        <div className="print-footer text-center">
          <p className="font-black uppercase tracking-widest mb-1 text-slate-900">Official Clinical Record — Verified by Blueteeth Systems</p>
          <p className="font-bold text-[8px] uppercase tracking-tighter">This document is a computer-generated report. For inquiries, contact compliance@blueteeth.ai</p>
          <div className="mt-4 flex justify-center gap-12 text-[8px] font-black uppercase text-slate-400">
            <span>Branch Copy</span>
            <span>Ref: {caseData.id}</span>
            <span>Stamp: ________________</span>
          </div>
        </div>
      </div>
    </DashboardLayout>

      {/* ───── In-Page PDF Viewer Modal ───── */}
      <AnimatePresence>
        {pdfViewer && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex flex-col bg-slate-900/95 backdrop-blur-sm outline-none"
            onKeyDown={(e) => e.key === 'Escape' && setPdfViewer(null)}
            tabIndex={0}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 bg-slate-900 border-b border-slate-700 shrink-0 relative z-50">
              <div className="flex items-center gap-3">
                <FileText size={20} className="text-red-400" />
                <span className="text-sm font-black text-white uppercase tracking-widest">Clinical Evidence Viewer</span>
              </div>
              <div className="flex items-center gap-3">
                <a
                  href={`/api/view-pdf?url=${encodeURIComponent(currentOriginalUrl!)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 bg-cyan-600 text-white rounded-md text-xs font-black uppercase tracking-widest hover:bg-cyan-500 transition-all flex items-center gap-2"
                >
                  <ExternalLink size={16} /> Open Full PDF
                </a>
                <button
                  onClick={() => setPdfViewer(null)}
                  className="w-9 h-9 bg-white/10 hover:bg-rose-500 text-white rounded-md flex items-center justify-center transition-all font-black relative z-[60] pointer-events-auto"
                >
                  ✕
                </button>
              </div>
            </div>
            {/* Content: centered image or robust PDF object */}
            <div 
              className="flex-1 overflow-auto flex items-center justify-center bg-slate-950 relative"
              onClick={(e) => e.target === e.currentTarget && setPdfViewer(null)}
            >
              {viewerMimeType.startsWith('image/') ? (
                <img
                  src={pdfViewer!}
                  alt="Clinical Evidence"
                  className="max-w-full max-h-full object-contain"
                />
              ) : (
                <>
                  <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-500 z-0">
                    <Loader2 className="animate-spin mb-2" />
                    <p className="text-[10px] font-bold uppercase tracking-widest">Loading Document...</p>
                  </div>
                  <object
                    data={pdfViewer!}
                    type="application/pdf"
                    className="w-full h-full border-none relative z-10"
                  >
                    <div className="flex flex-col items-center justify-center text-white p-10 text-center">
                      <FileText size={48} className="mb-4 text-slate-500" />
                      <p className="text-sm font-bold mb-4">Browser can't display this PDF directly.</p>
                      <a 
                        href={currentOriginalUrl!} 
                        target="_blank" 
                        className="px-6 py-3 bg-cyan-600 rounded-xl font-black text-xs uppercase tracking-widest"
                      >
                        Open in New Tab
                      </a>
                    </div>
                  </object>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
