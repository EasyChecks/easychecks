'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';
import { useRouter } from 'next/navigation';

interface AttendanceModalProps {
  mode: 'checkIn' | 'checkOut';
  onClose: () => void;
  onSuccess: () => void;
}

export default function UserDashboard() {
  const { user } = useAuth();
  const router = useRouter();
  const [showAttendanceModal, setShowAttendanceModal] = useState(false);
  const [attendanceMode, setAttendanceMode] = useState<'checkIn' | 'checkOut'>('checkIn');
  const [todayAttendance, setTodayAttendance] = useState<{ checkIn: string | null; checkOut: string | null }>({
    checkIn: null,
    checkOut: null
  });

  useEffect(() => {
    // โหลดข้อมูลการเข้างานวันนี้
    // TODO: เรียก API
    setTodayAttendance({
      checkIn: '08:05',
      checkOut: null
    });
  }, []);

  const handleCheckIn = () => {
    setAttendanceMode('checkIn');
    setShowAttendanceModal(true);
  };

  const handleCheckOut = () => {
    setAttendanceMode('checkOut');
    setShowAttendanceModal(true);
  };

  const handleAttendanceSuccess = () => {
    setShowAttendanceModal(false);
    // Reload attendance data
    if (attendanceMode === 'checkIn') {
      setTodayAttendance(prev => ({ ...prev, checkIn: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) }));
    } else {
      setTodayAttendance(prev => ({ ...prev, checkOut: new Date().toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' }) }));
    }
  };

  return (
    <div className="space-y-6 pb-20">
      {/* Attendance Modal */}
      {showAttendanceModal && (
        <AttendanceModal
          mode={attendanceMode}
          onClose={() => setShowAttendanceModal(false)}
          onSuccess={handleAttendanceSuccess}
        />
      )}

      {/* Welcome Card */}
      <Card className="p-6 bg-gradient-to-r from-blue-500 to-blue-600 text-white border-none shadow-lg">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold">สวัสดี, {user?.name}!</h1>
            <p className="text-white/90">{user?.department} • {user?.position}</p>
          </div>
        </div>
      </Card>

      {/* Today's Attendance Status */}
      {todayAttendance.checkIn && (
        <Card className="p-4 bg-gradient-to-r from-green-50 to-green-100 border-2 border-green-200">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-green-500 rounded-full flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <p className="font-semibold text-green-800">เช็คอินแล้ว</p>
                <p className="text-sm text-green-600">เวลา {todayAttendance.checkIn} น.</p>
              </div>
            </div>
            {todayAttendance.checkOut && (
              <div className="text-right">
                <p className="font-semibold text-green-800">เช็คเอาท์แล้ว</p>
                <p className="text-sm text-green-600">เวลา {todayAttendance.checkOut} น.</p>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <button
          onClick={handleCheckIn}
          disabled={!!todayAttendance.checkIn}
          className={`text-left ${todayAttendance.checkIn ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <Card className="p-6 hover:shadow-lg transition-all border-2 border-gray-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-800">เช็คอิน</h3>
            </div>
            <p className="text-sm text-gray-600">บันทึกเวลาเข้างาน</p>
          </Card>
        </button>

        <button
          onClick={handleCheckOut}
          disabled={!todayAttendance.checkIn || !!todayAttendance.checkOut}
          className={`text-left ${!todayAttendance.checkIn || todayAttendance.checkOut ? 'opacity-50 cursor-not-allowed' : ''}`}
        >
          <Card className="p-6 hover:shadow-lg transition-all border-2 border-gray-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-800">เช็คเอาท์</h3>
            </div>
            <p className="text-sm text-gray-600">บันทึกเวลาออกงาน</p>
          </Card>
        </button>

        <button onClick={() => router.push('/user/leave-request')} className="text-left">
          <Card className="p-6 hover:shadow-lg transition-all border-2 border-gray-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-800">ขอลา</h3>
            </div>
            <p className="text-sm text-gray-600">ยื่นคำร้องขอลา</p>
          </Card>
        </button>

        <button onClick={() => router.push('/user/history')} className="text-left">
          <Card className="p-6 hover:shadow-lg transition-all border-2 border-gray-200">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <h3 className="font-semibold text-gray-800">ประวัติ</h3>
            </div>
            <p className="text-sm text-gray-600">ดูประวัติการทำงาน</p>
          </Card>
        </button>
      </div>

      {/* Attendance Summary */}
      <Card className="p-6 border-2 border-gray-200">
        <h2 className="text-xl font-bold text-gray-800 mb-4">สรุปการเข้างานประจำเดือน</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="p-4 bg-green-50 rounded-lg border border-green-200">
            <p className="text-sm text-green-700 font-medium mb-1">เข้างานตรงเวลา</p>
            <p className="text-3xl font-bold text-green-600">20</p>
            <p className="text-xs text-green-600 mt-1">วัน</p>
          </div>
          <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
            <p className="text-sm text-amber-700 font-medium mb-1">มาสาย</p>
            <p className="text-3xl font-bold text-amber-600">2</p>
            <p className="text-xs text-amber-600 mt-1">วัน</p>
          </div>
          <div className="p-4 bg-purple-50 rounded-lg border border-purple-200">
            <p className="text-sm text-purple-700 font-medium mb-1">ลา/ขาด</p>
            <p className="text-3xl font-bold text-purple-600">3</p>
            <p className="text-xs text-purple-600 mt-1">วัน</p>
          </div>
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-700 font-medium mb-1">ชั่วโมงทำงาน</p>
            <p className="text-3xl font-bold text-blue-600">176</p>
            <p className="text-xs text-blue-600 mt-1">ชั่วโมง</p>
          </div>
        </div>
      </Card>

      {/* Today's Schedule */}
      <Card className="p-6 border-2 border-gray-200">
        <h2 className="text-xl font-bold text-gray-800 mb-4">กะทำงานวันนี้</h2>
        <div className="space-y-3">
          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-gray-800">กะเช้า</p>
                <p className="text-sm text-gray-600">08:00 - 17:00 น.</p>
              </div>
              <Badge variant="active">ทำงานอยู่</Badge>
            </div>
          </div>
        </div>
      </Card>

      {/* Recent Activities */}
      <Card className="p-6 border-2 border-gray-200">
        <h2 className="text-xl font-bold text-gray-800 mb-4">กิจกรรมล่าสุด</h2>
        <div className="space-y-3">
          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-800">เช็คอินสำเร็จ</p>
              <p className="text-sm text-gray-600">วันนี้ เวลา 08:05 น.</p>
            </div>
            <Badge variant="active">ตรงเวลา</Badge>
          </div>

          <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div className="flex-1">
              <p className="font-medium text-gray-800">คำร้องขอลาได้รับการอนุมัติ</p>
              <p className="text-sm text-gray-600">เมื่อวาน เวลา 14:30 น.</p>
            </div>
            <Badge variant="pending">อนุมัติ</Badge>
          </div>
        </div>
      </Card>
    </div>
  );
}

function AttendanceModal({ mode, onClose, onSuccess }: AttendanceModalProps) {
  const [photo, setPhoto] = useState<{ taken: boolean; data: string | null }>({ taken: false, data: null });
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [ui, setUi] = useState({ loading: false, isCameraActive: false });
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    requestCameraAndLocation();
    return () => {
      stopCamera();
    };
  }, []);

  const requestCameraPermission = async () => {
    try {
      const result = await navigator.permissions.query({ name: 'camera' as PermissionName });
      if (result.state === 'denied') {
        alert('คุณได้ปฏิเสธการเข้าถึงกล้องแล้ว กรุณาเปิดการอนุญาตในการตั้งค่าเบราว์เซอร์');
        return false;
      }
      return true;
    } catch (error) {
      return true;
    }
  };

  const startCamera = async () => {
    try {
      const hasPermission = await requestCameraPermission();
      if (!hasPermission) return;

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
setUi(prev => ({ ...prev, isCameraActive: true }));
    } catch (error: any) {
      console.error('Camera error:', error);
      if (error.name === 'NotAllowedError' || error.name === 'PermissionDeniedError') {
        alert('กรุณาอนุญาตการเข้าถึงกล้องเพื่อบันทึกเวลาเข้างาน');
      } else {
        alert('ไม่สามารถเปิดกล้องได้ กรุณาลองอีกครั้ง');
      }
    }
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setUi(prev => ({ ...prev, isCameraActive: false }));
  };

  const getLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setLocation({
            lat: position.coords.latitude,
            lng: position.coords.longitude
          });
        },
        (error) => {
          console.error('Location error:', error);
          alert('ไม่สามารถระบุตำแหน่งได้ กรุณาเปิด GPS');
        }
      );
    }
  };

  const requestCameraAndLocation = () => {
    startCamera();
    getLocation();
  };

  const takePhoto = () => {
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
  };

  const retakePhoto = () => {
    setPhoto({ taken: false, data: null });
    startCamera();
  };

  const handleSubmit = () => {
    if (!photo.data || !location) {
      alert('กรุณาถ่ายรูปและระบุตำแหน่ง');
      return;
    }

    setUi(prev => ({ ...prev, loading: true }));
    // Simulate API call
    setTimeout(() => {
      onSuccess();
    }, 1000);
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <Card className="max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6 space-y-4">
          {/* Header */}
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-800">
              {mode === 'checkIn' ? 'เช็คอิน' : 'เช็คเอาท์'}
            </h2>
            <Button variant="ghost" size="icon" onClick={onClose}>
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </Button>
          </div>

          {/* Camera Section */}
          <div>
            <h3 className="font-semibold text-gray-800 mb-2">ถ่ายรูปยืนยันตัวตน</h3>
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
          </div>

          {/* Location Status */}
          <div className="flex items-center gap-2 text-sm">
            {location ? (
              <>
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                <span className="text-green-600">ระบุตำแหน่งสำเร็จ</span>
              </>
            ) : (
              <>
                <div className="animate-spin h-5 w-5 border-2 border-orange-500 border-t-transparent rounded-full"></div>
                <span className="text-gray-600">กำลังระบุตำแหน่ง...</span>
              </>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="flex-1">
              ยกเลิก
            </Button>
            <Button
              onClick={handleSubmit}
              disabled={!photo.data || !location || ui.loading}
              className="flex-1 bg-orange-500 hover:bg-orange-600"
            >
              {ui.loading ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
