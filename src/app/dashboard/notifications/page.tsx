'use client';

import { useState } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { useNotifications } from '@/hooks/useNotifications';
import { 
  Bell, 
  CheckCheck, 
  Search, 
  Trash2, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Info,
  Loader2,
  Calendar,
  CheckCircle,
  Inbox,
  Clock,
  Filter as FilterIcon,
  ChevronRight
} from 'lucide-react';
import { format } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import { db } from '@/lib/firebase';
import { deleteDoc, doc, writeBatch } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';

export default function NotificationsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const { notifications, loading, markAsRead, markAllAsRead } = useNotifications();
  const [filter, setFilter] = useState<'all' | 'unread' | 'success' | 'warning' | 'error'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isDeletingAll, setIsDeletingAll] = useState(false);

  const filteredNotifications = notifications
    .filter(n => {
      if (filter === 'all') return true;
      if (filter === 'unread') return !n.isRead;
      return n.type === filter;
    })
    .filter(n => 
      n.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      n.message.toLowerCase().includes(searchQuery.toLowerCase())
    );

  const deleteNotification = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    try {
      await deleteDoc(doc(db, 'notifications', id));
      toast.success('Notification removed');
    } catch (error) {
      toast.error('Failed to delete');
    }
  };

  const handleNotificationClick = async (notif: any) => {
    if (!notif.isRead) {
      await markAsRead(notif.id);
    }
    if (notif.link) {
      router.push(notif.link);
    }
  };

  const clearAllNotifications = async () => {
    if (!user || !notifications.length) return;
    if (!confirm('Are you sure you want to delete all notifications?')) return;

    setIsDeletingAll(true);
    try {
      const batch = writeBatch(db);
      notifications.forEach((n) => {
        batch.delete(doc(db, 'notifications', n.id));
      });
      await batch.commit();
      toast.success('All notifications cleared');
    } catch (error) {
      toast.error('Failed to clear notifications');
    } finally {
      setIsDeletingAll(false);
    }
  };

  const unreadCount = notifications.filter(n => !n.isRead).length;

  return (
    <DashboardLayout>
      <div className="max-w-7xl mx-auto pb-10">
        {/* Header Section */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-12">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <div className="w-12 h-12 bg-cyan-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-cyan-600/20">
                <Bell size={24} />
              </div>
              <h1 className="text-4xl font-bold text-slate-900 dark:text-white tracking-tight uppercase tracking-tight">Activity Log</h1>
            </div>
            <div className="text-slate-500 dark:text-slate-400 font-bold ml-1 flex items-center gap-2">
              <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
              Live system monitoring and alerts
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button 
              onClick={markAllAsRead}
              disabled={unreadCount === 0}
              className="flex items-center gap-2 px-6 py-3.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-slate-50 transition-all disabled:opacity-50"
            >
              <CheckCheck size={18} /> Mark All Read
            </button>
            <button 
              onClick={clearAllNotifications}
              disabled={notifications.length === 0 || isDeletingAll}
              className="flex items-center gap-2 px-6 py-3.5 bg-red-50 dark:bg-red-500/10 text-red-600 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-red-100 transition-all disabled:opacity-50"
            >
              {isDeletingAll ? <Loader2 className="animate-spin" size={18} /> : <Trash2 size={18} />} 
              Purge Log
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8 items-start">
          {/* Filters Sidebar */}
          <div className="lg:col-span-1 space-y-6 sticky top-24">
            <div className="glass-card rounded-2xl p-6 border border-slate-100 shadow-sm">
              <div className="relative mb-6">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text" 
                  placeholder="Search log..." 
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl text-xs font-bold focus:ring-2 focus:ring-cyan-500 outline-none"
                />
              </div>

              <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center gap-2 px-2">
                <FilterIcon size={14} className="text-cyan-600" /> Filter Options
              </h3>
              
              <div className="space-y-1.5">
                {[
                  { id: 'all', label: 'All Alerts', icon: Inbox, color: 'text-slate-400' },
                  { id: 'unread', label: 'Unread Only', icon: Clock, color: 'text-cyan-500' },
                  { id: 'success', label: 'Success', icon: CheckCircle2, color: 'text-emerald-500' },
                  { id: 'warning', label: 'Warnings', icon: AlertTriangle, color: 'text-amber-500' },
                  { id: 'error', label: 'Critical', icon: XCircle, color: 'text-red-500' },
                ].map((item) => (
                  <button
                    key={item.id}
                    onClick={() => setFilter(item.id as any)}
                    className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all group ${
                      filter === item.id 
                        ? 'bg-slate-900 text-white shadow-xl' 
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <item.icon size={18} className={filter === item.id ? 'text-cyan-400' : item.color} />
                      <span className="text-xs font-bold uppercase tracking-tight">{item.label}</span>
                    </div>
                    {item.id === 'unread' && unreadCount > 0 && (
                      <span className={`px-2 py-0.5 rounded-lg text-[9px] font-bold ${filter === 'unread' ? 'bg-cyan-500 text-white' : 'bg-cyan-50 text-cyan-600'}`}>
                        {unreadCount}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>

            <div className="glass-card rounded-2xl p-6 bg-slate-900 text-white overflow-hidden relative border-none">
              <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/20 rounded-full blur-3xl -mr-16 -mt-16" />
              <div className="relative z-10">
                <h3 className="text-xs font-bold uppercase tracking-wider mb-2">Real-time Hub</h3>
                <p className="text-slate-400 text-[10px] font-bold leading-relaxed mb-6">Notifications are synced instantly across all your connected devices.</p>
                <div className="w-full h-1 bg-white/10 rounded-full overflow-hidden">
                  <motion.div 
                    animate={{ x: [-100, 100] }} 
                    transition={{ repeat: Infinity, duration: 2, ease: "linear" }} 
                    className="w-1/2 h-full bg-cyan-500" 
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Notifications Feed */}
          <div className="lg:col-span-3">
            {loading ? (
              <div className="py-32 flex flex-col items-center justify-center text-slate-300">
                <Loader2 className="animate-spin mb-4" size={48} />
                <p className="font-bold uppercase tracking-[0.3em] text-[10px]">Syncing secure log...</p>
              </div>
            ) : filteredNotifications.length > 0 ? (
              <div className="space-y-4">
                <AnimatePresence initial={false}>
                  {filteredNotifications.map((n) => (
                    <motion.div 
                      layout
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      exit={{ opacity: 0, x: 20 }}
                      key={n.id}
                      onClick={() => handleNotificationClick(n)}
                      className={`relative glass-card rounded-2xl p-6 flex gap-6 hover:shadow-xl hover:-translate-y-1 transition-all cursor-pointer group border border-slate-100 ${!n.isRead ? 'bg-cyan-50/10 dark:bg-cyan-500/5' : ''}`}
                    >
                      {!n.isRead && <div className="absolute left-0 top-6 bottom-6 w-1.5 bg-cyan-500 rounded-r-full shadow-[0_0_10px_rgba(6,182,212,0.5)]" />}
                      
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-sm ${
                        n.type === 'success' ? 'bg-emerald-50 text-emerald-600' :
                        n.type === 'warning' ? 'bg-amber-50 text-amber-600' :
                        n.type === 'error' ? 'bg-red-50 text-red-600' :
                        'bg-blue-50 text-blue-600'
                      }`}>
                        {n.type === 'success' ? <CheckCircle2 size={24} /> :
                         n.type === 'warning' ? <AlertTriangle size={24} /> :
                         n.type === 'error' ? <XCircle size={24} /> :
                         <Info size={24} />}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4 mb-2">
                          <div className="min-w-0">
                            <h3 className={`text-lg font-bold tracking-tight truncate ${!n.isRead ? 'text-slate-900 dark:text-white' : 'text-slate-600 dark:text-slate-400'}`}>
                              {n.title}
                            </h3>
                            <div className="flex items-center gap-4 text-[10px] text-slate-400 font-bold uppercase tracking-wider mt-1">
                              <span className="flex items-center gap-1.5">
                                <Calendar size={12} /> {n.createdAt?.toDate ? format(n.createdAt.toDate(), 'dd MMM, yyyy') : 'Live'}
                              </span>
                              <span className="flex items-center gap-1.5">
                                <Clock size={12} /> {n.createdAt?.toDate ? format(n.createdAt.toDate(), 'hh:mm a') : 'Now'}
                              </span>
                            </div>
                          </div>
                          
                          <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button 
                              onClick={(e) => deleteNotification(e, n.id)}
                              className="p-2.5 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-xl transition-all"
                              title="Delete permanently"
                            >
                              <Trash2 size={18} />
                            </button>
                            <div className="p-2.5 text-slate-300">
                              <ChevronRight size={20} />
                            </div>
                          </div>
                        </div>
                        <p className={`text-sm leading-relaxed max-w-3xl ${!n.isRead ? 'text-slate-700 dark:text-slate-200 font-bold' : 'text-slate-500 dark:text-slate-400 font-medium'}`}>
                          {n.message}
                        </p>
                      </div>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            ) : (
              <div className="py-32 text-center glass-card rounded-3xl border-dashed border-2 border-slate-200">
                <div className="w-20 h-20 bg-slate-50 dark:bg-slate-800 rounded-3xl flex items-center justify-center mx-auto mb-6 text-slate-200">
                  <Inbox size={48} />
                </div>
                <h3 className="text-3xl font-bold text-slate-900 dark:text-white uppercase tracking-tight">Log is Clean</h3>
                <p className="text-slate-500 mt-2 font-bold max-w-xs mx-auto text-sm">
                  {searchQuery ? "No matching logs found in the system archives." : "All system events have been acknowledged. There's nothing to display."}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}
