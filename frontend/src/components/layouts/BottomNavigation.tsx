'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function BottomNavigation() {
  const pathname = usePathname();
  const { user } = useAuth();
  const role = user?.role;
  const roleBasePath = role === 'manager' ? '/manager' :
                       role === 'admin' ? '/admin' :
                       role === 'superadmin' ? '/superadmin' :
                       '/user';

  // Hybrid rule: admin/superadmin use /user/dashboard as Home, but keep role routes for other tabs.
  const homeHref = (role === 'admin' || role === 'superadmin') ? '/user/dashboard' : `${roleBasePath}/dashboard`;

  const homeTabs = [
    {
      name: 'หลัก',
      href: homeHref,
      icon: (isActive: boolean) => (
        <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${isActive ? 'text-[#f26623]' : 'text-[#a5a5a5]'}`} viewBox="0 0 24 24" fill="currentColor">
          <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z" />
        </svg>
      ),
    },
    {
      name: 'วันลา',
      href: `${roleBasePath}/leave-request`,
      icon: (isActive: boolean) => (
        <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${isActive ? 'text-[#f26623]' : 'text-[#a5a5a5]'}`} viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 6h-4V4c0-1.11-.89-2-2-2h-4c-1.11 0-2 .89-2 2v2H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-6 0h-4V4h4v2z" />
        </svg>
      ),
    },
    {
      name: 'กิจกรรม',
      href: `${roleBasePath}/events`,
      icon: (isActive: boolean) => (
        <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${isActive ? 'text-[#f26623]' : 'text-[#a5a5a5]'}`} viewBox="0 0 24 24" fill="currentColor">
          <path d="M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 11 8.76l1-1.36 1 1.36L15.38 12 17 10.83 14.92 8H20v6z" />
        </svg>
      ),
    },
    {
      name: 'ตั้งค่า',
      href: `${roleBasePath}/settings`,
      icon: (isActive: boolean) => (
        <svg xmlns="http://www.w3.org/2000/svg" className={`h-6 w-6 ${isActive ? 'text-[#f26623]' : 'text-[#a5a5a5]'}`} viewBox="0 0 24 24" fill="currentColor">
          <path d="M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 00.12-.61l-1.92-3.32a.488.488 0 00-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 00-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.07.62-.07.94s.02.64.07.94l-2.03 1.58a.49.49 0 00-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z" />
        </svg>
      ),
    },
  ];

  const navItems = homeTabs;

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-white shadow-[0_-2px_10px_rgba(0,0,0,0.08)] z-50">
      <div className="flex justify-around items-center h-17.5">
        {navItems.map((item) => {
          const isHomeTab = item.name === 'หลัก';
          const isRoleHomePath = pathname === '/user/dashboard' || pathname === '/admin/dashboard' || pathname === '/superadmin/dashboard';
          const isActive = isHomeTab
            ? (pathname === item.href || (role === 'admin' || role === 'superadmin') && isRoleHomePath)
            : (pathname === item.href || pathname.startsWith(item.href + '/'));
          return (
            <Link
              key={item.name}
              href={item.href}
              className="flex flex-col items-center justify-center flex-1 h-full gap-1"
            >
              {item.icon(isActive)}
              <span className={`text-xs ${isActive ? 'text-[#f26623] font-semibold' : 'text-[#a5a5a5]'}`}>
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
