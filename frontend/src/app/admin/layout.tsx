import ProtectedRoute from '@/components/auth/ProtectedRoute';
import AdminLayout from '@/components/layouts/AdminLayout';
import { ReactNode } from 'react';

export default function AdminPagesLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ProtectedRoute allowedRoles={['admin']}>
      <AdminLayout>
        {children}
      </AdminLayout>
    </ProtectedRoute>
  );
}
