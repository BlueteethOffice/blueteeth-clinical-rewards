'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, serverTimestamp, doc, setDoc, updateDoc } from 'firebase/firestore';
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
  GripVertical,
  Phone,
  Upload
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

export default function ClinicianSubmitCasePage() {
  const { user, firebaseUser } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [showTreatments, setShowTreatments] = useState(false);
  
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

  const uploadSingleFile = async (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    const token = await firebaseUser?.getIdToken();
    const res = await fetch('/api/upload', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${token}` },
      body: formData,
    });
    if (!res.ok) throw new Error("File upload failed");
    const data = await res.json();
    return data.url;
  };

  const onSubmit = async (data: FormData) => {
    if (!initialFile) return toast.error('Initial Proof is required');
    if (!user) return toast.error('Auth required');

    setLoading(true);

    try {
      // 🚀 TURBO MODE: Start the process and redirect IMMEDIATELY
      const newCaseRef = doc(collection(db, 'cases'));
      const formattedPatientName = data.patientName.trim();
      const token = await firebaseUser?.getIdToken();

      // 1. Initial Meta-Save (Instant)
      await setDoc(newCaseRef, {
        ...data,
        id: newCaseRef.id,
        patientName: formattedPatientName,
        age: Number(data.age),
        treatmentCharge: Number(data.treatmentCharge),
        associateId: user.uid, 
        associateName: user.name || 'Dr. Clinician',
        clinicianId: user.uid, 
        clinicianName: user.name || 'Dr. Clinician',
        clinicianRegNo: (user as any).registrationNumber || '',
        createdByRole: 'clinician',
        selfAssigned: true,
        sourceType: 'clinician_self',
        initialProof: [], 
        finalProof: [],
        status: 'assigned',
        points: 0,
        consultationFee: 0,
        createdAt: serverTimestamp(),
      });

      // 2. Instant Feedback & Redirect
      toast.success('Case recorded! Uploading files in background...');
      router.push('/dashboard/clinician/assigned-cases');

      // 3. BACKGROUND SYNC
      (async () => {
        try {
          const uploadTasks = [uploadSingleFile(initialFile.file)];
          if (finalFile) uploadTasks.push(uploadSingleFile(finalFile.file));
          const [initialUrl, finalUrl] = await Promise.all(uploadTasks);
          
          await updateDoc(newCaseRef, {
            initialProof: [initialUrl],
            finalProof: finalUrl ? [finalUrl] : [],
          });
        } catch (bgErr) {
          console.error("Clinician background sync failed:", bgErr);
        }
      })();

    } catch (err: any) {
      console.error("Submission Error:", err);
      toast.error(err.message || 'Submission failed');
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto pb-6 px-2 sm:px-6 lg:px-0">
        <div className="mb-8">
          <h1 className="text-2xl sm:text-4xl font-black text-slate-900 uppercase">Submit Self Case</h1>
          <p className="text-slate-500 font-bold uppercase text-[10px] italic">Turbo Background Sync Enabled</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
          <div className="glass-card p-5 sm:p-8 rounded-xl relative border border-slate-100 shadow-sm z-20">
            <div className="absolute top-0 left-0 w-1.5 h-full bg-cyan-600 rounded-l-xl" />
            <h3 className="text-lg font-black text-slate-900 mb-8 uppercase tracking-widest flex items-center gap-3">
              <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-cyan-100">
                <User size={20} strokeWidth={2.5} />
              </div>
              Patient Information
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="md:col-span-2 space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Patient Name</label>
                <input 
                  {...register('patientName')} 
                  required 
                  onInput={(e) => {
                    const val = e.currentTarget.value;
                    e.currentTarget.value = val.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                  }}
                  className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-lg outline-none font-bold text-slate-900" 
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mobile</label>
                <div className="relative">
                  <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-500" strokeWidth={2.5} />
                  <input {...register('mobile')} required maxLength={10} className="w-full pl-10 pr-5 py-3.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-900" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Age</label>
                <div className="relative">
                  <Activity size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-violet-500" strokeWidth={2.5} />
                  <input {...register('age')} type="number" required className="w-full pl-10 pr-5 py-3.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-900" />
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Gender</label>
                <select {...register('gender')} required className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-900">
                  <option value="">Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Date</label>
                <input {...register('bookingDate')} type="date" className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-900" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass-card p-5 sm:p-8 rounded-xl relative border border-slate-100 shadow-sm z-30">
              <h3 className="text-lg font-black text-slate-900 mb-8 uppercase tracking-widest flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-400 to-purple-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-indigo-100">
                  <Stethoscope size={20} strokeWidth={2.5} />
                </div>
                Treatment Details
              </h3>
              <div className="space-y-5 relative">
                <div className="relative">
                  <button type="button" onClick={() => setShowTreatments(!showTreatments)} className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-lg text-left flex items-center justify-between font-bold text-slate-900 hover:bg-slate-100 transition-all">
                    <span>{watch('treatmentType') || 'Select Treatment'}</span>
                    <ChevronDown size={16} className={showTreatments ? 'rotate-180' : ''} />
                  </button>
                  <AnimatePresence>
                    {showTreatments && (
                      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute z-50 left-0 right-0 mt-2 bg-white rounded-xl shadow-2xl border border-slate-100 max-h-60 overflow-y-auto p-1">
                        {Object.keys(TREATMENT_POINTS).map(t => (
                          <button key={t} type="button" onClick={() => { setValue('treatmentType', t, { shouldValidate: true }); setShowTreatments(false); }} className="w-full px-4 py-2.5 text-left hover:bg-slate-50 rounded-lg transition-all font-bold text-slate-700 text-sm border-b border-slate-50 last:border-none">
                            {t}
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <div className="relative">
                  <IndianRupee size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-500" strokeWidth={2.5} />
                  <input {...register('treatmentCharge')} required placeholder="Charge ₹" className="w-full pl-10 pr-5 py-3.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-900" />
                </div>
                <div className="relative">
                  <MapPin size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-rose-500" strokeWidth={2.5} />
                  <input 
                    {...register('clinicLocation')} 
                    required 
                    placeholder="Clinic Location" 
                    onInput={(e) => {
                      const val = e.currentTarget.value;
                      e.currentTarget.value = val.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                    }}
                    className="w-full pl-10 pr-5 py-3.5 bg-slate-50 border border-slate-200 rounded-lg font-bold text-slate-900" 
                  />
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="glass-card p-6 rounded-xl border-l-4 border-emerald-500 shadow-sm">
                <h4 className="font-black text-slate-900 mb-4 uppercase text-[10px] flex items-center gap-2">
                  <div className="w-7 h-7 bg-gradient-to-br from-emerald-400 to-teal-600 text-white rounded-lg flex items-center justify-center shadow-md">
                    <Upload size={14} strokeWidth={2.5} />
                  </div>
                  Initial Proof
                </h4>
                {!initialFile ? (
                  <>
                    <input type="file" accept="image/*,application/pdf" onChange={(e) => handleFileChange(e, 'initial')} className="hidden" id="initial-upload" />
                    <label htmlFor="initial-upload" className="w-full h-20 border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-50 transition-all"><Plus className="text-slate-400" /></label>
                  </>
                ) : (
                  <div className="relative w-24 h-24 group">
                    {initialFile.preview === 'pdf' ? (
                      <div className="w-full h-full bg-red-50 rounded-lg flex flex-col items-center justify-center text-red-600 border border-red-100">
                        <FileText size={32} />
                        <span className="text-xs font-bold mt-1">PDF</span>
                      </div>
                    ) : (
                      <img src={initialFile.preview} alt="Initial proof" className="w-full h-full object-cover rounded-lg border border-slate-200 shadow-sm" />
                    )}
                    <button type="button" onClick={() => removeFile('initial')} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 shadow-lg hover:bg-red-600 transition-all scale-90 group-hover:scale-100"><X size={12} /></button>
                  </div>
                )}
              </div>

              <div className="glass-card p-6 rounded-xl border-l-4 border-blue-500 shadow-sm">
                <h4 className="font-black text-slate-900 mb-4 uppercase text-[10px] flex items-center gap-2">
                  <div className="w-7 h-7 bg-gradient-to-br from-blue-400 to-indigo-600 text-white rounded-lg flex items-center justify-center shadow-md">
                    <Upload size={14} strokeWidth={2.5} />
                  </div>
                  Final Proof (Optional)
                </h4>
                {!finalFile ? (
                  <>
                    <input type="file" accept="image/*,application/pdf" onChange={(e) => handleFileChange(e, 'final')} className="hidden" id="final-upload" />
                    <label htmlFor="final-upload" className="w-full h-20 border-2 border-dashed border-slate-200 rounded-lg flex items-center justify-center cursor-pointer hover:bg-slate-50 transition-all"><Plus className="text-slate-400" /></label>
                  </>
                ) : (
                  <div className="relative w-24 h-24 group">
                    {finalFile.preview === 'pdf' ? (
                      <div className="w-full h-full bg-red-50 rounded-lg flex flex-col items-center justify-center text-red-600 border border-red-100">
                        <FileText size={32} />
                        <span className="text-xs font-bold mt-1">PDF</span>
                      </div>
                    ) : (
                      <img src={finalFile.preview} alt="Final proof" className="w-full h-full object-cover rounded-lg border border-slate-200 shadow-sm" />
                    )}
                    <button type="button" onClick={() => removeFile('final')} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1.5 shadow-lg hover:bg-red-600 transition-all scale-90 group-hover:scale-100"><X size={12} /></button>
                  </div>
                )}
              </div>
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full py-5 premium-gradient text-white rounded-xl font-black text-xl shadow-xl disabled:opacity-50 flex items-center justify-center gap-3 uppercase cursor-pointer">
            {loading ? <Loader2 className="animate-spin" size={28} /> : <>Submit Case <Check size={28} /></>}
          </button>
        </form>
      </div>
    </DashboardLayout>
  );
}
