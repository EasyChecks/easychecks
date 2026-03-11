'use client';

import { useState, useCallback, useEffect, lazy, Suspense } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import downloadService, { DownloadHistoryItem, ReportType } from '@/services/downloadService';

// Lazy load heavy components
const AlertDialog = lazy(() => import('@/components/common/AlertDialog'));

export default function DownloadData() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'superadmin';

  // Core state
  const [showModal, setShowModal] = useState(false);
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedReportType, setSelectedReportType] = useState<ReportType>('attendance');
  const [alertState, setAlertState] = useState<{ isOpen: boolean; type: 'info' | 'success' | 'warning' | 'error'; title: string; message: string }>({ isOpen: false, type: 'info', title: '', message: '' });
  const [isDownloading, setIsDownloading] = useState(false);

  // History state
  const [history, setHistory] = useState<DownloadHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  useEffect(() => {
    const fetchHistory = async () => {
      setHistoryLoading(true);
      try {
        const res = await downloadService.getHistory({ limit: 10 });
        setHistory(res.data);
      } catch {
        // ไม่แสดง error ถ้า history โหลดไม่ได้
      } finally {
        setHistoryLoading(false);
      }
    };
    fetchHistory();
  }, []);

  const handleOpenModal = useCallback(() => {
    setShowModal(true);
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowModal(false);
  }, []);

  const handleDownload = useCallback(async () => {
    try {
      setIsDownloading(true);
      await downloadService.downloadReport({
        type:      selectedReportType,
        format:    'excel',
        startDate: startDate || undefined,
        endDate:   endDate   || undefined,
      });
      // refresh history
      const res = await downloadService.getHistory({ limit: 10 });
      setHistory(res.data);
      setAlertState({ isOpen: true, type: 'success', title: 'ดาวน์โหลดสำเร็จ', message: 'ดาวน์โหลดรายงานในรูปแบบ Excel เรียบร้อยแล้ว' });
      handleCloseModal();
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setAlertState({ isOpen: true, type: 'error', title: 'ดาวน์โหลดไม่สำเร็จ', message: e.response?.data?.error || 'ไม่สามารถดาวน์โหลดรายงานได้' });
    } finally {
      setIsDownloading(false);
    }
  }, [selectedReportType, startDate, endDate, handleCloseModal]);

  // suppress unused warning for isSuperAdmin (kept for future branch filter)
  void isSuperAdmin;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3 mb-2">
        <div className="w-12 h-12 bg-orange-500 rounded-2xl flex items-center justify-center shadow-sm">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
          </svg>
        </div>
        <div>
          <h1 className="text-3xl font-bold text-gray-800">ดาวน์โหลดข้อมูล</h1>
          <p className="text-gray-500 text-sm mt-1">ดาวน์โหลดรายงานข้อมูลในรูปแบบที่ต้องการ</p>
        </div>
      </div>

      {/* Report Type Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Attendance Report */}
        <Card className="overflow-hidden border-2 border-gray-100 hover:shadow-lg transition-all">
          <div className="bg-linear-to-r from-blue-500 to-blue-600 p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
            <div className="relative flex items-center gap-3">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">รายงานการเข้างาน</h2>
                <p className="text-white/90 text-sm">Attendance Report</p>
              </div>
            </div>
          </div>
          <div className="p-6">
            <p className="text-gray-600 mb-4">รายงานสรุปการเข้า-ออกงานของพนักงานทุกสาขา</p>
            <Button
              onClick={() => { setSelectedReportType('attendance'); handleOpenModal(); }}
              className="w-full bg-orange-500 hover:bg-orange-600"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              ดาวน์โหลด Excel
            </Button>
          </div>
        </Card>

        {/* Shift Report */}
        <Card className="overflow-hidden border-2 border-gray-100 hover:shadow-lg transition-all">
          <div className="bg-linear-to-r from-purple-500 to-purple-600 p-6 relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
            <div className="relative flex items-center gap-3">
              <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white">รายงานกะการทำงาน</h2>
                <p className="text-white/90 text-sm">Shift Report</p>
              </div>
            </div>
          </div>
          <div className="p-6">
            <p className="text-gray-600 mb-4">รายงานสรุปกะการทำงานของพนักงานทุกสาขา</p>
            <Button
              onClick={() => { setSelectedReportType('shift'); handleOpenModal(); }}
              className="w-full bg-orange-500 hover:bg-orange-600"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              ดาวน์โหลด Excel
            </Button>
          </div>
        </Card>
      </div>

      {/* Download History */}
      <Card className="p-6">
        <h2 className="text-lg font-bold text-gray-800 mb-4">ประวัติการดาวน์โหลด</h2>
        {historyLoading ? (
          <div className="flex justify-center py-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500"></div>
          </div>
        ) : history.length === 0 ? (
          <p className="text-center text-gray-500 py-8">ยังไม่มีประวัติการดาวน์โหลด</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-2 px-3 text-gray-600">ประเภท</th>
                  <th className="text-left py-2 px-3 text-gray-600">ชื่อไฟล์</th>
                  <th className="text-left py-2 px-3 text-gray-600">วันที่ดาวน์โหลด</th>
                  <th className="text-left py-2 px-3 text-gray-600">ผู้ดาวน์โหลด</th>
                </tr>
              </thead>
              <tbody>
                {history.map((item, idx) => (
                  <tr key={idx} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="py-2 px-3">{item.reportType === 'attendance' ? 'การเข้างาน' : 'กะการทำงาน'}</td>
                    <td className="py-2 px-3 text-xs text-gray-500 truncate max-w-50">{item.fileName}</td>
                    <td className="py-2 px-3">{new Date(item.downloadAt).toLocaleString('th-TH')}</td>
                    <td className="py-2 px-3">{item.user ? `${item.user.firstName} ${item.user.lastName}` : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Download Modal */}
      <Suspense fallback={null}>
        {showModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
              {/* Modal Header */}
              <div className="bg-linear-to-r from-orange-500 to-orange-600 p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -mr-24 -mt-24"></div>
                <div className="relative flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-white">ดาวน์โหลดรายงาน</h2>
                      <p className="text-white/90 text-sm">
                        {selectedReportType === 'attendance' ? 'รายงานการเข้างาน' : 'รายงานกะการทำงาน'}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={handleCloseModal}
                    className="w-10 h-10 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-xl flex items-center justify-center text-white transition-all"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Modal Body */}
              <div className="p-6 overflow-y-auto flex-1 space-y-6">
                {/* Date Range */}
                <div>
                  <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    ช่วงเวลา
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-2">วันที่เริ่มต้น</label>
                      <input
                        type="date"
                        value={startDate}
                        onChange={(e) => setStartDate(e.target.value)}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-600 mb-2">วันที่สิ้นสุด</label>
                      <input
                        type="date"
                        value={endDate}
                        onChange={(e) => setEndDate(e.target.value)}
                        className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
                      />
                    </div>
                  </div>
                </div>

                {/* Format Info */}
                <div>
                  <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    รูปแบบไฟล์
                  </h3>
                  <div className="p-4 rounded-xl border-2 bg-green-50 border-green-400 shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-12 h-12 rounded-lg flex items-center justify-center bg-green-100">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <span className="font-semibold text-green-700">EXCEL (.xlsx)</span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-6 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-3">
                <Button onClick={handleCloseModal} variant="outline">
                  ยกเลิก
                </Button>
                <Button
                  onClick={handleDownload}
                  disabled={isDownloading}
                  className="bg-orange-500 hover:bg-orange-600 disabled:opacity-60"
                >
                  {isDownloading ? (
                    <span className="flex items-center gap-2">
                      <span className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></span>
                      กำลังดาวน์โหลด...
                    </span>
                  ) : (
                    <>
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                      </svg>
                      ดาวน์โหลด
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Alert Dialog */}
        {alertState.isOpen && (
          <AlertDialog
            isOpen={alertState.isOpen}
            type={alertState.type}
            title={alertState.title}
            message={alertState.message}
            onClose={() => setAlertState({ ...alertState, isOpen: false })}
            autoClose={true}
          />
        )}
      </Suspense>
    </div>
  );
}
