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
    if (isLoading) return;

    if (requireAuth && !isAuthenticated) {
      router.push(`/login?redirect=${encodeURIComponent(pathname)}`);
      return;
    }

    // อนุญาต admin/manager/superadmin เข้าหน้า user ได้ด้วย (role สูงกว่าเข้าได้หมด)
    const userActualRole = user?.role;
    const hasAccess =
      !allowedRoles ||
      !userActualRole ||
      allowedRoles.includes(userActualRole) ||
      (allowedRoles.includes('user') && ['admin', 'manager', 'superadmin'].includes(userActualRole));
    
    if (requireAuth && user && allowedRoles && userActualRole && !hasAccess) {
      // redirect ไป dashboard ตาม role จริง
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

  // ถ้า sessionStorage มี authUser แต่ state ยัง null → รอ sync แทน redirect ทันที
  if (requireAuth && !isAuthenticated) {
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
    return null;
  }

  const userActualRole = user?.role;
  const hasAccess =
    !allowedRoles ||
    !userActualRole ||
    allowedRoles.includes(userActualRole) ||
    (allowedRoles.includes('user') && ['admin', 'manager', 'superadmin'].includes(userActualRole));
  
  if (requireAuth && user && allowedRoles && userActualRole && !hasAccess) {
    return null;
  }

  return <>{children}</>;
}
