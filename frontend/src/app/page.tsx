'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function HomePage() {
  const router = useRouter();
  const { isAuthenticated, user, isLoading } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    // Redirect based on role
    if (user) {
      if (user.role === 'user') {
        router.push('/user/dashboard');
      } else if (user.role === 'manager') {
        router.push('/manager/dashboard');
      } else if (user.role === 'admin' || user.role === 'superadmin') {
        router.push('/admin/dashboard');
      }
    }
  }, [isAuthenticated, user, isLoading, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <div className="text-center">
        <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600 font-medium">กำลังโหลด...</p>
      </div>
    </div>
  );
}
