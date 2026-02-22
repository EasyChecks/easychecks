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
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { attendanceService } from '@/services/attendance';
import { shiftService } from '@/services/shift';
import { Shift, Attendance } from '@/types/attendance';

export default function AttendancePage() {
  // ดึง user ที่ login อยู่ เพื่อเอา id ส่งไปยัง API (backend ต้องการ userId ใน URL)
  const { user } = useAuth();
  const userId = user ? parseInt(user.id) : null;

  // ── State หลักของ UI ──
  const [mode, setMode] = useState<'checkIn' | 'checkOut' | null>(null); // โหมดปัจจุบัน
  const [photo, setPhoto] = useState<{ taken: boolean; data: string | null }>({ taken: false, data: null });
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null); // GPS ที่ได้จากเบราว์เซอร์
  const [ui, setUi] = useState({ loading: false, showSuccess: false, isCameraActive: false, permissionGranted: false });
  const [shifts, setShifts] = useState<Shift[]>([]);              // กะที่ใช้ได้วันนี้ (จาก /shifts/today)
  const [selectedShift, setSelectedShift] = useState<number | null>(null); // กะที่เลือก
  const [todayStatus, setTodayStatus] = useState<{
    hasCheckedIn: boolean;
    hasCheckedOut: boolean;
    attendance?: Attendance;
  }>({ hasCheckedIn: false, hasCheckedOut: false });               // สถานะเข้า-ออกงานวันนี้
  const [monthlyStats, setMonthlyStats] = useState({
    total: 0,
    onTime: 0,
    late: 0,
  });                                                               // สถิติรายเดือนสำหรับแสดงด้านล่าง

  // ── Refs สำหรับกล้อง ──
  const videoRef = useRef<HTMLVideoElement>(null);  // แสดง live preview จากกล้อง
  const canvasRef = useRef<HTMLCanvasElement>(null); // ใช้ capture ภาพนิ่งจาก video
  const streamRef = useRef<MediaStream | null>(null); // เก็บ stream ไว้เพื่อ stop ทีหลัง

  /**
   * โหลดข้อมูลเริ่มต้นเมื่อ userId พร้อม
   * รอ userId ก่อน (ไม่ใช่ [] เดิม) เพราะถ้า userId = null → API จะเรียกไม่ได้
   */
  useEffect(() => {
    if (!userId) return;
    loadTodayStatus();
    loadMonthlyStats();
    loadShifts();
  }, [userId]);

  /**
   * loadTodayStatus() — ดึงสถานะเข้า-ออกงานวันนี้
   * ใช้กำหนดว่าปุ่ม "เข้างาน"/"ออกงาน" ควร active หรือ disabled
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

  /**
   * loadMonthlyStats() — คำนวณสถิติเดือนนี้ (วันทำงาน / ตรงเวลา / มาสาย)
   * ดึงประวัติตั้งแต่ต้นเดือนถึงสิ้นเดือน แล้วนับตาม status
   */
  const loadMonthlyStats = async () => {
    if (!userId) return;
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      
      const history = await attendanceService.getMyHistory(userId, {
        startDate: startOfMonth,
        endDate: endOfMonth,
      });

      const stats = {
        total: history.length,
        onTime: history.filter((a) => a.status === 'ON_TIME').length,
        late: history.filter((a) => a.status === 'LATE').length,
      };
      setMonthlyStats(stats);
    } catch (error) {
      console.error('Error loading monthly stats:', error);
    }
  };

  /**
   * loadShifts() — ดึงกะที่ใช้ได้วันนี้จาก /shifts/today
   * ถ้ามีกะเดียว → เลือกอัตโนมัติ (ไม่แสดง UI เลือกกะ)
   * ถ้ามีหลายกะ → แสดงปุ่มให้เลือก
   */
  const loadShifts = async () => {
    try {
      const todayShifts = await shiftService.getToday();
      setShifts(todayShifts);
      if (todayShifts.length === 1) {
        setSelectedShift(todayShifts[0].id); // เลือกอัตโนมัติถ้ามีแค่กะเดียว
      }
    } catch (error) {
      console.error('Error loading shifts:', error);
    }
  };

  /**
   * requestCameraPermission() — ตรวจสอบว่าผู้ใช้อนุญาตกล้องไหม
   * ใช้ Permissions API ก่อน → ถ้า 'denied' แจ้งให้เปิดที่ settings เบราว์เซอร์
   * ถ้า browser ไม่รองรับ Permissions API → return true แล้วลองเปิดกล้องเลย
   */
  const requestCameraPermission = useCallback(async () => {
    try {
      const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
      
      if (result.state === 'denied') {
        alert('คุณได้ปฏิเสธการเข้าถึงกล้องแล้ว กรุณาเปิดการอนุญาตในการตั้งค่าเบราว์เซอร์');
        return false;
      }
      
      return true;
    } catch {
      return true; // ไม่รองรับ Permissions API → ลองเปิดกล้องตรงๆ
    }
  }, []);

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
        alert('กรุณาอนุญาตการเข้าถึงกล้องเพื่อบันทึกเวลาเข้างาน');
      } else {
        alert('ไม่สามารถเปิดกล้องได้ กรุณาลองอีกครั้ง');
      }
      setUi(prev => ({ ...prev, isCameraActive: false, loading: false }));
    }
  }, [requestCameraPermission]);

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
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const data = canvasRef.current.toDataURL('image/jpeg');
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
   * getLocation() — ขอพิกัด GPS จากเบราว์เซอร์
   * พิกัดที่ได้จะแสดงบนหน้าจอ และส่งไปใน checkIn/checkOut request
   * backend ใช้พิกัดนี้ตรวจสอบว่าอยู่ใน radius ของ location ไหม
   */
  const getLocation = useCallback(() => {
    setUi(prev => ({ ...prev, loading: true }));
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
          setUi(prev => ({ ...prev, loading: false }));
        },
        (error) => {
          console.error('Location error:', error);
          alert('ไม่สามารถระบุตำแหน่งได้ กรุณาเปิด GPS');
          setUi(prev => ({ ...prev, loading: false }));
        }
      );
    } else {
      alert('เบราว์เซอร์ไม่รองรับ GPS');
      setUi(prev => ({ ...prev, loading: false }));
    }
  }, []);

  /**
   * handleStartCheckIn() — กดปุ่ม "เข้างาน"
   * เปลี่ยน mode → 'checkIn', เปิดกล้อง + ดึง GPS พร้อมกัน
   */
  const handleStartCheckIn = useCallback(() => {
    setMode('checkIn');
    getLocation();
    startCamera();
  }, [getLocation, startCamera]);

  /**
   * handleStartCheckOut() — กดปุ่ม "ออกงาน"
   * เปลี่ยน mode → 'checkOut', เปิดกล้อง + ดึง GPS พร้อมกัน
   */
  const handleStartCheckOut = useCallback(() => {
    setMode('checkOut');
    getLocation();
    startCamera();
  }, [getLocation, startCamera]);

  /**
   * handleSubmit() — กดปุ่ม "ยืนยัน" หลังถ่ายรูปและได้ GPS แล้ว
   *
   * Validation ก่อนส่ง:
   *  - ต้องมีรูป (photo.data)
   *  - ต้องมีพิกัด GPS (location)
   *  - ต้องเลือกกะ (selectedShift)
   *
   * ส่ง:
   *  - checkIn  → attendanceService.checkIn({ shiftId, photo, latitude, longitude })
   *  - checkOut → attendanceService.checkOut({ shiftId, photo, latitude, longitude })
   *
   * หลังสำเร็จ:
   *  - แสดง popup "บันทึกสำเร็จ" 2 วินาที
   *  - reload สถานะวันนี้ + สถิติเดือนนี้
   *  - reset mode กลับหน้าหลัก
   */
  const handleSubmit = useCallback(async () => {
    if (!photo.data || !location) {
      alert('กรุณาถ่ายรูปและระบุตำแหน่ง');
      return;
    }

    if (!selectedShift) {
      alert('กรุณาเลือกกะทำงาน');
      return;
    }

    setUi(prev => ({ ...prev, loading: true }));
    
    try {
      if (mode === 'checkIn') {
        await attendanceService.checkIn({
          shiftId: selectedShift,
          photo: photo.data,
          latitude: location.lat,
          longitude: location.lng,
        });
      } else if (mode === 'checkOut') {
        await attendanceService.checkOut({
          shiftId: selectedShift,
          photo: photo.data,
          latitude: location.lat,
          longitude: location.lng,
        });
      }

      // แสดง success popup
      setUi({ loading: false, showSuccess: true, isCameraActive: false, permissionGranted: false });
      
      // reload ข้อมูลเพื่ออัปเดต UI
      await loadTodayStatus();
      await loadMonthlyStats();

      // ซ่อน popup แล้ว reset state กลับหน้าหลักหลัง 2 วินาที
      setTimeout(() => {
        setUi({ loading: false, showSuccess: false, isCameraActive: false, permissionGranted: false });
        setMode(null);
        setPhoto({ taken: false, data: null });
        setLocation(null);
        setSelectedShift(null);
      }, 2000);
    } catch (error: unknown) {
      console.error('Error submitting attendance:', error);
      const err = error as { response?: { data?: { message?: string } } };
      alert(err.response?.data?.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
      setUi(prev => ({ ...prev, loading: false }));
    }
  }, [photo.data, location, selectedShift, mode]);

  /**
   * handleCancel() — กดปุ่ม "ยกเลิก"
   * ปิดกล้อง reset state ทั้งหมด กลับหน้าหลัก
   */
  const handleCancel = useCallback(() => {
    stopCamera();
    setMode(null);
    setPhoto({ taken: false, data: null });
    setLocation(null);
  }, [stopCamera]);

  // ─────────────────────────────────────────────────────────────
  // UI โหมดกล้อง: แสดงเมื่อกดปุ่ม "เข้างาน" หรือ "ออกงาน"
  // ประกอบด้วย: header, กล้อง, เลือกกะ (ถ้ามีหลายกะ), GPS status, ปุ่มยืนยัน/ยกเลิก
  // ─────────────────────────────────────────────────────────────
  if (mode) {
    return (
      <div className="min-h-screen bg-slate-50 pb-20">
        <div className="p-4 space-y-4">
          {/* ── Header: แสดงโหมด (เข้างาน/ออกงาน) + เวลา-วันที่ปัจจุบัน ── */}
          <Card className="p-4 bg-linear-to-r from-orange-500 to-orange-600">
            <div className="flex items-center justify-between">
              <div className="text-white">
                <h2 className="text-xl font-bold">
                  {mode === 'checkIn' ? 'เข้างาน' : 'ออกงาน'}
                </h2>
                <p className="text-sm text-white/90">
                  {new Date().toLocaleDateString('th-TH', { 
                    weekday: 'long', 
                    year: 'numeric', 
                    month: 'long', 
                    day: 'numeric' 
                  })}
                </p>
              </div>
              <div className="text-white text-3xl font-bold">
                {new Date().toLocaleTimeString('th-TH', { 
                  hour: '2-digit', 
                  minute: '2-digit' 
                })}
              </div>
            </div>
          </Card>

          {/* ── ส่วนกล้อง: live preview หรือรูปที่ถ่ายแล้ว ── */}
          <Card className="p-4">
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              ถ่ายรูปยืนยันตัวตน
            </h3>

            <div className="relative bg-gray-900 rounded-xl overflow-hidden aspect-video">
              {!photo.taken ? (
                <>
                  {/* กล้อง live preview */}
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
                  {/* ปุ่มถ่ายรูป (แสดงเมื่อกล้องพร้อม) */}
                  {ui.isCameraActive && (
                    <Button
                      onClick={takePhoto}
                      className="absolute bottom-4 left-1/2 -translate-x-1/2 w-16 h-16 rounded-full bg-white hover:bg-gray-100"
                    >
                      <div className="w-14 h-14 rounded-full border-4 border-orange-500"></div>
                    </Button>
                  )}
                </>
              ) : (
                <>
                  {/* แสดงรูปที่ถ่ายแล้ว */}
                  <img src={photo.data!} alt="Captured" className="w-full h-full object-cover" />
                  {/* ปุ่มถ่ายใหม่ */}
                  <Button
                    onClick={retakePhoto}
                    variant="outline"
                    className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-white"
                  >
                    ถ่ายใหม่
                  </Button>
                </>
              )}
            </div>
            {/* canvas ซ่อนไว้ใช้ capture ภาพจาก video เท่านั้น (ไม่แสดงต่อผู้ใช้) */}
            <canvas ref={canvasRef} className="hidden" />
          </Card>

          {/* ── เลือกกะทำงาน (แสดงเฉพาะเมื่อมีมากกว่า 1 กะวันนี้) ── */}
          {shifts.length > 1 && (
            <Card className="p-4">
              <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                เลือกกะทำงาน
              </h3>
              <div className="space-y-2">
                {shifts.map((shift) => (
                  <button
                    key={shift.id}
                    onClick={() => setSelectedShift(shift.id)}
                    className={`w-full p-3 rounded-lg border-2 transition-colors ${
                      selectedShift === shift.id
                        ? 'border-orange-500 bg-orange-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex justify-between items-center">
                      <div className="text-left">
                        <div className="font-semibold text-gray-900">{shift.name}</div>
                        <div className="text-sm text-gray-500">
                          {shift.startTime} - {shift.endTime}
                        </div>
                      </div>
                      {selectedShift === shift.id && (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </Card>
          )}

          {/* ── แสดงสถานะ GPS: กำลังระบุ / ระบุสำเร็จ ── */}
          <Card className="p-4">
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              ตำแหน่งที่เช็คอิน
            </h3>
            {location ? (
              // แสดงพิกัดสำเร็จ (สีเขียว)
              <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-3 rounded-lg">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>ระบุตำแหน่งสำเร็จ ({location.lat.toFixed(6)}, {location.lng.toFixed(6)})</span>
              </div>
            ) : (
              // กำลังรอ GPS (แสดง spinner)
              <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>กำลังระบุตำแหน่ง...</span>
              </div>
            )}
          </Card>

          {/* ── ปุ่มยกเลิก / ยืนยัน ── */}
          {/* ปุ่ม "ยืนยัน" จะ disabled จนกว่าจะมีรูป + GPS + กะครบ */}
          <div className="flex gap-3">
            <Button
              onClick={handleCancel}
              variant="outline"
              className="flex-1"
              disabled={ui.loading}
            >
              ยกเลิก
            </Button>
            <Button
              onClick={handleSubmit}
              className="flex-1 bg-orange-500 hover:bg-orange-600"
              disabled={!photo.data || !location || !selectedShift || ui.loading}
            >
              {ui.loading ? 'กำลังบันทึก...' : 'ยืนยัน'}
            </Button>
          </div>
        </div>

        {/* ── Popup สำเร็จ: แสดง 2 วินาทีหลัง submit สำเร็จ ── */}
        {ui.showSuccess && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
            <Card className="p-6 text-center">
              <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">บันทึกสำเร็จ!</h3>
              <p className="text-gray-600">
                {mode === 'checkIn' ? 'เข้างานเรียบร้อยแล้ว' : 'ออกงานเรียบร้อยแล้ว'}
              </p>
            </Card>
          </div>
        )}
      </div>
    );
  }

  // ─────────────────────────────────────────────────────────────
  // UI หน้าหลัก: แสดงเมื่อ mode = null (ยังไม่ได้กดปุ่มเข้า/ออกงาน)
  // ประกอบด้วย: นาฬิกา, สถานะวันนี้, ปุ่มเข้า/ออกงาน, สรุปเดือนนี้
  // ─────────────────────────────────────────────────────────────
  return (
    <div className="space-y-4">
      {/* ── นาฬิกาและวันที่ปัจจุบัน ── */}
      <Card className="p-6 bg-linear-to-r from-orange-500 to-orange-600 text-white">
        <div className="text-center">
          <div className="text-5xl font-bold mb-2">
            {new Date().toLocaleTimeString('th-TH', { 
              hour: '2-digit', 
              minute: '2-digit' 
            })}
          </div>
          <p className="text-white/90">
            {new Date().toLocaleDateString('th-TH', { 
              weekday: 'long', 
              year: 'numeric', 
              month: 'long', 
              day: 'numeric' 
            })}
          </p>
        </div>
      </Card>

      {/* ── สถานะวันนี้: เวลาเข้า + สถานะ (ตรงเวลา/มาสาย) + เวลาออก ── */}
      <Card className="p-4">
        <h3 className="font-semibold text-gray-800 mb-3">สถานะวันนี้</h3>
        <div className="grid grid-cols-2 gap-3">
          <div className={`p-4 rounded-xl ${todayStatus.hasCheckedIn ? 'bg-green-50' : 'bg-gray-50'}`}>
            <div className="text-sm text-gray-600 mb-1">เข้างาน</div>
            <div className={`text-xl font-bold ${todayStatus.hasCheckedIn ? 'text-gray-900' : 'text-gray-400'}`}>
              {todayStatus.attendance?.checkIn 
                ? new Date(todayStatus.attendance.checkIn).toLocaleTimeString('th-TH', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })
                : '--:--'}
            </div>
            {todayStatus.attendance?.status && (
              <Badge 
                variant={todayStatus.attendance.status === 'ON_TIME' ? 'active' : 'late'}
                className="mt-2"
              >
                {todayStatus.attendance.status === 'ON_TIME' ? 'ตรงเวลา' : 
                 todayStatus.attendance.status === 'LATE' ? 'มาสาย' : 'ขาดงาน'}
              </Badge>
            )}
          </div>
          <div className={`p-4 rounded-xl ${todayStatus.hasCheckedOut ? 'bg-green-50' : 'bg-gray-50'}`}>
            <div className="text-sm text-gray-600 mb-1">ออกงาน</div>
            <div className={`text-xl font-bold ${todayStatus.hasCheckedOut ? 'text-gray-900' : 'text-gray-400'}`}>
              {todayStatus.attendance?.checkOut 
                ? new Date(todayStatus.attendance.checkOut).toLocaleTimeString('th-TH', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                  })
                : '--:--'}
            </div>
            <Badge variant={todayStatus.hasCheckedOut ? 'active' : 'default'} className="mt-2">
              {todayStatus.hasCheckedOut ? 'ออกแล้ว' : 'ยังไม่ออก'}
            </Badge>
          </div>
        </div>
      </Card>

      {/* ── ปุ่มเข้างาน / ออกงาน ──
           เข้างาน: active เฉพาะเมื่อ hasCheckedIn = false
           ออกงาน: active เฉพาะเมื่อ hasCheckedIn = true && hasCheckedOut = false
           ถ้า condition ไม่ตรง → opacity-50 + cursor-not-allowed */}
      <div className="grid grid-cols-2 gap-4">
        <Card 
          className={`p-6 transition-shadow ${
            !todayStatus.hasCheckedIn 
              ? 'cursor-pointer hover:shadow-lg' 
              : 'opacity-50 cursor-not-allowed'
          }`}
          onClick={!todayStatus.hasCheckedIn ? handleStartCheckIn : undefined}
        >
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-3 bg-green-100 rounded-full flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
              </svg>
            </div>
            <h3 className="font-bold text-gray-900">เข้างาน</h3>
            <p className="text-xs text-gray-500 mt-1">Check In</p>
            {todayStatus.hasCheckedIn && (
              <p className="text-xs text-orange-500 mt-2">เช็คอินแล้ววันนี้</p>
            )}
          </div>
        </Card>

        <Card 
          className={`p-6 transition-shadow ${
            todayStatus.hasCheckedIn && !todayStatus.hasCheckedOut
              ? 'cursor-pointer hover:shadow-lg' 
              : 'opacity-50 cursor-not-allowed'
          }`}
          onClick={todayStatus.hasCheckedIn && !todayStatus.hasCheckedOut ? handleStartCheckOut : undefined}
        >
          <div className="text-center">
            <div className="w-16 h-16 mx-auto mb-3 bg-orange-100 rounded-full flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
              </svg>
            </div>
            <h3 className="font-bold text-gray-900">ออกงาน</h3>
            <p className="text-xs text-gray-500 mt-1">Check Out</p>
            {!todayStatus.hasCheckedIn && (
              <p className="text-xs text-orange-500 mt-2">กรุณาเช็คอินก่อน</p>
            )}
            {todayStatus.hasCheckedOut && (
              <p className="text-xs text-orange-500 mt-2">เช็คเอาต์แล้ววันนี้</p>
            )}
          </div>
        </Card>
      </div>

      {/* ── สรุปสถิติเดือนนี้ (คำนวณจาก getMyHistory ตั้งแต่ต้นเดือน) ── */}
      <Card className="p-4">
        <h3 className="font-semibold text-gray-800 mb-3">สรุปเดือนนี้</h3>
        <div className="grid grid-cols-3 gap-3 text-center">
          <div>
            <div className="text-2xl font-bold text-gray-900">{monthlyStats.total}</div>
            <div className="text-xs text-gray-500">วันทำงาน</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-green-600">{monthlyStats.onTime}</div>
            <div className="text-xs text-gray-500">ตรงเวลา</div>
          </div>
          <div>
            <div className="text-2xl font-bold text-orange-600">{monthlyStats.late}</div>
            <div className="text-xs text-gray-500">มาสาย</div>
          </div>
        </div>
      </Card>
    </div>
  );
}
