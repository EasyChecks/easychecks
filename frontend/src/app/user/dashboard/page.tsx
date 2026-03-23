'use client';

import { useState, useEffect, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { attendanceService } from '@/services/attendance';
import { shiftService } from '@/services/shift';
import { Shift, Attendance } from '@/types/attendance';

const ShiftMap = dynamic(() => import('@/components/ShiftMap'), { ssr: false });

/** แปลง ISO string เป็น "HH:MM" */
function fmtTime(iso?: string | null): string {
  if (!iso) return '-';
  return new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
}

/** แปลง ISO string เป็น วัน/เดือน/ปี พุทธศักราช */
function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('th-TH', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/** คำนวณเวลาทำงาน */
function calcDuration(checkIn: string, checkOut: string): string {
  const mins = (new Date(checkOut).getTime() - new Date(checkIn).getTime()) / 60000;
  if (mins <= 0) return '-';
  return `${Math.floor(mins / 60)} ชั่วโมง ${Math.round(mins % 60)} นาที`;
}

export default function UserDashboard() {
  const router = useRouter();
  const { user } = useAuth();
  const userId = user ? parseInt(user.id) : null;

  // ── today status ──────────────────────────────────────
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [isCheckedOut, setIsCheckedOut] = useState(false);
  const [statusLoading, setStatusLoading] = useState(true); // ป้องกันปุ่มกระพริบผิดก่อนโหลดเสร็จ
  const [checkInTime, setCheckInTime] = useState<string | null>(null);
  const [checkOutTime, setCheckOutTime] = useState<string | null>(null);

  // ── schedule (today's shifts for this user) ───────────
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [selectedShift, setSelectedShift] = useState<number | null>(null);
  const [shiftsLoading, setShiftsLoading] = useState(true);

  // ── history modal ──────────────────────────────────────
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyRecords, setHistoryRecords] = useState<Attendance[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // ── shift detail modal ─────────────────────────────────
  const [selectedDetailShift, setSelectedDetailShift] = useState<Shift | null>(null);

  // ── monthly summary stats ──────────────────────────────
  const [stats, setStats] = useState({ total: 0, onTime: 0, late: 0, absent: 0 });
  const [statsLoading, setStatsLoading] = useState(true);

  // ── info popup ─────────────────────────────────────────
  const [showInfoPopup, setShowInfoPopup] = useState(false);
  const [infoMessage, setInfoMessage] = useState('');

  // ── GPS location status (ตรวจสอบพิกัดจริงจาก backend) ──
  const [gpsStatus, setGpsStatus] = useState<'loading' | 'within' | 'outside' | 'error' | 'no-location'>('loading');
  const [gpsMessage, setGpsMessage] = useState('กำลังตรวจสอบตำแหน่ง...');
  // เก็บ distance ไว้ใช้อนาคต (ตอนนี้แสดงผ่าน gpsMessage แทน)
  const [, setGpsDistance] = useState<number | null>(null);

  // ── load today status ──────────────────────────────────
  const loadTodayStatus = useCallback(async () => {
    if (!userId) return;
    setStatusLoading(true);
    try {
      const status = await attendanceService.getTodayStatus(userId);
      setIsCheckedIn(status.hasCheckedIn === true);
      setIsCheckedOut(status.hasCheckedOut === true);
      if (status.attendance) {
        setCheckInTime(fmtTime(status.attendance.checkIn));
        setCheckOutTime(status.attendance.checkOut ? fmtTime(status.attendance.checkOut) : null);
      } else {
        setCheckInTime(null);
        setCheckOutTime(null);
      }
    } catch {
      // silent fail — keep defaults
    } finally {
      setStatusLoading(false);
    }
  }, [userId]);

  // ── load today's shifts for this user ─────────────────
  const loadShifts = useCallback(async () => {
    if (!userId) return;
    setShiftsLoading(true);
    try {
      const todayShifts = await shiftService.getTodayByUserId(userId);
      setShifts(todayShifts);
      if (todayShifts.length === 1) setSelectedShift(todayShifts[0].id);
    } catch {
      setShifts([]);
    } finally {
      setShiftsLoading(false);
    }
  }, [userId]);

  // ── load monthly stats ────────────────────────────────
  const loadMonthlyStats = useCallback(async () => {
    if (!userId) return;
    setStatsLoading(true);
    try {
      const now = new Date();
      const startDate = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
      const endDate = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();
      const records = await attendanceService.getMyHistory(userId, { startDate, endDate });
      const total = records.length;
      const onTime = records.filter(r => r.status === 'ON_TIME' || (r.status as string) === 'LEAVE_APPROVED').length;
      const late = records.filter(r => r.status === 'LATE').length;
      const absent = records.filter(r => r.status === 'ABSENT').length;
      setStats({ total, onTime, late, absent });
    } catch {
      // silent fail — keep zeros
    } finally {
      setStatsLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    loadTodayStatus();
    loadShifts();
    loadMonthlyStats();
  }, [userId, loadTodayStatus, loadShifts, loadMonthlyStats]);

  // ── GPS location check — ตรวจสอบพิกัดจริงผ่าน backend ──────────
  // ทำไม? — ไม่ให้ frontend ติดตั้ง geolib / คำนวณระยะทางเอง
  // เรียก /api/locations/check-gps พร้อมพิกัด GPS + shiftId ที่เลือก
  useEffect(() => {
    // ยังไม่โหลดกะเสร็จ → รอก่อน
    if (shiftsLoading) return;

    // ถ้าไม่มีกะวันนี้ → ไม่มีสถานที่ต้องตรวจ
    if (shifts.length === 0) {
      setGpsStatus('no-location');
      setGpsMessage('ไม่มีกะงานวันนี้');
      return;
    }

    // ใช้กะที่เลือก หรือกะแรกเป็นค่าเริ่มต้น
    const activeShiftId = selectedShift ?? shifts[0]?.id;
    if (!activeShiftId) return;

    setGpsStatus('loading');
    setGpsMessage('กำลังตรวจสอบตำแหน่ง...');

    // ขอ GPS จาก browser
    if (!navigator.geolocation) {
      setGpsStatus('error');
      setGpsMessage('เบราว์เซอร์ไม่รองรับ GPS');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (position) => {
        const { latitude, longitude } = position.coords;
        // ป้องกัน (0,0) — GPS ไม่พร้อม
        if (latitude === 0 && longitude === 0) {
          setGpsStatus('error');
          setGpsMessage('ไม่สามารถรับพิกัด GPS ได้');
          return;
        }
        try {
          const result = await attendanceService.checkGps({
            latitude,
            longitude,
            shiftId: activeShiftId,
          });
          setGpsDistance(result.distance);
          if (!result.location) {
            // กะไม่มีสถานที่กำหนด → อนุญาตทุกที่
            setGpsStatus('within');
            setGpsMessage('ไม่มีสถานที่กำหนด — เช็คอินได้ทุกที่');
          } else if (result.withinRadius) {
            setGpsStatus('within');
            setGpsMessage(`คุณอยู่ในพื้นที่อนุญาต (ห่าง ${result.distance} ม.)`);
          } else {
            setGpsStatus('outside');
            setGpsMessage(`คุณอยู่นอกพื้นที่ (ห่าง ${result.distance} ม., สูงสุด ${result.radius} ม.)`);
          }
        } catch {
          setGpsStatus('error');
          setGpsMessage('ไม่สามารถตรวจสอบตำแหน่งได้');
        }
      },
      () => {
        setGpsStatus('error');
        setGpsMessage('ไม่ได้รับอนุญาตให้เข้าถึง GPS');
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 30000 },
    );
  }, [shiftsLoading, shifts, selectedShift]);

  // ── open history modal + fetch ─────────────────────────
  const openHistory = async () => {
    setShowHistoryModal(true);
    if (!userId) return;
    setHistoryLoading(true);
    try {
      const records = await attendanceService.getMyHistory(userId);
      setHistoryRecords(records);
    } catch {
      setHistoryRecords([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  // ── navigate to attendance page ────────────────────────
  const handleCheckClick = () => {
    // ถ้าเข้า-ออกงานครบแล้ววันนี้ → ไม่ต้องทำอะไร
    if (isCheckedIn && isCheckedOut) return;

    if (shifts.length > 1 && !selectedShift) {
      setInfoMessage('กรุณาเลือกกะที่ต้องการเข้างานก่อน');
      setShowInfoPopup(true);
      return;
    }
    // ถ้ายังไม่ check-in → ไป checkIn, ถ้า check-in แล้วแต่ยังไม่ out → ไป checkOut
    const mode = (isCheckedIn && !isCheckedOut) ? 'checkOut' : 'checkIn';
    router.push(`/user/attendance?mode=${mode}`);
  };

  return (
    <div className="flex flex-col gap-4 pb-10">

      {/* ═══════════════════════ บันทึกเวลา CARD ═══════════════════════ */}
      <div className="bg-white rounded-2xl shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_5px_5px_0px_rgba(0,0,0,0.09),0px_12px_7px_0px_rgba(0,0,0,0.05)] p-5">
        <h3 className="mb-3 text-xl font-bold text-black">บันทึกเวลา</h3>

        {/* Location status bar — สถานะ GPS จริงจาก backend */}
        <div className={`flex items-center gap-2.5 px-4 py-3 mb-4 rounded-xl ${
          gpsStatus === 'within'  ? 'bg-green-200/50' :
          gpsStatus === 'outside' ? 'bg-red-200/50' :
          gpsStatus === 'loading' ? 'bg-gray-200/50' :
                                    'bg-yellow-200/50'
        }`}>
          {gpsStatus === 'loading' ? (
            <div className="shrink-0 w-5 h-5 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" />
          ) : gpsStatus === 'within' ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="shrink-0 w-5 h-5 text-green-600" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
            </svg>
          ) : gpsStatus === 'outside' ? (
            <svg xmlns="http://www.w3.org/2000/svg" className="shrink-0 w-5 h-5 text-red-600" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
            </svg>
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" className="shrink-0 w-5 h-5 text-yellow-600" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
            </svg>
          )}
          <span className={`text-sm ${
            gpsStatus === 'within'  ? 'text-green-800' :
            gpsStatus === 'outside' ? 'text-red-800' :
            gpsStatus === 'loading' ? 'text-gray-600' :
                                      'text-yellow-800'
          }`}>{gpsMessage}</span>
        </div>

        {/* Shift selector — only when > 1 shift */}
        {!shiftsLoading && shifts.length > 1 && (
          <div className="mb-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
            <h4 className="text-sm font-bold text-gray-800 mb-3">เลือกกะที่ต้องการเข้างาน:</h4>
            <div className="grid grid-cols-2 gap-3">
              {shifts.map((s, i) => {
                const sel = selectedShift === s.id;
                return (
                  <button key={s.id} onClick={() => setSelectedShift(s.id)}
                    className={`p-3 rounded-lg text-left border-2 transition-all ${sel ? 'bg-orange-500 text-white border-orange-500 shadow-md' : 'bg-white text-gray-800 border-gray-300 hover:border-orange-400 hover:bg-orange-50'}`}>
                    <div className="font-bold text-sm mb-1">กะที่ {i + 1}</div>
                    <div className={`text-xs ${sel ? 'text-white/90' : 'text-gray-600'}`}>{s.name}</div>
                    <div className={`text-xs ${sel ? 'text-white/80' : 'text-gray-500'}`}>{s.startTime} - {s.endTime}</div>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Time display + action button */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-[#f26623]" viewBox="0 -960 960 960" fill="currentColor">
                <path d="M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-400Zm112 168 56-56-128-128v-184h-80v216l152 152Z" />
              </svg>
              <span className="text-sm text-black">เข้างาน: {checkInTime ?? '-'}</span>
            </div>
            <div className="flex items-center space-x-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-[#f26623]" viewBox="0 -960 960 960" fill="currentColor">
                <path d="M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-400Zm112 168 56-56-128-128v-184h-80v216l152 152Z" />
              </svg>
              <span className="text-sm text-black">ออกงาน: {checkOutTime ?? '-'}</span>
            </div>
          </div>
          <button onClick={handleCheckClick}
            disabled={statusLoading || (isCheckedIn && isCheckedOut)}
            className={`px-8 py-3 rounded-full font-bold transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 ${
              statusLoading
                ? 'bg-gray-200 text-gray-400'
                : isCheckedIn && isCheckedOut
                  ? 'bg-gray-300 text-gray-500'
                  : isCheckedIn
                    ? 'bg-red-500 hover:bg-red-600 text-white shadow-lg'
                    : 'bg-white border-2 border-[#f26623] text-[#f26623] hover:bg-orange-50'
            }`}>
            {statusLoading
              ? '...'
              : isCheckedIn && isCheckedOut
                ? 'เสร็จสิ้น ✓'
                : isCheckedIn
                  ? 'ออกงาน'
                  : 'เข้างาน'}
          </button>
        </div>
      </div>

      {/* ═══════════════════════ สรุปการทำงาน CARD ═══════════════════════ */}
      <div className="bg-white rounded-2xl shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_5px_5px_0px_rgba(0,0,0,0.09),0px_12px_7px_0px_rgba(0,0,0,0.05)] p-5">
        {/* Header row */}
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-black">สรุปการทำงาน</h3>
          <button onClick={openHistory}
            className="flex items-center gap-1.5 px-4 py-2 bg-[#f26623] hover:bg-[#e05a1a] text-white rounded-lg text-sm font-medium transition-colors">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            ประวัติการลงเวลา
          </button>
        </div>

        {/* Summary time */}
        <div className="flex items-center gap-2 mb-3">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-sm font-medium text-black">สรุปเวลา:</span>
        </div>

        {/* 4 stat boxes */}
        <div className="grid grid-cols-4 gap-2">
          {/* ทั้งหมด — white */}
          <div className="bg-[#f9fafb] rounded-lg px-2 py-2.5 text-center">
            <span className="text-lg font-semibold text-black">
              {statsLoading ? <span className="inline-block w-4 h-4 border-2 border-gray-300 border-t-transparent rounded-full animate-spin" /> : stats.total}
            </span>
            <div className="text-[11px] text-gray-600 leading-tight mt-0.5">ทั้งหมด</div>
          </div>
          {/* ตรงเวลา — green */}
          <div className="bg-[#f0fdf4] rounded-lg px-2 py-2.5 text-center">
            <span className="text-lg font-semibold text-[#16a34a]">
              {statsLoading ? <span className="inline-block w-4 h-4 border-2 border-green-300 border-t-transparent rounded-full animate-spin" /> : stats.onTime}
            </span>
            <div className="text-[11px] text-gray-600 leading-tight mt-0.5">ตรงเวลา</div>
          </div>
          {/* มาสาย — yellow */}
          <div className="bg-yellow-50 rounded-lg px-2 py-2.5 text-center">
            <span className="text-lg font-semibold text-[#d97706]">
              {statsLoading ? <span className="inline-block w-4 h-4 border-2 border-yellow-300 border-t-transparent rounded-full animate-spin" /> : stats.late}
            </span>
            <div className="text-[11px] text-gray-600 leading-tight mt-0.5">มาสาย</div>
          </div>
          {/* ขาด — red */}
          <div className="bg-[#fef2f2] rounded-lg px-2 py-2.5 text-center">
            <span className="text-lg font-semibold text-red-500">
              {statsLoading ? <span className="inline-block w-4 h-4 border-2 border-red-300 border-t-transparent rounded-full animate-spin" /> : stats.absent}
            </span>
            <div className="text-[11px] text-gray-600 leading-tight mt-0.5">ขาดงาน</div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════ ตารางงาน (WORK SCHEDULE) ═══════════════ */}
      <div className="bg-white rounded-2xl shadow-[0px_1px_3px_0px_rgba(0,0,0,0.1),0px_5px_5px_0px_rgba(0,0,0,0.09),0px_12px_7px_0px_rgba(0,0,0,0.05)] p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold text-black">ทั้งหมด {shifts.length} รายการ</h3>
          {!shiftsLoading && (
            <span className="text-sm text-[#687280]">ทั้งหมด {shifts.length} รายการ</span>
          )}
        </div>

        {shiftsLoading ? (
          <div className="py-8 flex justify-center">
            <div className="w-8 h-8 border-4 border-[#f26623] border-t-transparent rounded-full animate-spin" />
          </div>
        ) : shifts.length > 0 ? (
          <div className="space-y-3">
            {shifts.map((s, i) => (
              <div key={s.id ?? i} onClick={() => setSelectedDetailShift(s)} className="block cursor-pointer">
                <div className="bg-[#f26623] rounded-xl overflow-hidden transform transition-all hover:scale-[1.02] hover:shadow-lg">
                  {/* Card content */}
                  <div className="p-4 text-white">
                    <div className="flex items-start justify-between mb-2">
                      <h4 className="text-lg font-bold">{s.name}</h4>
                      <span className="px-3 py-1 text-xs rounded-full bg-white/20 border border-white/30 whitespace-nowrap">
                        {s.startTime} - {s.endTime}
                      </span>
                    </div>
                    <div className="space-y-1 text-sm text-white/90">
                      {s.location && (
                        <div className="flex items-center gap-2">
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                          </svg>
                          <span>สถานที่: {s.location.name}</span>
                        </div>
                      )}
                      <div className="flex items-center gap-2">
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                        </svg>
                        <span>ประเภท: {s.shiftType === 'REGULAR' ? 'ในพื้นที่อนุญาติ' : s.shiftType === 'SPECIFIC_DAY' ? 'เฉพาะวัน' : 'กำหนดเอง'}</span>
                      </div>
                    </div>
                  </div>
                  {/* Card footer */}
                  <div className="border-t border-white/20 px-4 py-3 flex items-center justify-between text-white/90">
                    <span className="text-xs flex items-center gap-1">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                      <span>ประเภท: ในพื้นที่อนุญาติ</span>
                    </span>
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center text-gray-500">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 mx-auto mb-3 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <p>ไม่มีตารางงานวันนี้</p>
          </div>
        )}
      </div>

      {/* ═══════════════════════ SHIFT DETAIL MODAL ═════════════════════ */}
      {selectedDetailShift && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setSelectedDetailShift(null)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}>

            {/* Header */}
            <div className="bg-linear-to-r from-orange-500 to-orange-600 p-6">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                </div>
                <div>
                  <h2 className="text-xl font-bold text-white">{selectedDetailShift.name}</h2>
                  <p className="text-white/80 text-sm mt-1">เวลา: {selectedDetailShift.startTime} – {selectedDetailShift.endTime}</p>
                </div>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {/* Basic info */}
              <div className="p-6 border-b border-gray-100 space-y-4">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">ข้อมูลทั่วไป</h3>

                {/* shift type */}
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center shrink-0">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 mb-1">ประเภทกะ</p>
                    <p className="font-medium text-gray-800">
                      {selectedDetailShift.shiftType === 'REGULAR' ? 'ปกติ (ทุกวัน)' : selectedDetailShift.shiftType === 'SPECIFIC_DAY' ? 'เฉพาะวัน' : 'กำหนดเอง'}
                    </p>
                  </div>
                </div>

                {/* specific days */}
                {selectedDetailShift.specificDays && selectedDetailShift.specificDays.length > 0 && (
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">วันทำงาน</p>
                      <p className="font-medium text-gray-800">
                        {selectedDetailShift.specificDays.map(d => ({ MONDAY: 'จ.', TUESDAY: 'อ.', WEDNESDAY: 'พ.', THURSDAY: 'พฤ.', FRIDAY: 'ศ.', SATURDAY: 'ส.', SUNDAY: 'อา.' } as Record<string,string>)[d] ?? d).join(' ')}
                      </p>
                    </div>
                  </div>
                )}

                {/* custom date */}
                {selectedDetailShift.customDate && (
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">วันที่</p>
                      <p className="font-medium text-gray-800">
                        {new Date(selectedDetailShift.customDate).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' })}
                      </p>
                    </div>
                  </div>
                )}

                {/* location */}
                {selectedDetailShift.location && (
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center shrink-0">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                      </svg>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500 mb-1">สถานที่</p>
                      <p className="font-medium text-gray-800">{selectedDetailShift.location.name}</p>
                      {selectedDetailShift.location.address && (
                        <p className="text-sm text-gray-500 mt-0.5">{selectedDetailShift.location.address}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-1">รัศมีเช็คอิน: {selectedDetailShift.location.radius} เมตร</p>
                    </div>
                  </div>
                )}
              </div>

              {/* Timing rules */}
              <div className="p-6 space-y-3">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">กฎเวลา</h3>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-green-50 rounded-xl p-4">
                    <p className="text-xs text-gray-500 mb-1">ผ่อนผัดเวลา</p>
                    <p className="text-xl font-bold text-green-700">{selectedDetailShift.gracePeriodMinutes} <span className="text-sm font-normal">นาที</span></p>
                  </div>
                  <div className="bg-yellow-50 rounded-xl p-4">
                    <p className="text-xs text-gray-500 mb-1">เกณฑ์มาสาย</p>
                    <p className="text-xl font-bold text-yellow-700">{selectedDetailShift.lateThresholdMinutes} <span className="text-sm font-normal">นาที</span></p>
                  </div>
                </div>
              </div>

              {/* Map */}
              {selectedDetailShift.location && (
                <div className="px-6 pb-6 space-y-2">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">แผนที่สถานที่</h3>
                  <ShiftMap
                    latitude={selectedDetailShift.location.latitude}
                    longitude={selectedDetailShift.location.longitude}
                    radius={selectedDetailShift.location.radius}
                    locationName={selectedDetailShift.location.name}
                  />
                  <p className="text-xs text-gray-400 text-center">วงกลมสีส้มแสดงพื้นที่ที่สามารถเช็คอินได้</p>
                </div>
              )}

            </div>

            {/* Footer */}
            <div className="p-6 bg-gray-50 border-t border-gray-200">
              <button onClick={() => setSelectedDetailShift(null)}
                className="w-full py-3 rounded-xl border border-gray-300 text-gray-700 font-semibold hover:bg-gray-100 transition-all">
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════ ATTENDANCE HISTORY MODAL ════════════════ */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
          onClick={() => setShowHistoryModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl max-w-4xl w-full overflow-hidden max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}>
            <div className="bg-linear-to-r from-orange-500 to-orange-600 p-6 flex items-center justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white">ประวัติการลงเวลา</h2>
                <p className="text-white/90 text-sm mt-1">รายละเอียดการเข้า-ออกงานของคุณ</p>
              </div>
              <button onClick={() => setShowHistoryModal(false)}
                className="w-10 h-10 bg-white/20 hover:bg-white/30 rounded-xl flex items-center justify-center text-white transition-all">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              {historyLoading ? (
                <div className="py-12 flex justify-center">
                  <div className="w-8 h-8 border-4 border-orange-500 border-t-transparent rounded-full animate-spin" />
                </div>
              ) : historyRecords.length === 0 ? (
                <div className="text-center py-12">
                  <div className="w-16 h-16 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <p className="text-gray-500">ยังไม่มีประวัติการลงเวลา</p>
                </div>
              ) : (
                historyRecords.map((r, idx) => (
                  <div key={r.id ?? idx} className="bg-gray-50 rounded-xl p-5 border border-gray-200">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-gray-800">{fmtDate(r.checkIn)}</h3>
                      <span className={`text-xs px-2 py-1 rounded-full ${
                        r.status === 'LATE' ? 'bg-yellow-100 text-yellow-700' :
                        r.status === 'ON_TIME' ? 'bg-green-100 text-green-700' :
                        'bg-red-100 text-red-700'
                      }`}>
                        {r.status === 'LATE' ? 'มาสาย' : r.status === 'ON_TIME' ? 'ตรงเวลา' : 'ขาดงาน'}
                      </span>
                    </div>
                    <div className="bg-white rounded-lg p-4 border border-gray-200">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">เข้างาน</p>
                            <p className="font-bold text-gray-800">{fmtTime(r.checkIn)}</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-3">
                          <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center shrink-0">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                            </svg>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">ออกงาน</p>
                            <p className="font-bold text-gray-800">{r.checkOut ? fmtTime(r.checkOut) : 'ยังไม่ออกงาน'}</p>
                          </div>
                        </div>
                      </div>
                      {r.checkIn && r.checkOut && (
                        <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between text-sm">
                          <span className="text-gray-600">เวลาทำงาน</span>
                          <span className="font-semibold text-gray-800">{calcDuration(r.checkIn, r.checkOut)}</span>
                        </div>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="p-6 bg-gray-50 border-t border-gray-200">
              <button onClick={() => setShowHistoryModal(false)}
                className="w-full bg-linear-to-r from-orange-500 to-orange-600 text-white py-3 rounded-xl font-semibold hover:shadow-lg transition-all">
                ปิด
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ═══════════════════════ INFO POPUP ══════════════════════════════ */}
      {showInfoPopup && (
        <div className="fixed inset-0 z-100 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm p-8 text-center bg-white shadow-2xl rounded-2xl">
            <div className="flex items-center justify-center w-20 h-20 mx-auto mb-6 bg-yellow-100 rounded-full">
              <svg xmlns="http://www.w3.org/2000/svg" height="48px" viewBox="0 -960 960 960" width="48px" fill="#F59E0B">
                <path d="M480-280q17 0 28.5-11.5T520-320q0-17-11.5-28.5T480-360q-17 0-28.5 11.5T440-320q0 17 11.5 28.5T480-280Zm-40-160h80v-240h-80v240Zm40 360q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z" />
              </svg>
            </div>
            <h2 className="mb-2 text-2xl font-bold text-gray-800">แจ้งเตือน</h2>
            <p className="mb-8 text-gray-600">{infoMessage}</p>
            <button onClick={() => setShowInfoPopup(false)}
              className="w-full bg-orange-500 text-white py-3 px-6 rounded-xl font-medium text-lg shadow-lg hover:bg-orange-600 transition-all">
              ตกลง
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
