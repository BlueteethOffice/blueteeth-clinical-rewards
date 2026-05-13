import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import "react-easy-crop/react-easy-crop.css";
import { AuthProvider } from "@/context/AuthContext";
import { NotificationProvider } from "@/context/NotificationContext";
import { Toaster } from "react-hot-toast";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Blueteeth | Enterprise Reward Portal",
  description: "Modern healthcare reward and case management system for dental practices. Track cases, manage B-Points, and automate clinical rewards.",
  metadataBase: new URL('https://blueteeth-rewards.vercel.app'),
  alternates: {
    canonical: '/',
  },
  openGraph: {
    title: 'Blueteeth | Enterprise Reward Portal',
    description: 'The definitive ecosystem for clinical excellence. Bridging performance and automated rewards through enterprise-grade smart intelligence.',
    url: 'https://blueteeth-rewards.vercel.app',
    siteName: 'Blueteeth',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'Blueteeth Enterprise Reward Portal',
      },
    ],
    locale: 'en_IN',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Blueteeth | Enterprise Reward Portal',
    description: 'Clinical rewards management for 500+ dental practices.',
    images: ['/og-image.png'],
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
    },
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head />
      <body className={inter.className}>
        <AuthProvider>
          <NotificationProvider>
            {children}
            <Toaster 
              position="top-right"
              containerStyle={{ top: 40, right: 20 }}
              toastOptions={{
                duration: 4000,
                className: 'premium-toast',
                style: {
                  background: 'rgba(255, 255, 255, 0.85)',
                  backdropFilter: 'blur(20px) saturate(180%)',
                  color: '#1e293b',
                  boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15)',
                  borderRadius: '20px',
                  padding: '16px 20px',
                  border: '1px solid rgba(255, 255, 255, 0.5)',
                  fontSize: '13px',
                  fontWeight: '700',
                  letterSpacing: '0.025em',
                  textTransform: 'uppercase',
                  maxWidth: '400px',
                },
                success: {
                  style: {
                    borderLeft: '4px solid #0891b2',
                    background: 'rgba(255, 255, 255, 0.9)',
                  },
                  iconTheme: {
                    primary: '#0891b2',
                    secondary: '#fff',
                  },
                },
                error: {
                  style: {
                    borderLeft: '4px solid #e11d48',
                    background: 'rgba(255, 255, 255, 0.9)',
                  },
                  iconTheme: {
                    primary: '#e11d48',
                    secondary: '#fff',
                  },
                },
              }}
            />
          </NotificationProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
