'use client';

import { useState, useMemo, useCallback, lazy, Suspense } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/contexts/AuthContext';
import { MOCK_BRANCHES, MOCK_REPORTS, DATA_OPTIONS, DataOption, Statistics } from '@/types/download';

// Lazy load heavy components
const PreviewModal = lazy(() => import('@/components/admin/ReportPreviewModal'));
const AlertDialog = lazy(() => import('@/components/common/AlertDialog'));

// Mock data generator
const generateMockData = (options: Record<string, boolean>) => {
  const data: Array<Record<string, string | number>> = [];
  
  for (let i = 0; i < 20; i++) {
    const row: Record<string, string | number> = {
      'ลำดับ': i + 1,
    };
    
    if (options.personalData) {
      row['รหัสพนักงาน'] = `BKK${String(i + 1).padStart(3, '0')}`;
      row['ชื่อ-นามสกุล'] = `พนักงาน ${i + 1}`;
      row['แผนก'] = i % 2 === 0 ? 'IT' : 'HR';
      row['ตำแหน่ง'] = i % 3 === 0 ? 'Developer' : 'Manager';
    }
    
    if (options.attendanceData) {
      row['เข้างาน'] = '08:00';
      row['ออกงาน'] = '17:00';
      row['สถานะ'] = i % 5 === 0 ? 'มาสาย' : 'ตรงเวลา';
      row['ชั่วโมง'] = 8;
    }
    
    if (options.eventStats) {
      row['กิจกรรม'] = Math.floor(Math.random() * 10);
    }
    
    data.push(row);
  }
  
  return data;
};

const calculateStatistics = (data: Array<Record<string, string | number>>): Statistics => {
  const departments = new Set(data.map(d => d['แผนก']).filter(Boolean));
  
  return {
    totalEmployees: data.length,
    totalDepartments: departments.size,
    avgAttendanceRate: 95
  };
};

export default function DownloadData() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'superadmin';

  // Core state only
  const [showModal, setShowModal] = useState(false);
  const [showPreview, setShowPreview] = useState(false);
  const [startDate, setStartDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedBranches, setSelectedBranches] = useState<string[]>([]);
  const [branchSearch, setBranchSearch] = useState('');
  const [selectedOptions, setSelectedOptions] = useState({
    attendanceData: true,
    personalData: true,
    eventStats: false
  });
  const [selectedFormat, setSelectedFormat] = useState<'excel' | 'pdf' | 'csv'>('excel');
  const [alertState, setAlertState] = useState({ isOpen: false, type: 'info' as const, title: '', message: '' });

  // Derived values with useMemo
  const filteredBranches = useMemo(() => 
    MOCK_BRANCHES.filter(b => 
      b.name.toLowerCase().includes(branchSearch.toLowerCase()) ||
      b.id.toLowerCase().includes(branchSearch.toLowerCase())
    ),
    [branchSearch]
  );

  const previewData = useMemo(() => 
    generateMockData(selectedOptions, selectedBranches),
    [selectedOptions, selectedBranches]
  );

  const statistics = useMemo(() => 
    calculateStatistics(previewData),
    [previewData]
  );

  // Optimized handlers
  const handleOptionToggle = useCallback((optionId: string) => {
    setSelectedOptions(prev => ({ ...prev, [optionId]: !prev[optionId] }));
  }, []);

  const handleBranchToggle = useCallback((branchId: string) => {
    setSelectedBranches(prev => 
      prev.includes(branchId) 
        ? prev.filter(id => id !== branchId)
        : [...prev, branchId]
    );
  }, []);

  const handleSelectAllBranches = useCallback(() => {
    setSelectedBranches(prev => 
      prev.length === filteredBranches.length 
        ? []
        : filteredBranches.map(b => b.id)
    );
  }, [filteredBranches]);

  const handleOpenModal = useCallback(() => {
    setShowModal(true);
    setSelectedBranches([]);
  }, []);

  const handleCloseModal = useCallback(() => {
    setShowModal(false);
    setShowPreview(false);
  }, []);

  const handlePreview = useCallback(() => {
    const selectedCount = Object.values(selectedOptions).filter(Boolean).length;
    
    if (selectedCount === 0) {
      setAlertState({
        isOpen: true,
        type: 'warning',
        title: 'กรุณาเลือกข้อมูล',
        message: 'กรุณาเลือกประเภทข้อมูลอย่างน้อย 1 รายการ'
      });
      return;
    }
    
    if (isSuperAdmin && selectedBranches.length === 0) {
      setAlertState({
        isOpen: true,
        type: 'warning',
        title: 'กรุณาเลือกสาขา',
        message: 'กรุณาเลือกสาขาอย่างน้อย 1 สาขา'
      });
      return;
    }
    
    setShowPreview(true);
  }, [selectedOptions, isSuperAdmin, selectedBranches]);

  const handleDownload = useCallback(async () => {
    const selectedCount = Object.values(selectedOptions).filter(Boolean).length;
    
    if (selectedCount === 0 || (isSuperAdmin && selectedBranches.length === 0)) {
      setAlertState({
        isOpen: true,
        type: 'warning',
        title: 'กรุณาตรวจสอบข้อมูล',
        message: 'กรุณาเลือกข้อมูลและสาขา'
      });
      return;
    }

    // Mock download
    console.log('Downloading:', { format: selectedFormat, data: previewData });
    
    setAlertState({
      isOpen: true,
      type: 'success',
      title: 'ดาวน์โหลดสำเร็จ',
      message: `ดาวน์โหลดรายงานในรูปแบบ ${selectedFormat.toUpperCase()} เรียบร้อยแล้ว`
    });
    
    handleCloseModal();
  }, [selectedOptions, isSuperAdmin, selectedBranches, selectedFormat, previewData, handleCloseModal]);

  const getIconColor = (color: string) => {
    const colors: Record<string, string> = {
      blue: 'bg-blue-100 text-blue-600',
      purple: 'bg-purple-100 text-purple-600',
      orange: 'bg-orange-100 text-orange-600'
    };
    return colors[color] || colors.blue;
  };

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
          <p className="text-gray-500 text-sm mt-1">
            {isSuperAdmin ? 'เลือกสาขาและข้อมูลที่ต้องการดาวน์โหลด' : 'ดาวน์โหลดรายงานข้อมูล'}
          </p>
        </div>
      </div>

      {/* Report Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {MOCK_REPORTS.map(report => (
          <Card key={report.id} className="overflow-hidden border-2 border-gray-100 hover:shadow-lg transition-all">
            <div className={`${report.color} p-6 relative overflow-hidden`}>
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
              <div className="relative flex items-center gap-3">
                <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-white">{report.title}</h2>
                  <p className="text-white/90 text-sm">{report.subtitle}</p>
                </div>
              </div>
            </div>

            <div className="p-6">
              <p className="text-gray-600 mb-4">{report.description}</p>
              <Button
                onClick={handleOpenModal}
                className="w-full bg-orange-500 hover:bg-orange-600"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Excel, PDF, CSV
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {/* Main Modal - Lazy loaded */}
      <Suspense fallback={null}>
        {showModal && !showPreview && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
            <div className="w-full max-w-3xl bg-white rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col">
              {/* Modal Header */}
              <div className="bg-gradient-to-r from-orange-500 to-orange-600 p-6 relative overflow-hidden">
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
                      <p className="text-white/90 text-sm">เลือกช่วงเวลาและประเภทข้อมูล</p>
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
                {/* Branch Selection */}
                {isSuperAdmin && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-bold text-gray-800 flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        เลือกสาขา
                      </h3>
                      <Button
                        onClick={handleSelectAllBranches}
                        variant="outline"
                        size="sm"
                        className="text-sm"
                      >
                        {selectedBranches.length === filteredBranches.length ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
                      </Button>
                    </div>

                    <input
                      type="text"
                      value={branchSearch}
                      onChange={(e) => setBranchSearch(e.target.value)}
                      placeholder="ค้นหาสาขา..."
                      className="w-full px-4 py-2.5 mb-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
                    />

                    <div className="grid grid-cols-2 gap-3">
                      {filteredBranches.map(branch => (
                        <label
                          key={branch.id}
                          className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${
                            selectedBranches.includes(branch.id)
                              ? 'bg-orange-50 border-orange-300 shadow-sm'
                              : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <input
                            type="checkbox"
                            checked={selectedBranches.includes(branch.id)}
                            onChange={() => handleBranchToggle(branch.id)}
                            className="w-5 h-5 text-orange-500 border-gray-300 rounded focus:ring-orange-500"
                          />
                          <div className="flex-1">
                            <div className="font-semibold text-gray-800 text-sm">{branch.name}</div>
                            <div className="text-xs text-gray-500">{branch.id}</div>
                          </div>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

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

                {/* Data Options */}
                <div>
                  <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    ประเภทข้อมูล
                  </h3>
                  <div className="space-y-3">
                    {DATA_OPTIONS.map((option: DataOption) => (
                      <label
                        key={option.id}
                        className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all ${
                          selectedOptions[option.id]
                            ? 'bg-orange-50 border-orange-300 shadow-sm'
                            : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedOptions[option.id]}
                          onChange={() => handleOptionToggle(option.id)}
                          className="w-5 h-5 text-orange-500 border-gray-300 rounded focus:ring-orange-500"
                        />
                        <div className={`w-10 h-10 rounded-lg flex items-center justify-center ${getIconColor(option.color)}`}>
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <div className="font-semibold text-gray-800">{option.label}</div>
                          <div className="text-sm text-gray-500">{option.description}</div>
                        </div>
                      </label>
                    ))}
                  </div>
                </div>

                {/* Format Selection */}
                <div>
                  <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                    </svg>
                    รูปแบบไฟล์
                  </h3>
                  <div className="grid grid-cols-3 gap-3">
                    {(['excel', 'pdf', 'csv'] as const).map(format => (
                      <button
                        key={format}
                        onClick={() => setSelectedFormat(format)}
                        className={`p-4 rounded-xl border-2 transition-all ${
                          selectedFormat === format
                            ? 'bg-green-50 border-green-400 shadow-sm'
                            : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex flex-col items-center gap-2">
                          <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                            selectedFormat === format ? 'bg-green-100' : 'bg-gray-100'
                          }`}>
                            <svg xmlns="http://www.w3.org/2000/svg" className={`h-7 w-7 ${
                              selectedFormat === format ? 'text-green-600' : 'text-gray-500'
                            }`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                          </div>
                          <span className={`font-semibold text-sm ${
                            selectedFormat === format ? 'text-green-700' : 'text-gray-700'
                          }`}>
                            {format.toUpperCase()}
                          </span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Modal Footer */}
              <div className="p-6 bg-gray-50 border-t border-gray-200 flex items-center justify-end gap-3">
                <Button onClick={handleCloseModal} variant="outline">
                  ยกเลิก
                </Button>
                <Button onClick={handlePreview} variant="outline" className="bg-blue-500 hover:bg-blue-600 text-white border-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  ดูตัวอย่าง
                </Button>
                <Button onClick={handleDownload} className="bg-orange-500 hover:bg-orange-600">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                  </svg>
                  ดาวน์โหลด
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Preview Modal */}
        {showPreview && (
          <PreviewModal
            data={previewData}
            statistics={statistics}
            format={selectedFormat}
            startDate={startDate}
            endDate={endDate}
            onClose={() => setShowPreview(false)}
            onDownload={handleDownload}
          />
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
