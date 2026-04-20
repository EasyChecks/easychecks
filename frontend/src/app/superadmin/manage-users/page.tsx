"use client";

import { useState, useMemo, useEffect, lazy, Suspense } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { userService } from '@/services/user';
import { attendanceService } from '@/services/attendance';
import UserTable from '@/components/admin/UserTable';
import AlertDialog from '@/components/common/AlertDialog';
import { User, AlertDialogState, AttendanceEditData, AttendanceCheckData, CsvUserData, AttendanceRecord } from '@/types/user';
import { 
  generateEmployeeId, 
  validateUserData, 
  parseCsvData, 
  generateUserPDF
} from '@/utils/adminUserUtils';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

// Lazy load heavy components
const UserDetailModal = lazy(() => import('@/components/admin/UserDetailModal'));
const UserEditModal = lazy(() => import('@/components/admin/UserEditModal'));
const UserCreateModal = lazy(() => import('@/components/admin/UserCreateModal'));
const CsvImportModal = lazy(() => import('@/components/admin/CsvImportModal'));

const branchOptions = [
  { value: 'all', label: 'สาขา: ทั้งหมด' },
  { value: 'BKK', label: 'BKK (กรุงเทพ)' },
  { value: 'CNX', label: 'CNX (เชียงใหม่)' },
  { value: 'PKT', label: 'PKT (ภูเก็ต)' }
];

export default function AdminManageUser() {
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [apiError, setApiError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  
  // Grouped: Modal visibility states (5 → 1)
  const [modals, setModals] = useState({
    detail: false,
    csv: false,
    createUser: false,
    editUser: false,
    attendance: false,
    loadingAttendance: false
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
    form: Record<string, string | number | boolean | null>;
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
  const [csvText, setCsvText] = useState<string>('');
  
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

  // โหลดข้อมูลสมาชิกจาก API จริง
  useEffect(() => {
    if (!currentUser) return;
    const load = async () => {
      setIsLoading(true);
      setApiError(null);
      try {
        const result = await userService.getManageUsers(currentUser);
        setUsers(result.users);
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'ไม่สามารถโหลดข้อมูลสมาชิกได้';
        setApiError(msg);
      } finally {
        setIsLoading(false);
      }
    };
    load();
  }, [currentUser]);

  // Debounce search term
  useEffect(() => {
    const timer = setTimeout(() => {
      setFilters(prev => ({ ...prev, debouncedSearch: prev.search }));
    }, 300);
    return () => clearTimeout(timer);
  }, [filters.search]);

  // Filter and search users
  const filteredUsers = useMemo(() => {
    let filtered = users;
    
    // Branch filter for admin role
    if (currentUser?.role === 'admin') {
      const adminBranch = currentUser.branch || currentUser.provinceCode;
      if (adminBranch) {
        filtered = filtered.filter(user => {
          const userBranch = user.branch || user.provinceCode;
          return userBranch === adminBranch;
        });
      }
    }
    
    // Search filter
    filtered = filtered.filter(user => {
      const matchesSearch = user.name.toLowerCase().includes(filters.debouncedSearch.toLowerCase()) ||
                           user.email.toLowerCase().includes(filters.debouncedSearch.toLowerCase()) ||
                           user.employeeId?.toLowerCase().includes(filters.debouncedSearch.toLowerCase());
      const matchesStatus = filters.status === 'all' || user.status === filters.status;
      
      // Branch filter
      let matchesBranch = true;
      if (filters.branch !== 'all') {
        const userBranch = user.branch || user.provinceCode;
        matchesBranch = userBranch === filters.branch;
      }
      
      return matchesSearch && matchesStatus && matchesBranch;
    });
    
    return filtered;
  }, [users, filters.debouncedSearch, filters.status, filters.branch, currentUser]);

  const openDetail = (user: User) => {
    setSelectedUser(user);
    setModals(prev => ({ ...prev, detail: true }));
  };

  const closeDetail = () => {
    setModals(prev => ({ ...prev, detail: false }));
    setSelectedUser(null);
  };

  // Edit user
  const openEditUser = (user?: User) => {
    const userToEdit = user || selectedUser;
    if (!userToEdit) return;
    
    setEditing(prev => ({
      ...prev,
      user: userToEdit,
      form: {
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
      }
    }));
    setModals(prev => ({ ...prev, editUser: true }));
  };

  const closeEditUser = () => {
    setModals(prev => ({ ...prev, editUser: false }));
    setEditing(prev => ({ ...prev, user: null, form: {} }));
  };

  const saveEditUser = async (form: Record<string, string | number | boolean | null>) => {
    if (!form.name || !form.email || !form.phone) {
      setUi(prev => ({
        ...prev,
        alertDialog: {
          isOpen: true,
          type: 'error',
          title: 'ข้อมูลไม่ครบ',
          message: 'กรุณากรอกข้อมูลให้ครบถ้วน (ชื่อ, อีเมล, เบอร์โทร)',
          autoClose: false
        }
      }));
      return;
    }

    if (!editing.user) return;

    const { emergencyContactName, emergencyContactPhone, emergencyContactRelation, ...restForm } = form;
    const updatedUserData = {
      ...restForm,
      emergencyContact: {
        name: emergencyContactName,
        phone: emergencyContactPhone,
        relation: emergencyContactRelation
      }
    };

    try {
      const savedUser = await userService.updateUser(editing.user.id, updatedUserData);
      const updatedUsers = users.map(u =>
        u.id === editing.user!.id ? { ...u, ...savedUser } : u
      );
      setUsers(updatedUsers);
      if (selectedUser && selectedUser.id === editing.user!.id) {
        setSelectedUser(updatedUsers.find(u => u.id === editing.user!.id) || null);
      }
      closeEditUser();

      let successMessage = 'แก้ไขข้อมูลผู้ใช้เรียบร้อยแล้ว';
      if (savedUser.adminPassword) {
        successMessage += `\n\nรหัส Admin Dashboard: ${savedUser.adminPassword}`;
      }

      setUi(prev => ({
        ...prev,
        alertDialog: {
          isOpen: true,
          type: 'success',
          title: 'บันทึกสำเร็จ',
          message: successMessage,
          autoClose: !savedUser.adminPassword
        }
      }));
    } catch (err: unknown) {
      // ดึง message จาก axios response ถ้ามี
      const axiosMsg = (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data?.message
        ?? (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      const msg = axiosMsg || (err instanceof Error ? err.message : 'ไม่สามารถบันทึกข้อมูลได้');
      setUi(prev => ({
        ...prev,
        alertDialog: { isOpen: true, type: 'error', title: 'เกิดข้อผิดพลาด', message: msg, autoClose: false }
      }));
    }
  };

  // Delete user
  const handleDeleteUser = (userToDelete: User) => {
    if (currentUser?.role === 'admin' && userToDelete.role === 'superadmin') {
      setUi(prev => ({
        ...prev,
        alertDialog: {
          isOpen: true,
          type: 'error',
          title: 'ไม่มีสิทธิ์',
          message: 'Admin ไม่สามารถลบ Super Admin ได้',
          autoClose: true
        }
      }));
      return;
    }

    closeDetail();
    setUi(prev => ({ ...prev, deleteCandidate: userToDelete }));
  };

  const cancelDelete = () => {
    setUi(prev => ({ ...prev, deleteCandidate: null }));
    if (selectedUser) {
      setModals(prev => ({ ...prev, detail: true }));
    }
  };

  const confirmDeleteUser = () => {
    if (!ui.deleteCandidate) return;
    
    const updatedUsers = users.filter(u => u.id !== ui.deleteCandidate!.id);
    setUsers(updatedUsers);
    
    if (selectedUser && selectedUser.id === ui.deleteCandidate.id) {
      closeDetail();
    }

    setUi(prev => ({
      ...prev,
      alertDialog: {
        isOpen: true,
        type: 'success',
        title: 'ลบสำเร็จ',
        message: `ลบ ${prev.deleteCandidate?.name} เรียบร้อยแล้ว`,
        autoClose: true
      },
      deleteCandidate: null
    }));
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
      setUi(prev => ({
        ...prev,
        alertDialog: {
          isOpen: true,
          type: 'info',
          title: 'กำลังสร้าง PDF',
          message: 'กรุณารอสักครู่...',
          autoClose: false
        }
      }));

      await generateUserPDF(selectedUser);
      
      setUi(prev => ({
        ...prev,
        alertDialog: {
          isOpen: true,
          type: 'success',
          title: 'สำเร็จ',
          message: 'ดาวน์โหลด PDF เรียบร้อยแล้ว',
          autoClose: true
        }
      }));
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      setUi(prev => ({
        ...prev,
        alertDialog: {
          isOpen: true,
          type: 'error',
          title: 'เกิดข้อผิดพลาด',
          message: `ไม่สามารถสร้าง PDF ได้: ${errorMessage}`,
          autoClose: true
        }
      }));
    }
  };

  // Create new user
  const handleCreateUser = async (newUser: User) => {
    try {
      const created = await userService.createUser({
        name: newUser.name,
        email: newUser.email,
        phone: newUser.phone,
        department: newUser.department,
        position: newUser.position,
        role: newUser.role,
        title: newUser.title,
        gender: newUser.gender,
        branchCode: newUser.provinceCode || newUser.branch,
        nationalId: newUser.nationalId,
        birthDate: newUser.birthDate,
        address: newUser.address,
        bloodType: newUser.bloodType,
        emergencyContact: newUser.emergencyContact,
      });

      setUsers(prev => [...prev, created]);

      setUi(prev => ({
        ...prev,
        alertDialog: {
          isOpen: true,
          type: 'success',
          title: 'เพิ่มผู้ใช้สำเร็จ',
          message: `เพิ่ม ${created.name} เข้าระบบเรียบร้อยแล้ว\n\nรหัสพนักงาน: ${created.employeeId}`,
          autoClose: false
        }
      }));
    } catch (err: unknown) {
      const axiosMsg = (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data?.message
        ?? (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      const message = axiosMsg || (err instanceof Error ? err.message : 'ไม่สามารถสร้างผู้ใช้ได้');
      setUi(prev => ({
        ...prev,
        alertDialog: {
          isOpen: true,
          type: 'error',
          title: 'เกิดข้อผิดพลาด',
          message,
          autoClose: true
        }
      }));
    }
  };

  // CSV Import
  const handleCsvFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.name.endsWith('.csv')) {
      setUi(prev => ({
        ...prev,
        alertDialog: {
          isOpen: true,
          type: 'error',
          title: 'ไฟล์ไม่ถูกต้อง',
          message: 'กรุณาเลือกไฟล์ .csv เท่านั้น'
        }
      }));
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

  const handleParseCsvData = (text: string) => {
    try {
      const data = parseCsvData(text);
      
      if (data.length === 0) {
        setUi(prev => ({
          ...prev,
          alertDialog: {
            isOpen: true,
            type: 'error',
            title: 'ไฟล์ว่างเปล่า',
            message: 'ไม่พบข้อมูลในไฟล์ CSV'
          }
        }));
        return;
      }

      setCsvData(data);
      setCsvText(text);
      setModals(prev => ({ ...prev, csv: true }));
    } catch {
      setUi(prev => ({
        ...prev,
        alertDialog: {
          isOpen: true,
          type: 'error',
          title: 'เกิดข้อผิดพลาด',
          message: 'ไม่สามารถอ่านไฟล์ CSV ได้ กรุณาตรวจสอบรูปแบบไฟล์'
        }
      }));
    }
  };

  const confirmCsvImport = async () => {
    try {
      setUi(prev => ({
        ...prev,
        alertDialog: {
          isOpen: true,
          type: 'info',
          title: 'กำลังนำเข้าข้อมูล',
          message: 'กรุณารอสักครู่...',
          autoClose: false
        }
      }));

      const result = await userService.bulkCreateUsers(csvText);

      // Reload users from server
      if (currentUser) {
        const loadedUsers = await userService.getManageUsers(currentUser);
        setUsers(loadedUsers.users);
      }

      setModals(prev => ({ ...prev, csv: false }));
      setCsvData([]);
      setCsvText('');

      setUi(prev => ({
        ...prev,
        alertDialog: {
          isOpen: true,
          type: 'success',
          title: 'นำเข้าสำเร็จ',
          message: `นำเข้าข้อมูลพนักงาน ${result.success} บัญชี เรียบร้อยแล้ว${result.failed > 0 ? `\nล้มเหลว ${result.failed} บัญชี` : ''}`,
          autoClose: true
        }
      }));
    } catch (err: unknown) {
      const axiosMsg = (err as { response?: { data?: { message?: string; error?: string } } })?.response?.data?.message
        ?? (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      const msg = axiosMsg || (err instanceof Error ? err.message : 'ไม่สามารถนำเข้าข้อมูลได้');
      setUi(prev => ({
        ...prev,
        alertDialog: { isOpen: true, type: 'error', title: 'เกิดข้อผิดพลาด', message: msg, autoClose: false }
      }));
    }
  };

  const closeCsvModal = () => {
    setModals(prev => ({ ...prev, csv: false }));
    setCsvData([]);
    setCsvText('');
  };

  const handleAttendanceEdit = (editData: AttendanceEditData | null) => {
    setEditing(prev => ({
      ...prev,
      attendance: editData,
      attendanceForm: editData ? (editData.data || {}) : {}
    }));
  };

  const saveAttendanceEdit = () => {
    // Mock implementation
    setUi(prev => ({
      ...prev,
      alertDialog: {
        isOpen: true,
        type: 'success',
        title: 'บันทึกสำเร็จ!',
        message: 'บันทึกการแก้ไขข้อมูลการเข้า-ออกงานเรียบร้อยแล้ว',
        autoClose: true
      }
    }));
    setEditing(prev => ({
      ...prev,
      attendance: null,
      attendanceForm: {}
    }));
  };

  const closeAlertDialog = () => {
    setUi(prev => ({ ...prev, alertDialog: { ...prev.alertDialog, isOpen: false } }));
  };

  const fetchAttendanceForUser = async () => {
    if (!selectedUser) return;
    setModals(prev => ({ ...prev, loadingAttendance: true }));
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30);
      const records = await attendanceService.getMyHistory(Number(selectedUser.id), {
        startDate: startDate.toISOString().split('T')[0],
        endDate: endDate.toISOString().split('T')[0],
      });
      const mapped: AttendanceRecord[] = records.map(r => ({
        date: r.checkIn ? new Date(r.checkIn).toLocaleDateString('th-TH') : '-',
        checkIn: r.checkIn ? {
          time: new Date(r.checkIn).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
          status: r.status === 'ON_TIME' ? 'onTime' as const : 'late' as const,
          photo: r.checkInPhoto || undefined,
        } : undefined,
        checkOut: r.checkOut ? {
          time: new Date(r.checkOut).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }),
          photo: r.checkOutPhoto || undefined,
        } : undefined,
      }));
      setSelectedUser(prev => prev ? { ...prev, attendanceRecords: mapped } : prev);
    } catch (err) {
      console.error('Failed to fetch attendance:', err);
    } finally {
      setModals(prev => ({ ...prev, loadingAttendance: false }));
    }
  };

  const getFilteredAttendanceRecords = (): AttendanceRecord[] => {
    if (!selectedUser || !selectedUser.attendanceRecords) return [];
    
    if (ui.selectedDate) {
      return selectedUser.attendanceRecords.filter(record => record.date === ui.selectedDate);
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
            <input 
              id="csv-file-input-super"
              type="file" 
              accept=".csv" 
              onChange={handleCsvFileChange}
              className="hidden"
            />
            <Button 
              onClick={() => document.getElementById('csv-file-input-super')?.click()}
              className="flex items-center gap-2 bg-gray-900 hover:bg-gray-700"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
              นำเข้าไฟล์ CSV
            </Button>
            <Button 
              onClick={() => setModals(prev => ({ ...prev, createUser: true }))}
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
              value={filters.search}
              onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
              className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 rounded-xl focus:border-gray-900 focus:outline-none transition-colors"
            />
          </div>
          <select
            value={filters.status}
            onChange={(e) => setFilters(prev => ({ ...prev, status: e.target.value }))}
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
              value={filters.branch}
              onChange={(e) => setFilters(prev => ({ ...prev, branch: e.target.value }))}
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
        {isLoading ? (
          <div className="flex items-center justify-center py-16">
            <div className="w-10 h-10 border-b-2 border-orange-600 rounded-full animate-spin"></div>
            <span className="ml-3 text-gray-500">กำลังโหลดข้อมูลสมาชิก...</span>
          </div>
        ) : apiError ? (
          <div className="py-10 text-center text-red-500">{apiError}</div>
        ) : (
        <UserTable 
          users={filteredUsers}
          onSelectUser={openDetail}
          getStatusBadge={getStatusBadge}
          currentUser={currentUser}
          onAttendanceEdit={handleAttendanceEdit}
          onSaveAttendanceEdit={saveAttendanceEdit}
          editingAttendance={editing.attendance}
          attendanceForm={editing.attendanceForm}
          onAttendanceFormChange={(form) => setEditing(prev => ({ ...prev, attendanceForm: form }))}
        />
        )}

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
        {modals.detail && selectedUser && (
          <UserDetailModal
            user={selectedUser}
            showDetail={modals.detail}
            showAttendance={modals.attendance}
            loadingAttendance={modals.loadingAttendance}
            selectedDate={ui.selectedDate}
            currentUser={currentUser}
            onClose={closeDetail}
            onEdit={openEditUser}
            onDownloadPDF={downloadPDF}
            onDelete={handleDeleteUser}
            onToggleAttendance={() => {
              const willShow = !modals.attendance;
              setModals(prev => ({ ...prev, attendance: willShow }));
              if (willShow && (!selectedUser?.attendanceRecords || selectedUser.attendanceRecords.length === 0)) {
                fetchAttendanceForUser();
              }
            }}
            getStatusBadge={getStatusBadge}
            getFilteredAttendanceRecords={getFilteredAttendanceRecords}
            onSetSelectedDate={(date) => setUi(prev => ({ ...prev, selectedDate: date }))}
          />
        )}

        {modals.editUser && editing.user && (
          <UserEditModal
            show={modals.editUser}
            editingUser={editing.user}
            currentUser={currentUser}
            onClose={closeEditUser}
            onSave={saveEditUser}
          />
        )}

        {modals.csv && (
          <CsvImportModal
            isOpen={modals.csv}
            csvData={csvData}
            onConfirm={confirmCsvImport}
            onClose={closeCsvModal}
          />
        )}

        {modals.createUser && (
          <UserCreateModal
            isOpen={modals.createUser}
            onClose={() => setModals(prev => ({ ...prev, createUser: false }))}
            onSubmit={handleCreateUser}
            generateEmployeeId={(provinceCode, branchCode) => generateEmployeeId(provinceCode, branchCode, users)}
            users={users}
          />
        )}
      </Suspense>

      {/* Alert Dialog */}
      <AlertDialog
        isOpen={ui.alertDialog.isOpen}
        onClose={closeAlertDialog}
        type={ui.alertDialog.type}
        title={ui.alertDialog.title}
        message={ui.alertDialog.message}
        autoClose={ui.alertDialog.autoClose}
      />

      {/* Delete confirmation modal */}
      {ui.deleteCandidate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={cancelDelete}></div>
          <Card className="relative z-10 w-full max-w-lg p-6 mx-4 shadow-2xl">
            <h3 className="mb-2 text-lg font-semibold">ยืนยันการลบ</h3>
            <p className="text-sm text-gray-700">
              คุณแน่ใจหรือไม่ที่จะลบ &quot;{ui.deleteCandidate.name}&quot;? การดำเนินการนี้ไม่สามารถย้อนกลับได้
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
