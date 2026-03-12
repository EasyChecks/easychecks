'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';
import { authService } from '@/services/authService';

export default function ManagerProfilePage() {
  const { user } = useAuth();
  const router = useRouter();

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  const handleOpenPasswordModal = () => {
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setPasswordError('');
    setPasswordSuccess('');
    setShowCurrentPw(false);
    setShowNewPw(false);
    setShowConfirmPw(false);
    setShowPasswordModal(true);
  };

  const handleChangePassword = async () => {
    setPasswordError('');
    setPasswordSuccess('');
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordError('กรุณากรอกข้อมูลให้ครบทุกช่อง'); return;
    }
    if (passwordForm.newPassword.length < 6) {
      setPasswordError('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร'); return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('รหัสผ่านใหม่และยืนยันไม่ตรงกัน'); return;
    }
    try {
      setIsSubmitting(true);
      await authService.changePassword(passwordForm.currentPassword, passwordForm.newPassword);
      setPasswordSuccess('เปลี่ยนรหัสผ่านสำเร็จ');
      setTimeout(() => setShowPasswordModal(false), 1500);
    } catch (err: unknown) {
      setPasswordError((err as Error).message || 'เปลี่ยนรหัสผ่านไม่สำเร็จ');
    } finally {
      setIsSubmitting(false);
    }
  };

  const InfoRow = ({ label, value }: { label: string; value?: string | null }) => (
    <div className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
      <span className="text-sm text-gray-500">{label}</span>
      <span className="text-sm font-medium text-gray-800 text-right max-w-[55%] truncate">{value || '-'}</span>
    </div>
  );

  return (
    <div className="space-y-5 -mt-4 -mx-4">
      {/* Hero header */}
      <div className="relative bg-gradient-to-br from-[#f26623] to-[#ea580c] px-6 pt-6 pb-16">
        <button onClick={() => router.back()} className="mb-4 p-1 -ml-1 rounded-lg active:bg-white/10 transition-colors">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="text-center">
          <div className="w-20 h-20 mx-auto mb-3 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center ring-4 ring-white/30">
            {user?.avatar ? (
              <img src={user.avatar} alt="avatar" className="w-20 h-20 rounded-full object-cover" />
            ) : (
              <span className="text-3xl font-bold text-white">{user?.name?.charAt(0) || 'U'}</span>
            )}
          </div>
          <h2 className="text-xl font-bold text-white">{user?.name || 'ผู้จัดการ'}</h2>
          <p className="text-sm text-white/80 mt-0.5">{user?.position || 'Manager'}</p>
          <span className="inline-block mt-2 px-3 py-1 text-xs font-medium bg-white/20 backdrop-blur-sm text-white rounded-full">
            {user?.department || 'ไม่ระบุแผนก'}
          </span>
        </div>
      </div>

      <div className="px-4 -mt-10 space-y-4 pb-4">
        <div className="bg-white rounded-2xl shadow-sm p-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-1 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-orange-50 flex items-center justify-center">
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

        <div className="bg-white rounded-2xl shadow-sm p-4">
          <h3 className="text-sm font-semibold text-gray-800 mb-1 flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
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

        <div className="bg-white rounded-2xl shadow-sm overflow-hidden divide-y divide-gray-50">
          <button
            onClick={handleOpenPasswordModal}
            className="w-full flex items-center gap-3 px-4 py-3.5 active:bg-gray-50 transition-colors"
          >
            <div className="w-9 h-9 rounded-xl bg-orange-50 flex items-center justify-center text-[#f26623] shrink-0">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 5.25a3 3 0 0 1 3 3m3 0a6 6 0 0 1-7.029 5.912c-.563-.097-1.159.026-1.563.43L10.5 17.25H8.25v2.25H6v2.25H2.25v-2.818c0-.597.237-1.17.659-1.591l6.499-6.499c.404-.404.527-1 .43-1.563A6 6 0 1 1 21.75 8.25Z" />
              </svg>
            </div>
            <span className="flex-1 text-left text-sm font-medium text-gray-800">เปลี่ยนรหัสผ่าน</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </div>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowPasswordModal(false)} />
          <div className="relative bg-white rounded-t-3xl sm:rounded-2xl shadow-xl w-full max-w-sm sm:mx-4 p-6">
            <div className="w-10 h-1 bg-gray-200 rounded-full mx-auto mb-4 sm:hidden" />
            <h2 className="text-lg font-semibold text-gray-800 mb-4">เปลี่ยนรหัสผ่าน</h2>
            <div className="space-y-3">
              {[
                { label: 'รหัสผ่านปัจจุบัน', field: 'currentPassword' as const, show: showCurrentPw, toggle: () => setShowCurrentPw(!showCurrentPw), placeholder: 'กรอกรหัสผ่านปัจจุบัน' },
                { label: 'รหัสผ่านใหม่', field: 'newPassword' as const, show: showNewPw, toggle: () => setShowNewPw(!showNewPw), placeholder: 'อย่างน้อย 6 ตัวอักษร' },
                { label: 'ยืนยันรหัสผ่านใหม่', field: 'confirmPassword' as const, show: showConfirmPw, toggle: () => setShowConfirmPw(!showConfirmPw), placeholder: 'กรอกรหัสผ่านใหม่อีกครั้ง' },
              ].map(({ label, field, show, toggle, placeholder }) => (
                <div key={field}>
                  <label className="block text-sm text-gray-600 mb-1">{label}</label>
                  <div className="relative">
                    <input
                      type={show ? 'text' : 'password'}
                      value={passwordForm[field]}
                      onChange={(e) => setPasswordForm({ ...passwordForm, [field]: e.target.value })}
                      className="w-full px-4 py-2.5 pr-10 border border-gray-200 rounded-xl focus:border-[#f26623] focus:ring-1 focus:ring-[#f26623]/20 outline-none transition-colors"
                      placeholder={placeholder}
                    />
                    <button type="button" onClick={toggle} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400">
                      {show
                        ? <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z" /><path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" /></svg>
                        : <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.223A10.477 10.477 0 0 0 1.934 12C3.226 16.338 7.244 19.5 12 19.5c.993 0 1.953-.138 2.863-.395M6.228 6.228A10.451 10.451 0 0 1 12 4.5c4.756 0 8.773 3.162 10.065 7.498a10.522 10.522 0 0 1-4.293 5.774M6.228 6.228 3 3m3.228 3.228 3.65 3.65m7.894 7.894L21 21m-3.228-3.228-3.65-3.65m0 0a3 3 0 1 0-4.243-4.243m4.242 4.242L9.88 9.88" /></svg>
                      }
                    </button>
                  </div>
                </div>
              ))}
            </div>
            {passwordError && <p className="mt-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{passwordError}</p>}
            {passwordSuccess && <p className="mt-3 text-sm text-green-600 bg-green-50 rounded-lg px-3 py-2">{passwordSuccess}</p>}
            <div className="flex gap-2 mt-5">
              <button
                className="flex-1 py-2.5 rounded-xl border border-gray-200 text-sm font-medium text-gray-600 active:bg-gray-50 transition-colors"
                onClick={() => setShowPasswordModal(false)}
                disabled={isSubmitting}
              >
                ยกเลิก
              </button>
              <button
                className="flex-1 py-2.5 rounded-xl bg-[#f26623] text-sm font-medium text-white active:bg-[#d9551a] transition-colors disabled:opacity-50"
                onClick={handleChangePassword}
                disabled={isSubmitting}
              >
                {isSubmitting ? 'กำลังบันทึก...' : 'บันทึก'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
