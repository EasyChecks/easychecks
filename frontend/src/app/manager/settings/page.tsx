'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import ChangePasswordModal from '@/components/common/ChangePasswordModal';

export default function ManagerSettingsPage() {
  const { user, logout } = useAuth();
  const router = useRouter();
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  const menuItems = [
    {
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
        </svg>
      ),
      label: 'เปลี่ยนรหัสผ่าน',
      desc: 'อัปเดตรหัสผ่านบัญชีของคุณ',
      onClick: () => setShowPasswordModal(true),
    },
    {
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
        </svg>
      ),
      label: 'การแจ้งเตือน',
      desc: 'ตั้งค่าการรับแจ้งเตือน',
      onClick: () => {},
    },
    {
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 21l5.25-11.25L21 21m-9-3h7.5M3 5.621a48.474 48.474 0 016-.371m0 0c1.12 0 2.233.038 3.334.114M9 5.25V3m3.334 2.364V3" />
        </svg>
      ),
      label: 'ภาษา',
      desc: 'ภาษาไทย',
      onClick: () => {},
    },
    {
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
        </svg>
      ),
      label: 'ช่วยเหลือ',
      desc: 'ศูนย์ช่วยเหลือและคำถามที่พบบ่อย',
      onClick: () => {},
    },
    {
      icon: (
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m11.25 11.25.041-.02a.75.75 0 0 1 1.063.852l-.708 2.836a.75.75 0 0 0 1.063.853l.041-.021M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9-3.75h.008v.008H12V8.25Z" />
        </svg>
      ),
      label: 'เกี่ยวกับแอป',
      desc: 'EasyCheck เวอร์ชัน 1.0.0',
      onClick: () => {},
    },
  ];

  return (
    <div className="space-y-5">
      {/* Profile Card */}
      <button
        onClick={() => router.push('/manager/profile')}
        className="w-full bg-white rounded-2xl p-4 shadow-sm flex items-center gap-4 active:bg-gray-50 transition-colors"
      >
        {/* Avatar */}
        <div className="w-16 h-16 bg-gradient-to-br from-[#f26623] to-[#ea580c] rounded-full flex items-center justify-center text-white text-xl font-bold shadow-md shrink-0">
          {user?.name?.charAt(0) || 'U'}
        </div>

        {/* Info */}
        <div className="flex-1 text-left min-w-0">
          <h2 className="text-base font-semibold text-gray-900 truncate">
            {user?.name || 'ผู้ใช้งาน'}
          </h2>
          <p className="text-sm text-gray-500 truncate">{user?.email || '-'}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="inline-flex items-center px-2 py-0.5 text-xs font-medium rounded-full bg-orange-50 text-[#f26623]">
              {user?.department || 'ไม่ระบุแผนก'}
            </span>
            <span className="text-xs text-gray-400">{user?.position || ''}</span>
          </div>
        </div>

        {/* Chevron */}
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {/* Menu Items */}
      <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-100">
        {menuItems.map((item, idx) => (
          <button
            key={idx}
            onClick={item.onClick}
            className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-gray-50 transition-colors"
          >
            <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center text-[#f26623] shrink-0">
              {item.icon}
            </div>
            <div className="flex-1 text-left min-w-0">
              <p className="text-sm font-medium text-gray-800">{item.label}</p>
              <p className="text-xs text-gray-400 truncate">{item.desc}</p>
            </div>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-300 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        ))}
      </div>

      {/* Logout */}
      <button
        onClick={logout}
        className="w-full flex items-center justify-center gap-2 bg-white rounded-2xl p-4 shadow-sm text-red-500 font-medium active:bg-red-50 transition-colors"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
        </svg>
        ออกจากระบบ
      </button>

      {/* Version */}
      <p className="text-center text-xs text-gray-300 pb-2">EasyCheck v1.0.0</p>

      {/* Change Password Modal */}
      <ChangePasswordModal isOpen={showPasswordModal} onClose={() => setShowPasswordModal(false)} />
    </div>
  );
}