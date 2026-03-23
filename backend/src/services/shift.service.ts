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
  locationId?: number | null;
  userId: number;
  replaceExisting?: boolean;
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
  locationId?: number | null;
  userId?: number;
  isActive?: boolean;
  replaceExisting?: boolean;
}

export type BulkShiftErrorCode =
  | 'INVALID_PAYLOAD'
  | 'SHIFT_CONFLICT'
  | 'INVALID_LOCATION'
  | 'FORBIDDEN_BRANCH'
  | 'USER_NOT_FOUND';

export interface BulkShiftErrorDetail {
  userId?: number;
  code: BulkShiftErrorCode;
  message: string;
  userName?: string;
  employeeId?: string;
  existingShift?: {
    shiftId: number;
    name: string;
    startTime: string;
    endTime: string;
  };
}

export class BulkShiftCreateError extends Error {
  statusCode: number;
  code: BulkShiftErrorCode;
  details: BulkShiftErrorDetail[];

  constructor(message: string, statusCode: number, code: BulkShiftErrorCode, details: BulkShiftErrorDetail[]) {
    super(message);
    this.name = 'BulkShiftCreateError';
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
  }
}

export interface CreateBulkShiftDTO {
  name: string;
  shiftType: ShiftType;
  startTime: string;
  endTime: string;
  gracePeriodMinutes?: number;
  lateThresholdMinutes?: number;
  specificDays?: DayOfWeek[];
  customDate?: Date | string;
  locationId?: number | null;
  userIds: number[];
  replaceExisting?: boolean;
  createdByUserId: number;
  creatorRole: string;
  creatorBranchId?: number;
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

  if (data.locationId !== undefined && data.locationId !== null) {
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

  const existingActiveShift = await prisma.shift.findFirst({
    where: { userId: data.userId, isActive: true, isDeleted: false },
    select: { shiftId: true, name: true, startTime: true, endTime: true },
  });

  if (existingActiveShift && !data.replaceExisting) {
    throw new Error(
      `พนักงานมี active shift อยู่แล้ว (${existingActiveShift.name} ${existingActiveShift.startTime}-${existingActiveShift.endTime}) กรุณายืนยันการย้ายกะ`,
    );
  }

  if (existingActiveShift && data.replaceExisting) {
    await prisma.shift.updateMany({
      where: { userId: data.userId, isActive: true, isDeleted: false },
      data: { isActive: false, isDeleted: true, deleteReason: 'แทนที่ด้วยกะใหม่' },
    });
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

export const createBulkShift = async (data: CreateBulkShiftDTO) => {
  if (!isValidTimeFormat(data.startTime) || !isValidTimeFormat(data.endTime)) {
    throw new BulkShiftCreateError(
      'รูปแบบเวลาไม่ถูกต้อง (ต้องเป็น HH:MM เช่น 08:30)',
      400,
      'INVALID_PAYLOAD',
      [{ code: 'INVALID_PAYLOAD', message: 'รูปแบบเวลาไม่ถูกต้อง (ต้องเป็น HH:MM เช่น 08:30)' }],
    );
  }

  if (data.locationId !== undefined && data.locationId !== null) {
    const location = await prisma.location.findUnique({ where: { locationId: data.locationId } });
    if (!location) {
      throw new BulkShiftCreateError(
        'ไม่พบสถานที่ที่ระบุ',
        404,
        'INVALID_LOCATION',
        [{ code: 'INVALID_LOCATION', message: 'ไม่พบสถานที่ที่ระบุ' }],
      );
    }
  }

  if (data.shiftType === 'SPECIFIC_DAY' && (!data.specificDays || data.specificDays.length === 0)) {
    throw new BulkShiftCreateError(
      'กะแบบ SPECIFIC_DAY ต้องระบุวันที่ต้องการ (specificDays)',
      400,
      'INVALID_PAYLOAD',
      [{ code: 'INVALID_PAYLOAD', message: 'กะแบบ SPECIFIC_DAY ต้องระบุวันที่ต้องการ (specificDays)' }],
    );
  }

  if (data.shiftType === 'CUSTOM' && !data.customDate) {
    throw new BulkShiftCreateError(
      'กะแบบ CUSTOM ต้องระบุวันที่ (customDate)',
      400,
      'INVALID_PAYLOAD',
      [{ code: 'INVALID_PAYLOAD', message: 'กะแบบ CUSTOM ต้องระบุวันที่ (customDate)' }],
    );
  }

  const normalizedUserIds = Array.from(
    new Set(
      (data.userIds ?? [])
        .map((id) => Number(id))
        .filter((id) => Number.isInteger(id) && id > 0),
    ),
  );

  if (normalizedUserIds.length === 0) {
    throw new BulkShiftCreateError(
      'กรุณาระบุ userIds อย่างน้อย 1 คน',
      400,
      'INVALID_PAYLOAD',
      [{ code: 'INVALID_PAYLOAD', message: 'กรุณาระบุ userIds อย่างน้อย 1 คน' }],
    );
  }

  const users = await prisma.user.findMany({
    where: { userId: { in: normalizedUserIds } },
    select: {
      userId: true,
      branchId: true,
      firstName: true,
      lastName: true,
      employeeId: true,
    },
  });

  const userById = new Map<number, (typeof users)[number]>();
  users.forEach((u) => {
    userById.set(u.userId, u);
  });
  const details: BulkShiftErrorDetail[] = [];

  for (const userId of normalizedUserIds) {
    const user = userById.get(userId);
    if (!user) {
      details.push({ userId, code: 'USER_NOT_FOUND', message: 'ไม่พบพนักงานที่ระบุ' });
      continue;
    }

    if (!canAccessBranch(data.creatorRole, data.creatorBranchId, user.branchId || undefined)) {
      details.push({
        userId,
        code: 'FORBIDDEN_BRANCH',
        message: 'คุณไม่มีสิทธิ์สร้างกะให้พนักงานสาขาอื่น',
        userName: `${user.firstName} ${user.lastName}`.trim(),
        employeeId: user.employeeId,
      });
    }
  }

  if (details.length > 0) {
    const hasForbidden = details.some((d) => d.code === 'FORBIDDEN_BRANCH');
    const hasNotFound = details.some((d) => d.code === 'USER_NOT_FOUND');
    throw new BulkShiftCreateError(
      'ไม่สามารถสร้างกะแบบกลุ่มได้ เนื่องจากข้อมูลพนักงานบางรายการไม่ถูกต้อง',
      hasForbidden ? 403 : (hasNotFound ? 404 : 400),
      hasForbidden ? 'FORBIDDEN_BRANCH' : (hasNotFound ? 'USER_NOT_FOUND' : 'INVALID_PAYLOAD'),
      details,
    );
  }

  const existingActiveShifts = await prisma.shift.findMany({
    where: {
      userId: { in: normalizedUserIds },
      isActive: true,
      isDeleted: false,
    },
    select: {
      shiftId: true,
      userId: true,
      name: true,
      startTime: true,
      endTime: true,
    },
  });

  if (existingActiveShifts.length > 0 && !data.replaceExisting) {
    const conflictDetails: BulkShiftErrorDetail[] = existingActiveShifts.map((shift) => {
      const user = userById.get(shift.userId);
      return {
        userId: shift.userId,
        code: 'SHIFT_CONFLICT',
        message: `พนักงานมี active shift อยู่แล้ว (${shift.name} ${shift.startTime}-${shift.endTime})`,
        userName: user ? `${user.firstName} ${user.lastName}`.trim() : undefined,
        employeeId: user?.employeeId,
        existingShift: {
          shiftId: shift.shiftId,
          name: shift.name,
          startTime: shift.startTime,
          endTime: shift.endTime,
        },
      };
    });

    throw new BulkShiftCreateError(
      'พนักงานบางคนมี active shift อยู่แล้ว กรุณายืนยันการย้ายกะด้วย replaceExisting=true',
      409,
      'SHIFT_CONFLICT',
      conflictDetails,
    );
  }

  const parsedCustomDate = data.customDate
    ? (typeof data.customDate === 'string' ? new Date(data.customDate) : data.customDate)
    : undefined;

  const createdShifts = await prisma.$transaction(async (tx) => {
    if (existingActiveShifts.length > 0 && data.replaceExisting) {
      await tx.shift.updateMany({
        where: {
          userId: { in: normalizedUserIds },
          isActive: true,
          isDeleted: false,
        },
        data: {
          isActive: false,
          isDeleted: true,
          deleteReason: 'แทนที่ด้วยกะใหม่ (bulk)',
        },
      });
    }

    const records = [];
    for (const userId of normalizedUserIds) {
      const created = await tx.shift.create({
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
          userId,
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

      records.push(created);
    }

    return records;
  });

  await Promise.all(
    createdShifts.map((shift) =>
      createAuditLog({
        userId: data.createdByUserId,
        action: AuditAction.CREATE_SHIFT,
        targetTable: 'shifts',
        targetId: shift.shiftId,
        newValues: shift as unknown as Record<string, unknown>,
      }),
    ),
  );

  return {
    createdCount: createdShifts.length,
    shifts: createdShifts,
  };
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

  const targetUserId = data.userId ?? existingShift.userId;

  if (data.userId !== undefined) {
    const targetUser = await prisma.user.findUnique({
      where: { userId: data.userId },
      select: { branchId: true },
    });
    if (!targetUser) throw new Error('ไม่พบพนักงานที่ระบุ');

    if (!canAccessBranch(updaterRole, updaterBranchId, targetUser.branchId || undefined)) {
      throw new Error('คุณไม่มีสิทธิ์มอบหมายกะให้พนักงานสาขาอื่น');
    }
  }

  if (data.startTime && !isValidTimeFormat(data.startTime)) {
    throw new Error('รูปแบบเวลาเริ่มต้นไม่ถูกต้อง (ต้องเป็น HH:MM)');
  }
  if (data.endTime && !isValidTimeFormat(data.endTime)) {
    throw new Error('รูปแบบเวลาสิ้นสุดไม่ถูกต้อง (ต้องเป็น HH:MM)');
  }

  if (data.locationId !== undefined && data.locationId !== null) {
    const location = await prisma.location.findUnique({ where: { locationId: data.locationId } });
    if (!location) throw new Error('ไม่พบสถานที่ที่ระบุ');
  }

  const { replaceExisting, ...rawUpdateData } = data;
  const updateData: Prisma.ShiftUpdateInput = { ...rawUpdateData };
  if (data.customDate) {
    updateData.customDate = typeof data.customDate === 'string'
      ? new Date(data.customDate)
      : data.customDate;
  }

  const willBeActive = data.isActive === undefined ? existingShift.isActive : data.isActive;

  // บังคับ 1 คนต่อ 1 active shift: ก่อนเปิด/ย้ายกะ ต้องตรวจว่ามีกะอื่น active อยู่หรือไม่
  if (willBeActive) {
    const conflictActiveShift = await prisma.shift.findFirst({
      where: {
        userId: targetUserId,
        isActive: true,
        isDeleted: false,
        shiftId: { not: shiftId },
      },
      select: { shiftId: true, name: true, startTime: true, endTime: true },
    });

    if (conflictActiveShift && !replaceExisting) {
      throw new Error(
        `พนักงานมี active shift อยู่แล้ว (${conflictActiveShift.name} ${conflictActiveShift.startTime}-${conflictActiveShift.endTime}) กรุณายืนยันการย้ายกะ`,
      );
    }

    if (conflictActiveShift && replaceExisting) {
      await prisma.shift.updateMany({
        where: {
          userId: targetUserId,
          isActive: true,
          isDeleted: false,
          shiftId: { not: shiftId },
        },
        data: { isActive: false },
      });
    }
  }

  // keep current behavior when explicitly enabling an inactive shift
  if (data.isActive === true) {
    await prisma.shift.updateMany({
      where: {
        userId: targetUserId,
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
  createBulkShift,
  getShifts,
  getShiftById,
  updateShift,
  deleteShift,
  getActiveShiftsForToday,
};

export default shiftService;
