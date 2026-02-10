'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FancySelect } from '@/components/ui/fancy-select';
import { useLocations, useAuth } from '@/contexts/mock-contexts';

interface Shift {
  id: string;
  name: string;
  startTime: string;
  endTime: string;
  workDays: string[];
  locationId?: string;
  branchId?: string;
  assignedUserIds: string[];
  isActive: boolean;
}

interface Employee {
  id: string;
  name: string;
  employeeId: string;
  department: string;
  position: string;
  branch: string;
}

interface LocationData {
  id: string;
  name: string;
  description?: string;
  latitude: number;
  longitude: number;
  radius: number;
  branchCode?: string;
  provinceCode?: string;
  team?: string;
  time?: string;
}

const mockEmployees: Employee[] = [
  { id: 'emp-1', name: 'สมชาย ใจดี', employeeId: 'BKK0010001', department: 'IT', position: 'Senior Developer', branch: 'BKK' },
  { id: 'emp-2', name: 'สมหญิง สวยงาม', employeeId: 'BKK0010002', department: 'HR', position: 'HR Manager', branch: 'BKK' },
  { id: 'emp-3', name: 'สมศักดิ์ รักงาน', employeeId: 'BKK0010003', department: 'Sales', position: 'Sales Manager', branch: 'BKK' },
  { id: 'emp-4', name: 'สมใจ ดีใจ', employeeId: 'CNX0010001', department: 'IT', position: 'Developer', branch: 'CNX' },
  { id: 'emp-5', name: 'สมพร มั่งคั่ง', employeeId: 'CNX0010002', department: 'Finance', position: 'Accountant', branch: 'CNX' },
  { id: 'emp-6', name: 'สมร รักสงบ', employeeId: 'CNX0010003', department: 'Operations', position: 'Supervisor', branch: 'CNX' },
];

const branchOptions = [
  { value: 'all', label: 'ทั้งหมด' },
  { value: 'BKK', label: 'BKK - กรุงเทพ', description: 'สำนักงานใหญ่' },
  { value: 'CNX', label: 'CNX - เชียงใหม่', description: 'สาขาภาคเหนือ' },
];

const mockShifts: Shift[] = [
  {
    id: '1',
    name: 'กะเช้า',
    startTime: '08:00',
    endTime: '16:00',
    workDays: ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์'],
    branchId: 'BKK',
    assignedUserIds: ['emp-1', 'emp-2'],
    isActive: true,
  },
  {
    id: '2',
    name: 'กะบ่าย',
    startTime: '16:00',
    endTime: '00:00',
    workDays: ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์'],
    branchId: 'BKK',
    assignedUserIds: ['emp-3'],
    isActive: true,
  },
  {
    id: '3',
    name: 'กะดึก',
    startTime: '00:00',
    endTime: '08:00',
    workDays: ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์'],
    branchId: 'CNX',
    assignedUserIds: [],
    isActive: true,
  },
];

const weekDays = ['จันทร์', 'อังคาร', 'พุธ', 'พฤหัสบดี', 'ศุกร์', 'เสาร์', 'อาทิตย์'];

export default function ShiftManagementPage() {
  const locationContext = useLocations();
  const locations = locationContext.getFilteredLocations(null) as LocationData[];
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'superadmin';
  
  const [shifts, setShifts] = useState<Shift[]>(mockShifts);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showEmployeePicker, setShowEmployeePicker] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState<Shift | null>(null);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [employeeSearch, setEmployeeSearch] = useState('');
  
  const [formData, setFormData] = useState({
    name: '',
    startTime: '',
    endTime: '',
    workDays: [] as string[],
    locationId: '',
    branchId: '',
    assignedUserIds: [] as string[],
  });

  const handleCreateShift = () => {
    setEditingShift(null);
    setFormData({ name: '', startTime: '', endTime: '', workDays: [], locationId: '', branchId: '', assignedUserIds: [] });
    setShowCreateModal(true);
  };

  const handleEditShift = (shift: Shift) => {
    setEditingShift(shift);
    setFormData({
      name: shift.name,
      startTime: shift.startTime,
      endTime: shift.endTime,
      workDays: [...shift.workDays],
      locationId: shift.locationId || '',
      branchId: shift.branchId || '',
      assignedUserIds: [...shift.assignedUserIds],
    });
    setShowCreateModal(true);
  };

  const handleToggleWorkDay = (day: string) => {
    setFormData(prev => ({
      ...prev,
      workDays: prev.workDays.includes(day)
        ? prev.workDays.filter(d => d !== day)
        : [...prev.workDays, day],
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.startTime || !formData.endTime || formData.workDays.length === 0) {
      alert('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    if (editingShift) {
      // Update existing shift
      setShifts(shifts.map(s => 
        s.id === editingShift.id 
          ? { ...s, ...formData }
          : s
      ));
    } else {
      // Create new shift
      const newShift: Shift = {
        id: Date.now().toString(),
        ...formData,
        assignedUserIds: formData.assignedUserIds,
        isActive: true,
      };
      setShifts([...shifts, newShift]);
    }

    setShowCreateModal(false);
    setFormData({ name: '', startTime: '', endTime: '', workDays: [], locationId: '', branchId: '', assignedUserIds: [] });
  };

  const handleToggleEmployee = (employeeId: string) => {
    setFormData(prev => ({
      ...prev,
      assignedUserIds: prev.assignedUserIds.includes(employeeId)
        ? prev.assignedUserIds.filter(id => id !== employeeId)
        : [...prev.assignedUserIds, employeeId],
    }));
  };

  const getFilteredEmployees = () => {
    let employees = mockEmployees;
    
    // Admin: filter by own branch only
    // SuperAdmin: filter by selected branch (if any)
    if (!isSuperAdmin) {
      // Admin sees only their own branch
      const adminBranch = user?.branch || user?.provinceCode;
      if (adminBranch) {
        employees = employees.filter(emp => emp.branch === adminBranch);
      }
    } else {
      // SuperAdmin: filter by selected branch if specified
      if (formData.branchId && formData.branchId !== 'all') {
        employees = employees.filter(emp => emp.branch === formData.branchId);
      }
    }
    
    // Filter by search
    if (employeeSearch) {
      const search = employeeSearch.toLowerCase();
      employees = employees.filter(emp =>
        emp.name.toLowerCase().includes(search) ||
        emp.employeeId.toLowerCase().includes(search) ||
        emp.department.toLowerCase().includes(search)
      );
    }
    
    return employees;
  };

  const handleToggleActive = (shiftId: string) => {
    setShifts(shifts.map(s => 
      s.id === shiftId ? { ...s, isActive: !s.isActive } : s
    ));
  };

  const handleDeleteShift = (shiftId: string) => {
    if (confirm('คุณแน่ใจหรือไม่ที่จะลบกะงานนี้?')) {
      setShifts(shifts.filter(s => s.id !== shiftId));
    }
  };

  return (
    <div className="min-h-screen p-4 bg-slate-50 sm:p-6">
      <Card className="p-6 border border-orange-100 shadow-sm">
        {/* Header */}
        <div className="flex flex-col items-start justify-between gap-4 mb-6 sm:flex-row sm:items-center">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold text-gray-900">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              จัดการตารางงาน
            </h1>
            <p className="mt-1 text-gray-600">สร้างและจัดการกะการทำงานของพนักงาน</p>
          </div>
          <Button 
            onClick={handleCreateShift}
            className="bg-orange-600 hover:bg-orange-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            สร้างกะงานใหม่
          </Button>
        </div>

        {/* Shift List */}
        <div className="space-y-4">
          {shifts.length === 0 ? (
            <Card className="p-12 text-center">
              <div className="text-gray-400 text-6xl mb-4">🕒</div>
              <p className="text-gray-500 text-lg">ยังไม่มีกะงาน</p>
              <p className="text-gray-400 text-sm mt-2">คลิกปุ่ม &ldquo;สร้างกะงานใหม่&rdquo; เพื่อเริ่มต้น</p>
            </Card>
          ) : (
            shifts.map((shift) => (
              <Card key={shift.id} className="p-6">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-xl font-bold text-gray-900">{shift.name}</h3>
                      <Badge variant={shift.isActive ? 'default' : 'secondary'}>
                        {shift.isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                      </Badge>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-gray-700">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="font-medium">เวลา:</span>
                        <span>{shift.startTime} - {shift.endTime}</span>
                      </div>

                      <div className="flex items-start gap-2 text-gray-700">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                        <div>
                          <span className="font-medium">วันทำงาน:</span>
                          <div className="flex flex-wrap gap-2 mt-2">
                            {shift.workDays.map((day) => (
                              <Badge key={day} variant="outline">{day}</Badge>
                            ))}
                          </div>
                        </div>
                      </div>

                      {shift.branchId && (
                        <div className="flex items-center gap-2 text-gray-700">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                          </svg>
                          <span className="font-medium">สาขา:</span>
                          <span>{branchOptions.find(b => b.value === shift.branchId)?.label || 'ไม่ระบุ'}</span>
                        </div>
                      )}

                      <div className="flex items-center gap-2 text-gray-700">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                        </svg>
                        <span className="font-medium">พนักงานที่มอบหมาย:</span>
                        <span>{shift.assignedUserIds.length} คน</span>
                      </div>

                      {shift.locationId && (
                        <div className="flex items-center gap-2 text-gray-700">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span className="font-medium">สถานที่:</span>
                          <span>{locations.find((loc: LocationData) => loc.id === shift.locationId)?.name || 'ไม่ระบุ'}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex gap-2 sm:flex-col">
                    <Button
                      onClick={() => setShowDetailModal(shift)}
                      variant="outline"
                      size="sm"
                      className="flex-1 sm:flex-none"
                    >
                      ดูรายละเอียด
                    </Button>
                    <Button
                      onClick={() => handleEditShift(shift)}
                      variant="outline"
                      size="sm"
                      className="flex-1 sm:flex-none"
                    >
                      แก้ไข
                    </Button>
                    <Button
                      onClick={() => handleToggleActive(shift.id)}
                      variant="outline"
                      size="sm"
                      className="flex-1 sm:flex-none"
                    >
                      {shift.isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                    </Button>
                    <Button
                      onClick={() => handleDeleteShift(shift.id)}
                      variant="outline"
                      size="sm"
                      className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-50 sm:flex-none"
                    >
                      ลบ
                    </Button>
                  </div>
                </div>
              </Card>
            ))
          )}
        </div>
      </Card>

      {/* Create/Edit Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">
                  {editingShift ? 'แก้ไขกะงาน' : 'สร้างกะงานใหม่'}
                </h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Shift Name */}
                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-700">
                    ชื่อกะงาน <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.name}
                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                    placeholder="เช่น กะเช้า, กะบ่าย, กะดึก"
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
                  />
                </div>

                {/* Time Range */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block mb-2 text-sm font-medium text-gray-700">
                      เวลาเริ่มต้น <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="time"
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                  <div>
                    <label className="block mb-2 text-sm font-medium text-gray-700">
                      เวลาสิ้นสุด <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="time"
                      value={formData.endTime}
                      onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
                    />
                  </div>
                </div>

                {/* Work Days */}
                <div>
                  <label className="block mb-3 text-sm font-medium text-gray-700">
                    วันทำงาน <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                    {weekDays.map((day) => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => handleToggleWorkDay(day)}
                        className={`px-4 py-3 rounded-xl border-2 transition-all text-sm font-medium ${
                          formData.workDays.includes(day)
                            ? 'border-orange-500 bg-orange-50 text-orange-700'
                            : 'border-gray-200 hover:border-gray-300 text-gray-700'
                        }`}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Branch (Superadmin only) */}
                {isSuperAdmin && (
                  <div>
                    <label className="block mb-2 text-sm font-medium text-gray-700">
                      สาขา <span className="text-red-500">*</span>
                    </label>
                    <FancySelect
                      options={branchOptions.filter(b => b.value !== 'all')}
                      value={formData.branchId}
                      onChange={(value) => setFormData({ ...formData, branchId: value, assignedUserIds: [] })}
                      placeholder="-- เลือกสาขา --"
                      emptyMessage="ไม่พบสาขา"
                    />
                  </div>
                )}

                {/* Location */}
                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-700">
                    สถานที่เช็คอิน (ไม่บังคับ)
                  </label>
                  <FancySelect
                    options={[
                      { value: '', label: '-- ไม่ระบุสถานที่ --' },
                      ...(locations.map((loc: LocationData) => ({
                        value: loc.id,
                        label: loc.name,
                        description: loc.description || undefined,
                      })))
                    ]}
                    value={formData.locationId}
                    onChange={(value) => setFormData({ ...formData, locationId: value })}
                    placeholder="-- เลือกสถานที่ --"
                    emptyMessage="ไม่พบสถานที่"
                    searchable
                  />
                </div>

                {/* Employee Assignment */}
                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-700">
                    มอบหมายพนักงาน (ไม่บังคับ)
                  </label>
                  <div className="space-y-3">
                    <Button
                      type="button"
                      onClick={() => setShowEmployeePicker(true)}
                      variant="outline"
                      className="w-full justify-start border-2 border-gray-200 hover:border-orange-500 h-auto min-h-12 px-4 py-3 rounded-xl"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                      {formData.assignedUserIds.length > 0 
                        ? `เลือกแล้ว ${formData.assignedUserIds.length} คน` 
                        : 'เลือกพนักงาน'}
                    </Button>
                    
                    {formData.assignedUserIds.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {formData.assignedUserIds.map(empId => {
                          const emp = mockEmployees.find(e => e.id === empId);
                          return emp ? (
                            <Badge key={empId} variant="outline" className="px-3 py-1.5">
                              {emp.name}
                              <button
                                type="button"
                                onClick={() => handleToggleEmployee(empId)}
                                className="ml-2 hover:text-red-600"
                              >
                                ×
                              </button>
                            </Badge>
                          ) : null;
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* Submit Buttons */}
                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    variant="outline"
                    className="flex-1"
                  >
                    ยกเลิก
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-orange-600 hover:bg-orange-700"
                  >
                    {editingShift ? 'บันทึกการแก้ไข' : 'สร้างกะงาน'}
                  </Button>
                </div>
              </form>
            </div>
          </Card>
        </div>
      )}

      {/* Employee Picker Modal */}
      {showEmployeePicker && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <Card className="w-full max-w-2xl max-h-[90vh] overflow-hidden flex flex-col">
            <div className="p-6 border-b">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-2xl font-bold text-gray-900">เลือกพนักงาน</h2>
                <button
                  onClick={() => {
                    setShowEmployeePicker(false);
                    setEmployeeSearch('');
                  }}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Search */}
              <input
                type="text"
                value={employeeSearch}
                onChange={(e) => setEmployeeSearch(e.target.value)}
                placeholder="ค้นหาชื่อ, รหัสพนักงาน, หรือแผนก..."
                className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
              />
            </div>

            <div className="flex-1 overflow-y-auto p-4">
              {getFilteredEmployees().length === 0 ? (
                <div className="py-12 text-center text-gray-500">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-16 h-16 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                  </svg>
                  <p>ไม่พบพนักงาน</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {getFilteredEmployees().map((emp) => (
                    <label
                      key={emp.id}
                      className="flex items-start gap-3 p-4 border-2 border-gray-200 rounded-xl cursor-pointer hover:border-orange-300 hover:bg-orange-50/50 transition-all"
                    >
                      <input
                        type="checkbox"
                        checked={formData.assignedUserIds.includes(emp.id)}
                        onChange={() => handleToggleEmployee(emp.id)}
                        className="mt-1 w-5 h-5 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                      />
                      <div className="flex-1">
                        <div className="font-medium text-gray-900">{emp.name}</div>
                        <div className="text-sm text-gray-500">
                          {emp.employeeId} • {emp.department} • {emp.position}
                        </div>
                        <div className="text-xs text-gray-400 mt-1">
                          สาขา: {branchOptions.find(b => b.value === emp.branch)?.label || emp.branch}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              )}
            </div>

            <div className="p-4 border-t bg-gray-50">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-600">
                  เลือกแล้ว {formData.assignedUserIds.length} คน
                </span>
                <Button
                  onClick={() => {
                    setShowEmployeePicker(false);
                    setEmployeeSearch('');
                  }}
                  className="bg-orange-600 hover:bg-orange-700"
                >
                  เสร็จสิ้น
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Detail Modal */}
      {showDetailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <Card className="w-full max-w-3xl max-h-[90vh] overflow-y-auto">
            <div className="p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-2xl font-bold text-gray-900">รายละเอียดกะงาน</h2>
                <button
                  onClick={() => setShowDetailModal(null)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <div className="space-y-6">
                {/* Shift Info */}
                <div className="p-6 bg-orange-50 rounded-2xl">
                  <div className="flex items-center gap-3 mb-4">
                    <h3 className="text-2xl font-bold text-gray-900">{showDetailModal.name}</h3>
                    <Badge variant={showDetailModal.isActive ? 'default' : 'secondary'}>
                      {showDetailModal.isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                    </Badge>
                  </div>
                  <div className="grid gap-3 text-gray-700">
                    <div className="flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="font-medium">เวลา:</span>
                      <span>{showDetailModal.startTime} - {showDetailModal.endTime}</span>
                    </div>
                    {showDetailModal.branchId && (
                      <div className="flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        <span className="font-medium">สาขา:</span>
                        <span>{branchOptions.find(b => b.value === showDetailModal.branchId)?.label || 'ไม่ระบุ'}</span>
                      </div>
                    )}
                    {showDetailModal.locationId && (
                      <div className="flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="font-medium">สถานที่:</span>
                        <span>{locations.find((loc: LocationData) => loc.id === showDetailModal.locationId)?.name || 'ไม่ระบุ'}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Work Days */}
                <div>
                  <h4 className="flex items-center gap-2 mb-3 text-lg font-bold text-gray-900">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    วันทำงาน
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {showDetailModal.workDays.map((day) => (
                      <Badge key={day} variant="outline" className="px-4 py-2">{day}</Badge>
                    ))}
                  </div>
                </div>

                {/* Assigned Employees */}
                <div>
                  <h4 className="flex items-center gap-2 mb-3 text-lg font-bold text-gray-900">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    พนักงานที่มอบหมาย ({showDetailModal.assignedUserIds.length} คน)
                  </h4>
                  {showDetailModal.assignedUserIds.length === 0 ? (
                    <p className="text-gray-500">ยังไม่มีการมอบหมายพนักงาน</p>
                  ) : (
                    <div className="grid gap-3">
                      {showDetailModal.assignedUserIds.map(empId => {
                        const emp = mockEmployees.find(e => e.id === empId);
                        return emp ? (
                          <Card key={empId} className="p-4">
                            <div className="flex items-start justify-between">
                              <div>
                                <h5 className="font-bold text-gray-900">{emp.name}</h5>
                                <p className="text-sm text-gray-600">{emp.employeeId}</p>
                                <p className="text-sm text-gray-500">{emp.department} • {emp.position}</p>
                              </div>
                              <Badge variant="outline">{emp.branch}</Badge>
                            </div>
                          </Card>
                        ) : null;
                      })}
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6">
                <Button
                  onClick={() => setShowDetailModal(null)}
                  variant="outline"
                  className="w-full"
                >
                  ปิด
                </Button>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
