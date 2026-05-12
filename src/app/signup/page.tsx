'use client';

import { useState, useEffect, useRef } from 'react';
import { createUserWithEmailAndPassword, fetchSignInMethodsForEmail } from 'firebase/auth';
import { doc, setDoc, collection, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { auth, db } from '@/lib/firebase';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  UserPlus, 
  Mail, 
  Lock, 
  User, 
  Phone, 
  Briefcase, 
  Loader2, 
  CheckCircle2, 
  ShieldCheck,
  ArrowRight,
  ChevronLeft,
  Timer
} from 'lucide-react';
import { UserRole } from '@/types';
import { cleanName } from '@/lib/utils';

type SignupStep = 'details' | 'otp' | 'success';

export default function SignupPage() {
  const [step, setStep] = useState<SignupStep>('details');
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    password: '',
    phone: '',
    role: 'associate' as UserRole,
    registrationNumber: '',
  });
  
  const [otp, setOtp] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const otpRefs = useRef<(HTMLInputElement | null)[]>([]);
  const router = useRouter();

  // Handle OTP countdown
  useEffect(() => {
    let timer: any;
    if (countdown > 0) {
      timer = setInterval(() => setCountdown(c => c - 1), 1000);
    }
    return () => clearInterval(timer);
  }, [countdown]);

  const sendOTP = async () => {
    setLoading(true);
    try {
      // 🛡️ Pre-check: Is email already taken?
      const cleanEmail = formData.email.trim().toLowerCase();
      const methods = await fetchSignInMethodsForEmail(auth, cleanEmail).catch(() => []);
      if (methods.length > 0) {
        throw new Error('This email is already registered. Please login instead.');
      }

      const res = await fetch('/api/auth/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: cleanEmail, 
          name: formData.name, 
          action: 'send' 
        }),
      });
      
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to send verification code');
      
      setStep('otp');
      setCountdown(60);
      toast.success('Verification code sent to your email');
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const verifyAndSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    const fullOtp = otp.join('');
    if (fullOtp.length !== 6) return toast.error('Enter 6-digit code');

    setLoading(true);
    try {
      const cleanEmail = formData.email.trim().toLowerCase();
      const verifyRes = await fetch('/api/auth/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: cleanEmail, 
          otp: fullOtp, 
          action: 'verify' 
        }),
      });

      const verifyData = await verifyRes.json();
      if (!verifyRes.ok) throw new Error(verifyData.error || 'Invalid code');

      const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, formData.password);
      const user = userCredential.user;

      const finalName = cleanName(formData.name);
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        name: finalName,
        email: cleanEmail,
        phone: formData.phone,
        role: formData.role,
        createdAt: new Date(),
        emailVerified: true,
        registrationNumber: formData.role === 'clinician' ? formData.registrationNumber : null
      });
      
      // ✅ SECURITY: Pass token for authenticated welcome email
      const token = await user.getIdToken();
      fetch('/api/auth/welcome', {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ email: cleanEmail, name: finalName }),
      }).catch((e) => console.error("Welcome email trigger failed:", e));

      setStep('success');
      setTimeout(() => router.push('/dashboard'), 2000);
    } catch (error: any) {
      let msg = error.message || 'Signup failed';
      if (error.code === 'auth/email-already-in-use') {
        msg = 'This email is already in use. Please login.';
      }
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleOtpChange = (index: number, value: string) => {
    if (value.length > 1) return;
    const newOtp = [...otp];
    newOtp[index] = value;
    setOtp(newOtp);

    // Auto focus next
    if (value && index < 5) {
      otpRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !otp[index] && index > 0) {
      otpRefs.current[index - 1]?.focus();
    }
  };

  return (
    <div className="min-h-fit sm:min-h-screen bg-slate-50 flex items-start sm:items-center justify-center px-4 pt-6 pb-3 sm:py-12 mesh-bg relative overflow-y-auto overflow-x-hidden">
      {/* Background Decorative Elements */}
      <div className="absolute top-0 left-0 w-full h-full pointer-events-none">
        <div className="absolute top-[-10%] left-[-5%] w-[40%] h-[40%] bg-cyan-400/5 rounded-full blur-[120px]" />
        <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] bg-blue-400/5 rounded-full blur-[120px]" />
      </div>

      <div className="w-full max-w-md relative z-10 mt-4 sm:mt-0">
        <div className="flex flex-col items-center text-center mb-5 sm:mb-10">
          <Link href="/" className="group mb-3 sm:mb-4">
            <h1 className="text-4xl sm:text-5xl font-black mb-2 bg-gradient-to-r from-cyan-600 to-blue-700 bg-clip-text text-transparent tracking-tight drop-shadow-sm uppercase">
              BLUETEETH
            </h1>
          </Link>
          
          <div className="inline-flex items-center gap-2 px-4 sm:px-6 py-2 bg-white text-cyan-600 rounded-full text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.2em] sm:tracking-[0.35em] border border-slate-100 shadow-sm">
            <ShieldCheck size={12} /> Secure Authentication
          </div>
        </div>

        <div className="bg-white/90 backdrop-blur-xl p-5 sm:p-8 rounded-lg shadow-2xl shadow-slate-200/50 border border-white relative overflow-hidden">
          <AnimatePresence mode="wait">
            {step === 'details' && (
              <div
                key="details"
              >
                <div className="flex items-center gap-3 sm:gap-4 mb-6 sm:mb-10">
                  <div className="w-12 h-12 sm:w-14 sm:h-14 premium-gradient text-white rounded-lg flex items-center justify-center shadow-lg shadow-cyan-500/20 shrink-0">
                    <UserPlus size={24} className="sm:hidden" />
                    <UserPlus size={28} className="hidden sm:block" />
                  </div>
                  <div className="min-w-0 text-left">
                    <h2 className="text-xl sm:text-2xl font-black text-slate-900 tracking-tight">Create Account</h2>
                    <p className="text-slate-400 text-[10px] font-bold uppercase tracking-[0.2em] mt-1">Enterprise Registration</p>
                  </div>
                </div>
                
                <form onSubmit={(e) => { e.preventDefault(); sendOTP(); }} className="space-y-4 sm:space-y-5">
                  <div className="grid grid-cols-1 gap-4 sm:gap-5">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">Full Name</label>
                      <div className="relative group">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 text-cyan-500 transition-colors" size={18} />
                        <input
                          type="text" required
                          value={formData.name}
                          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                          className="w-full pl-12 pr-4 py-3.5 sm:py-4 bg-slate-50 border border-slate-100 rounded-lg focus:border-cyan-600/50 focus:bg-white focus:ring-4 focus:ring-cyan-500/5 outline-none transition-all font-bold text-sm"
                          placeholder={formData.role === 'clinician' ? "Amit Sharma (Dr. will be added)" : "John Doe"}
                        />
                      </div>
                      {formData.name && (
                        <p className="text-[9px] text-cyan-600 font-bold uppercase tracking-tight pl-1">
                          Platform Display: {formData.role === 'clinician' ? `Dr. ${cleanName(formData.name)}` : cleanName(formData.name)}
                        </p>
                      )}
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">Email Address</label>
                      <div className="relative group">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-blue-500 transition-colors" size={18} />
                        <input
                          type="email" required
                          value={formData.email}
                          onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                          className={`w-full pl-12 pr-4 py-3.5 sm:py-4 bg-slate-50 border rounded-lg focus:bg-white focus:ring-4 focus:ring-cyan-500/5 outline-none transition-all font-bold text-sm ${
                            formData.email && !/^\S+@\S+\.\S+$/.test(formData.email) 
                            ? 'border-rose-400 focus:border-rose-500' 
                            : 'border-slate-100 focus:border-cyan-600/50'
                          }`}
                          placeholder="name@clinic.com"
                        />
                      </div>
                      {formData.email && !/^\S+@\S+\.\S+$/.test(formData.email) && (
                        <p className="text-[9px] text-rose-500 font-bold uppercase tracking-tight pl-1">Please enter a valid clinical email</p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">Mobile</label>
                        <div className="relative group">
                          <Phone className="absolute left-4 top-1/2 -translate-y-1/2 text-emerald-500 transition-colors" size={18} />
                          <input
                            type="tel" required
                            value={formData.phone}
                            onChange={(e) => {
                              const val = e.target.value.replace(/\D/g, ''); // Numbers only
                              if (val.length <= 12) {
                                setFormData({ ...formData, phone: val });
                              }
                            }}
                            className="w-full pl-12 pr-4 py-3.5 sm:py-4 bg-slate-50 border border-slate-100 rounded-lg focus:border-cyan-600/50 focus:bg-white focus:ring-4 focus:ring-cyan-500/5 outline-none transition-all font-bold text-sm"
                            placeholder="12 Digit Max"
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">Role</label>
                        <div className="relative group">
                          <Briefcase className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-500 transition-colors pointer-events-none" size={18} />
                          <select
                            value={formData.role}
                            onChange={(e) => setFormData({ ...formData, role: e.target.value as UserRole })}
                            className="w-full pl-12 pr-8 py-3.5 sm:py-4 bg-slate-50 border border-slate-100 rounded-lg focus:border-cyan-600/50 focus:bg-white focus:ring-4 focus:ring-cyan-500/5 outline-none transition-all font-bold text-sm cursor-pointer appearance-none"
                          >
                            <option value="associate">Associate</option>
                            <option value="clinician">Clinician</option>
                          </select>
                        </div>
                        {formData.role === 'clinician' && (
                          <p className="text-[8px] text-purple-500 font-black uppercase tracking-widest pl-1 animate-pulse">Medical Prefix "Dr." Enabled</p>
                        )}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] pl-1">Secret Password</label>
                      <div className="relative group">
                        <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-rose-500 transition-colors" size={18} />
                        <input
                          type="password" required
                          minLength={6}
                          value={formData.password}
                          onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                          className="w-full pl-12 pr-4 py-3.5 sm:py-4 bg-slate-50 border border-slate-100 rounded-lg focus:border-cyan-600/50 focus:bg-white focus:ring-4 focus:ring-cyan-500/5 outline-none transition-all font-bold text-sm"
                          placeholder="Min 6 characters"
                        />
                      </div>
                      {formData.password && formData.password.length < 6 && (
                        <p className="text-[9px] text-amber-600 font-bold uppercase tracking-tight pl-1">Security: Use 6 or more characters</p>
                      )}
                    </div>

                    <AnimatePresence>
                      {formData.role === 'clinician' && (
                        <motion.div 
                          initial={{ opacity: 0, height: 0 }}
                          animate={{ opacity: 1, height: 'auto' }}
                          exit={{ opacity: 0, height: 0 }}
                          className="space-y-2 overflow-hidden"
                        >
                          <label className="text-[10px] font-black text-purple-500 uppercase tracking-[0.2em] pl-1">Medical Registration Number</label>
                          <div className="relative group">
                            <ShieldCheck className="absolute left-4 top-1/2 -translate-y-1/2 text-purple-600 transition-colors" size={18} />
                            <input
                              type="text" required
                              value={formData.registrationNumber}
                              onChange={(e) => setFormData({ ...formData, registrationNumber: e.target.value })}
                              className="w-full pl-12 pr-4 py-3.5 sm:py-4 bg-purple-50/50 border border-purple-100 rounded-lg focus:border-purple-600/50 focus:bg-white focus:ring-4 focus:ring-purple-500/5 outline-none transition-all font-bold text-sm"
                              placeholder="e.g. MC-12345"
                            />
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3.5 sm:py-4 premium-gradient text-white rounded-xl font-black text-[11px] uppercase tracking-[0.2em] sm:tracking-[0.3em] shadow-lg shadow-cyan-600/20 hover:shadow-cyan-600/30 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2 mt-5 sm:mt-6"
                  >
                    {loading ? <Loader2 className="animate-spin" size={20} /> : <><Mail size={18} className="animate-pulse" /> Get Secure OTP</>}
                  </button>
                </form>
              </div>
            )}

            {step === 'otp' && (
              <div
                key="otp"
              >
                <button onClick={() => setStep('details')} className="flex items-center gap-1 text-slate-400 hover:text-slate-600 mb-6 transition-colors text-[10px] font-black uppercase tracking-widest">
                  <ChevronLeft size={14} /> Edit Details
                </button>

                <div className="mb-8">
                  <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">Verify Email</h2>
                  <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-1">Code sent to: {formData.email}</p>
                </div>

                <form onSubmit={verifyAndSignup} className="space-y-8">
                  <div className="flex justify-between gap-2">
                    {otp.map((digit, i) => (
                      <input
                        key={i}
                        ref={el => { otpRefs.current[i] = el; }}
                        type="text"
                        maxLength={1}
                        value={digit}
                        onChange={(e) => handleOtpChange(i, e.target.value)}
                        onKeyDown={(e) => handleKeyDown(i, e)}
                        className="w-full h-14 bg-slate-50 border-2 border-slate-100 rounded-xl text-center text-xl font-black text-slate-900 focus:border-cyan-600 focus:bg-white outline-none transition-all"
                      />
                    ))}
                  </div>

                  <div className="text-center space-y-4">
                    {countdown > 0 ? (
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center justify-center gap-2">
                        <Timer size={14} className="text-cyan-500" /> Resend in {countdown}s
                      </p>
                    ) : (
                      <button type="button" onClick={sendOTP} className="text-[10px] font-black text-cyan-600 hover:text-cyan-700 uppercase tracking-[0.2em]">
                        Resend Code
                      </button>
                    )}

                    <button
                      type="submit"
                      disabled={loading || otp.some(d => !d)}
                      className="w-full py-4 bg-cyan-600 text-white rounded-xl font-black text-xs uppercase tracking-[0.2em] shadow-xl shadow-cyan-900/10 hover:bg-cyan-500 transition-all flex items-center justify-center gap-2"
                    >
                      {loading ? <Loader2 className="animate-spin" size={20} /> : <><CheckCircle2 size={18} /> Verify & Create</>}
                    </button>
                  </div>
                </form>
              </div>
            )}

            {step === 'success' && (
              <div
                key="success"
                className="text-center py-10"
              >
                <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-lg shadow-emerald-500/20">
                  <CheckCircle2 size={40} />
                </div>
                <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Verified!</h2>
                <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest mt-2">Welcome to the Blueteeth network.</p>
                <div className="mt-8">
                  <Loader2 className="animate-spin text-cyan-600 mx-auto" size={24} />
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-[0.3em] mt-4">Redirecting to Dashboard...</p>
                </div>
              </div>
            )}
          </AnimatePresence>
        </div>

        <div className="mt-6 text-center">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
            Already a member? {' '}
            <Link href="/login" className="text-slate-900 hover:text-cyan-600 transition-colors">
              Login Securely
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
