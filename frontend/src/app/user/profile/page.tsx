'use client';

import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between py-1.5 text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-800">{value || '-'}</span>
    </div>
  );
}

export default function SettingsPage() {
  const { user, logout } = useAuth();
  const router = useRouter();

  return (
    <div className="-mt-4">
      {/* Hero header — orange gradient (full width: break out of layout padding) */}
      <div className="relative -mx-4 bg-gradient-to-br from-[#f26623] to-[#ea580c] px-6 pt-6 pb-8">
        {/* Back button */}
        <button onClick={() => router.back()} className="p-1 mb-4 -ml-1 transition-colors rounded-lg active:bg-white/10">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="text-center">
          <div className="flex items-center justify-center w-20 h-20 mx-auto mb-3 rounded-full bg-white/20 backdrop-blur-sm ring-4 ring-white/30">
            {user?.avatar ? (
              <img src={user.avatar} alt="avatar" className="object-cover w-20 h-20 rounded-full" />
            ) : (
              <span className="text-3xl font-bold text-white">{user?.name?.charAt(0) || 'U'}</span>
            )}
          </div>
          <h2 className="text-xl font-bold text-white">{user?.name || 'ผู้ใช้งาน'}</h2>
          <p className="text-sm text-white/80 mt-0.5">{user?.position || 'ไม่ระบุตำแหน่ง'}</p>
          <span className="inline-block px-3 py-1 mt-2 text-xs font-medium text-white rounded-full bg-white/20 backdrop-blur-sm">
            {user?.department || 'ไม่ระบุแผนก'}
          </span>
        </div>
      </div>

      {/* Cards — overlapping the hero (stays within layout padding) */}
      <div className="pb-4 mt-4 space-y-4">
        {/* Work Info */}
        <div className="p-4 bg-white border border-gray-100 shadow-md rounded-2xl">
          <h3 className="flex items-center gap-2 mb-1 text-sm font-semibold text-gray-800">
            <div className="flex items-center justify-center rounded-lg w-7 h-7 bg-orange-50">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-[#f26623]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 14.15v4.25c0 1.094-.787 2.036-1.872 2.18-2.087.277-4.216.42-6.378.42s-4.291-.143-6.378-.42c-1.085-.144-1.872-1.086-1.872-2.18v-4.25m16.5 0a2.18 2.18 0 0 0 .75-1.661V8.706c0-1.081-.768-2.015-1.837-2.175a48.114 48.114 0 0 0-3.413-.387m4.5 8.006c-.194.165-.42.295-.673.38A23.978 23.978 0 0 1 12 15.75c-2.648 0-5.195-.429-7.577-1.22a2.016 2.016 0 0 1-.673-.38m0 0A2.18 2.18 0 0 1 3 12.489V8.706c0-1.081.768-2.015 1.837-2.175a48.111 48.111 0 0 1 3.413-.387m7.5 0V5.25A2.25 2.25 0 0 0 13.5 3h-3a2.25 2.25 0 0 0-2.25 2.25v.894m7.5 0a48.667 48.667 0 0 0-7.5 0" />
              </svg>
            </div>
            ข้อมูลการทำงาน
          </h3>
          <div className="mt-2">
            <InfoRow label="รหัสพนักงาน" value={user?.employeeId} />
            <InfoRow label="แผนก" value={user?.department} />
            <InfoRow label="ตำแหน่ง" value={user?.position} />
            <InfoRow label="สาขา" value={user?.branch} />
            <InfoRow label="สถานะ" value={user?.status === 'active' ? 'ปฏิบัติงาน' : user?.status} />
          </div>
        </div>

        {/* Personal Info */}
        <div className="p-4 bg-white border border-gray-100 shadow-md rounded-2xl">
          <h3 className="flex items-center gap-2 mb-1 text-sm font-semibold text-gray-800">
            <div className="flex items-center justify-center rounded-lg w-7 h-7 bg-blue-50">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
              </svg>
            </div>
            ข้อมูลส่วนตัว
          </h3>
          <div className="mt-2">
            <InfoRow label="อีเมล" value={user?.email} />
            <InfoRow label="เบอร์โทร" value={user?.phone} />
            <InfoRow label="ชื่อผู้ใช้" value={user?.username} />
          </div>
        </div>

        {/* Actions — REMOVED (use Settings page instead) */}
      </div>

      {/* Logout */}
      <button
        onClick={logout}
        className="flex items-center justify-center w-full gap-2 p-4 font-medium text-red-500 transition-colors bg-white shadow-sm rounded-2xl active:bg-red-50"
      >
        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
        </svg>
        ออกจากระบบ
      </button>

      {/* Version */}
      <p className="pb-2 text-xs text-center text-gray-300">EasyCheck v1.0.0</p>
    </div>
  );
}