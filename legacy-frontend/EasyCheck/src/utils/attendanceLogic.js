/**
 * 🧮 attendanceLogic.js - ระบบคำนวณสถานะการเข้างานที่ครบถ้วน
 * 
 * ฟังก์ชันหลักสำหรับจัดการ logic การเข้างาน-ออกงานตามมาตรฐานองค์กร
 */

import ATTENDANCE_CONFIG from '../config/attendanceConfig';

/**
 * แปลงเวลาเป็นนาทีนับจากเที่ยงคืน
 * @param {string} time - เวลาในรูปแบบ "HH:MM"
 * @returns {number} - จำนวนนาทีนับจากเที่ยงคืน
 */
export const timeToMinutes = (time) => {
  if (!time) return 0;
  const [hours, minutes] = time.split(':').map(Number);
  return hours * 60 + minutes;
};

/**
 * แปลงนาทีเป็นเวลา
 * @param {number} minutes - จำนวนนาที
 * @returns {string} - เวลาในรูปแบบ "HH:MM"
 */
export const minutesToTime = (minutes) => {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${String(hours).padStart(2, '0')}:${String(mins).padStart(2, '0')}`;
};

/**
 * คำนวณความแตกต่างของเวลา (นาที)
 * @param {string} checkInTime - เวลา check-in
 * @param {string} shiftStart - เวลาเริ่มกะ
 * @returns {number} - จำนวนนาทีที่ต่างกัน (บวก = สาย, ลบ = มาก่อน)
 */
export const calculateTimeDifference = (checkInTime, shiftStart) => {
  let checkInMinutes = timeToMinutes(checkInTime);
  let shiftStartMinutes = timeToMinutes(shiftStart);
  
  let difference = checkInMinutes - shiftStartMinutes;
  
  // 🌙 จัดการกะข้ามเที่ยงคืน
  // ถ้า difference > 12 ชม. (720 นาที) = check-in ก่อนเที่ยงคืน, กะเริ่มหลังเที่ยงคืน
  // เช่น check-in 23:53 (1433) กะ 00:00 (0) → diff = 1433 → แก้เป็น -7
  if (difference > 720) {
    difference = checkInMinutes - (shiftStartMinutes + 1440);
  }
  // ถ้า difference < -12 ชม. = check-in หลังเที่ยงคืน, กะเริ่มก่อนเที่ยงคืน  
  // เช่น check-in 00:05 (5) กะ 23:00 (1380) → diff = -1375 → แก้เป็น 65
  else if (difference < -720) {
    difference = (checkInMinutes + 1440) - shiftStartMinutes;
  }
  
  return difference;
};

/**
 * 📝 ตรวจสอบคำขอเข้างานสายที่ได้รับอนุมัติ
 * 
 * @param {string} userId - รหัสพนักงาน
 * @param {string} date - วันที่ (dd/mm/yyyy)
 * @returns {object|null} - ข้อมูลคำขอเข้างานสาย หรืหรือ null
 */
export const getApprovedLateArrivalRequest = (userId, date) => {
  try {
    const leaveList = localStorage.getItem('leaveList');
    if (!leaveList) return null;

    const leaves = JSON.parse(leaveList);
    
    // หาคำขอเข้างานสายที่อนุมัติแล้วในวันนี้
    const approvedRequest = leaves.find(leave => {
      const isLateArrival = leave.leaveType === 'ขอเข้างานสาย';
      const isApproved = leave.status === 'อนุมัติ';
      const isMyRequest = !leave.userId || leave.userId === userId;
      const isToday = leave.startDate === date;
      
      return isLateArrival && isApproved && isMyRequest && isToday;
    });
    
    return approvedRequest || null;
  } catch (error) {
    console.error('Error checking approved late arrival:', error);
    return null;
  }
};

/**
 * ⚠️ ตรวจสอบว่า check-in ภายในเวลาที่แจ้งขอเข้างานสายหรือไม่
 * 
 * กฎ:
 * - ถ้าแจ้งว่าจะมาเวลา 10:00 ต้อง check-in ก่อน 10:30 (ภายใน 30 นาที)
 * - ถ้า check-in หลัง 10:30 = ถือว่าขาดงานทันที
 * 
 * @param {string} checkInTime - เวลา check-in จริง (HH:MM)
 * @param {object} lateArrivalRequest - ข้อมูลคำขอเข้างานสาย
 * @returns {object} - { valid: boolean, reason: string, status: string }
 */
export const validateLateArrivalCheckIn = (checkInTime, lateArrivalRequest) => {
  if (!lateArrivalRequest) {
    return { valid: true, reason: null, status: null };
  }
  
  // เวลาที่แจ้งว่าจะมา = endTime ของคำขอ
  const declaredArrivalTime = lateArrivalRequest.endTime;
  if (!declaredArrivalTime) {
    return { valid: true, reason: null, status: null };
  }
  
  const checkInMinutes = timeToMinutes(checkInTime);
  const declaredMinutes = timeToMinutes(declaredArrivalTime);
  
  // คำนวณเวลาสูงสุดที่อนุญาต = เวลาที่แจ้ง + 30 นาที
  const maxAllowedMinutes = declaredMinutes + ATTENDANCE_CONFIG.LATE_THRESHOLD_MINUTES;
  
  // ถ้า check-in หลังเวลาสูงสุด = ขาดงานทันที
  if (checkInMinutes > maxAllowedMinutes) {
    const lateMinutes = checkInMinutes - declaredMinutes;
    return {
      valid: false,
      reason: `คุณแจ้งว่าจะมาเวลา ${declaredArrivalTime} แต่ check-in เวลา ${checkInTime} (สายเกิน ${lateMinutes} นาที) ถือว่าขาดงาน`,
      status: ATTENDANCE_CONFIG.STATUS.ABSENT,
      shouldAutoCheckout: true
    };
  }
  
  // check-in ภายในเวลา
  const earlyMinutes = declaredMinutes - checkInMinutes;
  return {
    valid: true,
    reason: earlyMinutes > 0 
      ? `มาก่อนเวลาที่แจ้ง ${earlyMinutes} นาที` 
      : `มาตรงตามเวลาที่แจ้ง`,
    status: ATTENDANCE_CONFIG.STATUS.LATE
  };
};

/**
 * 🎯 ฟังก์ชันหลัก: คำนวณสถานะการเข้างาน (พร้อมตรวจสอบคำขอเข้างานสาย)
 * 
 * @param {string} checkInTime - เวลา check-in (HH:MM)
 * @param {string} shiftStart - เวลาเริ่มกะ (HH:MM)
 * @param {boolean} hasApprovedLeave - มีการลาที่อนุมัติหรือไล่
 * @param {object|null} lateArrivalRequest - คำขอเข้างานสายที่อนุมัติ
 * @returns {object} - { status, lateMinutes, shouldAutoCheckout, message }
 */
export const calculateAttendanceStatus = (checkInTime, shiftStart, hasApprovedLeave = false, lateArrivalRequest = null) => {
  // กรณีลา
  if (hasApprovedLeave) {
    return {
      status: ATTENDANCE_CONFIG.STATUS.LEAVE,
      lateMinutes: 0,
      shouldAutoCheckout: false,
      message: 'ลางาน'
    };
  }
  
  // 🔥 กรณีมีคำขอเข้างานสายที่อนุมัติแล้ว
  if (lateArrivalRequest && checkInTime) {
    const validation = validateLateArrivalCheckIn(checkInTime, lateArrivalRequest);
    
    if (!validation.valid) {
      // check-in หลังเวลาที่แจ้ง = ขาดงานทันที
      return {
        status: validation.status,
        lateMinutes: null,
        shouldAutoCheckout: validation.shouldAutoCheckout,
        message: validation.reason
      };
    }
    
    // check-in ภายในเวลา = มาสายตามที่แจ้ง
    return {
      status: validation.status,
      lateMinutes: timeToMinutes(checkInTime) - timeToMinutes(shiftStart),
      shouldAutoCheckout: false,
      message: `มาสาย (มีคำขออนุมัติ) - ${validation.reason}`
    };
  }

  // กรณีไม่มา check-in
  if (!checkInTime) {
    return {
      status: ATTENDANCE_CONFIG.STATUS.ABSENT,
      lateMinutes: null,
      shouldAutoCheckout: false,
      message: 'ขาดงาน (ไม่ check-in)'
    };
  }

  const timeDifference = calculateTimeDifference(checkInTime, shiftStart);
  const { GRACE_PERIOD_MINUTES, LATE_THRESHOLD_MINUTES } = ATTENDANCE_CONFIG;

  // Scenario 1: มาก่อนเวลา (ใน grace period) หรือตรงเวลาพอดี
  if (timeDifference <= 0 && Math.abs(timeDifference) <= GRACE_PERIOD_MINUTES) {
    return {
      status: ATTENDANCE_CONFIG.STATUS.ON_TIME,
      lateMinutes: 0,
      shouldAutoCheckout: false,
      message: 'ตรงเวลา'
    };
  }
  
  // Scenario 1.5: ตรงเวลาพอดี (0 นาที)
  if (timeDifference === 0) {
    return {
      status: ATTENDANCE_CONFIG.STATUS.ON_TIME,
      lateMinutes: 0,
      shouldAutoCheckout: false,
      message: 'ตรงเวลา'
    };
  }

  // Scenario 2: มาสาย (1-30 นาที)
  if (timeDifference > 0 && timeDifference <= LATE_THRESHOLD_MINUTES) {
    return {
      status: ATTENDANCE_CONFIG.STATUS.LATE,
      lateMinutes: timeDifference,
      shouldAutoCheckout: false,
      message: `มาสาย ${timeDifference} นาที`
    };
  }

  // Scenario 3: ขาด (>30 นาที) + auto checkout
  return {
    status: ATTENDANCE_CONFIG.STATUS.ABSENT,
    lateMinutes: timeDifference,
    shouldAutoCheckout: true, // 🔥 สำคัญ!
    message: `ขาดงาน (สาย ${timeDifference} นาที)`
  };
};

/**
 * 🔄 ตรวจสอบว่ากะติดกันหรือไม่
 * 
 * @param {array} shifts - รายการกะงาน [{start, end}, ...]
 * @returns {boolean} - true ถ้ากะติดกัน
 */
export const areShiftsConsecutive = (shifts) => {
  if (!shifts || shifts.length < 2) return false;

  for (let i = 0; i < shifts.length - 1; i++) {
    const currentShiftEnd = timeToMinutes(shifts[i].end);
    const nextShiftStart = timeToMinutes(shifts[i + 1].start);
    const gap = nextShiftStart - currentShiftEnd;

    // ถ้าห่างกันเกิน 30 นาที = ไม่ติดกัน
    if (gap > ATTENDANCE_CONFIG.CONSECUTIVE_SHIFT_GAP_MINUTES) {
      return false;
    }
  }

  return true;
};

/**
 * 🔍 หากะที่ครอบคลุมโดย check-in ครั้งเดียว
 * 
 * @param {string} checkInTime - เวลา check-in
 * @param {array} shifts - รายการกะงาน [{start, end}, ...]
 * @returns {array} - กะที่ครอบคลุม
 */
export const getCoveredShifts = (checkInTime, shifts) => {
  const checkInMinutes = timeToMinutes(checkInTime);
  const { GRACE_PERIOD_MINUTES } = ATTENDANCE_CONFIG;

  return shifts.filter(shift => {
    const shiftStartMinutes = timeToMinutes(shift.start);
    const graceStartMinutes = shiftStartMinutes - GRACE_PERIOD_MINUTES;
    
    // check-in ครอบคลุมกะนี้ถ้าอยู่ใน grace period
    return checkInMinutes >= graceStartMinutes && checkInMinutes <= shiftStartMinutes + GRACE_PERIOD_MINUTES;
  });
};

/**
 * 🌙 ตรวจสอบว่าควร auto checkout ที่เที่ยงคืนหรือไม่
 * 
 * @param {string} checkInTime - เวลา check-in
 * @param {string} shiftEnd - เวลาสิ้นสุดกะ
 * @param {string} currentTime - เวลาปัจจุบัน (default: now)
 * @returns {boolean}
 */
export const shouldAutoCheckoutAtMidnight = (checkInTime, shiftEnd, currentTime = null) => {
  const now = currentTime || new Date().toTimeString().slice(0, 5);
  const nowMinutes = timeToMinutes(now);
  const midnightMinutes = timeToMinutes(ATTENDANCE_CONFIG.AUTO_CHECKOUT_TIME);

  // ถ้าเลยเที่ยงคืนแล้วและยังไม่ checkout
  return nowMinutes >= midnightMinutes || nowMinutes < timeToMinutes('06:00');
};

/**
 * ☀️ จัดการกะข้ามวัน - ตัด checkout ที่เที่ยง
 * 
 * @param {string} shiftStart - เวลาเริ่มกะ
 * @param {string} shiftEnd - เวลาสิ้นสุดกะ
 * @returns {boolean} - true ถ้าเป็นกะข้ามวัน
 */
export const isCrossMidnightShift = (shiftStart, shiftEnd) => {
  const startMinutes = timeToMinutes(shiftStart);
  const endMinutes = timeToMinutes(shiftEnd);
  
  // ถ้า end < start แปลว่าข้ามวัน (เช่น 22:00-06:00)
  return endMinutes < startMinutes;
};

/**
 * 📋 สร้างข้อมูล attendance record
 * 
 * @param {object} params - {checkInTime, checkOutTime, shift, status, photo, location}
 * @returns {object} - attendance record
 */
export const createAttendanceRecord = (params) => {
  const {
    checkInTime,
    checkOutTime = null,
    shift,
    status,
    photo,
    location,
    gps,
    address,
    distance
  } = params;

  return {
    date: new Date().toLocaleDateString('th-TH', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    }),
    checkIn: {
      time: checkInTime,
      status,
      location: location || 'อยู่ในพื้นที่',
      photo,
      gps,
      address,
      distance,
      checkedByBuddy: false,
      buddyName: null
    },
    checkOut: checkOutTime ? {
      time: checkOutTime,
      status: 'ตรงเวลา',
      location: location || 'อยู่ในพื้นที่',
      photo,
      gps,
      address,
      distance,
      checkedByBuddy: false,
      buddyName: null
    } : null,
    shift
  };
};

/**
 * ⚠️ ป้องกัน double check-in (Legacy - สำหรับกะเดียว)
 * 
 * @param {array} attendanceRecords - บันทึกการเข้างาน
 * @param {string} date - วันที่ต้องการตรวจสอบ
 * @returns {boolean} - true ถ้ามี check-in แล้ว
 */
export const hasCheckedInToday = (attendanceRecords, date) => {
  if (!attendanceRecords || !Array.isArray(attendanceRecords)) return false;
  
  const todayRecord = attendanceRecords.find(record => record.date === date);
  if (!todayRecord) return false;
  // Legacy format: top-level checkIn
  if (todayRecord.checkIn) return true;
  // New format: shifts array
  if (todayRecord.shifts && Array.isArray(todayRecord.shifts)) {
    return todayRecord.shifts.some(shift => shift.checkIn || shift.checkInTime)
  }
  return false;
};

/**
 * 🆕 ตรวจสอบว่า check-in กะนี้แล้วหรือยัง (รองรับหลายกะต่อวัน)
 * 
 * @param {array} attendanceRecords - บันทึกการเข้างาน
 * @param {string} date - วันที่ต้องการตรวจสอบ (เช่น '19/11/2568')
 * @param {number|string} shiftId - ID ของกะที่ต้องการตรวจสอบ
 * @returns {boolean} - true ถ้ากะนี้ check-in แล้ว
 */
export const hasCheckedInForShift = (attendanceRecords, date, shiftId) => {
  if (!attendanceRecords || !Array.isArray(attendanceRecords)) return false;
  if (!shiftId) return false; // ไม่ส่ง shiftId = ไม่สามารถเช็คได้
  
  const todayRecord = attendanceRecords.find(record => record.date === date);
  if (!todayRecord) return false;
  
  // รองรับทั้ง format เก่า (checkIn object) และ format ใหม่ (shifts array)
  if (todayRecord.shifts && Array.isArray(todayRecord.shifts)) {
    // Format ใหม่: เช็คใน shifts array
    return todayRecord.shifts.some(shift => 
      shift.shiftId === shiftId && (shift.checkIn || shift.checkInTime)
    );
  }
  
  // Format เก่า: มี checkIn = ถือว่ากะเดียว check-in แล้ว
  return todayRecord.checkIn ? true : false;
};

/**
 * 🔄 จัดการกะติดกัน - check-in ครั้งเดียวครอบคลุมหลายกะ
 * 
 * Scenario 4: กะติดกัน (เช่น 09:00-10:00, 10:00-11:00)
 * - ถ้าห่างกัน ≤30 นาที → ให้ check-in ครั้งเดียว
 * - คำนวณสถานะแต่ละกะแยกกัน
 * 
 * @param {string} checkInTime - เวลา check-in
 * @param {array} todayShifts - กะวันนี้ [{start, end, type}, ...]
 * @returns {object} - { isConsecutive, coveredShifts, statuses }
 */
export const handleConsecutiveShifts = (checkInTime, todayShifts) => {
  if (!todayShifts || todayShifts.length === 0) {
    return {
      isConsecutive: false,
      coveredShifts: [],
      statuses: []
    };
  }

  // เรียงกะตามเวลา
  const sortedShifts = [...todayShifts].sort((a, b) => 
    timeToMinutes(a.start) - timeToMinutes(b.start)
  );

  // ตรวจสอบว่ากะติดกันหรือไม่
  const consecutive = areShiftsConsecutive(sortedShifts);

  // หากะที่ check-in ครอบคลุม
  const covered = getCoveredShifts(checkInTime, sortedShifts);

  // คำนวณสถานะแต่ละกะ
  const statuses = covered.map(shift => {
    const result = calculateAttendanceStatus(checkInTime, shift.start);
    return {
      shift,
      ...result
    };
  });

  return {
    isConsecutive: consecutive,
    coveredShifts: covered,
    statuses,
    message: consecutive && covered.length > 1 
      ? `check-in ครอบคลุม ${covered.length} กะ` 
      : null
  };
};

/**
 * 🌙 Auto checkout ที่เที่ยงคืน - สำหรับกะกลางวันที่ลืม checkout
 * 
 * Scenario 5: ลืม checkout (กะกลางวัน)
 * - กะกลางวัน (สิ้นสุดก่อน 18:00) → auto checkout ที่ 00:00
 * - ไม่นับเป็นขาด
 * - บันทึกว่าเป็น auto checkout
 * 
 * @param {object} checkInRecord - บันทึก check-in
 * @param {string} shiftEnd - เวลาสิ้นสุดกะปกติ
 * @returns {object} - checkout record
 */
export const autoCheckoutAtMidnight = (checkInRecord, shiftEnd) => {
  const autoCheckoutTime = ATTENDANCE_CONFIG.AUTO_CHECKOUT_TIME;
  const shiftEndMinutes = timeToMinutes(shiftEnd);
  const dayShiftEndMinutes = timeToMinutes(ATTENDANCE_CONFIG.DAY_SHIFT_END);

  // ตรวจสอบว่าเป็นกะกลางวันหรือไม่ (สิ้นสุดก่อน 18:00)
  const isDayShift = shiftEndMinutes <= dayShiftEndMinutes;
  
  // ถ้าเป็นกะกลางคืน ไม่ต้อง auto checkout ที่เที่ยงคืน
  if (!isDayShift) {
    return null;
  }

  // ถ้ายังไม่ถึงเที่ยงคืน
  if (!shouldAutoCheckoutAtMidnight(checkInRecord.time, shiftEnd)) {
    return null;
  }

  return {
    time: autoCheckoutTime,
    status: 'Auto checkout',
    location: checkInRecord.location || 'อยู่ในพื้นที่',
    photo: null,
    gps: null,
    address: checkInRecord.address || 'ในพื้นที่อนุญาต',
    distance: '-',
    checkedByBuddy: false,
    buddyName: null,
    isAutoCheckout: true,
    autoCheckoutReason: 'ลืม checkout - ระบบทำให้อัตโนมัติที่เที่ยงคืน (กะกลางวัน)'
  };
};

/**
 * ☀️ จัดการกะข้ามวัน - ตัด checkout ตามประเภทกะ
 * 
 * Scenario 6: กะข้ามวัน
 * - กะกลางคืน (เช่น 22:00-06:00) → ตัด checkout ที่เที่ยงวัน (12:00)
 * - กะกลางวัน (เช่น 09:00-17:00) → ตัด checkout ที่เที่ยงคืน (00:00)
 * - ไม่ให้ checkout ข้ามไปอีกวัน
 * 
 * @param {object} checkInRecord - บันทึก check-in
 * @param {object} shift - ข้อมูลกะ {start, end}
 * @param {string} currentTime - เวลาปัจจุบัน
 * @returns {object|null} - checkout record หรือ null
 */
export const handleCrossMidnightShift = (checkInRecord, shift, currentTime = null) => {
  const now = currentTime || new Date().toTimeString().slice(0, 5);
  const nowMinutes = timeToMinutes(now);
  const shiftStartMinutes = timeToMinutes(shift.start);
  const nightShiftStartMinutes = timeToMinutes(ATTENDANCE_CONFIG.NIGHT_SHIFT_START);
  
  // ตรวจสอบว่าเป็นกะข้ามวันหรือไม่
  if (!isCrossMidnightShift(shift.start, shift.end)) {
    return null;
  }

  // ตรวจสอบประเภทกะ
  const isNightShift = shiftStartMinutes >= nightShiftStartMinutes; // เริ่มหลัง 18:00 = กะกลางคืน
  
  if (isNightShift) {
    // 🌙 กะกลางคืน → ตัดที่เที่ยงวัน (12:00)
    const noonCutoffMinutes = timeToMinutes(ATTENDANCE_CONFIG.NOON_CUTOFF_TIME);
    
    if (nowMinutes >= noonCutoffMinutes) {
      return {
        time: ATTENDANCE_CONFIG.NOON_CUTOFF_TIME,
        status: 'Auto checkout (กะกลางคืนข้ามวัน)',
        location: checkInRecord.location || 'อยู่ในพื้นที่',
        photo: null,
        gps: null,
        address: checkInRecord.address || 'ในพื้นที่อนุญาต',
        distance: '-',
        checkedByBuddy: false,
        buddyName: null,
        isAutoCheckout: true,
        autoCheckoutReason: 'กะกลางคืนข้ามวัน - ตัดที่เที่ยงวันโดยอัตโนมัติ'
      };
    }
  } else {
    // ☀️ กะกลางวัน → ตัดที่เที่ยงคืน (00:00)
    const midnightMinutes = timeToMinutes(ATTENDANCE_CONFIG.AUTO_CHECKOUT_TIME);
    
    if (nowMinutes >= midnightMinutes || nowMinutes < timeToMinutes('06:00')) {
      return {
        time: ATTENDANCE_CONFIG.AUTO_CHECKOUT_TIME,
        status: 'Auto checkout (กะกลางวันข้ามวัน)',
        location: checkInRecord.location || 'อยู่ในพื้นที่',
        photo: null,
        gps: null,
        address: checkInRecord.address || 'ในพื้นที่อนุญาต',
        distance: '-',
        checkedByBuddy: false,
        buddyName: null,
        isAutoCheckout: true,
        autoCheckoutReason: 'กะกลางวันข้ามวัน - ตัดที่เที่ยงคืนโดยอัตโนมัติ'
      };
    }
  }

  return null;
};

export default {
  timeToMinutes,
  minutesToTime,
  calculateTimeDifference,
  calculateAttendanceStatus,
  areShiftsConsecutive,
  getCoveredShifts,
  shouldAutoCheckoutAtMidnight,
  isCrossMidnightShift,
  createAttendanceRecord,
  hasCheckedInToday,
  hasCheckedInForShift, // 🆕 เพิ่มฟังก์ชันใหม่
  handleConsecutiveShifts,
  autoCheckoutAtMidnight,
  handleCrossMidnightShift
};
