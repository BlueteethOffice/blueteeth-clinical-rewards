'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { auth, db } from '@/lib/firebase';
import {
  updatePassword,
  reauthenticateWithCredential,
  EmailAuthProvider,
} from 'firebase/auth';
import { doc, updateDoc, getDoc } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Lock,
  Mail,
  Bell,
  Moon,
  Shield,
  Eye,
  EyeOff,
  Loader2,
  Smartphone,
  ChevronRight,
  Sun,
  Check
} from 'lucide-react';

const getPasswordStrength = (pw: string) => {
  let score = 0;
  if (pw.length >= 8) score++;
  if (/[A-Z]/.test(pw)) score++;
  if (/[a-z]/.test(pw)) score++;
  if (/\d/.test(pw)) score++;
  if (/[^A-Za-z0-9]/.test(pw)) score++;
  return score;
};

export default function SettingsPage() {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [pwStrength, setPwStrength] = useState(0);
  const [emailNotifs, setEmailNotifs] = useState(false);
  const [whatsappNotifs, setWhatsappNotifs] = useState(false);
  const [darkMode, setDarkMode] = useState(false);
  const [twoFAEnabled, setTwoFAEnabled] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme) {
      setDarkMode(savedTheme === 'dark');
    }

    if (!user) return;
    const loadSettings = async () => {
      try {
        const snap = await getDoc(doc(db, 'users', user.uid));
        if (snap.exists()) {
          const data = snap.data() as any;
          setEmailNotifs(!!data.emailNotifications);
          setWhatsappNotifs(!!data.whatsappAlerts);
          setTwoFAEnabled(!!data.twoFAEnabled);
          if (data.theme) {
            setDarkMode(data.theme === 'dark');
            localStorage.setItem('theme', data.theme);
          }
        }
      } catch (e) {}
    };
    loadSettings();
  }, [user]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentPassword) return toast.error('Enter current password');
    if (newPassword !== confirmPassword) return toast.error('Passwords do not match');
    if (getPasswordStrength(newPassword) < 3) return toast.error('Password too weak');

    setLoading(true);
    try {
      if (!auth.currentUser) throw new Error('No authenticated user');
      const credential = EmailAuthProvider.credential(user!.email!, currentPassword);
      await reauthenticateWithCredential(auth.currentUser, credential);
      await updatePassword(auth.currentUser, newPassword);
      toast.success('Security Key Updated');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err: any) {
      toast.error(err.message || 'Failed to update');
    } finally {
      setLoading(false);
    }
  };

  const saveNotificationPrefs = async () => {
    if (!user) return;
    try {
      await updateDoc(doc(db, 'users', user.uid), {
        emailNotifications: emailNotifs,
        whatsappAlerts: whatsappNotifs,
      });
      toast.success('Preferences Secured');
    } catch (e) {
      toast.error('Failed to save');
    }
  };

  const toggleDarkMode = async (mode: boolean) => {
    setDarkMode(mode);
    localStorage.setItem('theme', mode ? 'dark' : 'light');
    if (mode) document.documentElement.classList.add('dark');
    else document.documentElement.classList.remove('dark');
    
    if (user) {
      updateDoc(doc(db, 'users', user.uid), { theme: mode ? 'dark' : 'light' }).catch(() => {});
    }
  };

  useEffect(() => setPwStrength(getPasswordStrength(newPassword)), [newPassword]);

  if (!mounted) return null;

  return (
    <DashboardLayout>
      <div className="max-w-5xl mx-auto pb-10 px-2 sm:px-0">
        <div className="mb-6 sm:mb-10 mt-2 sm:mt-0">
          <h1 className="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white tracking-tighter uppercase">Settings & Identity</h1>
          <p className="text-slate-500 dark:text-slate-400 font-bold text-[8px] sm:text-[10px] uppercase tracking-[0.2em] mt-1">Configure your clinical workspace profile.</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8">
          {/* Security Card */}
          <div className="glass-card p-5 sm:p-8 rounded-xl border border-slate-100 dark:border-white/5 shadow-sm bg-white dark:bg-slate-900/40 order-2 lg:order-1">
            <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 sm:mb-8 flex items-center gap-3">
              <Lock size={16} className="text-rose-500" /> Security Credentials
            </h3>
            <form onSubmit={handleChangePassword} className="space-y-6">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Current Password</label>
                <div className="relative">
                  <input type={showCurrentPassword ? 'text' : 'password'} value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} placeholder="••••••••" className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-white/5 rounded-lg focus:border-rose-500 outline-none font-bold text-sm" />
                  <button type="button" onClick={() => setShowCurrentPassword(!showCurrentPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                    {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">New Password</label>
                <div className="relative">
                  <input type={showPassword ? 'text' : 'password'} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="••••••••" className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-white/5 rounded-lg focus:border-rose-500 outline-none font-bold text-sm" />
                  <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400">
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <div className="h-1 w-full bg-slate-100 dark:bg-slate-800 rounded-full overflow-hidden mt-3">
                  <div className={`h-full transition-all duration-500 ${pwStrength <= 2 ? 'bg-rose-500' : pwStrength === 3 ? 'bg-amber-500' : 'bg-emerald-500'}`} style={{ width: `${(pwStrength / 5) * 100}%` }} />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Confirm New Password</label>
                <input type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="••••••••" className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-white/5 rounded-lg focus:border-rose-500 outline-none font-bold text-sm" />
              </div>

              <button disabled={loading || !currentPassword} className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-black text-xs uppercase tracking-[0.2em] shadow-xl hover:scale-[1.01] transition-all disabled:opacity-50">
                {loading ? <Loader2 className="animate-spin mx-auto" size={18} /> : 'Update Security Key'}
              </button>
            </form>
          </div>

          <div className="space-y-6 sm:space-y-8 order-1 lg:order-2">
            {/* Visual Interface - REFINED */}
            <div className="glass-card p-5 sm:p-8 rounded-xl border border-slate-100 dark:border-white/5 shadow-sm bg-white dark:bg-slate-900/40">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                <Moon size={16} className="text-indigo-500" /> Workspace Theme
              </h3>
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <button 
                  onClick={() => toggleDarkMode(false)} 
                  className={`relative p-4 sm:p-5 rounded-xl border-2 transition-all flex flex-col items-center gap-3 ${!darkMode ? 'border-cyan-500 bg-cyan-50/20' : 'border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-slate-800/50'}`}
                >
                  {!darkMode && <div className="absolute top-2 right-2 w-4 h-4 sm:w-5 sm:h-5 bg-cyan-500 text-white rounded-full flex items-center justify-center shadow-lg animate-in"><Check size={10} strokeWidth={4} /></div>}
                  <Sun size={20} className={`sm:w-6 sm:h-6 ${!darkMode ? 'text-cyan-600' : 'text-slate-400'}`} />
                  <span className={`text-[9px] sm:text-[10px] font-black uppercase tracking-widest ${!darkMode ? 'text-cyan-600' : 'text-slate-500'}`}>Light Mode</span>
                </button>
                <button 
                  onClick={() => toggleDarkMode(true)} 
                  className={`relative p-4 sm:p-5 rounded-xl border-2 transition-all flex flex-col items-center gap-3 ${darkMode ? 'border-cyan-500 bg-cyan-500/10' : 'border-slate-100 dark:border-white/5 bg-slate-50 dark:bg-slate-800/50'}`}
                >
                  {darkMode && <div className="absolute top-2 right-2 w-4 h-4 sm:w-5 sm:h-5 bg-cyan-500 text-white rounded-full flex items-center justify-center shadow-lg animate-in"><Check size={10} strokeWidth={4} /></div>}
                  <Moon size={20} className={`sm:w-6 sm:h-6 ${darkMode ? 'text-cyan-400' : 'text-slate-400'}`} />
                  <span className={`text-[9px] sm:text-[10px] font-black uppercase tracking-widest ${darkMode ? 'text-cyan-400' : 'text-slate-500'}`}>Dark Mode</span>
                </button>
              </div>
            </div>

            {/* Notifications */}
            <div className="glass-card p-5 sm:p-8 rounded-xl border border-slate-100 dark:border-white/5 shadow-sm bg-white dark:bg-slate-900/40">
              <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-6 sm:mb-8 flex items-center gap-3">
                <Bell size={16} className="text-cyan-500" /> Delivery Channels
              </h3>
              <div className="space-y-4">
                {[
                  { id: 'email', label: 'Email Alerts', checked: emailNotifs, set: setEmailNotifs, icon: Mail },
                  { id: 'whatsapp', label: 'WhatsApp Alerts', checked: whatsappNotifs, set: setWhatsappNotifs, icon: Smartphone },
                ].map((item) => (
                  <div key={item.id} className="flex items-center justify-between p-3.5 sm:p-4 bg-slate-50 dark:bg-slate-800/50 rounded-xl border border-slate-100 dark:border-white/5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 sm:w-9 sm:h-9 bg-white dark:bg-slate-800 rounded-lg flex items-center justify-center border border-slate-100 dark:border-white/5 shadow-sm">
                        <item.icon size={16} className="sm:w-[18px] sm:h-[18px] text-slate-400" />
                      </div>
                      <span className="text-[9px] sm:text-[10px] font-black text-slate-600 dark:text-slate-400 uppercase tracking-widest">{item.label}</span>
                    </div>
                    <button onClick={() => item.set(!item.checked)} className={`w-10 sm:w-12 h-5 sm:h-6 rounded-full relative transition-all ${item.checked ? 'bg-cyan-500 shadow-lg shadow-cyan-500/20' : 'bg-slate-200 dark:bg-slate-700'}`}>
                      <div className={`absolute top-0.5 sm:top-1 w-4 h-4 bg-white rounded-full transition-all ${item.checked ? 'right-0.5 sm:right-1' : 'left-0.5 sm:left-1'}`} />
                    </button>
                  </div>
                ))}
                <button onClick={saveNotificationPrefs} className="w-full py-4 bg-cyan-600 text-white rounded-xl font-black text-xs uppercase tracking-[0.2em] hover:bg-cyan-700 transition-all shadow-xl shadow-cyan-900/10 active:scale-95 transition-transform">
                  Secure Preferences
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
