import ProtectedRoute from '@/components/auth/ProtectedRoute';
import UserLayout from '@/components/layouts/UserLayout';
import { ReactNode } from 'react';

export default function ManagerPagesLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ProtectedRoute allowedRoles={['manager']}>
      <UserLayout>
        {children}
      </UserLayout>
    </ProtectedRoute>
  );
}
