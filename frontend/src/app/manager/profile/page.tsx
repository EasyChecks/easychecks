'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { authService } from '@/services/authService';

export default function ManagerProfilePage() {
  const { user, logout } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    phone: user?.phone || '',
    email: user?.email || '',
    address: ''
  });

  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const [passwordForm, setPasswordForm] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [passwordError, setPasswordError] = useState('');
  const [passwordSuccess, setPasswordSuccess] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showCurrentPw, setShowCurrentPw] = useState(false);
  const [showNewPw, setShowNewPw] = useState(false);
  const [showConfirmPw, setShowConfirmPw] = useState(false);

  const handleSave = () => {
    setIsEditing(false);
    alert('บันทึกข้อมูลสำเร็จ');
  };

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

  return (
    <div className="space-y-4">
      <Card className="p-6 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white text-center">
        <div className="w-24 h-24 mx-auto mb-4 bg-white/20 backdrop-blur-sm rounded-full flex items-center justify-center">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold">{user?.name || 'ผู้จัดการ'}</h2>
        <p className="text-white/90 text-sm mt-1">{user?.email || 'manager@example.com'}</p>
        <Badge className="mt-3 bg-yellow-500 text-white">Manager</Badge>
      </Card>

      <Card className="p-4">
        <h3 className="font-semibold text-gray-800 mb-3">ข้อมูลการทำงาน</h3>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-gray-600">รหัสพนักงาน</span>
            <span className="font-medium text-gray-900">{user?.employeeId || 'BKK101'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">แผนก</span>
            <span className="font-medium text-gray-900">{user?.department || 'Operations'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">ตำแหน่ง</span>
            <span className="font-medium text-gray-900">{user?.position || 'Manager'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">สาขา</span>
            <span className="font-medium text-gray-900">{user?.branch || 'กรุงเทพ'}</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-gray-600">สถานะ</span>
            <Badge variant="active">ปฏิบัติงาน</Badge>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="font-semibold text-gray-800 mb-3">ทีมที่ดูแล</h3>
        <div className="text-center py-4">
          <div className="text-4xl font-bold text-indigo-600">5</div>
          <div className="text-sm text-gray-500">พนักงานในทีม</div>
        </div>
      </Card>

      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-800">ข้อมูลส่วนตัว</h3>
          <Button
            onClick={() => setIsEditing(!isEditing)}
            variant="outline"
            size="sm"
          >
            {isEditing ? 'ยกเลิก' : 'แก้ไข'}
          </Button>
        </div>
        <div className="space-y-3">
          <div>
            <label className="block text-sm text-gray-600 mb-1">เบอร์โทรศัพท์</label>
            {isEditing ? (
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none"
              />
            ) : (
              <div className="font-medium text-gray-900">{formData.phone || '0812345678'}</div>
            )}
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">อีเมล</label>
            {isEditing ? (
              <input
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none"
              />
            ) : (
              <div className="font-medium text-gray-900">{formData.email}</div>
            )}
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">ที่อยู่</label>
            {isEditing ? (
              <textarea
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                rows={3}
                className="w-full px-4 py-2 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none resize-none"
                placeholder="กรอกที่อยู่..."
              />
            ) : (
              <div className="font-medium text-gray-900">{formData.address || '123 ถนน... กรุงเทพฯ'}</div>
            )}
          </div>
        </div>
        {isEditing && (
          <Button onClick={handleSave} className="w-full mt-4 bg-indigo-500 hover:bg-indigo-600">
            บันทึกข้อมูล
          </Button>
        )}
      </Card>

      <Card className="p-4">
        <h3 className="font-semibold text-gray-800 mb-3">สถิติเดือนนี้</h3>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-2xl font-bold text-gray-900">22</div>
            <div className="text-xs text-gray-500">วันทำงาน</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">176</div>
            <div className="text-xs text-gray-500">ชั่วโมง</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-indigo-600">5</div>
            <div className="text-xs text-gray-500">ทีม</div>
          </div>
        </div>
      </Card>

      <Card className="p-4">
        <h3 className="font-semibold text-gray-800 mb-3">ตั้งค่า</h3>
        <div className="space-y-2">
          <button onClick={handleOpenPasswordModal} className="w-full p-3 text-left rounded-lg hover:bg-gray-50 flex items-center justify-between">
            <span className="text-gray-700">เปลี่ยนรหัสผ่าน</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
          <button className="w-full p-3 text-left rounded-lg hover:bg-gray-50 flex items-center justify-between">
            <span className="text-gray-700">การแจ้งเตือน</span>
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>
      </Card>

      <Button
        onClick={logout}
        variant="destructive"
        className="w-full bg-red-500 hover:bg-red-600"
      >
        ออกจากระบบ
      </Button>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowPasswordModal(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm p-6">
            <h2 className="text-lg font-semibold text-gray-800 mb-4">เปลี่ยนรหัสผ่าน</h2>
            <div className="space-y-3">
              {[{ label: 'รหัสผ่านปัจจุบัน', field: 'currentPassword' as const, show: showCurrentPw, toggle: () => setShowCurrentPw(!showCurrentPw), placeholder: 'กรอกรหัสผ่านปัจจุบัน' }, { label: 'รหัสผ่านใหม่', field: 'newPassword' as const, show: showNewPw, toggle: () => setShowNewPw(!showNewPw), placeholder: 'อย่างน้อย 6 ตัวอักษร' }, { label: 'ยืนยันรหัสผ่านใหม่', field: 'confirmPassword' as const, show: showConfirmPw, toggle: () => setShowConfirmPw(!showConfirmPw), placeholder: 'กรอกรหัสผ่านใหม่อีกครั้ง' }].map(({ label, field, show, toggle, placeholder }) => (
                <div key={field}>
                  <label className="block text-sm text-gray-600 mb-1">{label}</label>
                  <div className="relative">
                    <input
                      type={show ? 'text' : 'password'}
                      value={passwordForm[field]}
                      onChange={(e) => setPasswordForm({ ...passwordForm, [field]: e.target.value })}
                      className="w-full px-4 py-2 pr-10 border-2 border-gray-200 rounded-lg focus:border-indigo-500 focus:outline-none"
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
              <Button variant="outline" className="flex-1" onClick={() => setShowPasswordModal(false)} disabled={isSubmitting}>ยกเลิก</Button>
              <Button className="flex-1 bg-indigo-500 hover:bg-indigo-600" onClick={handleChangePassword} disabled={isSubmitting}>
                {isSubmitting ? 'กำลังบันทึก...' : 'บันทึก'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
