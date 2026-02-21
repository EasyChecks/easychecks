'use client';

import { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { UserRole } from '@/types/auth';

interface ProtectedRouteProps {
  children: ReactNode;
  requiredRoles?: UserRole[];
  fallback?: ReactNode;
}

/**
 * ProtectedRoute component for role-based access control
 * If no roles are specified, it just checks if user is authenticated
 * If roles are specified, it checks if user's role is in the allowed list
 */
export function ProtectedRoute({
  children,
  requiredRoles = [],
  fallback
}: ProtectedRouteProps) {
  const router = useRouter();
  const { isAuthenticated, user, isLoading } = useAuth();

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

  if (!isAuthenticated || !user) {
    router.push('/login');
    return null;
  }

  // If specific roles are required, check if user has one of them
  if (requiredRoles.length > 0 && !requiredRoles.includes(user.role)) {
    // User doesn't have required role
    if (fallback) {
      return fallback;
    }
    
    // Redirect to appropriate dashboard based on role
    if (user.role === 'superadmin') {
      router.push('/superadmin/dashboard');
    } else if (user.role === 'admin') {
      router.push('/admin/dashboard');
    } else if (user.role === 'manager') {
      router.push('/manager/dashboard');
    } else {
      router.push('/user/dashboard');
    }
    return null;
  }

  return <>{children}</>;
}
