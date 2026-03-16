'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import leaveRequestService, { type LeaveRequestItem, type LeaveType } from '@/services/leaveRequestService';

const leaveTypes = [
  { id: 'SICK' as LeaveType, name: 'ลาป่วย', color: 'bg-red-100 text-red-700', icon: '🤒' },
  { id: 'PERSONAL' as LeaveType, name: 'ลากิจ', color: 'bg-blue-100 text-blue-700', icon: '📝' },
  { id: 'VACATION' as LeaveType, name: 'ลาพักร้อน', color: 'bg-green-100 text-green-700', icon: '🏖️' },
  { id: 'MATERNITY' as LeaveType, name: 'ลาคลอด', color: 'bg-pink-100 text-pink-700', icon: '👶' },
];

const statusLabel: Record<'PENDING' | 'APPROVED' | 'REJECTED', { text: string; variant: 'default' | 'active' | 'destructive' }> = {
  PENDING: { text: 'รอพิจารณา', variant: 'default' },
  APPROVED: { text: 'อนุมัติ', variant: 'active' },
  REJECTED: { text: 'ไม่อนุมัติ', variant: 'destructive' },
};

export default function LeaveRequestPage() {
  const [formData, setFormData] = useState({
    selectedType: '' as LeaveType | '',
    isHourly: false,
    startDate: '',
    endDate: '',
    startTime: '',
    endTime: '',
    reason: ''
  });
  const [showSuccess, setShowSuccess] = useState(false);
  const [message, setMessage] = useState<{ open: boolean; text: string }>({ open: false, text: '' });
  const [submitting, setSubmitting] = useState(false);
  const [recentRequests, setRecentRequests] = useState<LeaveRequestItem[]>([]);

  const openMessage = (text: string) => setMessage({ open: true, text });

  useEffect(() => {
    leaveRequestService.getMine({ take: 5, skip: 0 })
      .then(setRecentRequests)
      .catch(() => {
        // ignore list load failure on first render
      });
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.selectedType || !formData.startDate || !formData.endDate || !formData.reason) {
      openMessage('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    if (formData.isHourly && (!formData.startTime || !formData.endTime)) {
      openMessage('การลาเป็นชั่วโมงต้องระบุเวลาเริ่มและเวลาสิ้นสุด');
      return;
    }

    try {
      setSubmitting(true);

      await leaveRequestService.create({
        leaveType: formData.selectedType,
        isHourly: formData.isHourly,
        startDate: formData.startDate,
        endDate: formData.endDate,
        startTime: formData.isHourly ? formData.startTime : undefined,
        endTime: formData.isHourly ? formData.endTime : undefined,
        reason: formData.reason,
      });

      setShowSuccess(true);
      setFormData({
        selectedType: '',
        isHourly: false,
        startDate: '',
        endDate: '',
        startTime: '',
        endTime: '',
        reason: ''
      });

      const list = await leaveRequestService.getMine({ take: 5, skip: 0 });
      setRecentRequests(list);
      setTimeout(() => setShowSuccess(false), 1800);
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string; message?: string } } };
      openMessage(err.response?.data?.error || err.response?.data?.message || 'ส่งคำขอไม่สำเร็จ');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="p-4 bg-linear-to-r from-purple-500 to-purple-600 text-white">
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

        <Card className="p-4">
          <label className="block font-semibold text-gray-800 mb-3">รูปแบบการลา</label>
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, isHourly: false }))}
              className={`p-3 rounded-xl border-2 transition-all ${!formData.isHourly ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-gray-300'}`}
            >
              <div className="text-sm font-semibold text-gray-900">ลาเต็มวัน</div>
            </button>
            <button
              type="button"
              onClick={() => setFormData(prev => ({ ...prev, isHourly: true, endDate: prev.startDate || prev.endDate }))}
              className={`p-3 rounded-xl border-2 transition-all ${formData.isHourly ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-gray-300'}`}
            >
              <div className="text-sm font-semibold text-gray-900">ลาเป็นชั่วโมง</div>
            </button>
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
                disabled={formData.isHourly}
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
              />
            </div>
            {formData.isHourly && (
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm text-gray-600 mb-2">เวลาเริ่ม</label>
                  <input
                    type="time"
                    value={formData.startTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, startTime: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="block text-sm text-gray-600 mb-2">เวลาสิ้นสุด</label>
                  <input
                    type="time"
                    value={formData.endTime}
                    onChange={(e) => setFormData(prev => ({ ...prev, endTime: e.target.value }))}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
                  />
                </div>
              </div>
            )}
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
        <Button type="submit" disabled={submitting} className="w-full bg-orange-500 hover:bg-orange-600 py-6 text-lg disabled:opacity-60">
          {submitting ? 'กำลังส่งคำขอ...' : 'ส่งคำขอลา'}
        </Button>
      </form>

      {/* Recent Requests */}
      <Card className="p-4">
        <h3 className="font-semibold text-gray-800 mb-3">คำขอล่าสุด</h3>
        <div className="space-y-3">
          {recentRequests.length === 0 && (
            <div className="text-sm text-gray-500">ยังไม่มีคำขอลา</div>
          )}
          {recentRequests.map((item) => (
            <div key={item.leaveId} className="p-3 bg-gray-50 rounded-lg">
              <div className="flex items-center justify-between mb-2">
                <span className="font-medium text-gray-900">{item.leaveType}</span>
                <Badge variant={statusLabel[item.status].variant}>{statusLabel[item.status].text}</Badge>
              </div>
              <div className="text-sm text-gray-600">
                {item.startDate} - {item.endDate}
                {item.isHourly && item.startTime && item.endTime && ` (${item.startTime}-${item.endTime})`}
              </div>
            </div>
          ))}
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

      {message.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <Card className="p-6 text-center max-w-sm w-full">
            <h3 className="text-lg font-bold text-gray-900 mb-2">แจ้งเตือน</h3>
            <p className="text-gray-600 mb-4">{message.text}</p>
            <Button onClick={() => setMessage({ open: false, text: '' })} className="w-full bg-orange-500 hover:bg-orange-600">
              ตกลง
            </Button>
          </Card>
        </div>
      )}
    </div>
  );
}
