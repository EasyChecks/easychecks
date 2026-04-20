'use client';

import { useState, useCallback, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import downloadService, { ReportType, ReportFormat, PreviewResult } from '@/services/downloadService';

const AlertDialog = dynamic(() => import('@/components/common/AlertDialog'));

function getFirstDayOfMonth(): string {
  const now = new Date();
  const bangkokDate = Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok', year: 'numeric', month: '2-digit', day: '2-digit' }).format(now);
  const [y, m] = bangkokDate.split('-');
  return `${y}-${m}-01`;
}

export default function DownloadData() {
  useAuth();

  const today = Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date());

  // Filter state
  const [reportType, setReportType] = useState<ReportType>('attendance');
  const [reportFormat, setReportFormat] = useState<ReportFormat>('excel');
  const [startDate, setStartDate] = useState(getFirstDayOfMonth());
  const [endDate, setEndDate] = useState(today);

  // UI state
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [previewData, setPreviewData] = useState<PreviewResult | null>(null);
  const [hasPreviewedOnce, setHasPreviewedOnce] = useState(false);
  const [dateError, setDateError] = useState('');
  const [alertState, setAlertState] = useState<{
    isOpen: boolean; type: 'info' | 'success' | 'warning' | 'error'; title: string; message: string;
  }>({ isOpen: false, type: 'info', title: '', message: '' });

  const validateDates = useCallback((): boolean => {
    if (reportType === 'attendance' && startDate && endDate && startDate > endDate) {
      setDateError('วันที่เริ่มต้นต้องไม่มากกว่าวันที่สิ้นสุด');
      return false;
    }
    setDateError('');
    return true;
  }, [reportType, startDate, endDate]);

  const handlePreview = useCallback(async () => {
    if (!validateDates()) return;
    try {
      setIsPreviewing(true);
      const data = await downloadService.previewReport({
        type: reportType,
        startDate: reportType === 'attendance' ? (startDate || undefined) : undefined,
        endDate: reportType === 'attendance' ? (endDate || undefined) : undefined,
      });
      setPreviewData(data);
      setHasPreviewedOnce(true);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setAlertState({ isOpen: true, type: 'error', title: 'โหลดข้อมูลไม่สำเร็จ', message: e.response?.data?.error || e.message || 'ไม่สามารถโหลดข้อมูลตัวอย่างได้' });
    } finally {
      setIsPreviewing(false);
    }
  }, [reportType, startDate, endDate, validateDates]);

  const handleDownload = useCallback(async () => {
    if (!validateDates()) return;
    try {
      setIsDownloading(true);
      await downloadService.downloadReport({
        type: reportType,
        format: reportFormat,
        startDate: reportType === 'attendance' ? (startDate || undefined) : undefined,
        endDate: reportType === 'attendance' ? (endDate || undefined) : undefined,
      });
      setAlertState({ isOpen: true, type: 'success', title: 'ดาวน์โหลดสำเร็จ', message: `ดาวน์โหลดรายงานในรูปแบบ ${reportFormat === 'pdf' ? 'PDF' : 'Excel'} เรียบร้อยแล้ว` });
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } }; message?: string };
      setAlertState({ isOpen: true, type: 'error', title: 'ดาวน์โหลดไม่สำเร็จ', message: e.response?.data?.error || e.message || 'ไม่สามารถดาวน์โหลดรายงานได้' });
    } finally {
      setIsDownloading(false);
    }
  }, [reportType, reportFormat, startDate, endDate, validateDates]);

  return (
    <div className="min-h-screen space-y-4 px-4 pb-6 pt-4 sm:px-5">
      {/* Header — matches app-wide orange gradient card style */}
      <Card className="p-5 bg-linear-to-r from-orange-500 to-orange-600 text-white border-none shadow-lg">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold mb-1">ดาวน์โหลดข้อมูล</h1>
            <p className="text-white/90 text-sm">ดาวน์โหลดรายงานข้อมูลการเข้างานในรูปแบบที่ต้องการ</p>
          </div>
        </div>
      </Card>

      {/* Filters + Actions Card */}
      <Card className="p-6">
        <h2 className="text-sm font-bold text-gray-700 mb-4 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2a1 1 0 01-.293.707L13 13.414V19a1 1 0 01-.553.894l-4 2A1 1 0 017 21v-7.586L3.293 6.707A1 1 0 013 6V4z" />
          </svg>
          ตัวกรอง
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Report Type */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">ประเภทรายงาน</label>
            <select
              value={reportType}
              onChange={e => {
                setReportType(e.target.value as ReportType);
                setPreviewData(null);
                setHasPreviewedOnce(false);
                setDateError('');
              }}
              className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none bg-white text-gray-800 text-sm"
            >
              <option value="attendance">รายงานการเข้างาน</option>
            </select>
          </div>

          {/* File Format */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5">รูปแบบไฟล์</label>
            <select
              value={reportFormat}
              onChange={e => setReportFormat(e.target.value as ReportFormat)}
              className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none bg-white text-gray-800 text-sm"
            >
              <option value="excel">Excel (.xlsx)</option>
              <option value="pdf">PDF (.pdf)</option>
            </select>
          </div>

          {/* Start Date - attendance only */}
          {reportType === 'attendance' && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">วันที่เริ่มต้น</label>
              <input
                type="date"
                value={startDate}
                max={today}
                onClick={e => (e.currentTarget as HTMLInputElement).showPicker?.()}
                onChange={e => { setStartDate(e.target.value); setDateError(''); }}
                className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none cursor-pointer text-sm text-gray-800"
              />
            </div>
          )}

          {/* End Date - attendance only */}
          {reportType === 'attendance' && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1.5">วันที่สิ้นสุด</label>
              <input
                type="date"
                value={endDate}
                max={today}
                onClick={e => (e.currentTarget as HTMLInputElement).showPicker?.()}
                onChange={e => { setEndDate(e.target.value); setDateError(''); }}
                className="w-full px-3 py-2.5 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none cursor-pointer text-sm text-gray-800"
              />
            </div>
          )}
        </div>

        {dateError && (
          <p className="mt-2 text-xs text-red-500 flex items-center gap-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {dateError}
          </p>
        )}

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-3 mt-5 pt-4 border-t border-gray-100">
          <Button
            onClick={handlePreview}
            disabled={isPreviewing || isDownloading}
            variant="outline"
            className="border-orange-400 text-orange-600 hover:bg-orange-50 disabled:opacity-60"
          >
            {isPreviewing ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-orange-500" />
                กำลังโหลด...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                </svg>
                ดูตัวอย่าง
              </span>
            )}
          </Button>

          <Button
            onClick={handleDownload}
            disabled={isDownloading || isPreviewing}
            className="bg-orange-500 hover:bg-orange-600 disabled:opacity-60"
          >
            {isDownloading ? (
              <span className="flex items-center gap-2">
                <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white" />
                กำลังดาวน์โหลด...
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                </svg>
                {reportFormat === 'pdf' ? 'ดาวน์โหลด PDF' : 'ดาวน์โหลด Excel'}
              </span>
            )}
          </Button>

          <span className="text-xs text-gray-400 ml-auto hidden sm:block">
            รูปแบบ: {reportFormat === 'pdf' ? 'PDF (.pdf)' : 'EXCEL (.xlsx)'} · ตัวอย่างสูงสุด 20 แถว
          </span>
        </div>
      </Card>

      {/* Preview Table */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-sm font-bold text-gray-700 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18M3 6h18M3 18h18" />
            </svg>
            ตัวอย่างข้อมูล
          </h2>
          {previewData && !isPreviewing && (
            <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-1 rounded-full">
              {previewData.total} แถว (สูงสุด 20)
            </span>
          )}
        </div>

        {isPreviewing ? (
          <div className="space-y-2">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-9 bg-gray-100 rounded-lg animate-pulse" style={{ opacity: 1 - i * 0.12 }} />
            ))}
          </div>
        ) : !hasPreviewedOnce ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-14 w-14 mb-3 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 17v-2m3 2v-4m3 4v-6m2 10H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="text-sm font-medium text-gray-500">ยังไม่มีข้อมูลแสดง</p>
            <p className="text-xs text-gray-400 mt-1">
              เลือกตัวกรองแล้วกดปุ่ม <span className="font-semibold text-orange-500">ดูตัวอย่าง</span>
            </p>
          </div>
        ) : previewData && previewData.rows.length > 0 ? (
          <div className="overflow-x-auto rounded-xl border border-gray-200">
            <table className="w-full text-xs">
              <thead className="bg-orange-50">
                <tr>
                  {previewData.columns.map(col => (
                    <th key={col} className="text-left py-2.5 px-4 font-semibold text-gray-700 whitespace-nowrap border-b border-orange-100">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {previewData.rows.map((row, i) => (
                  <tr key={i} className={`border-t border-gray-100 hover:bg-orange-50/40 transition-colors ${i % 2 === 1 ? 'bg-gray-50/40' : ''}`}>
                    {previewData.columns.map(col => (
                      <td key={col} className="py-2.5 px-4 text-gray-600 whitespace-nowrap">
                        {String(row[col] ?? '-')}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-14 w-14 mb-3 text-gray-200" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
            </svg>
            <p className="text-sm font-medium text-gray-500">ไม่พบข้อมูล</p>
            <p className="text-xs text-gray-400 mt-1">ไม่มีข้อมูลในช่วงเวลาที่เลือก</p>
          </div>
        )}
      </Card>

      {/* Alert Dialog */}
      <Suspense fallback={null}>
        {alertState.isOpen && (
          <AlertDialog
            isOpen={alertState.isOpen}
            type={alertState.type}
            title={alertState.title}
            message={alertState.message}
            onClose={() => setAlertState(prev => ({ ...prev, isOpen: false }))}
            autoClose={true}
          />
        )}
      </Suspense>
    </div>
  );
}
