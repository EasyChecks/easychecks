/**
 * Attendance Statistics Calculator
 * คำนวณสถิติการลงเวลาจากข้อมูลจริง
 */

/**
 * คำนวณสถิติการลงเวลาทั้งหมด (รองรับหลายกะต่อวัน)
 * @param {Array} attendanceRecords - array ของข้อมูลการลงเวลา
 *   รูปแบบ 1: [{date, checkIn, checkOut, status}] - single shift per day (backward compatible)
 *   รูปแบบ 2: [{date, shifts: [{checkIn, checkOut, status}, ...]}] - multiple shifts per day
 * @param {Object} options - ตัวเลือกการคำนวณ {startDate, endDate, workTimeStart}
 * @returns {Object} สถิติการลงเวลา
 */
export const calculateAttendanceStats = (attendanceRecords = [], options = {}) => {
  const {
    startDate = null,
    endDate = null,
    workTimeStart = '08:00' // เวลาเริ่มงานมาตรฐาน
  } = options;

  // กรองข้อมูลตามช่วงวันที่ถ้ามีการระบุ
  let filteredRecords = attendanceRecords;
  
  if (startDate || endDate) {
    filteredRecords = attendanceRecords.filter(record => {
      const recordDate = new Date(record.date);
      const start = startDate ? new Date(startDate) : null;
      const end = endDate ? new Date(endDate) : null;
      
      if (start && recordDate < start) return false;
      if (end && recordDate > end) return false;
      return true;
    });
  }

  const stats = {
    totalWorkDays: 0,    // จำนวนวันทำงานทั้งหมด
    totalShifts: 0,      // จำนวนกะทั้งหมด (ใหม่!)
    onTime: 0,           // จำนวนวันมาตรงเวลา
    late: 0,             // จำนวนวันมาสาย
    absent: 0,           // จำนวนวันขาดงาน
    leave: 0,            // จำนวนวันลา
    totalWorkHours: 0,   // ชั่วโมงทำงานรวม (รวมทุกกะ)
    averageCheckInTime: null, // เวลาเข้างานเฉลี่ย
    averageShiftsPerDay: 0,   // จำนวนกะเฉลี่ยต่อวัน (ใหม่!)
    records: filteredRecords
  };

  if (!filteredRecords || filteredRecords.length === 0) {
    return stats;
  }

  let totalMinutes = 0;
  let checkInCount = 0;

  filteredRecords.forEach(record => {
    stats.totalWorkDays++;

    // 🔥 รองรับทั้ง single shift และ multiple shifts
    const shifts = record.shifts || [{
      checkIn: record.checkIn,
      checkOut: record.checkOut,
      status: record.status
    }];
    
    stats.totalShifts += shifts.length;

    // 🔥 นับสถานะเป็นต่อ shift (ถ้ามี 2 กะ ให้เพิ่ม 2 ใน onTime/late/absent)
    shifts.forEach((s) => {
      const shift = s || {};
      // Normalize status keys and values
      const statusKey = (shift.status || '').toString().toLowerCase();

      // 🚨 สำคัญ: ตรวจสอบ 'leave' ก่อน 'absent' เพื่อไม่ให้วันลาถูกนับเป็นขาด
      if (statusKey === 'leave' || statusKey === 'ลา') {
        stats.leave++;
        return;
      }
      if (statusKey === 'absent' || statusKey === 'ขาด' || !shift.checkIn) {
        stats.absent++;
        return;
      }
      if (statusKey === 'late' || statusKey === 'มาสาย') {
        stats.late++;
        return;
      }
      if (statusKey === 'on_time' || statusKey === 'on-time' || statusKey === 'ตรงเวลา' || statusKey === 'on time') {
        stats.onTime++;
        return;
      }

      // ถ้าไม่มี status ให้คาดเดาจากเวลา checkIn
      if (shift.checkIn && workTimeStart) {
        const isActuallyLate = isLate(shift.checkIn, workTimeStart);
        if (isActuallyLate) {
          stats.late++;
        } else {
          stats.onTime++;
        }
      } else {
        // Fallback: ถ้าไม่มีข้อมูล ให้ถือว่าขาด
        stats.absent++;
      }
    });

    // คำนวณชั่วโมงทำงาน (รวมทุกกะ)
    shifts.forEach((shift) => {
      if (shift.checkIn && shift.checkOut) {
        const checkInTime = parseTime(shift.checkIn);
        const checkOutTime = parseTime(shift.checkOut);
        
        if (checkInTime && checkOutTime) {
          const workMinutes = (checkOutTime.getTime() - checkInTime.getTime()) / (1000 * 60);
          if (workMinutes > 0) {
            stats.totalWorkHours += workMinutes / 60;
          }

          // คำนวณเวลาเข้างานเฉลี่ย (นับทุก shift)
          totalMinutes += checkInTime.getHours() * 60 + checkInTime.getMinutes();
          checkInCount++;
        }
      }
    });
  });

  // คำนวณเวลาเข้างานเฉลี่ย
  if (checkInCount > 0) {
    const avgMinutes = Math.round(totalMinutes / checkInCount);
    const hours = Math.floor(avgMinutes / 60);
    const minutes = avgMinutes % 60;
    stats.averageCheckInTime = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  }

  // คำนวณจำนวนกะเฉลี่ยต่อวัน
  if (stats.totalWorkDays > 0) {
    stats.averageShiftsPerDay = (stats.totalShifts / stats.totalWorkDays).toFixed(1);
  }

  // ปัดเศษชั่วโมงทำงาน
  stats.totalWorkHours = Math.round(stats.totalWorkHours * 10) / 10;

  return stats;
};

/**
 * ตรวจสอบว่ามาสายหรือไม่
 * @param {string} checkInTime - เวลาเข้างาน (HH:MM)
 * @param {string} workTimeStart - เวลาเริ่มงานมาตรฐาน (HH:MM)
 * @returns {boolean}
 */
export const isLate = (checkInTime, workTimeStart = '08:00') => {
  if (!checkInTime) return false;
  
  const checkIn = parseTime(checkInTime);
  const workStart = parseTime(workTimeStart);
  
  if (!checkIn || !workStart) return false;
  
  return checkIn > workStart;
};

/**
 * คำนวณจำนวนนาทีที่สาย
 * @param {string} checkInTime - เวลาเข้างาน (HH:MM)
 * @param {string} workTimeStart - เวลาเริ่มงานมาตรฐาน (HH:MM)
 * @returns {number} จำนวนนาทีที่สาย (0 ถ้าไม่สาย)
 */
export const getLateMinutes = (checkInTime, workTimeStart = '08:00') => {
  if (!checkInTime) return 0;
  
  const checkIn = parseTime(checkInTime);
  const workStart = parseTime(workTimeStart);
  
  if (!checkIn || !workStart || checkIn <= workStart) return 0;
  
  return Math.round((checkIn - workStart) / (1000 * 60));
};

/**
 * 🆕 ตรวจสอบว่ามาสายเกินขีดจำกัดหรือไม่ (แบบ percentage)
 * @param {string} checkInTime - เวลาเข้างาน (HH:MM)
 * @param {string} workTimeStart - เวลาเริ่มงาน (HH:MM)
 * @param {string} workTimeEnd - เวลาเลิกงาน (HH:MM)
 * @param {number} latePercentageThreshold - เปอร์เซ็นต์ที่ถือว่าสาย (default: 10% = 0.1)
 * @returns {boolean} true ถ้าสายเกินขีดจำกัด
 * 
 * ตัวอย่าง:
 * - งาน 8 ชม. (480 นาที) → สาย 10% = 48 นาที
 * - งาน 30 นาที → สาย 10% = 3 นาที
 * - งาน 1 ชม. (60 นาที) → สาย 10% = 6 นาที
 */
export const isLateBeyondThreshold = (checkInTime, workTimeStart = '08:00', workTimeEnd = '17:00', latePercentageThreshold = 0.1) => {
  if (!checkInTime) return false;
  
  const lateMinutes = getLateMinutes(checkInTime, workTimeStart);
  if (lateMinutes === 0) return false;
  
  // คำนวณระยะเวลาทำงานทั้งหมด (นาที)
  const workStart = parseTime(workTimeStart);
  const workEnd = parseTime(workTimeEnd);
  
  if (!workStart || !workEnd) return false;
  
  const totalWorkMinutes = (workEnd - workStart) / (1000 * 60);
  if (totalWorkMinutes <= 0) return false;
  
  // คำนวณขีดจำกัดการมาสาย (% ของเวลาทำงาน)
  const lateThresholdMinutes = Math.ceil(totalWorkMinutes * latePercentageThreshold);
  
  // สาย 5 นาทีแรกไม่นับ (grace period)
  const gracePeriod = 5;
  
  return lateMinutes > Math.max(lateThresholdMinutes, gracePeriod);
};

/**
 * 🆕 คำนวณสถานะการเข้างาน (รองรับ percentage-based late detection)
 * @param {string} checkInTime - เวลาเข้างาน (HH:MM)
 * @param {string} workTimeStart - เวลาเริ่มงาน (HH:MM)
 * @param {string} workTimeEnd - เวลาเลิกงาน (HH:MM)
 * @returns {Object} { status: 'on_time' | 'late' | 'absent', autoCheckOut: boolean }
 */
export const getCheckInStatus = (checkInTime, workTimeStart = '08:00', workTimeEnd = '17:00') => {
  if (!checkInTime) {
    return { status: 'absent', autoCheckOut: false };
  }
  
  const isLateResult = isLateBeyondThreshold(checkInTime, workTimeStart, workTimeEnd);
  
  // 🔥 ถ้าสายเกินขีดจำกัด = ขาดงาน → ต้อง auto check-out ทันที
  if (isLateResult) {
    return { status: 'absent', autoCheckOut: true };
  }
  
  return { status: 'on_time', autoCheckOut: false };
};

/**
 * 🆕 ตรวจสอบว่าควร auto check-out หรือไม่
 * @param {string} checkInTime - เวลาเข้างาน (HH:MM)
 * @param {string} workTimeStart - เวลาเริ่มงาน (HH:MM)
 * @param {string} workTimeEnd - เวลาเลิกงาน (HH:MM)
 * @returns {boolean} true ถ้าควร auto check-out (ขาดงาน)
 */
export const shouldAutoCheckOut = (checkInTime, workTimeStart = '08:00', workTimeEnd = '17:00') => {
  if (!checkInTime) return false; // ไม่มีข้อมูลเข้างาน ไม่ต้อง auto check-out
  
  const result = getCheckInStatus(checkInTime, workTimeStart, workTimeEnd);
  return result.autoCheckOut;
};

/**
 * แปลงเวลาจาก string เป็น Date object
 * @param {string} timeString - เวลา (HH:MM หรือ HH:MM:SS)
 * @returns {Date|null}
 */
const parseTime = (timeString) => {
  if (!timeString) return null;
  
  try {
    const [hours, minutes] = timeString.split(':').map(Number);
    if (isNaN(hours) || isNaN(minutes)) return null;
    
    const date = new Date();
    date.setHours(hours, minutes, 0, 0);
    return date;
  } catch {
    return null;
  }
};

/**
 * สร้างรายงานสรุปรายเดือน
 * @param {Array} attendanceRecords - ข้อมูลการลงเวลา
 * @param {number} year - ปี
 * @param {number} month - เดือน (1-12)
 * @returns {Object}
 */
export const generateMonthlyReport = (attendanceRecords, year, month) => {
  const startDate = new Date(year, month - 1, 1);
  const endDate = new Date(year, month, 0);
  
  const stats = calculateAttendanceStats(attendanceRecords, {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString()
  });

  return {
    year,
    month,
    monthName: startDate.toLocaleDateString('th-TH', { month: 'long' }),
    ...stats
  };
};

/**
 * สร้างรายงานสรุปรายปี
 * @param {Array} attendanceRecords - ข้อมูลการลงเวลา
 * @param {number} year - ปี
 * @returns {Object}
 */
export const generateYearlyReport = (attendanceRecords, year) => {
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31);
  
  const stats = calculateAttendanceStats(attendanceRecords, {
    startDate: startDate.toISOString(),
    endDate: endDate.toISOString()
  });

  // สร้างรายงานแยกตามเดือน
  const monthlyStats = [];
  for (let month = 1; month <= 12; month++) {
    const monthReport = generateMonthlyReport(attendanceRecords, year, month);
    monthlyStats.push(monthReport);
  }

  return {
    year,
    ...stats,
    monthlyBreakdown: monthlyStats
  };
};

/**
 * ตรวจสอบสถานะการลงเวลาของวันนั้น
 * @param {Object} record - ข้อมูลการลงเวลา {date, checkIn, checkOut}
 * @param {Object} options - ตัวเลือก {workTimeStart, workTimeEnd}
 * @returns {string} 'on-time', 'late', 'absent', 'leave', 'present'
 */
export const getAttendanceStatus = (record, options = {}) => {
  const { workTimeStart = '08:00' } = options;
  
  if (!record) return 'absent';
  
  // ถ้ามีการระบุสถานะมาแล้วให้ใช้เลย
  if (record.status) return record.status;
  
  // ถ้าไม่มีข้อมูล checkIn
  if (!record.checkIn) return 'absent';
  
  // ตรวจสอบว่ามาสายหรือไม่
  if (isLate(record.checkIn, workTimeStart)) {
    return 'late';
  }
  
  return 'on-time';
};

/**
 * สร้าง mock data สำหรับทดสอบ (ย้ายไปยัง usersData.js แล้ว)
 * ฟังก์ชันนี้เก็บไว้เพื่อ backward compatibility
 * ใช้ generateMockAttendanceData จาก usersData.js แทน
 */
import { generateMockAttendanceData as mockDataGenerator } from '../data/usersData';

export const generateMockAttendanceData = mockDataGenerator;
