'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { 
  ArrowRight, 
  ShieldCheck, 
  Zap, 
  BarChart3, 
  Stethoscope, 
  Coins, 
  Users,
  CheckCircle2,
  Lock,
  Globe,
  ChevronRight,
  Star,
  Quote,
  ArrowUpRight,
  Plus
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

const Testimonials = [
  {
    name: "Dr. Sarah Chen",
    role: "Senior Orthodontist",
    content: "Blueteeth has completely transformed how we manage our clinical rewards. The transparency is unmatched.",
    image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Sarah"
  },
  {
    name: "James Wilson",
    role: "Clinic Administrator",
    content: "The real-time analytics have helped us optimize our workflow and increase patient satisfaction by 40%.",
    image: "https://api.dicebear.com/7.x/avataaars/svg?seed=James"
  },
  {
    name: "Dr. Michael Ross",
    role: "Lead Clinician",
    content: "A truly enterprise-grade platform. The automated B-Points system is a game-changer for our associates.",
    image: "https://api.dicebear.com/7.x/avataaars/svg?seed=Michael"
  }
];

export default function LandingPage() {
  const { user, loading } = useAuth();
  const router = useRouter();
  const [isScrolled, setIsScrolled] = useState(false);

  // Removed auto-redirect to allow viewing landing page while logged in

  useEffect(() => {
    const handleScroll = () => setIsScrolled(window.scrollY > 20);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-50 text-slate-900 dark:text-slate-900 selection:bg-cyan-100 selection:text-cyan-900 font-sans antialiased">
      {/* Sticky Navbar */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
        isScrolled 
          ? 'py-2 md:py-3 bg-white/90 backdrop-blur-xl border-b border-slate-200 shadow-sm' 
          : 'py-3 md:py-5 bg-white/5 backdrop-blur-md border-b border-white/10'
      }`}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-white rounded-xl flex items-center justify-center shadow-[0_8px_30px_rgba(8,145,178,0.15)] border border-cyan-100 group-hover:border-cyan-300 group-hover:-translate-y-0.5 transition-all duration-300 p-1.5">
              <img 
                src="/logo.png" 
                alt="Logo" 
                className="h-full w-full object-contain transition-transform group-hover:scale-110" 
              />
            </div>
            <div className="flex flex-col">
              <span className="text-lg md:text-xl font-black tracking-tighter text-cyan-600 leading-none">
                Blueteeth
              </span>
              <span className="text-[7px] md:text-[8px] font-black text-slate-400 uppercase tracking-[0.3em] leading-none mt-1">Clinical Elite</span>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {['Features', 'Solutions', 'Testimonials'].map((item) => (
              <Link 
                key={item} 
                href={`#${item.toLowerCase()}`} 
                className="text-xs font-bold text-slate-500 hover:text-cyan-600 transition-colors uppercase tracking-wider"
              >
                {item}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            <Link href="/login" className="hidden sm:block text-[10px] font-black text-slate-600 hover:text-slate-900 transition-all px-3 uppercase tracking-wider">
              Login
            </Link>
            <Link href="/signup">
              <button className="px-4 md:px-5 py-2 premium-gradient text-white rounded-full text-[10px] md:text-xs font-black shadow-lg shadow-cyan-500/20 hover:scale-105 transition-all uppercase tracking-wider">
                Join Now
              </button>
            </Link>
          </div>
        </div>
      </nav>

      <main className="mesh-bg">
        {/* Hero Section */}
        <section className="relative min-h-[350px] sm:min-h-[450px] md:min-h-[70vh] flex items-center justify-center pt-32 sm:pt-36 md:pt-28 pb-8 md:pb-10 px-4 sm:px-6 overflow-hidden">
          {/* Subtle Grid Background */}
          <div className="absolute inset-0 z-0 opacity-[0.03] pointer-events-none" 
               style={{ backgroundImage: 'radial-gradient(circle, #0891b2 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
          
          <motion.div 
            className="max-w-4xl mx-auto text-center relative z-10 w-full"
          >
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
               className="inline-flex max-w-full items-center justify-center gap-2 px-3.5 py-1.5 bg-white/90 backdrop-blur-md border border-cyan-100 text-cyan-600 rounded-full text-[10px] sm:text-[11px] font-bold uppercase mb-5 md:mb-8 shadow-[0_2px_15px_rgba(8,145,178,0.1)]"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-cyan-500 animate-pulse" />
              <span className="tracking-wider">Trusted by 500+ Dental Practices</span>
            </motion.div>
            
            <motion.h1 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-3xl sm:text-5xl md:text-6xl font-bold text-slate-900 mb-6 leading-[1] tracking-tight"
            >
              <span className="block drop-shadow-sm">Empowering Dentistry</span>
              <span className="text-gradient drop-shadow-sm">Smart Rewards.</span>
            </motion.h1>
            
            <motion.p 
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="text-sm sm:text-base md:text-lg text-slate-500 max-w-2xl mx-auto mb-10 font-medium leading-relaxed"
            >
              The definitive ecosystem for clinical excellence. Bridging performance and automated rewards through enterprise-grade smart intelligence.
            </motion.p>

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link href="/signup" className="w-full sm:w-auto">
                <button className="group w-full px-10 py-4 premium-gradient text-white rounded-xl font-black text-xs uppercase tracking-wider shadow-[0_10px_25px_-5px_rgba(8,145,178,0.4)] flex items-center justify-center gap-2 hover:scale-[1.03] transition-all duration-300">
                  JOIN AS PRACTITIONER <ArrowRight size={16} className="group-hover:translate-x-1 transition-transform" />
                </button>
              </Link>
              <Link href="/login" className="w-full sm:w-auto">
                <button className="w-full px-10 py-4 bg-white border border-slate-200 text-slate-900 rounded-xl font-black text-xs uppercase tracking-wider hover:bg-slate-50 transition-all shadow-sm flex items-center justify-center gap-2 hover:scale-[1.03]">
                  Admin Access
                </button>
              </Link>
            </div>
          </motion.div>

          {/* Floating Elements - Enhanced */}
          <div className="absolute top-1/4 -left-20 w-80 h-80 bg-cyan-400/10 rounded-full blur-[100px] animate-pulse" />
          <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-blue-400/10 rounded-full blur-[100px] animate-pulse delay-1000" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-radial-gradient from-cyan-50/20 to-transparent pointer-events-none opacity-50" />
        </section>

        {/* Feature Grid */}
        <section id="features" className="pt-6 md:pt-8 pb-12 px-6 bg-white">
          <div className="max-w-7xl mx-auto">
            <div className="text-center max-w-xl mx-auto mb-10 md:mb-16">
              <span className="text-xs font-bold text-cyan-600 uppercase tracking-wider mb-3 block">Features</span>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">Built for clinical excellence</h2>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                {
                  icon: <ShieldCheck size={24} />,
                  title: "End-to-End Security",
                  desc: "Military-grade encryption for patient data and HIPAA-compliant file storage.",
                  color: "from-cyan-500 to-blue-500"
                },
                {
                  icon: <Coins size={24} />,
                  title: "Smart Incentives",
                  desc: "Automated B-Points calculation based on treatment outcomes and clinical data.",
                  color: "from-blue-500 to-indigo-500"
                },
                {
                  icon: <BarChart3 size={24} />,
                  title: "Deep Analytics",
                  desc: "Transform your practice data into actionable insights with real-time reporting.",
                  color: "from-indigo-500 to-violet-500"
                }
              ].map((feat, i) => (
                <div key={i} className="p-8 bg-slate-50 rounded-2xl border border-slate-100 hover:border-cyan-100 transition-all group">
                  <div className={`w-12 h-12 bg-gradient-to-br ${feat.color} rounded-xl flex items-center justify-center mb-6 text-white shadow-lg`}>
                    {feat.icon}
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 mb-3">{feat.title}</h3>
                  <p className="text-slate-500 text-sm font-medium leading-relaxed">
                    {feat.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Testimonials */}
        <section id="testimonials" className="pt-12 pb-10 px-6 bg-white">
          <div className="max-w-7xl mx-auto">
            <div className="text-center mb-16">
              <span className="text-xs font-bold text-cyan-600 uppercase tracking-wider mb-3 block">Testimonials</span>
              <h2 className="text-3xl md:text-4xl font-bold text-slate-900 tracking-tight">Hear from our community</h2>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {Testimonials.map((t, i) => (
                <div key={i} className="p-8 bg-slate-50 rounded-2xl border border-slate-100 relative">
                  <Quote className="absolute top-6 right-8 text-slate-200" size={32} />
                  <div className="relative z-10">
                    <p className="text-sm font-medium text-slate-600 leading-relaxed mb-6 italic">"{t.content}"</p>
                    <div className="flex items-center gap-3">
                      <img src={t.image} alt={t.name} className="w-10 h-10 rounded-full bg-slate-200" />
                      <div>
                        <h4 className="font-bold text-slate-900 text-sm">{t.name}</h4>
                        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{t.role}</p>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section id="enterprise" className="pt-14 pb-16 px-6">
          <div className="max-w-7xl mx-auto text-center bg-slate-900 rounded-3xl p-12 text-white relative overflow-hidden">
            <div className="relative z-10 max-w-2xl mx-auto">
              <h2 className="text-3xl md:text-4xl font-bold mb-6 tracking-tight">Ready to scale your practice?</h2>
              <p className="text-base text-slate-400 mb-8 font-medium">Join the elite network of dental practitioners using Blueteeth today.</p>
              <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                <Link href="/signup" className="w-full sm:w-auto">
                  <button className="w-full px-8 py-3.5 bg-white text-slate-900 rounded-xl font-bold text-base hover:bg-slate-50 transition-all">
                    Start Your Journey
                  </button>
                </Link>
                <button className="w-full sm:w-auto px-8 py-3.5 bg-white/10 text-white rounded-xl font-bold text-base hover:bg-white/20 transition-all">
                  Contact Sales
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer className="bg-white border-t border-slate-100 py-6 px-6">
        <div className="max-w-7xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-6">
            <div className="flex flex-col items-center md:items-start gap-3">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 bg-white rounded-lg flex items-center justify-center shadow-[0_3px_10px_rgba(8,145,178,0.12)] border border-cyan-100">
                  <img 
                    src="/logo.png" 
                    alt="Logo" 
                    className="h-6 w-auto object-contain" 
                  />
                </div>
                <span className="text-base font-bold text-cyan-600">Blueteeth</span>
              </div>
              <p className="text-slate-500 text-[10px] font-medium">© 2026 Blueteeth Clinical Ecosystem. All rights reserved.</p>
            </div>
            
            <div className="flex flex-col items-center md:items-end gap-3">
              <div className="flex items-center gap-6 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                <Link href="#" className="hover:text-cyan-600 transition-colors">Privacy</Link>
                <Link href="#" className="hover:text-cyan-600 transition-colors">Terms</Link>
                <Link href="#" className="hover:text-cyan-600 transition-colors">Compliance</Link>
              </div>
              <div className="flex items-center gap-2 px-2.5 py-1 bg-emerald-50 rounded-full border border-emerald-100">
                <div className="w-1 h-1 rounded-full bg-emerald-500 animate-pulse" />
                <span className="text-[9px] font-bold text-emerald-700 uppercase tracking-wider">System Operational</span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}

