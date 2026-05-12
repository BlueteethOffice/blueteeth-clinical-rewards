'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { uploadToCloudinary } from '@/lib/cloudinary';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, query, where, getDocs } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import toast from 'react-hot-toast';
import { sendSystemNotification } from '@/lib/notifications';
import { motion, AnimatePresence } from 'framer-motion';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase';
import { 
  User, 
  Phone, 
  Stethoscope, 
  MapPin, 
  Calendar, 
  FileText, 
  Upload, 
  Loader2,
  X,
  Plus,
  Trash2,
  Check,
  AlertCircle,
  IndianRupee,
  Activity,
  VenetianMask,
  ChevronDown
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
  const [dragActive, setDragActive] = useState(false);
  const [showTreatments, setShowTreatments] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    setValue,
    formState: { errors },
  } = useForm<FormData>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      treatmentType: '',
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
    if (files.length === 0) {
      return toast.error('Please upload initial proof');
    }

    if (!user) {
      return toast.error('Authentication error. Please re-login.');
    }

    setLoading(true);
    
    try {
      // 0. DUPLICATE ENTRY PREVENTION RULE
      // Check if this associate has already submitted the exact same treatment for this exact patient
      const casesRef = collection(db, 'cases');
      const duplicateQuery = query(
        casesRef, 
        where('associateId', '==', user.uid),
        where('mobile', '==', data.mobile) // Filter by mobile to reduce results
      );
      
      const existingCases = await getDocs(duplicateQuery);
      
      // In-memory verification to ensure EXACT match of all details
      const isDuplicate = existingCases.docs.some(doc => {
        const docData = doc.data();
        return (
          docData.patientName.toLowerCase().trim() === data.patientName.toLowerCase().trim() &&
          docData.age === Number(data.age) &&
          docData.gender === data.gender &&
          docData.treatmentType === data.treatmentType
        );
      });

      if (isDuplicate) {
        setLoading(false);
        return toast.error("Duplicate Entry! You have already submitted this exact treatment for this patient.");
      }

      console.log("🚀 Turbo Submission Started...");

      // 1. BULLETPROOF LOCAL UPLOAD (Bypasses Cloudinary 401 & Firebase Setup)
      const uploadPromises = files.map(async (f) => {
        const formData = new FormData();
        formData.append('file', f.file);
        
        // 🛡️ Get Token for Secure Upload
        const token = await firebaseUser?.getIdToken();
        const headers: Record<string, string> = {};
        if (token) headers['Authorization'] = `Bearer ${token}`;

        const res = await fetch('/api/upload', {
          method: 'POST',
          headers,
          body: formData,
        });
        
        if (!res.ok) {
          throw new Error("Internal server upload failed.");
        }
        
        const data = await res.json();
        return data.url;
      });
      const proofUrls = await Promise.all(uploadPromises);

      const points = TREATMENT_POINTS[data.treatmentType] || 0;

      // Auto-capitalize Patient Name (Title Case) e.g., "rahul kumar" -> "Rahul Kumar"
      const formattedPatientName = data.patientName
        .trim()
        .split(' ')
        .filter(word => word.length > 0)
        .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
        .join(' ');

      // 2. INSTANT FIRESTORE SAVE (Small Document = Fast Sync)
      const docRef = await addDoc(collection(db, 'cases'), {
        ...data,
        patientName: formattedPatientName,
        age: Number(data.age),
        treatmentCharge: Number(data.treatmentCharge),
        associateId: user.uid,
        associateName: user.name || 'Anonymous',
        associateMobile: (user as any).phone || '',
        points,
        initialProof: proofUrls,
        status: 'pending',
        sourceType: 'associate',
        createdAt: serverTimestamp(),
      });

      // 3. ASYNC NOTIFICATIONS (Parallel)
      const notifyUsers = async () => {
        try {
          // Notify Associate (Self)
          const selfNotify = sendSystemNotification(user.uid, {
            title: 'Case Submitted Successfully',
            message: `Your case for ${formattedPatientName} (${data.treatmentType}) has been submitted for review.`,
            type: 'success',
            link: '/dashboard/associate/my-cases'
          });

          // Notify Admins
          const adminQuery = query(collection(db, 'users'), where('role', '==', 'admin'));
          const adminSnapshot = await getDocs(adminQuery);
          const adminNotifications = adminSnapshot.docs.map(adminDoc => 
            sendSystemNotification(adminDoc.id, {
              title: 'New Case Submitted',
              message: `Associate ${user.name} has submitted a new case for ${formattedPatientName} (${data.treatmentType}).`,
              type: 'info'
            })
          );

          await Promise.all([selfNotify, ...adminNotifications]);
        } catch (e) {
          console.error("Background notification failed:", e);
        }
      };

      notifyUsers(); // Start in background
      toast.success('Case Submitted Successfully!');
      router.push('/dashboard/associate/my-cases');
    } catch (err: any) {
      console.error("🔥 Submission Error:", err);
      toast.error(`Upload Failed: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto pb-4 px-1 sm:px-0">
        <div className="mb-6 sm:mb-10">
          <h1 className="text-2xl sm:text-4xl font-black text-slate-900 dark:text-white tracking-tight uppercase">Submit New Case</h1>
          <p className="text-[10px] sm:text-base text-slate-500 mt-1 sm:mt-2 font-bold uppercase tracking-wide">Enter patient details and upload clinical evidence for approval.</p>
        </div>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 sm:space-y-8">
          {/* Patient Details Section */}
          <div className="glass-card p-6 sm:p-10 rounded-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 w-1.5 sm:w-2 h-full bg-cyan-500" />
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mb-6 sm:mb-8 flex items-center gap-3">
              <div className="w-9 h-9 sm:w-10 sm:h-10 bg-cyan-100 dark:bg-cyan-900/30 text-cyan-600 rounded-lg flex items-center justify-center shadow-sm shadow-cyan-200 dark:shadow-none">
                <User size={22} strokeWidth={2.5} className="w-5 h-5 sm:w-5.5 sm:h-5.5" />
              </div>
              Patient Information
            </h3>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              <div className="space-y-2 md:col-span-2">
                <label className="text-sm font-bold text-slate-700 ml-1">Patient Full Name</label>
                <div className="relative">
                  <input
                    {...register('patientName')}
                    placeholder="e.g. Rahul Sharma"
                    required
                    className={`w-full px-4 sm:px-5 py-3 sm:py-4 bg-slate-50 dark:bg-slate-900/50 border ${errors.patientName ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-200 dark:border-white/10'} rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none transition-all font-medium text-slate-900 dark:text-white placeholder:text-slate-400`}
                  />
                  {errors.patientName && <p className="text-xs text-red-500 mt-1.5 font-bold flex items-center gap-1"><AlertCircle size={12} /> {errors.patientName.message}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 ml-1">Mobile Number</label>
                <div className="relative">
                  <span className="absolute left-5 top-1/2 -translate-y-1/2 text-slate-400 font-bold text-sm">+91</span>
                  <input
                    {...register('mobile')}
                    maxLength={10}
                    placeholder="9876543210"
                    required
                    className={`w-full pl-12 sm:pl-14 pr-4 sm:pr-5 py-3 sm:py-4 bg-slate-50 dark:bg-slate-900/50 border ${errors.mobile ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-200 dark:border-white/10'} rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none transition-all font-medium text-slate-900 dark:text-white placeholder:text-slate-400`}
                  />
                  {errors.mobile && <p className="text-xs text-red-500 mt-1.5 font-bold flex items-center gap-1"><AlertCircle size={12} /> {errors.mobile.message}</p>}
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 ml-1">Age</label>
                <input
                  {...register('age')}
                  type="number"
                  min="1"
                  max="100"
                  onInput={(e) => {
                    if (Number(e.currentTarget.value) > 100) e.currentTarget.value = '100';
                    if (Number(e.currentTarget.value) < 0) e.currentTarget.value = '1';
                  }}
                  placeholder="25"
                  required
                  className={`w-full px-4 sm:px-5 py-3 sm:py-4 bg-slate-50 dark:bg-slate-900/50 border ${errors.age ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-200 dark:border-white/10'} rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none transition-all font-medium text-slate-900 dark:text-white`}
                />
                {errors.age && <p className="text-xs text-red-500 mt-1.5 font-bold flex items-center gap-1"><AlertCircle size={12} /> {errors.age.message}</p>}
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 ml-1">Gender</label>
                <select
                  {...register('gender')}
                  required
                  className="w-full px-4 sm:px-5 py-3 sm:py-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none transition-all font-medium appearance-none cursor-pointer text-slate-900 dark:text-white"
                >
                  <option value="" disabled>Select Gender</option>
                  <option value="Male">Male</option>
                  <option value="Female">Female</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-bold text-slate-700 ml-1">Treatment Date</label>
                <input
                  {...register('bookingDate')}
                  type="date"
                  max={new Date().toISOString().split('T')[0]}
                  className={`w-full px-4 sm:px-5 py-3 sm:py-4 bg-slate-50 dark:bg-slate-900/50 border ${errors.bookingDate ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-200 dark:border-white/10'} rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none transition-all font-medium text-slate-900 dark:text-white`}
                />
                {errors.bookingDate && <p className="text-xs text-red-500 mt-1.5 font-bold flex items-center gap-1"><AlertCircle size={12} /> {errors.bookingDate.message}</p>}
              </div>
            </div>
          </div>

          {/* Treatment Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="glass-card p-6 sm:p-10 rounded-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 w-1.5 sm:w-2 h-full bg-blue-500" />
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mb-6 sm:mb-8 flex items-center gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-lg flex items-center justify-center shadow-sm shadow-blue-200 dark:shadow-none">
                  <Stethoscope size={22} strokeWidth={2.5} className="w-5 h-5 sm:w-5.5 sm:h-5.5" />
                </div>
                Clinical Details
              </h3>

              <div className="space-y-6">
                <div className="space-y-2 relative">
                  <label className="text-sm font-bold text-slate-700 ml-1">Treatment Type</label>
                  <div className="relative">
                    <button
                      type="button"
                      onClick={() => setShowTreatments(!showTreatments)}
                      className={`w-full px-4 sm:px-5 py-3 sm:py-4 bg-slate-50 dark:bg-slate-900/50 border ${errors.treatmentType ? 'border-red-500' : 'border-slate-200 dark:border-white/10'} rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-left flex items-center justify-between text-slate-900 dark:text-white`}
                    >
                      <span className="truncate">{watch('treatmentType') ? `${watch('treatmentType')} (${TREATMENT_POINTS[watch('treatmentType')]} Points)` : 'Select Treatment'}</span>
                      <ChevronDown size={18} className={`shrink-0 text-slate-400 transition-transform ${showTreatments ? 'rotate-180' : ''}`} />
                    </button>
                    
                    <AnimatePresence>
                      {showTreatments && (
                        <motion.div
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -10 }}
                          className="absolute z-50 left-0 right-0 mt-2 bg-white dark:bg-slate-800 rounded-lg shadow-2xl border border-slate-100 dark:border-white/5 overflow-hidden max-h-60 overflow-y-auto"
                        >
                          {Object.keys(TREATMENT_POINTS).map(type => (
                            <button
                              key={type}
                              type="button"
                              onClick={() => {
                                setValue('treatmentType', type);
                                setShowTreatments(false);
                              }}
                              className="w-full px-5 py-3 text-left hover:bg-slate-50 dark:hover:bg-white/5 transition-all text-sm font-medium border-b border-slate-50 dark:border-white/5 last:border-none flex items-center justify-between group"
                            >
                              <span className={watch('treatmentType') === type ? 'text-blue-600 font-bold' : 'text-slate-600 dark:text-slate-300'}>{type}</span>
                              <span className="text-[10px] font-black text-slate-400 group-hover:text-blue-500">{TREATMENT_POINTS[type]} PTS</span>
                            </button>
                          ))}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                  {errors.treatmentType && <p className="text-xs text-red-500 mt-1.5 font-bold">{errors.treatmentType.message}</p>}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Treatment Charge (₹)</label>
                  <div className="relative">
                    <IndianRupee className="absolute left-5 top-1/2 -translate-y-1/2 text-amber-500" size={18} strokeWidth={2.5} />
                    <input
                      {...register('treatmentCharge')}
                      placeholder="5000"
                      required
                      className={`w-full pl-10 sm:pl-12 pr-4 sm:pr-5 py-3 sm:py-4 bg-slate-50 dark:bg-slate-900/50 border ${errors.treatmentCharge ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-200 dark:border-white/10'} rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-slate-900 dark:text-white`}
                    />
                  </div>
                  {errors.treatmentCharge && <p className="text-xs text-red-500 mt-1.5 font-bold flex items-center gap-1"><AlertCircle size={12} /> {errors.treatmentCharge.message}</p>}
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-bold text-slate-700 ml-1">Clinic Location</label>
                  <div className="relative">
                    <MapPin className="absolute left-5 top-1/2 -translate-y-1/2 text-rose-500" size={18} strokeWidth={2.5} />
                    <input
                      {...register('clinicLocation')}
                      placeholder="e.g. South Ext, New Delhi"
                      required
                      className={`w-full pl-10 sm:pl-12 pr-4 sm:pr-5 py-3 sm:py-4 bg-slate-50 dark:bg-slate-900/50 border ${errors.clinicLocation ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-200 dark:border-white/10'} rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition-all font-medium text-slate-900 dark:text-white`}
                    />
                  </div>
                  {errors.clinicLocation && <p className="text-xs text-red-500 mt-1.5 font-bold flex items-center gap-1"><AlertCircle size={12} /> {errors.clinicLocation.message}</p>}
                </div>
              </div>
            </div>

            {/* Upload Section */}
            <div className="glass-card p-6 sm:p-10 rounded-xl relative overflow-hidden flex flex-col">
              <div className="absolute top-0 left-0 w-1.5 sm:w-2 h-full bg-emerald-500" />
              <h3 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white mb-6 sm:mb-8 flex items-center gap-3">
                <div className="w-9 h-9 sm:w-10 sm:h-10 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-lg flex items-center justify-center shadow-sm shadow-emerald-200 dark:shadow-none">
                  <Upload size={22} strokeWidth={2.5} className="w-5 h-5 sm:w-5.5 sm:h-5.5" />
                </div>
                Initial Proof Upload
              </h3>

              <div 
                className={`flex-1 border-2 border-dashed rounded-lg flex flex-col items-center justify-center p-8 transition-all relative ${
                  dragActive ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 hover:border-emerald-300 hover:bg-slate-50'
                }`}
                onDragOver={(e) => { e.preventDefault(); setDragActive(true); }}
                onDragLeave={() => setDragActive(false)}
                onDrop={(e) => {
                  e.preventDefault();
                  setDragActive(false);
                  if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    const file = e.dataTransfer.files[0];
                    setFiles([{
                      file,
                      preview: file.type.includes('image') ? URL.createObjectURL(file) : 'pdf'
                    }]);
                  }
                }}
              >
                <input 
                  type="file" 
                  className="absolute inset-0 opacity-0 cursor-pointer" 
                  onChange={handleFileChange}
                  accept="image/*,.pdf"
                />
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center mb-4">
                  <Plus size={32} className="w-6 h-6 sm:w-8 sm:h-8" />
                </div>
                <p className="text-slate-900 dark:text-white font-bold text-sm sm:text-base">Drop file here or click to upload</p>
                <p className="text-slate-400 text-[10px] sm:text-xs mt-1 font-medium text-center">Supported: JPG, PNG, PDF (Max 5MB)</p>
              </div>

              {files.length > 0 && (
                <div className="mt-6 grid grid-cols-4 gap-4">
                  {files.map((f, i) => (
                    <motion.div 
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      key={i} 
                      className="relative group aspect-square"
                    >
                      {f.preview === 'pdf' ? (
                        <div className="w-full h-full bg-red-50 rounded-xl flex flex-col items-center justify-center text-red-600 border border-red-100 shadow-sm">
                          <FileText size={28} strokeWidth={2.5} />
                          <span className="text-[10px] font-black mt-1">PDF</span>
                        </div>
                      ) : (
                        <img src={f.preview} alt={`Proof document ${i + 1}`} className="w-full h-full object-cover rounded-xl border border-slate-100 shadow-sm" />
                      )}
                      <button 
                        type="button"
                        onClick={() => removeFile(i)}
                        className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 text-white rounded-full flex items-center justify-center shadow-lg opacity-0 group-hover:opacity-100 transition-all scale-75 group-hover:scale-100"
                      >
                        <X size={12} />
                      </button>
                    </motion.div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="glass-card p-10 rounded-xl">
            <h3 className="text-sm font-bold text-slate-700 mb-4 flex items-center gap-2">
              <FileText size={16} className="text-slate-400" /> Additional Notes (Optional)
            </h3>
            <textarea
              {...register('notes')}
              rows={4}
              placeholder="Any specific details about the patient's condition or treatment requirement..."
              className="w-full px-5 py-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 rounded-lg focus:ring-2 focus:ring-cyan-500 outline-none transition-all font-medium placeholder:text-slate-400 resize-none text-slate-900 dark:text-white"
            />
          </div>

          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            type="submit"
            disabled={loading}
            className="w-full py-4 sm:py-5 premium-gradient text-white rounded-lg font-black text-lg sm:text-xl shadow-2xl shadow-cyan-500/30 dark:shadow-none flex items-center justify-center gap-3 hover:opacity-90 transition-all disabled:opacity-50"
          >
            {loading ? (
              <Loader2 className="animate-spin" size={28} />
            ) : (
              <>Submit Clinical Case <Check size={28} className="w-6 h-6 sm:w-7 sm:h-7" /></>
            )}
          </motion.button>
        </form>
      </div>
    </DashboardLayout>
  );
}
