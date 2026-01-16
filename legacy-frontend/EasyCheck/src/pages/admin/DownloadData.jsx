import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/useAuth';
import AlertDialog from '../../components/common/AlertDialog';
import { mockBranches, mockReports, mockDataOptions } from '../../data/usersData';
import { 
  generateEnhancedReportData, 
  convertToCSV, 
  generateFileName, 
  validateSelection,
  calculateStatistics 
} from '../../utils/reportDataGenerator';
import { downloadPDF } from '../../utils/enhancedPDFGenerator';
import { StatusText } from '../../components/common/StatusIcons';
import * as XLSX from 'xlsx';

function DownloadData() {
  const { user: currentUser } = useAuth();
  const isSuperAdmin = currentUser?.role === 'superadmin';
  const [showModal, setShowModal] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0); // 🆕 ใช้ trigger refresh เมื่อข้อมูลเปลี่ยน
  const [selectedReport, setSelectedReport] = useState(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedBranches, setSelectedBranches] = useState([]);
  const [branchSearchQuery, setBranchSearchQuery] = useState(''); // 🆕 ช่องค้นหาสาขา
  const [selectedOptions, setSelectedOptions] = useState({
    attendanceData: true,
    personalData: true,
    eventStats: false
  });
  const [selectedFormat, setSelectedFormat] = useState('excel'); // excel, pdf, csv
  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState(null);
  
  // Alert Dialog States
  const [alertDialog, setAlertDialog] = useState({
    isOpen: false,
    type: 'info',
    title: '',
    message: ''
  });

  // ใช้ Mock Data จาก usersData.js
  const branches = mockBranches;
  const reports = mockReports;
  const dataOptions = mockDataOptions;

  // 🆕 กรองสาขาตามคำค้นหา
  const filteredBranches = branches.filter(branch => 
    branch.name.toLowerCase().includes(branchSearchQuery.toLowerCase()) ||
    branch.id.toLowerCase().includes(branchSearchQuery.toLowerCase())
  );

  // 🆕 ฟังก์ชันเลือก/ยกเลิกทั้งหมด
  const handleSelectAllBranches = () => {
    if (selectedBranches.length === filteredBranches.length) {
      // ถ้าเลือกครบแล้ว → ยกเลิกทั้งหมด
      setSelectedBranches([]);
    } else {
      // เลือกทั้งหมด (เฉพาะที่กรองแล้ว)
      setSelectedBranches(filteredBranches.map(b => b.id));
    }
  };

  // 🆕 ฟังการเปลี่ยนแปลง usersData จาก AdminManageUser
  useEffect(() => {
    const handleStorageChange = (e) => {
      // เมื่อ usersData ใน localStorage เปลี่ยน (จาก AdminManageUser)
      if (e.key === 'usersData' && e.newValue) {
        setRefreshKey(prev => prev + 1); // Trigger refresh
        
        // ถ้ากำลังแสดง preview อยู่ ให้รีเฟรชข้อมูลทันที
        if (showPreview) {
          const updatedData = generateRealData();
          setPreviewData(updatedData);
        }
      }
    };

    const handleAttendanceUpdate = () => {
      // เมื่อมีการอัพเดท attendance (จาก AdminManageUser หรือ User Dashboard)
      setRefreshKey(prev => prev + 1);
      
      // รีเฟรช preview ถ้าเปิดอยู่
      if (showPreview) {
        const updatedData = generateRealData();
        setPreviewData(updatedData);
      }
    };

    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('attendanceUpdated', handleAttendanceUpdate);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('attendanceUpdated', handleAttendanceUpdate);
    };
  }, [showPreview]); // eslint-disable-line react-hooks/exhaustive-deps

  const openModal = (report) => {
    setSelectedReport(report);
    setShowModal(true);
    // Set default dates to today
    const today = new Date().toISOString().split('T')[0];
    setStartDate(today);
    setEndDate(today);
    
    // Reset branch selection
    setSelectedBranches([]);
  };

  const closeModal = () => {
    setShowModal(false);
    setSelectedReport(null);
    setSelectedBranches([]);
    setShowPreview(false);
    setPreviewData(null);
  };

  const handleOptionToggle = (optionId) => {
    setSelectedOptions(prev => ({
      ...prev,
      [optionId]: !prev[optionId]
    }));
  };

  const handleBranchToggle = (branchId) => {
    setSelectedBranches(prev => {
      if (prev.includes(branchId)) {
        return prev.filter(id => id !== branchId);
      } else {
        return [...prev, branchId];
      }
    });
  };

  // สร้างข้อมูลจริงสำหรับรายงาน (อัพเดทอัตโนมัติจาก localStorage)
  const generateRealData = () => {
    // ใช้ refreshKey เพื่อ force re-generate เมื่อข้อมูลเปลี่ยน
    console.log(`Generating report data... (refresh: ${refreshKey})`);
    console.log('Selected Options:', selectedOptions);
    
    const data = generateEnhancedReportData(
      selectedOptions,
      selectedBranches,
      currentUser?.branchCode,
      isSuperAdmin
    );
    
    // Debug: แสดงชื่อคอลัมน์ทั้งหมด
    if (data && data.length > 0) {
      console.log('Generated columns:', Object.keys(data[0]));
    }
    
    return data;
  };

  // จัดการการแสดงตัวอย่าง
  const handlePreview = () => {
    console.log('=== handlePreview called ===');
    console.log('Selected options:', selectedOptions);
    
    // ตรวจสอบความถูกต้องก่อน
    const validation = validateSelection(selectedOptions, selectedBranches, isSuperAdmin);
    
    if (!validation.isValid) {
      setAlertDialog({
        isOpen: true,
        type: 'warning',
        title: 'กรุณาตรวจสอบข้อมูล',
        message: validation.message,
        autoClose: true
      });
      return;
    }

    // Generate preview data
    const data = generateRealData();
    // console.log('Preview data generated:', data?.length, 'records');
    if (data && data.length > 0) {
      // console.log('First record keys:', Object.keys(data[0]));
    }
    setPreviewData(data);
    setShowPreview(true);
  };

  const closePreview = () => {
    setShowPreview(false);
    setPreviewData(null);
  };

    // Download as Excel (Real XLSX format using xlsx library)
  const downloadExcel = (data) => {
    // กำหนดความกว้างคอลัมน์ตามชนิดของข้อมูล
    const getColumnWidth = (header) => {
      if (header === 'ลำดับ') return 8;
      if (header === 'รหัสพนักงาน') return 15;
      if (header === 'ชื่อ-นามสกุล') return 25;
      if (header === 'แผนก' || header === 'ตำแหน่ง') return 20;
      if (header === 'อีเมล') return 25;
      if (header === 'เบอร์โทร') return 15;
      if (header === 'สถานะ') return 12;
      if (header.includes('วัน') || header.includes('ชั่วโมง')) return 12;
      if (header.includes('เปอร์เซ็นต์') || header.includes('%')) return 12;
      if (header.includes('กิจกรรม')) return 15;
      return 15; // default
    };

    // ฟังก์ชันสร้างไฟล์ Excel จากข้อมูล
    const createExcelFile = (dataToExport, filename) => {
      // สร้าง worksheet จากข้อมูล
      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      
      // ตั้งค่าความกว้างคอลัมน์
      const headers = Object.keys(dataToExport[0] || {});
      worksheet['!cols'] = headers.map(header => ({ wch: getColumnWidth(header) }));
      
      // จัดตำแหน่งข้อความให้ชิดซ้ายทุกช่อง และบังคับตัวเลขให้เป็น text
      const range = XLSX.utils.decode_range(worksheet['!ref']);
      for (let R = range.s.r; R <= range.e.r; ++R) {
        for (let C = range.s.c; C <= range.e.c; ++C) {
          const cellAddress = XLSX.utils.encode_cell({ r: R, c: C });
          if (!worksheet[cellAddress]) continue;
          
          // บังคับให้เป็น text (string) แทน number เพื่อให้ชิดซ้าย
          const cellValue = worksheet[cellAddress].v;
          if (typeof cellValue === 'number') {
            worksheet[cellAddress].t = 's'; // เปลี่ยนเป็น string type
            worksheet[cellAddress].v = String(cellValue); // แปลงเป็น string
          }
          
          // ตั้งค่า style ให้ข้อความชิดซ้าย
          if (!worksheet[cellAddress].s) worksheet[cellAddress].s = {};
          worksheet[cellAddress].s.alignment = { 
            horizontal: 'left', 
            vertical: 'center' 
          };
        }
      }
      
      // สร้าง workbook
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, 'รายงาน');
      
      // ดาวน์โหลดไฟล์
      XLSX.writeFile(workbook, filename);
    };

    // ถ้าเลือกหลายออฟฟิศ -> แยกไฟล์ตามออฟฟิศ
    if (isSuperAdmin && selectedBranches.length > 1) {
      selectedBranches.forEach(branchId => {
        const branch = branches.find(b => b.id === branchId);
        const branchData = data.filter(row => {
          // กรองข้อมูลตาม provinceCode และ branchCode
          const userBranchId = `${row['รหัสพนักงาน']?.substring(0, 6) || ''}`;
          return userBranchId === branchId;
        });
        
        if (branchData.length > 0) {
          const branchName = branch?.name.replace(/[^a-zA-Z0-9\u0e00-\u0e7f]/g, '_') || branchId;
          const filename = `รายงาน_${branchName}_${startDate}_${endDate}.xlsx`;
          createExcelFile(branchData, filename);
        }
      });
    } else {
      // ออฟฟิศเดียว หรือ Admin
      const filename = generateFileName('รายงาน', 'excel', startDate, endDate);
      createExcelFile(data, filename);
    }
  };

  // Download as PDF using enhanced PDF generator
  const handlePDFDownload = async (data) => {
    // ถ้าเลือกหลายออฟฟิศ -> แยกไฟล์ตามออฟฟิศ
    if (isSuperAdmin && selectedBranches.length > 1) {
      for (const branchId of selectedBranches) {
        const branch = branches.find(b => b.id === branchId);
        const branchData = data.filter(row => {
          const userBranchId = `${row['รหัสพนักงาน']?.substring(0, 6) || ''}`;
          return userBranchId === branchId;
        });
        
        if (branchData.length > 0) {
          const statistics = calculateStatistics(branchData);
          const branchName = branch?.name.replace(/[^a-zA-Z0-9฀-๿]/g, '_') || branchId;
          const filename = `รายงาน_${branchName}_${startDate}_${endDate}.pdf`;

          const metadata = {
            title: `${selectedReport.title} - ${branch?.name || branchId}`,
            startDate,
            endDate,
            statistics,
          };

          await downloadPDF(branchData, metadata, filename);
        }
      }
    } else {
      // ออฟฟิศเดียว หรือ Admin
      const statistics = calculateStatistics(data);
      const filename = generateFileName('รายงาน', 'pdf', startDate, endDate);

      const metadata = {
        title: selectedReport.title,
        startDate,
        endDate,
        statistics,
      };

      await downloadPDF(data, metadata, filename);
    }
  };

  // Download as CSV
  const downloadCSV = (data) => {
    // ถ้าเลือกหลายออฟฟิศ -> แยกไฟล์ตามออฟฟิศ
    if (isSuperAdmin && selectedBranches.length > 1) {
      selectedBranches.forEach(branchId => {
        const branch = branches.find(b => b.id === branchId);
        const branchData = data.filter(row => {
          const userBranchId = `${row['รหัสพนักงาน']?.substring(0, 6) || ''}`;
          return userBranchId === branchId;
        });
        
        if (branchData.length > 0) {
          const csvContent = convertToCSV(branchData);
          const branchName = branch?.name.replace(/[^a-zA-Z0-9฀-๿]/g, '_') || branchId;
          const filename = `รายงาน_${branchName}_${startDate}_${endDate}.csv`;
          
          const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
          const link = document.createElement('a');
          const url = URL.createObjectURL(blob);
          link.setAttribute('href', url);
          link.setAttribute('download', filename);
          link.style.visibility = 'hidden';
          document.body.appendChild(link);
          link.click();
          document.body.removeChild(link);
          URL.revokeObjectURL(url);
        }
      });
    } else {
      // ออฟฟิศเดียว หรือ Admin
      const csvContent = convertToCSV(data);
      const filename = generateFileName('รายงาน', 'csv', startDate, endDate);
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.style.visibility = 'hidden';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
  };

  const handleDownload = async () => {
    // ตรวจสอบความถูกต้องก่อน
    const validation = validateSelection(selectedOptions, selectedBranches, isSuperAdmin);
    
    if (!validation.isValid) {
      setAlertDialog({
        isOpen: true,
        type: 'warning',
        title: 'กรุณาตรวจสอบข้อมูล',
        message: validation.message,
        autoClose: true
      });
      return;
    }

    // Generate real data
    const data = generateRealData();
    const selectedCount = Object.values(selectedOptions).filter(Boolean).length;

    // Download based on selected format
    try {
      switch (selectedFormat) {
        case 'excel':
          downloadExcel(data);
          break;
        case 'pdf':
          await handlePDFDownload(data);
          break;
        case 'csv':
          downloadCSV(data);
          break;
        default:
          downloadExcel(data);
      }

      setAlertDialog({
        isOpen: true,
        type: 'success',
        title: 'ดาวน์โหลดสำเร็จ',
        message: `ดาวน์โหลด ${selectedReport.title} ในรูปแบบ ${selectedFormat.toUpperCase()} เรียบร้อยแล้ว\nวันที่: ${startDate} ถึง ${endDate}\nจำนวนข้อมูล: ${selectedCount} รายการ`,
        autoClose: true
      });
      
      closeModal();
    } catch (error) {
      setAlertDialog({
        isOpen: true,
        type: 'error',
        title: 'เกิดข้อผิดพลาด',
        message: `ไม่สามารถดาวน์โหลดไฟล์ได้: ${error.message}`,
        autoClose: true
      });
    }
  };

  const closeAlertDialog = () => {
    setAlertDialog({ ...alertDialog, isOpen: false });
  };

  const getIconColor = (color) => {
    const colors = {
      blue: 'bg-orange-100 text-brand-primary',
      purple: 'bg-orange-50 text-orange-600',
      green: 'bg-green-100 text-green-600',
      pink: 'bg-orange-50 text-orange-600',
      orange: 'bg-orange-100 text-orange-600'
    };
    return colors[color] || colors.blue;
  };

  // SVG Icons
  const icons = {
    report: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
    chart: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 12l3-3 3 3 4-4M8 21l4-4 4 4M3 4h18M4 4h16v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4z" />
      </svg>
    ),
    clock: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
    user: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
    location: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    camera: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
    ),
    activity: (
      <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
      </svg>
    )
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl px-6 py-6">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-brand-primary  rounded-2xl flex items-center justify-center shadow-sm">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-brand-primary  bg-clip-text text-transparent">
                ดาวน์โหลดข้อมูล
              </h1>
              <p className="text-gray-500 text-sm mt-1">
                {isSuperAdmin ? 'เลือกออฟฟิศและข้อมูลที่ต้องการดาวน์โหลด' : 'เลือกข้อมูลที่ต้องการดาวน์โหลด'}
              </p>
            </div>
          </div>
        </div>

        {/* Report Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {reports.map((report) => (
            <div 
              key={report.id}
              className="bg-white rounded-2xl shadow-sm border-2 border-gray-100 overflow-hidden"
            >
              {/* Card Header */}
              <div className={`bg-${report.color} p-6 relative overflow-hidden`}>
                <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -mr-16 -mt-16"></div>
                <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full -ml-12 -mb-12"></div>
                
                <div className="relative">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="w-16 h-16 bg-brand-primary backdrop-blur-sm rounded-xl flex items-center justify-center">
                      {report.id === 1 ? icons.report : icons.chart}
                    </div>
                    <div>
                      <h2 className="text-2xl font-bold text-black drop-shadow-sm">{report.title}</h2>
                      <p className="text-black text-sm">{report.subtitle}</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Card Body */}
              <div className="p-6">
                <p className="text-gray-600 mb-4">{report.description}</p>
                
                <button
                  onClick={() => openModal(report)}
                  className="w-full px-6 py-3 bg-brand-primary  hover: text-white rounded-xl shadow-sm hover:bg-orange-600 flex items-center justify-center gap-2 font-semibold"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  Excel (.xlsx), PDF, CSV
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Modal */}
      {showModal && selectedReport && !showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fadeIn">
          <div className="w-full max-w-3xl bg-white rounded-3xl shadow-sm overflow-hidden transform animate-slideUp max-h-[90vh] flex flex-col">
            {/* Modal Header */}
            <div className="bg-brand-primary  p-6 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-48 h-48 bg-white/10 rounded-full -mr-24 -mt-24"></div>
              
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center">
                    {selectedReport.id === 1 ? icons.report : icons.chart}
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-white drop-shadow-sm">
                      ดาวน์โหลดรวมข้อมูลพนักงานทั้งหมด
                    </h2>
                    <p className="text-white/90 text-sm">เลือกช่วงเวลาและประเภทข้อมูลที่ต้องการ</p>
                  </div>
                </div>
                <button
                  onClick={closeModal}
                  className="w-10 h-10 bg-white/20 hover:bg-white/30 backdrop-blur-md rounded-xl flex items-center justify-center text-white transition-all duration-200 transform hover:scale-110"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="p-6 overflow-y-auto flex-1">
              {/* Branch Selection (SuperAdmin Only) */}
              {isSuperAdmin && (
                <div className="mb-6">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-gray-800 flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                      </svg>
                      เลือกออฟฟิศ
                    </h3>
                    <button
                      onClick={handleSelectAllBranches}
                      className="px-4 py-2 text-sm font-medium text-brand-primary hover:bg-orange-50 rounded-lg transition-colors border border-orange-200 hover:border-orange-300"
                    >
                      {selectedBranches.length === filteredBranches.length && filteredBranches.length > 0 ? 'ยกเลิกทั้งหมด' : 'เลือกทั้งหมด'}
                    </button>
                  </div>
                  
                  {/* ช่องค้นหา */}
                  <div className="mb-3">
                    <div className="relative">
                      <input
                        type="text"
                        value={branchSearchQuery}
                        onChange={(e) => setBranchSearchQuery(e.target.value)}
                        placeholder="ค้นหาสาขา..."
                        className="w-full px-4 py-2.5 pl-10 border-2 border-gray-200 rounded-xl focus:border-brand-primary focus:outline-none transition-colors"
                      />
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 absolute left-3 top-1/2 transform -translate-y-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                      </svg>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    {filteredBranches.length > 0 ? filteredBranches.map((branch) => (
                      <label
                        key={branch.id}
                        className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                          selectedBranches.includes(branch.id)
                            ? 'bg-orange-50 border-orange-300 shadow-sm'
                            : 'bg-gray-50 border-gray-200 hover:border-gray-300 hover:shadow-sm'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={selectedBranches.includes(branch.id)}
                          onChange={() => handleBranchToggle(branch.id)}
                          className="w-5 h-5 text-brand-primary border-gray-300 rounded focus:ring-brand-primary focus:ring-2 cursor-pointer"
                        />
                        <div className="flex-1">
                          <div className="font-semibold text-gray-800 text-sm">{branch.name}</div>
                          <div className="text-xs text-gray-500">{branch.id}</div>
                        </div>
                      </label>
                    )) : (
                      <div className="col-span-2 text-center py-8 text-gray-500">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-2 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                        </svg>
                        <p className="text-sm">ไม่พบสาขาที่ค้นหา</p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Date Range */}
              <div className="mb-6">
                <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
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
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-brand-primary focus:outline-none transition-colors"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">วันที่สิ้นสุด</label>
                    <input
                      type="date"
                      value={endDate}
                      onChange={(e) => setEndDate(e.target.value)}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-brand-primary focus:outline-none transition-colors"
                    />
                  </div>
                </div>
              </div>

              {/* Data Options */}
              <div className="mb-6">
                <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  ประเภทข้อมูลที่ต้องการ
                </h3>
                <div className="space-y-3">
                  {dataOptions.map((option) => (
                    <label
                      key={option.id}
                      className={`flex items-center gap-4 p-4 rounded-xl border-2 cursor-pointer transition-all duration-200 ${
                        selectedOptions[option.id]
                          ? 'bg-orange-50 border-orange-300 shadow-sm'
                          : 'bg-gray-50 border-gray-200 hover:border-gray-300 hover:shadow-sm'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedOptions[option.id]}
                        onChange={() => handleOptionToggle(option.id)}
                        className="w-5 h-5 text-brand-primary border-gray-300 rounded focus:ring-brand-primary focus:ring-2 cursor-pointer"
                      />
                      <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 ${getIconColor(option.color)}`}>
                        {option.id === 'attendanceData' && icons.clock}
                        {option.id === 'personalData' && icons.user}
                        {option.id === 'gpsTracking' && icons.location}
                        {option.id === 'photoAttendance' && icons.camera}
                        {option.id === 'eventStats' && icons.activity}
                      </div>
                      <div className="flex-1">
                        <div className="font-semibold text-gray-800">{option.label}</div>
                        <div className="text-sm text-gray-500">{option.description}</div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* File Format Selection */}
              <div>
                <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                  </svg>
                  รูปแบบไฟล์
                </h3>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    onClick={() => setSelectedFormat('excel')}
                    className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                      selectedFormat === 'excel'
                        ? 'bg-green-50 border-green-400 shadow-sm'
                        : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                        selectedFormat === 'excel' ? 'bg-green-100' : 'bg-gray-100'
                      }`}>
                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-7 w-7 ${selectedFormat === 'excel' ? 'text-green-600' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18m-9-4v8m-7 0h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <span className={`font-semibold text-sm ${
                        selectedFormat === 'excel' ? 'text-green-700' : 'text-gray-700'
                      }`}>
                        Excel
                      </span>
                      <span className="text-xs text-gray-500">.xlsx</span>
                    </div>
                  </button>

                  <button
                    onClick={() => setSelectedFormat('pdf')}
                    className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                      selectedFormat === 'pdf'
                        ? 'bg-red-50 border-red-400 shadow-sm'
                        : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                        selectedFormat === 'pdf' ? 'bg-red-100' : 'bg-gray-100'
                      }`}>
                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-7 w-7 ${selectedFormat === 'pdf' ? 'text-red-600' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <span className={`font-semibold text-sm ${
                        selectedFormat === 'pdf' ? 'text-red-700' : 'text-gray-700'
                      }`}>
                        PDF
                      </span>
                      <span className="text-xs text-gray-500">.pdf</span>
                    </div>
                  </button>

                  <button
                    onClick={() => setSelectedFormat('csv')}
                    className={`p-4 rounded-xl border-2 transition-all duration-200 ${
                      selectedFormat === 'csv'
                        ? 'bg-orange-50 border-orange-400 shadow-sm'
                        : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex flex-col items-center gap-2">
                      <div className={`w-12 h-12 rounded-lg flex items-center justify-center ${
                        selectedFormat === 'csv' ? 'bg-orange-100' : 'bg-gray-100'
                      }`}>
                        <svg xmlns="http://www.w3.org/2000/svg" className={`h-7 w-7 ${selectedFormat === 'csv' ? 'text-brand-primary' : 'text-gray-500'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                        </svg>
                      </div>
                      <span className={`font-semibold text-sm ${
                        selectedFormat === 'csv' ? 'text-orange-700' : 'text-gray-700'
                      }`}>
                        CSV
                      </span>
                      <span className="text-xs text-gray-500">.csv</span>
                    </div>
                  </button>
                </div>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 bg-gray-50 border-t border-gray-200">
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={closeModal}
                  className="px-6 py-3 bg-gray-200 hover:bg-gray-300 text-gray-700 rounded-xl font-semibold transition-all duration-200 transform hover:scale-105"
                >
                  ยกเลิก
                </button>
                <button
                  onClick={handlePreview}
                  className="px-6 py-3 bg-brand-primary  hover: text-white rounded-xl shadow-sm hover:shadow-sm font-semibold transition-all duration-200 transform hover:scale-105 flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                  ดูตัวอย่าง
                </button>
                <button
                  onClick={handleDownload}
                  className="px-6 py-3 bg-brand-primary  hover: text-white rounded-xl shadow-sm hover:shadow-sm font-semibold transition-all duration-200 transform hover:scale-105 flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                  </svg>
                  ดาวน์โหลด {selectedFormat.toUpperCase()}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Preview Modal */}
      {showPreview && previewData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm">
          <div className="w-full max-w-6xl bg-white rounded-2xl shadow-sm overflow-hidden max-h-[90vh] flex flex-col">
            {/* Preview Header */}
            <div className="p-6 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-2xl font-semibold text-gray-900">
                    ตัวอย่างข้อมูล - {selectedFormat.toUpperCase()}
                  </h2>
                  <p className="text-sm text-gray-500 mt-1">
                    แสดง {previewData.length} รายการ • {startDate} ถึง {endDate}
                  </p>
                </div>
                <button
                  onClick={closePreview}
                  className="w-10 h-10 bg-gray-100 hover:bg-gray-200 rounded-lg flex items-center justify-center text-gray-600 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>

            {/* Preview Body - Table View with Horizontal Scroll */}
            <div className="flex-1 overflow-y-auto p-6">
              {/* Scroll Hint */}
              <div className="mb-3 flex items-center gap-2 text-sm text-gray-600 bg-blue-50 px-4 py-2 rounded-lg border border-blue-200">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>เลื่อนซ้าย-ขวาเพื่อดูข้อมูลทั้งหมด</span>
              </div>

              {/* Table with Horizontal Scroll */}
              <div className="border border-gray-200 rounded-lg overflow-x-auto overflow-y-visible">
                <div className="inline-block min-w-full align-middle">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gradient-to-r from-orange-500 to-orange-600 sticky top-0 z-10">
                      <tr>
                        {Object.keys(previewData[0]).map((header, index) => (
                          <th
                            key={index}
                            className="px-4 py-3 text-left text-xs font-semibold text-white uppercase tracking-wider whitespace-nowrap"
                          >
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {previewData.map((row, rowIndex) => (
                        <tr key={rowIndex} className={`hover:bg-orange-50 transition-colors ${rowIndex % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                          {Object.entries(row).map(([, value], colIndex) => {
                            // Check if value contains status keywords
                            const statusKeywords = ['ตรงเวลา', 'มาสาย', 'ขาดงาน', 'ลางาน', 'อยู่ในพื้นที่', 'อยู่นอกพื้นที่', 'ทำงานอยู่', 'ออกจากงาน', 'มี', 'ไม่มี'];
                            const isStatus = statusKeywords.includes(value);

                            return (
                              <td
                                key={colIndex}
                                className="px-4 py-3 text-sm whitespace-nowrap"
                              >
                                {isStatus ? (
                                  <StatusText status={value} />
                                ) : (
                                  <span className="text-gray-900">{value}</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Statistics Summary */}
              {previewData && previewData.length > 0 && (() => {
                const stats = calculateStatistics(previewData);
                return (
                  <div className="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
                      <div className="text-sm text-blue-600 font-medium mb-1">จำนวนพนักงาน</div>
                      <div className="text-2xl font-bold text-blue-900">{stats.totalEmployees}</div>
                    </div>
                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
                      <div className="text-sm text-purple-600 font-medium mb-1">จำนวนแผนก</div>
                      <div className="text-2xl font-bold text-purple-900">{stats.totalDepartments}</div>
                    </div>
                    <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-lg border border-orange-200">
                      <div className="text-sm text-orange-600 font-medium mb-1">เปอร์เซ็นต์มาตรงเวลา</div>
                      <div className="text-2xl font-bold text-orange-900">{stats.avgAttendanceRate}%</div>
                    </div>
                  </div>
                );
              })()}

              {/* Format-specific preview info */}
              <div className="mt-6 p-4 bg-gray-50 rounded-lg border border-gray-200">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-orange-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="flex-1">
                    <h4 className="font-semibold text-gray-900 text-sm mb-1">
                      รูปแบบไฟล์: {selectedFormat.toUpperCase()}
                    </h4>
                    <p className="text-xs text-gray-600">
                      {selectedFormat === 'excel' && 'ไฟล์ Excel (.xlsx) สามารถเปิดด้วย Microsoft Excel, Google Sheets หรือโปรแกรมแผ่นงานอื่นๆ แนะนำสำหรับข้อมูลจำนวนมาก'}
                      {selectedFormat === 'pdf' && (
                        <>
                          ไฟล์ PDF (.pdf) เหมาะสำหรับการพิมพ์และแชร์ สามารถเปิดด้วย Adobe Reader หรือโปรแกรมอ่าน PDF อื่นๆ
                          <span className="block mt-1 text-orange-600 font-medium">
                            ⚠️ หมายเหตุ: เนื่องจากข้อมูลมีจำนวนคอลัมน์มาก ตัวอักษรใน PDF จะมีขนาดเล็ก (7-8px) เพื่อให้แสดงข้อมูลครบทั้งหมด หากต้องการดูข้อมูลละเอียด แนะนำให้ใช้ไฟล์ Excel แทน
                          </span>
                        </>
                      )}
                      {selectedFormat === 'csv' && 'ไฟล์ CSV (.csv) เป็นรูปแบบข้อมูลธรรมดา สามารถนำเข้าระบบอื่นได้ง่าย เปิดด้วย Excel หรือ Google Sheets'}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Preview Footer */}
            <div className="p-6 bg-gray-50 border-t border-gray-200">
              <div className="flex items-center justify-end gap-3">
                <button
                  onClick={closePreview}
                  className="px-4 py-2 bg-white hover:bg-gray-50 text-gray-700 rounded-lg font-medium border border-gray-300 transition-colors text-sm"
                >
                  ปิด
                </button>
                <button
                  onClick={() => {
                    closePreview();
                    handleDownload();
                  }}
                  className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg font-medium transition-colors text-sm flex items-center gap-2"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
                  </svg>
                  ดาวน์โหลดเลย
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Alert Dialog */}
      <AlertDialog
        isOpen={alertDialog.isOpen}
        onClose={closeAlertDialog}
        type={alertDialog.type}
        title={alertDialog.title}
        message={alertDialog.message}
        autoClose={alertDialog.autoClose}
      />
    </div>
  );
}

export default DownloadData;
