import React, { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLeave } from '../../../contexts/LeaveContext';
import { useAuth } from '../../../contexts/AuthContext';
import AlertDialog from '../../../components/common/AlertDialog';
import ConfirmDialog from '../../../components/common/ConfirmDialog';
import CustomDatePicker from '../../../components/common/CustomDatePicker';

function LeaveRequestModal({ closeModal }) {
  const { addLeave, addLateArrival, calculateDays, validateLeaveRequest, getLeaveRules } = useLeave(); // ดึงฟังก์ชันจาก LeaveContext
  const { user } = useAuth(); // ดึงข้อมูล user ปัจจุบัน
  
  // Debug: ตรวจสอบว่า user ที่ใช้ส่งคำขอลาคือใคร
  useEffect(() => {
    if (user) {
      console.log(' [LeaveRequestModal] Current user:', {
        id: user?.id,
        name: user?.name,
        username: user?.username,
        role: user?.role
      });
    }
  }, [user]);
  
  // ตรวจสอบว่าผู้ใช้มีสิทธิ์ลาคลอดหรือไม่ (เฉพาะนาง/นางสาว)
  const canRequestMaternityLeave = user?.titlePrefix === 'นาง' || user?.titlePrefix === 'นางสาว';

  // ฟังก์ชันดึงวันที่วันนี้ในรูปแบบ yyyy-mm-dd - ใช้กับ input type="date"
  const getTodayDate = () => {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0'); // เดือนต้อง +1 เพราะเริ่มที่ 0
    const day = String(today.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  // state สำหรับเก็บข้อมูลฟอร์มการขอลา - หัวใจหลักของ Modal
  const [formData, setFormData] = useState({
    requestType: 'leave', // 'leave' หรือ 'lateArrival' - ประเภทคำขอ
    leaveType: '',        // ประเภทการลา (ลาป่วย, ลากิจ, ฯลฯ)
    leaveMode: 'fullday', // 'fullday' หรือ 'hourly' - ลาเต็มวันหรือรายชั่วโมง
    startDate: '',        // วันที่เริ่มต้น
    endDate: '',          // วันที่สิ้นสุด
    startTime: '',        // เวลาเริ่มต้น (สำหรับลารายชั่วโมง)
    endTime: '',          // เวลาสิ้นสุด
    reason: '',           // เหตุผลในการลา
    documents: []         // ไฟล์เอกสารแนบ (แปลงเป็น base64)
  });

  // state สำหรับแสดงวันที่ในรูปแบบ dd/mm/yyyy - ใช้แสดงผลให้ user อ่านง่าย
  const [displayDates, setDisplayDates] = useState({
    startDate: '',
    endDate: ''
  });

  // state สำหรับควบคุมการแสดง/ซ่อน Time Picker
  const [showTimeStartPicker, setShowTimeStartPicker] = useState(false); // เปิด/ปิด Time Picker เวลาเริ่มต้น
  const [showTimeEndPicker, setShowTimeEndPicker] = useState(false);     // เปิด/ปิด Time Picker เวลาสิ้นสุด
  const timeStartPickerRef = useRef(null); // ref สำหรับตรวจจับการคลิกนอก Time Picker
  const timeEndPickerRef = useRef(null);
  
  // state สำหรับเก็บค่าเวลาชั่วคราวใน time picker
  const [tempStartTime, setTempStartTime] = useState({ hour: '09', minute: '00' });
  const [tempEndTime, setTempEndTime] = useState({ hour: '17', minute: '00' });
  
  // state สำหรับควบคุมการหมุนของลูกศร dropdown
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const selectRef = useRef(null);

  // state สำหรับ Dialog การแจ้งเตือน
  const [_showAlert, setShowAlert] = useState(false); // แสดง/ซ่อน Alert Dialog
  const [_alertConfig, setAlertConfig] = useState({   // config ของ Alert
    type: 'success', // 'success', 'error', 'warning'
    title: '',
    message: ''
  });

  // state สำหรับ validation errors
  const [validationErrors, setValidationErrors] = useState({
    leaveType: '',
    startDate: '',
    endDate: '',
    reason: '',
    documents: ''
  });

  // ปิด dropdown และ time picker เมื่อคลิกข้างนอก
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (timeStartPickerRef.current && !timeStartPickerRef.current.contains(event.target)) {
        setShowTimeStartPicker(false);
      }
      if (timeEndPickerRef.current && !timeEndPickerRef.current.contains(event.target)) {
        setShowTimeEndPicker(false);
      }
      // ปิด dropdown เมื่อคลิกข้างนอก
      if (selectRef.current && !selectRef.current.contains(event.target)) {
        setIsDropdownOpen(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  // Convert date format from yyyy-mm-dd to dd/mm/yyyy (พ.ศ.)
  const convertDateFormat = (dateStr) => {
    if (!dateStr) return '';
    const [year, month, day] = dateStr.split('-');
    // แปลง ค.ศ. เป็น พ.ศ. (+543)
    const buddhistYear = parseInt(year) + 543;
    return `${day}/${month}/${buddhistYear}`;
  };

  // Convert dd/mm/yyyy to yyyy-mm-dd
  const convertToISOFormat = (dateStr) => {
    if (!dateStr) return '';
    const [day, month, year] = dateStr.split('/');
    return `${year}-${month}-${day}`;
  };

  // Format date for display (dd/mm/yyyy)
  const formatDateForDisplay = (isoDate) => {
    if (!isoDate) return '';
    return convertDateFormat(isoDate);
  };

  // กำหนดวันที่เริ่มต้นที่เลือกได้ based on leave type
  // ลาป่วย and ลากิจ สามารถเลือกย้อนหลังได้
  // การลาอื่นๆ เลือกได้ตั้งแต่วันปัจจุบันเป็นต้นไป
  const getMinDate = () => {
    if (formData.leaveType === 'ลาป่วย' || formData.leaveType === 'ลากิจ') {
      return '';
    }
    return getTodayDate();
  };

  // คำนวณจํานวนวันที่ลาได้
  const getTotalDays = () => {
    if (formData.startDate && formData.endDate) {
      const startFormatted = convertDateFormat(formData.startDate);
      const endFormatted = convertDateFormat(formData.endDate);
      return calculateDays(startFormatted, endFormatted);
    }
    return 0;
  };

  // คำนวณชั่วโมงที่ลารายชั่วโมงได้
  const getTotalHours = () => {
    if (formData.startTime && formData.endTime) {
      const [startHour, startMin] = formData.startTime.split(':').map(Number);
      const [endHour, endMin] = formData.endTime.split(':').map(Number);

      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;
      const diffMinutes = endMinutes - startMinutes;

      if (diffMinutes <= 0) return 0;

      const hours = Math.floor(diffMinutes / 60);
      const minutes = diffMinutes % 60;

      return minutes > 0 ? `${hours} ชม. ${minutes} นาที` : `${hours} ชั่วโมง`;
    }
    return 0;
  };

  // สร้างตัวเลือกชั่วโมงและนาทีสำหรับ time picker
  const hours24 = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
  const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

  // แปลงรูปแบบเวลาให้เป็น 24 ชั่วโมง
  const normalizeTime = (input) => {
    if (!input) return '';
    
    // ถ้าพิมเฉพาะตัวเลข 1-2 ตัว (เช่น "9" หรือ "14") ให้เติม :00
    if (/^\d{1,2}$/.test(input)) {
      const hour = parseInt(input);
      if (hour >= 0 && hour <= 23) {
        return `${input.padStart(2, '0')}:00`;
      }
    }
    
    // แปลง am/pm format
    const amPmMatch = input.match(/(\d{1,2}):?(\d{2})?\s*(am|pm)/i);
    if (amPmMatch) {
      let hour = parseInt(amPmMatch[1]);
      const minute = amPmMatch[2] || '00';
      const period = amPmMatch[3].toLowerCase();
      
      if (period === 'pm' && hour !== 12) hour += 12;
      if (period === 'am' && hour === 12) hour = 0;
      
      return `${hour.toString().padStart(2, '0')}:${minute}`;
    }
    
    // แปลง HH:MM format
    const timeMatch = input.match(/^(\d{1,2}):(\d{2})$/);
    if (timeMatch) {
      const hour = parseInt(timeMatch[1]);
      const minute = parseInt(timeMatch[2]);
      
      if (hour >= 0 && hour <= 23 && minute >= 0 && minute <= 59) {
        return `${hour.toString().padStart(2, '0')}:${minute.toString().padStart(2, '0')}`;
      }
    }
    
    return input;
  };

  // (ไม่ปิด picker ทันที)
  const handleTimeSelect = (hour, minute, isStart) => {
    if (isStart) {
      setTempStartTime({ hour, minute });
    } else {
      setTempEndTime({ hour, minute });
    }
  };

  // ยืนยันการเลือกเวลา
  const confirmTimeSelection = (isStart) => {
    const todayDate = getTodayDate();
    if (isStart) {
      const timeValue = `${tempStartTime.hour}:${tempStartTime.minute}`;
      setFormData({ 
        ...formData, 
        startTime: timeValue,
        startDate: todayDate,
        endDate: todayDate
      });
      setShowTimeStartPicker(false);
    } else {
      const timeValue = `${tempEndTime.hour}:${tempEndTime.minute}`;
      setFormData({ 
        ...formData, 
        endTime: timeValue,
        startDate: todayDate,
        endDate: todayDate
      });
      setShowTimeEndPicker(false);
    }
  };

  // เปิด Time Picker
  const openTimePicker = (isStart) => {
    if (isStart) {
      if (formData.startTime) {
        const [hour, minute] = formData.startTime.split(':');
        setTempStartTime({ hour, minute });
      }
      setShowTimeStartPicker(true);
    } else {
      if (formData.endTime) {
        const [hour, minute] = formData.endTime.split(':');
        setTempEndTime({ hour, minute });
      }
      setShowTimeEndPicker(true);
    }
  };

  // จัดการการเปลี่ยนแปลงไฟล์เอกสารแนบ
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    
    // ตรวจสอบชนิดและนามสกุลของไฟล์
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'application/pdf'];
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.pdf'];
    
    const invalidFiles = files.filter(file => {
      const isValidType = allowedTypes.includes(file.type);
      const hasValidExtension = allowedExtensions.some(ext => 
        file.name.toLowerCase().endsWith(ext)
      );
      return !isValidType && !hasValidExtension;
    });

    if (invalidFiles.length > 0) {
      const invalidNames = invalidFiles.map(f => f.name).join(', ');
      showAlertDialog(
        'error', 
        'ไฟล์ไม่ถูกต้อง', 
        `ไฟล์ต่อไปนี้ไม่รองรับ: ${invalidNames}\n\nรองรับเฉพาะไฟล์ .jpg, .jpeg, .png, .pdf เท่านั้น`
      );
      // ล้างค่า input fileselector
      e.target.value = '';
      return;
    }

    // แปลงไฟล์เป็น base64 URL แทนที่จะเก็บแค่ชื่อไฟล์
    const fileReaders = files.map(file => {
      return new Promise((resolve) => {
        const reader = new FileReader();
        reader.onloadend = () => {
          resolve(reader.result); // base64 URL
        };
        reader.readAsDataURL(file);
      });
    });

    Promise.all(fileReaders).then(fileUrls => {
      setFormData({ ...formData, documents: fileUrls });
    });
  };

  // Show alert dialog
  const showAlertDialog = (type, title, message) => {
    setAlertConfig({ type, title, message });
    setShowAlert(true);
  };

  // Validate form fields
  const validateForm = () => {
    const errors = {
      leaveType: '',
      startDate: '',
      endDate: '',
      reason: '',
      documents: ''
    };
    let isValid = true;

    // Validate leave type for regular leave
    if (formData.requestType === 'leave' && !formData.leaveType) {
      errors.leaveType = 'กรุณาเลือกประเภทการลา';
      isValid = false;
    }

    // Validate dates
    if (formData.requestType === 'leave' && formData.leaveMode === 'fullday') {
      if (!formData.startDate) {
        errors.startDate = 'กรุณาเลือกวันที่เริ่มต้น';
        isValid = false;
      }
      if (!formData.endDate) {
        errors.endDate = 'กรุณาเลือกวันที่สิ้นสุด';
        isValid = false;
      }
    }

    // Validate reason
    if (!formData.reason || !formData.reason.trim()) {
      errors.reason = 'กรุณาระบุเหตุผล';
      isValid = false;
    }

    // Validate documents for sick leave 3+ days
    if (formData.requestType === 'leave' && formData.leaveType === 'ลาป่วย' && formData.leaveMode === 'fullday') {
      const totalDays = calculateDays(
        convertDateFormat(formData.startDate),
        convertDateFormat(formData.endDate)
      );
      if (totalDays >= 3 && (!formData.documents || formData.documents.length === 0)) {
        errors.documents = 'กรุณาแนบใบรับรองแพทย์สำหรับการลาป่วย 3 วันขึ้นไป';
        isValid = false;
      }
    }

    setValidationErrors(errors);
    return isValid;
  };

  // Clear error message
  const clearError = (field) => {
    setValidationErrors(prev => ({ ...prev, [field]: '' }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();

    // clear previous errors
    setValidationErrors({
      leaveType: '',
      startDate: '',
      endDate: '',
      reason: '',
      documents: ''
    });

    // Validate form before submission
    if (!validateForm()) {
      // Scroll to first error
      const firstError = document.querySelector('.error-message');
      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }

    // Handle late arrival request
    if (formData.requestType === 'lateArrival') {
      // Validate time
      if (!formData.startTime || !formData.endTime) {
        showAlertDialog('error', 'ข้อผิดพลาด', 'กรุณาเลือกเวลาเริ่มต้นและสิ้นสุด');
        return;
      }
      if (formData.endTime <= formData.startTime) {
        showAlertDialog('error', 'ข้อผิดพลาด', 'เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น');
        return;
      }
      
      // Validate reason
      if (!formData.reason || !formData.reason.trim()) {
        showAlertDialog('error', 'ข้อผิดพลาด', 'กรุณาระบุเหตุผล');
        return;
      }

      const lateArrivalData = {
        date: convertDateFormat(getTodayDate()),
        startTime: formData.startTime,
        endTime: formData.endTime,
        reason: formData.reason,
        documents: formData.documents
      };

      addLateArrival(lateArrivalData);
      showAlertDialog('success', 'สำเร็จ!', 'ส่งคำขอเข้างานสายเรียบร้อยแล้ว');

      setTimeout(() => {
        closeModal();
      }, 1500);
      return;
    }

    // จัดการคำขอลาปกติ
    // Validate dates
    if (formData.leaveMode === 'fullday') {
      if (new Date(formData.endDate) < new Date(formData.startDate)) {
        showAlertDialog('error', 'ข้อผิดพลาด', 'วันที่สิ้นสุดต้องมากกว่าหรือเท่ากับวันที่เริ่มต้น');
        return;
      }
    } else {
      // Hourly validation
      if (!formData.startDate) {
        showAlertDialog('error', 'ข้อผิดพลาด', 'กรุณาเลือกวันที่ลา');
        return;
      }
      if (!formData.startTime || !formData.endTime) {
        showAlertDialog('error', 'ข้อผิดพลาด', 'กรุณาเลือกเวลาเริ่มต้นและสิ้นสุด');
        return;
      }
      if (formData.endTime <= formData.startTime) {
        showAlertDialog('error', 'ข้อผิดพลาด', 'เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น');
        return;
      }
    }

    // Validate document requirements
    // ตรวจสอบกรณีลาป่วย 3 วันขึ้นไป ต้องแนบใบรับรองแพทย์
    if (formData.leaveType === 'ลาป่วย' && formData.leaveMode === 'fullday') {
      const totalDays = calculateDays(
        convertDateFormat(formData.startDate),
        convertDateFormat(formData.endDate)
      );
      if (totalDays >= 3 && (!formData.documents || formData.documents.length === 0)) {
        showAlertDialog('error', 'ไม่สามารถส่งคำขอลาได้', 'การลาป่วยตั้งแต่ 3 วันขึ้นไป จำเป็นต้องแนบใบรับรองแพทย์');
        return;
      }
    }

    // เตรียมข้อมูลสำหรับส่งคำขอลา
    let leaveData;

    if (formData.leaveMode === 'fullday') {
      leaveData = {
        leaveType: formData.leaveType,
        startDate: convertDateFormat(formData.startDate),
        endDate: convertDateFormat(formData.endDate),
        reason: formData.reason,
        documents: formData.documents,
        leaveMode: 'fullday',
        userId: user?.id, //  เพิ่ม userId สำหรับ integration
        userName: user?.name //  เพิ่ม userName สำหรับ integration
      };
      
      // 🔍 Debug: ตรวจสอบข้อมูลก่อนส่ง
      // console.log('[LeaveRequestModal] Fullday leave data:', leaveData);
    } else {
      // Hourly leave
      leaveData = {
        leaveType: formData.leaveType,
        startDate: convertDateFormat(formData.startDate),
        endDate: convertDateFormat(formData.startDate), // วันเดียวกับ startDate
        startTime: formData.startTime,
        endTime: formData.endTime,
        reason: formData.reason,
        documents: formData.documents,
        leaveMode: 'hourly',
        userId: user?.id, // เพิ่ม userId สำหรับ integration
        userName: user?.name // เพิ่ม userName สำหรับ integration
      };
      
      // Debug: ตรวจสอบข้อมูลก่อนส่ง
      // console.log('📝 [LeaveRequestModal] Hourly leave data:', leaveData);
    }

    // Validate against leave rules
    const validation = validateLeaveRequest(leaveData);
    if (!validation.isValid) {
      // Show validation errors
      const errorMessage = validation.errors.join('\n');
      showAlertDialog('error', 'ไม่สามารถส่งคำขอลาได้', errorMessage);
      return;
    }

    // Debug: ตรวจสอบข้อมูลก่อนส่ง
    console.log('[LeaveRequestModal] Submitting leave:', {
      userId: leaveData.userId,
      userName: leaveData.userName,
      leaveType: leaveData.leaveType,
      startDate: leaveData.startDate,
      endDate: leaveData.endDate,
      currentUser: user
    });
    
    // ตรวจสอบว่า userId และ userName ไม่เป็น undefined
    if (!leaveData.userId || !leaveData.userName) {
      console.error('Missing userId or userName!', { user, leaveData });
      showAlertDialog('error', 'เกิดข้อผิดพลาด', 'ไม่สามารถระบุตัวตนผู้ใช้ได้ กรุณาลองใหม่อีกครั้ง');
      return;
    }

    addLeave(leaveData);
    showAlertDialog('success', 'สำเร็จ!', 'ส่งคำขอลาเรียบร้อยแล้ว');

    // Close modal after showing success
    setTimeout(() => {
      closeModal();
    }, 1500);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 overflow-y-auto bg-black/60 backdrop-blur-sm sm:p-4 font-prompt">
      <style>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        
        @keyframes modalSlideUp {
          from {
            opacity: 0;
            transform: translateY(40px) scale(0.95);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
        
        /* Slide down animation for custom date picker */
        @keyframes slideDown {
          from {
            opacity: 0;
            transform: translateY(-10px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        
        .animate-slideDown {
          animation: slideDown 0.2s ease-out;
        }
      `}</style>
      <div className="w-full max-w-xs mt-4 bg-white shadow-2xl rounded-2xl sm:rounded-3xl sm:max-w-md md:max-w-lg lg:max-w-xl xl:max-w-2xl">
        {/* Header */}
        <div className="bg-gradient-to-r from-brand-primary to-orange-600 p-4 sm:p-5 lg:p-6 rounded-t-2xl sm:rounded-t-3xl sticky top-0 z-10">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-bold text-white sm:text-xl lg:text-2xl drop-shadow-md">ขอลางาน</h2>
            <button
              onClick={closeModal}
              className="text-white hover:bg-white/20 p-1.5 sm:p-2 rounded-full transition-all duration-200"
            >
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} id="leave-request-form" className="p-4 sm:p-5 lg:p-6 leave-form-space space-y-3 sm:space-y-4 lg:space-y-5 max-h-[70vh] overflow-y-auto">
          {/* เลือกประเภทคำขอ */}
          <div>
            <label className="block text-gray-700 font-semibold text-sm sm:text-base mb-1.5 sm:mb-2">
              ประเภทคำขอ <span className="text-red-500">*</span>
            </label>
            <div className="grid grid-cols-2 gap-2 sm:gap-3">
              <button
                type="button"
                onClick={() => setFormData({ 
                  requestType: 'leave', 
                  leaveType: '', 
                  leaveMode: 'fullday',
                  startDate: '',
                  endDate: '',
                  startTime: '', 
                  endTime: '',
                  reason: '',
                  documents: []
                })}
                className={`px-4 py-2.5 sm:py-3 text-sm sm:text-base font-semibold rounded-xl border-2 transition-all duration-200 ${formData.requestType === 'leave'
                    ? 'bg-gradient-to-r from-orange-400 to-orange-600 text-white border-orange-500 shadow-lg'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-orange-400'
                  }`}
              >
                <svg className="w-4 h-4 inline mr-1 fill-current" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 16H9v-2h4v2zm3-4H9v-2h7v2z"/>
                </svg>
                ขอลางาน
              </button>
              <button
                type="button"
                onClick={() => setFormData({ 
                  requestType: 'lateArrival',
                  leaveType: 'ขอเข้างานสาย',
                  leaveMode: 'hourly',
                  startDate: getTodayDate(),
                  endDate: getTodayDate(),
                  startTime: '', 
                  endTime: '',
                  reason: '',
                  documents: []
                })}
                className={`px-2 py-2.5 sm:py-3 text-sm sm:text-base font-semibold rounded-xl border-2 transition-all duration-200 flex items-center justify-center gap-2 ${formData.requestType === 'lateArrival'
                    ? 'bg-gradient-to-r from-orange-400 to-orange-600 text-white border-orange-500 shadow-lg'
                    : 'bg-white text-gray-700 border-gray-300 hover:border-orange-400'
                  }`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>
                ขอเข้างานสาย
              </button>
            </div>
          </div>

          {/* ประเภทการลา */}
          {formData.requestType === 'leave' && (
            <div>
              <label className="block text-gray-700 font-semibold text-sm sm:text-base mb-1.5 sm:mb-2">
                ประเภทการลา <span className="text-red-500">*</span>
              </label>
              <div className="relative" ref={selectRef}>
                <select
                  value={formData.leaveType}
                  onChange={(e) => {
                    const selectedType = e.target.value;
                    // ถ้าเลือกลาคลอดหรือประเภทอื่นที่ไม่ใช่ ลาป่วย/ลากิจ/ลาพักร้อน ให้บังคับเป็น fullday
                    const newLeaveMode = (selectedType === 'ลาป่วย' || selectedType === 'ลากิจ' || selectedType === 'ลาพักร้อน') 
                      ? formData.leaveMode 
                      : 'fullday';
                    
                    setFormData({ 
                      ...formData, 
                      leaveType: selectedType,
                      leaveMode: newLeaveMode,
                      startTime: newLeaveMode === 'fullday' ? '' : formData.startTime,
                      endTime: newLeaveMode === 'fullday' ? '' : formData.endTime
                    });
                    setIsDropdownOpen(false);
                    clearError('leaveType');
                  }}
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  onBlur={() => setTimeout(() => setIsDropdownOpen(false), 150)}
                  className={`w-full px-3 sm:px-4 pr-8 sm:pr-10 py-2 sm:py-2.5 lg:py-3 text-sm sm:text-base border-2 rounded-xl focus:outline-none transition-colors appearance-none bg-white cursor-pointer ${
                    validationErrors.leaveType 
                      ? 'border-red-400 focus:border-red-500' 
                      : 'border-gray-200 focus:border-orange-500'
                  }`}
                >
                  <option value="">เลือกประเภทการลา</option>
                  <option value="ลาป่วย">ลาป่วย</option>
                  <option value="ลากิจ">ลากิจ</option>
                  <option value="ลาพักร้อน">ลาพักร้อน</option>
                  {canRequestMaternityLeave && (
                    <option value="ลาคลอด">ลาคลอด</option>
                  )}
                  <option value="ลาเพื่อทำหมัน">ลาเพื่อทำหมัน</option>
                  <option value="ลาเพื่อรับราชการทหาร">ลาเพื่อรับราชการทหาร</option>
                  <option value="ลาเพื่อฝึกอบรม">ลาเพื่อฝึกอบรม</option>
                  <option value="ลาไม่รับค่าจ้าง">ลาไม่รับค่าจ้าง</option>
                </select>
                <div className={`absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none transition-transform duration-300 ${isDropdownOpen ? 'rotate-180' : ''}`}>
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>
              {validationErrors.leaveType && (
                <div className="flex items-center gap-1.5 mt-1.5 text-red-600 error-message">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-xs sm:text-sm font-medium">{validationErrors.leaveType}</span>
                </div>
              )}  

              {/* แสดงเงื่อนไขการลา */}
              {formData.leaveType && (
                <>
                  <div className="p-3 mt-3 border-2 bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200 rounded-xl sm:p-4">
                    <div className="flex items-start gap-2 mb-2">
                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <div className="flex-1">
                        <h4 className="mb-2 text-sm font-semibold text-amber-800 sm:text-base">เงื่อนไขการ{formData.leaveType}</h4>
                        <ul className="space-y-1.5">
                          {getLeaveRules(formData.leaveType).map((rule, index) => (
                            <li key={index} className="flex items-start gap-2 text-xs sm:text-sm text-amber-900">
                              <span className="text-amber-600 mt-0.5">•</span>
                              <span>{rule}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </div>              
                </>
              )}
            </div>
          )}

          {/* แสดงเงื่อนไขการขอเข้างานสาย */}
          {formData.requestType === 'lateArrival' && (
            <>
              <div className="p-3 border-2 bg-gradient-to-br from-orange-50 to-orange-50 border-orange-200 rounded-xl sm:p-4">
                <div className="flex items-start gap-2 mb-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-brand-primary mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <div className="flex-1">
                    <h4 className="mb-2 text-sm font-semibold text-orange-800 sm:text-base">เงื่อนไขการขอเข้างานสาย</h4>
                    <ul className="space-y-1.5">
                      {getLeaveRules('ขอเข้างานสาย').map((rule, index) => (
                        <li key={index} className="flex items-start gap-2 text-xs sm:text-sm text-orange-900">
                          <span className="text-brand-primary mt-0.5">•</span>
                          <span>{rule}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>                            
            </>
          )}

          {/* Leave Mode Selection - Only show for ลาป่วย, ลากิจ, ลาพักร้อน */}
          {formData.requestType === 'leave' && (formData.leaveType === 'ลาป่วย' || formData.leaveType === 'ลากิจ' || formData.leaveType === 'ลาพักร้อน') && (
            <div>
              <label className="block text-gray-700 font-semibold text-sm sm:text-base mb-1.5 sm:mb-2">
                รูปแบบการลา <span className="text-red-500">*</span>
              </label>
              <div className="grid grid-cols-2 gap-2 sm:gap-3">
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, leaveMode: 'fullday', startTime: '', endTime: '' })}
                  className={`px-4 py-2.5 sm:py-3 text-sm sm:text-base font-semibold rounded-xl border-2 transition-all duration-200 flex items-center justify-center gap-2 ${formData.leaveMode === 'fullday'
                      ? 'bg-gradient-to-r from-orange-400 to-orange-600 text-white border-orange-500 shadow-lg'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-orange-400'
                    }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M19 3h-1V1h-2v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H5V8h14v11z"/></svg>
                  ลาเต็มวัน
                </button>
                <button
                  type="button"
                  onClick={() => setFormData({ ...formData, leaveMode: 'hourly', endDate: formData.startDate })}
                  className={`px-4 py-2.5 sm:py-3 text-sm sm:text-base font-semibold rounded-xl border-2 transition-all duration-200 flex items-center justify-center gap-2 ${formData.leaveMode === 'hourly'
                      ? 'bg-gradient-to-r from-orange-400 to-orange-600 text-white border-orange-500 shadow-lg'
                      : 'bg-white text-gray-700 border-gray-300 hover:border-orange-400'
                    }`}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C6.5 2 2 6.5 2 12s4.5 10 10 10 10-4.5 10-10S17.5 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z"/></svg>
                  ลาเป็นชั่วโมง
                </button>
              </div>
            </div>
          )}

          {/* Time Selection */}
          {/* สำหรับขอเข้างานสาย */}
          {formData.requestType === 'lateArrival' ? (
            <div className="space-y-3 sm:space-y-4">
              <div>
                <label className="block text-gray-700 font-semibold text-sm sm:text-base mb-1.5 sm:mb-2">
                  วันที่ขอเข้างานสาย <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formatDateForDisplay(getTodayDate())}
                    readOnly
                    className="w-full px-3 sm:px-4 py-2 sm:py-2.5 lg:py-3 text-sm sm:text-base border-2 border-gray-200 rounded-xl bg-gray-50 text-gray-700 cursor-not-allowed"

                  />
                  <div className="absolute text-gray-400 -translate-y-1/2 right-3 top-1/2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                </div>
                <p className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  การขอเข้างานสายจะถูกล็อคเป็นวันปัจจุบัน
                </p>
              </div>

              {/* Start Time */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-gray-700 font-semibold text-sm sm:text-base mb-1.5 sm:mb-2">
                    เวลาที่ต้องมาถึง <span className="text-red-500">*</span>
                  </label>
                  <div className="relative w-full" ref={timeStartPickerRef}>
                    <input
                      type="text"
                      value={formData.startTime}
                      onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                      onFocus={() => setShowTimeStartPicker(true)}
                      onBlur={(e) => {
                        const normalized = normalizeTime(e.target.value);
                        if (normalized !== e.target.value) {
                          setFormData({ ...formData, startTime: normalized });
                        }
                        setTimeout(() => setShowTimeStartPicker(false), 200);
                      }}
                      placeholder="เช่น 09:00"
                      className="w-full px-3 sm:px-4 py-2 sm:py-2.5 lg:py-3 text-sm sm:text-base border-2 border-gray-200 rounded-xl hover:border-orange-400 focus:border-orange-500 focus:outline-none transition-colors"

                    />
                    
                    <button
                      type="button"
                      onClick={() => {
                        openTimePicker(true);
                        setShowTimeEndPicker(false);
                      }}
                      className="absolute text-gray-500 transition-colors -translate-y-1/2 right-2 sm:right-3 top-1/2 hover:text-brand-primary"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <circle cx="12" cy="12" r="9" strokeWidth="1.5" />
                        <path d="M12 7v6l4 2" strokeWidth="1.5" />
                      </svg>
                    </button>

                    {/* Custom Time Picker Dropdown */}
                    {showTimeStartPicker && (
                      <div className="absolute z-50 w-full mt-1 overflow-hidden bg-white border-2 rounded-lg shadow-2xl border-orange-400">
                        <div className="flex">
                          {/* Hours Column */}
                          <div className="flex-1 border-r border-gray-200">
                            <div className="py-2 text-xs font-semibold text-center text-white bg-brand-primary sm:text-sm">
                              ชั่วโมง
                            </div>
                            <div className="overflow-y-auto max-h-48">
                              {hours24.map((hour) => (
                                <button
                                  key={hour}
                                  type="button"
                                  onClick={() => handleTimeSelect(hour, tempStartTime.minute, true)}
                                  className={`w-full px-2 sm:px-3 py-2 text-xs sm:text-sm text-center hover:bg-orange-50 transition-colors ${
                                    tempStartTime.hour === hour ? 'bg-orange-100 font-semibold text-brand-primary' : ''
                                  }`}
                                >
                                  {hour}
                                </button>
                              ))}
                            </div>
                          </div>
                          
                          {/* Minutes Column */}
                          <div className="flex-1">
                            <div className="py-2 text-xs font-semibold text-center text-white bg-brand-primary sm:text-sm">
                              นาที
                            </div>
                            <div className="overflow-y-auto max-h-48">
                              {minutes.map((minute) => (
                                <button
                                  key={minute}
                                  type="button"
                                  onClick={() => handleTimeSelect(tempStartTime.hour, minute, true)}
                                  className={`w-full px-2 sm:px-3 py-2 text-xs sm:text-sm text-center hover:bg-orange-50 transition-colors ${
                                    tempStartTime.minute === minute ? 'bg-orange-100 font-semibold text-brand-primary' : ''
                                  }`}
                                >
                                  {minute}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                        {/* Confirm Button */}
                        <div className="p-2 border-t border-gray-200 bg-gray-50">
                          <button
                            type="button"
                            onClick={() => confirmTimeSelection(true)}
                            className="w-full py-2 text-sm font-semibold text-white transition-colors rounded-lg bg-brand-primary hover:bg-orange-600"
                          >
                            ตกลง
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold text-sm sm:text-base mb-1.5 sm:mb-2">
                    เวลาที่คาดว่าจะมาถึง <span className="text-red-500">*</span>
                  </label>
                  <div className="relative w-full" ref={timeEndPickerRef}>
                    <input
                      type="text"
                      value={formData.endTime}
                      onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                      onFocus={() => setShowTimeEndPicker(true)}
                      onBlur={(e) => {
                        const normalized = normalizeTime(e.target.value);
                        if (normalized !== e.target.value) {
                          setFormData({ ...formData, endTime: normalized });
                        }
                        setTimeout(() => setShowTimeEndPicker(false), 200);
                      }}
                      placeholder="เช่น 10:00"
                      className="w-full px-3 sm:px-4 py-2 sm:py-2.5 lg:py-3 text-sm sm:text-base border-2 border-gray-200 rounded-xl hover:border-orange-400 focus:border-orange-500 focus:outline-none transition-colors"

                    />
                    
                    <button
                      type="button"
                      onClick={() => {
                        openTimePicker(false);
                        setShowTimeStartPicker(false);
                      }}
                      className="absolute text-gray-500 transition-colors -translate-y-1/2 right-2 sm:right-3 top-1/2 hover:text-brand-primary"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <circle cx="12" cy="12" r="9" strokeWidth="1.5" />
                        <path d="M12 7v6l4 2" strokeWidth="1.5" />
                      </svg>
                    </button>

                    {/* Custom Time Picker Dropdown */}
                    {showTimeEndPicker && (
                      <div className="absolute z-50 w-full mt-1 overflow-hidden bg-white border-2 rounded-lg shadow-2xl border-orange-400">
                        <div className="flex">
                          {/* Hours Column */}
                          <div className="flex-1 border-r border-gray-200">
                            <div className="py-2 text-xs font-semibold text-center text-white bg-brand-primary sm:text-sm">
                              ชั่วโมง
                            </div>
                            <div className="overflow-y-auto max-h-48">
                              {hours24.map((hour) => (
                                <button
                                  key={hour}
                                  type="button"
                                  onClick={() => handleTimeSelect(hour, tempEndTime.minute, false)}
                                  className={`w-full px-2 sm:px-3 py-2 text-xs sm:text-sm text-center hover:bg-orange-50 transition-colors ${
                                    tempEndTime.hour === hour ? 'bg-orange-100 font-semibold text-brand-primary' : ''
                                  }`}
                                >
                                  {hour}
                                </button>
                              ))}
                            </div>
                          </div>
                          
                          {/* Minutes Column */}
                          <div className="flex-1">
                            <div className="py-2 text-xs font-semibold text-center text-white bg-brand-primary sm:text-sm">
                              นาที
                            </div>
                            <div className="overflow-y-auto max-h-48">
                              {minutes.map((minute) => (
                                <button
                                  key={minute}
                                  type="button"
                                  onClick={() => handleTimeSelect(tempEndTime.hour, minute, false)}
                                  className={`w-full px-2 sm:px-3 py-2 text-xs sm:text-sm text-center hover:bg-orange-50 transition-colors ${
                                    tempEndTime.minute === minute ? 'bg-orange-100 font-semibold text-brand-primary' : ''
                                  }`}
                                >
                                  {minute}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                        {/* Confirm Button */}
                        <div className="p-2 border-t border-gray-200 bg-gray-50">
                          <button
                            type="button"
                            onClick={() => confirmTimeSelection(false)}
                            className="w-full py-2 text-sm font-semibold text-white transition-colors rounded-lg bg-brand-primary hover:bg-orange-600"
                          >
                            ตกลง
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Regular Leave - Date Range - Full Day Mode */
            formData.leaveMode === 'fullday' ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 sm:gap-4">
              {/* Start Date */}
              <CustomDatePicker
                value={formData.startDate}
                onChange={(newDate) => {
                  setFormData({ 
                    ...formData, 
                    startDate: newDate,
                    endDate: formData.endDate && new Date(formData.endDate) < new Date(newDate) ? newDate : formData.endDate
                  });
                  setDisplayDates({ 
                    ...displayDates, 
                    startDate: formatDateForDisplay(newDate),
                    endDate: formData.endDate && new Date(formData.endDate) < new Date(newDate) ? formatDateForDisplay(newDate) : displayDates.endDate
                  });
                }}
                minDate={getMinDate()}
                label="วันที่เริ่มต้น"
                required={true}
                error={validationErrors.startDate}
                clearError={() => clearError('startDate')}
              />

              {/* End Date */}
              <CustomDatePicker
                value={formData.endDate}
                onChange={(newDate) => {
                  setFormData({ ...formData, endDate: newDate });
                  setDisplayDates({ ...displayDates, endDate: formatDateForDisplay(newDate) });
                }}
                minDate={formData.startDate || getMinDate()}
                label="วันที่สิ้นสุด"
                required={true}
                error={validationErrors.endDate}
                clearError={() => clearError('endDate')}
              />
            </div>
            ) : (
              /* Hourly Mode - Date and Time */
              <div className="space-y-3 sm:space-y-4">
              {/* Date - Display Today in dd/mm/yyyy */}
              <div>
                <label className="block text-gray-700 font-semibold text-sm sm:text-base mb-1.5 sm:mb-2">
                  วันที่ลา <span className="text-red-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={formatDateForDisplay(getTodayDate())}
                    readOnly
                    className="w-full px-3 sm:px-4 py-2 sm:py-2.5 lg:py-3 text-sm sm:text-base border-2 border-gray-200 rounded-xl bg-gray-50 text-gray-700 cursor-not-allowed"

                  />
                  <div className="absolute text-gray-400 -translate-y-1/2 right-3 top-1/2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                </div>
                <p className="flex items-center gap-1 mt-1 text-xs text-gray-500">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  การลารายชั่วโมงจะถูกล็อคเป็นวันปัจจุบัน
                </p>
              </div>

              {/* Time Range - 24 Hour Format */}
              <div className="grid grid-cols-2 gap-3 sm:gap-4">
                <div>
                  <label className="block text-gray-700 font-semibold text-sm sm:text-base mb-1.5 sm:mb-2">
                    เวลาเริ่มต้น <span className="text-red-500">*</span>
                  </label>
                  <div className="relative w-full" ref={timeStartPickerRef}>
                    <input
                      type="text"
                      value={formData.startTime}
                      onChange={(e) => {
                        const todayDate = getTodayDate();
                        setFormData({
                          ...formData,
                          startTime: e.target.value,
                          startDate: todayDate,
                          endDate: todayDate
                        });
                      }}
                      onFocus={() => setShowTimeStartPicker(true)}
                      onBlur={(e) => {
                        const normalized = normalizeTime(e.target.value);
                        if (normalized !== e.target.value) {
                          const todayDate = getTodayDate();
                          setFormData({
                            ...formData,
                            startTime: normalized,
                            startDate: todayDate,
                            endDate: todayDate
                          });
                        }
                        setTimeout(() => setShowTimeStartPicker(false), 200);
                      }}
                      placeholder="เช่น 09:00"
                      className="w-full px-3 sm:px-4 py-2 sm:py-2.5 lg:py-3 text-sm sm:text-base border-2 border-gray-200 rounded-xl hover:border-orange-400 focus:border-orange-500 focus:outline-none transition-colors"

                    />
                    
                    <button
                      type="button"
                      onClick={() => {
                        openTimePicker(true);
                        setShowTimeEndPicker(false);
                      }}
                      className="absolute text-gray-500 transition-colors -translate-y-1/2 right-2 sm:right-3 top-1/2 hover:text-brand-primary"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <circle cx="12" cy="12" r="9" strokeWidth="1.5" />
                        <path d="M12 7v6l4 2" strokeWidth="1.5" />
                      </svg>
                    </button>

                    {/* Custom Time Picker Dropdown */}
                    {showTimeStartPicker && (
                      <div className="absolute z-50 w-full mt-1 overflow-hidden bg-white border-2 rounded-lg shadow-2xl border-orange-400">
                        <div className="flex">
                          {/* Hours Column */}
                          <div className="flex-1 border-r border-gray-200">
                            <div className="py-2 text-xs font-semibold text-center text-white bg-brand-primary sm:text-sm">
                              ชั่วโมง
                            </div>
                            <div className="overflow-y-auto max-h-48">
                              {hours24.map((hour) => (
                                <button
                                  key={hour}
                                  type="button"
                                  onClick={() => handleTimeSelect(hour, tempStartTime.minute, true)}
                                  className={`w-full px-2 sm:px-3 py-2 text-xs sm:text-sm text-center hover:bg-orange-50 transition-colors ${
                                    tempStartTime.hour === hour ? 'bg-orange-100 font-semibold text-brand-primary' : ''
                                  }`}
                                >
                                  {hour}
                                </button>
                              ))}
                            </div>
                          </div>
                          
                          {/* Minutes Column */}
                          <div className="flex-1">
                            <div className="py-2 text-xs font-semibold text-center text-white bg-brand-primary sm:text-sm">
                              นาที
                            </div>
                            <div className="overflow-y-auto max-h-48">
                              {minutes.map((minute) => (
                                <button
                                  key={minute}
                                  type="button"
                                  onClick={() => handleTimeSelect(tempStartTime.hour, minute, true)}
                                  className={`w-full px-2 sm:px-3 py-2 text-xs sm:text-sm text-center hover:bg-orange-50 transition-colors ${
                                    tempStartTime.minute === minute ? 'bg-orange-100 font-semibold text-brand-primary' : ''
                                  }`}
                                >
                                  {minute}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                        {/* Confirm Button */}
                        <div className="p-2 border-t border-gray-200 bg-gray-50">
                          <button
                            type="button"
                            onClick={() => confirmTimeSelection(true)}
                            className="w-full py-2 text-sm font-semibold text-white transition-colors rounded-lg bg-brand-primary hover:bg-orange-600"
                          >
                            ตกลง
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>

                <div>
                  <label className="block text-gray-700 font-semibold text-sm sm:text-base mb-1.5 sm:mb-2">
                    เวลาสิ้นสุด <span className="text-red-500">*</span>
                  </label>
                  <div className="relative w-full" ref={timeEndPickerRef}>
                    <input
                      type="text"
                      value={formData.endTime}
                      onChange={(e) => {
                        const todayDate = getTodayDate();
                        setFormData({
                          ...formData,
                          endTime: e.target.value,
                          startDate: todayDate,
                          endDate: todayDate
                        });
                      }}
                      onFocus={() => setShowTimeEndPicker(true)}
                      onBlur={(e) => {
                        const normalized = normalizeTime(e.target.value);
                        if (normalized !== e.target.value) {
                          const todayDate = getTodayDate();
                          setFormData({
                            ...formData,
                            endTime: normalized,
                            startDate: todayDate,
                            endDate: todayDate
                          });
                        }
                        setTimeout(() => setShowTimeEndPicker(false), 200);
                      }}
                      placeholder="เช่น 17:00"
                      className="w-full px-3 sm:px-4 py-2 sm:py-2.5 lg:py-3 text-sm sm:text-base border-2 border-gray-200 rounded-xl hover:border-orange-400 focus:border-orange-500 focus:outline-none transition-colors"

                    />
                    
                    <button
                      type="button"
                      onClick={() => {
                        openTimePicker(false);
                        setShowTimeStartPicker(false);
                      }}
                      className="absolute text-gray-500 transition-colors -translate-y-1/2 right-2 sm:right-3 top-1/2 hover:text-brand-primary"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                        <circle cx="12" cy="12" r="9" strokeWidth="1.5" />
                        <path d="M12 7v6l4 2" strokeWidth="1.5" />
                      </svg>
                    </button>

                    {/* Custom Time Picker Dropdown */}
                    {showTimeEndPicker && (
                      <div className="absolute z-50 w-full mt-1 overflow-hidden bg-white border-2 rounded-lg shadow-2xl border-orange-400">
                        <div className="flex">
                          {/* Hours Column */}
                          <div className="flex-1 border-r border-gray-200">
                            <div className="py-2 text-xs font-semibold text-center text-white bg-brand-primary sm:text-sm">
                              ชั่วโมง
                            </div>
                            <div className="overflow-y-auto max-h-48">
                              {hours24.map((hour) => (
                                <button
                                  key={hour}
                                  type="button"
                                  onClick={() => handleTimeSelect(hour, tempEndTime.minute, false)}
                                  className={`w-full px-2 sm:px-3 py-2 text-xs sm:text-sm text-center hover:bg-orange-50 transition-colors ${
                                    tempEndTime.hour === hour ? 'bg-orange-100 font-semibold text-brand-primary' : ''
                                  }`}
                                >
                                  {hour}
                                </button>
                              ))}
                            </div>
                          </div>
                          
                          {/* Minutes Column */}
                          <div className="flex-1">
                            <div className="py-2 text-xs font-semibold text-center text-white bg-brand-primary sm:text-sm">
                              นาที
                            </div>
                            <div className="overflow-y-auto max-h-48">
                              {minutes.map((minute) => (
                                <button
                                  key={minute}
                                  type="button"
                                  onClick={() => handleTimeSelect(tempEndTime.hour, minute, false)}
                                  className={`w-full px-2 sm:px-3 py-2 text-xs sm:text-sm text-center hover:bg-orange-50 transition-colors ${
                                    tempEndTime.minute === minute ? 'bg-orange-100 font-semibold text-brand-primary' : ''
                                  }`}
                                >
                                  {minute}
                                </button>
                              ))}
                            </div>
                          </div>
                        </div>
                        {/* Confirm Button */}
                        <div className="p-2 border-t border-gray-200 bg-gray-50">
                          <button
                            type="button"
                            onClick={() => confirmTimeSelection(false)}
                            className="w-full py-2 text-sm font-semibold text-white transition-colors rounded-lg bg-brand-primary hover:bg-orange-600"
                          >
                            ตกลง
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              </div>
            )
          )}

          {/* Total Days/Hours Display */}
          {formData.requestType === 'leave' && formData.leaveMode === 'fullday' && formData.startDate && formData.endDate && (
            <div className="p-3 border-2 bg-gradient-to-r from-orange-50 to-orange-50 border-orange-200 rounded-xl sm:p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700 sm:text-base">จำนวนวันที่ลา:</span>
                <span className="text-lg font-bold text-brand-primary sm:text-xl">{getTotalDays()} วัน</span>
              </div>
            </div>
          )}

          {formData.requestType === 'lateArrival' && formData.startTime && formData.endTime && (
            <div className="p-3 border-2 bg-gradient-to-r from-orange-50 to-orange-50 border-orange-200 rounded-xl sm:p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700 sm:text-base">ระยะเวลาที่สาย:</span>
                <span className="text-lg font-bold text-brand-primary sm:text-xl">{getTotalHours()}</span>
              </div>
            </div>
          )}

          {formData.requestType === 'leave' && formData.leaveMode === 'hourly' && formData.startTime && formData.endTime && (
            <div className="p-3 border-2 bg-gradient-to-r from-orange-50 to-orange-50 border-orange-200 rounded-xl sm:p-4">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-700 sm:text-base">จำนวนชั่วโมงที่ลา:</span>
                <span className="text-lg font-bold text-brand-primary sm:text-xl">{getTotalHours()}</span>
              </div>
            </div>
          )}

          {/* Reason */}
          <div>
            <label className="block text-gray-700 font-semibold text-sm sm:text-base mb-1.5 sm:mb-2">
              {formData.requestType === 'lateArrival' ? 'เหตุผลที่เข้างานสาย' : 'เหตุผลในการลา'} <span className="text-red-500">*</span>
            </label>
            <textarea
              value={formData.reason}
              onChange={(e) => {
                setFormData({ ...formData, reason: e.target.value });
                clearError('reason');
              }}
              rows={formData.requestType === 'lateArrival' ? 4 : 3}
              placeholder={formData.requestType === 'lateArrival' 
                ? "กรุณาระบุเหตุผล เช่น รถเสีย อุบัติเหตุ เจอเหตุฉุกเฉินในระหว่างทาง ฯลฯ" 
                : "กรุณาระบุเหตุผลในการลา..."}
              className={`w-full px-3 sm:px-4 py-2 sm:py-2.5 lg:py-3 text-sm sm:text-base border-2 rounded-xl focus:outline-none transition-colors resize-none ${
                validationErrors.reason 
                  ? 'border-red-400 focus:border-red-500' 
                  : 'border-gray-200 focus:border-orange-500'
              }`}
            />
            {validationErrors.reason && (
              <div className="flex items-center gap-1.5 mt-1.5 text-red-600 error-message">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-xs sm:text-sm font-medium">{validationErrors.reason}</span>
              </div>
            )}
            
            {/* ข้อความเตือน */}
            {formData.requestType === 'lateArrival' && (
              <div className="flex items-start gap-2 mt-2 p-2.5 bg-red-50 border border-red-200 rounded-lg">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="flex-1">
                  <p className="text-xs sm:text-sm font-semibold text-red-700 mb-1">หลักฐานที่ต้องแนบ:</p>
                  <p className="text-xs sm:text-sm text-red-600">
                    ควรแนบรูปภาพหลักฐาน (เช่น รูปถ่ายเหตุการณ์, ใบรับรองจากหน่วยงานที่เกี่ยวข้อง) เพื่อช่วยในการพิจารณาอนุมัติ
                  </p>
                </div>
              </div>
            )}
            
            {formData.requestType === 'leave' && formData.leaveType === 'ลาป่วย' && formData.leaveMode === 'fullday' && getTotalDays() >= 3 && (
              <div className="flex items-start gap-2 mt-2 p-2.5 bg-red-50 border border-red-200 rounded-lg">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-red-600 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                </svg>
                <div className="flex-1">
                  <p className="text-xs sm:text-sm font-semibold text-red-700 mb-1">เอกสารที่ต้องแนบ:</p>
                  <p className="text-xs sm:text-sm text-red-600">
                    การลาป่วยตั้งแต่ 3 วันขึ้นไป <span className="font-semibold">จำเป็นต้องแนบใบรับรองแพทย์</span> จึงจะสามารถส่งคำขอลาได้
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Document Upload */}
          <div>
            <label className="block text-gray-700 font-semibold text-sm sm:text-base mb-1.5 sm:mb-2">
              เอกสารแนบ
              {formData.requestType === 'leave' && formData.leaveType === 'ลาป่วย' && formData.leaveMode === 'fullday' && getTotalDays() >= 3 && (
                <span className="text-red-500"> *</span>
              )}
            </label>

            <input
              type="file"
              multiple
              accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf"
              onChange={(e) => {
                handleFileChange(e);
                if (e.target.files.length > 0) {
                  clearError('documents');
                }
              }}
              className={`w-full px-3 sm:px-4 py-2 sm:py-2.5 lg:py-3 text-xs sm:text-sm border-2 rounded-xl focus:outline-none transition-colors file:mr-2 sm:file:mr-4 file:py-1.5 sm:file:py-2 file:px-3 sm:file:px-4 file:rounded-full file:border-0 file:text-xs sm:file:text-sm file:bg-orange-50 file:text-orange-700 hover:file:bg-orange-100 file:cursor-pointer file:font-medium ${
                validationErrors.documents 
                  ? 'border-red-400 focus:border-red-500' 
                  : 'border-gray-200 focus:border-orange-500'
              }`}
            />
            {validationErrors.documents && (
              <div className="flex items-center gap-1.5 mt-1.5 text-red-600 error-message">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span className="text-xs sm:text-sm font-medium">{validationErrors.documents}</span>
              </div>
            )}
            <p className="flex items-center gap-1 mt-1 text-xs text-gray-500">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              รองรับเฉพาะไฟล์ .jpg, .jpeg, .png, .pdf เท่านั้น
            </p>
            {formData.documents.length > 0 && (
              <div className="mt-2 space-y-2">
                {formData.documents.map((doc, index) => {
                  // เช็คว่าเป็นรูปภาพหรือ PDF
                  const isImage = doc.startsWith('data:image');
                  
                  return (
                    <div key={index} className="flex items-center gap-2 bg-gray-50 p-2 rounded-lg">
                      {isImage ? (
                        <>
                          <img 
                            src={doc} 
                            alt={`เอกสาร ${index + 1}`}
                            className="w-16 h-16 object-cover rounded border border-gray-200"
                          />
                          <div className="flex-1">
                            <p className="text-xs text-gray-600 sm:text-sm font-medium">รูปภาพ {index + 1}</p>
                            <p className="text-xs text-gray-500">ไฟล์รูปภาพ</p>
                          </div>
                        </>
                      ) : (
                        <>
                          <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                          </svg>
                          <div className="flex-1">
                            <p className="text-xs text-gray-600 sm:text-sm font-medium">PDF {index + 1}</p>
                            <p className="text-xs text-gray-500">ไฟล์ PDF</p>
                          </div>
                        </>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          const newDocs = formData.documents.filter((_, i) => i !== index);
                          setFormData({ ...formData, documents: newDocs });
                        }}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Buttons */}
          <div className="flex flex-col gap-2 pt-2 sm:flex-row sm:gap-3 sm:pt-4">
            <button
              type="button"
              onClick={closeModal}
              className="w-full px-4 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base border-2 border-gray-300 text-gray-700 font-semibold rounded-xl hover:bg-gray-50 transition-all duration-200"
            >
              ยกเลิก
            </button>
            <button
              type="submit"
              className="w-full px-4 sm:px-6 py-2.5 sm:py-3 text-sm sm:text-base bg-gradient-to-r from-brand-primary to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white font-semibold rounded-xl shadow-lg transition-all duration-200 transform hover:scale-[1.02]"
            >
              ส่งคำขอ
            </button>
          </div>
        </form>
      </div>

      {/* Alert Dialog for success/error messages */}
      <AlertDialog
        isOpen={_showAlert}
        type={_alertConfig.type}
        title={_alertConfig.title}
        message={_alertConfig.message}
        onClose={() => setShowAlert(false)}
      />
    </div>
  );
}

export default LeaveRequestModal;