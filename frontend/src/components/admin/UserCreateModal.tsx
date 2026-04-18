"use client";

import { useState, useMemo } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { User } from '@/types/user';
import type { AuthUser } from '@/types/auth';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface UserCreateModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (user: User) => void;
  generateEmployeeId: (provinceCode: string, branchCode: string) => string;
  users: User[];
  currentUser?: User | AuthUser | null;
}

export default function UserCreateModal({
  isOpen,
  onClose,
  onSubmit,
  generateEmployeeId,
  currentUser: currentUserProp
}: UserCreateModalProps) {
  // Use auth context as fallback if currentUser prop is not provided
  const { user: authUser } = useAuth();
  const currentUser = currentUserProp || authUser;
  
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    department: '',
    position: '',
    role: 'user' as 'user' | 'manager' | 'admin' | 'superadmin',
    title: 'MR' as 'MR' | 'MRS' | 'MISS',
    gender: 'MALE' as 'MALE' | 'FEMALE',
    provinceCode: 'BKK',
    branchCode: '001',
    nationalId: '',
    birthDate: '',
    address: '',
    bloodType: '',
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelation: ''
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const employeeId = generateEmployeeId(formData.provinceCode, formData.branchCode);
    const password = formData.nationalId?.substring(formData.nationalId.length - 4) || '1234';
    
    const newUser: User = {
      id: `user-${Date.now()}`,
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      department: formData.department,
      position: formData.position,
      role: formData.role,
      employeeId,
      username: employeeId,
      password,
      status: 'active',
      provinceCode: formData.provinceCode,
      branchCode: formData.branchCode,
      branch: formData.provinceCode,
      nationalId: formData.nationalId,
      birthDate: formData.birthDate,
      address: formData.address,
      bloodType: formData.bloodType,
      title: formData.title,
      gender: formData.gender,
      emergencyContact: {
        name: formData.emergencyContactName,
        phone: formData.emergencyContactPhone,
        relation: formData.emergencyContactRelation
      },
      attendanceRecords: []
    };

    onSubmit(newUser);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm" 
        onClick={onClose}
      />
      <Card className="relative z-10 w-full max-w-2xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-bold text-gray-900">เพิ่มผู้ใช้งานใหม่</h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 transition-colors rounded-full hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
              label="ชื่อ-นามสกุล *"
              value={formData.name}
              onChange={(value) => setFormData({ ...formData, name: value })}
              required
            />
            <FormField
              label="อีเมล *"
              type="email"
              value={formData.email}
              onChange={(value) => setFormData({ ...formData, email: value })}
              required
            />
            <FormField
              label="เบอร์โทร *"
              value={formData.phone}
              onChange={(value) => setFormData({ ...formData, phone: value })}
              required
            />
            <FormField
              label="แผนก *"
              value={formData.department}
              onChange={(value) => setFormData({ ...formData, department: value })}
              required
            />
            <FormField
              label="ตำแหน่ง *"
              value={formData.position}
              onChange={(value) => setFormData({ ...formData, position: value })}
              required
            />
            <div>
              <label className="block mb-2 text-sm font-semibold text-gray-700">คำนำหน้า *</label>
              <select
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value as 'MR' | 'MRS' | 'MISS' })}
                className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-gray-900 focus:outline-none"
                required
              >
                <option value="MR">นาย</option>
                <option value="MRS">นาง</option>
                <option value="MISS">นางสาว</option>
              </select>
            </div>
            <div>
              <label className="block mb-2 text-sm font-semibold text-gray-700">เพศ *</label>
              <select
                value={formData.gender}
                onChange={(e) => setFormData({ ...formData, gender: e.target.value as 'MALE' | 'FEMALE' })}
                className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-gray-900 focus:outline-none"
                required
              >
                <option value="MALE">ชาย</option>
                <option value="FEMALE">หญิง</option>
              </select>
            </div>
            <div>
              <label className="block mb-2 text-sm font-semibold text-gray-700">บทบาท *</label>
              <select
                value={formData.role}
                onChange={(e) => setFormData({ ...formData, role: e.target.value as 'user' | 'manager' | 'admin' | 'superadmin' })}
                className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-gray-900 focus:outline-none"
                required
              >
                <option value="user">User</option>
                <option value="manager">Manager</option>
                <option value="admin">Admin</option>
                {(currentUser && currentUser.role && currentUser.role.toLowerCase() === 'superadmin') && (
                  <option value="superadmin">Super Admin</option>
                )}
              </select>
            </div>
            <div>
              <label className="block mb-2 text-sm font-semibold text-gray-700">สาขา *</label>
              <select
                value={formData.provinceCode}
                onChange={(e) => setFormData({ ...formData, provinceCode: e.target.value })}
                className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-gray-900 focus:outline-none"
                required
              >
                <option value="BKK">BKK (กรุงเทพ)</option>
                <option value="CNX">CNX (เชียงใหม่)</option>
                <option value="PKT">PKT (ภูเก็ต)</option>
              </select>
            </div>
            <FormField
              label="เลขบัตรประชาชน *"
              value={formData.nationalId}
              onChange={(value) => setFormData({ ...formData, nationalId: value })}
              maxLength={13}
              required
            />
            <FormField
              label="วันเกิด"
              type="date"
              value={formData.birthDate}
              onChange={(value) => setFormData({ ...formData, birthDate: value })}
            />
            <FormField
              label="หมู่เลือด"
              value={formData.bloodType}
              onChange={(value) => setFormData({ ...formData, bloodType: value })}
            />
          </div>

          <FormField
            label="ที่อยู่"
            value={formData.address}
            onChange={(value) => setFormData({ ...formData, address: value })}
            textarea
          />

          <div className="pt-4 border-t">
            <h3 className="mb-3 font-semibold text-gray-900">ผู้ติดต่อฉุกเฉิน</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <FormField
                label="ชื่อ"
                value={formData.emergencyContactName}
                onChange={(value) => setFormData({ ...formData, emergencyContactName: value })}
              />
              <FormField
                label="เบอร์โทร"
                value={formData.emergencyContactPhone}
                onChange={(value) => setFormData({ ...formData, emergencyContactPhone: value })}
              />
              <FormField
                label="ความสัมพันธ์"
                value={formData.emergencyContactRelation}
                onChange={(value) => setFormData({ ...formData, emergencyContactRelation: value })}
              />
            </div>
          </div>

          <div className="flex justify-end gap-3 pt-4">
            <Button type="button" variant="outline" onClick={onClose}>
              ยกเลิก
            </Button>
            <Button type="submit" className="bg-orange-600 hover:bg-orange-700">
              เพิ่มผู้ใช้
            </Button>
          </div>
        </form>
      </Card>
    </div>
  );
}

interface FormFieldProps {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
  required?: boolean;
  textarea?: boolean;
  maxLength?: number;
}

function FormField({ label, value, onChange, type = 'text', required, textarea, maxLength }: FormFieldProps) {
  const className = "w-full px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-gray-900 focus:outline-none transition-colors";
  
  return (
    <div>
      <label className="block mb-2 text-sm font-semibold text-gray-700">{label}</label>
      {textarea ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={className}
          rows={3}
          required={required}
        />
      ) : (
        <input
          type={type}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={className}
          required={required}
          maxLength={maxLength}
        />
      )}
    </div>
  );
}
