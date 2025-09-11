'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function RootPage() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (!loading) {
      if (user) {
        // User is authenticated, redirect to auctions page
        router.push('/auctions');
      } else {
        // User is not authenticated, redirect to auth page
        router.push('/auth');
      }
    }
  }, [user, loading, router]);

  // Show loading while determining where to redirect
  return (
    <div className="min-h-screen bg-brand-bg flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-accent mx-auto mb-4"></div>
        <h1 className="text-2xl font-semibold text-brand-text">Loading...</h1>
      </div>
    </div>
  );
}
