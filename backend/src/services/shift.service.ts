import { PrismaClient, ShiftType, DayOfWeek, Role } from '@prisma/client';
import { prisma } from '../lib/prisma.js';

/**
 * 🔧 Shift Service - จัดการตารางงาน/กะ
 */

export interface CreateShiftDTO {
  name: string;
  shiftType: ShiftType;
  startTime: string; // HH:MM
  endTime: string; // HH:MM
  gracePeriodMinutes?: number;
  lateThresholdMinutes?: number;
  specificDays?: DayOfWeek[];
  customDate?: Date;
  locationId?: number;
  userId: number; // พนักงานที่ได้รับมอบหมายกะนี้
  createdByUserId: number; // ผู้สร้างกะ (admin/superadmin)
}

export interface UpdateShiftDTO {
  name?: string;
  startTime?: string;
  endTime?: string;
  gracePeriodMinutes?: number;
  lateThresholdMinutes?: number;
  specificDays?: DayOfWeek[];
  customDate?: Date;
  locationId?: number;
  isActive?: boolean;
}

/**
 * สร้างกะใหม่
 */
export const createShift = async (data: CreateShiftDTO) => {
  // Validate เวลา
  if (!isValidTimeFormat(data.startTime) || !isValidTimeFormat(data.endTime)) {
    throw new Error('รูปแบบเวลาไม่ถูกต้อง (ต้องเป็น HH:MM)');
  }

  // Validate location ถ้ามี
  if (data.locationId) {
    const location = await prisma.location.findUnique({
      where: { locationId: data.locationId },
    });
    if (!location) {
      throw new Error('ไม่พบสถานที่ที่ระบุ');
    }
  }

  // Validate shiftType และ specificDays/customDate
  if (data.shiftType === 'SPECIFIC_DAY' && (!data.specificDays || data.specificDays.length === 0)) {
    throw new Error('กะแบบ SPECIFIC_DAY ต้องระบุวันที่ต้องการ');
  }
  if (data.shiftType === 'CUSTOM' && !data.customDate) {
    throw new Error('กะแบบ CUSTOM ต้องระบุวันที่');
  }

  const shift = await prisma.shift.create({
    data: {
      name: data.name,
      shiftType: data.shiftType,
      startTime: data.startTime,
      endTime: data.endTime,
      gracePeriodMinutes: data.gracePeriodMinutes ?? 15,
      lateThresholdMinutes: data.lateThresholdMinutes ?? 30,
      specificDays: data.specificDays ?? [],
      customDate: data.customDate,
      locationId: data.locationId,
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
        },
      },
    },
  });

  return shift;
};

/**
 * ดึงกะทั้งหมดของ user (ตัวเอง)
 */
export const getShiftsByUserId = async (userId: number) => {
  const shifts = await prisma.shift.findMany({
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

  return shifts;
};

/**
 * ดึงกะทั้งหมด (Admin only)
 */
export const getAllShifts = async (filters?: {
  userId?: number;
  shiftType?: ShiftType;
  isActive?: boolean;
}) => {
  const shifts = await prisma.shift.findMany({
    where: {
      ...(filters?.userId && { userId: filters.userId }),
      ...(filters?.shiftType && { shiftType: filters.shiftType }),
      ...(filters?.isActive !== undefined && { isActive: filters.isActive }),
    },
    include: {
      location: true,
      user: {
        select: {
          userId: true,
          firstName: true,
          lastName: true,
          employeeId: true,
          role: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
  });

  return shifts;
};

/**
 * ดึงกะเฉพาะ ID
 */
export const getShiftById = async (shiftId: number) => {
  const shift = await prisma.shift.findUnique({
    where: { shiftId },
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
    },
  });

  if (!shift) {
    throw new Error('ไม่พบกะที่ระบุ');
  }

  return shift;
};

/**
 * อัปเดตกะ
 */
export const updateShift = async (shiftId: number, userId: number, role: Role, data: UpdateShiftDTO) => {
  // ตรวจสอบว่ามีกะนี้อยู่จริง
  const existingShift = await prisma.shift.findUnique({
    where: { shiftId },
  });

  if (!existingShift) {
    throw new Error('ไม่พบกะที่ระบุ');
  }

  // ตรวจสอบสิทธิ์ - Admin แก้ไขได้ทุกกะ, User แก้ไขได้เฉพาะกะของตัวเอง
  if (role !== 'ADMIN' && role !== 'SUPERADMIN' && existingShift.userId !== userId) {
    throw new Error('คุณไม่มีสิทธิ์แก้ไขกะนี้');
  }

  // Validate เวลาถ้ามีการเปลี่ยน
  if (data.startTime && !isValidTimeFormat(data.startTime)) {
    throw new Error('รูปแบบเวลาเริ่มต้นไม่ถูกต้อง');
  }
  if (data.endTime && !isValidTimeFormat(data.endTime)) {
    throw new Error('รูปแบบเวลาสิ้นสุดไม่ถูกต้อง');
  }

  const updatedShift = await prisma.shift.update({
    where: { shiftId },
    data: {
      ...data,
      updatedByUserId: userId,
    },
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
    },
  });

  return updatedShift;
};

/**
 * ลบกะ (Admin only)
 */
export const deleteShift = async (shiftId: number, deletedByUserId: number, deleteReason: string) => {
  const shift = await prisma.shift.findUnique({
    where: { shiftId },
  });

  if (!shift) {
    throw new Error('ไม่พบกะที่ระบุ');
  }

  if (!deleteReason || deleteReason.trim().length === 0) {
    throw new Error('กรุณาระบุเหตุผลในการลบ');
  }

  // Soft delete - เปลี่ยน isActive เป็น false และบันทึกผู้ลบ
  const deletedShift = await prisma.shift.update({
    where: { shiftId },
    data: { 
      isActive: false,
      deletedAt: new Date(),
      deletedByUserId,
      deleteReason,
    },
  });

  return deletedShift;
};

/**
 * ดึงกะที่ใช้งานได้ในวันนี้ของ user
 */
export const getActiveShiftsForToday = async (userId: number) => {
  const today = new Date();
  const dayOfWeek = getDayOfWeek(today);

  const shifts = await prisma.shift.findMany({
    where: {
      userId,
      isActive: true,
      OR: [
        { shiftType: 'REGULAR' },
        {
          shiftType: 'SPECIFIC_DAY',
          specificDays: {
            has: dayOfWeek,
          },
        },
        {
          shiftType: 'CUSTOM',
          customDate: {
            equals: new Date(today.toISOString().split('T')[0]),
          },
        },
      ],
    },
    include: {
      location: true,
    },
  });

  return shifts;
};

/**
 * Helper: Validate time format (HH:MM)
 */
function isValidTimeFormat(time: string): boolean {
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  return timeRegex.test(time);
}

/**
 * Helper: Convert Date to DayOfWeek enum
 */
function getDayOfWeek(date: Date): DayOfWeek {
  const days: DayOfWeek[] = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  return days[date.getDay()];
}

export const shiftService = {
  createShift,
  getShiftsByUserId,
  getAllShifts,
  getShiftById,
  updateShift,
  deleteShift,
  getActiveShiftsForToday,
};

export default shiftService;
