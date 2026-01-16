import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../../contexts/useAuth';
import { useLocations } from '../../../contexts/LocationContext';
import { useEvents } from '../../../contexts/EventContext';
import { compressImage, getBase64Size } from '../../../utils/imageCompressor';
import { calculateAttendanceStatus, getApprovedLateArrivalRequest } from '../../../utils/attendanceLogic';
import { shouldBlockCheckIn } from '../../../utils/leaveAttendanceIntegration';

function TakePhoto() {
  const navigate = useNavigate();
  const location = useLocation();
  const { attendance, checkIn, checkOut, user } = useAuth();
  const { locations } = useLocations();
  const { events } = useEvents();
  const [photo, setPhoto] = useState(null);
  const [isCameraActive, setIsCameraActive] = useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = useState(false);
  const [popupMessage, setPopupMessage] = useState('');
  const [isEarlyCheckout, setIsEarlyCheckout] = useState(false);
  const [scheduleTimes, setScheduleTimes] = useState({ start: null, end: null });
  const [showInfoPopup, setShowInfoPopup] = useState(false);
  const [popupInfoMessage, setPopupInfoMessage] = useState('');
  const [imageSize, setImageSize] = useState(null); // 🆕 แสดงขนาดไฟล์
  const [showPhotoPreview, setShowPhotoPreview] = useState(false); // 🆕 แสดงรูปเต็มจอ
  const [currentLocation, setCurrentLocation] = useState(null); // 🆕 GPS location

  const schedule = location.state?.schedule || { time: '09:00 - 18:00' };
  const shiftId = location.state?.shiftId || null; // 🆕 รับ shiftId จาก UserDashboard

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  useEffect(() => {
    // แปลง "07.00 - 15.00" หรือ "07:00 - 15:00" ให้เป็นเวลาที่ใช้งานได้
    const [startTimeStr, endTimeStr] = schedule.time.split(' - ');
    const now = new Date();
    
    // แปลง "07.00" เป็น "07:00" (รองรับทั้งจุดและโคลอน)
    const normalizeTime = (timeStr) => timeStr.replace('.', ':');
    
    const startTime = new Date(now);
    const [startHour, startMinute] = normalizeTime(startTimeStr).split(':');
    startTime.setHours(parseInt(startHour), parseInt(startMinute), 0, 0);
    
    const endTime = new Date(now);
    const [endHour, endMinute] = normalizeTime(endTimeStr).split(':');
    endTime.setHours(parseInt(endHour), parseInt(endMinute), 0, 0);
    
    setScheduleTimes({ start: startTime, end: endTime });
    
    // console.log('⏰ Schedule Times:', {
    //   schedule: schedule.time,
    //   start: startTime.toLocaleTimeString('th-TH'),
    //   end: endTime.toLocaleTimeString('th-TH'),
    //   now: now.toLocaleTimeString('th-TH')
    // });

    if (attendance.status === 'checked_in' && now < endTime) {
      setIsEarlyCheckout(true);
    }

    // 🆕 Get GPS location
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setCurrentLocation({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
          });
        },
        (error) => {
          console.warn('GPS Error:', error);
        }
      );
    }
  }, [schedule.time, attendance.status]);

  // 🆕 Helper: Calculate distance between two coordinates (Haversine formula)
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Earth radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c; // Distance in meters
  };

  // 🆕 Helper: Find nearest location or event
  const findNearestPlace = () => {
    if (!currentLocation) return null;

    const allPlaces = [
      ...locations.map(loc => ({ ...loc, type: 'location' })),
      ...events.map(evt => ({
        id: evt.id,
        name: evt.locationName,
        latitude: evt.latitude,
        longitude: evt.longitude,
        type: 'event'
      }))
    ];

    let nearest = null;
    let minDistance = Infinity;

    allPlaces.forEach(place => {
      const distance = calculateDistance(
        currentLocation.latitude,
        currentLocation.longitude,
        place.latitude,
        place.longitude
      );

      if (distance < minDistance) {
        minDistance = distance;
        nearest = place;
      }
    });

    return nearest ? {
      gps: `${currentLocation.latitude.toFixed(6)},${currentLocation.longitude.toFixed(6)}`,
      address: nearest.name,
      distance: minDistance < 1000 
        ? `${Math.round(minDistance)} ม.` 
        : `${(minDistance / 1000).toFixed(2)} กม.`
    } : null;
  };

  const startCamera = () => {
    navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user', width: { ideal: 1280 }, height: { ideal: 720 } } })
      .then((stream) => {
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          videoRef.current.play();
        }
        setIsCameraActive(true);
      })
      .catch((err) => console.error('Error accessing camera:', err));
  };

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    setIsCameraActive(false);
  };

  const capturePhoto = async () => {
    const canvas = canvasRef.current;
    const video = videoRef.current;
    if (canvas && video) {
      const context = canvas.getContext('2d');
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      
      try {
        // 🔥 บีบอัดรูปเป็น JPEG ขนาด 800px, คุณภาพ 70%
        const compressedPhoto = await compressImage(canvas, {
          maxWidth: 800,
          maxHeight: 800,
          quality: 0.7
        });
        
        // คำนวณขนาดไฟล์
        const size = getBase64Size(compressedPhoto);
        setImageSize(size);
        
        setPhoto(compressedPhoto);
        console.log(`📸 รูปภาพบีบอัดแล้ว: ${size} KB`);
      } catch (error) {
        console.error('Error compressing image:', error);
        // Fallback to uncompressed if compression fails
        setPhoto(canvas.toDataURL('image/jpeg', 0.7));
      }
      
      stopCamera();
    }
  };

  const retakePhoto = () => {
    setPhoto(null);
    startCamera();
  };

  const goBackToDashboard = () => {
    stopCamera();
    navigate('/user/dashboard');
  };

  const confirmPhoto = () => {
    const now = new Date();
    const currentTime = now.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    
    // ✋ STEP 3: ตรวจสอบว่ามีการลาที่อนุมัติหรือไม่
    const today = new Date().toLocaleDateString('th-TH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
    
    const blockInfo = shouldBlockCheckIn(user.id, today)
    
    if (blockInfo.blocked) {
      setPopupInfoMessage(`❌ ${blockInfo.reason}\n\nคุณไม่สามารถ check-in ได้`);
      setShowInfoPopup(true);
      return;
    }
    
    console.log('🔍 Confirm Photo Debug:', {
      now: now.toLocaleTimeString('th-TH'),
      currentTime,
      scheduleStart: scheduleTimes.start?.toLocaleTimeString('th-TH'),
      scheduleEnd: scheduleTimes.end?.toLocaleTimeString('th-TH'),
      attendanceStatus: attendance.status
    });
    
    // 🔥 เช็คว่าอยู่นอกช่วงเวลาตารางหรือไม่
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTimeInMinutes = currentHour * 60 + currentMinute;
    
    if (scheduleTimes.start && scheduleTimes.end) {
      const startTimeInMinutes = scheduleTimes.start.getHours() * 60 + scheduleTimes.start.getMinutes();
      const endTimeInMinutes = scheduleTimes.end.getHours() * 60 + scheduleTimes.end.getMinutes();
      const bufferAfterEndMinutes = 30; // หลังเลิกงานได้อีก 30 นาที
      
      console.log('⏰ Time Check:', {
        currentMinutes: currentTimeInMinutes,
        startMinutes: startTimeInMinutes,
        endMinutes: endTimeInMinutes,
        endWithBuffer: endTimeInMinutes + bufferAfterEndMinutes,
        diff: currentTimeInMinutes - startTimeInMinutes
      });
      
      // ถ้าเลยเวลาตาราง + buffer แล้ว (หลัง end time + 30 นาที)
      if (currentTimeInMinutes > (endTimeInMinutes + bufferAfterEndMinutes)) {
        const scheduleEndTime = schedule.time.split(' - ')[1];
        setPopupInfoMessage(`ไม่สามารถเข้า/ออกงานได้\nเลยเวลาที่กำหนด (หลัง ${scheduleEndTime} น. + 30 นาที)\nกรุณาติดต่อผู้จัดการ`);
        setShowInfoPopup(true);
        return;
      }
      
      // ถ้ายังไม่ถึงเวลาเริ่มงาน (ก่อน start time มากกว่า 1 ชั่วโมง)
      if (currentTimeInMinutes < (startTimeInMinutes - 60)) {
        const scheduleStartTime = schedule.time.split(' - ')[0];
        setPopupInfoMessage(`ยังไม่ถึงเวลาเริ่มงาน\nเวลาเริ่มงาน: ${scheduleStartTime} น.`);
        setShowInfoPopup(true);
        return;
      }
    }
    
    try {
      // 🆕 Get nearest location info with distance
      const locationInfo = findNearestPlace() || { gps: '13.7563,100.5018', address: 'ในพื้นที่อนุญาต', distance: '-' };

      // 🔥 Validate shiftId for multi-shift scenario
      const finalShiftId = shiftId || null;

      if (attendance.status === 'not_checked_in') {
        // 🆕 ใช้ logic ใหม่: calculateAttendanceStatus
        const [startTimeStr, endTimeStr] = schedule.time.split(' - ');
        const workTimeStart = startTimeStr.replace('.', ':'); // แปลง "07.00" เป็น "07:00"
        const workTimeEnd = endTimeStr.replace('.', ':');
        
        // 🔥 ดึงวันที่ปัจจุบันในรูปแบบ dd/mm/yyyy (พ.ศ.)
        const today = new Date().toLocaleDateString('th-TH', {
          year: 'numeric',
          month: '2-digit',
          day: '2-digit'
        });
        
        // 🔥 ตรวจสอบคำขอเข้างานสายที่อนุมัติแล้ว
        const lateArrivalRequest = getApprovedLateArrivalRequest(user.id, today);
        
        const attendanceResult = calculateAttendanceStatus(currentTime, workTimeStart, false, lateArrivalRequest);
        const { status, lateMinutes, shouldAutoCheckout, message: statusMessage } = attendanceResult;
        
        console.log('🔍 Attendance Result:', { status, lateMinutes, shouldAutoCheckout, statusMessage });
        
        let message = '';
        
        // แสดง message ตามสถานะ (status จาก ATTENDANCE_CONFIG: 'on_time', 'late', 'absent')
        if (status === 'on_time') {
          message = `เข้างานตรงเวลา ${currentTime} น.`;
          checkIn(currentTime, photo, workTimeStart, false, locationInfo, finalShiftId);
        } else if (status === 'late') {
          message = `มาสาย ${lateMinutes} นาที (${currentTime} น.)`;
          checkIn(currentTime, photo, workTimeStart, false, locationInfo, finalShiftId);
        } else if (status === 'absent') {
          if (shouldAutoCheckout) {
            // 🔥 ขาดงาน - เข้างานสายเกินขีดจำกัด → Auto check-out ทันที
            message = `ขาดงาน - เข้างานสายเกินกำหนด (${currentTime} น.)\nออกงานอัตโนมัติแล้ว`;
            checkIn(currentTime, photo, workTimeStart, true, locationInfo, finalShiftId);
          } else {
            message = `ขาดงาน - ไม่ได้เข้างาน (${currentTime} น.)`;
            checkIn(currentTime, photo, workTimeStart, false, locationInfo, finalShiftId);
          }
        } else {
          // Fallback ถ้า status ไม่ตรงกับที่คาดหวัง
          message = statusMessage || `เข้างาน ${currentTime} น.`;
          checkIn(currentTime, photo, workTimeStart, false, locationInfo, finalShiftId);
        }
        
        console.log('📝 Final Message:', message);
        setPopupMessage(message);
        
      } else if (attendance.status === 'checked_in') {
        // กฎการออกงาน - ต้องถึงเวลาออกงานก่อน
        if (isEarlyCheckout) {
          setPopupInfoMessage(`ยังไม่ถึงเวลาออกงาน\nเวลาออกงาน: ${schedule.time.split(' - ')[1]} น.`);
          setShowInfoPopup(true);
          return;
        }
        
        checkOut(currentTime, photo, locationInfo, finalShiftId);
        setPopupMessage(`ออกงานเวลา ${currentTime} น.`);
      }
    } catch (error) {
      console.error('Error during check in/out:', error);
      setPopupInfoMessage(error.message || 'เกิดข้อผิดพลาดในการบันทึก กรุณาลองใหม่อีกครั้ง');
      setShowInfoPopup(true);
      return;
    }
    
    stopCamera();
    setShowSuccessPopup(true);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  return (
    <div className="fixed inset-0 z-40 overflow-y-auto bg-gradient-to-b from-orange-50 to-white">
      <div className="bg-brand-primary text-white p-4 shadow-lg sticky top-0 z-50">
        <div className="relative flex items-center justify-center h-full">
          <button onClick={goBackToDashboard} className="absolute p-2 transition-colors rounded-lg left-4 hover:bg-white/20">
            <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="white">
              <path d="M560-240 320-480l240-240 56 56-184 184 184 184-56 56Z"/>
            </svg>
          </button>
          <div className="text-center">
            <h1 className="text-xl font-bold font-prompt">ลงเวลาเข้า/ออกงาน</h1>
            <p className="text-xs mt-0.5 opacity-90">ถ่ายรูปเพื่อบันทึกเวลา</p>
          </div>
        </div>
      </div>

      <div className="px-4 py-4 pb-24">
        {!photo ? (
          <div className="space-y-6">
            <div className="overflow-hidden bg-white shadow-xl rounded-2xl">
              <div className="relative aspect-[3/4] bg-gray-900">
                <video ref={videoRef} className="object-cover w-full h-full" playsInline autoPlay muted />
                {!isCameraActive && (
                  <div className="absolute inset-0 flex items-center justify-center bg-gray-800">
                    <div className="text-center text-white">
                      <svg xmlns="http://www.w3.org/2000/svg" height="80px" viewBox="0 0 24 24" width="80px" fill="currentColor" className="mx-auto mb-4 opacity-50">
                        <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zm0 8c-1.65 0-3-1.35-3-3s1.35-3 3-3 3 1.35 3 3-1.35 3-3 3zm0-13C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm-1-15h2v7h-2zm0 9h2v2h-2z"/>
                      </svg>
                      <p className="text-lg font-prompt">กล้องยังไม่เปิด</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
            <div className="flex justify-center gap-3">
              {!isCameraActive ? (
                <button onClick={startCamera} className="flex-1 bg-brand-primary text-white py-4 px-6 rounded-xl font-prompt font-medium text-lg shadow-lg hover:bg-orange-600 transition-all duration-300 transform hover:scale-105 active:scale-95 flex items-center justify-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor">
                    <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zm0 8c-1.65 0-3-1.35-3-3s1.35-3 3-3 3 1.35 3 3-1.35 3-3 3zm8-9h-3.17l-1.83-2H9L7.17 6H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z"/>
                  </svg>
                  เริ่มกล้อง
                </button>
              ) : (
                <button onClick={capturePhoto} className="w-20 h-20 bg-white border-4 border-brand-primary rounded-full shadow-lg hover:bg-brand-primary hover:border-white transition-all duration-300 transform hover:scale-110 active:scale-95 flex items-center justify-center group">
                  <div className="w-16 h-16 bg-brand-primary rounded-full group-hover:bg-white transition-all duration-300"></div>
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* 🔥 รูปภาพที่ถ่าย - คลิกเพื่อดูเต็มจอ */}
            <div className="relative overflow-hidden bg-white shadow-xl cursor-pointer rounded-2xl group"
                 onClick={() => setShowPhotoPreview(true)}>
              <img src={photo} alt="Captured" className="w-full h-auto transition-transform duration-300 group-hover:scale-105" />
              
              {/* Badge แสดงขนาดไฟล์ */}
              {imageSize && (
                <div className="absolute px-3 py-1 text-xs font-semibold text-white rounded-lg shadow-lg top-4 right-4 bg-black/60 backdrop-blur-sm flex items-center gap-1.5">
                  <svg xmlns="http://www.w3.org/2000/svg" height="14px" viewBox="0 0 24 24" width="14px" fill="currentColor">
                    <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zm0 8c-1.65 0-3-1.35-3-3s1.35-3 3-3 3 1.35 3 3-1.35 3-3 3zm8-9h-3.17l-1.83-2H9L7.17 6H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z"/>
                  </svg>
                  {imageSize} KB
                </div>
              )}
              
              {/* Overlay สำหรับ hover */}
              <div className="absolute inset-0 flex items-center justify-center transition-opacity duration-300 opacity-0 bg-black/30 group-hover:opacity-100">
                <div className="text-center text-white">
                  <svg xmlns="http://www.w3.org/2000/svg" height="48px" viewBox="0 0 24 24" width="48px" fill="currentColor" className="mx-auto mb-2">
                    <path d="M21 19V5c0-1.1-.9-2-2-2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2zM8.5 13.5l2.5 3.01L14.5 12l4.5 6H5l3.5-4.5z"/>
                  </svg>
                  <p className="text-sm font-prompt">คลิกเพื่อดูรูปเต็มจอ</p>
                </div>
              </div>
            </div>
            
            <div className="flex gap-3">
              <button onClick={retakePhoto} className="flex items-center justify-center flex-1 gap-2 px-6 py-4 text-lg font-medium text-gray-700 transition-all duration-300 transform bg-gray-100 border border-gray-300 shadow-md rounded-xl font-prompt hover:bg-gray-200 hover:scale-105 active:scale-95">
                <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor">
                  <path d="M12 4V1L8 5l4 4V6c3.31 0 6 2.69 6 6 0 1.01-.25 1.97-.7 2.8l1.46 1.46C19.54 15.03 20 13.57 20 12c0-4.42-3.58-8-8-8zm0 14c-3.31 0-6-2.69-6-6 0-1.01.25-1.97.7-2.8L5.24 7.74C4.46 8.97 4 10.43 4 12c0 4.42 3.58 8 8 8v3l4-4-4-4v3z"/>
                </svg>
                ถ่ายใหม่
              </button>
              <button onClick={confirmPhoto} disabled={isEarlyCheckout} className={`flex-1 text-white py-4 px-6 rounded-xl font-prompt font-medium text-lg shadow-lg transition-all duration-300 transform flex items-center justify-center gap-2 ${isEarlyCheckout ? 'bg-gray-400 cursor-not-allowed' : 'bg-brand-primary hover:bg-orange-600 active:scale-95 hover:scale-105'}`}>
                <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor">
                  <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                </svg>
                ยืนยัน
              </button>
            </div>
            {isEarlyCheckout && (<p className="mt-4 font-medium text-center text-red-600 font-prompt">ไม่สามารถออกงานก่อนเวลา {schedule.time.split(' - ')[1]} น.</p>)}
          </div>
        )}
      </div>

      <canvas ref={canvasRef} className="hidden" />

      {showSuccessPopup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm p-8 text-center bg-white shadow-2xl rounded-2xl">
            <div className="flex items-center justify-center w-20 h-20 mx-auto mb-6 bg-green-100 rounded-full">
              {/* === ICON REPLACEMENT === */}
              <svg className="w-12 h-12 text-green-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth="1.5" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <h2 className="mb-2 text-2xl font-bold text-gray-800">บันทึกสำเร็จ!</h2>
            <p className="mb-8 text-gray-600">{popupMessage}</p>
            <button onClick={() => navigate('/user/dashboard')} className="w-full bg-brand-primary text-white py-3 px-6 rounded-xl font-prompt font-medium text-lg shadow-lg hover:bg-orange-600 transition-all duration-300 transform hover:scale-105 active:scale-95">
              กลับสู่หน้าหลัก
            </button>
          </div>
        </div>
      )}

      {showInfoPopup && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm p-8 text-center bg-white shadow-2xl rounded-2xl">
            <div className="flex items-center justify-center w-20 h-20 mx-auto mb-6 bg-red-100 rounded-full">
              <svg xmlns="http://www.w3.org/2000/svg" height="48px" viewBox="0 -960 960 960" width="48px" fill="#EF4444">
                <path d="M480-280q17 0 28.5-11.5T520-320q0-17-11.5-28.5T480-360q-17 0-28.5 11.5T440-320q0 17 11.5 28.5T480-280Zm-40-160h80v-240h-80v240Zm40 360q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Zm0-80q134 0 227-93t93-227q0-134-93-227t-227-93q-134 0-227 93t-93 227q0 134 93 227t227 93Zm0-320Z"/>
              </svg>
            </div>
            <h2 className="mb-2 text-2xl font-bold text-gray-800">ไม่สามารถทำรายการได้</h2>
            <p className="mb-8 text-gray-600">{popupInfoMessage}</p>
            <button onClick={() => setShowInfoPopup(false)} className="w-full px-6 py-3 text-lg font-medium text-white transition-all duration-300 bg-gray-500 shadow-lg rounded-xl font-prompt hover:bg-gray-600">
              ปิด
            </button>
          </div>
        </div>
      )}

      {/* 🔥 Photo Preview Modal - ดูรูปเต็มจอ */}
      {showPhotoPreview && photo && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-md p-4"
             onClick={() => setShowPhotoPreview(false)}>
          <div className="relative w-full max-w-4xl">
            {/* ปุ่มปิด */}
            <button 
              onClick={() => setShowPhotoPreview(false)}
              className="absolute z-10 p-3 text-white transition-all duration-300 bg-white/20 backdrop-blur-sm rounded-full shadow-lg -top-4 -right-4 hover:bg-white/30 hover:scale-110">
              <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 0 24 24" width="24px" fill="currentColor">
                <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
              </svg>
            </button>

            {/* รูปภาพ */}
            <img 
              src={photo} 
              alt="Preview" 
              className="w-full h-auto shadow-2xl rounded-2xl"
              onClick={(e) => e.stopPropagation()} 
            />
            
            {/* ข้อมูลรูป */}
            <div className="absolute px-4 py-2 text-center text-white rounded-lg shadow-lg bottom-4 left-1/2 -translate-x-1/2 bg-black/60 backdrop-blur-sm flex items-center gap-2">
              <svg xmlns="http://www.w3.org/2000/svg" height="18px" viewBox="0 0 24 24" width="18px" fill="currentColor">
                <path d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zm0 8c-1.65 0-3-1.35-3-3s1.35-3 3-3 3 1.35 3 3-1.35 3-3 3zm8-9h-3.17l-1.83-2H9L7.17 6H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V8c0-1.1-.9-2-2-2z"/>
              </svg>
              <p className="text-sm font-prompt">
                ขนาด: {imageSize} KB | รูปถ่ายถูกบีบอัดแล้ว
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TakePhoto;