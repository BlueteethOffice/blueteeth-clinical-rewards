'use client';

import { Mail, MessageCircle, ExternalLink, HelpCircle } from 'lucide-react';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/AuthContext';

export default function SupportCard() {
  const { user } = useAuth();
  
  // Professional WhatsApp link with pre-filled message
  // Professional WhatsApp link with pre-filled message
  const whatsappNumber = "919311997440"; // Admin Support Contact
  const clinicianID = user?.role === 'clinician' ? user.registrationNumber : user?.uid?.slice(-6);
  const whatsappMsg = encodeURIComponent(`Hello Blueteeth Support,\n\nI am ${user?.name || 'an Associate'} (ID: ${clinicianID || 'N/A'}). I need assistance with my dashboard.`);
  const whatsappUrl = `https://wa.me/${whatsappNumber}?text=${whatsappMsg}`;

  // Professional Email link
  // Professional Email link with diagnostic info for faster resolution
  const emailUrl = `mailto:support@blueteeth.in?subject=Support Request: ${user?.name || 'User'} [${user?.role?.toUpperCase() || 'MEMBER'}]&body=Hello Blueteeth Support Team,%0D%0A%0D%0AI need assistance with the following:%0D%0A%0D%0A--- User Identity ---%0D%0AUser: ${user?.name || 'N/A'}%0D%0AID: ${clinicianID || 'N/A'}%0D%0ARole: ${user?.role || 'N/A'}%0D%0APlatform: Blueteeth Clinical Dashboard%0D%0A--------------------%0D%0A%0D%0AMy Issue/Query:`;

  return (
    <div className="px-3 pb-0 mt-auto pt-4">
      <div className="bg-slate-50 dark:bg-slate-900/50 rounded-xl p-4 sm:p-6 text-slate-900 dark:text-white border border-slate-200 dark:border-slate-800 transition-all duration-300 relative overflow-hidden group">
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-9 h-9 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center border border-slate-200 dark:border-slate-700 shadow-sm">
              <HelpCircle size={18} className="text-cyan-600 dark:text-cyan-400" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base uppercase tracking-wider text-slate-900 dark:text-slate-100">Help & Support</h3>
              <p className="text-[10px] sm:text-[11px] font-bold text-slate-400 dark:text-slate-500 uppercase tracking-wider">Availability: 24/7</p>
            </div>
          </div>
          
          <p className="text-[11px] sm:text-[12px] text-slate-500 dark:text-slate-400 font-bold leading-relaxed mb-4 uppercase tracking-tight">
            Need assistance? Our dedicated support team is ready to help you now.
          </p>

          <div className="space-y-3">
            {/* EMAIL SUPPORT */}
            <motion.a 
              whileHover={{ x: 5 }}
              whileTap={{ scale: 0.98 }}
              href={emailUrl}
              className="flex items-center justify-between bg-white/10 hover:bg-white/20 backdrop-blur-md px-3 py-2.5 sm:px-4 sm:py-3.5 rounded-xl transition-all border border-white/10 group/btn"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-white dark:bg-slate-800 rounded-xl flex items-center justify-center border border-slate-200 dark:border-slate-700 group-hover/btn:scale-110 transition-transform">
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M2.25 18.75V7.5L12 14.25L21.75 7.5V18.75C21.75 19.1478 21.592 19.5294 21.3107 19.8107C21.0294 20.092 20.6478 20.25 20.25 20.25H3.75C3.35218 20.25 2.97064 20.092 2.68934 19.8107C2.40804 19.5294 2.25 19.1478 2.25 18.75Z" fill="#F8F9FA"/>
                    <path d="M2.25 7.5V6.75C2.25 6.35218 2.40804 5.97064 2.68934 5.68934C2.97064 5.40804 3.35218 5.25 3.75 5.25H20.25C20.6478 5.25 21.0294 5.40804 21.3107 5.68934C21.592 5.97064 21.75 6.35218 21.75 6.75V7.5L12 14.25L2.25 7.5Z" fill="#EA4335"/>
                    <path d="M21.75 7.5L12 14.25L2.25 7.5V6.75C2.25 6.35218 2.40804 5.97064 2.68934 5.68934C2.97064 5.40804 3.35218 5.25 3.75 5.25H20.25C20.6478 5.25 21.0294 5.40804 21.3107 5.68934C21.592 5.97064 21.75 6.35218 21.75 6.75V7.5Z" fill="#C5221F"/>
                    <path d="M2.25 18.75V7.5L5.25 9.75V20.25H3.75C3.35218 20.25 2.97064 20.092 2.68934 19.8107C2.40804 19.5294 2.25 19.1478 2.25 18.75Z" fill="#FBBC04"/>
                    <path d="M21.75 18.75V7.5L18.75 9.75V20.25H20.25C20.6478 20.25 21.0294 20.092 21.3107 19.8107C21.592 19.5294 21.75 19.1478 21.75 18.75Z" fill="#34A853"/>
                    <path d="M18.75 9.75L12 14.25L5.25 9.75V20.25H18.75V9.75Z" fill="#4285F4"/>
                  </svg>
                </div>
                <span className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-200">Email Support</span>
              </div>
              <ExternalLink size={12} className="opacity-40 group-hover/btn:opacity-100 transition-all" />
            </motion.a>

            {/* WHATSAPP SUPPORT */}
            <motion.a 
              whileHover={{ x: 5 }}
              whileTap={{ scale: 0.98 }}
              href={whatsappUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-between bg-emerald-500 hover:bg-emerald-600 px-3 py-2.5 sm:px-4 sm:py-3.5 rounded-xl transition-all shadow-lg shadow-emerald-900/20 group/btn border border-emerald-400/20"
            >
              <div className="flex items-center gap-3">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.414 0 .006 5.408 0 12.045c0 2.12.554 4.189 1.605 6.006L0 24l6.149-1.613a11.817 11.817 0 005.9 1.532h.005c6.634 0 12.043-5.409 12.049-12.047.002-3.218-1.251-6.243-3.528-8.52" fill="white"/>
                </svg>
                <span className="text-xs font-bold uppercase tracking-wider">Connect on WhatsApp</span>
              </div>
              <ExternalLink size={12} className="opacity-40 group-hover/btn:opacity-100 transition-all" />
            </motion.a>
          </div>
        </div>
      </div>
    </div>
  );
}
