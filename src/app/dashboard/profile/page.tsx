'use client';

import { useState, useEffect, useCallback } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import Cropper from 'react-easy-crop';
import { 
  User as UserIcon, 
  Phone, 
  Mail, 
  Hospital, 
  Camera, 
  Loader2, 
  Save, 
  Trash2,
  Briefcase,
  Activity,
  Lock,
  Unlock,
  Info,
  ZoomIn,
  ZoomOut,
  Check,
  X,
  Crop,
  Edit3,
  ShieldCheck
} from 'lucide-react';

const profileSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string().min(10, 'Mobile number must be at least 10 digits').max(12, 'Mobile number cannot exceed 12 digits').regex(/^\d+$/, 'Only numbers allowed'),
  age: z.string().refine((val) => !isNaN(Number(val)) && Number(val) >= 1 && Number(val) <= 100, 'Age must be between 1 and 100'),
  gender: z.union([z.literal('Male'), z.literal('Female'), z.literal('Other')]),
  clinicName: z.string().min(3, 'Clinic name must be at least 3 characters').optional().or(z.literal('')),
  clinicAddress: z.string().min(5, 'Clinic address must be at least 5 characters').optional().or(z.literal('')),
  registrationNumber: z.string().min(3, 'Registration number is required').optional().or(z.literal('')),
});

type ProfileFormData = z.infer<typeof profileSchema>;

async function getCroppedImg(imageSrc: string, pixelCrop: any): Promise<string> {
  const image = new Image();
  image.src = imageSrc;
  await new Promise((resolve) => { image.onload = resolve; });

  const canvas = document.createElement('canvas');
  const size = 300;
  canvas.width = size;
  canvas.height = size;

  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(
    image,
    pixelCrop.x, pixelCrop.y,
    pixelCrop.width, pixelCrop.height,
    0, 0,
    size, size
  );

  return canvas.toDataURL('image/jpeg', 0.7);
}

export default function ProfilePage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const [previewURL, setPreviewURL] = useState<string | null>(null);

  const [cropSrc, setCropSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileFormData>({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      name: user?.name || '',
      phone: user?.phone || '',
      age: user?.age?.toString() || '',
      gender: (user?.gender as any) || 'Male',
      clinicName: user?.clinicName || '',
      clinicAddress: user?.clinicAddress || '',
      registrationNumber: user?.registrationNumber || '',
    }
  });

  useEffect(() => {
    if (user) {
      reset({
        name: user.name,
        phone: user.phone,
        age: user.age?.toString() || '',
        gender: (user.gender as any) || 'Male',
        clinicName: user.clinicName || '',
        clinicAddress: user.clinicAddress || '',
        registrationNumber: user.registrationNumber || '',
      });
    }
  }, [user, reset]);

  const isNameLockedGlobal = !!user?.name;
  const isPhoneLockedGlobal = !!user?.phone;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const reader = new FileReader();
      reader.onload = () => {
        setCropSrc(reader.result as string);
        setCrop({ x: 0, y: 0 });
        setZoom(1);
      };
      reader.readAsDataURL(file);
      e.target.value = '';
    }
  };

  const onCropComplete = useCallback((_: any, croppedPixels: any) => {
    setCroppedAreaPixels(croppedPixels);
  }, []);

  const handleCropConfirm = async () => {
    if (!cropSrc || !croppedAreaPixels) return;
    setUploadingPhoto(true);
    setCropSrc(null);
    try {
      const croppedBase64 = await getCroppedImg(cropSrc, croppedAreaPixels);
      const sizeKB = Math.round((croppedBase64.length * 3) / 4 / 1024);
      if (sizeKB > 900) {
        toast.error('Image still too large after crop.');
        return;
      }
      setPreviewURL(croppedBase64);
      await updateDoc(doc(db, 'users', user!.uid), {
        photoURL: croppedBase64,
        updatedAt: serverTimestamp(),
      });
      toast.success('Profile photo updated!');
    } catch (err) {
      toast.error('Could not save photo.');
    } finally {
      setUploadingPhoto(false);
    }
  };

  const removePhoto = async () => {
    if (!confirm('Remove profile photo?')) return;
    try {
      await updateDoc(doc(db, 'users', user!.uid), { photoURL: null });
      setPreviewURL(null);
      toast.success('Photo removed');
    } catch (error) {
      toast.error('Failed to remove photo');
    }
  };

  const onSubmit = async (data: ProfileFormData) => {
    setLoading(true);
    try {
      const updatePayload: any = {
        age: Number(data.age),
        gender: data.gender,
        clinicName: data.clinicName,
        clinicAddress: data.clinicAddress,
        registrationNumber: user?.registrationNumber || data.registrationNumber, // Prevent overwriting if already exists
      };
      if (!isNameLockedGlobal) updatePayload.name = data.name;
      if (!isPhoneLockedGlobal) updatePayload.phone = data.phone;

      await updateDoc(doc(db, 'users', user!.uid), updatePayload);
      toast.success('Profile updated successfully');
      setIsEditing(false);
    } catch (error: any) {
      toast.error(error.message || 'Failed to update profile');
    } finally {
      setLoading(false);
    }
  };

  const currentPhoto = previewURL || user?.photoURL;

  const handleCancelEdit = () => {
    setIsEditing(false);
    reset(); // Revert back to original values
  };

  return (
    <>
    <DashboardLayout>
      <div className="max-w-5xl mx-auto pb-10 px-2 sm:px-0">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6 sm:mb-10 mt-2 sm:mt-0">
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tight">Profile Settings</h1>
            <p className="text-slate-500 dark:text-slate-400 mt-1 sm:mt-2 font-medium text-[10px] sm:text-sm">Manage your professional identity and clinical practice details.</p>
          </div>
          {!isEditing && (
            <button 
              onClick={() => setIsEditing(true)}
              className="flex items-center justify-center gap-2 px-6 py-4 sm:py-3 bg-slate-900 dark:bg-slate-800 text-white rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-800 dark:hover:bg-slate-700 transition-all shadow-lg w-full sm:w-auto"
            >
              <Edit3 size={16} /> Edit Profile
            </button>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 sm:gap-8">
          <div className="lg:col-span-1 space-y-6">
            <div className="glass-card p-5 sm:p-8 rounded-xl text-center border border-slate-100/50 dark:border-white/5 shadow-sm">
              <div className="relative w-28 h-28 sm:w-32 sm:h-32 mx-auto mb-6">
                <div className="w-full h-full bg-slate-100 dark:bg-slate-800 rounded-xl overflow-hidden border-4 border-white dark:border-slate-900 shadow-xl">
                  {currentPhoto ? (
                    <img src={currentPhoto} alt="Profile" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-slate-300 dark:text-slate-700 bg-slate-50 dark:bg-slate-900">
                      <UserIcon size={40} className="sm:w-12 sm:h-12" />
                    </div>
                  )}
                  {uploadingPhoto && (
                    <div className="absolute inset-0 bg-white/80 dark:bg-slate-900/80 flex items-center justify-center">
                      <Loader2 className="animate-spin text-cyan-600" size={28} />
                    </div>
                  )}
                </div>
                {isEditing && (
                  <label className="absolute -bottom-2 -right-2 w-10 h-10 bg-cyan-600 text-white rounded-lg flex items-center justify-center cursor-pointer shadow-lg hover:bg-cyan-700 transition-all border-4 border-white dark:border-slate-900">
                    <Camera size={18} />
                    <input type="file" className="hidden" onChange={handleFileSelect} accept="image/*" />
                  </label>
                )}
                {isEditing && currentPhoto && (
                  <button
                    onClick={removePhoto}
                    className="absolute -top-2 -right-2 w-8 h-8 bg-red-50 dark:bg-red-900/20 text-red-500 rounded-lg flex items-center justify-center hover:bg-red-500 hover:text-white transition-all shadow-sm border border-red-100 dark:border-red-900/30"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              <h2 className="text-lg sm:text-xl font-black text-slate-900 dark:text-white truncate">{user?.displayName || user?.name}</h2>
              <div className="inline-flex items-center gap-2 px-3 py-1 bg-cyan-50 dark:bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 rounded-lg text-[9px] sm:text-[10px] font-black uppercase mt-2 tracking-widest border border-cyan-100 dark:border-cyan-500/20">
                <Briefcase size={12} /> {user?.role}
              </div>

              <div className="mt-8 space-y-4 text-left">
                <div className="flex items-center gap-4 py-3 sm:p-3 sm:bg-slate-50 sm:dark:bg-slate-900/50 sm:rounded-xl sm:border sm:border-slate-100 sm:dark:border-white/5 border-b border-slate-100 dark:border-white/5 sm:border-b-0 last:border-0">
                  <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center shrink-0">
                    <Mail size={16} className="text-blue-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5">Email Identity</p>
                    <p className="text-xs font-bold text-slate-900 dark:text-white truncate">{user?.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-4 py-3 sm:p-3 sm:bg-slate-50 sm:dark:bg-slate-900/50 sm:rounded-xl sm:border sm:border-slate-100 sm:dark:border-white/5 border-b border-slate-100 dark:border-white/5 sm:border-b-0 last:border-0">
                  <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
                    <Phone size={16} className="text-emerald-500" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[8px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-widest mb-0.5">Mobile Contact</p>
                    <p className="text-xs font-bold text-slate-900 dark:text-white">+91 {user?.phone}</p>
                  </div>
                </div>
              </div>
            </div>

            <div className="glass-card p-5 sm:p-8 rounded-xl border border-slate-100/50 dark:border-white/5 shadow-sm relative overflow-hidden group">
              <div className="absolute -right-4 -top-4 w-20 h-20 bg-cyan-500/10 rounded-full blur-xl group-hover:bg-cyan-500/20 transition-all" />
              <h4 className="text-[10px] font-black text-slate-900 dark:text-white uppercase tracking-widest mb-6 flex items-center gap-2">
                <ShieldCheck size={16} className="text-emerald-500" /> Account Security
              </h4>
              <div className="space-y-5">
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-tight">Identity Verification</span>
                  <span className="px-2 py-1 bg-emerald-500/10 text-emerald-600 rounded text-[8px] font-black uppercase">Verified</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[9px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-tight">Data Encryption</span>
                  <span className="text-[8px] font-black text-slate-900 dark:text-white uppercase">AES-256 Active</span>
                </div>
              </div>
            </div>
          </div>

          <div className="lg:col-span-2">
            <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
              <div className="glass-card p-6 sm:p-8 rounded-xl relative overflow-hidden border border-slate-100/50 dark:border-white/5 shadow-sm">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
                  <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white uppercase tracking-widest flex items-center gap-3">
                    <Activity size={20} className="text-cyan-600" /> Personal Data
                  </h3>
                  <div className={`inline-flex items-center gap-1.5 text-[9px] font-black uppercase px-2.5 py-1 rounded-md transition-colors self-start sm:self-auto ${isEditing ? 'bg-amber-50 dark:bg-amber-500/10 text-amber-600' : 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600'}`}>
                    {isEditing ? <Unlock size={10} /> : <Lock size={10} />}
                    {isEditing ? 'Editing Mode' : 'Profile Locked'}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
                  {/* ... same inputs ... */}
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">Full Name</label>
                    <input {...register('name')} readOnly={isNameLockedGlobal || !isEditing} className={`w-full px-5 py-3.5 rounded-xl outline-none transition-all font-bold text-sm ${(isNameLockedGlobal || !isEditing) ? 'bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-white/5 text-slate-400 cursor-not-allowed' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-cyan-600 text-slate-900 dark:text-white'}`} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest flex items-center gap-2">Mobile Number</label>
                    <input {...register('phone')} readOnly={isPhoneLockedGlobal || !isEditing} maxLength={12} className={`w-full px-5 py-3.5 rounded-xl outline-none transition-all font-bold text-sm ${(isPhoneLockedGlobal || !isEditing) ? 'bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-white/5 text-slate-400 cursor-not-allowed' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-cyan-600 text-slate-900 dark:text-white'}`} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Age</label>
                    <input {...register('age')} type="number" readOnly={!isEditing} className={`w-full px-5 py-3.5 rounded-xl outline-none transition-all font-bold text-sm ${!isEditing ? 'bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-white/5 text-slate-400 cursor-not-allowed' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-cyan-600 text-slate-900 dark:text-white'}`} />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Gender</label>
                    <select {...register('gender')} disabled={!isEditing} className={`w-full px-5 py-3.5 rounded-xl outline-none transition-all font-bold text-sm appearance-none cursor-pointer ${!isEditing ? 'bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-white/5 text-slate-400 cursor-not-allowed' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-cyan-600 text-slate-900 dark:text-white'}`}><option value="Male">Male</option><option value="Female">Female</option><option value="Other">Other</option></select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Clinic / Hospital</label>
                    <input {...register('clinicName')} readOnly={!isEditing} placeholder="e.g. City Dental Hub" className={`w-full px-5 py-3.5 rounded-xl outline-none transition-all font-bold text-sm ${!isEditing ? 'bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-white/5 text-slate-400 cursor-not-allowed' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-cyan-600 text-slate-900 dark:text-white'}`} />
                  </div>
                  {user?.role === 'clinician' && (
                    <div className="space-y-2">
                      <label className="text-[11px] font-black text-purple-500 uppercase tracking-widest flex items-center gap-2">Reg. Number</label>
                      <input {...register('registrationNumber')} readOnly={!!user?.registrationNumber || !isEditing} className={`w-full px-5 py-3.5 rounded-xl outline-none transition-all font-black text-xs tracking-widest ${!!user?.registrationNumber ? 'bg-emerald-50/30 dark:bg-emerald-500/10 border border-emerald-100 dark:border-emerald-500/20 text-emerald-700 dark:text-emerald-400 cursor-not-allowed' : !isEditing ? 'bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-white/5 text-slate-400 cursor-not-allowed' : 'bg-purple-50/30 dark:bg-purple-500/10 border border-purple-100 dark:border-purple-500/20 text-slate-900 dark:text-white'}`} />
                    </div>
                  )}
                </div>
              </div>

              <div className="glass-card p-6 sm:p-8 rounded-xl border border-slate-100/50 dark:border-white/5 shadow-sm">
                <h3 className="text-base sm:text-lg font-black text-slate-900 dark:text-white uppercase tracking-widest mb-8 flex items-center gap-3">
                  <Hospital size={20} className="text-blue-600" /> Clinical Practice
                </h3>
                <div className="space-y-2">
                  <label className="text-[11px] font-black text-slate-400 uppercase tracking-widest">Clinic Address</label>
                  <textarea {...register('clinicAddress')} readOnly={!isEditing} rows={3} className={`w-full px-5 py-3.5 rounded-xl outline-none transition-all font-bold text-sm resize-none ${!isEditing ? 'bg-slate-50 dark:bg-slate-900/50 border border-slate-100 dark:border-white/5 text-slate-400 cursor-not-allowed' : 'bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 focus:border-blue-600 text-slate-900 dark:text-white'}`} />
                </div>
              </div>

              {isEditing && (
                <div className="flex flex-col sm:flex-row gap-4">
                  <button 
                    type="button" 
                    onClick={handleCancelEdit} 
                    className="px-8 py-4 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-rose-50 dark:hover:bg-rose-900/20 hover:text-rose-600 transition-all flex items-center justify-center gap-2 border border-slate-200 dark:border-white/5 active:scale-[0.98]"
                  >
                    <X size={16} /> Cancel
                  </button>
                  <button type="submit" disabled={loading} className="flex-1 py-4 bg-slate-900 dark:bg-slate-800 text-white rounded-xl font-black text-xs uppercase tracking-widest shadow-xl flex items-center justify-center gap-3">{loading ? <Loader2 className="animate-spin" size={20} /> : 'Save Profile'}</button>
                </div>
              )}
            </form>
          </div>
        </div>
      </div>
    </DashboardLayout>

    <AnimatePresence>
      {cropSrc && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[300] flex flex-col bg-slate-950/90 backdrop-blur-sm">
          <div className="flex items-center justify-between px-6 py-4 bg-slate-900 border-b border-slate-700 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 bg-cyan-600 rounded-lg flex items-center justify-center">
                <Crop size={16} className="text-white" />
              </div>
              <p className="text-sm font-black text-white uppercase tracking-widest">Crop Profile Photo</p>
            </div>
            <button onClick={() => setCropSrc(null)} className="w-9 h-9 bg-white/10 hover:bg-rose-500 text-white rounded-md flex items-center justify-center transition-all"><X size={18} /></button>
          </div>
          <div className="relative flex-1">
            <Cropper image={cropSrc} crop={crop} zoom={zoom} aspect={1} cropShape="round" showGrid={false} onCropChange={setCrop} onZoomChange={setZoom} onCropComplete={onCropComplete} />
          </div>
          <div className="shrink-0 bg-slate-900 border-t border-slate-700 px-6 py-4 flex flex-col sm:flex-row items-center gap-4">
            <div className="flex items-center gap-3 flex-1 w-full sm:w-auto">
              <ZoomOut size={16} className="text-slate-400 shrink-0" />
              <input type="range" min={1} max={3} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="w-full accent-cyan-500 cursor-pointer" />
              <ZoomIn size={16} className="text-slate-400 shrink-0" />
            </div>
            <div className="flex items-center gap-3 shrink-0">
              <button onClick={() => setCropSrc(null)} className="px-5 py-2.5 bg-white/10 text-white rounded-md text-xs font-black uppercase tracking-widest hover:bg-white/20 transition-all flex items-center gap-2"><X size={14} /> Cancel</button>
              <button onClick={handleCropConfirm} className="px-6 py-2.5 bg-cyan-600 text-white rounded-md text-xs font-black uppercase tracking-widest hover:bg-cyan-500 transition-all flex items-center gap-2 shadow-lg shadow-cyan-900/40"><Check size={14} /> Apply Crop</button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
    </>
  );
}
