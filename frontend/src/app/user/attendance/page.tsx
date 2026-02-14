'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { attendanceService } from '@/services/attendance';
import { shiftService } from '@/services/shift';
import { Shift, Attendance } from '@/types/attendance';

export default function AttendancePage() {
  const [mode, setMode] = useState<'checkIn' | 'checkOut' | null>(null);
  const [photo, setPhoto] = useState<{ taken: boolean; data: string | null }>({ taken: false, data: null });
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [ui, setUi] = useState({ loading: false, showSuccess: false, isCameraActive: false, permissionGranted: false });
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [selectedShift, setSelectedShift] = useState<number | null>(null);
  const [todayStatus, setTodayStatus] = useState<{
    hasCheckedIn: boolean;
    hasCheckedOut: boolean;
    attendance?: Attendance;
  }>({ hasCheckedIn: false, hasCheckedOut: false });
  const [monthlyStats, setMonthlyStats] = useState({
    total: 0,
    onTime: 0,
    late: 0,
  });
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Load initial data
  useEffect(() => {
    loadTodayStatus();
    loadMonthlyStats();
    loadShifts();
  }, []);

  const loadTodayStatus = async () => {
    try {
      const status = await attendanceService.getTodayStatus();
      setTodayStatus(status);
    } catch (error) {
      console.error('Error loading today status:', error);
    }
  };

  const loadMonthlyStats = async () => {
    try {
      const now = new Date();
      const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
      const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
      
      const history = await attendanceService.getMyHistory({
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

  const loadShifts = async () => {
    try {
      const todayShifts = await shiftService.getToday();
      setShifts(todayShifts);
      if (todayShifts.length === 1) {
        setSelectedShift(todayShifts[0].id);
      }
    } catch (error) {
      console.error('Error loading shifts:', error);
    }
  };

  const requestCameraPermission = useCallback(async () => {
    try {
      // ขอ permission ก่อน
      const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
      
      if (result.state === 'denied') {
        alert('คุณได้ปฏิเสธการเข้าถึงกล้องแล้ว กรุณาเปิดการอนุญาตในการตั้งค่าเบราว์เซอร์');
        return false;
      }
      
      return true;
    } catch (error) {
      // ถ้า permissions API ไม่รองรับ ลองเปิดกล้องเลย
      return true;
    }
  }, []);

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
    } catch (error) {
      console.error('Camera error:', error);
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        alert('กรุณาอนุญาตการเข้าถึงกล้องเพื่อบันทึกเวลาเข้างาน');
      } else {
        alert('ไม่สามารถเปิดกล้องได้ กรุณาลองอีกครั้ง');
      }
      setUi(prev => ({ ...prev, isCameraActive: false, loading: false }));
    }
  }, [requestCameraPermission]);

  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setUi(prev => ({ ...prev, isCameraActive: false }));
  }, []);

  const takePhoto = useCallback(() => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0);
        const data = canvasRef.current.toDataURL('image/jpeg');
        setPhoto({ taken: true, data });
        stopCamera();
      }
    }
  }, [stopCamera]);

  const retakePhoto = useCallback(() => {
    setPhoto({ taken: false, data: null });
    startCamera();
  }, [startCamera]);

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

  const handleStartCheckIn = useCallback(() => {
    setMode('checkIn');
    getLocation();
    startCamera();
  }, [getLocation, startCamera]);

  const handleStartCheckOut = useCallback(() => {
    setMode('checkOut');
    getLocation();
    startCamera();
  }, [getLocation, startCamera]);

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

      setUi({ loading: false, showSuccess: true, isCameraActive: false, permissionGranted: false });
      
      // Reload data
      await loadTodayStatus();
      await loadMonthlyStats();

      setTimeout(() => {
        setUi({ loading: false, showSuccess: false, isCameraActive: false, permissionGranted: false });
        setMode(null);
        setPhoto({ taken: false, data: null });
        setLocation(null);
        setSelectedShift(null);
      }, 2000);
    } catch (error: any) {
      console.error('Error submitting attendance:', error);
      alert(error.response?.data?.message || 'เกิดข้อผิดพลาด กรุณาลองใหม่อีกครั้ง');
      setUi(prev => ({ ...prev, loading: false }));
    }
  }, [photo.data, location, selectedShift, mode]);

  const handleCancel = useCallback(() => {
    stopCamera();
    setMode(null);
    setPhoto({ taken: false, data: null });
    setLocation(null);
  }, [stopCamera]);

  if (mode) {
    return (
      <div className="min-h-screen bg-slate-50 pb-20">
        <div className="p-4 space-y-4">
          {/* Header */}
          <Card className="p-4 bg-gradient-to-r from-orange-500 to-orange-600">
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

          {/* Camera Section */}
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
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover"
                  />
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
                  <img src={photo.data!} alt="Captured" className="w-full h-full object-cover" />
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
            <canvas ref={canvasRef} className="hidden" />
          </Card>

          {/* Shift Selection */}
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

          {/* Location Section */}
          <Card className="p-4">
            <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              ตำแหน่งที่เช็คอิน
            </h3>
            {location ? (
              <div className="flex items-center gap-2 text-sm text-green-600 bg-green-50 p-3 rounded-lg">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span>ระบุตำแหน่งสำเร็จ ({location.lat.toFixed(6)}, {location.lng.toFixed(6)})</span>
              </div>
            ) : (
              <div className="flex items-center gap-2 text-sm text-gray-500 bg-gray-50 p-3 rounded-lg">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                <span>กำลังระบุตำแหน่ง...</span>
              </div>
            )}
          </Card>

          {/* Action Buttons */}
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

        {/* Success Modal */}
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

  return (
    <div className="space-y-4">
      {/* Status Card */}
      <Card className="p-6 bg-gradient-to-r from-orange-500 to-orange-600 text-white">
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

      {/* Today's Status */}
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

      {/* Action Buttons */}
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

      {/* Quick Info */}
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
