'use client';

import { useState, useRef, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function ManagerAttendancePage() {
  const [mode, setMode] = useState<'checkIn' | 'checkOut' | null>(null);
  const [photo, setPhoto] = useState<{ taken: boolean; data: string | null }>({ taken: false, data: null });
  const [location, setLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [ui, setUi] = useState({ loading: false, showSuccess: false, isCameraActive: false });
  const [selectedDate, setSelectedDate] = useState(new Date().toISOString().split('T')[0]);
  
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Team attendance data
  const teamAttendance = [
    { id: 1, name: 'สมชาย ใจดี', status: 'present', checkIn: '08:30', checkOut: '-', avatar: '👨' },
    { id: 2, name: 'สมหญิง รักงาน', status: 'present', checkIn: '08:25', checkOut: '-', avatar: '👩' },
    { id: 3, name: 'ประยุทธ จริงใจ', status: 'late', checkIn: '09:15', checkOut: '-', avatar: '👨‍💼' },
    { id: 4, name: 'วิไล ขยัน', status: 'leave', checkIn: '-', checkOut: '-', avatar: '👩‍💼' },
    { id: 5, name: 'สมศักดิ์ ทำงาน', status: 'absent', checkIn: '-', checkOut: '-', avatar: '👨‍🔧' },
  ];

  const startCamera = useCallback(async () => {
    try {
      setUi(prev => ({ ...prev, isCameraActive: true }));
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 640, height: 480 }
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } catch (error) {
      console.error('Camera error:', error);
      alert('ไม่สามารถเปิดกล้องได้ กรุณาตรวจสอบการอนุญาต');
      setUi(prev => ({ ...prev, isCameraActive: false }));
    }
  }, []);

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

  const handleSubmit = useCallback(() => {
    if (!photo.data || !location) {
      alert('กรุณาถ่ายรูปและระบุตำแหน่ง');
      return;
    }

    setUi(prev => ({ ...prev, loading: true }));
    setTimeout(() => {
      setUi({ loading: false, showSuccess: true, isCameraActive: false });
      setTimeout(() => {
        setUi({ loading: false, showSuccess: false, isCameraActive: false });
        setMode(null);
        setPhoto({ taken: false, data: null });
        setLocation(null);
      }, 2000);
    }, 1000);
  }, [photo.data, location]);

  const handleCancel = useCallback(() => {
    stopCamera();
    setMode(null);
    setPhoto({ taken: false, data: null });
    setLocation(null);
  }, [stopCamera]);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'present':
        return <Badge variant="active">มาแล้ว</Badge>;
      case 'late':
        return <Badge variant="suspend">มาสาย</Badge>;
      case 'leave':
        return <Badge variant="default">ลา</Badge>;
      case 'absent':
        return <Badge className="bg-red-100 text-red-700">ขาด</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  if (mode) {
    return (
      <div className="min-h-screen bg-slate-50 pb-20">
        <div className="p-4 space-y-4">
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
              disabled={!photo.data || !location || ui.loading}
            >
              {ui.loading ? 'กำลังบันทึก...' : 'ยืนยัน'}
            </Button>
          </div>
        </div>

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
      <Card className="p-6 bg-gradient-to-r from-indigo-500 to-indigo-600 text-white">
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

      <Tabs defaultValue="my" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="my">ฉัน</TabsTrigger>
          <TabsTrigger value="team">ทีม</TabsTrigger>
        </TabsList>

        <TabsContent value="my" className="space-y-4 mt-4">
          <Card className="p-4">
            <h3 className="font-semibold text-gray-800 mb-3">สถานะวันนี้</h3>
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 bg-green-50 rounded-xl">
                <div className="text-sm text-gray-600 mb-1">เข้างาน</div>
                <div className="text-xl font-bold text-gray-900">08:30</div>
                <Badge variant="active" className="mt-2">ตรงเวลา</Badge>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl">
                <div className="text-sm text-gray-600 mb-1">ออกงาน</div>
                <div className="text-xl font-bold text-gray-400">--:--</div>
                <Badge variant="default" className="mt-2">ยังไม่ออก</Badge>
              </div>
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-4">
            <Card className="p-6 cursor-pointer hover:shadow-lg transition-shadow" onClick={handleStartCheckIn}>
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-3 bg-green-100 rounded-full flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                  </svg>
                </div>
                <h3 className="font-bold text-gray-900">เข้างาน</h3>
                <p className="text-xs text-gray-500 mt-1">Check In</p>
              </div>
            </Card>

            <Card className="p-6 cursor-pointer hover:shadow-lg transition-shadow" onClick={handleStartCheckOut}>
              <div className="text-center">
                <div className="w-16 h-16 mx-auto mb-3 bg-orange-100 rounded-full flex items-center justify-center">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </div>
                <h3 className="font-bold text-gray-900">ออกงาน</h3>
                <p className="text-xs text-gray-500 mt-1">Check Out</p>
              </div>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="team" className="space-y-4 mt-4">
          <Card className="p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-semibold text-gray-800">ทีมของฉัน</h3>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3 py-1 border-2 border-gray-200 rounded-lg text-sm"
              />
            </div>
            <div className="grid grid-cols-4 gap-2 text-center mb-4">
              <div>
                <div className="text-xl font-bold text-gray-900">5</div>
                <div className="text-xs text-gray-500">ทั้งหมด</div>
              </div>
              <div>
                <div className="text-xl font-bold text-green-600">2</div>
                <div className="text-xs text-gray-500">มาแล้ว</div>
              </div>
              <div>
                <div className="text-xl font-bold text-orange-600">1</div>
                <div className="text-xs text-gray-500">มาสาย</div>
              </div>
              <div>
                <div className="text-xl font-bold text-red-600">1</div>
                <div className="text-xs text-gray-500">ขาด</div>
              </div>
            </div>
          </Card>

          <div className="space-y-2">
            {teamAttendance.map((member) => (
              <Card key={member.id} className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center text-xl">
                      {member.avatar}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">{member.name}</div>
                      <div className="text-sm text-gray-500">
                        เข้า: {member.checkIn} | ออก: {member.checkOut}
                      </div>
                    </div>
                  </div>
                  {getStatusBadge(member.status)}
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
