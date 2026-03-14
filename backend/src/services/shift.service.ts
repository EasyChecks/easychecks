import { ShiftType, DayOfWeek, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { createAuditLog, AuditAction } from './audit.service.js';
import { getThaiDateOnly, getThaiDayOfWeekIndex } from '../utils/timezone.js';

export interface CreateShiftDTO {
  name: string;
  shiftType: ShiftType;
  startTime: string;
  endTime: string;
  gracePeriodMinutes?: number;
  lateThresholdMinutes?: number;
  specificDays?: DayOfWeek[];
  customDate?: Date | string;
  locationId?: number;
  userId: number;
  createdByUserId: number;
  creatorRole: string;
  creatorBranchId?: number;
}

export interface UpdateShiftDTO {
  name?: string;
  startTime?: string;
  endTime?: string;
  gracePeriodMinutes?: number;
  lateThresholdMinutes?: number;
  specificDays?: DayOfWeek[];
  customDate?: Date | string;
  locationId?: number;
  isActive?: boolean;
}

function isValidTimeFormat(time: string): boolean {
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  return timeRegex.test(time);
}

function canAccessBranch(
  role: string,
  requesterBranchId: number | undefined,
  targetBranchId: number | undefined,
): boolean {
  if (role === 'SUPERADMIN') return true;
  if (role === 'ADMIN') {
    if (!requesterBranchId) return false;
    if (!targetBranchId) return true;
    return requesterBranchId === targetBranchId;
  }
  return false;
}

export const createShift = async (data: CreateShiftDTO) => {
  if (!isValidTimeFormat(data.startTime) || !isValidTimeFormat(data.endTime)) {
    throw new Error('รูปแบบเวลาไม่ถูกต้อง (ต้องเป็น HH:MM เช่น 08:30)');
  }

  if (data.locationId) {
    const location = await prisma.location.findUnique({ where: { locationId: data.locationId } });
    if (!location) throw new Error('ไม่พบสถานที่ที่ระบุ');
  }

  if (data.shiftType === 'SPECIFIC_DAY' && (!data.specificDays || data.specificDays.length === 0)) {
    throw new Error('กะแบบ SPECIFIC_DAY ต้องระบุวันที่ต้องการ (specificDays)');
  }
  if (data.shiftType === 'CUSTOM' && !data.customDate) {
    throw new Error('กะแบบ CUSTOM ต้องระบุวันที่ (customDate)');
  }

  const targetUser = await prisma.user.findUnique({
    where: { userId: data.userId },
    select: { branchId: true },
  });
  if (!targetUser) throw new Error('ไม่พบพนักงานที่ระบุ');

  if (!canAccessBranch(data.creatorRole, data.creatorBranchId, targetUser.branchId || undefined)) {
    throw new Error('คุณไม่มีสิทธิ์สร้างกะให้พนักงานสาขาอื่น');
  }

  const parsedCustomDate = data.customDate
    ? (typeof data.customDate === 'string' ? new Date(data.customDate) : data.customDate)
    : undefined;

  // บังคับ 1 คนต่อ 1 กะที่ active โดยปิดกะเดิมทั้งหมดก่อนสร้างใหม่
  await prisma.shift.updateMany({
    where: { userId: data.userId, isActive: true, isDeleted: false },
    data: { isActive: false, isDeleted: true, deleteReason: 'แทนที่ด้วยกะใหม่' },
  });

  const shift = await prisma.shift.create({
    data: {
      name: data.name,
      shiftType: data.shiftType,
      startTime: data.startTime,
      endTime: data.endTime,
      gracePeriodMinutes: data.gracePeriodMinutes ?? 15,
      lateThresholdMinutes: data.lateThresholdMinutes ?? 30,
      specificDays: data.specificDays ?? [],
      customDate: parsedCustomDate ?? null,
      locationId: data.locationId ?? null,
      userId: data.userId,
      isDeleted: false,
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
    },
  });

  await createAuditLog({
    userId: data.createdByUserId,
    action: AuditAction.CREATE_SHIFT,
    targetTable: 'shifts',
    targetId: shift.shiftId,
    newValues: shift as unknown as Record<string, unknown>,
  });

  return shift;
};

export const getShifts = async (
  requesterId: number,
  requesterRole: string,
  requesterBranchId: number | undefined,
  filters?: {
    userId?: number;
    shiftType?: ShiftType;
    isActive?: boolean;
  },
) => {
  const whereClause: Prisma.ShiftWhereInput = {
    ...(filters?.shiftType && { shiftType: filters.shiftType }),
  };
  (whereClause as Record<string, unknown>).isDeleted = false;

  if (filters?.isActive !== undefined) {
    whereClause.isActive = filters.isActive;
  } else if (requesterRole === 'USER' || requesterRole === 'MANAGER') {
    whereClause.isActive = true;
  }

  if (requesterRole === 'SUPERADMIN') {
    if (filters?.userId) whereClause.userId = filters.userId;
  } else if (requesterRole === 'ADMIN') {
    whereClause.user = { branchId: requesterBranchId };
    if (filters?.userId) whereClause.userId = filters.userId;
  } else {
    whereClause.userId = filters?.userId ?? requesterId;
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
    },
    orderBy: { shiftId: 'desc' },
  });
};

export const getShiftById = async (shiftId: number) => {
  const shift = await prisma.shift.findFirst({
    where: { shiftId, isDeleted: false },
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
    },
  });

  if (!shift) throw new Error('ไม่พบกะที่ระบุ');
  return shift;
};

export const updateShift = async (
  shiftId: number,
  updatedByUserId: number,
  updaterRole: string,
  updaterBranchId: number | undefined,
  data: UpdateShiftDTO,
) => {
  const existingShift = await prisma.shift.findFirst({
    where: { shiftId, isDeleted: false },
    include: { user: { select: { branchId: true } } },
  });

  if (!existingShift) throw new Error('ไม่พบกะที่ระบุ');

  if (!canAccessBranch(updaterRole, updaterBranchId, existingShift.user.branchId || undefined)) {
    throw new Error('คุณไม่มีสิทธิ์แก้ไขกะของสาขาอื่น');
  }

  if (data.startTime && !isValidTimeFormat(data.startTime)) {
    throw new Error('รูปแบบเวลาเริ่มต้นไม่ถูกต้อง (ต้องเป็น HH:MM)');
  }
  if (data.endTime && !isValidTimeFormat(data.endTime)) {
    throw new Error('รูปแบบเวลาสิ้นสุดไม่ถูกต้อง (ต้องเป็น HH:MM)');
  }

  const updateData: Prisma.ShiftUpdateInput = { ...data };
  if (data.customDate) {
    updateData.customDate = typeof data.customDate === 'string'
      ? new Date(data.customDate)
      : data.customDate;
  }

  // บังคับ 1 คนต่อ 1 กะที่ active: ถ้ากำลังเปิดกะนี้ ให้ปิดกะอื่นของพนักงานก่อน
  if (data.isActive === true) {
    await prisma.shift.updateMany({
      where: {
        userId: existingShift.userId,
        isActive: true,
        isDeleted: false,
        shiftId: { not: shiftId },
      },
      data: { isActive: false },
    });
  }

  const updatedShift = await prisma.shift.update({
    where: { shiftId },
    data: updateData,
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

  await createAuditLog({
    userId: updatedByUserId,
    action: AuditAction.UPDATE_SHIFT,
    targetTable: 'shifts',
    targetId: shiftId,
    oldValues: existingShift as unknown as Record<string, unknown>,
    newValues: updatedShift as unknown as Record<string, unknown>,
  });

  return updatedShift;
};

export const deleteShift = async (
  shiftId: number,
  deletedByUserId: number,
  deleterRole: string,
  deleterBranchId: number | undefined,
  deleteReason: string,
) => {
  const shift = await prisma.shift.findFirst({
    where: { shiftId, isDeleted: false },
    include: { user: { select: { branchId: true } } },
  });

  if (!shift) throw new Error('ไม่พบกะที่ระบุ');

  if (!canAccessBranch(deleterRole, deleterBranchId, shift.user.branchId || undefined)) {
    throw new Error('คุณไม่มีสิทธิ์ลบกะของสาขาอื่น');
  }

  if (!deleteReason || deleteReason.trim().length === 0) {
    throw new Error('กรุณาระบุเหตุผลในการลบ');
  }

  const deletedShift = await prisma.shift.update({
    where: { shiftId },
    data: {
      isActive: false,
      isDeleted: true,
      deleteReason,
    },
  });

  await createAuditLog({
    userId: deletedByUserId,
    action: AuditAction.DELETE_SHIFT,
    targetTable: 'shifts',
    targetId: shiftId,
    oldValues: shift as unknown as Record<string, unknown>,
    newValues: { isActive: false, isDeleted: true, deleteReason },
  });

  return deletedShift;
};

export const getActiveShiftsForToday = async (userId: number) => {
  const thaiDayIndex = getThaiDayOfWeekIndex();
  const days: DayOfWeek[] = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const dayOfWeek = days[thaiDayIndex] as DayOfWeek;
  const thaiDateOnly = getThaiDateOnly();

  return prisma.shift.findMany({
    where: {
      userId,
      isActive: true,
      isDeleted: false,
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
            equals: new Date(thaiDateOnly),
          },
        },
      ],
    },
    include: {
      location: true,
    },
    orderBy: { shiftId: 'desc' },
    take: 1,
  });
};

export const shiftService = {
  createShift,
  getShifts,
  getShiftById,
  updateShift,
  deleteShift,
  getActiveShiftsForToday,
};

export default shiftService;
