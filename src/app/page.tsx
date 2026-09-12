'use client';

import Link from 'next/link';
import Image from 'next/image';
import { motion, AnimatePresence } from 'framer-motion';
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
  Plus,
  Gift,
  Headphones,
  ClipboardList,
  ChevronDown
} from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

const MotionImage = motion(Image);

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
  const slides = ['/image 2.png', '/image.png', '/image 3.png'];
  const [currentSlide, setCurrentSlide] = useState(0);

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % slides.length);
    }, 6000);
    return () => clearInterval(timer);
  }, []);

  // Removed auto-redirect to allow viewing landing page while logged in

  useEffect(() => {
    // Force light mode on landing page to prevent dark mode background issues
    document.documentElement.classList.remove('dark');
    
    const handleScroll = () => setIsScrolled(window.scrollY > 10);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 selection:bg-blue-100 selection:text-blue-900 font-sans antialiased">
      {/* Sticky Navbar */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        isScrolled 
          ? 'py-2 md:py-3 bg-white/95 backdrop-blur-md border-b border-slate-200/50 shadow-sm' 
          : 'py-3 md:py-4 bg-white/80 backdrop-blur-md border-b border-slate-100/50 shadow-sm'
      }`}>
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3 group">
            <div className="w-10 h-10 md:w-12 md:h-12 bg-white rounded-xl flex items-center justify-center shadow-[0_8px_30px_rgba(37,99,235,0.08)] border border-slate-100 group-hover:border-blue-200 group-hover:-translate-y-0.5 transition-all duration-300 p-1.5">
              <img 
                src="/logo.png" 
                alt="Logo" 
                className="h-full w-full object-contain transition-transform group-hover:scale-110" 
              />
            </div>
            <div className="flex flex-col">
              <span className="text-lg md:text-xl font-black bg-gradient-to-r from-cyan-600 to-blue-700 bg-clip-text text-transparent tracking-tighter leading-none pb-0.5">
                BLUETEETH
              </span>
              <span className="text-[7px] md:text-[8px] font-extrabold text-cyan-600 dark:text-cyan-400 uppercase tracking-[0.12em] leading-none mt-1">DENTISTRY AT YOUR DOORSTEP</span>
            </div>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {['Features', 'Solutions', 'Testimonials'].map((item) => (
              <Link 
                key={item} 
                href={`#${item.toLowerCase()}`} 
                className="text-xs font-bold text-slate-800 hover:text-blue-600 transition-colors uppercase tracking-wider"
              >
                {item}
              </Link>
            ))}
          </div>

          <div className="flex items-center gap-2 md:gap-3">
            <Link href="/login" className="hidden sm:block text-[10px] font-bold text-slate-800 hover:text-blue-600 transition-all px-3 uppercase tracking-wider">
              Login
            </Link>
            <Link href="/signup">
              <button className="px-5 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-full text-[10px] md:text-xs font-bold shadow-lg shadow-blue-500/20 hover:scale-105 transition-all uppercase tracking-wider">
                Join Now
              </button>
            </Link>
          </div>
        </div>
      </nav>

      <main className="mesh-bg">
        {/* Hero Section */}
        <section className="relative flex flex-col justify-start pt-36 sm:pt-44 md:pt-52 lg:pt-56 pb-24 md:pb-28 px-6 overflow-x-hidden">
          {/* Full Hero Background Image Slideshow */}
          <div className="absolute inset-0 z-0 w-full h-full overflow-hidden bg-slate-100">
            <AnimatePresence mode="popLayout">
              <MotionImage 
                key={currentSlide}
                src={slides[currentSlide]} 
                alt="Hero Background" 
                fill
                priority
                sizes="100vw"
                initial={{ opacity: 0, scale: 1.03 }}
                animate={{ opacity: 1, scale: 1.07 }}
                exit={{ opacity: 0 }}
                transition={{
                  opacity: { duration: 1.8, ease: "easeInOut" },
                  scale: { duration: 7, ease: "linear" }
                }}
                className="w-full h-full object-cover object-center md:object-right absolute inset-0"
              />
            </AnimatePresence>
            
          </div>

          {/* Subtle Grid Background - low opacity texture */}
          <div className="absolute inset-0 z-10 opacity-[0.01] pointer-events-none" 
               style={{ backgroundImage: 'radial-gradient(circle, #2563eb 1px, transparent 1px)', backgroundSize: '30px 30px' }} />
          
          <div className="max-w-7xl mx-auto w-full relative z-20">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-8 items-center">
              {/* Left Column - Text Content inside a Premium Glass Container */}
              <div className="lg:col-span-6 relative z-20 flex flex-col items-center lg:items-start text-center lg:text-left w-full">
                <motion.div 
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6 }}
                  className="bg-gradient-to-br from-white/45 via-white/30 to-blue-50/20 dark:from-slate-900/40 dark:to-blue-900/20 backdrop-blur-lg border border-white/50 dark:border-white/10 rounded-3xl p-6 sm:p-8 shadow-[0_20px_50px_rgba(37,99,235,0.12)] max-w-xl w-full flex flex-col items-center lg:items-start"
                >
                  {/* Badge */}
                  <div className="inline-flex items-center gap-2 px-3 py-1 bg-blue-50/85 border border-blue-100 text-blue-600 rounded-full text-[10px] sm:text-xs font-bold uppercase mb-4 shadow-xs">
                    <ShieldCheck size={12} className="text-blue-600" />
                    <span className="tracking-wider">Trusted by 500+ Dental Practices</span>
                  </div>
                  
                  {/* Headline */}
                  <h1 className="text-3xl sm:text-4xl md:text-[40px] lg:text-[44px] font-black text-slate-900 mb-4 leading-[1.2] tracking-tight text-left lg:text-left w-full">
                    <span className="block drop-shadow-sm">Empowering Dentistry</span>
                    <span className="block bg-gradient-to-r from-blue-600 to-indigo-700 bg-clip-text text-transparent">Smart Rewards.</span>
                  </h1>
                  
                  {/* Description */}
                  <p className="text-xs sm:text-sm md:text-base text-slate-600 mb-6 font-semibold leading-relaxed text-left lg:text-left w-full">
                    The definitive ecosystem for clinical excellence. Bridging performance and automated rewards through enterprise-grade smart intelligence.
                  </p>

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row items-center justify-start gap-3 w-full mt-4">
                    <Link href="/signup" className="w-full sm:w-auto">
                      <button className="group w-full px-6 py-3.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold text-xs uppercase tracking-wider shadow-md shadow-blue-500/10 flex items-center justify-center gap-2 hover:scale-[1.02] transition-all duration-300">
                        JOIN AS PRACTITIONER <ArrowRight size={14} className="group-hover:translate-x-1 transition-transform" />
                      </button>
                    </Link>
                    <Link href="/login" className="w-full sm:w-auto">
                      <button className="w-full px-6 py-3.5 bg-white/90 border border-slate-200 text-slate-900 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-slate-50 hover:scale-[1.02] transition-all shadow-sm flex items-center justify-center gap-2">
                        <ShieldCheck size={14} className="text-blue-600" /> ADMIN ACCESS
                      </button>
                    </Link>
                  </div>
                </motion.div>
              </div>

              {/* Right Column - Floating Practice Performance Dashboard Card */}
              <div className="lg:col-span-6 flex justify-center lg:justify-start lg:-ml-16 relative z-20 w-full mt-8 lg:mt-12">
                <motion.div
                  initial={{ opacity: 0, x: 30 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1, duration: 0.5 }}
                  className="bg-gradient-to-br from-white/45 via-white/30 to-blue-50/20 dark:from-slate-900/40 dark:to-blue-900/20 backdrop-blur-lg border border-white/50 rounded-2xl shadow-[0_20px_50px_rgba(37,99,235,0.12)] p-4 w-full max-w-[340px] hover:shadow-[0_25px_60px_rgba(37,99,235,0.18)] transition-all duration-300 relative"
                >
                  {/* Card Header */}
                  <div className="flex items-center justify-between border-b border-slate-50 pb-3">
                    <span className="text-xs font-bold text-slate-800 tracking-tight">Practice Performance</span>
                    <button className="flex items-center gap-1 text-[10px] font-bold text-slate-500 bg-slate-50 hover:bg-slate-100 border border-slate-100 px-2 py-0.5 rounded-lg transition-colors">
                      This Month <ChevronDown size={10} className="text-slate-400" />
                    </button>
                  </div>

                  {/* Metrics Row */}
                  <div className="grid grid-cols-3 gap-1.5 mt-3">
                    {/* Patients */}
                    <div className="bg-slate-50/50 rounded-xl p-2 border border-slate-100/40 text-center flex flex-col items-center justify-between">
                      <div className="w-7 h-7 rounded-full bg-blue-50/70 flex items-center justify-center text-blue-600 shadow-inner">
                        <Users size={13} />
                      </div>
                      <div className="mt-2">
                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Patients</span>
                        <span className="text-xs font-black text-slate-800 block mt-0.5">2,543</span>
                      </div>
                      <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50/50 px-1 py-0.5 rounded mt-1.5 block">+18.2%</span>
                    </div>

                    {/* Treatments */}
                    <div className="bg-slate-50/50 rounded-xl p-2 border border-slate-100/40 text-center flex flex-col items-center justify-between">
                      <div className="w-7 h-7 rounded-full bg-blue-50/70 flex items-center justify-center text-blue-600 shadow-inner">
                        <ClipboardList size={13} />
                      </div>
                      <div className="mt-2">
                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Treatments</span>
                        <span className="text-xs font-black text-slate-800 block mt-0.5">1,845</span>
                      </div>
                      <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50/50 px-1 py-0.5 rounded mt-1.5 block">+12.6%</span>
                    </div>

                    {/* Rewards */}
                    <div className="bg-slate-50/50 rounded-xl p-2 border border-slate-100/40 text-center flex flex-col items-center justify-between">
                      <div className="w-7 h-7 rounded-full bg-blue-50/70 flex items-center justify-center text-blue-600 shadow-inner">
                        <Coins size={13} />
                      </div>
                      <div className="mt-2">
                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-wider block">Rewards</span>
                        <span className="text-xs font-black text-slate-800 block mt-0.5">₹48,750</span>
                      </div>
                      <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50/50 px-1 py-0.5 rounded mt-1.5 block">+24.5%</span>
                    </div>
                  </div>

                  {/* Performance Overview */}
                  <div className="mt-3.5 pt-2.5 border-t border-slate-50">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-bold text-slate-700">Performance Overview</span>
                      <div className="flex items-center gap-1.5">
                        <span className="text-[9px] font-bold text-emerald-600 bg-emerald-50/50 px-1 py-0.5 rounded">+6.4%</span>
                        <span className="text-[9px] font-medium text-slate-400">vs last month</span>
                      </div>
                    </div>

                    {/* SVG Line Chart Container */}
                    <div className="relative h-28 w-full mt-1.5 bg-slate-50/30 rounded-xl border border-slate-100/30 p-1">
                      {/* Tooltip */}
                      <div className="absolute top-[10px] left-[78%] -translate-x-1/2 bg-white/95 backdrop-blur-sm border border-blue-100 shadow-md rounded-lg p-2 text-left z-20 shrink-0 pointer-events-none">
                        <div className="text-[8px] text-slate-400 font-semibold leading-none">May 2025</div>
                        <div className="flex items-center gap-1.5 mt-1 leading-none">
                          <span className="w-1.5 h-1.5 rounded-full bg-blue-600 block"></span>
                          <span className="text-[9px] font-extrabold text-slate-800">Performance 92%</span>
                        </div>
                      </div>

                      {/* SVG */}
                      <svg viewBox="0 0 400 120" className="w-full h-full overflow-visible">
                        <defs>
                          <linearGradient id="chartGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.25" />
                            <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.0" />
                          </linearGradient>
                        </defs>

                        <line x1="40" y1="20" x2="390" y2="20" stroke="#f1f5f9" strokeWidth="1" />
                        <line x1="40" y1="50" x2="390" y2="50" stroke="#f1f5f9" strokeWidth="1" />
                        <line x1="40" y1="80" x2="390" y2="80" stroke="#f1f5f9" strokeWidth="1" />
                        <line x1="40" y1="110" x2="390" y2="110" stroke="#f1f5f9" strokeWidth="1" />

                        <text x="32" y="23" className="text-[8px] fill-slate-400 font-bold text-right" textAnchor="end">100%</text>
                        <text x="32" y="53" className="text-[8px] fill-slate-400 font-bold text-right" textAnchor="end">75%</text>
                        <text x="32" y="83" className="text-[8px] fill-slate-400 font-bold text-right" textAnchor="end">50%</text>
                        <text x="32" y="113" className="text-[8px] fill-slate-400 font-bold text-right" textAnchor="end">20%</text>

                        <text x="40" y="119" className="text-[8px] fill-slate-400 font-bold" textAnchor="middle">Jan</text>
                        <text x="110" y="119" className="text-[8px] fill-slate-400 font-bold" textAnchor="middle">Feb</text>
                        <text x="180" y="119" className="text-[8px] fill-slate-400 font-bold" textAnchor="middle">Mar</text>
                        <text x="250" y="119" className="text-[8px] fill-slate-400 font-bold" textAnchor="middle">Apr</text>
                        <text x="320" y="119" className="text-[8px] fill-slate-400 font-bold" textAnchor="middle">May</text>
                        <text x="390" y="119" className="text-[8px] fill-slate-400 font-bold" textAnchor="middle">Jun</text>

                        <line x1="320" y1="20" x2="320" y2="110" stroke="#3b82f6" strokeWidth="1" strokeDasharray="3,3" />

                        <path
                          d="M 40,95 C 75,90 85,82 110,80 C 135,78 155,90 180,85 C 205,80 225,50 250,40 C 275,30 295,20 320,20 C 345,20 365,40 390,50 L 390,110 L 40,110 Z"
                          fill="url(#chartGradient)"
                        />

                        <path
                          d="M 40,95 C 75,90 85,82 110,80 C 135,78 155,90 180,85 C 205,80 225,50 250,40 C 275,30 295,20 320,20 C 345,20 365,40 390,50"
                          fill="none"
                          stroke="#3b82f6"
                          strokeWidth="2.5"
                          strokeLinecap="round"
                        />

                        <circle cx="40" cy="95" r="3.5" fill="#3b82f6" stroke="#ffffff" strokeWidth="1" />
                        <circle cx="110" cy="80" r="3.5" fill="#3b82f6" stroke="#ffffff" strokeWidth="1" />
                        <circle cx="180" cy="85" r="3.5" fill="#3b82f6" stroke="#ffffff" strokeWidth="1" />
                        <circle cx="250" cy="40" r="3.5" fill="#3b82f6" stroke="#ffffff" strokeWidth="1" />
                        <circle cx="320" cy="20" r="5" fill="#2563eb" stroke="#ffffff" strokeWidth="2" />
                        <circle cx="390" cy="50" r="3.5" fill="#3b82f6" stroke="#ffffff" strokeWidth="1" />
                      </svg>
                    </div>
                  </div>
                </motion.div>
              </div>
            </div>
          </div>

          {/* Floating Elements - Enhanced */}
          <div className="absolute top-1/4 -left-20 w-80 h-80 bg-cyan-400/10 rounded-full blur-[100px] animate-pulse" />
          <div className="absolute bottom-1/4 -right-20 w-80 h-80 bg-blue-400/10 rounded-full blur-[100px] animate-pulse delay-1000" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-full h-full bg-radial-gradient from-cyan-50/20 to-transparent pointer-events-none opacity-50" />
        </section>

        {/* Feature Grid with Overlapping Banner */}
        <section id="features" className="relative pt-6 pb-12 px-6 bg-white z-20">
          <div className="max-w-7xl mx-auto -mt-10 md:-mt-12 mb-10 md:mb-16 relative z-30">
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="bg-white border border-slate-100 rounded-2xl shadow-[0_8px_30px_rgba(0,0,0,0.06)] p-4 md:p-5 w-full"
            >
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 lg:gap-0 lg:divide-x lg:divide-slate-100">
                {/* Feature 1 */}
                <div className="flex items-center gap-3 lg:px-4">
                  <div className="w-10 h-10 rounded-full bg-blue-50/70 flex items-center justify-center text-blue-600 shrink-0 shadow-inner">
                    <BarChart3 size={18} />
                  </div>
                  <div>
                    <h4 className="text-xs md:text-sm font-bold text-slate-800 tracking-tight">Smart Analytics</h4>
                    <p className="text-[10px] text-slate-400 font-medium leading-normal mt-0.5">Real-time insights and performance tracking</p>
                  </div>
                </div>
                
                {/* Feature 2 */}
                <div className="flex items-center gap-3 lg:px-4">
                  <div className="w-10 h-10 rounded-full bg-blue-50/70 flex items-center justify-center text-blue-600 shrink-0 shadow-inner">
                    <Gift size={18} />
                  </div>
                  <div>
                    <h4 className="text-xs md:text-sm font-bold text-slate-800 tracking-tight">Automated Rewards</h4>
                    <p className="text-[10px] text-slate-400 font-medium leading-normal mt-0.5">Performance-based rewards and incentives</p>
                  </div>
                </div>
                
                {/* Feature 3 */}
                <div className="flex items-center gap-3 lg:px-4">
                  <div className="w-10 h-10 rounded-full bg-blue-50/70 flex items-center justify-center text-blue-600 shrink-0 shadow-inner">
                    <ShieldCheck size={18} />
                  </div>
                  <div>
                    <h4 className="text-xs md:text-sm font-bold text-slate-800 tracking-tight">Secure & Compliant</h4>
                    <p className="text-[10px] text-slate-400 font-medium leading-normal mt-0.5">Enterprise-grade security and compliance</p>
                  </div>
                </div>
                
                {/* Feature 4 */}
                <div className="flex items-center gap-3 lg:px-4">
                  <div className="w-10 h-10 rounded-full bg-blue-50/70 flex items-center justify-center text-blue-600 shrink-0 shadow-inner">
                    <Headphones size={18} />
                  </div>
                  <div>
                    <h4 className="text-xs md:text-sm font-bold text-slate-800 tracking-tight">24/7 Support</h4>
                    <p className="text-[10px] text-slate-400 font-medium leading-normal mt-0.5">Dedicated support whenever you need it</p>
                  </div>
                </div>
              </div>
            </motion.div>
          </div>
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

            <div className="mt-12 p-6 md:p-8 bg-slate-50 rounded-2xl border border-slate-100 text-center max-w-3xl mx-auto">
              <p className="text-slate-600 text-sm md:text-base font-medium leading-relaxed">
                For professional dentist-at-home services and convenient dental care at your doorstep in Delhi NCR, visit{' '}
                <a 
                  href="https://blueteeth.in/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="font-bold text-blue-600 hover:text-blue-700 underline underline-offset-4 transition-colors"
                >
                  Blueteeth
                </a>.
              </p>
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

