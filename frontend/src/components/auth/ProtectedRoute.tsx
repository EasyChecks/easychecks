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

    // Check role-based access
    // Allow access if:
    // 1. User's actual role is in allowedRoles, OR
    // 2. User is admin/manager/superadmin and route allows 'user' (frontend pages)
    const userActualRole = user?.role;
    const hasAccess = allowedRoles && userActualRole && (allowedRoles.includes(userActualRole) || 
                      (allowedRoles.includes('user') && ['admin', 'manager', 'superadmin'].includes(userActualRole)));
    
    if (requireAuth && user && allowedRoles && userActualRole && !hasAccess) {
      // Redirect to appropriate dashboard based on actual role
      if (userActualRole === 'user') {
        router.push('/user/dashboard');
      } else if (userActualRole === 'manager') {
        router.push('/manager/dashboard');
      } else if (userActualRole === 'superadmin') {
        router.push('/superadmin/dashboard');
      } else if (userActualRole === 'admin') {
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

  // Check role-based access
  // Allow access if:
  // 1. User's actual role is in allowedRoles, OR
  // 2. User is admin/manager/superadmin and route allows 'user' (frontend pages)
  const userActualRole = user?.role;
  const hasAccess = allowedRoles.includes(userActualRole) || 
                    (allowedRoles.includes('user') && ['admin', 'manager', 'superadmin'].includes(userActualRole));
  
  if (requireAuth && user && allowedRoles && userActualRole && !hasAccess) {
    return null; // Will redirect in useEffect
  }

  return <>{children}</>;
}
