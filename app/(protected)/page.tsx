'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ProtectedIndex() { 
  const router = useRouter();
  useEffect(() => { router.replace('/new'); }, [router]);
  return null;
}