"use client";

import { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import { useAuth } from '@/contexts/mock-contexts';
import UserTable from '@/components/admin/UserTable';
import AlertDialog from '@/components/common/AlertDialog';
import { User, AlertDialogState, AttendanceEditData, AttendanceCheckData, CsvUserData, AttendanceRecord } from '@/types/user';
import { 
  generateEmployeeId, 
  validateUserData, 
  parseCsvData, 
  processCsvUsers,
  generateUserPDF
} from '@/utils/adminUserUtils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

// Lazy load heavy components
const UserDetailModal = lazy(() => import('@/components/admin/UserDetailModal'));
const UserEditModal = lazy(() => import('@/components/admin/UserEditModal'));
const UserCreateModal = lazy(() => import('@/components/admin/UserCreateModal'));
const CsvImportModal = lazy(() => import('@/components/admin/CsvImportModal'));

// Mock users data
const mockUsersData: User[] = [
  {
    id: 'user-1',
    name: 'สมชาย ใจดี',
    email: 'somchai@example.com',
    phone: '0812345678',
    employeeId: 'BKK0010001',
    username: 'BKK0010001',
    password: '1234',
    role: 'admin',
    department: 'IT',
    position: 'Senior Developer',
    status: 'active',
    branch: 'BKK',
    provinceCode: 'BKK',
    branchCode: '001',
    nationalId: '1234567890123',
    birthDate: '1990-01-01',
    age: 34,
    bloodType: 'O',
    address: '123 ถนนสาทร กรุงเทพฯ 10120',
    emergencyContact: {
      name: 'สมหญิง ใจดี',
      phone: '0898765432',
      relation: 'ภรรยา'
    },
    attendanceRecords: [
      {
        date: '15 ม.ค. 2568',
        checkIn: {
          time: '08:45',
          location: 'สำนักงานกรุงเทพ',
          status: 'onTime',
          coordinates: { lat: 13.7563, lng: 100.5018 }
        },
        checkOut: {
          time: '17:30',
          location: 'สำนักงานกรุงเทพ',
          coordinates: { lat: 13.7563, lng: 100.5018 }
        }
      }
    ]
  },
  {
    id: 'user-2',
    name: 'สมหญิง สวยงาม',
    email: 'somying@example.com',
    phone: '0823456789',
    employeeId: 'CNX0010002',
    username: 'CNX0010002',
    password: '1234',
    role: 'user',
    department: 'HR',
    position: 'HR Manager',
    status: 'active',
    branch: 'CNX',
    provinceCode: 'CNX',
    branchCode: '001',
    nationalId: '9876543210987',
    birthDate: '1992-05-15',
    age: 32,
    bloodType: 'A',
    address: '456 ถนนนิมมานเหมินท์ เชียงใหม่ 50200',
    emergencyContact: {
      name: 'สมชาย สวยงาม',
      phone: '0887654321',
      relation: 'สามี'
    },
    attendanceRecords: []
  }
];

const branchOptions = [
  { value: 'all', label: 'สาขา: ทั้งหมด' },
  { value: 'BKK', label: 'BKK (กรุงเทพ)' },
  { value: 'CNX', label: 'CNX (เชียงใหม่)' },
  { value: 'PKT', label: 'PKT (ภูเก็ต)' }
];

export default function AdminManageUser() {
  const { user: currentUser } = useAuth();
  
  const [users, setUsers] = useState<User[]>(mockUsersData);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  
  // Grouped: Modal visibility states (5 → 1)
  const [modals, setModals] = useState({
    detail: false,
    csv: false,
    createUser: false,
    editUser: false,
    attendance: false
  });
  
  // Grouped: Filter states (4 → 1)
  const [filters, setFilters] = useState({
    search: '',
    debouncedSearch: '',
    status: 'all',
    branch: 'all'
  });
  
  // Grouped: Editing states (4 → 1)
  const [editing, setEditing] = useState<{
    user: User | null;
    form: Record<string, any>;
    attendance: AttendanceEditData | null;
    attendanceForm: Partial<AttendanceCheckData>;
  }>({
    user: null,
    form: {},
    attendance: null,
    attendanceForm: {}
  });
  
  // CSV Import
  const [csvData, setCsvData] = useState<CsvUserData[]>([]);
  
  // Grouped: UI States (3 → 1)
  const [ui, setUi] = useState<{
    alertDialog: AlertDialogState;
    deleteCandidate: User | null;
    selectedDate: string;
  }>({
    alertDialog: { isOpen: false, type: 'info', title: '', message: '' },
    deleteCandidate: null,
    selectedDate: ''
  });

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters(prev => ({ ...prev, debouncedSearch: prev.search }));
    }, 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Filter and search users
  const filteredUsers = useMemo(() => {
    let filtered = users;
    
    // Branch filter for admin role
    if (currentUser?.role === 'admin') {
      const adminBranch = currentUser.branch || currentUser.provinceCode || currentUser.employeeId?.substring(0, 3);
      if (adminBranch) {
        filtered = filtered.filter(user => {
          const userBranch = user.branch || user.provinceCode || user.employeeId?.substring(0, 3);
          return userBranch === adminBranch;
        });
      }
    }
    
    // Search filter
    filtered = filtered.filter(user => {
      const matchesSearch = user.name.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                           user.email.toLowerCase().includes(debouncedSearchTerm.toLowerCase()) ||
                           user.employeeId?.toLowerCase().includes(debouncedSearchTerm.toLowerCase());
      const matchesStatus = filterStatus === 'all' || user.status === filterStatus;
      
      // Branch filter
      let matchesBranch = true;
      if (filterBranch !== 'all') {
        const userBranch = user.branch || user.provinceCode || user.employeeId?.substring(0, 3);
        matchesBranch = userBranch === filterBranch;
      }
      
      return matchesSearch && matchesStatus && matchesBranch;
    });
    
    return filtered;
  }, [users, debouncedSearchTerm, filterStatus, filterBranch, currentUser]);

  const openDetail = (user: User) => {
    setSelectedUser(user);
    setShowDetail(true);
  };

  const closeDetail = () => {
    setShowDetail(false);
    setSelectedUser(null);
  };

  // Edit user
  const openEditUser = (user?: User) => {
    const userToEdit = user || selectedUser;
    if (!userToEdit) return;
    
    setEditingUser(userToEdit);
    setEditForm({
      name: userToEdit.name || '',
      email: userToEdit.email || '',
      phone: userToEdit.phone || '',
      department: userToEdit.department || '',
      role: userToEdit.role || '',
      birthDate: userToEdit.birthDate || '',
      status: userToEdit.status || '',
      address: userToEdit.address || '',
      position: userToEdit.position || '',
      nationalId: userToEdit.nationalId || '',
      bloodType: userToEdit.bloodType || '',
      password: userToEdit.password || '',
      employeeId: userToEdit.employeeId || '',
      emergencyContactName: userToEdit.emergencyContact?.name || '',
      emergencyContactPhone: userToEdit.emergencyContact?.phone || '',
      emergencyContactRelation: userToEdit.emergencyContact?.relation || ''
    });
    setShowEditUser(true);
  };

  const closeEditUser = () => {
    setShowEditUser(false);
    setEditingUser(null);
    setEditForm({});
  };

  const saveEditUser = () => {
    if (!editForm.name || !editForm.email || !editForm.phone) {
      setAlertDialog({
        isOpen: true,
        type: 'error',
        title: 'ข้อมูลไม่ครบ',
        message: 'กรุณากรอกข้อมูลให้ครบถ้วน (ชื่อ, อีเมล, เบอร์โทร)',
        autoClose: true
      });
      return;
    }

    if (!editingUser) return;

    const updatedUserData = {
      ...editForm,
      emergencyContact: {
        name: editForm.emergencyContactName,
        phone: editForm.emergencyContactPhone,
        relation: editForm.emergencyContactRelation
      }
    };

    delete updatedUserData.emergencyContactName;
    delete updatedUserData.emergencyContactPhone;
    delete updatedUserData.emergencyContactRelation;

    const updatedUsers = users.map(user => 
      user.id === editingUser.id ? { ...user, ...updatedUserData } : user
    );

    setUsers(updatedUsers);
    
    if (selectedUser && selectedUser.id === editingUser.id) {
      const updatedUser = updatedUsers.find(u => u.id === editingUser.id);
      setSelectedUser(updatedUser || null);
    }

    setAlertDialog({
      isOpen: true,
      type: 'success',
      title: 'บันทึกสำเร็จ',
      message: 'แก้ไขข้อมูลผู้ใช้เรียบร้อยแล้ว',
      autoClose: true
    });

    closeEditUser();
  };

  // Delete user
  const handleDeleteUser = (userToDelete: User) => {
    if (currentUser?.role === 'admin' && userToDelete.role === 'superadmin') {
      setAlertDialog({
        isOpen: true,
        type: 'error',
        title: 'ไม่มีสิทธิ์',
        message: 'Admin ไม่สามารถลบ Super Admin ได้',
        autoClose: true
      });
      return;
    }

    closeDetail();
    setDeleteCandidate(userToDelete);
  };

  const cancelDelete = () => {
    setDeleteCandidate(null);
    if (selectedUser) {
      setShowDetail(true);
    }
  };

  const confirmDeleteUser = () => {
    if (!deleteCandidate) return;
    
    const updatedUsers = users.filter(u => u.id !== deleteCandidate.id);
    setUsers(updatedUsers);
    
    if (selectedUser && selectedUser.id === deleteCandidate.id) {
      closeDetail();
    }

    setAlertDialog({
      isOpen: true,
      type: 'success',
      title: 'ลบสำเร็จ',
      message: `ลบ ${deleteCandidate.name} เรียบร้อยแล้ว`,
      autoClose: true
    });

    setDeleteCandidate(null);
  };

  const getStatusBadge = (status: string): string => {
    const badges: Record<string, string> = {
      'active': 'bg-green-500 text-white shadow-sm',
      'leave': 'bg-red-500 text-white shadow-sm',
      'suspended': 'bg-gray-500 text-white shadow-sm',
      'pending': 'bg-amber-500 text-white shadow-sm'
    };
    return badges[status.toLowerCase()] || 'bg-gray-100 text-gray-700';
  };

  const downloadPDF = async () => {
    if (!selectedUser) return;

    try {
      setAlertDialog({
        isOpen: true,
        type: 'info',
        title: 'กำลังสร้าง PDF',
        message: 'กรุณารอสักครู่...',
        autoClose: false
      });

      await generateUserPDF(selectedUser);
      
      setAlertDialog({
        isOpen: true,
        type: 'success',
        title: 'สำเร็จ',
        message: 'ดาวน์โหลด PDF เรียบร้อยแล้ว',
        autoClose: true
      });
    } catch (error: any) {
      setAlertDialog({
        isOpen: true,
        type: 'error',
        title: 'เกิดข้อผิดพลาด',
        message: `ไม่สามารถสร้าง PDF ได้: ${error.message}`,
        autoClose: true
      });
    }
  };

  // Create new user
  const handleCreateUser = (newUser: User) => {
    const updatedUsers = [...users, newUser];
    setUsers(updatedUsers);
    
    setAlertDialog({
      isOpen: true,
      type: 'success',
      title: 'เพิ่มผู้ใช้สำเร็จ',
      message: `เพิ่ม ${newUser.name} เข้าระบบเรียบร้อยแล้ว\n\nรหัสพนักงาน: ${newUser.employeeId}\nรหัสผ่าน: ${newUser.password}`,
      autoClose: false
    });
  };

  // CSV Import
  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      setAlertDialog({
        isOpen: true,
        type: 'error',
        title: 'ไฟล์ไม่ถูกต้อง',
        message: 'กรุณาเลือกไฟล์ .csv เท่านั้น'
      });
      e.target.value = '';
      return;
    }
    
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      handleParseCsvData(text);
      e.target.value = '';
    };
    reader.readAsText(file);
  };

  const handleParseCsvData = (csvText: string) => {
    try {
      const data = parseCsvData(csvText);
      
      if (data.length === 0) {
        setAlertDialog({
          isOpen: true,
          type: 'error',
          title: 'ไฟล์ว่างเปล่า',
          message: 'ไม่พบข้อมูลในไฟล์ CSV'
        });
        return;
      }

      setCsvData(data);
      setShowCsvModal(true);
    } catch (error) {
      setAlertDialog({
        isOpen: true,
        type: 'error',
        title: 'เกิดข้อผิดพลาด',
        message: 'ไม่สามารถอ่านไฟล์ CSV ได้ กรุณาตรวจสอบรูปแบบไฟล์'
      });
    }
  };

  const confirmCsvImport = () => {
    const processedUsers = processCsvUsers(csvData, users);
    const validationErrors = validateUserData(processedUsers, users);
    
    if (validationErrors.length > 0) {
      setAlertDialog({
        isOpen: true,
        type: 'error',
        title: `พบข้อมูลซ้ำ (${validationErrors.length} รายการ)`,
        message: validationErrors.slice(0, 5).join('\n')
      });
      return;
    }

    const updatedUsers = [...users, ...processedUsers];
    setUsers(updatedUsers);
    
    setShowCsvModal(false);
    setCsvData([]);

    setAlertDialog({
      isOpen: true,
      type: 'success',
      title: 'นำเข้าสำเร็จ',
      message: `นำเข้าข้อมูลพนักงาน ${processedUsers.length} บัญชี เรียบร้อยแล้ว`,
      autoClose: true
    });
  };

  const closeCsvModal = () => {
    setShowCsvModal(false);
    setCsvData([]);
  };

  const handleAttendanceEdit = (editData: AttendanceEditData | null) => {
    setEditingAttendance(editData);
    if (editData) {
      setAttendanceForm(editData.data || {});
    } else {
      setAttendanceForm({});
    }
  };

  const saveAttendanceEdit = () => {
    // Mock implementation
    setAlertDialog({
      isOpen: true,
      type: 'success',
      title: 'บันทึกสำเร็จ!',
      message: 'บันทึกการแก้ไขข้อมูลการเข้า-ออกงานเรียบร้อยแล้ว',
      autoClose: true
    });
    setEditingAttendance(null);
    setAttendanceForm({});
  };

  const closeAlertDialog = () => {
    setAlertDialog({ ...alertDialog, isOpen: false });
  };

  const getFilteredAttendanceRecords = (): AttendanceRecord[] => {
    if (!selectedUser || !selectedUser.attendanceRecords) return [];
    
    if (selectedDate) {
      return selectedUser.attendanceRecords.filter(record => record.date === selectedDate);
    }
    return selectedUser.attendanceRecords.slice(0, 3);
  };

  return (
    <div className="min-h-screen p-4 bg-slate-50 sm:p-6">
      <Card className="p-6 border border-orange-100 shadow-sm">
        {/* Header */}
        <div className="flex flex-col items-start justify-between gap-4 mb-6 sm:flex-row sm:items-center">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold text-gray-900">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
              จัดการผู้ใช้
            </h1>
            <p className="mt-1 text-sm text-gray-500">จัดการสิทธิ์การใช้งานและข้อมูลผู้ใช้ในระบบ</p>
          </div>
          <div className="flex items-center gap-2">
            <label className="cursor-pointer">
              <Button className="flex items-center gap-2 bg-gray-900 hover:bg-gray-700">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                </svg>
                นำเข้าไฟล์ CSV
              </Button>
              <input 
                type="file" 
                accept=".csv" 
                onChange={handleCsvFileChange}
                className="hidden"
              />
            </label>
            <Button 
              onClick={() => setShowCreateUser(true)}
              className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
              </svg>
              เพิ่มผู้ใช้งาน
            </Button>
          </div>
        </div>

        {/* Search and Filter */}
        <div className="flex flex-col gap-3 mb-6 sm:flex-row">
          <div className="relative flex-1">
            <svg xmlns="http://www.w3.org/2000/svg" className="absolute w-5 h-5 text-gray-400 -translate-y-1/2 left-3 top-1/2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
            <input
              type="text"
              placeholder="ค้นหาชื่อหรืออีเมล..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-gray-900 focus:outline-none transition-colors"
            />
          </div>
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="cursor-pointer px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-gray-900 focus:outline-none transition-colors bg-white"
          >
            <option value="all">สถานะ: ทั้งหมด</option>
            <option value="active">Active</option>
            <option value="leave">Leave</option>
            <option value="suspended">Suspended</option>
            <option value="pending">Pending</option>
          </select>
          
          {currentUser?.role === 'superadmin' && (
            <select
              value={filterBranch}
              onChange={(e) => setFilterBranch(e.target.value)}
              className="cursor-pointer px-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-gray-900 focus:outline-none transition-colors bg-white"
            >
              {branchOptions.map(option => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* User Table */}
        <UserTable 
          users={filteredUsers}
          onSelectUser={openDetail}
          getStatusBadge={getStatusBadge}
          currentUser={currentUser}
          onAttendanceEdit={handleAttendanceEdit}
          onSaveAttendanceEdit={saveAttendanceEdit}
          editingAttendance={editingAttendance}
          attendanceForm={attendanceForm}
          onAttendanceFormChange={setAttendanceForm}
        />

        {/* Footer legend */}
        <div className="p-4 mt-6 border border-gray-200 rounded-xl bg-gray-50">
          <h3 className="flex items-center gap-2 mb-3 font-semibold text-gray-700">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            คำอธิบาย
          </h3>
          
          <div className="mb-3">
            <h4 className="mb-2 text-xs font-semibold text-gray-600">สถานะพนักงาน:</h4>
            <div className="grid grid-cols-2 gap-3 text-sm sm:grid-cols-4">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-green-500 rounded-full"></span>
                <span className="font-semibold text-green-600">Active</span>
                <span className="text-gray-500">: ยังคงทำงานอยู่</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-red-500 rounded-full"></span>
                <span className="font-semibold text-red-600">Leave</span>
                <span className="text-gray-500">: ลาออกแล้ว</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 bg-gray-500 rounded-full"></span>
                <span className="font-semibold text-gray-700">Suspended</span>
                <span className="text-gray-500">: โดนพักงาน</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                <span className="font-semibold text-amber-700">Pending</span>
                <span className="text-gray-500">: รอโปรโมท</span>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* Lazy-loaded Modals */}
      <Suspense fallback={<div className="fixed inset-0 z-50 flex items-center justify-center bg-black/20"><div className="w-12 h-12 border-b-2 border-orange-600 rounded-full animate-spin"></div></div>}>
        {showDetail && selectedUser && (
          <UserDetailModal
            user={selectedUser}
            showDetail={showDetail}
            showAttendance={showAttendance}
            selectedDate={selectedDate}
            currentUser={currentUser}
            onClose={closeDetail}
            onEdit={openEditUser}
            onDownloadPDF={downloadPDF}
            onDelete={handleDeleteUser}
            onToggleAttendance={() => setShowAttendance(!showAttendance)}
            getStatusBadge={getStatusBadge}
            getFilteredAttendanceRecords={getFilteredAttendanceRecords}
            onSetSelectedDate={setSelectedDate}
          />
        )}

        {showEditUser && editingUser && (
          <UserEditModal
            show={showEditUser}
            editingUser={editingUser}
            editForm={editForm}
            currentUser={currentUser}
            onClose={closeEditUser}
            onSave={saveEditUser}
            onChange={setEditForm}
          />
        )}

        {showCsvModal && (
          <CsvImportModal
            isOpen={showCsvModal}
            csvData={csvData}
            generateEmployeeId={(provinceCode, branchCode) => generateEmployeeId(provinceCode, branchCode, users)}
            onConfirm={confirmCsvImport}
            onClose={closeCsvModal}
          />
        )}

        {showCreateUser && (
          <UserCreateModal
            isOpen={showCreateUser}
            onClose={() => setShowCreateUser(false)}
            onSubmit={handleCreateUser}
            generateEmployeeId={(provinceCode, branchCode) => generateEmployeeId(provinceCode, branchCode, users)}
            users={users}
          />
        )}
      </Suspense>

      {/* Alert Dialog */}
      <AlertDialog
        isOpen={alertDialog.isOpen}
        onClose={closeAlertDialog}
        type={alertDialog.type}
        title={alertDialog.title}
        message={alertDialog.message}
        autoClose={alertDialog.autoClose}
      />

      {/* Delete confirmation modal */}
      {deleteCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={cancelDelete}></div>
          <Card className="relative z-10 w-full max-w-lg p-6 mx-4 shadow-2xl">
            <h3 className="mb-2 text-lg font-semibold">ยืนยันการลบ</h3>
            <p className="text-sm text-gray-700">
              คุณแน่ใจหรือไม่ที่จะลบ "{deleteCandidate.name}"? การดำเนินการนี้ไม่สามารถย้อนกลับได้
            </p>
            <div className="flex justify-end gap-3 mt-4">
              <Button variant="outline" onClick={cancelDelete}>
                ยกเลิก
              </Button>
              <Button variant="destructive" onClick={confirmDeleteUser}>
                ลบเลย
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
