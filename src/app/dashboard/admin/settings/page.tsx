'use client';

import { useState, useEffect } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { db } from '@/lib/firebase';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { 
  Settings, 
  User, 
  Bell, 
  Shield, 
  CreditCard, 
  ChevronRight,
  Save,
  Loader2,
  DollarSign,
  TrendingDown,
  Info
} from 'lucide-react';
import toast from 'react-hot-toast';
import { motion } from 'framer-motion';

export default function AdminSettingsPage() {
  const [minWithdrawal, setMinWithdrawal] = useState(1000);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const docRef = doc(db, 'adminSettings', 'financials');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setMinWithdrawal(docSnap.data().minWithdrawal || 1000);
        }
      } catch (error) {
        console.error("Error fetching settings:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  const handleSaveFinancials = async () => {
    setSaving(true);
    try {
      await setDoc(doc(db, 'adminSettings', 'financials'), {
        minWithdrawal: Number(minWithdrawal),
        updatedAt: serverTimestamp()
      }, { merge: true });
      toast.success('Financial settings updated');
    } catch (error: any) {
      toast.error('Failed to save: ' + error.message);
    } finally {
      setSaving(false);
    }
  };

  const sections = [
    { title: 'General Settings', icon: Settings, items: ['Platform Name', 'Logo & Branding', 'Timezone'] },
    { title: 'User Permissions', icon: Shield, items: ['Role Definitions', 'Admin Access', 'Audit Logs'] },
    { title: 'Notifications', icon: Bell, items: ['Email Templates', 'System Alerts', 'Push Notifications'] },
  ];

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto pb-20">
        <div className="mb-12">
          <h1 className="text-4xl font-bold text-slate-900 dark:text-white tracking-tight uppercase mb-2">System Settings</h1>
          <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-wider">Global platform configuration and controls</p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
          {/* Profile Sidebar */}
          <div className="lg:col-span-4 space-y-8">
            <div className="bg-white dark:bg-slate-900 p-10 rounded-[2.5rem] border border-slate-200 dark:border-white/5 shadow-xl">
              <div className="flex flex-col items-center text-center">
                <div className="relative mb-6">
                  <div className="w-24 h-24 bg-gradient-to-tr from-cyan-500 to-blue-600 rounded-3xl flex items-center justify-center text-white text-3xl font-bold shadow-lg">
                    A
                  </div>
                  <div className="absolute -bottom-2 -right-2 w-8 h-8 bg-emerald-500 border-4 border-white dark:border-slate-900 rounded-full"></div>
                </div>
                <h3 className="text-xl font-bold text-slate-900 dark:text-white uppercase tracking-tight">Super Admin</h3>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mt-1">master@blueteeth.com</p>
                <div className="mt-8 pt-8 border-t border-slate-100 dark:border-white/5 w-full">
                  <button className="w-full py-4 bg-slate-50 dark:bg-white/5 rounded-2xl text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider hover:bg-slate-100 dark:hover:bg-white/10 transition-all">
                    Security Dashboard
                  </button>
                </div>
              </div>
            </div>

            {/* Financial Controls - EXPLICIT SECTION */}
            <div className="bg-slate-900 text-white p-10 rounded-[2.5rem] shadow-2xl relative overflow-hidden group">
              <div className="relative z-10">
                <div className="flex items-center gap-3 mb-8">
                  <div className="p-2 bg-white/10 rounded-lg">
                    <CreditCard className="text-cyan-400" size={20} />
                  </div>
                  <h3 className="text-xs font-bold uppercase tracking-[0.2em]">Financial Controls</h3>
                </div>

                <div className="space-y-6">
                  <div>
                    <label className="text-[9px] font-bold text-slate-400 uppercase tracking-wider block mb-3">Min. Withdrawal (INR)</label>
                    <div className="relative">
                      <span className="absolute left-4 top-1/2 -translate-y-1/2 text-cyan-400 font-bold">₹</span>
                      <input 
                        type="number"
                        value={minWithdrawal}
                        onChange={(e) => setMinWithdrawal(Number(e.target.value))}
                        className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-3 text-lg font-bold focus:outline-none focus:border-cyan-500 transition-all"
                      />
                    </div>
                  </div>

                  <button 
                    onClick={handleSaveFinancials}
                    disabled={saving}
                    className="w-full py-4 bg-cyan-500 hover:bg-cyan-600 text-white rounded-xl font-bold text-[10px] uppercase tracking-wider flex items-center justify-center gap-2 transition-all shadow-xl shadow-cyan-500/20"
                  >
                    {saving ? <Loader2 className="animate-spin" size={16} /> : <><Save size={16} /> Update Financials</>}
                  </button>
                </div>
                
                <div className="mt-8 flex items-start gap-3 bg-white/5 p-4 rounded-2xl border border-white/5">
                  <Info size={14} className="text-cyan-400 shrink-0 mt-0.5" />
                  <p className="text-[9px] text-slate-400 font-medium leading-relaxed">
                    Changes will take effect instantly for all clinician payout requests globally.
                  </p>
                </div>
              </div>
              <div className="absolute -bottom-10 -right-10 w-40 h-40 bg-cyan-500/10 rounded-full blur-3xl"></div>
            </div>
          </div>

          {/* Settings Sections */}
          <div className="lg:col-span-8 space-y-8">
            {sections.map((section) => (
              <div key={section.title} className="bg-white dark:bg-slate-900 p-10 rounded-[2.5rem] border border-slate-200 dark:border-white/5 shadow-sm">
                <div className="flex items-center gap-4 mb-10">
                  <div className="w-12 h-12 bg-slate-50 dark:bg-white/5 rounded-2xl flex items-center justify-center text-cyan-500 shadow-inner">
                    <section.icon size={24} />
                  </div>
                  <h3 className="text-xl font-bold text-slate-900 dark:text-white uppercase tracking-tight">{section.title}</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {section.items.map((item) => (
                    <button key={item} className="flex items-center justify-between p-6 bg-slate-50 dark:bg-white/2 border border-slate-100 dark:border-white/5 rounded-2xl group hover:border-cyan-500/30 transition-all text-left">
                      <span className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider group-hover:text-slate-900 dark:group-hover:text-white">{item}</span>
                      <ChevronRight size={18} className="text-slate-300 group-hover:text-cyan-500 group-hover:translate-x-1 transition-all" />
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
