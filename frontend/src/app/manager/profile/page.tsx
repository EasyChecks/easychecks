'use client';

import { useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export default function ManagerProfilePage() {
  const { user, logout } = useAuth();
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({
    phone: user?.phone || '',
    email: user?.email || '',
    address: ''
  });

  const handleSave = () => {
    setIsEditing(false);
    alert('บันทึกข้อมูลสำเร็จ');
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
          <button className="w-full p-3 text-left rounded-lg hover:bg-gray-50 flex items-center justify-between">
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
    </div>
  );
}
