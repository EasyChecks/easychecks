'use client';

import { useState } from 'react';
import { authService } from '@/services/authService';

interface ChangePasswordModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export default function ChangePasswordModal({ isOpen, onClose }: ChangePasswordModalProps) {
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  const handleClose = () => {
    setPasswordForm({ currentPassword: '', newPassword: '', confirmPassword: '' });
    setPasswordError('');
    setPasswordSuccess('');
    setShowCurrentPw(false);
    setShowNewPw(false);
    setShowConfirmPw(false);
    onClose();
  };

  const handleChangePassword = async () => {
    setPasswordError('');
    setPasswordSuccess('');
    if (!passwordForm.currentPassword || !passwordForm.newPassword || !passwordForm.confirmPassword) {
      setPasswordError('กรุณากรอกข้อมูลให้ครบทุกช่อง');
      return;
    }
    if (passwordForm.newPassword.length < 6) {
      setPasswordError('รหัสผ่านใหม่ต้องมีอย่างน้อย 6 ตัวอักษร');
      return;
    }
    if (passwordForm.newPassword !== passwordForm.confirmPassword) {
      setPasswordError('รหัสผ่านใหม่และยืนยันไม่ตรงกัน');
      return;
    }
    try {
      setIsSubmitting(true);
      await authService.changePassword(passwordForm.currentPassword, passwordForm.newPassword);
      setPasswordSuccess('เปลี่ยนรหัสผ่านสำเร็จ');
      setTimeout(() => handleClose(), 1500);
    } catch (err: unknown) {
      setPasswordError((err as Error).message || 'เปลี่ยนรหัสผ่านไม่สำเร็จ');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />
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
            onClick={handleClose}
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
  );
}
