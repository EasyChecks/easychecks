'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const leaveTypes = [
  { id: 'sick', name: 'ลาป่วย', color: 'bg-red-100 text-red-700', icon: '🤒' },
  { id: 'personal', name: 'ลากิจ', color: 'bg-blue-100 text-blue-700', icon: '📝' },
  { id: 'vacation', name: 'ลาพักร้อน', color: 'bg-green-100 text-green-700', icon: '🏖️' },
  { id: 'maternity', name: 'ลาคลอด', color: 'bg-pink-100 text-pink-700', icon: '👶' },
];

export default function LeaveRequestPage() {
  const [formData, setFormData] = useState({
    selectedType: '',
    startDate: '',
    endDate: '',
    reason: ''
  });
  const [showSuccess, setShowSuccess] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.selectedType || !formData.startDate || !formData.endDate || !formData.reason) {
      alert('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    // Simulate API call
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      setFormData({ selectedType: '', startDate: '', endDate: '', reason: '' });
    }, 2000);
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="p-4 bg-gradient-to-r from-purple-500 to-purple-600 text-white">
        <h2 className="text-xl font-bold">ขอลา</h2>
        <p className="text-sm text-white/90">กรอกข้อมูลเพื่อยื่นคำขอลา</p>
      </Card>

      {/* Leave Balance */}
      <Card className="p-4">
        <h3 className="font-semibold text-gray-800 mb-3">โควต้าการลา</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className="p-3 bg-green-50 rounded-lg">
            <div className="text-sm text-gray-600">ลาป่วย</div>
            <div className="text-2xl font-bold text-green-600">30 วัน</div>
          </div>
          <div className="p-3 bg-blue-50 rounded-lg">
            <div className="text-sm text-gray-600">ลากิจ</div>
            <div className="text-2xl font-bold text-blue-600">15 วัน</div>
          </div>
          <div className="p-3 bg-purple-50 rounded-lg">
            <div className="text-sm text-gray-600">ลาพักร้อน</div>
            <div className="text-2xl font-bold text-purple-600">10 วัน</div>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600">ใช้ไปแล้ว</div>
            <div className="text-2xl font-bold text-gray-600">5 วัน</div>
          </div>
        </div>
      </Card>

      {/* Request Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Leave Type Selection */}
        <Card className="p-4">
          <label className="block font-semibold text-gray-800 mb-3">
            ประเภทการลา <span className="text-red-500">*</span>
          </label>
          <div className="grid grid-cols-2 gap-3">
            {leaveTypes.map((type) => (
              <button
                key={type.id}
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, selectedType: type.id }))}
                className={`p-4 rounded-xl border-2 transition-all ${
                  formData.selectedType === type.id
                    ? 'border-orange-500 bg-orange-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <div className="text-2xl mb-1">{type.icon}</div>
                <div className="text-sm font-medium text-gray-900">{type.name}</div>
              </button>
            ))}
          </div>
        </Card>

        {/* Date Range */}
        <Card className="p-4">
          <label className="block font-semibold text-gray-800 mb-3">
            ช่วงเวลา <span className="text-red-500">*</span>
          </label>
          <div className="space-y-3">
            <div>
              <label className="block text-sm text-gray-600 mb-2">วันที่เริ่มต้น</label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => setFormData(prev => ({ ...prev, startDate: e.target.value }))}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-2">วันที่สิ้นสุด</label>
              <input
                type="date"
                value={formData.endDate}
                onChange={(e) => setFormData(prev => ({ ...prev, endDate: e.target.value }))}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
              />
            </div>
          </div>
        </Card>

        {/* Reason */}
        <Card className="p-4">
          <label className="block font-semibold text-gray-800 mb-3">
            เหตุผล <span className="text-red-500">*</span>
          </label>
          <textarea
            value={formData.reason}
            onChange={(e) => setFormData(prev => ({ ...prev, reason: e.target.value }))}
            placeholder="กรอกเหตุผลการลา..."
            rows={4}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none resize-none"
          />
        </Card>

        {/* Submit Button */}
        <Button type="submit" className="w-full bg-orange-500 hover:bg-orange-600 py-6 text-lg">
          ส่งคำขอลา
        </Button>
      </form>

      {/* Recent Requests */}
      <Card className="p-4">
        <h3 className="font-semibold text-gray-800 mb-3">คำขอล่าสุด</h3>
        <div className="space-y-3">
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-gray-900">ลาป่วย</span>
              <Badge variant="default">รอพิจารณา</Badge>
            </div>
            <div className="text-sm text-gray-600">1-2 ก.พ. 2568</div>
          </div>
          <div className="p-3 bg-gray-50 rounded-lg">
            <div className="flex items-center justify-between mb-2">
              <span className="font-medium text-gray-900">ลากิจ</span>
              <Badge variant="active">อนุมัติ</Badge>
            </div>
            <div className="text-sm text-gray-600">25-26 ม.ค. 2568</div>
          </div>
        </div>
      </Card>

      {/* Success Modal */}
      {showSuccess && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <Card className="p-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">ส่งคำขอสำเร็จ!</h3>
            <p className="text-gray-600">รอผู้จัดการพิจารณาอนุมัติ</p>
          </Card>
        </div>
      )}
    </div>
  );
}
