import { PrismaClient, AttendanceStatus } from '@prisma/client';
import type { Shift, Location } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { createAuditLog, AuditAction } from './audit.service.js';

/**
 * 📋 Attendance Service - จัดการการเข้า-ออกงาน
 * ตาม logic จาก legacy frontend (attendanceLogic.js + attendanceConfig.js)
 */

export interface CheckInDTO {
  userId: number;
  shiftId?: number;
  locationId?: number;
  photo?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
}

export interface CheckOutDTO {
  userId: number;
  attendanceId?: number; // เพิ่ม attendanceId เพื่อระบุการเข้างานที่จะออก
  shiftId?: number;
  photo?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
}

/**
 * 🕐 แปลงเวลา HH:MM เป็นนาที
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return (hours || 0) * 60 + (minutes || 0);
}

/**
 * 🕐 คำนวณความแตกต่างของเวลา (รองรับกะข้ามเที่ยงคืน)
 */
function calculateTimeDifference(checkInTime: string, shiftStart: string): number {
  let checkInMinutes = timeToMinutes(checkInTime);
  let shiftStartMinutes = timeToMinutes(shiftStart);

  let difference = checkInMinutes - shiftStartMinutes;

  // จัดการกะข้ามเที่ยงคืน
  if (difference > 720) {
    // check-in ก่อนเที่ยงคืน, กะเริ่มหลังเที่ยงคืน
    difference = checkInMinutes - (shiftStartMinutes + 1440);
  } else if (difference < -720) {
    // check-in หลังเที่ยงคืน, กะเริ่มก่อนเที่ยงคืน
    difference = checkInMinutes + 1440 - shiftStartMinutes;
  }

  return difference;
}

/**
 * 📏 คำนวณระยะห่างระหว่าง 2 จุด GPS (Haversine formula)
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // รัศมีโลก (เมตร)
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // ระยะห่าง (เมตร)
}

/**
 * 🎯 คำนวณสถานะการเข้างาน
 */
function calculateAttendanceStatus(
  checkInTime: string,
  shift: Shift
): {
  status: AttendanceStatus;
  lateMinutes: number;
  message: string;
} {
  const timeDifference = calculateTimeDifference(checkInTime, shift.startTime);
  const gracePeriod = shift.gracePeriodMinutes;
  const lateThreshold = shift.lateThresholdMinutes;

  // เข้างานก่อนเวลา (ภายใน grace period)
  if (timeDifference <= 0 && Math.abs(timeDifference) <= gracePeriod) {
    return {
      status: 'ON_TIME',
      lateMinutes: 0,
      message: `เข้างานตรงเวลา (มาก่อน ${Math.abs(timeDifference)} นาที)`,
    };
  }

  // เข้างานตรงเวลาพอดี
  if (timeDifference === 0) {
    return {
      status: 'ON_TIME',
      lateMinutes: 0,
      message: 'เข้างานตรงเวลา',
    };
  }

  // มาสาย แต่ไม่เกิน threshold
  if (timeDifference > 0 && timeDifference <= lateThreshold) {
    return {
      status: 'LATE',
      lateMinutes: timeDifference,
      message: `มาสาย ${timeDifference} นาที`,
    };
  }

  // มาสายเกิน threshold = ขาด
  return {
    status: 'ABSENT',
    lateMinutes: timeDifference,
    message: `สายเกิน ${lateThreshold} นาที ถือว่าขาดงาน`,
  };
}

/**
 * ✅ Check-in
 */
export const checkIn = async (data: CheckInDTO) => {
  const { userId, shiftId, locationId, photo, latitude, longitude, address } = data;

  // ตรวจสอบว่า check-in ไปแล้วหรือยัง
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const existingAttendance = await prisma.attendance.findFirst({
    where: {
      userId,
      ...(shiftId && { shiftId }),
      checkIn: {
        gte: today,
        lt: tomorrow,
      },
    },
  });

  if (existingAttendance) {
    throw new Error(shiftId ? 'คุณได้ check-in กะนี้ไปแล้ววันนี้' : 'คุณได้ check-in ไปแล้ววันนี้');
  }

  // ดึงข้อมูล Shift (ถ้ามี)
  let shift: Shift | null = null;
  if (shiftId) {
    shift = await prisma.shift.findUnique({
      where: { shiftId },
    });

    if (!shift) {
      throw new Error('ไม่พบกะที่ระบุ');
    }

    // ตรวจสอบว่ากะนี้เป็นของ user นี้หรือไม่
    if (shift.userId !== userId) {
      throw new Error('กะนี้ไม่ใช่ของคุณ');
    }
  }

  // ตรวจสอบ Location (ถ้ามี)
  let location: Location | null = null;
  let distance: number | null = null;
  
  if (locationId) {
    location = await prisma.location.findUnique({
      where: { locationId },
    });

    if (!location) {
      throw new Error('ไม่พบสถานที่ที่ระบุ');
    }

    // คำนวณระยะห่าง
    if (latitude && longitude) {
      distance = calculateDistance(
        latitude,
        longitude,
        location.latitude,
        location.longitude
      );

      // ตรวจสอบว่าอยู่ในรัศมีหรือไม่
      if (distance > location.radius) {
        throw new Error(
          `คุณอยู่นอกพื้นที่ (ห่างจากสถานที่ ${distance.toFixed(0)} เมตร, อนุญาตสูงสุด ${location.radius} เมตร)`
        );
      }
    }
  }

  // คำนวณสถานะการเข้างาน
  const checkInTime = new Date().toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  let status: AttendanceStatus = 'ON_TIME';
  let lateMinutes = 0;
  let message = 'เข้างาน';

  if (shift) {
    const result = calculateAttendanceStatus(checkInTime, shift);
    status = result.status;
    lateMinutes = result.lateMinutes;
    message = result.message;
  }

  // สร้างบันทึกการเข้างาน
  const attendance = await prisma.attendance.create({
    data: {
      userId,
      shiftId: shiftId ?? null,
      locationId: locationId ?? null,
      checkInPhoto: photo ?? null,
      checkInLat: latitude ?? null,
      checkInLng: longitude ?? null,
      checkInAddress: address ?? null,
      checkInDistance: distance ?? null,
      status,
      lateMinutes,
      note: message,
    },
    include: {
      user: {
        select: {
          userId: true,
          firstName: true,
          lastName: true,
          employeeId: true,
        },
      },
      shift: true,
      location: true,
    },
  });

  // 📋 Audit Log - CHECK_IN
  await createAuditLog({
    userId,
    action: AuditAction.CHECK_IN,
    targetTable: 'attendance',
    targetId: attendance.attendanceId,
    newValues: attendance,
  });

  return attendance;
};

/**
 * 🚪 Check-out
 */
export const checkOut = async (data: CheckOutDTO) => {
  const { userId, attendanceId, shiftId, photo, latitude, longitude, address } = data;

  // หาการ check-in ตาม attendanceId หรือ หาล่าสุดที่ยังไม่ได้ check-out
  let attendance;
  
  if (attendanceId) {
    attendance = await prisma.attendance.findFirst({
      where: {
        attendanceId,
        userId, // ต้องเป็นของ user นี้
        checkOut: null,
      },
      include: {
        location: true,
      },
    });
  } else {
    attendance = await prisma.attendance.findFirst({
      where: {
        userId,
        ...(shiftId && { shiftId }),
        checkOut: null,
      },
      orderBy: {
        checkIn: 'desc',
      },
      include: {
        location: true,
      },
    });
  }

  if (!attendance) {
    throw new Error('ไม่พบการ check-in ที่ยังไม่ได้ check-out');
  }

  // ตรวจสอบ Location (ถ้ามี)
  let distance: number | null = null;
  
  if (attendance.location && latitude && longitude) {
    distance = calculateDistance(
      latitude,
      longitude,
      attendance.location.latitude,
      attendance.location.longitude
    );

    // ตรวจสอบว่าอยู่ในรัศมีหรือไม่
    if (distance > attendance.location.radius) {
      throw new Error(
        `คุณอยู่นอกพื้นที่ (ห่างจากสถานที่ ${distance.toFixed(0)} เมตร, อนุญาตสูงสุด ${attendance.location.radius} เมตร)`
      );
    }
  }

  // อัปเดต check-out
  const updatedAttendance = await prisma.attendance.update({
    where: {
      attendanceId: attendance.attendanceId,
    },
    data: {
      checkOut: new Date(),
      checkOutPhoto: photo ?? null,
      checkOutLat: latitude ?? null,
      checkOutLng: longitude ?? null,
      checkOutAddress: address ?? null,
      checkOutDistance: distance ?? null,
    },
    include: {
      user: {
        select: {
          userId: true,
          firstName: true,
          lastName: true,
          employeeId: true,
        },
      },
      shift: true,
      location: true,
    },
  });

  // 📋 Audit Log - CHECK_OUT
  await createAuditLog({
    userId,
    action: AuditAction.CHECK_OUT,
    targetTable: 'attendance',
    targetId: updatedAttendance.attendanceId,
    oldValues: { checkOut: null },
    newValues: updatedAttendance,
  });

  return updatedAttendance;
};

/**
 * 📋 ดึงประวัติการเข้างานของ user
 */
export const getAttendanceHistory = async (
  userId: number,
  filters?: {
    startDate?: Date;
    endDate?: Date;
    status?: AttendanceStatus;
  }
) => {
  const attendances = await prisma.attendance.findMany({
    where: {
      userId,
      ...(filters?.startDate && {
        checkIn: {
          gte: filters.startDate,
        },
      }),
      ...(filters?.endDate && {
        checkIn: {
          lte: filters.endDate,
        },
      }),
      ...(filters?.status && { status: filters.status }),
    },
    include: {
      shift: true,
      location: true,
    },
    orderBy: {
      checkIn: 'desc',
    },
  });

  return attendances;
};

/**
 * 📋 ดึงประวัติการเข้างานทั้งหมด (Admin only)
 */
export const getAllAttendances = async (filters?: {
  userId?: number;
  startDate?: Date;
  endDate?: Date;
  status?: AttendanceStatus;
}) => {
  const attendances = await prisma.attendance.findMany({
    where: {
      ...(filters?.userId && { userId: filters.userId }),
      ...(filters?.startDate && {
        checkIn: {
          gte: filters.startDate,
        },
      }),
      ...(filters?.endDate && {
        checkIn: {
          lte: filters.endDate,
        },
      }),
      ...(filters?.status && { status: filters.status }),
    },
    include: {
      user: {
        select: {
          userId: true,
          firstName: true,
          lastName: true,
          employeeId: true,
          role: true,
        },
      },
      shift: true,
      location: true,
    },
    orderBy: {
      checkIn: 'desc',
    },
  });

  return attendances;
};

/**
 * 🔄 อัปเดตการเข้างาน (Admin only)
 */
export const updateAttendance = async (
  attendanceId: number,
  data: {
    status?: AttendanceStatus;
    note?: string;
    checkIn?: Date;
    checkOut?: Date;
  }
) => {
  const attendance = await prisma.attendance.findUnique({
    where: { attendanceId },
  });

  if (!attendance) {
    throw new Error('ไม่พบข้อมูลการเข้างานที่ระบุ');
  }

  const updatedAttendance = await prisma.attendance.update({
    where: { attendanceId },
    data,
    include: {
      user: {
        select: {
          userId: true,
          firstName: true,
          lastName: true,
          employeeId: true,
        },
      },
      shift: true,
      location: true,
    },
  });

  // 📋 Audit Log - UPDATE_ATTENDANCE
  await createAuditLog({
    userId: attendance.userId,
    action: AuditAction.UPDATE_ATTENDANCE,
    targetTable: 'attendance',
    targetId: attendanceId,
    oldValues: attendance,
    newValues: updatedAttendance,
  });

  return updatedAttendance;
};

/**
 * 🗑️ ลบการเข้างาน (Admin only)
 */
export const deleteAttendance = async (attendanceId: number, deletedByUserId?: number) => {
  const attendance = await prisma.attendance.findUnique({
    where: { attendanceId },
  });

  if (!attendance) {
    throw new Error('ไม่พบข้อมูลการเข้างานที่ระบุ');
  }

  await prisma.attendance.delete({
    where: { attendanceId },
  });

  // 📋 Audit Log - DELETE_ATTENDANCE
  await createAuditLog({
    userId: deletedByUserId || attendance.userId,
    action: AuditAction.DELETE_ATTENDANCE,
    targetTable: 'attendance',
    targetId: attendanceId,
    oldValues: attendance,
  });

  return { message: 'ลบข้อมูลการเข้างานเรียบร้อยแล้ว' };
};

export const attendanceService = {
  checkIn,
  checkOut,
  getAttendanceHistory,
  getAllAttendances,
  updateAttendance,
  deleteAttendance,
};

export default attendanceService;
