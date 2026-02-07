'use client';

import { useState, memo } from 'react';
import { Button } from '@/components/ui/button';
import { LeaveQuotaSettings, LeaveType } from '@/types/leave';

interface LeaveQuotaEditModalProps {
  leaveType: LeaveType;
  currentSettings: LeaveQuotaSettings;
  onSave: (settings: LeaveQuotaSettings) => void;
  onCancel: () => void;
  userName?: string;
}

function LeaveQuotaEditModal({ leaveType, currentSettings, onSave, onCancel, userName }: LeaveQuotaEditModalProps) {
  const [totalDays, setTotalDays] = useState(currentSettings.totalDays);
  const [requireDocument, setRequireDocument] = useState(currentSettings.requireDocument);
  const [documentAfterDays, setDocumentAfterDays] = useState(currentSettings.documentAfterDays);

  const handleSubmit = () => {
    onSave({
      totalDays: Number(totalDays),
      requireDocument,
      documentAfterDays: Number(documentAfterDays)
    });
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-6 py-5">
          <h2 className="text-xl font-bold mb-1">แก้ไขโควต้าการลา</h2>
          <p className="text-white/90 text-sm">
            {leaveType}
            {userName && (
              <span className="ml-2 bg-white/20 px-2 py-1 rounded text-xs">{userName}</span>
            )}
          </p>
        </div>

        {/* Body */}
        <div className="p-6 space-y-5 overflow-y-auto flex-1">
          {/* Total Days */}
          <div>
            <label className="block text-sm font-bold text-gray-700 mb-2">
              จำนวนวันลาต่อปี <span className="text-red-500">*</span>
            </label>
            <div className="relative">
              <input
                type="number"
                min="0"
                max="365"
                value={totalDays}
                onChange={(e) => setTotalDays(Number(e.target.value))}
                className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none"
                placeholder="กรอกจำนวนวัน (สูงสุด 365 วัน)"
              />
              <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">
                วัน
              </div>
            </div>
          </div>

          {/* Require Document */}
          <div className="border-2 border-gray-200 rounded-xl p-4 bg-gray-50">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={requireDocument}
                onChange={(e) => setRequireDocument(e.target.checked)}
                className="w-5 h-5 text-orange-500 border-gray-300 rounded focus:ring-orange-500 cursor-pointer mt-0.5"
              />
              <div className="flex-1">
                <span className="text-sm font-bold text-gray-800">ต้องแนบเอกสาร/ใบรับรอง</span>
                <p className="text-xs text-gray-600 mt-1">เช่น ใบรับรองแพทย์ หนังสือเรียกตัว ฯลฯ</p>
              </div>
            </label>
          </div>

          {/* Document After Days */}
          {requireDocument && (
            <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-4">
              <label className="block text-sm font-bold text-gray-800 mb-3">
                แนบเอกสารเมื่อลาตั้งแต่กี่วัน?
              </label>
              <div className="relative">
                <input
                  type="number"
                  min="0"
                  value={documentAfterDays}
                  onChange={(e) => setDocumentAfterDays(Number(e.target.value))}
                  className="w-full px-4 py-3 text-lg border-2 border-orange-300 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none bg-white"
                  placeholder="กรอกจำนวนวัน"
                />
                <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">
                  วัน
                </div>
              </div>
              <div className="mt-3 space-y-2">
                <p className="text-xs text-orange-700">
                  <span className="font-bold">• 0 วัน:</span> แนบทุกครั้ง
                </p>
                <p className="text-xs text-orange-700">
                  <span className="font-bold">• 3 วัน:</span> แนบเมื่อลา 3 วันขึ้นไป
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-50 border-t-2 flex gap-3">
          <Button
            onClick={onCancel}
            variant="outline"
            className="flex-1"
          >
            ยกเลิก
          </Button>
          <Button
            onClick={handleSubmit}
            className="flex-1 bg-orange-500 hover:bg-orange-600"
          >
            บันทึก
          </Button>
        </div>
      </div>
    </div>
  );
}

export default memo(LeaveQuotaEditModal);
