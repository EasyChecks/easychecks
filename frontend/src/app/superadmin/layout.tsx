import ProtectedRoute from '@/components/auth/ProtectedRoute';
import SuperAdminLayout from '@/components/layouts/SuperAdminLayout';
import { ReactNode } from 'react';

export default function SuperAdminPagesLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ProtectedRoute allowedRoles={['superadmin']}>
      <SuperAdminLayout>
        {children}
      </SuperAdminLayout>
    </ProtectedRoute>
  );
}
