'use client';

/**
 * หน้า SuperAdmin — บันทึกเวลา (Attendance Log)
 * ─────────────────────────────────────────────
 * ทำหน้าที่:
 *   1. แสดงรายการ attendance ทั้งหมด (superadmin เท่านั้น)
 *   2. กรอง: ชื่อพนักงาน, วันที่, สถานะ
 *   3. แก้ไข attendance record (status, note, checkIn, checkOut)
 *   4. ลบ (soft-delete) พร้อมเหตุผล
 *
 * ใช้ attendanceService.getAll(), .update(), .delete()
 * UI ตาม pattern ของ shift-management: Card, Badge, inline modal
 *
 * NOTE: page นี้ใช้โค้ดเดียวกับ admin/attendance-log
 *       เพราะ backend ตรวจสิทธิ์จาก role (ADMIN | SUPERADMIN) เหมือนกัน
 */

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { attendanceService } from '@/services/attendance';
import { Attendance, UpdateAttendanceRequest } from '@/types/attendance';

// ========== ค่าคงที่ ==========

const STATUS_OPTIONS = [
  { value: 'ON_TIME', label: 'ตรงเวลา', color: 'bg-green-100 text-green-800' },
  { value: 'LATE', label: 'สาย', color: 'bg-yellow-100 text-yellow-800' },
  { value: 'ABSENT', label: 'ขาด', color: 'bg-red-100 text-red-800' },
  { value: 'LEAVE_APPROVED', label: 'ลา (อนุมัติ)', color: 'bg-blue-100 text-blue-800' },
] as const;

/** หา object สถานะตาม value — fallback เป็น default สีเทา */
function getStatusOption(value: string) {
  return STATUS_OPTIONS.find(s => s.value === value) ?? { value, label: value, color: 'bg-gray-100 text-gray-800' };
}

/** format ISO string → "DD/MM/YYYY HH:MM" (เวลาไทย) */
function formatThaiDateTime(iso: string | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** format ISO string → "HH:MM" (เวลาไทย) */
function formatThaiTime(iso: string | undefined): string {
  if (!iso) return '-';
  const d = new Date(iso);
  return d.toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ========== Component ==========

export default function AttendanceLogPage() {
  // --- State: ข้อมูลหลัก ---
  const [records, setRecords] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);

  // --- State: ตัวกรอง ---
  const [searchName, setSearchName] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('');
  const [filterStartDate, setFilterStartDate] = useState<string>('');
  const [filterEndDate, setFilterEndDate] = useState<string>('');

  // --- State: Modal แก้ไข ---
  const [editRecord, setEditRecord] = useState<Attendance | null>(null);
  const [editForm, setEditForm] = useState<UpdateAttendanceRequest>({});

  // --- State: Modal ลบ ---
  const [deleteRecord, setDeleteRecord] = useState<Attendance | null>(null);
  const [deleteReason, setDeleteReason] = useState('');

  // --- State: Modal ดูรายละเอียด ---
  const [detailRecord, setDetailRecord] = useState<Attendance | null>(null);

  // ========== โหลดข้อมูล ==========
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string | number> = {};
      if (filterStatus) params.status = filterStatus;
      if (filterStartDate) params.startDate = filterStartDate;
      if (filterEndDate) params.endDate = filterEndDate;

      const data = await attendanceService.getAll(params);
      setRecords(data);
    } catch (error) {
      console.error('Error loading attendance records:', error);
      alert('เกิดข้อผิดพลาดในการโหลดข้อมูลบันทึกเวลา');
    } finally {
      setLoading(false);
    }
  }, [filterStatus, filterStartDate, filterEndDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // ========== กรองตามชื่อ (client-side) ==========
  const filteredRecords = records.filter((r) => {
    if (!searchName) return true;
    const name = r.user?.name ?? '';
    const empId = r.user?.employeeId ?? '';
    const q = searchName.toLowerCase();
    return name.toLowerCase().includes(q) || empId.toLowerCase().includes(q);
  });

  // ========== Handlers ==========

  /** เปิด modal แก้ไข */
  const handleOpenEdit = (record: Attendance) => {
    setEditRecord(record);
    setEditForm({
      status: record.status,
      note: record.note ?? '',
      checkIn: record.checkIn ? new Date(record.checkIn).toISOString().slice(0, 16) : '',
      checkOut: record.checkOut ? new Date(record.checkOut).toISOString().slice(0, 16) : '',
    });
  };

  /** บันทึกการแก้ไข */
  const handleSaveEdit = async () => {
    if (!editRecord) return;
    try {
      await attendanceService.update(editRecord.id, editForm);
      alert('บันทึกการแก้ไขสำเร็จ');
      setEditRecord(null);
      await loadData();
    } catch (error) {
      console.error('Error updating attendance:', error);
      alert('เกิดข้อผิดพลาดในการแก้ไข');
    }
  };

  /** เปิด modal ลบ */
  const handleOpenDelete = (record: Attendance) => {
    setDeleteRecord(record);
    setDeleteReason('');
  };

  /** ยืนยันลบ (soft delete) */
  const handleConfirmDelete = async () => {
    if (!deleteRecord) return;
    if (!deleteReason.trim()) {
      alert('กรุณาระบุเหตุผลในการลบ');
      return;
    }
    try {
      // backend DELETE /api/attendance/:id — ส่ง deleteReason ใน body
      await attendanceService.delete(deleteRecord.id);
      alert('ลบบันทึกเวลาสำเร็จ');
      setDeleteRecord(null);
      await loadData();
    } catch (error) {
      console.error('Error deleting attendance:', error);
      alert('เกิดข้อผิดพลาดในการลบ');
    }
  };

  // ========== Render: Loading ==========
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-orange-500 rounded-full animate-spin border-t-transparent" />
      </div>
    );
  }

  // ========== Render: หน้าหลัก ==========
  return (
    <div className="min-h-screen p-4 bg-slate-50 sm:p-6">
      <Card className="p-6 border border-orange-100 shadow-sm">
        {/* ===== Header ===== */}
        <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">📋 บันทึกเวลา</h1>
            <p className="text-sm text-gray-500">จัดการและตรวจสอบบันทึกเข้า-ออกงานของพนักงาน</p>
          </div>
          <Badge variant="outline" className="text-orange-600 border-orange-300 bg-orange-50">
            ทั้งหมด {filteredRecords.length} รายการ
          </Badge>
        </div>

        {/* ===== ตัวกรอง ===== */}
        <div className="grid grid-cols-1 gap-3 mb-6 sm:grid-cols-2 lg:grid-cols-4">
          {/* ค้นหาชื่อ/รหัสพนักงาน */}
          <input
            type="text"
            placeholder="🔍 ค้นหาชื่อ / รหัสพนักงาน"
            value={searchName}
            onChange={(e) => setSearchName(e.target.value)}
            className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
          />
          {/* สถานะ */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
          >
            <option value="">ทุกสถานะ</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          {/* วันเริ่มต้น */}
          <input
            type="date"
            value={filterStartDate}
            onChange={(e) => setFilterStartDate(e.target.value)}
            className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
          />
          {/* วันสิ้นสุด */}
          <input
            type="date"
            value={filterEndDate}
            onChange={(e) => setFilterEndDate(e.target.value)}
            className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
          />
        </div>

        {/* ===== ตาราง ===== */}
        {filteredRecords.length === 0 ? (
          <div className="py-12 text-center text-gray-400">
            <p className="text-4xl mb-2">📭</p>
            <p>ไม่พบบันทึกเวลาที่ตรงกับเงื่อนไข</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left border-b border-gray-200">
                  <th className="px-3 py-3 font-semibold text-gray-600">พนักงาน</th>
                  <th className="px-3 py-3 font-semibold text-gray-600">กะงาน</th>
                  <th className="px-3 py-3 font-semibold text-gray-600">เข้างาน</th>
                  <th className="px-3 py-3 font-semibold text-gray-600">ออกงาน</th>
                  <th className="px-3 py-3 font-semibold text-gray-600">สถานะ</th>
                  <th className="px-3 py-3 font-semibold text-gray-600">สาย (นาที)</th>
                  <th className="px-3 py-3 font-semibold text-gray-600 text-right">จัดการ</th>
                </tr>
              </thead>
              <tbody>
                {filteredRecords.map((r) => {
                  const st = getStatusOption(r.status);
                  return (
                    <tr key={r.id} className="border-b border-gray-100 hover:bg-orange-50/50 transition-colors">
                      {/* พนักงาน */}
                      <td className="px-3 py-3">
                        <div className="font-medium text-gray-800">{r.user?.name ?? '-'}</div>
                        <div className="text-xs text-gray-400">{r.user?.employeeId ?? ''}</div>
                      </td>
                      {/* กะงาน */}
                      <td className="px-3 py-3 text-gray-600">
                        {r.shift ? (
                          <span>{r.shift.name} ({r.shift.startTime}-{r.shift.endTime})</span>
                        ) : (
                          <span className="text-gray-400">-</span>
                        )}
                      </td>
                      {/* เข้างาน */}
                      <td className="px-3 py-3 text-gray-600">{formatThaiTime(r.checkIn)}</td>
                      {/* ออกงาน */}
                      <td className="px-3 py-3 text-gray-600">{formatThaiTime(r.checkOut)}</td>
                      {/* สถานะ */}
                      <td className="px-3 py-3">
                        <Badge className={`${st.color} border-0 text-xs`}>{st.label}</Badge>
                      </td>
                      {/* สาย */}
                      <td className="px-3 py-3 text-gray-600">{r.lateMinutes ?? 0}</td>
                      {/* ปุ่มจัดการ */}
                      <td className="px-3 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setDetailRecord(r)}
                            className="text-xs"
                          >
                            ดู
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenEdit(r)}
                            className="text-xs text-orange-600 border-orange-300 hover:bg-orange-50"
                          >
                            แก้ไข
                          </Button>
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={() => handleOpenDelete(r)}
                            className="text-xs"
                          >
                            ลบ
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* ===== Modal: ดูรายละเอียด ===== */}
      {detailRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <Card className="w-full max-w-lg p-6 bg-white max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800">🔍 รายละเอียดบันทึกเวลา</h2>
              <button onClick={() => setDetailRecord(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>

            <div className="space-y-3 text-sm">
              <DetailRow label="พนักงาน" value={`${detailRecord.user?.name ?? '-'} (${detailRecord.user?.employeeId ?? '-'})`} />
              <DetailRow label="กะงาน" value={detailRecord.shift ? `${detailRecord.shift.name} (${detailRecord.shift.startTime}-${detailRecord.shift.endTime})` : '-'} />
              <DetailRow label="สถานที่" value={detailRecord.location?.name ?? '-'} />
              <DetailRow label="เข้างาน" value={formatThaiDateTime(detailRecord.checkIn)} />
              <DetailRow label="ออกงาน" value={formatThaiDateTime(detailRecord.checkOut)} />
              <DetailRow label="สถานะ" value={getStatusOption(detailRecord.status).label} />
              <DetailRow label="สาย (นาที)" value={String(detailRecord.lateMinutes ?? 0)} />
              <DetailRow label="หมายเหตุ" value={detailRecord.note ?? '-'} />
              <DetailRow label="ที่อยู่เข้างาน" value={detailRecord.checkInAddress ?? '-'} />
              <DetailRow label="ระยะห่าง (เข้า)" value={detailRecord.checkInDistance != null ? `${detailRecord.checkInDistance.toFixed(0)} ม.` : '-'} />
              <DetailRow label="ที่อยู่ออกงาน" value={detailRecord.checkOutAddress ?? '-'} />
              <DetailRow label="ระยะห่าง (ออก)" value={detailRecord.checkOutDistance != null ? `${detailRecord.checkOutDistance.toFixed(0)} ม.` : '-'} />
              <DetailRow label="วันที่สร้าง" value={formatThaiDateTime(detailRecord.createdAt)} />
            </div>

            <div className="flex justify-end mt-6">
              <Button variant="outline" onClick={() => setDetailRecord(null)}>ปิด</Button>
            </div>
          </Card>
        </div>
      )}

      {/* ===== Modal: แก้ไข ===== */}
      {editRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <Card className="w-full max-w-lg p-6 bg-white max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-800">✏️ แก้ไขบันทึกเวลา</h2>
              <button onClick={() => setEditRecord(null)} className="text-gray-400 hover:text-gray-600 text-xl leading-none">&times;</button>
            </div>

            <div className="space-y-4">
              {/* ข้อมูลพนักงาน (อ่านอย่างเดียว) */}
              <div className="p-3 text-sm bg-gray-50 rounded-xl">
                <span className="font-medium text-gray-600">พนักงาน: </span>
                <span className="text-gray-800">{editRecord.user?.name ?? '-'} ({editRecord.user?.employeeId ?? '-'})</span>
              </div>

              {/* สถานะ */}
              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700">สถานะ</label>
                <select
                  value={editForm.status ?? ''}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value as UpdateAttendanceRequest['status'] })}
                  className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>

              {/* เวลาเข้างาน */}
              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700">เวลาเข้างาน</label>
                <input
                  type="datetime-local"
                  value={editForm.checkIn ?? ''}
                  onChange={(e) => setEditForm({ ...editForm, checkIn: e.target.value })}
                  className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
                />
              </div>

              {/* เวลาออกงาน */}
              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700">เวลาออกงาน</label>
                <input
                  type="datetime-local"
                  value={editForm.checkOut ?? ''}
                  onChange={(e) => setEditForm({ ...editForm, checkOut: e.target.value })}
                  className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
                />
              </div>

              {/* หมายเหตุ */}
              <div>
                <label className="block mb-1 text-sm font-medium text-gray-700">หมายเหตุ</label>
                <textarea
                  value={editForm.note ?? ''}
                  onChange={(e) => setEditForm({ ...editForm, note: e.target.value })}
                  rows={3}
                  className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none resize-none"
                  placeholder="ระบุหมายเหตุ (ถ้ามี)"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 mt-6">
              <Button variant="outline" onClick={() => setEditRecord(null)}>ยกเลิก</Button>
              <Button onClick={handleSaveEdit} className="bg-orange-500 hover:bg-orange-600 text-white">บันทึก</Button>
            </div>
          </Card>
        </div>
      )}

      {/* ===== Modal: ลบ ===== */}
      {deleteRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <Card className="w-full max-w-md p-6 bg-white">
            <h2 className="mb-2 text-lg font-bold text-red-600">🗑️ ลบบันทึกเวลา</h2>
            <p className="mb-4 text-sm text-gray-600">
              คุณต้องการลบบันทึกเวลาของ <strong>{deleteRecord.user?.name ?? '-'}</strong> (เข้างาน {formatThaiDateTime(deleteRecord.checkIn)}) หรือไม่?
            </p>
            <p className="mb-2 text-xs text-gray-400">
              การลบเป็นแบบ Soft Delete — สามารถกู้คืนได้ภายหลัง
            </p>

            <div className="mb-4">
              <label className="block mb-1 text-sm font-medium text-gray-700">เหตุผลในการลบ *</label>
              <textarea
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-xl focus:border-red-500 focus:outline-none resize-none"
                placeholder="กรุณาระบุเหตุผล เช่น ข้อมูลซ้ำ, บันทึกผิดพลาด"
              />
            </div>

            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDeleteRecord(null)}>ยกเลิก</Button>
              <Button variant="destructive" onClick={handleConfirmDelete}>ลบเลย</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

/** Component ย่อย: แถวรายละเอียด (label + value) */
function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex">
      <span className="w-32 shrink-0 font-medium text-gray-500">{label}</span>
      <span className="text-gray-800">{value}</span>
    </div>
  );
}
