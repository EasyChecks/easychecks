'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types/auth';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: UserRole[];
  requireAuth?: boolean;
}

export default function ProtectedRoute({ 
  children, 
  allowedRoles,
  requireAuth = true 
}: ProtectedRouteProps) {
  const router = useRouter();
  const pathname = usePathname();
  const { user, isAuthenticated, isLoading } = useAuth();

  useEffect(() => {
    // Wait for auth to initialize
    if (isLoading) return;

    // Check if authentication is required
    if (requireAuth && !isAuthenticated) {
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }

    // Check role-based access — use dashboardMode if set (admin logging in as user, etc.)
    const effectiveRole = user?.dashboardMode ?? user?.role;
    if (requireAuth && user && allowedRoles && !allowedRoles.includes(effectiveRole)) {
      // Redirect to appropriate dashboard based on effective role
      if (effectiveRole === 'user') {
        router.push('/user/dashboard');
      } else if (effectiveRole === 'manager') {
        router.push('/manager/dashboard');
      } else if (effectiveRole === 'superadmin') {
        router.push('/superadmin/dashboard');
      } else if (effectiveRole === 'admin') {
        router.push('/admin/dashboard');
      }
    }
  }, [isAuthenticated, isLoading, user, allowedRoles, requireAuth, router, pathname]);

  // Show loading state
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600 font-medium">กำลังโหลด...</p>
        </div>
      </div>
    );
  }

  // Check authentication
  if (requireAuth && !isAuthenticated) {
    // If sessionStorage has authUser, wait briefly for state to sync instead of redirecting
    if (typeof window !== 'undefined' && sessionStorage.getItem('authUser')) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-slate-50">
          <div className="text-center">
            <div className="w-16 h-16 border-4 border-orange-500 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <p className="text-gray-600 font-medium">กำลังโหลด...</p>
          </div>
        </div>
      );
    }
    return null; // Will redirect in useEffect
  }

  // Check role-based access — use dashboardMode if set (admin logging in as user, etc.)
  const effectiveRoleRender = user?.dashboardMode ?? user?.role;
  if (requireAuth && user && allowedRoles && !allowedRoles.includes(effectiveRoleRender)) {
    return null; // Will redirect in useEffect
  }

  return <>{children}</>;
}
