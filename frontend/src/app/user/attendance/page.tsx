'use client';

/**
 * หน้า Attendance (src/app/user/attendance/page.tsx)
 * ────────────────────────────────────────────────────
 * ทำหน้าที่: ให้พนักงานบันทึกเวลาเข้า-ออกงาน
 *
 * Flow การใช้งาน:
 *  1. โหลดหน้า → ดึงสถานะวันนี้ + สถิติเดือนนี้ + กะที่ใช้ได้วันนี้
 *  2. กดปุ่ม "เข้างาน" หรือ "ออกงาน" → เปิดกล้อง + ดึง GPS อัตโนมัติ
 *  3. ถ่ายรูป → เลือกกะ (ถ้ามีหลายกะ) → กด "ยืนยัน"
 *  4. ส่งข้อมูลไป backend → แสดง popup สำเร็จ → reload สถิติ
 *
 * Component มี 2 โหมด UI:
 *  - mode = null     → หน้าหลัก (แสดงสถานะ + ปุ่ม + สถิติ)
 *  - mode = 'checkIn' | 'checkOut' → หน้ากล้อง + ยืนยันตำแหน่ง
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { attendanceService } from '@/services/attendance';
import { shiftService } from '@/services/shift';
import { Shift, Attendance } from '@/types/attendance';

export default function AttendancePage() {
  // ดึง user ที่ login อยู่ เพื่อเอา id ส่งไปยัง API (backend ต้องการ userId ใน URL)
  const { user } = useAuth();
  const userId = user ? parseInt(user.id) : null;
  const searchParams = useSearchParams();
  const router = useRouter();

  // ถ้าเข้ามาโดยไม่มี ?mode= → redirect ไปที่ dashboard ไม่ต้องแสดงหน้านี้เลย
  useEffect(() => {
    const m = searchParams.get('mode');
    if (!m || (m !== 'checkIn' && m !== 'checkOut')) {
      router.replace('/user/dashboard');
    }
  }, [searchParams, router]);

  // ── State หลักของ UI ──
  const [mode, setMode] = useState<'checkIn' | 'checkOut' | null>(() => {
    const m = searchParams.get('mode');
    if (m === 'checkIn' || m === 'checkOut') return m;
    return null;
  });
  const [photo, setPhoto] = useState<{ taken: boolean; data: string | null }>({ taken: false, data: null });
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [ui, setUi] = useState({ loading: false, showSuccess: false, isCameraActive: false, permissionGranted: false });
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [selectedShift, setSelectedShift] = useState<number | null>(null);
  const [successResult, setSuccessResult] = useState<{ time: string; status: string; shiftName?: string } | null>(null);
  const [countdown, setCountdown] = useState(0); // นับถอยหลังก่อน redirect กลับ dashboard
  const [messageModal, setMessageModal] = useState<{ open: boolean; message: string }>({
    open: false,
    message: '',
  });
  const [todayStatus, setTodayStatus] = useState<{
    hasCheckedIn: boolean;
    hasCheckedOut: boolean;
    attendance?: Attendance;
  }>({ hasCheckedIn: false, hasCheckedOut: false });               // สถานะเข้า-ออกงานวันนี้

  const openMessageModal = useCallback((message: string) => {
    setMessageModal({ open: true, message });
  }, []);

  // ── Refs สำหรับกล้อง ──
  const videoRef = useRef<HTMLVideoElement>(null);  // แสดง live preview จากกล้อง
  const canvasRef = useRef<HTMLCanvasElement>(null); // ใช้ capture ภาพนิ่งจาก video
  const streamRef = useRef<MediaStream | null>(null); // เก็บ stream ไว้เพื่อ stop ทีหลัง

  /**
   * โหลดข้อมูลเริ่มต้นเมื่อ userId พร้อม
   * รอ userId ก่อน (ไม่ใช่ [] เดิม) เพราะถ้า userId = null → API จะเรียกไม่ได้
   */
  const loadTodayStatus = async () => {
    if (!userId) return;
    try {
      const status = await attendanceService.getTodayStatus(userId);
      setTodayStatus(status);
    } catch (error) {
      console.error('Error loading today status:', error);
    }
  };

  const loadShifts = async () => {
    if (!userId) return;
    try {
      const todayShifts = await shiftService.getTodayByUserId(userId);
      setShifts(todayShifts);
      // auto-select กะแรก (ให้ auto-select เสมอ ไม่ต้องให้ user เลือก ถ้ามีแค่ตัวเดียว)
      if (todayShifts.length > 0) {
        const firstShiftId = typeof todayShifts[0].id === 'string' 
          ? parseInt(todayShifts[0].id, 10) 
          : todayShifts[0].id;
        setSelectedShift(firstShiftId);
      }
    } catch (error) {
      console.error('Error loading shifts:', error);
    }
  };

  useEffect(() => {
    if (!userId) return;
    loadTodayStatus();
    loadShifts();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  // ตรวจสอบสถานะ: ถ้า mode=checkOut แต่ยังไม่ได้ checkIn → แก้เป็น checkIn อัตโนมัติ
  // ถ้า mode=checkIn แต่ checkIn แล้ว → แก้เป็น checkOut อัตโนมัติ
  useEffect(() => {
    if (!mode) return;
    if (mode === 'checkOut' && !todayStatus.hasCheckedIn) {
      setMode('checkIn');
    } else if (mode === 'checkIn' && todayStatus.hasCheckedIn && !todayStatus.hasCheckedOut) {
      setMode('checkOut');
    }
  }, [mode, todayStatus]);

  // เมื่อมาจาก dashboard พร้อม ?mode= ให้เริ่ม GPS ทันที
  useEffect(() => {
    if (mode) {
      navigator.geolocation?.getCurrentPosition(
        (pos) => setLocation({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
        () => {/* GPS ไม่บังคับ */}
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /**
   * requestCameraPermission() — ตรวจสอบว่าผู้ใช้อนุญาตกล้องไหม
   * ใช้ Permissions API ก่อน → ถ้า 'denied' แจ้งให้เปิดที่ settings เบราว์เซอร์
   * ถ้า browser ไม่รองรับ Permissions API → return true แล้วลองเปิดกล้องเลย
   */
  const requestCameraPermission = useCallback(async () => {
    try {
      const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
      
      if (result.state === 'denied') {
        openMessageModal('คุณได้ปฏิเสธการเข้าถึงกล้องแล้ว กรุณาเปิดการอนุญาตในการตั้งค่าเบราว์เซอร์');
        return false;
      }
      
      return true;
    } catch {
      return true; // ไม่รองรับ Permissions API → ลองเปิดกล้องตรงๆ
    }
  }, [openMessageModal]);

  /**
   * startCamera() — เปิดกล้องหน้า (facingMode: 'user') แสดงใน <video>
   * เก็บ MediaStream ไว้ใน streamRef เพื่อ stop ได้ทีหลัง
   */
  const startCamera = useCallback(async () => {
    try {
      const hasPermission = await requestCameraPermission();
      if (!hasPermission) return;

      setUi(prev => ({ ...prev, loading: true }));
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
      setUi(prev => ({ ...prev, isCameraActive: true, permissionGranted: true, loading: false }));
    } catch (error: unknown) {
      console.error('Camera error:', error);
      const err = error as { name?: string };
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        openMessageModal('กรุณาอนุญาตการเข้าถึงกล้องเพื่อบันทึกเวลาเข้างาน');
      } else {
        openMessageModal('ไม่สามารถเปิดกล้องได้ กรุณาลองอีกครั้ง');
      }
      setUi(prev => ({ ...prev, isCameraActive: false, loading: false }));
    }
  }, [openMessageModal, requestCameraPermission]);

  /** stopCamera() — หยุด stream กล้องทั้งหมด (ป้องกัน indicator กล้องค้างบน browser) */
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setUi(prev => ({ ...prev, isCameraActive: false }));
  }, []);

  /**
   * takePhoto() — capture ภาพนิ่งจาก <video> ลงใน <canvas> แล้วแปลงเป็น Base64 JPEG
   * ภาพ Base64 นี้จะถูกส่งไป backend ใน checkIn/checkOut request
   */
  const takePhoto = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        // ใช้ videoWidth/videoHeight ถ้ามี ไม่งั้น fallback เป็น clientWidth/clientHeight
        const w = videoRef.current.videoWidth || videoRef.current.clientWidth || 640;
        const h = videoRef.current.videoHeight || videoRef.current.clientHeight || 480;
        canvasRef.current.width = w;
        canvasRef.current.height = h;
        context.drawImage(videoRef.current, 0, 0, w, h);
        const data = canvasRef.current.toDataURL('image/jpeg', 0.8); // 0.8 quality เพื่อลดขนาด
        setPhoto({ taken: true, data });
        stopCamera(); // ปิดกล้องหลังถ่ายรูป
      }
    }
  }, [stopCamera]);

  /** retakePhoto() — ล้างรูปที่ถ่ายแล้ว แล้วเปิดกล้องใหม่ */
  const retakePhoto = useCallback(() => {
    setPhoto({ taken: false, data: null });
    startCamera();
  }, [startCamera]);

  /**
   * handleSubmit() — กดปุ่ม "ยืนยัน" หลังถ่ายรูปและได้ GPS แล้ว
   *
   * Validation ก่อนส่ง:
   *  - ต้องมีรูป (photo.data)
   *  - ต้องมีพิกัด GPS จริง ไม่ใช่ (0,0) หรือ null
   *  - ต้องเลือกกะ (selectedShift)
   *
   * ส่ง:
   *  - checkIn  → attendanceService.checkIn({ shiftId, photo, latitude, longitude })
   *  - checkOut → attendanceService.checkOut({ shiftId, photo, latitude, longitude })
   *
   * หลังสำเร็จ:
   *  - แสดง popup "บันทึกสำเร็จ" พร้อมนับถอยหลัง 5 วินาที → redirect กลับ dashboard
   *  - ป้องกัน double-punch โดยให้ user กลับ dashboard ทันที
   */
  const handleSubmit = useCallback(async () => {
    if (!photo.data) {
      openMessageModal('กรุณาถ่ายรูปก่อนยืนยัน');
      return;
    }
    // ─ GPS validation: ต้องมีพิกัดจริง ไม่ใช่ (0,0) ─
    if (!location || (location.lat === 0 && location.lng === 0)) {
      openMessageModal('ไม่สามารถรับพิกัด GPS ได้ กรุณาเปิด GPS แล้วลองใหม่');
      return;
    }
    if (shifts.length > 1 && !selectedShift) {
      openMessageModal('กรุณาเลือกกะทำงาน');
      return;
    }

    setUi(prev => ({ ...prev, loading: true }));
    try {
      let result;
      if (mode === 'checkIn') {
        result = await attendanceService.checkIn({
          shiftId: selectedShift ?? undefined,
          photo: photo.data,
          latitude: location.lat,
          longitude: location.lng,
        });
      } else {
        result = await attendanceService.checkOut({
          shiftId: selectedShift ?? undefined,
          photo: photo.data,
          latitude: location.lat,
          longitude: location.lng,
        });
      }

      const timeStr = mode === 'checkIn'
        ? (result?.checkIn ? new Date(result.checkIn).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '')
        : (result?.checkOut ? new Date(result.checkOut).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) : '');
      const statusMap: Record<string, string> = {
        ON_TIME: 'ตรงเวลา',
        LATE: 'มาสาย',
        EARLY_LEAVE: 'ออกก่อนเวลา',
        ABSENT: 'ขาดงาน',
      };
      const shiftName =
        result?.shift?.name
        ?? (selectedShift
          ? (shifts.find((s) => (typeof s.id === 'string' ? parseInt(s.id, 10) : s.id) === selectedShift)?.name)
          : (shifts.length === 1 ? shifts[0]?.name : undefined));
      setSuccessResult({
        time: timeStr,
        status: result?.status ? (statusMap[result.status] ?? result.status) : '',
        shiftName,
      });

      setUi({ loading: false, showSuccess: true, isCameraActive: false, permissionGranted: false });
      await loadTodayStatus();

      // นับถอยหลัง 5 วินาที แล้ว redirect กลับ dashboard อัตโนมัติ
      // ป้องกัน double-punch: user ไม่สามารถกดซ้ำได้เพราะอยู่หน้า success modal
      setCountdown(5);
      const timer = setInterval(() => {
        setCountdown(prev => {
          if (prev <= 1) {
            clearInterval(timer);
            router.push('/user/dashboard');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } catch (error: unknown) {
      console.error('Error submitting attendance:', error);
      const err = error as { response?: { data?: { error?: string; message?: string } } };
      const errorMsg = err.response?.data?.error || err.response?.data?.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง';
      openMessageModal(errorMsg);
      setUi(prev => ({ ...prev, loading: false }));
    }
  }, [photo.data, location, selectedShift, mode, shifts.length, openMessageModal, router]); // eslint-disable-line react-hooks/exhaustive-deps

  /**
   * handleCancel() — กดปุ่ม "ยกเลิก" หรือ "กลับ"
   * ปิดกล้อง reset state ทั้งหมด ไปกลับ dashboard
   */
  const handleCancel = useCallback(() => {
    stopCamera();
    router.push('/user/dashboard');
  }, [stopCamera, router]);


  // ─────────────────────────────────────────────────────────────
  // UI โหมดกล้อง — fullscreen overlay matching Figma design
  // ─────────────────────────────────────────────────────────────
  if (mode) {
    return (
      <div className="fixed inset-0 z-9999 flex flex-col bg-[#f5f6f7]">

        {/* ── Orange gradient header ── */}
        <div className="bg-linear-to-r from-[#f26623] to-[#ea580c] px-4 pt-12 pb-5">
          <div className="flex items-center gap-3 mb-1">
            <button onClick={handleCancel} className="text-white p-1 -ml-1 rounded-full hover:bg-white/20 transition-colors">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <h1 className="text-xl font-bold text-white">ลงเวลา{mode === 'checkIn' ? 'เข้า' : 'ออก'}งาน</h1>
          </div>
          <p className="text-white/80 text-sm ml-9">ถ่ายรูปเพื่อบันทึกเวลา</p>
        </div>

        {/* ── Body ── */}
        <div className="flex-1 p-4 flex flex-col gap-4 overflow-y-auto">

          {/* ── Camera area ── */}
          <div
            className="relative bg-[#1e293b] rounded-2xl overflow-hidden flex items-center justify-center border-2 border-[#f26623]"
            style={{ minHeight: '340px' }}
          >
            {/* State 1: กล้องยังไม่เปิด */}
            {!ui.isCameraActive && !photo.taken && (
              <div className="flex flex-col items-center gap-4 text-white/40 select-none">
                <div className="w-24 h-24 rounded-full border-2 border-white/15 flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 text-[#f26623]/60" viewBox="0 -960 960 960" fill="currentColor">
                    <path d="M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-400Zm112 168 56-56-128-128v-184h-80v216l152 152Z" />
                  </svg>
                </div>
                <span className="text-sm text-white/50">กล้องยังไม่เปิด</span>
              </div>
            )}

            {/* State 2: กล้องเปิดแล้ว (live preview) */}
            <video
              ref={videoRef}
              autoPlay
              playsInline
              muted
              className={`w-full h-full object-cover absolute inset-0 ${
                ui.isCameraActive && !photo.taken ? 'block' : 'hidden'
              }`}
              style={{ minHeight: '340px' }}
            />

            {/* Shutter button — orange circle with white ring */}
            {ui.isCameraActive && !photo.taken && (
              <button
                onClick={takePhoto}
                className="absolute bottom-5 left-1/2 -translate-x-1/2 w-18 h-18 rounded-full bg-[#f26623] hover:bg-[#e05a1a] active:scale-90 transition-all shadow-xl flex items-center justify-center"
              >
                <div className="w-15.5 h-15.5 rounded-full border-[3px] border-white" />
              </button>
            )}

            {/* State 3: photo taken */}
            {photo.taken && photo.data && (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img
                src={photo.data}
                alt="Captured"
                className="w-full h-full object-cover absolute inset-0"
                style={{ minHeight: '340px' }}
              />
            )}
          </div>

          {/* hidden canvas for capture */}
          <canvas ref={canvasRef} className="hidden" />

          {/* ── GPS status indicator ── */}
          <div className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm ${
            location && !(location.lat === 0 && location.lng === 0)
              ? 'bg-green-100 text-green-800'
              : 'bg-yellow-100 text-yellow-800'
          }`}>
            {location && !(location.lat === 0 && location.lng === 0) ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 shrink-0" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm-2 15l-5-5 1.41-1.41L10 14.17l7.59-7.59L19 8l-9 9z" />
                </svg>
                <span>ได้รับพิกัด GPS แล้ว</span>
              </>
            ) : (
              <>
                <div className="w-4 h-4 shrink-0 border-2 border-yellow-600 border-t-transparent rounded-full animate-spin" />
                <span>กำลังรับพิกัด GPS...</span>
              </>
            )}
          </div>

          {/* ── Shift selector (when multiple shifts & photo taken) ── */}
          {shifts.length > 1 && photo.taken && (
            <div className="bg-white rounded-2xl p-4 space-y-2 shadow-sm">
              <p className="text-gray-700 text-sm font-bold mb-2">เลือกกะทำงาน</p>
              {shifts.map((shift, index) => {
                const shiftId = typeof shift.id === 'string' ? parseInt(shift.id, 10) : shift.id;
                return (
                <button
                  key={shift.id ?? index}
                  onClick={() => setSelectedShift(shiftId)}
                  className={`w-full p-3 rounded-xl border-2 transition-colors text-left ${
                    selectedShift === shiftId
                      ? 'border-[#f26623] bg-orange-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-semibold text-gray-900">{shift.name}</div>
                      <div className="text-sm text-gray-500">{shift.startTime} - {shift.endTime}</div>
                    </div>
                    {selectedShift === shiftId && (
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-[#f26623]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </button>
                );
              })}
            </div>
          )}

          {/* ── Bottom buttons ── */}
          {/* State 1: Camera not open → open camera button */}
          {!ui.isCameraActive && !photo.taken && (
            <button
              onClick={startCamera}
              className="w-full py-4 rounded-2xl bg-[#f26623] hover:bg-[#e05a1a] active:scale-[.98] transition-all text-white font-bold text-base flex items-center justify-center gap-2 shadow-lg"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              เปิดกล้อง
            </button>
          )}

          {/* State 3: Photo taken → cancel + confirm */}
          {photo.taken && (
            <div className="flex gap-3">
              <button
                onClick={retakePhoto}
                disabled={ui.loading}
                className="flex-1 py-4 rounded-2xl border-2 border-gray-300 bg-white text-gray-700 font-bold text-base flex items-center justify-center gap-2 hover:bg-gray-50 active:scale-[.98] transition-all disabled:opacity-40"
              >
                ยกเลิก
              </button>
              <button
                onClick={handleSubmit}
                disabled={ui.loading}
                className="flex-1 py-4 rounded-2xl bg-[#f26623] hover:bg-[#e05a1a] active:scale-[.98] transition-all text-white font-bold text-base flex items-center justify-center gap-2 shadow-lg disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {ui.loading ? (
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                  </svg>
                )}
                {ui.loading ? 'กำลังบันทึก...' : 'ยืนยัน'}
              </button>
            </div>
          )}
        </div>

        {/* ── Success Modal (พร้อมนับถอยหลัง redirect) ── */}
        {ui.showSuccess && (
          <div className="fixed inset-0 z-99999 flex items-end justify-center bg-black/60">
            <div className="w-full bg-white rounded-t-3xl p-6 text-center space-y-4 pb-10">
              <div className="w-20 h-20 mx-auto bg-green-100 rounded-full flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h3 className="text-2xl font-bold text-gray-900">บันทึกสำเร็จ!</h3>
                {successResult && (
                  <p className="text-gray-500 mt-1 text-sm">
                    {mode === 'checkIn' ? 'เข้างาน' : 'ออกงาน'}
                    {successResult.time ? ` เวลา ${successResult.time} น.` : ''}
                    {successResult.status ? ` · ${successResult.status}` : ''}
                    {successResult.shiftName ? ` · กะ ${successResult.shiftName}` : ''}
                  </p>
                )}
                {countdown > 0 && (
                  <p className="text-gray-400 mt-2 text-xs">กลับหน้าหลักใน {countdown} วินาที...</p>
                )}
              </div>
              <button
                onClick={() => {
                  setUi({ loading: false, showSuccess: false, isCameraActive: false, permissionGranted: false });
                  setMode(null);
                  setPhoto({ taken: false, data: null });
                  setLocation(null);
                  setSelectedShift(null);
                  setSuccessResult(null);
                  setCountdown(0);
                  loadTodayStatus();
                  router.push('/user/dashboard');
                }}
                className="w-full py-4 rounded-2xl bg-[#f26623] hover:bg-[#e05a1a] text-white font-bold text-base transition-all"
              >
                กลับสู่หน้าหลัก
              </button>
            </div>
          </div>
        )}

        {messageModal.open && (
          <div className="fixed inset-0 z-100000 flex items-end justify-center bg-black/60">
            <div className="w-full bg-white rounded-t-3xl p-6 text-center space-y-4 pb-10">
              <h3 className="text-xl font-bold text-gray-900">แจ้งเตือน</h3>
              <p className="text-sm text-gray-600 whitespace-pre-line">{messageModal.message}</p>
              <button
                onClick={() => setMessageModal({ open: false, message: '' })}
                className="w-full py-4 rounded-2xl bg-[#f26623] hover:bg-[#e05a1a] text-white font-bold text-base transition-all"
              >
                ตกลง
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ถ้า mode ไม่ถูกตั้ง → ไม่แสดงอะไร (ระบบจะ redirect ไปที่ dashboard อัตโนมัติผ่าน useEffect)
  return null;
}
