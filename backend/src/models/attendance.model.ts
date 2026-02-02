import { prisma } from '../lib/prisma.js';
import type { AttendanceStatus } from '@prisma/client';

/**
 * 📦 Attendance Model - ติดต่อ Database สำหรับ Attendance
 * 
 * 🔴 หมายเหตุ: ไฟล์นี้เป็น "โกดัง" ที่เก็บ function ติดต่อ Database
 * - ไม่มี business logic
 * - มีแค่ CRUD operations
 * - Service layer จะเรียกใช้ function เหล่านี้
 */

// ============================================
// 📦 Types
// ============================================

export interface CreateAttendanceData {
  userId: number;
  shiftId?: number | null;
  locationId?: number | null;
  checkInPhoto?: string | null;
  checkInLat?: number | null;
  checkInLng?: number | null;
  checkInAddress?: string | null;
  checkInDistance?: number | null;
  status: AttendanceStatus;
  lateMinutes?: number | null;
  note?: string | null;
}

export interface UpdateAttendanceData {
  status?: AttendanceStatus;
  note?: string;
  checkIn?: Date;
  checkOut?: Date;
  checkOutPhoto?: string | null;
  checkOutLat?: number | null;
  checkOutLng?: number | null;
  checkOutAddress?: string | null;
  checkOutDistance?: number | null;
}

// ============================================
// 📋 CRUD Functions
// ============================================

/**
 * ➕ สร้าง Attendance ใหม่
 */
export const createAttendance = async (data: CreateAttendanceData) => {
  return prisma.attendance.create({
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
};

/**
 * 📋 ดึง Attendance ตาม ID
 */
export const findAttendanceById = async (attendanceId: number) => {
  return prisma.attendance.findUnique({
    where: { attendanceId },
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
};

/**
 * 📋 ดึง Attendance ที่ยังไม่ได้ check-out ของ user
 */
export const findPendingCheckout = async (
  userId: number, 
  options?: { 
    attendanceId?: number; 
    shiftId?: number; 
  }
) => {
  return prisma.attendance.findFirst({
    where: {
      userId,
      checkOut: null,
      ...(options?.attendanceId && { attendanceId: options.attendanceId }),
      ...(options?.shiftId && { shiftId: options.shiftId }),
    },
    orderBy: {
      checkIn: 'desc',
    },
    include: {
      location: true,
    },
  });
};

/**
 * 📋 ดึง Attendance วันนี้ของ user
 */
export const findTodayAttendance = async (
  userId: number, 
  shiftId?: number
) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return prisma.attendance.findFirst({
    where: {
      userId,
      ...(shiftId && { shiftId }),
      checkIn: {
        gte: today,
        lt: tomorrow,
      },
    },
  });
};

/**
 * 📋 ดึง Attendances วันนี้ของ user (ทั้งหมด)
 */
export const findAllTodayAttendances = async (userId: number) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return prisma.attendance.findMany({
    where: {
      userId,
      checkIn: {
        gte: today,
        lt: tomorrow,
      },
    },
    include: {
      shift: true,
      location: true,
    },
    orderBy: {
      checkIn: 'desc',
    },
  });
};

/**
 * 📋 ดึง Attendances ของ user (มี filter)
 */
export const findAttendancesByUser = async (
  userId: number,
  filters?: {
    startDate?: Date;
    endDate?: Date;
    status?: AttendanceStatus;
  }
) => {
  return prisma.attendance.findMany({
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
};

/**
 * 📋 ดึง Attendances ทั้งหมด (Admin only)
 */
export const findAllAttendances = async (filters?: {
  userId?: number;
  startDate?: Date;
  endDate?: Date;
  status?: AttendanceStatus;
}) => {
  return prisma.attendance.findMany({
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
};

/**
 * 🔄 อัพเดต Attendance
 */
export const updateAttendance = async (
  attendanceId: number,
  data: UpdateAttendanceData
) => {
  return prisma.attendance.update({
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
};

/**
 * 🗑️ ลบ Attendance
 */
export const deleteAttendance = async (attendanceId: number) => {
  return prisma.attendance.delete({
    where: { attendanceId },
  });
};

// ============================================
// 📤 Export
// ============================================

export const attendanceModel = {
  createAttendance,
  findAttendanceById,
  findPendingCheckout,
  findTodayAttendance,
  findAllTodayAttendances,
  findAttendancesByUser,
  findAllAttendances,
  updateAttendance,
  deleteAttendance,
};

export default attendanceModel;
