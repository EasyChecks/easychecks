import ProtectedRoute from '@/components/auth/ProtectedRoute';
import UserLayout from '@/components/layouts/UserLayout';
import { ReactNode } from 'react';

export default function UserPagesLayout({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <ProtectedRoute allowedRoles={['user']}>
      <UserLayout>
        {children}
      </UserLayout>
    </ProtectedRoute>
  );
}
