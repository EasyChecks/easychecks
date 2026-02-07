'use client';

import { memo } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Statistics } from '@/types/download';

interface ReportPreviewModalProps {
  data: Array<Record<string, string | number>>;
  statistics: Statistics;
  format: 'excel' | 'pdf' | 'csv';
  startDate: string;
  endDate: string;
  onClose: () => void;
  onDownload: () => void;
}

function ReportPreviewModal({ data, statistics, format, startDate, endDate, onClose, onDownload }: ReportPreviewModalProps) {
  const headers = data.length > 0 ? Object.keys(data[0]) : [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
      <div className="w-full max-w-6xl bg-white rounded-2xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-semibold text-gray-900">ตัวอย่างข้อมูล - {format.toUpperCase()}</h2>
              <p className="text-sm text-gray-500 mt-1">
                แสดง {data.length} รายการ • {startDate} ถึง {endDate}
              </p>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center text-gray-600 transition-colors"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-6">
          <div className="mb-3 flex items-center gap-2 text-sm text-gray-600 bg-blue-50 px-4 py-2 rounded-lg border border-blue-200">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>เลื่อนซ้าย-ขวาเพื่อดูข้อมูลทั้งหมด</span>
          </div>

          {/* Table */}
          <div className="border border-gray-200 rounded-lg overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gradient-to-r from-orange-500 to-orange-600 sticky top-0">
                <tr>
                  {headers.map((header, idx) => (
                    <th
                      key={idx}
                      className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap"
                    >
                      {header}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {data.map((row, rowIdx) => (
                  <tr key={rowIdx} className={`hover:bg-orange-50 transition-colors ${rowIdx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                    {Object.values(row).map((value, colIdx) => {
                      const isStatus = ['ตรงเวลา', 'มาสาย', 'ขาดงาน'].includes(String(value));
                      
                      return (
                        <td key={colIdx} className="px-4 py-3 text-sm whitespace-nowrap">
                          {isStatus ? (
                            <Badge variant={value === 'ตรงเวลา' ? 'active' : 'suspend'}>
                              {String(value)}
                            </Badge>
                          ) : (
                            <span className="text-gray-900">{String(value)}</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Statistics */}
          <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
              <div className="text-sm text-blue-600 font-medium mb-1">จำนวนพนักงาน</div>
              <div className="text-2xl font-bold text-blue-900">{statistics.totalEmployees}</div>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
              <div className="text-sm text-purple-600 font-medium mb-1">จำนวนแผนก</div>
              <div className="text-2xl font-bold text-purple-900">{statistics.totalDepartments}</div>
            </div>
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-lg border border-orange-200">
              <div className="text-sm text-orange-600 font-medium mb-1">เปอร์เซ็นต์ตรงเวลา</div>
              <div className="text-2xl font-bold text-orange-900">{statistics.avgAttendanceRate}%</div>
            </div>
          </div>

          {/* Format Info */}
          <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h4 className="font-semibold text-gray-900 text-sm mb-1">รูปแบบไฟล์: {format.toUpperCase()}</h4>
                <p className="text-xs text-gray-600">
                  {format === 'excel' && 'ไฟล์ Excel (.xlsx) สามารถเปิดด้วย Microsoft Excel, Google Sheets หรือโปรแกรมแผ่นงานอื่นๆ'}
                  {format === 'pdf' && 'ไฟล์ PDF (.pdf) เหมาะสำหรับการพิมพ์และแชร์'}
                  {format === 'csv' && 'ไฟล์ CSV (.csv) เป็นรูปแบบข้อมูลธรรมดา สามารถนำเข้าระบบอื่นได้ง่าย'}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-3">
          <Button onClick={onClose} variant="outline">ปิด</Button>
          <Button onClick={onDownload} className="bg-gray-900 hover:bg-gray-800 text-white">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
            </svg>
            ดาวน์โหลดเลย
          </Button>
        </div>
      </div>
    </div>
  );
}

export default memo(ReportPreviewModal);
