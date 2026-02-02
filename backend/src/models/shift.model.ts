import { prisma } from '../lib/prisma.js';
import type { ShiftType, DayOfWeek } from '@prisma/client';

/**
 * 📦 Shift Model - ติดต่อ Database สำหรับ Shift
 * 
 * 🔴 หมายเหตุ: ไฟล์นี้เป็น "โกดัง" ที่เก็บ function ติดต่อ Database
 * - ไม่มี business logic
 * - มีแค่ CRUD operations
 * - Service layer จะเรียกใช้ function เหล่านี้
 */

// ============================================
// 📦 Types
// ============================================

export interface CreateShiftData {
  name: string;
  shiftType: ShiftType;
  startTime: string;
  endTime: string;
  gracePeriodMinutes?: number;
  lateThresholdMinutes?: number;
  specificDays?: DayOfWeek[];
  customDate?: Date;
  locationId?: number;
  userId: number;
  createdByUserId: number;
}

export interface UpdateShiftData {
  name?: string;
  startTime?: string;
  endTime?: string;
  gracePeriodMinutes?: number;
  lateThresholdMinutes?: number;
  specificDays?: DayOfWeek[];
  customDate?: Date;
  locationId?: number;
  isActive?: boolean;
  updatedByUserId?: number;
}

export interface DeleteShiftData {
  isActive: false;
  deletedAt: Date;
  deletedByUserId: number;
  deleteReason: string;
}

// ============================================
// 📋 CRUD Functions
// ============================================

/**
 * ➕ สร้าง Shift ใหม่
 */
export const createShift = async (data: CreateShiftData) => {
  return prisma.shift.create({
    data: {
      name: data.name,
      shiftType: data.shiftType,
      startTime: data.startTime,
      endTime: data.endTime,
      gracePeriodMinutes: data.gracePeriodMinutes ?? 15,
      lateThresholdMinutes: data.lateThresholdMinutes ?? 30,
      specificDays: data.specificDays ?? [],
      customDate: data.customDate ?? null,
      locationId: data.locationId ?? null,
      userId: data.userId,
      createdByUserId: data.createdByUserId,
    },
    include: {
      location: true,
      user: {
        select: {
          userId: true,
          firstName: true,
          lastName: true,
          employeeId: true,
          branchId: true,
        },
      },
      creator: {
        select: {
          userId: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });
};

/**
 * 📋 ดึง Shift ตาม ID
 */
export const findShiftById = async (shiftId: number) => {
  return prisma.shift.findUnique({
    where: { shiftId },
    include: {
      location: true,
      user: {
        select: {
          userId: true,
          firstName: true,
          lastName: true,
          employeeId: true,
          branchId: true,
          branch: {
            select: {
              name: true,
              code: true,
            },
          },
        },
      },
      creator: {
        select: {
          userId: true,
          firstName: true,
          lastName: true,
        },
      },
      updatedBy: {
        select: {
          userId: true,
          firstName: true,
          lastName: true,
        },
      },
      deletedBy: {
        select: {
          userId: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });
};

/**
 * 📋 ดึง Shift ตาม ID (แบบ basic - ไม่มี include)
 */
export const findShiftByIdBasic = async (shiftId: number) => {
  return prisma.shift.findUnique({
    where: { shiftId },
    include: {
      user: {
        select: { branchId: true },
      },
    },
  });
};

/**
 * 📋 ดึง Shifts ของ user (active only)
 */
export const findShiftsByUserId = async (userId: number) => {
  return prisma.shift.findMany({
    where: {
      userId,
      isActive: true,
    },
    include: {
      location: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
};

/**
 * 📋 ดึง Shifts ทั้งหมด (มี filter)
 */
export const findAllShifts = async (filters?: {
  userId?: number;
  shiftType?: ShiftType;
  isActive?: boolean;
  branchId?: number;
}) => {
  // สร้าง where clause แบบ dynamic
  let whereClause: any = {
    ...(filters?.userId && { userId: filters.userId }),
    ...(filters?.shiftType && { shiftType: filters.shiftType }),
    ...(filters?.isActive !== undefined && { isActive: filters.isActive }),
  };

  // กรองตาม branch (ถ้ามี)
  if (filters?.branchId) {
    whereClause.user = {
      branchId: filters.branchId,
    };
  }

  return prisma.shift.findMany({
    where: whereClause,
    include: {
      location: true,
      user: {
        select: {
          userId: true,
          firstName: true,
          lastName: true,
          employeeId: true,
          role: true,
          branchId: true,
          branch: {
            select: {
              name: true,
              code: true,
            },
          },
        },
      },
      creator: {
        select: {
          userId: true,
          firstName: true,
          lastName: true,
        },
      },
      updatedBy: {
        select: {
          userId: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });
};

/**
 * 📋 ดึง Active Shifts สำหรับวันนี้ของ user
 */
export const findActiveShiftsForToday = async (
  userId: number, 
  dayOfWeek: DayOfWeek, 
  todayDate: Date
) => {
  return prisma.shift.findMany({
    where: {
      userId,
      isActive: true,
      OR: [
        // กะประจำ (ใช้ได้ทุกวัน)
        { shiftType: 'REGULAR' },
        // กะเฉพาะวัน (ต้องตรงกับวันนี้)
        {
          shiftType: 'SPECIFIC_DAY',
          specificDays: {
            has: dayOfWeek,
          },
        },
        // กะวันเดียว (ต้องตรงกับวันนี้)
        {
          shiftType: 'CUSTOM',
          customDate: {
            equals: todayDate,
          },
        },
      ],
    },
    include: {
      location: true,
    },
  });
};

/**
 * 🔄 อัพเดต Shift
 */
export const updateShift = async (
  shiftId: number,
  data: UpdateShiftData
) => {
  return prisma.shift.update({
    where: { shiftId },
    data,
    include: {
      location: true,
      user: {
        select: {
          userId: true,
          firstName: true,
          lastName: true,
          employeeId: true,
        },
      },
      updatedBy: {
        select: {
          userId: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });
};

/**
 * 🗑️ Soft Delete Shift
 */
export const softDeleteShift = async (
  shiftId: number,
  data: DeleteShiftData
) => {
  return prisma.shift.update({
    where: { shiftId },
    data,
  });
};

// ============================================
// 📋 Helper Functions (อ่านข้อมูลอื่นๆ)
// ============================================

/**
 * 📋 ดึงข้อมูล User (สำหรับเช็ค branch)
 */
export const findUserById = async (userId: number) => {
  return prisma.user.findUnique({
    where: { userId },
    select: { 
      userId: true,
      branchId: true,
      role: true,
    },
  });
};

/**
 * 📋 ดึงข้อมูล Location
 */
export const findLocationById = async (locationId: number) => {
  return prisma.location.findUnique({
    where: { locationId },
  });
};

// ============================================
// 📤 Export
// ============================================

export const shiftModel = {
  createShift,
  findShiftById,
  findShiftByIdBasic,
  findShiftsByUserId,
  findAllShifts,
  findActiveShiftsForToday,
  updateShift,
  softDeleteShift,
  findUserById,
  findLocationById,
};

export default shiftModel;
