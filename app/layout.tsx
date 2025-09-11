import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import RegisterSW from "./register-sw";
import { AuthProvider } from "@/contexts/AuthContext";
import { ToastProvider } from "@/contexts/ToastContext";
import SyncSetup from "@/components/SyncSetup";
import PersistentStorage from "@/components/PersistentStorage";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  applicationName: 'Mark-App',
  title: 'Mark-App',
  description: 'Lot Logger PWA',
  // App Router manifest is auto-routed; make it explicit:
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'Mark-App'
  }
}

export const viewport: Viewport = {
  themeColor: '#000000'
}

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">

      {/* Apply Tailwind baseline to body; keep your font vars */}
      <body className={`${geistSans.variable} ${geistMono.variable} bg-brand-bg text-brand-text antialiased`}>
        <PersistentStorage />
        <ToastProvider>
          <SyncSetup />
          <AuthProvider>
            {children}
          </AuthProvider>
        </ToastProvider>

        <RegisterSW />
      </body>
    </html>
  );
}