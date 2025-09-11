import type { ReactNode } from 'react';
import AuthGuard from '@/components/AuthGuard';
import AppHeader from '@/components/AppHeader';

export default function ProtectedLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-brand-bg">
      <AuthGuard>
        <AppHeader />
        <main className="mx-auto max-w-xl p-5 pb-24 space-y-6">
          {children}
        </main>
      </AuthGuard>
    </div>
  );
}
