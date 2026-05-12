import Link from 'next/link';
import { SearchX, Home, ArrowLeft } from 'lucide-react';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: '404 – Page Not Found | Blueteeth',
  description: 'The page you are looking for does not exist.',
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="max-w-md w-full text-center">
        {/* Large 404 visual */}
        <div className="relative mb-8">
          <span className="text-[120px] font-black text-slate-100 leading-none select-none">
            404
          </span>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-20 h-20 bg-cyan-100 rounded-2xl flex items-center justify-center shadow-lg">
              <SearchX size={40} className="text-cyan-500" />
            </div>
          </div>
        </div>

        <h1 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">
          Page not found
        </h1>
        <p className="text-slate-500 text-sm font-medium mb-8 leading-relaxed">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
          Please check the URL or go back to the dashboard.
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/dashboard"
            className="flex items-center justify-center gap-2 px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-600 text-white rounded-xl font-bold text-sm shadow-lg shadow-cyan-500/25 hover:opacity-90 transition-all"
          >
            <Home size={16} />
            Go to Dashboard
          </Link>
          <Link
            href="/"
            className="flex items-center justify-center gap-2 px-6 py-3 bg-white border border-slate-200 text-slate-700 rounded-xl font-bold text-sm hover:bg-slate-50 transition-all"
          >
            <ArrowLeft size={16} />
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
