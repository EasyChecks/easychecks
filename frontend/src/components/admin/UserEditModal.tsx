"use client";

import { User } from '@/types/user';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface UserEditModalProps {
  show: boolean;
  editingUser: User;
  editForm: Record<string, string | number | boolean | null>;
  currentUser: User | null;
  onClose: () => void;
  onSave: () => void;
  onChange: (form: Record<string, string | number | boolean | null>) => void;
}

export default function UserEditModal({
  show,
  editingUser,
  editForm,
  currentUser,
  onClose,
  onSave,
  onChange
}: UserEditModalProps) {
  if (!show) return null;

  const canEditRole = currentUser?.role === 'superadmin' || 
    (currentUser?.role === 'admin' && editingUser.role !== 'superadmin');

  const handleFieldChange = (field: string, value: string | number | boolean | null) => {
    onChange({ ...editForm, [field]: value });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm" 
        onClick={onClose}
      />
      <Card className="relative z-10 w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">แก้ไขข้อมูล: {editingUser.name}</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 transition-colors rounded-full hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="space-y-6">
          {/* Basic Information */}
          <section>
            <h3 className="mb-3 text-lg font-semibold text-gray-900">ข้อมูลพื้นฐาน</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                label="ชื่อ-นามสกุล"
                value={editForm.name || ''}
                onChange={(value) => handleFieldChange('name', value)}
              />
              <FormField
                label="อีเมล"
                type="email"
                value={editForm.email || ''}
                onChange={(value) => handleFieldChange('email', value)}
              />
              <FormField
                label="เบอร์โทร"
                value={editForm.phone || ''}
                onChange={(value) => handleFieldChange('phone', value)}
              />
              <FormField
                label="รหัสพนักงาน"
                value={editForm.employeeId || ''}
                onChange={(value) => handleFieldChange('employeeId', value)}
                disabled
              />
              <FormField
                label="แผนก"
                value={editForm.department || ''}
                onChange={(value) => handleFieldChange('department', value)}
              />
              <FormField
                label="ตำแหน่ง"
                value={editForm.position || ''}
                onChange={(value) => handleFieldChange('position', value)}
              />
              <div>
                <label className="block mb-2 text-sm font-semibold text-gray-700">บทบาท</label>
                <select
                  value={editForm.role || ''}
                  onChange={(e) => handleFieldChange('role', e.target.value)}
                  disabled={!canEditRole}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-gray-900 focus:outline-none disabled:bg-gray-100"
                >
                  <option value="user">User</option>
                  <option value="manager">Manager</option>
                  <option value="admin">Admin</option>
                  <option value="superadmin">Super Admin</option>
                </select>
              </div>
              <div>
                <label className="block mb-2 text-sm font-semibold text-gray-700">สถานะ</label>
                <select
                  value={editForm.status || ''}
                  onChange={(e) => handleFieldChange('status', e.target.value)}
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-gray-900 focus:outline-none"
                >
                  <option value="active">Active</option>
                  <option value="suspended">Suspended</option>
                  <option value="pending">Pending</option>
                  <option value="leave">Leave</option>
                </select>
              </div>
            </div>
          </section>

          {/* Personal Information */}
          <section>
            <h3 className="mb-3 text-lg font-semibold text-gray-900">ข้อมูลส่วนตัว</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                label="วันเกิด"
                type="date"
                value={editForm.birthDate || ''}
                onChange={(value) => handleFieldChange('birthDate', value)}
              />
              <FormField
                label="หมู่เลือด"
                value={editForm.bloodType || ''}
                onChange={(value) => handleFieldChange('bloodType', value)}
              />
              <FormField
                label="เลขบัตรประชาชน"
                value={editForm.nationalId || ''}
                onChange={(value) => handleFieldChange('nationalId', value)}
              />
              <FormField
                label="รหัสผ่าน"
                type="password"
                value={editForm.password || ''}
                onChange={(value) => handleFieldChange('password', value)}
              />
            </div>
            <div className="mt-4">
              <FormField
                label="ที่อยู่"
                value={editForm.address || ''}
                onChange={(value) => handleFieldChange('address', value)}
                textarea
              />
            </div>
          </section>

          {/* Emergency Contact */}
          <section>
            <h3 className="mb-3 text-lg font-semibold text-gray-900">ผู้ติดต่อฉุกเฉิน</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <FormField
                label="ชื่อ"
                value={editForm.emergencyContactName || ''}
                onChange={(value) => handleFieldChange('emergencyContactName', value)}
              />
              <FormField
                label="เบอร์โทร"
                value={editForm.emergencyContactPhone || ''}
                onChange={(value) => handleFieldChange('emergencyContactPhone', value)}
              />
              <FormField
                label="ความสัมพันธ์"
                value={editForm.emergencyContactRelation || ''}
                onChange={(value) => handleFieldChange('emergencyContactRelation', value)}
              />
            </div>
          </section>

          {/* Actions */}
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button type="button" variant="outline" onClick={onClose}>
              ยกเลิก
            </Button>
            <Button type="button" onClick={onSave} className="bg-orange-600 hover:bg-orange-700">
              บันทึกการแก้ไข
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}

interface FormFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  textarea?: boolean;
  disabled?: boolean;
}

function FormField({ label, value, onChange, type = 'text', textarea, disabled }: FormFieldProps) {
  const className = "w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-gray-900 focus:outline-none transition-colors disabled:bg-gray-100";
  
  return (
    <div>
      <label className="block mb-2 text-sm font-semibold text-gray-700">{label}</label>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={className}
          rows={3}
          disabled={disabled}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={className}
          disabled={disabled}
        />
      )}
    </div>
  );
}
