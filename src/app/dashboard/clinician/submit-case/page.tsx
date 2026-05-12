'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { 
  User, 
  Stethoscope, 
  MapPin, 
  FileText, 
  Loader2,
  X,
  Plus,
  Check,
  IndianRupee,
  Activity,
  ChevronDown,
  User as UserIcon,
  GripVertical
} from 'lucide-react';
import { TREATMENT_POINTS } from '@/types';
import { motion, AnimatePresence } from 'framer-motion';

const formSchema = z.object({
  patientName: z.string().min(2, 'Patient name must be at least 2 characters'),
  mobile: z.string().length(10, 'Mobile number must be exactly 10 digits').regex(/^\d+$/, 'Only numbers allowed'),
  age: z.string().refine((val) => !isNaN(Number(val)) && Number(val) >= 1 && Number(val) <= 100, 'Age must be between 1 and 100'),
  gender: z.string().min(1, 'Please select gender'),
  treatmentType: z.string().min(1, 'Please select treatment type'),
  treatmentCharge: z.string().min(1, 'Please enter treatment charge').regex(/^\d+$/, 'Only numbers allowed'),
  clinicLocation: z.string().min(3, 'Please enter clinic location'),
  bookingDate: z.string().min(1, 'Please select booking date'),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

const GENDER_OPTIONS = [
  { label: 'Male', icon: <UserIcon size={16} className="text-blue-500" /> },
  { label: 'Female', icon: <UserIcon size={16} className="text-rose-500" /> },
  { label: 'Other', icon: <GripVertical size={16} className="text-slate-400" /> },
];

export default function ClinicianSubmitCasePage() {
  const { user, firebaseUser } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showTreatments, setShowTreatments] = useState(false);
  const [showGender, setShowGender] = useState(false);
  
  const [initialFile, setInitialFile] = useState<{file: File, preview: string} | null>(null);
  const [finalFile, setFinalFile] = useState<{file: File, preview: string} | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      treatmentType: '',
      gender: '',
      bookingDate: new Date().toISOString().split('T')[0],
    }
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>, type: 'initial' | 'final') => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const preview = file.type.includes('image') ? URL.createObjectURL(file) : 'pdf';
      
      if (type === 'initial') {
        if (initialFile) URL.revokeObjectURL(initialFile.preview);
        setInitialFile({ file, preview });
      } else {
        if (finalFile) URL.revokeObjectURL(finalFile.preview);
        setFinalFile({ file, preview });
      }
    }
  };

  const removeFile = (type: 'initial' | 'final') => {
    if (type === 'initial') {
      if (initialFile) URL.revokeObjectURL(initialFile.preview);
      setInitialFile(null);
    } else {
      if (finalFile) URL.revokeObjectURL(finalFile.preview);
      setFinalFile(null);
    }
  };

  // 🚀 TURBO UPLOAD HANDLER (Bypasses Firebase Storage Issues)
  const uploadSingleFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    
    // 🛡️ SECURITY: Fetch token from Firebase Auth
    const token = await firebaseUser?.getIdToken();
    const headers: Record<string, string> = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch('/api/upload', {
      method: 'POST',
      headers,
      body: formData,
    });
    
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(errData.error || "File upload failed");
    }
    
    const data = await res.json();
    return data.url;
  };

  const onSubmit = async (data: FormData) => {
    if (!initialFile) return toast.error('Initial Proof is required');
    if (!user) return toast.error('Auth required');

    setLoading(true);
    try {
      // 1. Parallel Uploads via API
      const uploadTasks = [uploadSingleFile(initialFile.file)];
      if (finalFile) uploadTasks.push(uploadSingleFile(finalFile.file));
      
      const [initialUrl, finalUrl] = await Promise.all(uploadTasks);
      // ✅ Always start as 'assigned' so clinician can add notes before completing
      const status = 'assigned'; 

      // 2. Save to Firestore
      await addDoc(collection(db, 'cases'), {
        ...data,
        patientName: data.patientName.trim(),
        age: Number(data.age),
        treatmentCharge: Number(data.treatmentCharge),
        associateId: user.uid, 
        associateName: user.name || 'Dr. Clinician',
        clinicianId: user.uid, 
        clinicianName: user.name || 'Dr. Clinician',
        clinicianRegNo: user.registrationNumber || '',
        createdByRole: 'clinician',
        selfAssigned: true,
        sourceType: 'clinician_self',
        initialProof: [initialUrl],
        finalProof: finalUrl ? [finalUrl] : [],
        status,
        points: 0,
        consultationFee: 0,
        createdAt: serverTimestamp(),
      });
      
      toast.success('Case Recorded!');
      router.push('/dashboard/clinician/assigned-cases');
    } catch (err: any) {
      console.error("Submission Error:", err);
      toast.error(err.message || 'Submission failed');
      setLoading(false); // Stop spinner if error
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto pb-6 px-2 sm:px-6 lg:px-0">
        <div className="mb-8 sm:mb-10 mt-2 sm:mt-0">
          <h1 className="text-2xl sm:text-4xl font-black text-slate-900 tracking-tight uppercase tracking-tighter">Submit Self Case</h1>
          <p className="text-slate-500 mt-1 sm:mt-2 font-bold uppercase text-[9px] sm:text-[10px] tracking-widest italic">Fast-track direct clinical submission</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className={`glass-card p-5 sm:p-8 rounded-xl relative border border-slate-100 shadow-sm transition-all ${showGender ? 'z-[100]' : 'z-20'}`}>
            <div className="absolute top-0 left-0 w-1.5 h-full bg-cyan-600 rounded-l-xl" />
            <h3 className="text-lg font-black text-slate-900 mb-8 flex items-center gap-3 uppercase tracking-widest">
              <div className="w-10 h-10 bg-cyan-50 text-cyan-600 rounded-lg flex items-center justify-center">
                <User size={20} strokeWidth={2.5} />
              </div>
              Patient Information
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 relative">
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Patient Name</label>
                <input {...register('patientName')} required className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-lg focus:border-cyan-500 outline-none transition-all font-bold text-slate-900" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Mobile</label>
                <input {...register('mobile')} required maxLength={10} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-lg focus:border-cyan-500 outline-none transition-all font-bold text-slate-900" />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Age</label>
                <input {...register('age')} type="number" required className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-lg focus:border-cyan-500 outline-none transition-all font-bold text-slate-900" />
              </div>
              
              <div className="space-y-1.5 relative">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Gender</label>
                <button
                  type="button"
                  onClick={() => setShowGender(!showGender)}
                  className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-lg text-left flex items-center justify-between font-bold text-slate-900 hover:bg-slate-100 transition-all"
                >
                  <div className="flex items-center gap-2">
                    <span>{watch('gender') || 'Select Gender'}</span>
                  </div>
                  <ChevronDown size={16} className={`text-slate-400 transition-transform duration-300 ${showGender ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {showGender && (
                    <motion.div
                      initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                      className="absolute left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-slate-100 z-[999] p-1"
                    >
                      {GENDER_OPTIONS.map(g => (
                        <button
                          key={g.label} type="button" onClick={() => { setValue('gender', g.label); setShowGender(false); }}
                          className="w-full px-4 py-2.5 text-left hover:bg-slate-50 rounded-lg transition-all flex items-center gap-3 font-bold text-slate-700 text-sm"
                        >
                          {g.icon} {g.label}
                        </button>
                      ))}
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] ml-1">Treatment Date</label>
                <input {...register('bookingDate')} type="date" className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-900" />
              </div>
            </div>
          </div>

          <div className={`grid grid-cols-1 md:grid-cols-2 gap-6 relative ${showTreatments ? 'z-50' : 'z-10'}`}>
            <div className="glass-card p-5 sm:p-8 rounded-xl relative border border-slate-100 shadow-sm">
              <h3 className="text-lg font-black text-slate-900 mb-8 flex items-center gap-3 uppercase tracking-widest">
                <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                  <Stethoscope size={20} strokeWidth={2.5} />
                </div>
                Treatment Details
              </h3>
              <div className="space-y-5 relative">
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setShowTreatments(!showTreatments)}
                    className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-lg text-left flex items-center justify-between font-bold text-slate-900 hover:bg-slate-100 transition-all"
                  >
                    <div className="flex items-center gap-2">
                      <Activity size={16} className="text-indigo-500" />
                      <span className="truncate max-w-[180px]">{watch('treatmentType') || 'Select Treatment'}</span>
                    </div>
                    <ChevronDown size={16} className={`text-slate-400 transition-transform duration-300 ${showTreatments ? 'rotate-180' : ''}`} />
                  </button>
                  <AnimatePresence>
                    {showTreatments && (
                      <motion.div
                        initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
                        className="absolute left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-slate-100 max-h-60 overflow-y-auto z-[999] p-1 custom-scrollbar"
                      >
                        {Object.keys(TREATMENT_POINTS).map(t => (
                          <button
                            key={t} type="button" onClick={() => { setValue('treatmentType', t); setShowTreatments(false); }}
                            className="w-full px-4 py-2.5 text-left hover:bg-slate-50 rounded-lg transition-all font-bold text-slate-700 text-sm border-b border-slate-50 last:border-none"
                          >
                            {t}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <div className="relative">
                  <IndianRupee className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input {...register('treatmentCharge')} required placeholder="Charge ₹" className="w-full pl-12 pr-5 py-3.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-900" />
                </div>
                <div className="relative">
                  <MapPin className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                  <input {...register('clinicLocation')} required placeholder="Clinic Location" className="w-full pl-12 pr-5 py-3.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-900" />
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="glass-card p-6 rounded-xl border-l-4 border-emerald-500 shadow-sm">
                <h4 className="font-black text-slate-900 mb-4 flex items-center gap-2 uppercase tracking-[0.2em] text-[10px]">Initial Proof (Mandatory)</h4>
                {!initialFile ? (
                  <>
                    <input type="file" accept="image/*,application/pdf" onChange={(e) => handleFileChange(e, 'initial')} className="hidden" id="initial-upload" />
                    <label htmlFor="initial-upload" className="w-full h-20 border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-50 transition-all"><Plus className="text-slate-300" /></label>
                  </>
                ) : (
                  <div className="relative w-20 h-20">
                    {initialFile.preview === 'pdf' ? <div className="w-full h-full bg-red-50 rounded-lg flex items-center justify-center text-red-600 border border-red-100"><FileText size={24} /></div> : <img src={initialFile.preview} className="w-full h-full object-cover rounded-lg border border-slate-100" />}
                    <button onClick={() => removeFile('initial')} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md"><X size={12} /></button>
                  </div>
                )}
              </div>

              <div className="glass-card p-6 rounded-xl border-l-4 border-blue-500 shadow-sm">
                <h4 className="font-black text-slate-900 mb-4 flex items-center gap-2 uppercase tracking-[0.2em] text-[10px]">Final Proof (Optional)</h4>
                {!finalFile ? (
                  <>
                    <input type="file" accept="image/*,application/pdf" onChange={(e) => handleFileChange(e, 'final')} className="hidden" id="final-upload" />
                    <label htmlFor="final-upload" className="w-full h-20 border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-50 transition-all"><Plus className="text-slate-300" /></label>
                  </>
                ) : (
                  <div className="relative w-20 h-20">
                    {finalFile.preview === 'pdf' ? <div className="w-full h-full bg-red-50 rounded-lg flex items-center justify-center text-red-600 border border-red-100"><FileText size={24} /></div> : <img src={finalFile.preview} className="w-full h-full object-cover rounded-lg border border-slate-100" />}
                    <button onClick={() => removeFile('final')} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-md"><X size={12} /></button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <button 
            type="submit" 
            disabled={loading} 
            className="w-full py-4.5 sm:py-5 premium-gradient text-white rounded-xl font-black text-sm sm:text-lg shadow-xl shadow-cyan-600/20 disabled:opacity-50 flex items-center justify-center gap-2 sm:gap-3 uppercase tracking-[0.1em] sm:tracking-[0.2em] px-4 sm:px-6 transition-all"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={20} />
            ) : (
              <div className="flex items-center gap-2">
                <span>Record Case & Auto-Assign</span>
                <Check size={20} className="flex-shrink-0" />
              </div>
            )}
          </button>
        </form>
      </div>
    </DashboardLayout>
  );
}
