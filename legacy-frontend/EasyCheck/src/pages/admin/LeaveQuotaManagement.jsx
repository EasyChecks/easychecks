import React, { useState, useEffect } from 'react';
import { useLeave } from '../../contexts/LeaveContext';
import { usersData } from '../../data/usersData';
import { useAuth } from '../../contexts/useAuth';
import { useNavigate } from 'react-router-dom';

// หน้าจัดการโควต้าการลา - สำหรับ HR Admin และ Super Admin
// ใช้ตั้งค่าจำนวนวันลาและเงื่อนไขการลาสำหรับพนักงาน (ทั้งแบบทั่วไปและรายบุคคล)
function LeaveQuotaManagement() {
  const { leaveQuota } = useLeave(); // ดึงข้อมูลโควต้าการลาจาก Context
  const { user } = useAuth(); // ดึงข้อมูลผู้ใช้งานที่ล็อกอินอยู่
  const navigate = useNavigate(); // ใช้สำหรับเปลี่ยนหน้า

  // ตรวจสอบสิทธิ์การเข้าถึง - ต้องเป็น HR Admin หรือ Super Admin เท่านั้น
  useEffect(() => {
    if (!user) {
      navigate('/auth'); // ถ้ายังไม่ล็อกอิน ส่งไปหน้า login
      return;
    }
    
    // เช็คว่าเป็น HR Admin (admin/superadmin ที่อยู่แผนก HR) หรือ Super Admin
    const isHRAdmin = (user.role === 'admin' || user.role === 'superadmin') && 
                      user.department === 'HR';
    const isSuperAdmin = user.role === 'superadmin';
    
    // ถ้าไม่ใช่ HR Admin และไม่ใช่ Super Admin ไม่ให้เข้า
    if (!isHRAdmin && !isSuperAdmin) {
      alert('คุณไม่มีสิทธิ์เข้าถึงหน้านี้\nเฉพาะ HR Admin หรือ Super Admin เท่านั้น');
      navigate('/admin/dashboard'); // ส่งกลับไปหน้า dashboard
    }
  }, [user, navigate]);
  
  // === State สำหรับควบคุมหน้าจอ ===
  const [activeTab, setActiveTab] = useState('global'); // แท็บที่เลือก: 'global' (โควต้าทั่วไป) หรือ 'individual' (รายบุคคล)
  const [selectedUser, setSelectedUser] = useState(null); // พนักงานที่เลือก (ใช้ในแท็บรายบุคคล)
  const [searchQuery, setSearchQuery] = useState(''); // คำค้นหาพนักงาน
  const [filterDepartment, setFilterDepartment] = useState(''); // กรองตามแผนก
  const [filterBranch, setFilterBranch] = useState(''); // กรองตามสาขา (สำหรับ Super Admin)
  const [isDropdownOpen, setIsDropdownOpen] = useState(false); // เปิด/ปิด dropdown รายชื่อพนักงาน
  
  // โควต้าทั่วไป - ใช้กับทุกคน (เก็บใน localStorage)
  const [quotaSettings, setQuotaSettings] = useState(() => {
    const saved = localStorage.getItem('leaveQuotaSettings');
    // ถ้ามีข้อมูลใน localStorage ให้ใช้ ถ้าไม่มีใช้ค่าเริ่มต้น
    return saved ? JSON.parse(saved) : {
      'ลาป่วย': { totalDays: 60, requireDocument: true, documentAfterDays: 3 },
      'ลากิจ': { totalDays: 45, requireDocument: false, documentAfterDays: 0 },
      'ลาพักร้อน': { totalDays: 10, requireDocument: false, documentAfterDays: 0 },
      'ลาคลอด': { totalDays: 90, requireDocument: false, documentAfterDays: 0 },
      'ลาเพื่อทำหมัน': { totalDays: 30, requireDocument: true, documentAfterDays: 0 },
      'ลาเพื่อรับราชการทหาร': { totalDays: 60, requireDocument: true, documentAfterDays: 0 },
      'ลาเพื่อฝึกอบรม': { totalDays: 30, requireDocument: false, documentAfterDays: 0 },
      'ลาไม่รับค่าจ้าง': { totalDays: 90, requireDocument: false, documentAfterDays: 0 }
    };
  });

  // โควต้าพิเศษรายบุคคล - เก็บโควต้าพิเศษของพนักงานแต่ละคน (key = userId)
  const [individualQuotas, setIndividualQuotas] = useState(() => {
    const saved = localStorage.getItem('individualLeaveQuotas');
    return saved ? JSON.parse(saved) : {}; // เริ่มต้นเป็น object ว่าง
  });

  // === State สำหรับ Modal แก้ไข ===
  const [editingType, setEditingType] = useState(null); // ประเภทการลาที่กำลังแก้ไข (null = ไม่เปิด modal)
  const [editForm, setEditForm] = useState({
    totalDays: 0, // จำนวนวันลา
    requireDocument: false, // บังคับแนบเอกสารหรือไม่
    documentAfterDays: 0 // แนบเอกสารเมื่อลากี่วันขึ้นไป (0 = แนบทุกครั้ง)
  });

  // === State สำหรับ Dialog แจ้งเตือน ===
  const [showSuccessDialog, setShowSuccessDialog] = useState(false); // เปิด/ปิด dialog
  const [successMessage, setSuccessMessage] = useState(''); // ข้อความที่แสดงใน dialog

  // บันทึกโควต้าทั่วไปลง localStorage ทุกครั้งที่มีการเปลี่ยนแปลง
  useEffect(() => {
    localStorage.setItem('leaveQuotaSettings', JSON.stringify(quotaSettings));
  }, [quotaSettings]);

  // บันทึกโควต้ารายบุคคลลง localStorage ทุกครั้งที่มีการเปลี่ยนแปลง
  useEffect(() => {
    localStorage.setItem('individualLeaveQuotas', JSON.stringify(individualQuotas));
  }, [individualQuotas]);

  // เปิด Modal แก้ไข - โหลดค่าปัจจุบันเข้าฟอร์ม
  const handleEdit = (leaveType) => {
    setEditingType(leaveType); // เก็บว่ากำลังแก้ไขประเภทไหน
    // ถ้าอยู่แท็บทั่วไป ใช้ค่าจาก quotaSettings
    // ถ้าอยู่แท็บรายบุคคล ใช้ค่าพิเศษของคนนั้น (ถ้าไม่มีก็ใช้ค่าทั่วไป)
    const currentSettings = activeTab === 'global' 
      ? quotaSettings[leaveType]
      : (individualQuotas[selectedUser?.id]?.[leaveType] || quotaSettings[leaveType]);
    
    setEditForm(currentSettings); // โหลดค่าปัจจุบันเข้าฟอร์ม
  };

  // ปิด Modal และล้างฟอร์ม
  const handleCancel = () => {
    setEditingType(null); // ปิด modal
    setEditForm({ totalDays: 0, requireDocument: false, documentAfterDays: 0 }); // รีเซ็ตฟอร์ม
  };

  // บันทึกการแก้ไขโควต้า
  const handleSave = () => {
    if (activeTab === 'global') {
      // บันทึกโควต้าทั่วไป (ใช้กับทุกคน)
      setQuotaSettings(prev => ({
        ...prev,
        [editingType]: {
          totalDays: editForm.totalDays === '' ? 0 : parseInt(editForm.totalDays),
          requireDocument: editForm.requireDocument,
          documentAfterDays: editForm.documentAfterDays === '' ? 0 : parseInt(editForm.documentAfterDays)
        }
      }));
      setSuccessMessage(`บันทึกการตั้งค่า "${editingType}" สำหรับทุกคนเรียบร้อยแล้ว`);
    } else {
      // บันทึกโควต้าพิเศษรายบุคคล
      setIndividualQuotas(prev => ({
        ...prev,
        [selectedUser.id]: {
          ...prev[selectedUser.id], // เก็บโควต้าเดิมของคนนี้
          [editingType]: {
            totalDays: editForm.totalDays === '' ? 0 : parseInt(editForm.totalDays),
            requireDocument: editForm.requireDocument,
            documentAfterDays: editForm.documentAfterDays === '' ? 0 : parseInt(editForm.documentAfterDays)
          }
        }
      }));
      setSuccessMessage(`บันทึกการตั้งค่า "${editingType}" สำหรับ ${selectedUser.name} เรียบร้อยแล้ว`);
    }
    
    // ส่งสัญญาณแจ้ง Context ว่ามีการเปลี่ยนแปลงโควต้า
    window.dispatchEvent(new Event('leaveQuotaUpdated'));
    setShowSuccessDialog(true); // แสดง dialog สำเร็จ
    setEditingType(null); // ปิด modal
    setTimeout(() => setShowSuccessDialog(false), 2000); // ปิด dialog อัตโนมัติหลัง 2 วินาที
  };

  // รีเซ็ตโควต้าพิเศษกลับไปใช้ค่าทั่วไป
  const handleResetToGlobal = (leaveType) => {
    if (!selectedUser) return; // ป้องกันกรณีไม่ได้เลือกพนักงาน
    
    setIndividualQuotas(prev => {
      const newQuotas = { ...prev };
      if (newQuotas[selectedUser.id]) {
        delete newQuotas[selectedUser.id][leaveType]; // ลบโควต้าพิเศษของประเภทนี้
        // ถ้าลบหมดแล้ว ลบ userId ทิ้งด้วย
        if (Object.keys(newQuotas[selectedUser.id]).length === 0) {
          delete newQuotas[selectedUser.id];
        }
      }
      return newQuotas;
    });
    
    setSuccessMessage(`รีเซ็ตโควต้า "${leaveType}" ของ ${selectedUser.name} กลับไปใช้ค่าเริ่มต้นแล้ว`);
    setShowSuccessDialog(true);
    setTimeout(() => setShowSuccessDialog(false), 2000);
  };

  // ดึงโควต้าที่จะแสดงในการ์ด (ถ้ามีโควต้าพิเศษก็แสดงพิเศษ ไม่มีก็แสดงทั่วไป)
  const getDisplayQuota = (leaveType) => {
    if (activeTab === 'individual' && selectedUser) {
      // ถ้ามีโควต้าพิเศษของคนนี้ ให้แสดงพิเศษ ไม่มีให้แสดงทั่วไป
      return individualQuotas[selectedUser.id]?.[leaveType] || quotaSettings[leaveType];
    }
    return quotaSettings[leaveType]; // แท็บทั่วไปแสดงค่าทั่วไป
  };

  // เช็คว่ามีโควต้าพิเศษหรือไม่ (ใช้แสดง badge "พิเศษ")
  const hasCustomQuota = (leaveType) => {
    return activeTab === 'individual' && selectedUser && individualQuotas[selectedUser.id]?.[leaveType];
  };

  // กรองและค้นหาพนักงานตามเงื่อนไขต่างๆ
  const getFilteredUsers = () => {
    let filtered = [];
    
    // กรองตามสิทธิ์ของผู้ใช้ที่ล็อกอินอยู่
    if (user.role === 'superadmin') {
      // Super Admin เห็นทุกคนยกเว้นตัวเอง (จัดการได้ทั้ง admin, manager, user)
      filtered = usersData.filter(u => u.id !== user.id);
    } else if (user.role === 'admin' && user.department === 'HR') {
      // HR Admin จัดการได้เฉพาะ user และ manager ในสาขาเดียวกัน
      filtered = usersData.filter(u => 
        (u.role === 'user' || u.role === 'manager') && 
        u.provinceCode === user.provinceCode
      );
    }
    
    // กรองตามสาขา (dropdown) - เฉพาะ Super Admin
    if (user.role === 'superadmin' && filterBranch) {
      filtered = filtered.filter(u => u.provinceCode === filterBranch);
    }
    
    // กรองตามแผนก (dropdown)
    if (filterDepartment) {
      filtered = filtered.filter(u => u.department === filterDepartment);
    }
    
    // ค้นหาตามชื่อหรือรหัสพนักงาน (search box)
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(u => 
        u.name.toLowerCase().includes(query) || 
        u.employeeId.toLowerCase().includes(query)
      );
    }
    
    return filtered;
  };

  // ดึงรายชื่อแผนกและสาขาทั้งหมดไว้ใช้ใน dropdown
  const departments = [...new Set(usersData.map(u => u.department))].filter(Boolean); // ลบค่าซ้ำและค่าว่าง
  const branches = [...new Set(usersData.map(u => u.provinceCode))].filter(Boolean).sort(); // เรียงตาม A-Z
  
  // แปลง provinceCode เป็นชื่อจังหวัดที่อ่านง่าย
  const branchNames = {
    'BKK': 'กรุงเทพมหานคร',
    'CNX': 'เชียงใหม่',
    'PKT': 'ภูเก็ต'
  };

  // === Handler Functions สำหรับจัดการพนักงาน ===
  
  // เลือกพนักงานจาก dropdown
  const handleSelectUser = (user) => {
    setSelectedUser(user); // เก็บพนักงานที่เลือก
    setSearchQuery(user ? `${user.name} (${user.employeeId})` : ''); // แสดงชื่อใน search box
    setIsDropdownOpen(false); // ปิด dropdown
  };

  // คลิกที่ search box - เปิด dropdown
  const handleSearchFocus = () => {
    setIsDropdownOpen(true);
  };

  // พิมพ์ค้นหาในช่อง search
  const handleSearchChange = (e) => {
    setSearchQuery(e.target.value);
    setIsDropdownOpen(true); // เปิด dropdown ให้เห็นผลการค้นหา
    if (!e.target.value) {
      setSelectedUser(null); // ถ้าลบข้อความหมด ยกเลิกการเลือก
    }
  };

  // กดปุ่ม X เคลียร์ search
  const handleClearSearch = () => {
    setSearchQuery('');
    setSelectedUser(null);
    setIsDropdownOpen(false);
  };

  // คำอธิบายแต่ละประเภทการลา (แสดงใต้ชื่อในการ์ด)
  const getDescription = (type) => {
    const descriptions = {
      'ลาป่วย': 'ลาเนื่องจากเจ็บป่วย สามารถใช้สิทธิ์ได้ตามจำนวนวันที่กำหนด',
      'ลากิจ': 'ลาเพื่อธุระส่วนตัว ปีแรก 15 วัน ปีถัดไป 45 วัน',
      'ลาพักร้อน': 'ลาพักผ่อนประจำปี สะสมได้ไม่เกิน 20 วัน',
      'ลาคลอด': 'ลาเพื่อคลอดบุตร สำหรับพนักงานหญิง',
      'ลาเพื่อทำหมัน': 'ลาเพื่อทำหมัน ตามระยะเวลาที่แพทย์กำหนด',
      'ลาเพื่อรับราชการทหาร': 'ลาเพื่อเรียกพล ฝึกวิชาทหาร หรือทดสอบความพร้อม',
      'ลาเพื่อฝึกอบรม': 'ลาเพื่อฝึกอบรมหรือพัฒนาความรู้ความสามารถ',
      'ลาไม่รับค่าจ้าง': 'ลาเพื่อธุระส่วนตัว ติดตามคู่สมรส หรือพักฟื้น'
    };
    return descriptions[type] || '';
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4">
      {/* Header */}
      <div className="bg-gradient-to-r from-brand-primary to-orange-600 shadow-lg rounded-xl p-6 mb-5">
        <div className="flex items-center justify-between text-white">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg">
              <svg xmlns="http://www.w3.org/2000/svg" height="32px" viewBox="0 -960 960 960" width="32px" fill="white">
                <path d="M320-240h320v-80H320v80Zm0-160h320v-80H320v80ZM240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h320l240 240v480q0 33-23.5 56.5T720-80H240Zm280-520v-200H240v640h480v-440H520Z"/>
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold mb-1">จัดการโควต้าการลา</h1>
              <p className="text-white/90 text-sm">ตั้งค่าจำนวนวันลาและเงื่อนไขการลาสำหรับพนักงาน</p>
            </div>
          </div>  
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="bg-white rounded-xl shadow-md p-2 mb-5 flex gap-2">
        <button
          onClick={() => {
            setActiveTab('global');
            setSelectedUser(null);
          }}
          className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all ${
            activeTab === 'global'
              ? 'bg-brand-primary text-white shadow-md'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="currentColor">
              <path d="M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z"/>
            </svg>
            <span>โควต้าทั่วไป</span>
          </div>
        </button>
        <button
          onClick={() => setActiveTab('individual')}
          className={`flex-1 px-6 py-3 rounded-lg font-semibold transition-all ${
            activeTab === 'individual'
              ? 'bg-brand-primary text-white shadow-md'
              : 'text-gray-700 hover:bg-gray-100'
          }`}
        >
          <div className="flex items-center justify-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="currentColor">
              <path d="M480-480q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47ZM160-160v-112q0-34 17.5-62.5T224-378q62-31 126-46.5T480-440q66 0 130 15.5T736-378q29 15 46.5 43.5T800-272v112H160Z"/>
            </svg>
            <span>รายบุคคล</span>
          </div>
        </button>
      </div>

      {/* Individual User Selector */}
      {activeTab === 'individual' && (
        <div className="bg-white rounded-xl shadow-md p-5 mb-5">
          <label className="block text-sm font-bold text-gray-700 mb-3">
            ค้นหาและเลือกพนักงาน
          </label>
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
            {/* Search Combobox */}
            <div className={`${user?.role === 'superadmin' ? 'md:col-span-2' : 'md:col-span-3'} relative`}>
              <div className="relative">
                <input
                  type="text"
                  placeholder="คลิกเพื่อดูรายชื่อ หรือพิมพ์เพื่อค้นหา..."
                  value={searchQuery}
                  onChange={handleSearchChange}
                  onFocus={handleSearchFocus}
                  className="w-full pl-10 pr-10 py-3 text-base border-2 border-gray-300 rounded-lg focus:border-brand-primary focus:ring-2 focus:ring-orange-200 outline-none transition-all"
                />
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {searchQuery && (
                  <button
                    onClick={handleClearSearch}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 transition-colors"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Dropdown List */}
              {isDropdownOpen && (
                <>
                  {/* Backdrop */}
                  <div 
                    className="fixed inset-0 z-10"
                    onClick={() => setIsDropdownOpen(false)}
                  />
                  
                  {/* Dropdown Menu */}
                  <div className="absolute z-20 w-full mt-2 bg-white border-2 border-gray-200 rounded-lg shadow-xl max-h-80 overflow-y-auto">
                    {getFilteredUsers().length > 0 ? (
                      <>
                        <div className="sticky top-0 bg-gray-50 px-4 py-2 border-b border-gray-200">
                          <p className="text-xs text-gray-600 font-semibold">
                            พบ {getFilteredUsers().length} คน
                            {filterBranch && ` • ${branchNames[filterBranch] || filterBranch}`}
                            {filterDepartment && ` • แผนก ${filterDepartment}`}
                            {!filterBranch && !filterDepartment && user?.role === 'admin' && ` • ${branchNames[user.provinceCode] || user.provinceCode}`}
                          </p>
                        </div>
                        {getFilteredUsers().map(user => (
                          <button
                            key={user.id}
                            onClick={() => handleSelectUser(user)}
                            className={`w-full px-4 py-3 text-left hover:bg-orange-50 transition-colors border-b border-gray-100 last:border-0 ${
                              selectedUser?.id === user.id ? 'bg-orange-100' : ''
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <div>
                                <p className="font-semibold text-gray-800">
                                  {user.name}
                                </p>
                                <p className="text-sm text-gray-500">
                                  {user.employeeId} - {user.department}
                                  {user.provinceCode && ` (${branchNames[user.provinceCode] || user.provinceCode})`}
                                </p>
                              </div>
                              {selectedUser?.id === user.id && (
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-brand-primary" viewBox="0 0 20 20" fill="currentColor">
                                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                </svg>
                              )}
                            </div>
                          </button>
                        ))}
                      </>
                    ) : (
                      <div className="px-4 py-8 text-center">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto text-gray-300 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                        </svg>
                        <p className="text-gray-500 text-sm">ไม่พบพนักงาน</p>
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Branch Filter - เฉพาะ Super Admin */}
            {user?.role === 'superadmin' && (
              <div className="relative">
                <select
                  value={filterBranch}
                  onChange={(e) => setFilterBranch(e.target.value)}
                  className="w-full px-4 py-3 text-base border-2 border-gray-300 rounded-lg focus:border-brand-primary focus:ring-2 focus:ring-orange-200 outline-none transition-all appearance-none bg-white"
                >
                  <option value="">สาขา: ทั้งหมด</option>
                  {branches.map(branch => (
                    <option key={branch} value={branch}>
                      {branch} ({branchNames[branch]})
                    </option>
                  ))}
                </select>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </div>
            )}

            {/* Department Filter */}
            <div className="relative">
              <select
                value={filterDepartment}
                onChange={(e) => setFilterDepartment(e.target.value)}
                className="w-full px-4 py-3 text-base border-2 border-gray-300 rounded-lg focus:border-brand-primary focus:ring-2 focus:ring-orange-200 outline-none transition-all appearance-none bg-white"
              >
                <option value="">ทุกแผนก</option>
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
              </svg>
            </div>
          </div>
          
          {selectedUser && Object.keys(individualQuotas[selectedUser.id] || {}).length > 0 && (
            <div className="mt-4 p-4 bg-orange-50 border-l-4 border-brand-primary rounded-lg">
              <div className="flex items-center gap-3">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-sm font-semibold text-gray-800">
                  มีโควต้าพิเศษ {Object.keys(individualQuotas[selectedUser.id]).length} ประเภท
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Leave Type Cards */}
      {(activeTab === 'global' || (activeTab === 'individual' && selectedUser)) && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.keys(quotaSettings).map((leaveType) => {
            const quota = getDisplayQuota(leaveType);
            const isCustom = hasCustomQuota(leaveType);
            
            return (
              <div
                key={leaveType}
                className={`relative bg-white border-2 rounded-xl shadow-md hover:shadow-xl transition-all overflow-hidden ${
                  isCustom ? 'ring-2 ring-brand-primary ring-offset-2' : 'border-gray-200'
                }`}
              >
                {isCustom && (
                  <div className="absolute top-0 right-0 bg-brand-primary text-white text-xs font-bold px-3 py-1 rounded-bl-lg shadow-md">
                    พิเศษ
                  </div>
                )}

                <div className="p-4 border-b-2 border-gray-100 bg-gradient-to-br from-gray-50 to-white">
                  <h3 className="text-lg font-bold text-gray-800 mb-1">{leaveType}</h3>
                  <p className="text-xs text-gray-600 line-clamp-2">{getDescription(leaveType)}</p>
                </div>

                <div className="p-4 space-y-3">
                  <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg p-3 border border-orange-200">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-700">วันลาต่อปี</span>
                      <span className="text-2xl font-bold text-brand-primary">
                        {quota.totalDays}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <div className={`w-8 h-8 ${quota.requireDocument ? 'bg-brand-primary' : 'bg-gray-400'} rounded-lg flex items-center justify-center flex-shrink-0 shadow-sm`}>
                      <svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill="white">
                        <path d="M319-250h322v-60H319v60Zm0-170h322v-60H319v60ZM220-80q-24 0-42-18t-18-42v-680q0-24 18-42t42-18h361l219 219v521q0 24-18 42t-42 18H220Z"/>
                      </svg>
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-gray-800">
                        {quota.requireDocument ? (
                          quota.documentAfterDays > 0 
                            ? `แนบเมื่อลา ${quota.documentAfterDays} วันขึ้นไป`
                            : 'แนบทุกครั้ง'
                        ) : (
                          'ไม่บังคับ'
                        )}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-3 bg-gray-50 border-t-2 border-gray-100 flex gap-2">
                  <button
                    onClick={() => handleEdit(leaveType)}
                    className="flex-1 bg-brand-primary hover:bg-orange-600 text-white font-semibold py-2.5 text-sm rounded-lg transition-all shadow-md hover:shadow-lg flex items-center justify-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" height="18px" viewBox="0 -960 960 960" width="18px" fill="white">
                      <path d="M200-200h57l391-391-57-57-391 391v57Zm-80 80v-170l528-527q12-11 26.5-17t30.5-6q16 0 31 6t26 18l55 56q12 11 17.5 26t5.5 30q0 16-5.5 30.5T817-647L290-120H120Z"/>
                    </svg>
                    <span>แก้ไข</span>
                  </button>
                  
                  {isCustom && (
                    <button
                      onClick={() => handleResetToGlobal(leaveType)}
                      className="px-3 bg-white hover:bg-gray-100 text-gray-700 font-semibold py-2.5 rounded-lg transition-all shadow-md hover:shadow-lg border-2 border-gray-300"
                      title="รีเซ็ตกลับไปใช้ค่าทั่วไป"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" height="18px" viewBox="0 -960 960 960" width="18px" fill="currentColor">
                        <path d="M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 132 28.5T720-690v-110h80v280H520v-80h168q-32-56-87.5-88T480-720q-100 0-170 70t-70 170q0 100 70 170t170 70q77 0 139-44t87-116h84q-28 106-114 173t-196 67Z"/>
                      </svg>
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {activeTab === 'individual' && !selectedUser && (
        <div className="bg-white border-2 border-dashed border-gray-300 rounded-xl p-12 text-center">
          <div className="w-20 h-20 bg-gradient-to-br from-gray-100 to-gray-200 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
            <svg xmlns="http://www.w3.org/2000/svg" height="40px" viewBox="0 -960 960 960" width="40px" fill="#9ca3af">
              <path d="M480-480q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47ZM160-160v-112q0-34 17.5-62.5T224-378q62-31 126-46.5T480-440q66 0 130 15.5T736-378q29 15 46.5 43.5T800-272v112H160Z"/>
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-700 mb-2">เลือกพนักงาน</h3>
          <p className="text-sm text-gray-500">กรุณาเลือกพนักงานที่ต้องการตั้งค่าโควต้าพิเศษ</p>
        </div>
      )}

      {/* Edit Modal */}
      {editingType && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-2xl w-full overflow-hidden max-h-[90vh] flex flex-col">
            <div className="bg-gradient-to-r from-brand-primary to-orange-600 text-white px-6 py-5">
              <h2 className="text-xl font-bold mb-1">แก้ไขโควต้าการลา</h2>
              <p className="text-white/90 text-sm">
                {editingType}
                {activeTab === 'individual' && selectedUser && (
                  <span className="ml-2 bg-white/20 px-2 py-1 rounded text-xs">
                    {selectedUser.name}
                  </span>
                )}
              </p>
            </div>

            <div className="p-6 space-y-5 overflow-y-auto flex-1">
              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">
                  จำนวนวันลาต่อปี <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="number"
                    min="0"
                    max="365"
                    value={editForm.totalDays}
                    onChange={(e) => {
                      const val = e.target.value;
                      setEditForm({ ...editForm, totalDays: val === '' ? '' : parseInt(val) || 0 });
                    }}
                    className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:border-brand-primary focus:ring-2 focus:ring-orange-200 outline-none"
                    placeholder="กรอกจำนวนวัน (สูงสุด 365 วัน)"
                  />
                  <div className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 text-sm font-medium">
                    วัน
                  </div>
                </div>
              </div>

              <div className="border-2 border-gray-200 rounded-xl p-4 bg-gray-50">
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editForm.requireDocument}
                    onChange={(e) => setEditForm({ ...editForm, requireDocument: e.target.checked })}
                    className="w-5 h-5 text-brand-primary border-gray-300 rounded focus:ring-brand-primary cursor-pointer mt-0.5"
                  />
                  <div className="flex-1">
                    <span className="text-sm font-bold text-gray-800">
                      ต้องแนบเอกสาร/ใบรับรอง
                    </span>
                    <p className="text-xs text-gray-600 mt-1">
                      เช่น ใบรับรองแพทย์ หนังสือเรียกตัว ฯลฯ
                    </p>
                  </div>
                </label>
              </div>

              {editForm.requireDocument && (
                <div className="bg-orange-50 border-2 border-orange-200 rounded-xl p-4">
                  <label className="block text-sm font-bold text-gray-800 mb-3">
                    แนบเอกสารเมื่อลาตั้งแต่กี่วัน?
                  </label>
                  <div className="relative">
                    <input
                      type="number"
                      min="0"
                      value={editForm.documentAfterDays}
                      onChange={(e) => {
                        const val = e.target.value;
                        setEditForm({ ...editForm, documentAfterDays: val === '' ? '' : parseInt(val) || 0 });
                      }}
                      className="w-full px-4 py-3 text-lg border-2 border-orange-300 rounded-lg focus:border-brand-primary focus:ring-2 focus:ring-orange-200 outline-none bg-white"
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

            <div className="px-6 py-4 bg-gray-50 border-t-2 flex gap-3">
              <button
                onClick={handleCancel}
                className="flex-1 px-5 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-lg text-base font-semibold hover:bg-gray-100 transition-all shadow-sm"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSave}
                className="flex-1 px-5 py-3 bg-brand-primary hover:bg-orange-600 text-white rounded-lg text-base font-semibold transition-all shadow-md hover:shadow-lg"
              >
                บันทึก
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Success Dialog */}
      {showSuccessDialog && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full overflow-hidden animate-bounce-in">
            <div className="p-8 text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 shadow-inner">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-800 mb-2">สำเร็จ</h3>
              <p className="text-sm text-gray-600">{successMessage}</p>
            </div>
            <div className="px-6 pb-6">
              <button
                onClick={() => setShowSuccessDialog(false)}
                className="w-full px-5 py-3 bg-brand-primary hover:bg-orange-600 text-white text-base font-semibold rounded-lg transition-all shadow-md hover:shadow-lg"
              >
                ตกลง
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LeaveQuotaManagement;
