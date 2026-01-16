import React, { useState, memo, useEffect } from 'react';
import ProfileManager from './ProfileManager';

/**
 * UserCreateModal - Modal สำหรับเพิ่มผู้ใช้ใหม่ทีละคน
 * ใช้ร่วมกับ AdminManageUser เพื่อสร้างผู้ใช้ใหม่
 * Optimized with React.memo to prevent unnecessary re-renders
 */
const UserCreateModal = memo(function UserCreateModal({ 
  isOpen, 
  onClose, 
  onSubmit, 
  generateEmployeeId, 
  users 
}) {
  const [formData, setFormData] = useState({
    titlePrefix: 'นาย', // เพิ่ม title prefix
    name: '',
    email: '',
    phone: '',
    department: '',
    role: 'user',
    position: '',
    nationalId: '',
    provinceCode: '',
    branchCode: '',
    birthDate: '',
    address: '',
    bloodType: '',
    age: '',
    salary: '',
    status: 'active',
    startDate: '', // วันที่เริ่มงาน
    // ข้อมูลผู้ติดต่อฉุกเฉิน
    emergencyContactName: '',
    emergencyContactPhone: '',
    emergencyContactRelation: '',
    // ประวัติการทำงาน
    workHistory: [],
    // 🆕 Profile Management - 6 categories
    positions: [], // ตำแหน่ง
    departments: [], // แผนก
    salaries: [], // เงินเดือน
    relationships: [], // ความสัมพันธ์
    educations: [], // การศึกษา
    skills: [], // ทักษะ
    // 🆕 ข้อมูลสวัสดิการ (Benefits) - เพิ่มใหม่ตาม Bug #7
    socialSecurityNumber: '', // เลขประกันสังคม
    providentFund: '', // กองทุนสำรองเลี้ยงชีพ
    healthInsurance: '' // ประกันสุขภาพ
  });

  const [errors, setErrors] = useState({});
  const [previewEmployeeId, setPreviewEmployeeId] = useState('');
  
  // State สำหรับ dynamic fields
  const [currentWorkHistory, setCurrentWorkHistory] = useState({ position: '', company: '', period: '' });

  // 🆕 State สำหรับ editable dropdown options
  const [editableProvinces, setEditableProvinces] = useState(() => {
    const saved = localStorage.getItem('dropdown_provinces');
    return saved ? JSON.parse(saved) : [
      { code: 'BKK', name: 'กรุงเทพฯ' },
      { code: 'CNX', name: 'เชียงใหม่' },
      { code: 'PKT', name: 'ภูเก็ต' },
    ];
  });
  const [editableDepartments, setEditableDepartments] = useState(() => {
    const saved = localStorage.getItem('dropdown_departments');
    return saved ? JSON.parse(saved) : [
      'การเงิน',
      'ฝ่ายบุคคล',
      'ฝ่ายขาย',
      'ฝ่ายผลิต',
      'ฝ่ายไอที',
      'ฝ่ายการตลาด',
      'ฝ่ายบริการ'
    ];
  });
  const [editablePositions, setEditablePositions] = useState(() => {
    const saved = localStorage.getItem('dropdown_positions');
    return saved ? JSON.parse(saved) : [
      'พนักงาน',
      'หัวหน้าทีม',
      'ผู้จัดการ',
      'ผู้อำนวยการ',
      'ผู้บริหาร'
    ];
  });
  const [editableStatuses, setEditableStatuses] = useState(() => {
    const saved = localStorage.getItem('dropdown_statuses');
    return saved ? JSON.parse(saved) : [
      { value: 'active', label: 'ทำงานอยู่ (Active)' },
      { value: 'leave', label: 'ลาออกแล้ว (Leave)' },
      { value: 'suspended', label: 'โดนพักงาน (Suspended)' },
      { value: 'pending', label: 'รอโปรโมท (Pending)' }
    ];
  });

  // Input fields สำหรับเพิ่ม option ใหม่
  const [newProvince, setNewProvince] = useState({ code: '', name: '' });
  const [newDepartment, setNewDepartment] = useState('');
  const [newPosition, setNewPosition] = useState('');
  const [newStatus, setNewStatus] = useState({ value: '', label: '' });

  // ป้องกันการ scroll พื้นหลังเมื่อ modal เปิด
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [isOpen]);

  // 🆕 Persist editable options to localStorage
  useEffect(() => {
    localStorage.setItem('dropdown_provinces', JSON.stringify(editableProvinces));
  }, [editableProvinces]);

  useEffect(() => {
    localStorage.setItem('dropdown_departments', JSON.stringify(editableDepartments));
  }, [editableDepartments]);

  useEffect(() => {
    localStorage.setItem('dropdown_positions', JSON.stringify(editablePositions));
  }, [editablePositions]);

  useEffect(() => {
    localStorage.setItem('dropdown_statuses', JSON.stringify(editableStatuses));
  }, [editableStatuses]);

  // 🔄 ใช้ editable versions แทน hardcoded constants
  const provinces = editableProvinces;
  const departments = editableDepartments;
  const positions = editablePositions;

  // eslint-disable-next-line no-unused-vars
  const branches = [
    { code: '101', name: 'รหัสสาขากรุงเทพ' },
    // { code: '102', name: 'สาขาที่ 2' },
    // { code: '103', name: 'สาขาที่ 3' },
    { code: '201', name: 'รหัสสาขาเชียงใหม่' },
    { code: '301', name: 'รหัสสาขาภูเก็ต' },
  ];

  const bloodTypes = ['A', 'B', 'AB', 'O'];

  // 🆕 Functions สำหรับจัดการ dropdown options
  const addProvince = () => {
    if (newProvince.code && newProvince.name) {
      setEditableProvinces([...editableProvinces, { ...newProvince }]);
      setNewProvince({ code: '', name: '' });
    }
  };

  const removeProvince = (code) => {
    setEditableProvinces(editableProvinces.filter(p => p.code !== code));
  };

  const addDepartment = () => {
    if (newDepartment.trim() && !editableDepartments.includes(newDepartment.trim())) {
      setEditableDepartments([...editableDepartments, newDepartment.trim()]);
      setNewDepartment('');
    }
  };

  const removeDepartment = (dept) => {
    setEditableDepartments(editableDepartments.filter(d => d !== dept));
  };

  const addPosition = () => {
    if (newPosition.trim() && !editablePositions.includes(newPosition.trim())) {
      setEditablePositions([...editablePositions, newPosition.trim()]);
      setNewPosition('');
    }
  };

  const removePosition = (pos) => {
    setEditablePositions(editablePositions.filter(p => p !== pos));
  };

  const addStatus = () => {
    if (newStatus.value && newStatus.label) {
      setEditableStatuses([...editableStatuses, { ...newStatus }]);
      setNewStatus({ value: '', label: '' });
    }
  };

  const removeStatus = (value) => {
    setEditableStatuses(editableStatuses.filter(s => s.value !== value));
  };

  // Handle input change
  const handleInputChange = (field, value) => {
    setFormData(prev => ({
      ...prev,
      [field]: value
    }));

    // Clear error for this field
    if (errors[field]) {
      setErrors(prev => ({
        ...prev,
        [field]: ''
      }));
    }

    // Auto-generate preview employee ID
    if (field === 'provinceCode' || field === 'branchCode') {
      const provinceCode = field === 'provinceCode' ? value : formData.provinceCode;
      const branchCode = field === 'branchCode' ? value : formData.branchCode;
      
      if (provinceCode && branchCode) {
        const preview = generateEmployeeId(provinceCode, branchCode);
        setPreviewEmployeeId(preview);
      } else {
        setPreviewEmployeeId('');
      }
    }

    // Auto-calculate age from birthDate
    if (field === 'birthDate' && value) {
      const birthYear = new Date(value).getFullYear();
      const currentYear = new Date().getFullYear();
      const calculatedAge = currentYear - birthYear;
      setFormData(prev => ({
        ...prev,
        age: calculatedAge.toString()
      }));
    }
  };

  // Validate form
  const validateForm = () => {
    const newErrors = {};

    // Required fields
    if (!formData.name.trim()) newErrors.name = 'กรุณากรอกชื่อ นามสกุล';
    if (!formData.email.trim()) newErrors.email = 'กรุณากรอกอีเมล';
    if (!formData.phone.trim()) newErrors.phone = 'กรุณากรอกเบอร์โทรศัพท์';
    if (!formData.department) newErrors.department = 'กรุณาเลือกแผนก';
    if (!formData.position) newErrors.position = 'กรุณาเลือกตำแหน่ง';
    if (!formData.nationalId.trim()) newErrors.nationalId = 'กรุณากรอกเลขบัตรประชาชน';
    if (!formData.provinceCode) newErrors.provinceCode = 'กรุณาเลือกจังหวัด';
    if (!formData.branchCode) newErrors.branchCode = 'กรุณาเลือกรหัสสาขา';

    // Validate email format
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors.email = 'รูปแบบอีเมลไม่ถูกต้อง';
    }

    // Validate phone format (10 digits)
    if (formData.phone && !/^\d{10}$/.test(formData.phone)) {
      newErrors.phone = 'เบอร์โทรศัพท์ต้องเป็นตัวเลข 10 หลัก';
    }

    // Validate national ID format (13 digits)
    if (formData.nationalId && !/^\d{13}$/.test(formData.nationalId)) {
      newErrors.nationalId = 'เลขบัตรประชาชนต้องเป็นตัวเลข 13 หลัก';
    }

    // Check duplicates
    const employeeId = previewEmployeeId;
    
    if (users.some(u => u.email === formData.email)) {
      newErrors.email = 'อีเมลนี้มีในระบบแล้ว';
    }

    if (users.some(u => u.nationalId === formData.nationalId)) {
      newErrors.nationalId = 'เลขบัตรประชาชนนี้มีในระบบแล้ว';
    }

    if (users.some(u => u.username === employeeId || u.employeeId === employeeId)) {
      newErrors.provinceCode = 'รหัสพนักงานนี้มีในระบบแล้ว';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  // ฟังก์ชันจัดการ Work History
  const addWorkHistory = () => {
    if (currentWorkHistory.position && currentWorkHistory.company && currentWorkHistory.period) {
      setFormData({
        ...formData,
        workHistory: [...formData.workHistory, { ...currentWorkHistory }]
      });
      setCurrentWorkHistory({ position: '', company: '', period: '' });
    }
  };

  const removeWorkHistory = (index) => {
    setFormData({
      ...formData,
      workHistory: formData.workHistory.filter((_, i) => i !== index)
    });
  };

  // 🆕 ProfileManager handlers for 6 categories
  const handleAddProfile = (category, item) => {
    setFormData(prev => ({
      ...prev,
      [category]: [...prev[category], item]
    }));
  };

  const handleRemoveProfile = (category, index) => {
    setFormData(prev => ({
      ...prev,
      [category]: prev[category].filter((_, i) => i !== index)
    }));
  };

  const handleRemoveAllProfiles = (category) => {
    setFormData(prev => ({
      ...prev,
      [category]: []
    }));
  };

  // Handle submit
  const handleSubmit = () => {
    if (!validateForm()) {
      return;
    }

    // สร้างข้อมูลผู้ใช้ใหม่
    const newUser = {
      id: users.length + 1,
      name: formData.name.trim(),
      email: formData.email.trim().toLowerCase(),
      phone: formData.phone.trim(),
      department: formData.department,
      role: formData.role,
      position: formData.position,
      nationalId: formData.nationalId.trim(),
      username: previewEmployeeId, // สร้างอัตโนมัติ
      employeeId: previewEmployeeId, // สร้างอัตโนมัติ
      password: formData.nationalId.trim(), // รหัสผ่านเริ่มต้นเป็นเลขบัตรประชาชน
      provinceCode: formData.provinceCode,
      branchCode: formData.branchCode,
      birthDate: formData.birthDate,
      age: formData.age,
      address: formData.address,
      bloodType: formData.bloodType,
      salary: formData.salary,
      status: formData.status,
      startDate: formData.startDate, // วันที่เริ่มงาน
      // ข้อมูลผู้ติดต่อฉุกเฉิน
      emergencyContact: formData.emergencyContactName ? {
        name: formData.emergencyContactName,
        phone: formData.emergencyContactPhone,
        relation: formData.emergencyContactRelation
      } : null,
      // 🆕 ข้อมูลสวัสดิการ (Benefits)
      socialSecurityNumber: formData.socialSecurityNumber.trim() || undefined,
      providentFund: formData.providentFund.trim() || undefined,
      healthInsurance: formData.healthInsurance.trim() || undefined,
      // ประวัติการทำงาน
      workHistory: formData.workHistory.length > 0 ? formData.workHistory : undefined,
      // การศึกษา
      // ใช้ฟิลด์ 'educations' ที่เก็บรายการการศึกษาใน state (เดิมพิมพ์ผิดเป็น education)
      education: formData.educations && formData.educations.length > 0 ? formData.educations : undefined,
      // ทักษะ
      skills: formData.skills.length > 0 ? formData.skills : undefined,
      // เริ่มต้น timeSummary เป็น 0
      timeSummary: {
        totalWorkDays: 0,
        onTime: 0,
        late: 0,
        absent: 0,
        leave: 0,
        totalHours: '0 ชม.',
        avgCheckIn: '08:00',
        avgCheckOut: '17:30'
      },
      createdAt: new Date().toISOString(),
    };

    // ถ้าเป็น admin หรือ superadmin ให้สร้าง admin account ด้วย
    if (formData.role === 'admin' || formData.role === 'superadmin') {
      newUser.adminAccount = `ADM${previewEmployeeId}`;
      newUser.adminPassword = formData.role === 'superadmin' 
        ? 'SuperAdmin@GGS2024!' 
        : 'Admin@GGS2024!';
    }

    onSubmit(newUser);
    handleClose();
  };

  // Handle close
  const handleClose = () => {
    // Reset form data
    setFormData({
      name: '',
      email: '',
      phone: '',
      department: '',
      role: 'user',
      position: '',
      nationalId: '',
      provinceCode: '',
      branchCode: '',
      birthDate: '',
      address: '',
      bloodType: '',
      age: '',
      salary: '',
      status: 'active',
      startDate: '',
      emergencyContactName: '',
      emergencyContactPhone: '',
      emergencyContactRelation: '',
      workHistory: [],
      positions: [],
      departments: [],
      salaries: [],
      relationships: [],
      educations: [],
      skills: []
    });
    
    // Reset dynamic field states
    setCurrentWorkHistory({ position: '', company: '', period: '' });
    
    // Reset other states
    setErrors({});
    setPreviewEmployeeId('');
    
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
    >
      <div 
        className="bg-white rounded-2xl shadow-sm w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-primary via-orange-700 to-orange-600 px-6 py-5 flex justify-between items-center relative overflow-hidden flex-shrink-0">
          {/* Decorative background elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-white/10 rounded-full -mr-32 -mt-32"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-white/10 rounded-full -ml-24 -mb-24"></div>
          
          <div className="relative flex items-center gap-3">
            <div className="w-12 h-12 bg-white/20 backdrop-blur-md rounded-xl flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-bold text-white drop-shadow-md">เพิ่มผู้ใช้ใหม่</h2>
              <p className="text-white/80 text-sm">เพิ่มข้อมูลพนักงานเข้าสู่ระบบ</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="relative text-white hover:bg-white/20 rounded-xl transition-all p-2"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body - Scrollable */}
        <div className="p-6 overflow-y-auto flex-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* คำนำหน้า */}
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                คำนำหน้า <span className="text-red-500">*</span>
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => handleInputChange('titlePrefix', 'นาย')}
                  className={`px-6 py-2 rounded-lg font-medium transition-all ${
                    formData.titlePrefix === 'นาย'
                      ? 'bg-brand-primary text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  นาย
                </button>
                <button
                  type="button"
                  onClick={() => handleInputChange('titlePrefix', 'นาง')}
                  className={`px-6 py-2 rounded-lg font-medium transition-all ${
                    formData.titlePrefix === 'นาง'
                      ? 'bg-brand-primary text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  นาง
                </button>
                <button
                  type="button"
                  onClick={() => handleInputChange('titlePrefix', 'นางสาว')}
                  className={`px-6 py-2 rounded-lg font-medium transition-all ${
                    formData.titlePrefix === 'นางสาว'
                      ? 'bg-brand-primary text-white shadow-md'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  นางสาว
                </button>
              </div>
            </div>

            {/* ชื่อ นามสกุล */}
            <div className="md:col-span-2">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                ชื่อ นามสกุล <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange('name', e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent ${
                  errors.name ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="เช่น สมชาย ใจดี (ไม่ต้องใส่คำนำหน้า)"
              />
              {errors.name && <p className="text-red-500 text-sm mt-1">{errors.name}</p>}
            </div>

            {/* จังหวัด */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                จังหวัด <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <select
                  value={formData.provinceCode}
                  onChange={(e) => handleInputChange('provinceCode', e.target.value)}
                  className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent ${
                    errors.provinceCode ? 'border-red-500' : 'border-gray-300'
                  }`}
                >
                  <option value="">เลือกจังหวัด</option>
                  {provinces.map(p => (
                    <option key={p.code} value={p.code}>
                      {p.name} ({p.code})
                      {editableProvinces.length > 3 && (
                        <button
                          type="button"
                          onClick={() => removeProvince(p.code)}
                          className="ml-2 text-red-500 hover:text-red-700"
                          title="ลบจังหวัดนี้"
                        >
                          ×
                        </button>
                      )}
                    </option>
                  ))}
                </select>
              </div>
              {/* 🆕 เพิ่มจังหวัดใหม่ */}
              <details className="mt-2">
                <summary className="text-xs text-blue-600 cursor-pointer hover:text-blue-800 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  จัดการจังหวัด
                </summary>
                <div className="mt-2 p-3 bg-gray-50 rounded-lg space-y-2">
                  <div className="flex gap-2 flex-col ">
                    <input
                      type="text"
                      placeholder="รหัส (เช่น BKK)"
                      value={newProvince.code}
                      onChange={(e) => setNewProvince({ ...newProvince, code: e.target.value.toUpperCase() })}
                      className="flex-1 px-3 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                      maxLength={3}
                    />
                    <input
                      type="text"
                      placeholder="ชื่อจังหวัด"
                      value={newProvince.name}
                      onChange={(e) => setNewProvince({ ...newProvince, name: e.target.value })}
                      className="flex-1 px-3 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={addProvince}
                      className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                    >
                      เพิ่ม
                    </button>
                  </div>
                  {/* รายการจังหวัดปัจจุบัน */}
                  <div className="flex flex-wrap gap-1">
                    {editableProvinces.map(p => (
                      <span key={p.code} className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-gray-200 rounded text-xs">
                        {p.name}
                        <button
                          type="button"
                          onClick={() => removeProvince(p.code)}
                          className="text-red-500 hover:text-red-700 ml-1"
                          title="ลบ"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </details>
              {errors.provinceCode && <p className="text-red-500 text-sm mt-1">{errors.provinceCode}</p>}
            </div>

            {/* สาขา */}
            <div className="disabled">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                รหัสสาขา <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.branchCode}
                onChange={(e) => handleInputChange('branchCode', e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent ${
                  errors.branchCode ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <option value="">เลือกรหัสสาขา</option>
                {branches.map(b => (
                  <option key={b.code} value={b.code}>{b.name} ({b.code})</option>
                ))}
              </select>
              {errors.branchCode && <p className="text-red-500 text-sm mt-1">{errors.branchCode}</p>}
            </div>

            {/* Preview รหัสพนักงาน */}
            {previewEmployeeId && (
              <div className="md:col-span-2">
                <div className="bg-orange-50 border-2 border-orange-200 rounded-lg p-4">
                  <p className="text-sm font-semibold text-orange-700 mb-1"> รหัสพนักงานที่จะได้รับ:</p>
                  <p className="text-2xl font-bold text-orange-900">{previewEmployeeId}</p>
                </div>
              </div>
            )}

            {/* อีเมล */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                อีเมล <span className="text-red-500">*</span>
              </label>
              <input
                type="email"
                value={formData.email}
                onChange={(e) => handleInputChange('email', e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent ${
                  errors.email ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="example@company.com"
              />
              {errors.email && <p className="text-red-500 text-sm mt-1">{errors.email}</p>}
            </div>

            {/* เบอร์โทร */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                เบอร์โทรศัพท์ <span className="text-red-500">*</span>
              </label>
              <input
                type="tel"
                value={formData.phone}
                onChange={(e) => handleInputChange('phone', e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent ${
                  errors.phone ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="0812345678"
                maxLength={10}
              />
              {errors.phone && <p className="text-red-500 text-sm mt-1">{errors.phone}</p>}
            </div>

            {/* เลขบัตรประชาชน */}
            <div className="md:col-span-1">
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                เลขบัตรประชาชน <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={formData.nationalId}
                onChange={(e) => handleInputChange('nationalId', e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent ${
                  errors.nationalId ? 'border-red-500' : 'border-gray-300'
                }`}
                placeholder="1234567890123"
                maxLength={13}
              />
              {errors.nationalId && <p className="text-red-500 text-sm mt-1">{errors.nationalId}</p>}
              <p className="text-sm text-gray-500 mt-1 flex items-center gap-1">
                <svg className="w-4 h-4 fill-brand-primary flex-shrink-0" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                </svg>
                รหัสผ่านเริ่มต้นจะเป็นเลขบัตรประชาชน
              </p>
            </div>

            {/* แผนก */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                แผนก <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.department}
                onChange={(e) => handleInputChange('department', e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent ${
                  errors.department ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <option value="">เลือกแผนก</option>
                {departments.map(dept => (
                  <option key={dept} value={dept}>{dept}</option>
                ))}
              </select>
              {/* 🆕 เพิ่มแผนกใหม่ */}
              <details className="mt-2">
                <summary className="text-xs text-blue-600 cursor-pointer hover:text-blue-800 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  จัดการแผนก
                </summary>
                <div className="mt-2 p-3 bg-gray-50 rounded-lg space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="ชื่อแผนกใหม่"
                      value={newDepartment}
                      onChange={(e) => setNewDepartment(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addDepartment())}
                      className="flex-1 px-3 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={addDepartment}
                      className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                    >
                      เพิ่ม
                    </button>
                  </div>
                  {/* รายการแผนกปัจจุบัน */}
                  <div className="flex flex-wrap gap-1">
                    {editableDepartments.map(dept => (
                      <span key={dept} className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-gray-200 rounded text-xs">
                        {dept}
                        <button
                          type="button"
                          onClick={() => removeDepartment(dept)}
                          className="text-red-500 hover:text-red-700 ml-1"
                          title="ลบ"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </details>
              {errors.department && <p className="text-red-500 text-sm mt-1">{errors.department}</p>}
            </div>

            {/* ตำแหน่ง */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                ตำแหน่ง <span className="text-red-500">*</span>
              </label>
              <select
                value={formData.position}
                onChange={(e) => handleInputChange('position', e.target.value)}
                className={`w-full px-4 py-2 border rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent ${
                  errors.position ? 'border-red-500' : 'border-gray-300'
                }`}
              >
                <option value="">เลือกตำแหน่ง</option>
                {positions.map(pos => (
                  <option key={pos} value={pos}>{pos}</option>
                ))}
              </select>
              {/* 🆕 เพิ่มตำแหน่งใหม่ */}
              <details className="mt-2">
                <summary className="text-xs text-blue-600 cursor-pointer hover:text-blue-800 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  จัดการตำแหน่ง
                </summary>
                <div className="mt-2 p-3 bg-gray-50 rounded-lg space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="ชื่อตำแหน่งใหม่"
                      value={newPosition}
                      onChange={(e) => setNewPosition(e.target.value)}
                      onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addPosition())}
                      className="flex-1 px-3 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={addPosition}
                      className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                    >
                      เพิ่ม
                    </button>
                  </div>
                  {/* รายการตำแหน่งปัจจุบัน */}
                  <div className="flex flex-wrap gap-1">
                    {editablePositions.map(pos => (
                      <span key={pos} className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-gray-200 rounded text-xs">
                        {pos}
                        <button
                          type="button"
                          onClick={() => removePosition(pos)}
                          className="text-red-500 hover:text-red-700 ml-1"
                          title="ลบ"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </details>
              {errors.position && <p className="text-red-500 text-sm mt-1">{errors.position}</p>}
            </div>

            {/* สิทธิ์การใช้งาน */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                สิทธิ์การใช้งาน
              </label>
              <select
                value={formData.role}
                onChange={(e) => handleInputChange('role', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
              >
                <option value="user">ผู้ใช้ทั่วไป (User)</option>
                <option value="manager">ผู้จัดการ (Manager)</option>
                <option value="admin">ผู้ดูแลระบบ (Admin)</option>
                <option value="superadmin">ผู้ดูแลระบบสูงสุด (Super Admin)</option>
              </select>
              {(formData.role === 'admin' || formData.role === 'superadmin') && (
                <p className="text-sm text-brand-primary mt-1 flex items-center gap-1">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M18 8h-1V6c0-2.76-2.24-5-5-5s-5 2.24-5 5v2H6c-1.1 0-2 .9-2 2v10c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V10c0-1.1-.9-2-2-2zM9 6c0-1.66 1.34-3 3-3s3 1.34 3 3v2H9V6zm9 14H6V10h12v10zm-6-3c1.1 0 2-.9 2-2s-.9-2-2-2-2 .9-2 2 .9 2 2 2z"/></svg>
                  จะสร้างบัญชี Admin แยกต่างหาก (ADM{previewEmployeeId})
                </p>
              )}
            </div>

            {/* สถานะ */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                สถานะ
              </label>
              <select
                value={formData.status}
                onChange={(e) => handleInputChange('status', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
              >
                {editableStatuses.map(s => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              {/* 🆕 เพิ่มสถานะใหม่ */}
              <details className="mt-2">
                <summary className="text-xs text-blue-600 cursor-pointer hover:text-blue-800 flex items-center gap-1">
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  จัดการสถานะ
                </summary>
                <div className="mt-2 p-3 bg-gray-50 rounded-lg space-y-2">
                  <div className="flex gap-2 flex-col">
                    <input
                      type="text"
                      placeholder="รหัส (เช่น active)"
                      value={newStatus.value}
                      onChange={(e) => setNewStatus({ ...newStatus, value: e.target.value.toLowerCase() })}
                      className="flex-1 px-3 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                    />
                    <input
                      type="text"
                      placeholder="ชื่อสถานะ"
                      value={newStatus.label}
                      onChange={(e) => setNewStatus({ ...newStatus, label: e.target.value })}
                      className="flex-1 px-3 py-1 text-sm border border-gray-300 rounded focus:ring-1 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={addStatus}
                      className="px-3 py-1 bg-blue-600 text-white text-sm rounded hover:bg-blue-700 transition-colors"
                    >
                      เพิ่ม
                    </button>
                  </div>
                  {/* รายการสถานะปัจจุบัน */}
                  <div className="flex flex-wrap gap-1">
                    {editableStatuses.map(s => (
                      <span key={s.value} className="inline-flex items-center gap-1 px-2 py-1 bg-white border border-gray-200 rounded text-xs">
                        {s.label}
                        <button
                          type="button"
                          onClick={() => removeStatus(s.value)}
                          className="text-red-500 hover:text-red-700 ml-1"
                          title="ลบ"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              </details>
            </div>

            {/* วันเกิด */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                วันเกิด
              </label>
              <input
                type="date"
                value={formData.birthDate}
                onChange={(e) => handleInputChange('birthDate', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
              />
            </div>

            {/* อายุ */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                อายุ
              </label>
              <input
                type="number"
                value={formData.age}
                onChange={(e) => handleInputChange('age', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                placeholder="อายุจะคำนวณอัตโนมัติจากวันเกิด"
                readOnly={formData.birthDate ? true : false}
              />
            </div>

            {/* กรุ๊ปเลือด */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                กรุ๊ปเลือด
              </label>
              <select
                value={formData.bloodType}
                onChange={(e) => handleInputChange('bloodType', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
              >
                <option value="">เลือกกรุ๊ปเลือด</option>
                {bloodTypes.map(type => (
                  <option key={type} value={type}>{type}</option>
                ))}
              </select>
            </div>

            {/* เงินเดือน */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                เงินเดือน
              </label>
              <input
                type="number"
                value={formData.salary}
                onChange={(e) => handleInputChange('salary', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                placeholder="0"
              />
            </div>

            {/* วันที่เริ่มงาน */}
            <div>
              <label className="block text-sm font-semibold text-gray-700 mb-2">
                วันที่เริ่มงาน
              </label>
              <input
                type="date"
                value={formData.startDate}
                onChange={(e) => handleInputChange('startDate', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
              />
            </div>
          </div>

          {/* ข้อมูลผู้ติดต่อฉุกเฉิน */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              ข้อมูลผู้ติดต่อฉุกเฉิน
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* ชื่อผู้ติดต่อฉุกเฉิน */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  ชื่อผู้ติดต่อฉุกเฉิน
                </label>
                <input
                  type="text"
                  value={formData.emergencyContactName}
                  onChange={(e) => handleInputChange('emergencyContactName', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  placeholder="ชื่อ-นามสกุล"
                />
              </div>

              {/* เบอร์โทรผู้ติดต่อฉุกเฉิน */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  เบอร์โทรศัพท์
                </label>
                <input
                  type="tel"
                  value={formData.emergencyContactPhone}
                  onChange={(e) => handleInputChange('emergencyContactPhone', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  placeholder="0812345678"
                  maxLength={10}
                />
              </div>

              {/* ความสัมพันธ์ */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  ความสัมพันธ์
                </label>
                <input
                  type="text"
                  value={formData.emergencyContactRelation}
                  onChange={(e) => handleInputChange('emergencyContactRelation', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  placeholder="เช่น บิดา มารดา พี่ น้อง"
                />
              </div>
            </div>
          </div>

          {/* 🆕 ข้อมูลสวัสดิการ (Benefits) */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              ข้อมูลสวัสดิการ
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* เลขประกันสังคม */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  เลขประกันสังคม
                </label>
                <input
                  type="text"
                  value={formData.socialSecurityNumber}
                  onChange={(e) => handleInputChange('socialSecurityNumber', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  placeholder="1-2345-67890-12-3"
                  maxLength={17}
                />
              </div>

              {/* กองทุนสำรองเลี้ยงชีพ */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  กองทุนสำรองเลี้ยงชีพ
                </label>
                <input
                  type="text"
                  value={formData.providentFund}
                  onChange={(e) => handleInputChange('providentFund', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  placeholder="เช่น 5% หรือ ไม่มี"
                />
              </div>

              {/* ประกันสุขภาพ */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  ประกันสุขภาพ
                </label>
                <input
                  type="text"
                  value={formData.healthInsurance}
                  onChange={(e) => handleInputChange('healthInsurance', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  placeholder="เช่น OPD 3000 บาท/ปี หรือ ไม่มี"
                />
              </div>
            </div>
          </div>

          {/* ที่อยู่ */}
          <div className="mb-6">
            <div className="grid grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  ที่อยู่
                </label>
                <textarea
                  value={formData.address}
                  onChange={(e) => handleInputChange('address', e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent"
                  rows={3}
                  placeholder="บ้านเลขที่ ถนน ตำบล อำเภอ จังหวัด รหัสไปรษณีย์"
                />
              </div>
            </div>
          </div>

          {/* ประวัติการทำงาน */}
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              ประวัติการทำงาน
            </h3>
            
            {/* แสดงรายการประวัติที่เพิ่มแล้ว */}
            {formData.workHistory.length > 0 && (
              <div className="mb-4 space-y-2">
                {formData.workHistory.map((work, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 bg-orange-50 rounded-lg border border-orange-200">
                    <div className="flex-1">
                      <div className="font-medium text-gray-800">{work.position}</div>
                      <div className="text-sm text-gray-600">{work.company}</div>
                      <div className="text-xs text-gray-500">{work.period}</div>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeWorkHistory(index)}
                      className="text-red-500 hover:text-red-700 transition-colors"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                        <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            )}

            {/* ฟอร์มเพิ่มประวัติการทำงาน */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
              <div>
                <input
                  type="text"
                  value={currentWorkHistory.position}
                  onChange={(e) => setCurrentWorkHistory({ ...currentWorkHistory, position: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent text-sm"
                  placeholder="ตำแหน่ง"
                />
              </div>
              <div>
                <input
                  type="text"
                  value={currentWorkHistory.company}
                  onChange={(e) => setCurrentWorkHistory({ ...currentWorkHistory, company: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent text-sm"
                  placeholder="บริษัท/หน่วยงาน"
                />
              </div>
              <div>
                <input
                  type="text"
                  value={currentWorkHistory.period}
                  onChange={(e) => setCurrentWorkHistory({ ...currentWorkHistory, period: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-brand-primary focus:border-transparent text-sm"
                  placeholder="ช่วงเวลา (เช่น 2020-2023)"
                />
              </div>
              <div>
                <button
                  type="button"
                  onClick={addWorkHistory}
                  className="w-full px-4 py-2 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors text-sm font-medium"
                >
                  + เพิ่ม
                </button>
              </div>
            </div>
          </div>

          {/* 📋 Profile Management - 6 Categories */}
          <div className="mb-6">
            
            <div className="space-y-6">

              {/* Education */}
              <ProfileManager
                category="education"
                items={formData.educations}
                onAdd={(item) => handleAddProfile('educations', item)}
                onRemove={(index) => handleRemoveProfile('educations', index)}
                onRemoveAll={() => handleRemoveAllProfiles('educations')}
              />

              {/* Skills */}
              <ProfileManager
                category="skills"
                items={formData.skills}
                onAdd={(item) => handleAddProfile('skills', item)}
                onRemove={(index) => handleRemoveProfile('skills', index)}
                onRemoveAll={() => handleRemoveAllProfiles('skills')}
              />
            </div>
          </div>
        </div>

        {/* Footer - Buttons */}
        <div className="border-t px-6 py-4 flex justify-end gap-3 bg-gradient-to-r from-gray-50 to-gray-100 flex-shrink-0">
          <button
            onClick={handleClose}
            className="px-6 py-2.5 border-2 border-gray-300 rounded-xl text-gray-700 hover:bg-white hover:border-gray-400 transition-all font-medium flex items-center gap-2 shadow-sm"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            ยกเลิก
          </button>
          <button
            onClick={handleSubmit}
            className="px-6 py-2.5 bg-gradient-to-r from-brand-primary via-orange-700 to-orange-600 text-white rounded-xl hover:from-orange-700 hover:via-orange-800 hover:to-orange-700 transition-all shadow-sm hover:shadow-sm transform hover:scale-105 font-medium flex items-center gap-2"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            เพิ่มผู้ใช้
          </button>
        </div>
      </div>
    </div>
  );
});

UserCreateModal.displayName = 'UserCreateModal';

export default UserCreateModal;
