'use client';

import { useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail 
} from 'firebase/auth';
import { auth, db } from '@/lib/firebase';
import { doc, getDoc, collection, query, where, getDocs } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, ShieldCheck, Mail, ArrowLeft, KeyRound, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';

const ColorfulLoginIcon = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M10 17l5-5-5-5" stroke="#A5F3FC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <path d="M15 12H3" stroke="#A5F3FC" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
  </svg>
);

export default function LoginPage() {
  const { user, loading: authLoading, firebaseUser } = useAuth();
  const [step, setStep] = useState<'login' | 'otp'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [tempUser, setTempUser] = useState<any>(null);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);
  const [showReset, setShowReset] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();

  // 🛡️ SECURITY: Auto-redirect disabled as requested to prevent "automatic" login
  /*
  useEffect(() => {
    if (!authLoading && user && firebaseUser) {
      // Firebase session is confirmed - now safe to redirect
      const isVerified = sessionStorage.getItem('2fa_verified') === 'true';
      if (!user.twoFAEnabled || isVerified) {
        router.replace(`/dashboard/${user.role}`);
      } else if (user.twoFAEnabled && !isVerified && step === 'login') {
        setTempUser({
          uid: user.uid,
          email: user.email,
          name: user.name,
          role: user.role
        });
        setStep('otp');
      }
    }
  }, [user, authLoading, firebaseUser, router, step]);
  */

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoginLoading(true);
    const cleanEmail = email.trim().toLowerCase();
    try {
      const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
      
      // ⚡ NITRO PARALLEL: Fetch profile and get ID token simultaneously
      const [userDoc, idToken] = await Promise.all([
        getDoc(doc(db, 'users', userCredential.user.uid)),
        userCredential.user.getIdToken()
      ]);
      
      if (!userDoc.exists()) throw new Error("User record not found. Please contact support.");
      
      const userData = userDoc.data();
      const is2FA = !!userData.twoFAEnabled;

      // 🔑 CRITICAL: Must await session cookie before redirecting to allow Middleware to pass
      try {
        await fetch('/api/auth/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ idToken }),
        });
      } catch (sessionErr) {
        console.error('Session cookie error:', sessionErr);
      }

      // Background task (don't await)
      fetch('/api/auth/login-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: userCredential.user.email,
          name: userData.name,
          role: userData.role,
          userAgent: window.navigator.userAgent
        }),
      }).catch(() => {});

      if (is2FA) {
        setTempUser({
          uid: userCredential.user.uid,
          email: userCredential.user.email,
          name: userData.name,
          role: userData.role
        });
        
        router.prefetch('/dashboard');
        setStep('otp');
        
        // Send OTP
        fetch('/api/auth/otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ 
            email: userCredential.user.email || email.trim(), 
            name: userData.name, 
            action: 'send' 
          })
        }).then(res => res.json()).then(data => {
          if (data.error) toast.error(data.error);
          else toast.success('Security Code Sent');
        }).catch(() => toast.error("Could not send code."));

      } else {
        sessionStorage.setItem('2fa_verified', 'true');
        
        // ⚡ NITRO CACHE: Set cache BEFORE redirect
        const cachedUser = {
          uid: userCredential.user.uid,
          name: userData.name,
          email: userCredential.user.email,
          role: userData.role,
          displayName: userData.name 
        };
        localStorage.setItem('cached_user', JSON.stringify(cachedUser));

        toast.success('Login Successful');
        
        // ⚡ SPEED BOOST: Prefetch and then push
        router.prefetch(`/dashboard/${userData.role}`);
        router.replace(`/dashboard/${userData.role}`);
      }
    } catch (error: any) {
      const code = error?.code || '';
      let message = 'Login failed. Please try again.';

      if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
        // Server-side check to see if user exists (bypasses client rules)
        try {
          const res = await fetch('/api/auth/otp', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: cleanEmail, action: 'check' })
          });
          const checkData = await res.json();
          
          if (checkData.exists === false) {
            message = 'No account found with this email address.';
          } else {
            message = 'Incorrect password. Please check and try again.';
          }
        } catch (e) {
          message = 'Invalid email or password.';
        }
      } else if (code === 'auth/invalid-email') {
        message = 'Please enter a valid clinical email address.';
      } else if (code === 'auth/too-many-requests') {
        message = 'Too many failed attempts. Please try again later.';
      } else if (code === 'auth/user-disabled') {
        message = 'This account has been suspended. Contact support.';
      } else if (code === 'auth/network-request-failed') {
        message = 'Network error. Please check your internet connection.';
      } else {
        console.error("Login error:", error);
      }
      toast.error(message);
    } finally {
      setLoginLoading(false);
    }
  };

  const handleVerifyOTP = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (otp.length !== 6) return;
    
    setVerifyLoading(true);
    try {
      const res = await fetch('/api/auth/otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: tempUser.email, 
          otp, 
          action: 'verify' 
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Verification failed');

      // Set verification flag FIRST
      sessionStorage.setItem('2fa_verified', 'true');
      
      // 🔑 SET SESSION COOKIE for 2FA users too
      try {
        const { auth: firebaseAuth } = await import('@/lib/firebase');
        const currentUser = firebaseAuth.currentUser;
        if (currentUser) {
          const idToken = await currentUser.getIdToken();
          await fetch('/api/auth/session', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ idToken }),
          });
        }
      } catch (sessionErr) {
        console.error('Session cookie error (2FA):', sessionErr);
      }

      toast.success('Login Successful');
      router.push(`/dashboard/${tempUser.role}`);
      
      // Secondary actions in background (don't await)
      fetch('/api/auth/login-alert', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          email: tempUser.email,
          name: tempUser.name,
          role: tempUser.role,
          userAgent: window.navigator.userAgent
        }),
      }).catch(() => {});
      
    } catch (error: any) {
      toast.error(error.message);
      // Wait a bit before clearing so they can see what they typed
      setTimeout(() => setOtp(''), 1000);
    } finally {
      // Don't set loading to false if we are redirecting
      if (window.location.pathname === '/login') {
        setVerifyLoading(false);
      }
    }
  };
  
  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail) return toast.error("Please enter your email");
    setResetLoading(true);
    try {
      // 🛡️ SAFE RESET FLOW: Uses default Firebase template to avoid "unauthorized-continue-uri" errors
      await sendPasswordResetEmail(auth, resetEmail.trim().toLowerCase());
      
      toast.success("Password reset link sent! Please check your email.");
      setShowReset(false);
    } catch (err: any) {
      console.error("Reset error:", err);
      let message = "Failed to send reset link";
      if (err.code === 'auth/user-not-found') message = "No account found with this email.";
      if (err.code === 'auth/invalid-email') message = "Please enter a valid clinical email.";
      toast.error(message);
    } finally {
      setResetLoading(false);
    }
  };

  // Auto-submit effect
  useEffect(() => {
    if (otp.length === 6 && step === 'otp') {
      handleVerifyOTP();
    }
  }, [otp, step]);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#020617] flex items-start sm:items-center justify-center p-4 pt-10 sm:pt-4 transition-colors">
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
            Enterprise Reward Portal
          </p>
        </div>

        <div className="glass-card p-8 rounded-3xl border border-slate-200 dark:border-white/5 bg-white dark:bg-slate-900/50 shadow-xl transition-all">
          <AnimatePresence mode="wait">
            {step === 'login' ? (
              <motion.div
                key="login-step"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
              >
                <div className="flex items-center gap-3 mb-8">
                  <div className="w-12 h-12 premium-gradient rounded-lg flex items-center justify-center text-white shadow-md shadow-cyan-500/20">
                    <ColorfulLoginIcon />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white transition-colors">Welcome Back</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm transition-colors">Please enter your details</p>
                  </div>
                </div>

                <form 
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleLogin(e);
                  }} 
                  className="space-y-6"
                >
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 transition-colors">Email Address</label>
                    <div className="relative">
                      <Mail size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-rose-400" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full pl-12 pr-4 py-3.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none transition-all text-slate-900 dark:text-white font-medium"
                        placeholder="name@company.com"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-2 transition-colors">Password</label>
                    <div className="relative">
                      <KeyRound size={20} className="absolute left-4 top-1/2 -translate-y-1/2 text-amber-400" />
                      <input
                        type={showPassword ? "text" : "password"}
                        required
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full pl-12 pr-12 py-3.5 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none transition-all text-slate-900 dark:text-white font-medium"
                        placeholder="••••••••"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 dark:text-slate-500 hover:text-cyan-600 dark:hover:text-cyan-400 transition-colors focus:outline-none"
                      >
                        {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                      </button>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <button 
                      type="button"
                      onClick={() => {
                        setResetEmail(email);
                        setShowReset(true);
                      }}
                      className="text-xs font-bold text-cyan-600 hover:text-cyan-700 transition-colors"
                    >
                      Forgot Password?
                    </button>
                  </div>

                  <button
                    type="submit"
                    disabled={loginLoading}
                    className="w-full py-4 premium-gradient text-white rounded-xl font-bold shadow-lg shadow-cyan-500/25 flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50 disabled:active:scale-100"
                  >
                    {loginLoading ? <Loader2 className="animate-spin" size={20} /> : 'Login to Dashboard'}
                  </button>
                </form>

                <div className="mt-8 text-center border-t border-slate-100 dark:border-white/5 pt-6 transition-colors">
                  <p className="text-slate-500 dark:text-slate-400 text-sm transition-colors whitespace-nowrap">
                    Don't have an account? {' '}
                    <Link href="/signup" className="text-cyan-600 dark:text-cyan-500 font-bold hover:underline transition-colors">
                      Create Account
                    </Link>
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div
                key="otp-step"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
              >
                <button 
                  onClick={async () => {
                    const { signOut } = await import('firebase/auth');
                    await signOut(auth);
                    setStep('login');
                  }}
                  className="flex items-center gap-2 text-slate-400 hover:text-cyan-600 transition-colors mb-6 text-sm font-bold uppercase tracking-wider"
                >
                  <ArrowLeft size={16} /> Back to Login
                </button>

                <div className="flex items-center gap-3 mb-8">
                  <div className="w-12 h-12 bg-amber-500 rounded-lg flex items-center justify-center text-white shadow-md shadow-amber-500/20">
                    <ShieldCheck size={28} />
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-800 dark:text-white transition-colors">Verification</h2>
                    <p className="text-slate-500 dark:text-slate-400 text-sm transition-colors">Sent to {tempUser?.email}</p>
                  </div>
                </div>

                <form onSubmit={(e) => handleVerifyOTP(e)} className="space-y-6">
                  <div>
                    <label className="block text-sm font-semibold text-slate-700 dark:text-slate-300 mb-4 transition-colors text-center uppercase tracking-wider">Enter 6-Digit Code</label>
                    <input
                      type="text"
                      maxLength={6}
                      required
                      value={otp}
                      onChange={(e) => setOtp(e.target.value.replace(/\D/g, ''))}
                      className="w-full text-center text-4xl font-bold tracking-[0.5em] py-4 bg-slate-50 dark:bg-slate-900/50 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-amber-500 outline-none transition-all text-slate-900 dark:text-white"
                      placeholder="000000"
                      autoFocus
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={verifyLoading || otp.length !== 6}
                    className="w-full py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold uppercase tracking-wider shadow-xl flex items-center justify-center gap-2 hover:opacity-90 active:scale-[0.98] transition-all disabled:opacity-50"
                  >
                    {verifyLoading ? <Loader2 className="animate-spin" size={20} /> : 'Verify & Continue'}
                  </button>

                  <p className="text-center text-xs text-slate-400 font-medium">
                    Didn't receive the code? Check your spam folder or wait a minute.
                  </p>
                </form>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Password Reset Modal */}
        <AnimatePresence>
          {showReset && (
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm"
            >
              <motion.div 
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.9, opacity: 0 }}
                className="bg-white dark:bg-slate-900 p-8 rounded-3xl w-full max-w-sm border border-white/20 shadow-2xl"
              >
                <h3 className="text-xl font-bold mb-2 text-slate-800 dark:text-white">Reset Password</h3>
                <p className="text-sm text-slate-500 mb-6">We'll send a recovery link to your email.</p>
                
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <input
                    type="email"
                    required
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    className="w-full px-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/10 rounded-xl focus:ring-2 focus:ring-cyan-500 outline-none transition-all text-slate-900 dark:text-white"
                    placeholder="Enter your email"
                  />
                  <div className="flex gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowReset(false)}
                      className="flex-1 py-3 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl font-bold text-sm hover:bg-slate-200 transition-all"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={resetLoading}
                      className="flex-1 py-3 premium-gradient text-white rounded-xl font-bold text-sm shadow-lg shadow-cyan-500/20 flex items-center justify-center gap-2"
                    >
                      {resetLoading ? <Loader2 className="animate-spin" size={16} /> : 'Send Link'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}
