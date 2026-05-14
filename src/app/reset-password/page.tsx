'use client';

import { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { confirmPasswordReset, verifyPasswordResetCode } from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { motion } from 'framer-motion';
import { KeyRound, ShieldCheck, Loader2, CheckCircle2, AlertCircle, Eye, EyeOff } from 'lucide-react';
import toast from 'react-hot-toast';
import Link from 'next/link';

function ResetPasswordContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [oobCode, setOobCode] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [verifying, setVerifying] = useState(true);
  const [isValidCode, setIsValidCode] = useState(false);
  const [email, setEmail] = useState('');
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  useEffect(() => {
    const code = searchParams.get('oobCode');
    if (code) {
      setOobCode(code);
      // Verify the code is valid
      verifyPasswordResetCode(auth, code)
        .then((userEmail) => {
          setEmail(userEmail);
          setIsValidCode(true);
          setVerifying(false);
        })
        .catch((err) => {
          console.error("Invalid or expired code:", err);
          setIsValidCode(false);
          setVerifying(false);
        });
    } else {
      setVerifying(false);
      setIsValidCode(false);
    }
  }, [searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) return toast.error("Passwords do not match");
    if (newPassword.length < 6) return toast.error("Password must be at least 6 characters");
    if (!oobCode) return toast.error("Reset token missing");

    setLoading(true);
    try {
      await confirmPasswordReset(auth, oobCode, newPassword);
      setSuccess(true);
      toast.success("Password reset successfully!");
      setTimeout(() => router.push('/login'), 3000);
    } catch (err: any) {
      console.error("Reset failed:", err);
      toast.error(err.message || "Failed to reset password. The link may have expired.");
    } finally {
      setLoading(false);
    }
  };

  if (verifying) {
    return (
      <div className="flex flex-col items-center justify-center space-y-4">
        <Loader2 className="animate-spin text-cyan-500" size={40} />
        <p className="text-slate-500 font-bold uppercase text-[10px] tracking-wider">Verifying Secure Token...</p>
      </div>
    );
  }

  if (!isValidCode && !success) {
    return (
      <div className="text-center space-y-6">
        <div className="w-16 h-16 bg-rose-50 dark:bg-rose-900/20 rounded-full flex items-center justify-center text-rose-500 mx-auto">
          <AlertCircle size={32} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Invalid Link</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">This password reset link is invalid or has expired.</p>
        </div>
        <Link href="/login">
          <button className="w-full mt-4 py-3 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold text-sm">
            Back to Login
          </button>
        </Link>
      </div>
    );
  }

  if (success) {
    return (
      <div className="text-center space-y-6">
        <div className="w-16 h-16 bg-emerald-50 dark:bg-emerald-900/20 rounded-full flex items-center justify-center text-emerald-500 mx-auto">
          <CheckCircle2 size={32} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">Password Updated</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm mt-2">Your security credentials have been successfully updated. Redirecting to login...</p>
        </div>
        <Link href="/login">
          <button className="w-full mt-4 py-3 bg-cyan-600 text-white rounded-xl font-bold text-sm">
            Login Now
          </button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-3">
        <div className="w-12 h-12 premium-gradient rounded-lg flex items-center justify-center text-white shadow-md shadow-cyan-500/20">
          <ShieldCheck size={28} />
        </div>
        <div>
          <h2 className="text-2xl font-bold text-slate-800 dark:text-white">New Password</h2>
          <p className="text-slate-500 dark:text-slate-400 text-sm">Secure reset for {email}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">New Password</label>
          <div className="relative">
            <KeyRound size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-cyan-500" />
            <input
              type={showPassword ? "text" : "password"}
              required
              minLength={6}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full pl-12 pr-12 py-3.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none transition-all text-slate-900 dark:text-white font-medium"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
            >
              {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2">Confirm New Password</label>
          <div className="relative">
            <KeyRound size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-cyan-500/50" />
            <input
              type={showConfirmPassword ? "text" : "password"}
              required
              minLength={6}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full pl-12 pr-12 py-3.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none transition-all text-slate-900 dark:text-white font-medium"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors focus:outline-none"
            >
              {showConfirmPassword ? <EyeOff size={18} /> : <Eye size={18} />}
            </button>
          </div>
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full py-4 premium-gradient text-white rounded-xl font-bold shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
        >
          {loading ? <Loader2 className="animate-spin" size={20} /> : 'Update Password'}
        </button>
      </form>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#020617] flex items-center justify-center p-4 transition-colors">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md"
      >
        <div className="text-center mb-8">
          <h1 className="text-5xl font-bold mb-2 bg-gradient-to-r from-cyan-600 to-blue-700 bg-clip-text text-transparent tracking-tight drop-shadow-sm">
            Blueteeth
          </h1>
          <p className="text-cyan-800/80 dark:text-cyan-500/60 font-bold tracking-[0.15em] uppercase text-xs mt-3 transition-colors">
            Secure Credential Reset
          </p>
        </div>

        <div className="glass-card p-8 rounded-3xl border border-slate-200 dark:border-white/5 bg-white dark:bg-slate-900/50 shadow-xl transition-all">
          <Suspense fallback={
            <div className="flex flex-col items-center justify-center space-y-4">
              <Loader2 className="animate-spin text-cyan-500" size={40} />
              <p className="text-slate-500 font-bold uppercase text-[10px] tracking-wider">Initializing Secure Reset...</p>
            </div>
          }>
            <ResetPasswordContent />
          </Suspense>
        </div>
      </motion.div>
    </div>
  );
}
