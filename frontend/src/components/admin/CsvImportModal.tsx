"use client";

import { CsvUserData } from '@/types/user';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface CsvImportModalProps {
  isOpen: boolean;
  csvData: CsvUserData[];
  generateEmployeeId: (provinceCode: string, branchCode: string) => string;
  onConfirm: () => void;
  onClose: () => void;
}

export default function CsvImportModal({
  isOpen,
  csvData,
  generateEmployeeId,
  onConfirm,
  onClose
}: CsvImportModalProps) {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm" 
        onClick={onClose}
      />
      <Card className="relative z-10 w-full max-w-6xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">ตรวจสอบข้อมูล CSV</h2>
            <p className="text-sm text-gray-500">พบข้อมูล {csvData.length} รายการ</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 transition-colors rounded-full hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="mb-6 overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-xs font-semibold text-left text-gray-700 uppercase">
                  #
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-left text-gray-700 uppercase">
                  ชื่อ-นามสกุล
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-left text-gray-700 uppercase">
                  อีเมล
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-left text-gray-700 uppercase">
                  รหัสพนักงาน
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-left text-gray-700 uppercase">
                  แผนก
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-left text-gray-700 uppercase">
                  ตำแหน่ง
                </th>
                <th className="px-4 py-3 text-xs font-semibold text-left text-gray-700 uppercase">
                  บทบาท
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {csvData.map((row, index) => {
                const employeeId = generateEmployeeId(row.provinceCode, row.branchCode);
                
                return (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {index + 1}
                    </td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      {row.name}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {row.email}
                    </td>
                    <td className="px-4 py-3 text-sm font-mono text-gray-900">
                      {employeeId}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {row.department}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {row.position}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-1 text-xs font-semibold text-gray-700 capitalize bg-gray-100 rounded-lg">
                        {row.role}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <div className="flex items-center justify-between p-4 border-t rounded-lg bg-blue-50">
          <div className="flex items-center gap-2 text-blue-600">
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-semibold">
              รหัสพนักงานและรหัสผ่านจะถูกสร้างอัตโนมัติ
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <Button type="button" variant="outline" onClick={onClose}>
            ยกเลิก
          </Button>
          <Button 
            type="button" 
            onClick={onConfirm} 
            className="bg-orange-600 hover:bg-orange-700"
          >
            ยืนยันการนำเข้า ({csvData.length} รายการ)
          </Button>
        </div>
      </Card>
    </div>
  );
}
