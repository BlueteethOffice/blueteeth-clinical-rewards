'use client';

import { useEffect, useState } from 'react';
import DashboardLayout from '@/components/dashboard/DashboardLayout';
import { useAuth } from '@/context/AuthContext';
import { db } from '@/lib/firebase';
import { collection, query, onSnapshot, updateDoc, doc, deleteDoc } from 'firebase/firestore';
import { User as AppUser } from '@/types';
import { 
  Search, 
  Users, 
  UserPlus, 
  MoreVertical, 
  Shield, 
  Stethoscope, 
  Briefcase,
  Loader2,
  Mail,
  Phone,
  ArrowUpRight,
  Lock
} from 'lucide-react';
import { formatName } from '@/lib/utils';
import toast from 'react-hot-toast';
import { Trash2 } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [showAdmins, setShowAdmins] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<AppUser | null>(null);
  const [newUserData, setNewUserData] = useState({
    name: '',
    email: '',
    phone: '',
    role: 'associate' as 'associate' | 'clinician' | 'admin'
  });
  const { user: currentUser } = useAuth();

  useEffect(() => {
    if (!currentUser || currentUser.role !== 'admin') return;

    // 🚀 NO-INDEX QUERY: Removed 'orderBy'
    const q = query(collection(db, 'users'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const data = snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() })) as AppUser[];
      
      // 🔄 Client-Side Sorting
      data.sort((a: any, b: any) => {
        const timeA = a.createdAt?.toDate ? a.createdAt.toDate().getTime() : 0;
        const timeB = b.createdAt?.toDate ? b.createdAt.toDate().getTime() : 0;
        return timeB - timeA;
      });

      setUsers(data);
      setLoading(false);
    }, (error) => {
      console.error("User Sync Error:", error);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <Shield size={14} className="text-purple-500" />;
      case 'clinician': return <Stethoscope size={14} className="text-cyan-500" />;
      case 'associate': return <Briefcase size={14} className="text-emerald-500" />;
      default: return null;
    }
  };

  const handleDeleteUser = async (uid: string, name: string) => {
    if (!confirm(`Are you sure you want to permanently delete user: ${name}? This action cannot be undone.`)) return;
    
    try {
      await deleteDoc(doc(db, 'users', uid));
      toast.success('User deleted successfully');
    } catch (error) {
      console.error("Delete Error:", error);
      toast.error('Failed to delete user');
    }
  };

  const handleUpdateUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;
    
    try {
      const { uid, ...updateData } = selectedUser;
      await updateDoc(doc(db, 'users', uid), updateData as any);
      toast.success('User updated successfully');
      setShowEditModal(false);
    } catch (error) {
      toast.error('Failed to update user');
    }
  };

  const handleProvisionUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUserData.email || !newUserData.name) {
      toast.error('Name and Email are required');
      return;
    }
    
    try {
      const usersRef = collection(db, 'users');
      // In a real app, you'd use a cloud function to create the actual Auth user too.
      // For now, we'll create the record in the database.
      await updateDoc(doc(usersRef, Date.now().toString()), {
        ...newUserData,
        createdAt: new Date(),
        totalEarnings: 0,
        totalPoints: 0
      });
      toast.success('User provisioned successfully');
      setShowAddModal(false);
      setNewUserData({ name: '', email: '', phone: '', role: 'associate' });
    } catch (error) {
      // If doc doesn't exist, we use setDoc. Since we are creating new, we use setDoc.
      try {
        const { setDoc } = await import('firebase/firestore');
        const customId = `BT-${Math.random().toString(36).substring(2, 9).toUpperCase()}`;
        await setDoc(doc(db, 'users', customId), {
          ...newUserData,
          uid: customId,
          createdAt: new Date(),
          totalEarnings: 0,
          totalPoints: 0
        });
        toast.success('User provisioned successfully');
        setShowAddModal(false);
        setNewUserData({ name: '', email: '', phone: '', role: 'associate' });
      } catch (err) {
        console.error(err);
        toast.error('Failed to provision user');
      }
    }
  };

  const filteredUsers = users.filter(u => {
    if (u.role === 'admin' && !showAdmins) return false;
    if (u.uid === currentUser?.uid) return false; // Hide self

    const displayName = formatName(u.name, u.role);
    const search = searchTerm.toLowerCase();
    return displayName.toLowerCase().includes(search) ||
           u.name.toLowerCase().includes(search) ||
           u.email.toLowerCase().includes(search);
  });

  return (
    <DashboardLayout hideNavbar={showEditModal || showAddModal}>
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 sm:mb-8 flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-1 sm:px-0">
          <div className="min-w-0">
            <h1 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white tracking-tight uppercase">User Management</h1>
            <p className="text-[10px] font-bold text-slate-500 dark:text-slate-400 uppercase tracking-wider mt-1">Manage system users, roles, and earnings.</p>
          </div>
          <button 
            onClick={() => setShowAddModal(true)}
            className="w-full sm:w-auto justify-center px-6 py-3.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-xl font-bold text-[10px] uppercase tracking-wider flex items-center gap-2 shadow-lg active:scale-95 transition-all"
          >
            <UserPlus size={16} /> Add New User
          </button>
        </div>

        <div className="bg-white dark:bg-slate-900/40 rounded-xl border border-slate-100 dark:border-white/5 shadow-sm overflow-hidden mx-1 sm:mx-0">
          <div className="p-4 sm:p-6 border-b border-slate-50 dark:border-white/5 bg-white/50 dark:bg-transparent flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4">
            <div className="relative w-full sm:flex-1 sm:max-w-md">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="Search by name, email or ID..." 
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-3 bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-white/5 rounded-lg focus:border-cyan-500 outline-none transition-all font-bold text-xs text-slate-900 dark:text-white"
              />
            </div>
            
            <button 
              onClick={() => setShowAdmins(!showAdmins)}
              className={`w-full sm:w-auto justify-center flex items-center gap-2 px-5 py-3 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border ${
                showAdmins 
                ? 'bg-purple-50 border-purple-100 text-purple-600 shadow-sm' 
                : 'bg-slate-50 border-slate-100 text-slate-400 hover:bg-slate-100'
              }`}
            >
              <Shield size={14} /> {showAdmins ? 'Hide Admins' : 'Manage Admins'}
            </button>
          </div>

          <div className="lg:hidden p-4 space-y-3">
            {loading ? (
              <div className="py-16 flex flex-col items-center gap-4">
                <Loader2 className="animate-spin text-cyan-600" size={32} />
                <p className="text-[10px] font-bold text-slate-400 uppercase">Synchronizing Users...</p>
              </div>
            ) : filteredUsers.length === 0 ? (
              <div className="py-12 text-center text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                No users found
              </div>
            ) : (
              filteredUsers.map((u) => (
                <div key={u.uid} className="rounded-xl border border-slate-100 dark:border-white/5 bg-white dark:bg-slate-900 p-4 shadow-sm">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center font-bold text-slate-400 text-base shrink-0">
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900 dark:text-white text-xs tracking-tight truncate">{formatName(u.name, u.role)}</div>
                        <div className="text-[7px] font-bold text-slate-400 uppercase tracking-tight">ID: {u.uid.slice(-8).toUpperCase()}</div>
                      </div>
                    </div>
                    <div className="inline-flex shrink-0 items-center gap-1.5 px-2 py-1 bg-slate-50 dark:bg-slate-800 rounded-md text-[9px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider border border-slate-100 dark:border-white/5">
                      {getRoleIcon(u.role)}
                      {u.role}
                    </div>
                  </div>

                  <div className="mt-4 space-y-2 rounded-lg bg-slate-50/70 dark:bg-white/5 p-3">
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600 dark:text-slate-400 min-w-0">
                      <Mail size={12} className="text-cyan-500 shrink-0" />
                      <span className="truncate">{u.email}</span>
                    </div>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-600 dark:text-slate-400">
                      <Phone size={12} className="text-cyan-500 shrink-0" />
                      {u.phone || 'N/A'}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-bold text-slate-900 dark:text-white tracking-tight">
                        {u.role === 'associate' ? `${u.totalPoints || 0} PTS` : `₹${u.totalEarnings || 0}`}
                      </div>
                      <div className="text-[8px] font-bold text-slate-400 uppercase tracking-tight">Lifetime Activity</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button 
                        onClick={() => { setSelectedUser(u); setShowEditModal(true); }}
                        className="w-9 h-9 flex items-center justify-center bg-slate-100 dark:bg-slate-800 text-slate-500 rounded-lg hover:bg-slate-900 dark:hover:bg-white dark:hover:text-slate-900 transition-all shadow-sm"
                        title="Edit User"
                      >
                        <MoreVertical size={14} />
                      </button>
                      <button 
                        onClick={() => handleDeleteUser(u.uid, u.name)}
                        className="w-9 h-9 flex items-center justify-center bg-red-50 dark:bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all shadow-sm"
                        title="Delete User"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="hidden lg:block overflow-x-auto custom-scrollbar">
            {loading ? (
              <div className="py-20 flex flex-col items-center gap-4">
                <Loader2 className="animate-spin text-cyan-600" size={32} />
                <p className="text-[10px] font-bold text-slate-400 uppercase">Synchronizing Users...</p>
              </div>
            ) : (
              <table className="w-full text-left whitespace-nowrap min-w-[800px]">
                <thead>
                  <tr className="bg-slate-50/50 dark:bg-white/5 border-b border-slate-100 dark:border-white/5">
                    <th className="px-4 sm:px-6 py-4 text-[9px] font-bold text-slate-400 uppercase tracking-wider">User Profile</th>
                    <th className="px-4 sm:px-6 py-4 text-[9px] font-bold text-slate-400 uppercase tracking-wider">Contact Info</th>
                    <th className="px-4 sm:px-6 py-4 text-[9px] font-bold text-slate-400 uppercase tracking-wider">Role</th>
                    <th className="px-4 sm:px-6 py-4 text-[9px] font-bold text-slate-400 uppercase tracking-wider">Statistics</th>
                    <th className="px-4 sm:px-6 py-4 text-[9px] font-bold text-slate-400 uppercase tracking-wider text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50 dark:divide-white/5">
                  {filteredUsers.map((u) => (
                    <tr key={u.uid} className="hover:bg-slate-50/50 dark:hover:bg-white/5 transition-all group">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-slate-100 dark:bg-slate-800 rounded-lg flex items-center justify-center font-bold text-slate-400 text-base">
                            {u.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div className="font-bold text-slate-900 dark:text-white text-sm tracking-tight">{formatName(u.name, u.role)}</div>
                            <div className="text-[8px] font-bold text-slate-400 uppercase tracking-tight">ID: {u.uid.slice(-8).toUpperCase()}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 dark:text-slate-400">
                            <Mail size={10} className="text-cyan-500" /> {u.email}
                          </div>
                          <div className="flex items-center gap-1.5 text-[10px] font-bold text-slate-600 dark:text-slate-400">
                            <Phone size={10} className="text-cyan-500" /> {u.phone || 'N/A'}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="inline-flex items-center gap-1.5 px-2 py-0.5 bg-slate-50 dark:bg-slate-800 rounded-md text-[9px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider border border-slate-100 dark:border-white/5">
                          {getRoleIcon(u.role)}
                          {u.role}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-xs font-bold text-slate-900 dark:text-white tracking-tight">
                          {u.role === 'associate' ? `${u.totalPoints || 0} PTS` : `₹${u.totalEarnings || 0}`}
                        </div>
                        <div className="text-[8px] font-bold text-slate-400 uppercase tracking-tight">Lifetime Activity</div>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button 
                            onClick={() => { setSelectedUser(u); setShowEditModal(true); }}
                            className="w-8 h-8 flex items-center justify-center bg-slate-50 dark:bg-slate-800 text-slate-400 rounded-lg hover:bg-slate-900 dark:hover:bg-white dark:hover:text-slate-900 transition-all opacity-0 group-hover:opacity-100 shadow-sm"
                            title="Edit User"
                          >
                            <MoreVertical size={14} />
                          </button>
                          <button 
                            onClick={() => handleDeleteUser(u.uid, u.name)}
                            className="w-8 h-8 flex items-center justify-center bg-red-50 dark:bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all opacity-0 group-hover:opacity-100 shadow-sm"
                            title="Delete User"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <AnimatePresence>
          {showEditModal && selectedUser && (
            <div className="fixed inset-0 z-[99999] flex items-center justify-center p-2 sm:p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowEditModal(false)} className="absolute inset-0 bg-slate-950/90 backdrop-blur-xl" />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }} 
                animate={{ scale: 1, opacity: 1, y: 0 }} 
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="relative w-full max-w-2xl bg-white dark:bg-slate-900 rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden border border-slate-100 dark:border-white/5 flex flex-col max-h-[95vh] sm:max-h-[90vh]"
              >
                {/* Modal Header/Profile Header */}
                <div className="relative h-36 sm:h-52 bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 shrink-0 transition-all">
                  <button type="button" onClick={() => setShowEditModal(false)} className="absolute top-4 sm:top-6 right-4 sm:right-6 w-8 h-8 sm:w-10 sm:h-10 flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 text-white transition-all backdrop-blur-md z-30">✕</button>
                  <div className="absolute -bottom-10 left-6 sm:left-10 flex items-end gap-4 sm:gap-8 z-20 w-[calc(100%-3rem)] sm:w-auto">
                    <div className="w-20 h-20 sm:w-32 sm:h-32 bg-slate-100 dark:bg-slate-800 rounded-2xl sm:rounded-3xl overflow-hidden border-4 border-white dark:border-slate-900 shadow-2xl shrink-0 relative">
                      {selectedUser.photoURL ? (
                        <img src={selectedUser.photoURL} alt={selectedUser.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-slate-300 font-bold text-3xl sm:text-5xl">
                          {selectedUser.name?.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>
                    <div className="pb-4 sm:pb-8 min-w-0">
                      <h3 className="text-xl sm:text-3xl font-bold text-white tracking-tight uppercase leading-none mb-3 sm:mb-5 truncate drop-shadow-md">{formatName(selectedUser.name, selectedUser.role)}</h3>
                      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                        <div className={`px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl text-[8px] sm:text-[11px] font-bold uppercase tracking-[0.1em] border flex items-center gap-2 shadow-lg transition-all ${
                          selectedUser.role === 'admin' ? 'bg-purple-600 border-purple-400 text-white shadow-purple-500/20' :
                          selectedUser.role === 'clinician' ? 'bg-cyan-600 border-cyan-400 text-white shadow-cyan-500/20' :
                          selectedUser.role === 'emerald'
                        }`}>
                          {getRoleIcon(selectedUser.role)}
                          {selectedUser.role}
                        </div>
                        <span className="text-[8px] sm:text-[10px] font-bold text-cyan-50 uppercase tracking-wider bg-slate-800/80 backdrop-blur-md border border-white/10 px-2.5 py-1 sm:px-3 sm:py-1.5 rounded-lg sm:rounded-xl shadow-lg">ID: {selectedUser.uid.slice(0, 7).toUpperCase()}</span>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar p-6 sm:p-10 pt-16 sm:pt-16">
                  <div className="space-y-5 sm:space-y-10">
                    {/* Stats Mesh */}
                    <div className="grid grid-cols-2 gap-4 sm:gap-6">
                      <div className="p-4 sm:p-6 bg-slate-50 dark:bg-slate-800/50 rounded-xl sm:rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm">
                        <p className="text-[9px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 sm:mb-2">Activity</p>
                        <p className="text-xl sm:text-3xl font-bold text-slate-900 dark:text-white">
                          {selectedUser.role === 'associate' ? `${selectedUser.totalPoints || 0} PTS` : `₹${selectedUser.totalEarnings || 0}`}
                        </p>
                      </div>
                      <div className="p-4 sm:p-6 bg-slate-50 dark:bg-slate-800/50 rounded-xl sm:rounded-2xl border border-slate-100 dark:border-white/5 shadow-sm">
                        <p className="text-[9px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-1.5 sm:mb-2">Email</p>
                        <p className="text-[10px] sm:text-sm font-bold text-slate-900 dark:text-white truncate">{selectedUser.email}</p>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-8">
                      <div className="space-y-1.5 sm:space-y-2.5">
                        <label className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1">Full Name</label>
                        <input 
                          type="text" 
                          value={selectedUser.name || ''} 
                          readOnly
                          className="w-full px-4 py-3 sm:px-5 sm:py-4 bg-slate-50 dark:bg-slate-800/20 border border-slate-100 dark:border-white/5 rounded-xl sm:rounded-2xl font-bold text-sm sm:text-base text-slate-500 dark:text-slate-400 cursor-not-allowed shadow-inner transition-all"
                        />
                      </div>

                      <div className="space-y-1.5 sm:space-y-2.5">
                        <label className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1">Mobile Number</label>
                        <input 
                          type="text" 
                          value={selectedUser.phone || ''} 
                          readOnly
                          className="w-full px-4 py-3 sm:px-5 sm:py-4 bg-slate-50 dark:bg-slate-800/20 border border-slate-100 dark:border-white/5 rounded-xl sm:rounded-2xl font-bold text-sm sm:text-base text-slate-500 dark:text-slate-400 cursor-not-allowed shadow-inner transition-all"
                        />
                      </div>

                      <div className="space-y-1.5 sm:space-y-2.5">
                        <label className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1">Age</label>
                        <input 
                          type="text" 
                          value={selectedUser.age || 'N/A'} 
                          readOnly
                          className="w-full px-4 py-3 sm:px-5 sm:py-4 bg-slate-50 dark:bg-slate-800/20 border border-slate-100 dark:border-white/5 rounded-xl sm:rounded-2xl font-bold text-sm sm:text-base text-slate-500 dark:text-slate-400 cursor-not-allowed shadow-inner transition-all"
                        />
                      </div>

                      <div className="space-y-1.5 sm:space-y-2.5">
                        <label className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1">Gender</label>
                        <input 
                          type="text" 
                          value={selectedUser.gender || 'N/A'} 
                          readOnly
                          className="w-full px-4 py-3 sm:px-5 sm:py-4 bg-slate-50 dark:bg-slate-800/20 border border-slate-100 dark:border-white/5 rounded-xl sm:rounded-2xl font-bold text-sm sm:text-base text-slate-500 dark:text-slate-400 cursor-not-allowed shadow-inner transition-all"
                        />
                      </div>

                      {/* Professional Info */}
                      <div className="col-span-1 sm:col-span-2 pt-6 sm:pt-10 mt-2 sm:mt-4 border-t border-slate-100 dark:border-white/10">
                        <h4 className="text-[11px] sm:text-[13px] font-bold text-slate-900 dark:text-white uppercase tracking-[0.2em] mb-6 sm:mb-8 flex items-center gap-3">
                          <Shield size={18} className="text-cyan-600" /> Clinical Identity Mesh
                        </h4>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 sm:gap-8">
                          <div className="space-y-1.5 sm:space-y-2.5">
                            <label className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1">Registration Number</label>
                            <div className="px-4 py-3 sm:px-5 sm:py-4 bg-slate-50 dark:bg-slate-800/20 border border-slate-100 dark:border-white/5 rounded-xl sm:rounded-2xl font-bold text-[10px] sm:text-[12px] text-slate-500 dark:text-slate-400 tracking-wider shadow-inner">
                              {selectedUser.registrationNumber || 'NOT VERIFIED'}
                            </div>
                          </div>
                          <div className="space-y-1.5 sm:space-y-2.5">
                            <label className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1">Clinic Name</label>
                            <div className="px-4 py-3 sm:px-5 sm:py-4 bg-slate-50 dark:bg-slate-800/20 border border-slate-100 dark:border-white/5 rounded-xl sm:rounded-2xl font-bold text-sm sm:text-base text-slate-500 dark:text-slate-400 shadow-inner">
                              {selectedUser.clinicName || 'N/A'}
                            </div>
                          </div>
                          <div className="col-span-1 sm:col-span-2 space-y-1.5 sm:space-y-2.5">
                            <label className="text-[10px] sm:text-[11px] font-bold text-slate-400 uppercase tracking-wider ml-1">Clinic Address</label>
                            <div className="px-4 py-3 sm:px-5 sm:py-4 bg-slate-50 dark:bg-slate-800/20 border border-slate-100 dark:border-white/5 rounded-xl sm:rounded-2xl font-bold text-sm sm:text-base text-slate-500 dark:text-slate-400 min-h-[60px] sm:min-h-[80px] shadow-inner">
                              {selectedUser.clinicAddress || 'No address provided'}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="mt-6 sm:mt-10 p-4 sm:p-5 bg-amber-50 dark:bg-amber-500/5 rounded-xl sm:rounded-2xl border border-amber-100 dark:border-amber-500/10 flex items-center gap-3 sm:gap-4">
                      <div className="w-8 h-8 sm:w-10 sm:h-10 bg-amber-500 text-white rounded-lg sm:rounded-xl flex items-center justify-center shrink-0 shadow-xl shadow-amber-500/20">
                        <Lock size={16} />
                      </div>
                      <p className="text-[8px] sm:text-[10px] font-bold text-amber-800 dark:text-amber-400 uppercase leading-relaxed tracking-wider">
                        Security Notice: User identity fields are read-only for administrators to maintain global data integrity.
                      </p>
                    </div>
                  </div>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
        {/* ➕ Add New User Modal */}
        <AnimatePresence>
          {showAddModal && (
            <div className="fixed inset-0 z-[99999] flex items-center justify-center p-4">
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAddModal(false)} className="absolute inset-0 bg-slate-950/90 backdrop-blur-xl" />
              <motion.div 
                initial={{ scale: 0.9, opacity: 0, y: 20 }} 
                animate={{ scale: 1, opacity: 1, y: 0 }} 
                exit={{ scale: 0.9, opacity: 0, y: 20 }}
                className="relative w-full max-w-md bg-white dark:bg-slate-900 rounded-3xl shadow-2xl overflow-hidden border border-slate-100 dark:border-white/5"
              >
                <form onSubmit={handleProvisionUser} className="p-8">
                  <div className="flex items-center justify-between mb-8">
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 dark:text-white uppercase tracking-tight">Provision User</h3>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mt-1">Create a new platform identity</p>
                    </div>
                    <button type="button" onClick={() => setShowAddModal(false)} className="w-10 h-10 flex items-center justify-center rounded-full bg-slate-100 dark:bg-slate-800 text-slate-400 hover:bg-slate-900 hover:text-white transition-all">✕</button>
                  </div>

                  <div className="space-y-5">
                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Full Name</label>
                      <input 
                        type="text" 
                        required
                        placeholder="e.g. Dr. John Doe"
                        value={newUserData.name} 
                        onChange={(e) => setNewUserData({...newUserData, name: e.target.value})}
                        className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-white/5 rounded-xl outline-none focus:border-cyan-500 transition-all font-bold text-sm text-slate-900 dark:text-white"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Email Address</label>
                      <input 
                        type="email" 
                        required
                        placeholder="john@example.com"
                        value={newUserData.email} 
                        onChange={(e) => setNewUserData({...newUserData, email: e.target.value})}
                        className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-white/5 rounded-xl outline-none focus:border-cyan-500 transition-all font-bold text-sm text-slate-900 dark:text-white"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Mobile Number</label>
                      <input 
                        type="text" 
                        placeholder="10-12 digits"
                        value={newUserData.phone} 
                        onChange={(e) => setNewUserData({...newUserData, phone: e.target.value})}
                        className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-white/5 rounded-xl outline-none focus:border-cyan-500 transition-all font-bold text-sm text-slate-900 dark:text-white"
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">System Role</label>
                      <select 
                        value={newUserData.role} 
                        onChange={(e) => setNewUserData({...newUserData, role: e.target.value as any})}
                        className="w-full px-5 py-3.5 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-white/5 rounded-xl outline-none focus:border-cyan-500 transition-all font-bold text-sm text-slate-900 dark:text-white appearance-none cursor-pointer"
                      >
                        <option value="associate">Associate</option>
                        <option value="clinician">Clinician</option>
                        <option value="admin">Admin</option>
                      </select>
                    </div>
                  </div>

                  <button 
                    type="submit"
                    className="w-full mt-10 py-4 bg-slate-900 dark:bg-white text-white dark:text-slate-900 rounded-2xl font-bold text-[11px] uppercase tracking-[0.2em] hover:bg-slate-800 dark:hover:bg-slate-100 transition-all shadow-2xl"
                  >
                    Create Identity
                  </button>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>
    </DashboardLayout>
  );
}
