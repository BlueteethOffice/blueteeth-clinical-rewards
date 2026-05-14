'use client';

import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, serverTimestamp, doc, setDoc, updateDoc } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { sendSystemNotification } from '@/lib/notifications';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  User, 
  Stethoscope, 
  MapPin, 
  FileText, 
  Upload, 
  Loader2,
  X,
  Plus,
  Check,
  AlertCircle,
  IndianRupee,
  Activity,
  ChevronDown,
  Phone
} from 'lucide-react';
import { TREATMENT_POINTS } from '@/types';

const formSchema = z.object({
  patientName: z.string().min(2, 'Patient name must be at least 2 characters'),
  mobile: z.string().length(10, 'Mobile number must be exactly 10 digits').regex(/^\d+$/, 'Only numbers allowed'),
  age: z.string().refine((val) => !isNaN(Number(val)) && Number(val) >= 1 && Number(val) <= 100, 'Age must be between 1 and 100'),
  gender: z.union([z.literal('Male'), z.literal('Female'), z.literal('Other')]),
  treatmentType: z.string().min(1, 'Please select treatment type'),
  treatmentCharge: z.string().min(1, 'Please enter treatment charge').regex(/^\d+$/, 'Only numbers allowed'),
  clinicLocation: z.string().min(3, 'Please enter clinic location'),
  bookingDate: z.string().min(1, 'Please select booking date'),
  notes: z.string().optional(),
});

type FormData = z.infer<typeof formSchema>;

export default function SubmitCasePage() {
  const { user, firebaseUser } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [files, setFiles] = useState<{ file: File; preview: string }[]>([]);
  const [showTreatments, setShowTreatments] = useState(false);

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
      gender: '' as any,
      bookingDate: new Date().toISOString().split('T')[0],
    }
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setFiles([{
        file,
        preview: file.type.includes('image') ? URL.createObjectURL(file) : 'pdf'
      }]);
    }
  };

  const removeFile = (index: number) => {
    const newFiles = [...files];
    URL.revokeObjectURL(newFiles[index].preview);
    newFiles.splice(index, 1);
    setFiles(newFiles);
  };

  const onSubmit = async (data: FormData) => {
    if (files.length === 0) return toast.error('Please upload initial proof');
    if (!user) return toast.error('Auth Error');

    setLoading(true);
    
    try {
      // 🚀 TURBO MODE: Start the process and redirect IMMEDIATELY
      const newCaseRef = doc(collection(db, 'cases'));
      const caseId = newCaseRef.id;
      const formattedPatientName = data.patientName.trim().split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
      const points = TREATMENT_POINTS[data.treatmentType] || 0;
      const token = await firebaseUser?.getIdToken();

      // 🚀 LIGHTNING SUBMISSION: Save in background and redirect NOW
      const caseData = {
        ...data,
        id: caseId,
        patientName: formattedPatientName,
        age: Number(data.age),
        treatmentCharge: Number(data.treatmentCharge),
        associateId: user.uid,
        associateName: user.name || 'Anonymous',
        associateMobile: (user as any).phone || '',
        points,
        initialProof: [], 
        status: 'pending',
        sourceType: 'associate',
        createdAt: serverTimestamp(),
      };

      // Background Save
      const savePromise = setDoc(newCaseRef, caseData);

      // Instant Feedback & Redirect
      toast.success('Case Submitted! Syncing in background...');
      router.push('/dashboard/associate/my-cases');

      // 3. BACKGROUND SYNC (The heavy lifting)
      (async () => {
        try {
          // Wait for the main doc to be created first
          await savePromise;
          
          console.log(`[SYNC] Starting background upload for case: ${caseId}`);
          
          const uploadPromises = files.map(async (f) => {
            const upFormData = new FormData();
            upFormData.append('file', f.file);
            upFormData.append('caseId', caseId);
            
            const res = await fetch('/api/upload', {
              method: 'POST',
              headers: { 'Authorization': `Bearer ${token}` },
              body: upFormData,
            });

            if (!res.ok) {
              const errData = await res.json().catch(() => ({ error: 'Unknown upload error' }));
              throw new Error(errData.error || `Upload failed with status ${res.status}`);
            }

            const resData = await res.json();
            return resData.url;
          });

          const proofUrls = await Promise.all(uploadPromises);
          
          // Verify we have URLs
          const validUrls = proofUrls.filter(u => !!u);
          if (validUrls.length === 0) throw new Error("No valid URLs returned from upload");

          // Update doc with real URLs
          await updateDoc(newCaseRef, {
            initialProof: validUrls
          });

          console.log(`[SYNC] Successfully updated case ${caseId} with ${validUrls.length} proofs`);

          sendSystemNotification(user.uid, {
            title: 'Case Verified',
            message: `Evidence for ${formattedPatientName} processed successfully.`,
            type: 'success',
            link: `/dashboard/associate/my-cases?id=${caseId}`
          });
        } catch (bgErr: any) {
          console.error("🔥 [SYNC_CRITICAL] Background sync failed:", bgErr);
          
          sendSystemNotification(user.uid, {
            title: 'Upload Issue',
            message: `Evidence upload for ${formattedPatientName} failed. Please edit the case and re-upload.`,
            type: 'error',
            link: `/dashboard/associate/my-cases`
          });
        }
      })();

    } catch (err: any) {
      console.error("Submission Error:", err);
      toast.error(`Error: ${err.message}`);
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto pb-4 px-1 sm:px-0">
        <div className="mb-6 sm:mb-10">
          <h1 className="text-2xl sm:text-4xl font-bold text-slate-900 dark:text-white tracking-tight uppercase transition-colors">Submit New Case</h1>
          <p className="text-[10px] sm:text-base text-slate-500 dark:text-cyan-500/60 mt-1 sm:mt-2 font-bold uppercase tracking-wide italic transition-colors">Instant Clinical Submission Mode</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 sm:space-y-8 relative z-20">
          <div className="glass-card p-6 sm:p-10 rounded-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 sm:w-2 h-full bg-cyan-500" />
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mb-6 sm:mb-8 flex items-center gap-3 transition-colors">
              <div className="w-10 h-10 bg-gradient-to-br from-cyan-400 to-blue-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-cyan-200 dark:shadow-cyan-900/20">
                <User size={22} strokeWidth={2.5} />
              </div>
              Patient Information
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1 transition-colors">Patient Full Name</label>
                <input 
                  {...register('patientName')} 
                  placeholder="Rahul Sharma" 
                  onInput={(e) => {
                    const val = e.currentTarget.value;
                    e.currentTarget.value = val.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                  }}
                  className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none transition-all font-medium text-slate-900 dark:text-white" 
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1 transition-colors">Mobile</label>
                <div className="relative">
                  <Phone size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-orange-500" strokeWidth={2.5} />
                  <input {...register('mobile')} maxLength={10} placeholder="9876543210" className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none transition-all font-medium text-slate-900 dark:text-white" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1 transition-colors">Age</label>
                <div className="relative">
                  <Activity size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-violet-500" strokeWidth={2.5} />
                  <input {...register('age')} type="number" className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none transition-all font-medium text-slate-900 dark:text-white" />
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1 transition-colors">Gender</label>
                <select {...register('gender')} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-lg outline-none font-medium appearance-none cursor-pointer text-slate-900 dark:text-white transition-all">
                  <option value="" disabled>Select</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1 transition-colors">Date</label>
                <input {...register('bookingDate')} type="date" className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-lg outline-none font-medium text-slate-900 dark:text-white transition-all" />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="glass-card p-6 sm:p-10 rounded-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-blue-500" />
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-3 transition-colors">
                <div className="w-10 h-10 bg-gradient-to-br from-indigo-400 to-purple-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-indigo-200 dark:shadow-indigo-900/20">
                  <Stethoscope size={22} strokeWidth={2.5} />
                </div>
                Clinical Details
              </h3>
              <div className="space-y-6">
                <div className="relative">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1 transition-colors">Treatment Type</label>
                  <button type="button" onClick={() => setShowTreatments(!showTreatments)} className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-lg text-left flex items-center justify-between font-medium text-slate-900 dark:text-white transition-all">
                    <span>{watch('treatmentType') || 'Select Treatment'}</span>
                    <ChevronDown size={18} className={showTreatments ? 'rotate-180' : ''} />
                  </button>
                  <AnimatePresence>
                    {showTreatments && (
                      <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="absolute z-50 left-0 right-0 mt-2 bg-white dark:bg-slate-900 rounded-lg shadow-2xl border border-slate-100 dark:border-white/10 max-h-60 overflow-y-auto transition-colors">
                        {Object.keys(TREATMENT_POINTS).map(type => (
                          <button key={type} type="button" onClick={() => { setValue('treatmentType', type, { shouldValidate: true }); setShowTreatments(false); }} className="w-full px-5 py-3 text-left hover:bg-slate-50 dark:hover:bg-slate-800 text-sm font-medium border-b border-slate-50 dark:border-white/5 flex items-center justify-between text-slate-900 dark:text-white transition-all">
                            <span>{type}</span>
                            <span className="text-[10px] font-bold text-slate-400">{TREATMENT_POINTS[type]} PTS</span>
                          </button>
                        ))}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1 transition-colors">Charge (₹)</label>
                  <div className="relative">
                    <IndianRupee size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-500" strokeWidth={2.5} />
                    <input {...register('treatmentCharge')} className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-lg outline-none font-medium text-slate-900 dark:text-white transition-all" />
                  </div>
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1 transition-colors">Location</label>
                  <div className="relative">
                    <MapPin size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-rose-500" strokeWidth={2.5} />
                    <input 
                      {...register('clinicLocation')} 
                      onInput={(e) => {
                        const val = e.currentTarget.value;
                        e.currentTarget.value = val.split(' ').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
                      }}
                      className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-lg outline-none font-medium text-slate-900 dark:text-white transition-all" 
                    />
                  </div>
                </div>
                <div className="space-y-2 mt-4">
                  <label className="text-sm font-bold text-slate-700 dark:text-slate-300 ml-1 transition-colors">Clinical Notes (Optional)</label>
                  <textarea 
                    {...register('notes')} 
                    rows={3}
                    placeholder="Any specific instructions or clinical details..." 
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-white/5 rounded-lg outline-none font-medium resize-none text-slate-900 dark:text-white transition-all"
                  />
                </div>
              </div>
            </div>

            <div className="glass-card p-6 sm:p-10 rounded-xl relative overflow-hidden flex flex-col">
              <div className="absolute top-0 left-0 w-1.5 h-full bg-emerald-500" />
              <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-6 flex items-center gap-3 transition-colors">
                <div className="w-10 h-10 bg-gradient-to-br from-emerald-400 to-teal-600 text-white rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200 dark:shadow-emerald-900/20">
                  <Upload size={22} strokeWidth={2.5} />
                </div>
                Proof Upload
              </h3>
              <div className="flex-1 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-lg flex flex-col items-center justify-center p-8 relative hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-all">
                <input type="file" className="absolute inset-0 opacity-0 cursor-pointer" onChange={handleFileChange} accept="image/*,.pdf" />
                <Plus size={32} className="text-emerald-600 dark:text-emerald-500 mb-2" />
                <p className="text-slate-900 dark:text-slate-300 font-bold text-sm transition-colors">Upload Proof</p>
              </div>
              {files.length > 0 && (
                <div className="mt-4 flex gap-4">
                  {files.map((f, i) => (
                    <div key={i} className="relative w-20 h-20 group">
                      {f.preview === 'pdf' ? (
                        <div className="w-full h-full bg-red-50 rounded-lg flex flex-col items-center justify-center text-red-600 border border-red-100 shadow-sm">
                          <FileText size={24} />
                          <span className="text-[10px] font-bold">PDF</span>
                        </div>
                      ) : (
                        <img src={f.preview} alt="preview" className="w-full h-full object-cover rounded-lg border border-slate-200 shadow-sm transition-all" />
                      )}
                      <button type="button" onClick={() => removeFile(i)} className="absolute -top-2 -right-2 bg-red-500 text-white rounded-full p-1 shadow-lg scale-90 group-hover:scale-100 transition-all"><X size={12} /></button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <button type="submit" disabled={loading} className="w-full py-4 sm:py-5 premium-gradient text-white rounded-xl font-bold text-xl shadow-xl flex items-center justify-center gap-3 disabled:opacity-50">
            {loading ? <Loader2 className="animate-spin" size={28} /> : <>Submit Case <Check size={28} /></>}
          </button>
        </form>
      </div>
    </DashboardLayout>
  );
}
