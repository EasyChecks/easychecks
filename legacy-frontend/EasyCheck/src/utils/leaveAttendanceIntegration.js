/**
 * 🔗 leaveAttendanceIntegration.js
 * ระบบเชื่อมโยงการลาและการลงเวลาเข้างาน
 * 
 * จุดประสงค์:
 * - ป้องกันไม่ให้พนักงานที่ลาได้รับอนุมัติถูกบันทึกเป็นขาดงาน
 * - ไม่ต้องให้พนักงานที่ลากด check-in/check-out
 * - บันทึกสถานะ "ลางาน" อัตโนมัติในวันที่ได้รับอนุมัติ
 */

import ATTENDANCE_CONFIG from '../config/attendanceConfig';
import { getApprovedLateArrivalRequest } from './attendanceLogic';

/**
 * 🔍 ตรวจสอบว่าพนักงานมีการลาที่ได้รับอนุมัติในวันนี้หรือไม่
 * 
 * @param {string} userId - รหัสพนักงาน
 * @param {string} date - วันที่ต้องการตรวจสอบ (dd/mm/yyyy)
 * @returns {object|null} - ข้อมูลการลา หรือ null
 */
export const getApprovedLeaveForDate = (userId, date) => {
  try {
    // ดึงข้อมูลการลาจาก localStorage
    const leaveList = localStorage.getItem('leaveList');
    if (!leaveList) {
      // console.log('🚨 No leaveList in localStorage');
      return null;
    }

    const leaves = JSON.parse(leaveList);
    
    // console.log(`🔍 [getApprovedLeaveForDate] Searching:`, { userId, date });
    // console.log(`🔍 [getApprovedLeaveForDate] Total leaves:`, leaves.length);
    // console.log(`🔍 [getApprovedLeaveForDate] All leaves:`, leaves.map(l => ({
    //   id: l.id,
    //   userId: l.userId,
    //   status: l.status,
    //   startDate: l.startDate,
    //   endDate: l.endDate
    // })));
    
    // กรองเฉพาะการลาที่:
    // 1. เป็นของ user คนนี้ (ถ้ามีข้อมูล userId)
    // 2. สถานะ = 'อนุมัติ'
    // 3. วันที่ตรงกับที่ส่งมา
    const approvedLeave = leaves.find(leave => {
      // console.log(`  ↳ Checking leave:`, {
      //   id: leave.id,
      //   type: leave.leaveType,
      //   status: leave.status,
      //   leaveUserId: leave.userId,
      //   targetUserId: userId,
      //   start: leave.startDate,
      //   end: leave.endDate
      // });
      
      //  เช็ค userId ก่อน (สำคัญมาก!)
      if (leave.userId !== undefined && leave.userId !== null && leave.userId !== userId) {
        // console.log(`  ⛔ Skip: Different user (${leave.userId} vs ${userId})`);
        return false;
      }
      
      // เช็คสถานะ
      if (leave.status !== 'อนุมัติ') {
        // console.log(`  ⛔ Skip: Not approved (status: ${leave.status})`);
        return false;
      }
      
      // เช็ควันที่
      // รองรับทั้ง fullday (มี startDate, endDate) และ hourly (มี period)
      if (leave.startDate && leave.endDate) {
        //  เปรียบเทียบแบบ string ก่อน (ง่ายและแม่นยำ)
        const isExactMatch = leave.startDate === date || leave.endDate === date;
        
        if (isExactMatch) {
          // console.log('✅ [EXACT MATCH] Found approved leave:', {
          //   userId: leave.userId,
          //   leaveType: leave.leaveType,
          //   date: date
          // });
          return true;
        }
        
        // แปลงวันที่เป็น Date object เพื่อเปรียบเทียบช่วง
        try {
          const checkDate = convertDateToObject(date);
          const startDate = convertDateToObject(leave.startDate);
          const endDate = convertDateToObject(leave.endDate);
          
          const isInRange = checkDate >= startDate && checkDate <= endDate;
          
          // console.log(`  🔍 Date range check:`, {
          //   checkDate: date,
          //   startDate: leave.startDate,
          //   endDate: leave.endDate,
          //   checkDateObj: checkDate.toDateString(),
          //   startDateObj: startDate.toDateString(),
          //   endDateObj: endDate.toDateString(),
          //   isInRange
          // });
          
          if (isInRange) {
            // console.log('✅ [RANGE MATCH] Found approved leave:', {
            //   userId: leave.userId,
            //   leaveType: leave.leaveType,
            //   startDate: leave.startDate,
            //   endDate: leave.endDate,
            //   checkDate: date
            // });
          }
          
          return isInRange;
        } catch (dateError) {
          console.error('❌ Date parsing error:', dateError);
          return false;
        }
      }
      
      // กรณี hourly leave ดูจาก period
      if (leave.period) {
        const matches = leave.period.includes(date);
        // console.log(`  🔍 Period check: ${leave.period} includes ${date}? ${matches}`);
        return matches;
      }
      
      console.log(`  ⛔ Skip: No date info`);
      return false;
    });
    
    if (!approvedLeave) {
      console.log('❌ [getApprovedLeaveForDate] No approved leave found for:', { userId, date });
      // console.log('💡 [TIP] Check if:', {
      //   hasApprovedLeaves: leaves.filter(l => l.status === 'อนุมัติ').length,
      //   hasUserLeaves: leaves.filter(l => l.userId === userId).length,
      //   dateFormat: 'dd/mm/yyyy (พ.ศ.)'
      // });
    } else {
      // console.log('✅ [getApprovedLeaveForDate] SUCCESS:', approvedLeave);
    }

    return approvedLeave || null;
  } catch (error) {
    console.error('Error checking approved leave:', error);
    return null;
  }
};

/**
 * แปลงวันที่จาก dd/mm/yyyy เป็น Date object
 * 
 * @param {string} dateStr - วันที่ในรูปแบบ dd/mm/yyyy
 * @returns {Date}
 */
const convertDateToObject = (dateStr) => {
  const [day, month, year] = dateStr.split('/');
  // แปลง พ.ศ. เป็น ค.ศ.
  const gregorianYear = parseInt(year) - 543;
  return new Date(gregorianYear, parseInt(month) - 1, parseInt(day));
};

/**
 * สร้าง attendance record สำหรับวันที่ลา
 * 
 * @param {string} userId - รหัสพนักงาน
 * @param {string} userName - ชื่อพนักงาน
 * @param {string} date - วันที่ (dd/mm/yyyy)
 * @param {object} leaveData - ข้อมูลการลา
 * @param {array} shifts - กะงานของวันนั้น
 * @returns {void}
 */
export const createLeaveAttendanceRecord = (userId, userName, date, leaveData, shifts = []) => {
  try {
    const userAttendanceKey = `attendanceRecords_user_${userId}_${userName}`;
    const savedRecords = localStorage.getItem(userAttendanceKey);
    const attendanceRecords = savedRecords ? JSON.parse(savedRecords) : [];
    
    // ตรวจสอบว่ามี record วันนี้แล้วหรือยัง
    const existingRecordIndex = attendanceRecords.findIndex(r => r.date === date);
    
    // สร้าง leave record
    const leaveRecord = {
      date: date,
      status: ATTENDANCE_CONFIG.STATUS.LEAVE,
      leaveType: leaveData.leaveType,
      leaveMode: leaveData.leaveMode || 'fullday',
      leavePeriod: leaveData.period,
      leaveReason: leaveData.reason,
      isApproved: true,
      approvedAt: new Date().toISOString(),
      shifts: shifts.map(shift => ({
        shiftId: shift.id,
        shiftName: shift.name,
        shiftTime: `${shift.start} - ${shift.end}`,
        status: ATTENDANCE_CONFIG.STATUS.LEAVE,
        checkIn: null,
        checkOut: null,
        isLeave: true
      })),
      // ข้อมูลเดิมสำหรับ backward compatibility
      checkIn: {
        time: null,
        status: ATTENDANCE_CONFIG.STATUS.LEAVE,
        location: 'ลางาน',
        photo: null,
        gps: null,
        address: 'ลางาน',
        distance: '-',
        checkedByBuddy: false,
        buddyName: null,
        isLeave: true
      },
      checkOut: null
    };
    
    if (existingRecordIndex >= 0) {
      // อัปเดต record เดิม
      attendanceRecords[existingRecordIndex] = leaveRecord;
    } else {
      // เพิ่ม record ใหม่
      attendanceRecords.push(leaveRecord);
    }
    
    // บันทึกกลับเข้า localStorage
    localStorage.setItem(userAttendanceKey, JSON.stringify(attendanceRecords));
    
    // ส่ง event เพื่ออัปเดต UI
    window.dispatchEvent(new CustomEvent('attendanceUpdated', {
      detail: { userId, date, type: 'leave' }
    }));
    
    // console.log('✅ Created leave attendance record for', userName, 'on', date);
  } catch (error) {
    console.error('Error creating leave attendance record:', error);
  }
};

/**
 * 🔄 Auto-sync: ตรวจสอบและสร้าง attendance records สำหรับการลาที่อนุมัติแล้ว
 * ควรเรียกใช้ทุกครั้งที่:
 * 1. User login
 * 2. มีการอนุมัติคำขอลา
 * 3. เปิดหน้า Dashboard
 * 
 * @param {string} userId - รหัสพนักงาน
 * @param {string} userName - ชื่อพนักงาน
 * @returns {number} - จำนวน records ที่สร้าง
 */
export const syncApprovedLeavesToAttendance = (userId, userName) => {
  try {
    const leaveList = localStorage.getItem('leaveList');
    if (!leaveList) {
      console.log('🚨 [syncApprovedLeavesToAttendance] No leave list found');
      return 0;
    }

    const leaves = JSON.parse(leaveList);
    let syncedCount = 0;
    
    console.log('🔍 [syncApprovedLeavesToAttendance] Total leaves in system:', leaves.length);
    
    //  กรองเฉพาะการลาที่อนุมัติแล้ว และเป็นของ user นี้
    const approvedLeaves = leaves.filter(leave => {
      const isApproved = leave.status === 'อนุมัติ';
      const isMyLeave = !leave.userId || leave.userId === userId; // backward compatible
      
      if (isApproved && !isMyLeave) {
        console.log('⛔ [syncApprovedLeavesToAttendance] Skipping leave for different user:', leave.userId, 'vs', userId);
      }
      
      return isApproved && isMyLeave;
    });
    
    console.log(`✅ [syncApprovedLeavesToAttendance] Found ${approvedLeaves.length} approved leaves for user ${userId}`);
    
    approvedLeaves.forEach(leave => {
      console.log('📄 [syncApprovedLeavesToAttendance] Processing leave:', {
        type: leave.leaveType,
        start: leave.startDate,
        end: leave.endDate,
        userId: leave.userId
      });
      
      // สร้าง attendance records สำหรับทุกวันในช่วงการลา
      if (leave.startDate && leave.endDate) {
        const dates = getDateRange(leave.startDate, leave.endDate);
        
        dates.forEach(date => {
          // ดึงกะงานของวันนั้น (ถ้ามี)
          const shifts = getShiftsForDate(userId, date);
          
          createLeaveAttendanceRecord(userId, userName, date, leave, shifts);
          syncedCount++;
        });
      } else if (leave.period) {
        // กรณี hourly leave
        const date = leave.period.split(' ')[0]; // ดึงวันที่จาก period
        const shifts = getShiftsForDate(userId, date);
        
        createLeaveAttendanceRecord(userId, userName, date, leave, shifts);
        syncedCount++;
      }
    });
    
    console.log(`✅ [syncApprovedLeavesToAttendance] Synced ${syncedCount} approved leaves to attendance records for user ${userId}`);
    return syncedCount;
  } catch (error) {
    console.error('Error syncing approved leaves:', error);
    return 0;
  }
};

/**
 * 📅 สร้างรายการวันที่ระหว่างวันเริ่มต้นและวันสิ้นสุด
 * 
 * @param {string} startDate - วันที่เริ่มต้น (dd/mm/yyyy)
 * @param {string} endDate - วันที่สิ้นสุด (dd/mm/yyyy)
 * @returns {array} - array ของวันที่ทั้งหมด
 */
const getDateRange = (startDate, endDate) => {
  const dates = [];
  const start = convertDateToObject(startDate);
  const end = convertDateToObject(endDate);
  
  const current = new Date(start);
  while (current <= end) {
    const day = String(current.getDate()).padStart(2, '0');
    const month = String(current.getMonth() + 1).padStart(2, '0');
    const year = current.getFullYear() + 543; // แปลงกลับเป็น พ.ศ.
    
    dates.push(`${day}/${month}/${year}`);
    current.setDate(current.getDate() + 1);
  }
  
  return dates;
};

/**
 * 🕐 ดึงกะงานของ user ในวันที่กำหนด
 * 
 * @param {string} userId - รหัสพนักงาน
 * @param {string} date - วันที่ (dd/mm/yyyy)
 * @returns {array} - array ของกะงาน
 */
const getShiftsForDate = (userId, date) => {
  try {
    const schedules = localStorage.getItem('attendanceSchedules');
    if (!schedules) return [];
    
    const parsedSchedules = JSON.parse(schedules);
    
    // หากะงานที่ match กับวันนี้
    // (Logic นี้อาจต้องปรับตามโครงสร้างข้อมูลจริง)
    const todayShifts = parsedSchedules.filter(schedule => {
      // ตรวจสอบว่า schedule นี้เป็นของวันนี้หรือไม่
      // สมมติว่ามี field 'date' หรือคำนวณจาก 'days'
      return true; // ต้องปรับ logic ตามโครงสร้างจริง
    });
    
    return todayShifts;
  } catch (error) {
    console.error('Error getting shifts for date:', error);
    return [];
  }
};

/**
 * 🚫 ตรวจสอบว่าควรบล็อคการ check-in หรือไม่
 * (สำหรับวันที่มีการลาอนุมัติแล้ว)
 * 
 * @param {string} userId - รหัสพนักงาน
 * @param {string} date - วันที่ (dd/mm/yyyy)
 * @returns {object} - { blocked: boolean, reason: string, leaveData: object }
 */
export const shouldBlockCheckIn = (userId, date) => {
  const approvedLeave = getApprovedLeaveForDate(userId, date);
  
  if (approvedLeave) {
    return {
      blocked: true,
      reason: `คุณมีการลา${approvedLeave.leaveType}ที่ได้รับอนุมัติแล้ว ไม่จำเป็นต้อง check-in`,
      leaveData: approvedLeave
    };
  }
  
  return {
    blocked: false,
    reason: null,
    leaveData: null
  };
};

/**
 * 🔔 Event listener สำหรับการอนุมัติคำขอลา
 * เมื่อ admin อนุมัติ → สร้าง attendance record อัตโนมัติ
 */
export const setupLeaveApprovalListener = (userId, userName) => {
  const handleLeaveStatusUpdated = (event) => {
    // ตรวจสอบทั้ง event.detail.status และ event.detail.newStatus (เผื่อไว้สำหรับ backward compatibility)
    const status = event.detail?.newStatus || event.detail?.status;
    
    if (status === 'อนุมัติ') {
      console.log('🔔 [leaveAttendanceIntegration] Leave approved, syncing to attendance for user:', userId);
      syncApprovedLeavesToAttendance(userId, userName);
    }
  };
  
  window.addEventListener('leaveStatusUpdated', handleLeaveStatusUpdated);
  
  // Cleanup function
  return () => {
    window.removeEventListener('leaveStatusUpdated', handleLeaveStatusUpdated);
  };
};

export default {
  getApprovedLeaveForDate,
  getApprovedLateArrivalRequest, // 🔥 export จาก attendanceLogic.js
  createLeaveAttendanceRecord,
  syncApprovedLeavesToAttendance,
  shouldBlockCheckIn,
  setupLeaveApprovalListener
};
