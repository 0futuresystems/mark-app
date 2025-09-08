import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import RegisterSW from "./register-sw";

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
        {/* Centered, readable content area with larger padding for Mark */}
        <main className="mx-auto max-w-xl p-5 pb-24 space-y-6">
          {children}
        </main>

        <RegisterSW />
      </body>
    </html>
  );
}