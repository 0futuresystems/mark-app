import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import RegisterSW from "./register-sw";
import { AuthProvider } from "@/src/contexts/AuthContext";
import { ToastProvider } from "@/src/contexts/ToastContext";
import SyncSetup from "@/src/components/SyncSetup";
import SyncBanner from "@/src/components/SyncBanner";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Lot Logger",
  description: "A PWA for lot tracking and logging",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <head>
        <link rel="manifest" href="/manifest.json" />
        <link rel="apple-touch-icon" href="/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="Lot Logger" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="theme-color" content="#0b132b" />
      </head>

      {/* Apply Tailwind baseline to body; keep your font vars */}
      <body className={`${geistSans.variable} ${geistMono.variable} bg-brand-bg text-slate-100 antialiased`}>
        <ToastProvider>
          <SyncSetup />
          <SyncBanner />
          <AuthProvider>
            {children}
          </AuthProvider>
        </ToastProvider>

        <RegisterSW />
      </body>
    </html>
  );
}