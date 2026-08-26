'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import StatCard from '@/components/dashboard/StatCard';
import { db } from '@/lib/firebase';
import { collection, onSnapshot, query, where, getDocs } from 'firebase/firestore';
import { 
  BarChart3, 
  TrendingUp, 
  Users, 
  ClipboardList, 
  Download,
  Calendar,
  Shield,
  Loader2
} from 'lucide-react';
import { 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import { useAuth } from '@/context/AuthContext';
import toast from 'react-hot-toast';
import { format, startOfMonth, subMonths, isWithinInterval } from 'date-fns';

export default function AdminReportsPage() {
  const { user: currentUser, loading: authLoading } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    activeUsers: 0,
    totalCases: 0,
    conversionRate: 0,
    totalRevenue: 0,
    growth: '+0%'
  });
  const [chartData, setChartData] = useState<any[]>([]);

  // Security Check
  useEffect(() => {
    if (!authLoading && (!currentUser || currentUser.role !== 'admin')) {
      toast.error('Unauthorized access');
      window.location.href = '/dashboard';
    }
  }, [currentUser, authLoading]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // 1. Fetch Users
        const usersSnap = await getDocs(collection(db, 'users'));
        const totalUsers = usersSnap.size;

        // 2. Fetch Cases
        const casesSnap = await getDocs(collection(db, 'cases'));
        const totalCases = casesSnap.size;
        const approvedCases = casesSnap.docs.filter(doc => doc.data().status === 'approved').length;
        const convRate = totalCases > 0 ? ((approvedCases / totalCases) * 100).toFixed(1) : 0;

        // 3. Fetch Payouts for Revenue
        const payoutsSnap = await getDocs(query(collection(db, 'clinicianPayouts'), where('status', '==', 'paid')));
        const totalRev = payoutsSnap.docs.reduce((sum, doc) => sum + (doc.data().amount || 0), 0);

        setStats({
          activeUsers: totalUsers,
          totalCases: totalCases,
          conversionRate: Number(convRate),
          totalRevenue: totalRev,
          growth: '+12%' // Mock growth for now
        });

        // 4. Generate Chart Data (Last 6 Months)
        const months = Array.from({ length: 6 }, (_, i) => {
          const d = subMonths(new Date(), 5 - i);
          return {
            name: format(d, 'MMM'),
            monthStart: startOfMonth(d),
            cases: 0,
            revenue: 0
          };
        });

        casesSnap.docs.forEach(doc => {
          const date = doc.data().createdAt?.toDate();
          if (date) {
            const monthName = format(date, 'MMM');
            const monthData = months.find(m => m.name === monthName);
            if (monthData) monthData.cases++;
          }
        });

        payoutsSnap.docs.forEach(doc => {
          const date = doc.data().paidAt?.toDate() || doc.data().createdAt?.toDate();
          if (date) {
            const monthName = format(date, 'MMM');
            const monthData = months.find(m => m.name === monthName);
            if (monthData) monthData.revenue += (doc.data().amount || 0);
          }
        });

        setChartData(months);
        setLoading(false);
      } catch (error) {
        console.error(error);
        toast.error('Failed to load real-time analytics');
      }
    };

    if (!authLoading && currentUser?.role === 'admin') {
      fetchData();
    }
  }, [authLoading, currentUser]);

  const handleExport = () => {
    toast.loading('Generating System Report...');
    setTimeout(() => {
      window.print();
      toast.dismiss();
      toast.success('Report generated successfully');
    }, 1500);
  };

  if (loading) {
    return (
      <DashboardLayout>
        <div className="h-[60vh] flex flex-col items-center justify-center gap-4">
          <Loader2 className="animate-spin text-cyan-600" size={40} />
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em]">Assembling Market Intelligence...</p>
        </div>
      </DashboardLayout>
    );
  }

  return (
    <DashboardLayout>
      <style>{`
        @media print {
          /* Hide non-report elements */
          nav, aside, button, .no-print, header, [role="navigation"], .mobile-nav {
            display: none !important;
          }
          
          /* Full width layout */
          body {
            background: white !important;
            color: #000 !important;
            margin: 0 !important;
            padding: 0 !important;
          }
          
          @page {
            margin: 20mm;
            size: auto;
          }

          .max-w-7xl {
            max-width: 100% !important;
            width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
          }

          /* Show Print-only Header */
          .print-header {
            display: flex !important;
            justify-content: space-between;
            align-items: center;
            border-bottom: 3px solid #000;
            padding-bottom: 15px;
            margin-bottom: 30px;
          }

          /* Force high quality printing */
          .glass-card, div[class*="bg-white"], div[class*="dark:bg-slate-900"], .bg-white, .dark\\:bg-slate-900\\/50 {
            background: #fff !important;
            border: 2px solid #f1f5f9 !important;
            box-shadow: none !important;
            break-inside: avoid;
            page-break-inside: avoid;
            margin-bottom: 25px !important;
            border-radius: 12px !important;
          }

          h1, h2, h3, p, span {
            color: #000 !important;
          }

          .grid {
            display: grid !important;
            grid-template-columns: repeat(2, 1fr) !important;
            gap: 20px !important;
          }

          .lg\\:grid-cols-4 {
            grid-template-columns: repeat(2, 1fr) !important;
          }

          .lg\\:grid-cols-2 {
            grid-template-columns: 1fr !important;
          }

          .recharts-responsive-container {
            width: 100% !important;
            height: 400px !important;
          }

          .print-footer {
            display: block !important;
            position: fixed;
            bottom: 0;
            left: 0;
            right: 0;
            text-align: center;
            font-size: 8px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.2em;
            color: #94a3b8;
            padding: 20px;
            border-top: 1px solid #eee;
          }
        }

        .print-header, .print-footer {
          display: none;
        }
      `}</style>
      
      <div className="max-w-7xl mx-auto px-1 sm:px-4">
        {/* Print-Only Header */}
        <div className="print-header">
          <div>
            <h1 className="text-2xl font-bold uppercase tracking-tight">Blueteeth <span className="text-cyan-600">Clinical Platform</span></h1>
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Enterprise Analytics Report</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] font-bold uppercase tracking-wider">Generated On</p>
            <p className="text-sm font-bold">{format(new Date(), 'dd MMMM yyyy, HH:mm')}</p>
          </div>
        </div>

        <div className="mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-6 px-1 sm:px-0 no-print">
          <div>
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight uppercase">Analytics & Reports</h1>
            <p className="text-[9px] sm:text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-1">Real-time platform performance and financial flow.</p>
          </div>
          <div className="flex flex-col xs:flex-row gap-3">
            <button className="px-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-100 dark:border-white/5 rounded-xl text-[9px] sm:text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center justify-center gap-2 shadow-sm">
              <Calendar size={14} /> Last 6 Months
            </button>
            <button 
              onClick={handleExport}
              className="px-6 py-3.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold text-[9px] sm:text-[10px] uppercase tracking-wider flex items-center justify-center gap-2 shadow-lg hover:opacity-90 transition-all"
            >
              <Download size={14} /> Export Report
            </button>
          </div>
        </div>

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8 mx-1 sm:mx-0">
          <StatCard title="Platform Revenue" value={`₹${stats.totalRevenue.toLocaleString()}`} icon={TrendingUp} color="bg-emerald-500" trend={`${stats.growth} Growth`} />
          <StatCard title="Global Users" value={stats.activeUsers.toString()} icon={Users} color="bg-blue-500" />
          <StatCard title="Conversion" value={`${stats.conversionRate}%`} icon={BarChart3} color="bg-cyan-500" />
          <StatCard title="Total Volume" value={stats.totalCases.toString()} icon={ClipboardList} color="bg-slate-900" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 sm:gap-8 mb-8 mx-1 sm:mx-0">
          <div className="bg-white dark:bg-slate-900/50 p-4 sm:p-8 rounded-2xl border border-slate-100 dark:border-white/5 shadow-xl shadow-slate-200/40 dark:shadow-none">
            <div className="flex items-center justify-between mb-8 sm:mb-10">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white uppercase tracking-tight">Case Velocity</h3>
                <p className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1">Growth of clinical volume</p>
              </div>
              <div className="w-10 h-10 sm:w-11 sm:h-11 bg-cyan-500/10 rounded-xl flex items-center justify-center border border-cyan-500/10">
                <BarChart3 size={18} className="text-cyan-500" />
              </div>
            </div>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorCases" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.2}/>
                      <stop offset="95%" stopColor="#06b6d4" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" opacity={0.5} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 900}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 900}} dx={-10} />
                  <Tooltip 
                    contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', background: '#0f172a', padding: '12px'}}
                    itemStyle={{color: '#fff', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase'}}
                    cursor={{ stroke: '#06b6d4', strokeWidth: 2, strokeDasharray: '5 5' }}
                  />
                  <Area type="monotone" dataKey="cases" stroke="#06b6d4" strokeWidth={4} fillOpacity={1} fill="url(#colorCases)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white dark:bg-slate-900/50 p-4 sm:p-8 rounded-2xl border border-slate-100 dark:border-white/5 shadow-xl shadow-slate-200/40 dark:shadow-none">
            <div className="flex items-center justify-between mb-8 sm:mb-10">
              <div>
                <h3 className="text-sm sm:text-base font-bold text-slate-900 dark:text-white uppercase tracking-tight">Financial Inflow</h3>
                <p className="text-[8px] sm:text-[9px] font-bold text-slate-400 uppercase tracking-wider mt-1">Settled clinician consultation fees</p>
              </div>
              <div className="w-10 h-10 sm:w-11 sm:h-11 bg-emerald-500/10 rounded-xl flex items-center justify-center border border-emerald-500/10">
                <TrendingUp size={18} className="text-emerald-500" />
              </div>
            </div>
            <div className="h-[300px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" opacity={0.5} />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 900}} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{fill: '#94a3b8', fontSize: 10, fontWeight: 900}} dx={-10} />
                  <Tooltip 
                    contentStyle={{borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)', background: '#0f172a', padding: '12px'}}
                    itemStyle={{color: '#fff', fontSize: '10px', fontWeight: 900, textTransform: 'uppercase'}}
                    cursor={{ fill: 'rgba(16, 185, 129, 0.05)' }}
                  />
                  <Bar dataKey="revenue" fill="#10b981" radius={[8, 8, 0, 0]} barSize={36} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Print-Only Footer */}
        <div className="print-footer">
          Confidential Enterprise Analytics Report — Blueteeth Clinical Reward Platform — Internal Use Only
        </div>
      </div>
    </DashboardLayout>
  );
}

