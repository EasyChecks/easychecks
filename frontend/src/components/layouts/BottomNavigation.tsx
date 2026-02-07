'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function BottomNavigation() {
  const pathname = usePathname();
  const { user } = useAuth();
  const isManager = user?.role === 'manager';
  const basePath = isManager ? '/manager' : '/user';

  const navItems = isManager ? [
    {
      name: 'หน้าหลัก',
      href: `${basePath}/dashboard`,
      icon: (isActive: boolean) => (
        <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${isActive ? 'text-orange-500' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      )
    },
    {
      name: 'ขอลา',
      href: `${basePath}/leave-request`,
      icon: (isActive: boolean) => (
        <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${isActive ? 'text-orange-500' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    },
    {
      name: 'อนุมัติลา',
      href: `${basePath}/history`,
      icon: (isActive: boolean) => (
        <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${isActive ? 'text-orange-500' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      )
    },
    {
      name: 'อีเวนท์',
      href: `${basePath}/events`,
      icon: (isActive: boolean) => (
        <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${isActive ? 'text-orange-500' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    },
    {
      name: 'โปรไฟล์',
      href: `${basePath}/profile`,
      icon: (isActive: boolean) => (
        <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${isActive ? 'text-orange-500' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      )
    },
  ] : [
    {
      name: 'หน้าหลัก',
      href: `${basePath}/dashboard`,
      icon: (isActive: boolean) => (
        <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${isActive ? 'text-orange-500' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
        </svg>
      )
    },
    {
      name: 'ขอลา',
      href: `${basePath}/leave-request`,
      icon: (isActive: boolean) => (
        <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${isActive ? 'text-orange-500' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
        </svg>
      )
    },
    {
      name: 'อีเวนท์',
      href: `${basePath}/events`,
      icon: (isActive: boolean) => (
        <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${isActive ? 'text-orange-500' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
      )
    },
    {
      name: 'ประวัติ',
      href: `${basePath}/history`,
      icon: (isActive: boolean) => (
        <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${isActive ? 'text-orange-500' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
        </svg>
      )
    },
    {
      name: 'โปรไฟล์',
      href: `${basePath}/profile`,
      icon: (isActive: boolean) => (
        <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${isActive ? 'text-orange-500' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
        </svg>
      )
    },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white border-t-2 border-gray-200 shadow-lg z-50">
      <div className="flex justify-around items-center h-16">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className="flex flex-col items-center justify-center flex-1 h-full"
            >
              {item.icon(isActive)}
              <span className={`text-xs mt-1 ${isActive ? 'text-orange-500 font-semibold' : 'text-gray-500'}`}>
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
