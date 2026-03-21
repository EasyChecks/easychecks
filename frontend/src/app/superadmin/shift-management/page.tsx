'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { shiftService } from '@/services/shift';
import { userService, type UserServiceUser } from '@/services/user';
import { Shift, CreateShiftRequest, UpdateShiftRequest } from '@/types/attendance';

const weekDays = [
  { th: 'จันทร์', en: 'MONDAY' },
  { th: 'อังคาร', en: 'TUESDAY' },
  { th: 'พุธ', en: 'WEDNESDAY' },
  { th: 'พฤหัสบดี', en: 'THURSDAY' },
  { th: 'ศุกร์', en: 'FRIDAY' },
  { th: 'เสาร์', en: 'SATURDAY' },
  { th: 'อาทิตย์', en: 'SUNDAY' },
];

const shiftTypes = [
  { value: 'REGULAR', label: 'ทุกวัน', description: 'ทำงานทุกวันตามที่กำหนด' },
  { value: 'SPECIFIC_DAY', label: 'เฉพาะวัน', description: 'เลือกวันที่ทำงาน (จ-อา)' },
  { value: 'CUSTOM', label: 'กำหนดเอง', description: 'ระบุวันที่เฉพาะเจาะจง' },
];

export default function ShiftManagementPage() {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [users, setUsers] = useState<UserServiceUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState<Shift | null>(null);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [searchText, setSearchText] = useState('');
  const [filterShiftType, setFilterShiftType] = useState<'ALL' | 'REGULAR' | 'SPECIFIC_DAY' | 'CUSTOM'>('ALL');
  const [filterActive, setFilterActive] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL');
  const [filterUserId, setFilterUserId] = useState<number | 'ALL'>('ALL');
  const [filterLocationId, setFilterLocationId] = useState<number | 'ALL'>('ALL');
  const [filterBranchName, setFilterBranchName] = useState<string>('ALL');
  const [page, setPage] = useState(1);
  const pageSize = 9;
  const [toggleTargetShift, setToggleTargetShift] = useState<Shift | null>(null);
  const [deleteTargetShift, setDeleteTargetShift] = useState<Shift | null>(null);
  const [deleteReason, setDeleteReason] = useState('');
  const [reassignModal, setReassignModal] = useState<
    | {
      mode: 'edit';
      message: string;
      shiftId: number;
      updateData: UpdateShiftRequest;
    }
    | {
      mode: 'create';
      baseCreateData: Omit<CreateShiftRequest, 'userId'>;
      conflictUserIds: number[];
      conflictUsersText: string;
    }
    | null
  >(null);
  
  const [formData, setFormData] = useState<{
    name: string;
    shiftType: 'REGULAR' | 'SPECIFIC_DAY' | 'CUSTOM';
    startTime: string;
    endTime: string;
    gracePeriodMinutes: number;
    lateThresholdMinutes: number;
    specificDays: ('MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY')[];
    customDate: string;
    userIds: number[];
  }>({
    name: '',
    shiftType: 'REGULAR',
    startTime: '',
    endTime: '',
    gracePeriodMinutes: 15,
    lateThresholdMinutes: 30,
    specificDays: [],
    customDate: '',
    userIds: [],
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [shiftsData, usersData] = await Promise.all([
        shiftService.getAll(),
        userService.getAll(),
      ]);
      setShifts(shiftsData);
      setUsers(usersData.filter(u => u.isActive));
    } catch (error) {
      console.error('Error loading data:', error);
      alert('เกิดข้อผิดพลาดในการโหลดข้อมูล');
    } finally {
      setLoading(false);
    }
  };

  const handleCreateShift = () => {
    setEditingShift(null);
    setFormData({
      name: '',
      shiftType: 'REGULAR',
      startTime: '',
      endTime: '',
      gracePeriodMinutes: 15,
      lateThresholdMinutes: 30,
      specificDays: [],
      customDate: '',
      userIds: [],
    });
    setShowCreateModal(true);
  };

  const handleEditShift = (shift: Shift) => {
    setEditingShift(shift);
    setFormData({
      name: shift.name,
      shiftType: shift.shiftType,
      startTime: shift.startTime,
      endTime: shift.endTime,
      gracePeriodMinutes: shift.gracePeriodMinutes,
      lateThresholdMinutes: shift.lateThresholdMinutes,
      specificDays: shift.specificDays || [],
      customDate: shift.customDate || '',
      userIds: shift.userId ? [shift.userId] : [],
    });
    setShowCreateModal(true);
  };

  const isActiveShiftConflictError = (message: string) => {
    const lower = message.toLowerCase();
    return lower.includes('active shift') || message.includes('ยืนยันการย้ายกะ') || message.includes('อยู่แล้ว');
  };

  const finalizeSaveSuccess = async (message: string) => {
    await loadData();
    setShowCreateModal(false);
    alert(message);
  };

  const handleToggleWorkDay = (day: string) => {
    setFormData(prev => ({
      ...prev,
      specificDays: prev.specificDays.includes(day as any)
        ? prev.specificDays.filter(d => d !== day)
        : [...prev.specificDays, day as any],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.name || !formData.startTime || !formData.endTime) {
      alert('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    if (formData.shiftType === 'SPECIFIC_DAY' && formData.specificDays.length === 0) {
      alert('กรุณาเลือกวันที่ทำงาน');
      return;
    }

    if (formData.shiftType === 'CUSTOM' && !formData.customDate) {
      alert('กรุณาระบุวันที่ทำงาน');
      return;
    }

    if (formData.userIds.length === 0) {
      alert('กรุณาเลือกพนักงานอย่างน้อย 1 คน');
      return;
    }

    if (editingShift && formData.userIds.length > 1) {
      alert('การแก้ไขกะรองรับพนักงานได้ครั้งละ 1 คน');
      return;
    }

    setLoading(true);
    try {
      if (editingShift) {
        // Update existing shift
        const targetUserId = formData.userIds[0];
        const updateData: UpdateShiftRequest = {
          name: formData.name,
          shiftType: formData.shiftType,
          startTime: formData.startTime,
          endTime: formData.endTime,
          gracePeriodMinutes: formData.gracePeriodMinutes,
          lateThresholdMinutes: formData.lateThresholdMinutes,
          userId: targetUserId,
        };

        if (formData.shiftType === 'SPECIFIC_DAY') {
          updateData.specificDays = formData.specificDays;
        } else if (formData.shiftType === 'CUSTOM') {
          updateData.customDate = formData.customDate;
        }

        try {
          await shiftService.update(editingShift.id, updateData);
        } catch (error: any) {
          const message = error?.response?.data?.message || error?.message || '';
          if (!isActiveShiftConflictError(message)) throw error;

          setReassignModal({
            mode: 'edit',
            message,
            shiftId: editingShift.id,
            updateData,
          });
          return;
        }
      } else {
        // Create new shift (one shift pattern for many employees)
        const baseCreateData: Omit<CreateShiftRequest, 'userId'> = {
          name: formData.name,
          shiftType: formData.shiftType,
          startTime: formData.startTime,
          endTime: formData.endTime,
          gracePeriodMinutes: formData.gracePeriodMinutes,
          lateThresholdMinutes: formData.lateThresholdMinutes,
        };

        if (formData.shiftType === 'SPECIFIC_DAY') {
          baseCreateData.specificDays = formData.specificDays;
        } else if (formData.shiftType === 'CUSTOM') {
          baseCreateData.customDate = formData.customDate;
        }

        const conflictUserIds: number[] = [];

        for (const userId of formData.userIds) {
          try {
            await shiftService.create({ ...baseCreateData, userId });
          } catch (error: any) {
            const message = error?.response?.data?.message || error?.message || '';
            if (isActiveShiftConflictError(message)) {
              conflictUserIds.push(userId);
              continue;
            }
            throw error;
          }
        }

        if (conflictUserIds.length > 0) {
          const conflictUsers = users
            .filter((u) => conflictUserIds.includes(u.id))
            .map((u) => `${u.name} (${u.employeeId})`)
            .join('\n- ');

          setReassignModal({
            mode: 'create',
            baseCreateData,
            conflictUserIds,
            conflictUsersText: conflictUsers,
          });
          return;
        }
      }

      await finalizeSaveSuccess(editingShift ? 'แก้ไขกะงานสำเร็จ' : 'สร้างกะงานสำเร็จ');
    } catch (error: any) {
      console.error('Error saving shift:', error);
      alert(error.response?.data?.message || 'เกิดข้อผิดพลาดในการบันทึกข้อมูล');
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (shift: Shift) => {
    setToggleTargetShift(shift);
  };

  const handleDeleteShift = async (shift: Shift) => {
    setDeleteTargetShift(shift);
    setDeleteReason('');
  };

  const handleConfirmToggleActive = async () => {
    if (!toggleTargetShift) return;

    setLoading(true);
    try {
      await shiftService.update(toggleTargetShift.id, { isActive: !toggleTargetShift.isActive });
      setToggleTargetShift(null);
      await loadData();
    } catch (error: any) {
      console.error('Error toggling shift:', error);
      alert(error.response?.data?.message || 'เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmDeleteShift = async () => {
    if (!deleteTargetShift) return;
    if (!deleteReason.trim()) {
      alert('การลบกะต้องระบุเหตุผล');
      return;
    }

    setLoading(true);
    try {
      await shiftService.delete(deleteTargetShift.id, deleteReason.trim());
      setDeleteTargetShift(null);
      setDeleteReason('');
      await loadData();
      alert('ลบกะงานสำเร็จ');
    } catch (error: any) {
      console.error('Error deleting shift:', error);
      alert(error.response?.data?.message || 'เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReassign = async () => {
    if (!reassignModal) return;

    setLoading(true);
    try {
      if (reassignModal.mode === 'edit') {
        await shiftService.update(
          reassignModal.shiftId,
          { ...reassignModal.updateData, replaceExisting: true },
        );
        await finalizeSaveSuccess('แก้ไขกะงานสำเร็จ');
      } else {
        for (const userId of reassignModal.conflictUserIds) {
          await shiftService.create({ ...reassignModal.baseCreateData, userId, replaceExisting: true });
        }
        await finalizeSaveSuccess('สร้างกะงานสำเร็จ');
      }
      setReassignModal(null);
    } catch (error: any) {
      console.error('Error replacing existing shifts:', error);
      alert(error?.response?.data?.message || 'เกิดข้อผิดพลาดในการย้ายกะ');
    } finally {
      setLoading(false);
    }
  };

  const handleCancelReassign = async () => {
    if (reassignModal?.mode === 'create') {
      setLoading(true);
      try {
        await loadData();
        setShowCreateModal(false);
        alert('สร้างกะงานบางส่วนสำเร็จ (ข้ามพนักงานที่มีกะเดิม)');
      } finally {
        setLoading(false);
      }
    }
    setReassignModal(null);
  };

  const getShiftTypeName = (type: string) => {
    return shiftTypes.find(t => t.value === type)?.label || type;
  };

  const getDayName = (day: string) => {
    return weekDays.find(d => d.en === day)?.th || day;
  };

  const branchOptions = useMemo(() => {
    const names = shifts
      .map((s) => s.user?.branch?.name)
      .filter((name): name is string => Boolean(name));
    return Array.from(new Set(names)).sort();
  }, [shifts]);

  const locationOptions = useMemo(() => {
    const values = shifts
      .filter((s): s is Shift & { location: NonNullable<Shift['location']> } => Boolean(s.location?.id))
      .map((s) => ({ id: s.location!.id, name: s.location!.name }));

    const seen = new Map<number, string>();
    values.forEach((v) => {
      if (!seen.has(v.id)) seen.set(v.id, v.name);
    });
    return Array.from(seen.entries()).map(([id, name]) => ({ id, name }));
  }, [shifts]);

  const filteredShifts = useMemo(() => {
    const q = searchText.trim().toLowerCase();

    return shifts.filter((shift) => {
      if (filterShiftType !== 'ALL' && shift.shiftType !== filterShiftType) return false;
      if (filterActive === 'ACTIVE' && !shift.isActive) return false;
      if (filterActive === 'INACTIVE' && shift.isActive) return false;
      if (filterUserId !== 'ALL' && shift.userId !== filterUserId) return false;
      if (filterLocationId !== 'ALL' && shift.location?.id !== filterLocationId) return false;
      if (filterBranchName !== 'ALL' && shift.user?.branch?.name !== filterBranchName) return false;

      if (!q) return true;
      const merged = [
        shift.name,
        shift.user?.name,
        shift.user?.employeeId,
        shift.location?.name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      return merged.includes(q);
    });
  }, [
    shifts,
    searchText,
    filterShiftType,
    filterActive,
    filterUserId,
    filterLocationId,
    filterBranchName,
  ]);

  const hasActiveFilters = useMemo(() => {
    return Boolean(
      searchText.trim()
      || filterShiftType !== 'ALL'
      || filterActive !== 'ALL'
      || filterUserId !== 'ALL'
      || filterLocationId !== 'ALL'
      || filterBranchName !== 'ALL',
    );
  }, [searchText, filterShiftType, filterActive, filterUserId, filterLocationId, filterBranchName]);

  const shiftStats = useMemo(() => {
    const total = shifts.length;
    const active = shifts.filter((s) => s.isActive).length;
    const inactive = total - active;
    return {
      total,
      active,
      inactive,
      filtered: filteredShifts.length,
    };
  }, [shifts, filteredShifts]);

  const totalPages = Math.max(1, Math.ceil(filteredShifts.length / pageSize));
  const paginatedShifts = useMemo(() => {
    const start = (page - 1) * pageSize;
    return filteredShifts.slice(start, start + pageSize);
  }, [filteredShifts, page]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [searchText, filterShiftType, filterActive, filterUserId, filterLocationId, filterBranchName]);

  if (loading && shifts.length === 0) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 border-4 border-orange-500 border-t-transparent rounded-full animate-spin"></div>
          <p className="text-gray-600">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

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
            disabled={loading}
            className="bg-orange-600 hover:bg-orange-700"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
            </svg>
            สร้างกะงานใหม่
          </Button>
        </div>

        {/* Filters */}
        <Card className="p-4 mb-6 border border-gray-200">
          <div className="grid grid-cols-2 gap-3 mb-4 md:grid-cols-4">
            <div className="p-3 rounded-xl border bg-white">
              <p className="text-xs text-gray-500">ทั้งหมด</p>
              <p className="text-xl font-bold text-gray-900">{shiftStats.total}</p>
            </div>
            <div className="p-3 rounded-xl border bg-white">
              <p className="text-xs text-gray-500">เปิดใช้งาน</p>
              <p className="text-xl font-bold text-green-700">{shiftStats.active}</p>
            </div>
            <div className="p-3 rounded-xl border bg-white">
              <p className="text-xs text-gray-500">ปิดใช้งาน</p>
              <p className="text-xl font-bold text-gray-700">{shiftStats.inactive}</p>
            </div>
            <div className="p-3 rounded-xl border bg-white">
              <p className="text-xs text-gray-500">หลังกรอง</p>
              <p className="text-xl font-bold text-orange-700">{shiftStats.filtered}</p>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-6">
            <input
              type="text"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              placeholder="ค้นหาชื่อกะ, พนักงาน, รหัส"
              className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
            />

            <select
              value={filterShiftType}
              onChange={(e) => setFilterShiftType(e.target.value as 'ALL' | 'REGULAR' | 'SPECIFIC_DAY' | 'CUSTOM')}
              className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
            >
              <option value="ALL">ทุกประเภทกะ</option>
              <option value="REGULAR">ทุกวัน</option>
              <option value="SPECIFIC_DAY">เฉพาะวัน</option>
              <option value="CUSTOM">กำหนดเอง</option>
            </select>

            <select
              value={filterActive}
              onChange={(e) => setFilterActive(e.target.value as 'ALL' | 'ACTIVE' | 'INACTIVE')}
              className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
            >
              <option value="ALL">ทุกสถานะ</option>
              <option value="ACTIVE">เปิดใช้งาน</option>
              <option value="INACTIVE">ปิดใช้งาน</option>
            </select>

            <select
              value={String(filterUserId)}
              onChange={(e) => setFilterUserId(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
              className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
            >
              <option value="ALL">ทุกพนักงาน</option>
              {users.map((user) => (
                <option key={user.id} value={user.id}>{user.name} ({user.employeeId})</option>
              ))}
            </select>

            <select
              value={String(filterLocationId)}
              onChange={(e) => setFilterLocationId(e.target.value === 'ALL' ? 'ALL' : Number(e.target.value))}
              className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
            >
              <option value="ALL">ทุกสถานที่</option>
              {locationOptions.map((location) => (
                <option key={location.id} value={location.id}>{location.name}</option>
              ))}
            </select>

            <select
              value={filterBranchName}
              onChange={(e) => setFilterBranchName(e.target.value)}
              className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
            >
              <option value="ALL">ทุกสาขา</option>
              {branchOptions.map((branchName) => (
                <option key={branchName} value={branchName}>{branchName}</option>
              ))}
            </select>
          </div>

          {hasActiveFilters && (
            <div className="flex justify-end mt-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchText('');
                  setFilterShiftType('ALL');
                  setFilterActive('ALL');
                  setFilterUserId('ALL');
                  setFilterLocationId('ALL');
                  setFilterBranchName('ALL');
                }}
              >
                ล้างตัวกรอง
              </Button>
            </div>
          )}
        </Card>

        {/* Shift List */}
        <div className="space-y-4">
          {filteredShifts.length === 0 ? (
            <Card className="p-12 text-center">
              <div className="flex justify-center mb-4 text-gray-400">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-14 h-14" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <p className="text-lg text-gray-500">{shifts.length === 0 ? 'ยังไม่มีกะงาน' : 'ไม่พบข้อมูลตามตัวกรอง'}</p>
              <p className="text-sm text-gray-400 mt-2">
                {shifts.length === 0
                  ? 'คลิกปุ่ม “สร้างกะงานใหม่” เพื่อเริ่มต้น'
                  : 'ลองปรับคำค้นหาหรือกดล้างตัวกรอง'}
              </p>
            </Card>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
                {paginatedShifts.map((shift) => (
                  <Card key={shift.id} className="h-full p-6">
                <div className="flex h-full flex-col gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-3">
                      <h3 className="text-xl font-bold text-gray-900">{shift.name}</h3>
                      <Badge variant={shift.isActive ? 'default' : 'secondary'}>
                        {shift.isActive ? 'เปิดใช้งาน' : 'ปิดใช้งาน'}
                      </Badge>
                      <Badge variant="outline">{getShiftTypeName(shift.shiftType)}</Badge>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-gray-700">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="font-medium">เวลา:</span>
                        <span>{shift.startTime} - {shift.endTime}</span>
                      </div>

                      <div className="flex items-center gap-2 text-gray-700">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <span className="font-medium">ระยะเวลารอสาย:</span>
                        <span>{shift.gracePeriodMinutes} นาที / สายสูงสุด {shift.lateThresholdMinutes} นาที</span>
                      </div>

                      {shift.shiftType === 'SPECIFIC_DAY' && shift.specificDays && shift.specificDays.length > 0 && (
                        <div className="flex items-start gap-2 text-gray-700">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <div>
                            <span className="font-medium">วันทำงาน:</span>
                            <div className="flex flex-wrap gap-2 mt-2">
                              {shift.specificDays.map((day) => (
                                <Badge key={day} variant="outline">{getDayName(day)}</Badge>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {shift.shiftType === 'CUSTOM' && shift.customDate && (
                        <div className="flex items-center gap-2 text-gray-700">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                          </svg>
                          <span className="font-medium">วันที่:</span>
                          <span>{new Date(shift.customDate).toLocaleDateString('th-TH')}</span>
                        </div>
                      )}

                      {shift.user && (
                        <div className="flex items-center gap-2 text-gray-700">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                          <span className="font-medium">พนักงาน:</span>
                          <span>{shift.user.name} ({shift.user.employeeId})</span>
                        </div>
                      )}

                      {shift.location && (
                        <div className="flex items-center gap-2 text-gray-700">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span className="font-medium">สถานที่:</span>
                          <span>{shift.location.name}</span>
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-2 mt-auto">
                    <Button
                      onClick={() => setShowDetailModal(shift)}
                      variant="outline"
                      size="sm"
                      className="w-full"
                    >
                      ดูรายละเอียด
                    </Button>
                    <Button
                      onClick={() => handleEditShift(shift)}
                      variant="outline"
                      size="sm"
                      disabled={loading}
                      className="w-full"
                    >
                      แก้ไข
                    </Button>
                    <Button
                      onClick={() => handleToggleActive(shift)}
                      variant="outline"
                      size="sm"
                      disabled={loading}
                      className="w-full"
                    >
                      {shift.isActive ? 'ปิดใช้งาน' : 'เปิดใช้งาน'}
                    </Button>
                    <Button
                      onClick={() => handleDeleteShift(shift)}
                      variant="outline"
                      size="sm"
                      disabled={loading}
                      className="w-full text-red-600 hover:text-red-700 hover:bg-red-50"
                    >
                      ลบ
                    </Button>
                  </div>
                </div>
                  </Card>
                ))}
              </div>

              <div className="flex flex-col gap-3 pt-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-gray-600">
                  ทั้งหมด {filteredShifts.length} รายการ | หน้า {page} / {totalPages}
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                  >
                    ก่อนหน้า
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  >
                    ถัดไป
                  </Button>
                </div>
              </div>
            </>
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
                    required
                  />
                </div>

                {/* Shift Type */}
                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-700">
                    ประเภทกะงาน <span className="text-red-500">*</span>
                  </label>
                  <div className="grid gap-3">
                    {shiftTypes.map((type) => (
                      <button
                        key={type.value}
                        type="button"
                        onClick={() => setFormData({ ...formData, shiftType: type.value as any })}
                        className={`p-4 rounded-xl border-2 transition-all text-left ${
                          formData.shiftType === type.value
                            ? 'border-orange-500 bg-orange-50'
                            : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="font-medium text-gray-900">{type.label}</div>
                        <div className="text-sm text-gray-500">{type.description}</div>
                      </button>
                    ))}
                  </div>
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
                      required
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
                      required
                    />
                  </div>
                </div>

                {/* Grace Period and Late Threshold */}
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block mb-2 text-sm font-medium text-gray-700">
                      ระยะเวลารอสาย (นาที)
                    </label>
                    <input
                      type="number"
                      value={formData.gracePeriodMinutes}
                      onChange={(e) => setFormData({ ...formData, gracePeriodMinutes: parseInt(e.target.value) || 0 })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
                      min="0"
                    />
                  </div>
                  <div>
                    <label className="block mb-2 text-sm font-medium text-gray-700">
                      สายสูงสุด (นาที)
                    </label>
                    <input
                      type="number"
                      value={formData.lateThresholdMinutes}
                      onChange={(e) => setFormData({ ...formData, lateThresholdMinutes: parseInt(e.target.value) || 0 })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
                      min="0"
                    />
                  </div>
                </div>

                {/* Specific Days (for SPECIFIC_DAY type) */}
                {formData.shiftType === 'SPECIFIC_DAY' && (
                  <div>
                    <label className="block mb-3 text-sm font-medium text-gray-700">
                      วันทำงาน <span className="text-red-500">*</span>
                    </label>
                    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                      {weekDays.map((day) => (
                        <button
                          key={day.en}
                          type="button"
                          onClick={() => handleToggleWorkDay(day.en)}
                          className={`px-4 py-3 rounded-xl border-2 transition-all text-sm font-medium ${
                            formData.specificDays.includes(day.en as any)
                              ? 'border-orange-500 bg-orange-50 text-orange-700'
                              : 'border-gray-200 hover:border-gray-300 text-gray-700'
                          }`}
                        >
                          {day.th}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Custom Date (for CUSTOM type) */}
                {formData.shiftType === 'CUSTOM' && (
                  <div>
                    <label className="block mb-2 text-sm font-medium text-gray-700">
                      วันที่ทำงาน <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="date"
                      value={formData.customDate}
                      onChange={(e) => setFormData({ ...formData, customDate: e.target.value })}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
                      required
                    />
                  </div>
                )}

                {/* Employee Assignment */}
                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-700">
                    มอบหมายพนักงาน <span className="text-red-500">*</span>
                  </label>
                  {editingShift ? (
                    <select
                      value={formData.userIds[0] || ''}
                      onChange={(e) => {
                        const nextId = e.target.value ? parseInt(e.target.value) : undefined;
                        setFormData({ ...formData, userIds: nextId ? [nextId] : [] });
                      }}
                      className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
                    >
                      <option value="">-- เลือกพนักงาน --</option>
                      {users.map((user) => (
                        <option key={user.id} value={user.id}>
                          {user.name} ({user.employeeId})
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="p-3 border-2 border-gray-200 rounded-xl max-h-56 overflow-y-auto space-y-2">
                      {users.map((user) => {
                        const checked = formData.userIds.includes(user.id);
                        return (
                          <label key={user.id} className="flex items-center justify-between p-2 rounded-lg hover:bg-gray-50 cursor-pointer">
                            <span className="text-sm text-gray-800">{user.name} ({user.employeeId})</span>
                            <input
                              type="checkbox"
                              checked={checked}
                              onChange={() => {
                                setFormData((prev) => ({
                                  ...prev,
                                  userIds: checked
                                    ? prev.userIds.filter((id) => id !== user.id)
                                    : [...prev.userIds, user.id],
                                }));
                              }}
                              className="h-4 w-4"
                            />
                          </label>
                        );
                      })}
                    </div>
                  )}
                  <p className="mt-2 text-xs text-gray-500">
                    {editingShift
                      ? 'แก้ไขได้ครั้งละ 1 พนักงาน'
                      : `เลือกแล้ว ${formData.userIds.length} คน (สามารถสร้างกะเดียวกันให้หลายคนได้)`}
                  </p>
                </div>

                {/* Submit Buttons */}
                <div className="flex gap-3 pt-4">
                  <Button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    variant="outline"
                    className="flex-1"
                    disabled={loading}
                  >
                    ยกเลิก
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 bg-orange-600 hover:bg-orange-700"
                    disabled={loading}
                  >
                    {loading ? 'กำลังบันทึก...' : (editingShift ? 'บันทึกการแก้ไข' : 'สร้างกะงาน')}
                  </Button>
                </div>
              </form>
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
                    <Badge variant="outline">{getShiftTypeName(showDetailModal.shiftType)}</Badge>
                  </div>
                  <div className="grid gap-3 text-gray-700">
                    <div className="flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="font-medium">เวลา:</span>
                      <span>{showDetailModal.startTime} - {showDetailModal.endTime}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="font-medium">ระยะเวลา:</span>
                      <span>รอสาย {showDetailModal.gracePeriodMinutes} นาที / สายสูงสุด {showDetailModal.lateThresholdMinutes} นาที</span>
                    </div>
                    {showDetailModal.user && (
                      <div className="flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                        </svg>
                        <span className="font-medium">พนักงาน:</span>
                        <span>{showDetailModal.user.name} ({showDetailModal.user.employeeId})</span>
                      </div>
                    )}
                    {showDetailModal.location && (
                      <div className="flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="font-medium">สถานที่:</span>
                        <span>{showDetailModal.location.name}</span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Work Days for SPECIFIC_DAY */}
                {showDetailModal.shiftType === 'SPECIFIC_DAY' && showDetailModal.specificDays && showDetailModal.specificDays.length > 0 && (
                  <div>
                    <h4 className="flex items-center gap-2 mb-3 text-lg font-bold text-gray-900">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      วันทำงาน
                    </h4>
                    <div className="flex flex-wrap gap-2">
                      {showDetailModal.specificDays.map((day) => (
                        <Badge key={day} variant="outline" className="px-4 py-2">{getDayName(day)}</Badge>
                      ))}
                    </div>
                  </div>
                )}

                {/* Custom Date for CUSTOM */}
                {showDetailModal.shiftType === 'CUSTOM' && showDetailModal.customDate && (
                  <div>
                    <h4 className="flex items-center gap-2 mb-3 text-lg font-bold text-gray-900">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                      วันที่ทำงาน
                    </h4>
                    <p className="text-gray-700">{new Date(showDetailModal.customDate).toLocaleDateString('th-TH', {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}</p>
                  </div>
                )}
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

      {/* Toggle Active Confirm Modal */}
      {toggleTargetShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <Card className="w-full max-w-md p-6 bg-white">
            <h3 className="text-lg font-bold text-gray-900">ยืนยันการเปลี่ยนสถานะกะ</h3>
            <p className="mt-3 text-sm text-gray-600">
              ต้องการ{toggleTargetShift.isActive ? 'ปิด' : 'เปิด'}ใช้งานกะ <strong>{toggleTargetShift.name}</strong> ใช่หรือไม่?
            </p>
            <div className="flex gap-2 mt-6">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => setToggleTargetShift(null)}
                disabled={loading}
              >
                ยกเลิก
              </Button>
              <Button
                className="flex-1 bg-orange-600 hover:bg-orange-700"
                onClick={handleConfirmToggleActive}
                disabled={loading}
              >
                ยืนยัน
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Delete Reason Modal */}
      {deleteTargetShift && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <Card className="w-full max-w-lg p-6 bg-white">
            <h3 className="text-lg font-bold text-red-600">ลบกะงาน</h3>
            <p className="mt-2 text-sm text-gray-600">
              คุณกำลังลบกะ <strong>{deleteTargetShift.name}</strong> กรุณาระบุเหตุผลในการลบ
            </p>
            <textarea
              rows={3}
              value={deleteReason}
              onChange={(e) => setDeleteReason(e.target.value)}
              placeholder="ตัวอย่าง: ปรับตารางใหม่ตามนโยบายทีม"
              className="w-full px-3 py-2 mt-4 text-sm border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none resize-none"
            />
            <div className="flex gap-2 mt-6">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => {
                  setDeleteTargetShift(null);
                  setDeleteReason('');
                }}
                disabled={loading}
              >
                ยกเลิก
              </Button>
              <Button
                className="flex-1 bg-red-600 hover:bg-red-700"
                onClick={handleConfirmDeleteShift}
                disabled={loading}
              >
                ยืนยันการลบ
              </Button>
            </div>
          </Card>
        </div>
      )}

      {/* Reassign Confirmation Modal */}
      {reassignModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <Card className="w-full max-w-2xl p-6 bg-white">
            <h3 className="text-lg font-bold text-gray-900">ยืนยันการย้ายกะ</h3>
            {reassignModal.mode === 'edit' ? (
              <p className="mt-3 text-sm text-gray-700 whitespace-pre-line">
                {reassignModal.message}
              </p>
            ) : (
              <div className="mt-3">
                <p className="text-sm text-gray-700">พนักงานต่อไปนี้มี active shift อยู่แล้ว:</p>
                <pre className="p-3 mt-2 text-sm text-gray-700 whitespace-pre-wrap bg-gray-50 rounded-xl">
{`- ${reassignModal.conflictUsersText}`}
                </pre>
                <p className="mt-2 text-sm text-gray-700">ต้องการย้ายกะและแทนที่กะเดิมหรือไม่?</p>
              </div>
            )}
            <div className="flex gap-2 mt-6">
              <Button
                variant="outline"
                className="flex-1"
                onClick={handleCancelReassign}
                disabled={loading}
              >
                ยกเลิก
              </Button>
              <Button
                className="flex-1 bg-orange-600 hover:bg-orange-700"
                onClick={handleConfirmReassign}
                disabled={loading}
              >
                ยืนยันการย้ายกะ
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
