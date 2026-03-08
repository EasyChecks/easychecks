'use client';

import { useAuth } from '@/contexts/AuthContext';
import { ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import BottomNavigation from './BottomNavigation';

interface UserLayoutProps {
  children: ReactNode;
}

export default function UserLayout({ children }: UserLayoutProps) {
  const { user } = useAuth();
  const router = useRouter();
  const basePath = user?.role === 'manager' ? '/manager' : '/user';

  return (
    <div className="min-h-screen bg-[#f5f6f7] pb-20">
      {/* Top Bar — Figma orange gradient header */}
      <header className="bg-linear-to-r from-[#f26623] to-[#ea580c] sticky top-0 z-40">
        <div className="px-4 py-3">
          <div className="flex items-center justify-between">
            {/* Left: profile icon + title */}
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-sm">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#f26623]" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
                </svg>
              </div>
              <div>
                <h1 className="text-lg font-bold text-white leading-tight">ระบบลงเวลา</h1>
                <p className="text-xs text-white/80">EasyCheck</p>
              </div>
            </div>

            {/* Right: notification + avatar */}
            <div className="flex items-center gap-3">
              {/* Bell icon with badge — navigates to announcements page */}
              <button className="relative p-1" onClick={() => router.push(`${basePath}/announcements`)}>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                </svg>
              </button>
              {/* Profile avatar */}
              <div className="w-10 h-10 bg-gray-800 rounded-full flex items-center justify-center text-white font-bold text-sm shadow-md">
                {user?.name?.charAt(0) || 'U'}
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="p-4">
        {children}
      </main>

      {/* Bottom Navigation */}
      <BottomNavigation />
    </div>
  );
}
