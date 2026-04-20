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

// ตรวจว่า string เวลาที่รับเข้ามาอยู่ในรูปแบบ HH:MM ถูกต้องหรือเปล่า
function isValidTimeFormat(time: string): boolean {
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/; // regex จำกัด 00:00 - 23:59 เท่านั้น
  return timeRegex.test(time); // คืน true ถ้าผ่าน, false ถ้าไม่ผ่าน
}

function toMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map((value) => Number(value));
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

function isEndTimeAfterStartTime(startTime: string, endTime: string): boolean {
  return toMinutes(endTime) > toMinutes(startTime);
}

// ตรวจว่าคนที่ทำรายการ (requester) มีสิทธิ์เข้าถึงสาขาของ target หรือเปล่า
function canAccessBranch(
  role: string,                         // role ของ requester: SUPERADMIN / ADMIN / อื่นๆ
  requesterBranchId: number | undefined, // สาขาของ requester
  targetBranchId: number | undefined,    // สาขาของ target user
): boolean {
  if (role === 'SUPERADMIN') return true;      // SUPERADMIN เข้าถึงได้ทุกสาขา
  if (role === 'ADMIN') {
    if (!requesterBranchId) return false;      // ADMIN ที่ไม่มีสาขาตัวเอง = config ผิดพลาด ห้ามเข้าถึง
    if (!targetBranchId) return true;          // target ไม่มีสาขา (global user) ADMIN จัดการได้
    return requesterBranchId === targetBranchId; // ADMIN เข้าถึงได้เฉพาะสาขาตัวเอง
  }
  return false; // role อื่นๆ (USER, MANAGER) ไม่มีสิทธิ์จัดการกะ
}

/**
 * สร้างกะทำงานให้พนักงาน 1 คน
 *
 * SQL เทียบเท่า:
 *   -- 1. ตรวจว่ามีกะ active อยู่แล้วไหม
 *   SELECT shift_id, name, start_time, end_time
 *   FROM shifts
 *   WHERE user_id = $userId AND is_active = true AND is_deleted = false
 *   LIMIT 1;
 *
 *   -- 2. ถ้า replaceExisting=true ให้ soft-delete กะเก่าก่อน
 *   UPDATE shifts
 *   SET is_active = false, is_deleted = true, delete_reason = 'แทนที่ด้วยกะใหม่'
 *   WHERE user_id = $userId AND is_active = true AND is_deleted = false;
 *
 *   -- 3. สร้างกะใหม่
 *   INSERT INTO shifts
 *     (name, shift_type, start_time, end_time, grace_period_minutes,
 *      late_threshold_minutes, specific_days, custom_date, location_id, user_id, is_deleted)
 *   VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, false)
 *   RETURNING
 *     shifts.*,
 *     locations.*,
 *     users.user_id, users.first_name, users.last_name, users.employee_id, users.branch_id;
 */
export const createShift = async (data: CreateShiftDTO) => {
  // ตรวจรูปแบบเวลาทั้งเริ่มและสิ้นสุด ก่อนทำอะไรทั้งนั้น
  if (!isValidTimeFormat(data.startTime) || !isValidTimeFormat(data.endTime)) {
    throw new Error('รูปแบบเวลาไม่ถูกต้อง (ต้องเป็น HH:MM เช่น 08:30)');
  }

  if (!isEndTimeAfterStartTime(data.startTime, data.endTime)) {
    throw new Error('เวลาเลิกงานต้องมากกว่าเวลาเริ่มงาน (เวลาออกต้องหลังเวลาเข้า)');
  }

  // ถ้าระบุ locationId มา ให้ตรวจว่า location นั้นมีอยู่จริงใน DB
  if (data.locationId !== undefined && data.locationId !== null) {
    const location = await prisma.location.findUnique({ where: { locationId: data.locationId } });
    if (!location) throw new Error('ไม่พบสถานที่ที่ระบุ');
  }

  // กะแบบ SPECIFIC_DAY ต้องบอกด้วยว่าจะใช้วันไหนบ้าง
  if (data.shiftType === 'SPECIFIC_DAY' && (!data.specificDays || data.specificDays.length === 0)) {
    throw new Error('กะแบบ SPECIFIC_DAY ต้องระบุวันที่ต้องการ (specificDays)');
  }
  // กะแบบ CUSTOM ต้องระบุวันที่เฉพาะเจาะจง
  if (data.shiftType === 'CUSTOM' && !data.customDate) {
    throw new Error('กะแบบ CUSTOM ต้องระบุวันที่ (customDate)');
  }

  // ดึงข้อมูล user เพื่อเอา branchId มาตรวจสิทธิ์
  const targetUser = await prisma.user.findUnique({
    where: { userId: data.userId },
    select: { branchId: true }, // เอาแค่ branchId พอ ไม่ดึงข้อมูลส่วนเกิน
  });
  if (!targetUser) throw new Error('ไม่พบพนักงานที่ระบุ');

  // ตรวจว่าผู้สร้างมีสิทธิ์สร้างกะให้พนักงานคนนี้ไหม (ต่างสาขาไม่ได้)
  if (!canAccessBranch(data.creatorRole, data.creatorBranchId, targetUser.branchId || undefined)) {
    throw new Error('คุณไม่มีสิทธิ์สร้างกะให้พนักงานสาขาอื่น');
  }

  // แปลง customDate จาก string เป็น Date object ถ้าจำเป็น
  const parsedCustomDate = data.customDate
    ? (typeof data.customDate === 'string' ? new Date(data.customDate) : data.customDate)
    : undefined;

  // ตรวจว่าพนักงานมี active shift อยู่แล้วหรือเปล่า
  const existingActiveShift = await prisma.shift.findFirst({
    where: { userId: data.userId, isActive: true, isDeleted: false },
    select: { shiftId: true, name: true, startTime: true, endTime: true },
  });

  // ถ้ามีกะอยู่แล้ว และ caller ยังไม่ได้ยืนยันว่าจะย้าย ให้ throw ออกไปก่อน
  if (existingActiveShift && !data.replaceExisting) {
    throw new Error(
      `พนักงานมี active shift อยู่แล้ว (${existingActiveShift.name} ${existingActiveShift.startTime}-${existingActiveShift.endTime}) กรุณายืนยันการย้ายกะ`,
    );
  }

  // ถ้า caller ยืนยันการย้ายแล้ว ให้ soft-delete กะเก่าทั้งหมดก่อนสร้างกะใหม่
  if (existingActiveShift && data.replaceExisting) {
    await prisma.shift.updateMany({
      where: { userId: data.userId, isActive: true, isDeleted: false },
      data: { isActive: false, isDeleted: true, deleteReason: 'แทนที่ด้วยกะใหม่' }, // soft-delete เก็บ record เก่าไว้
    });
  }

  // สร้างกะใหม่ใน DB
  const shift = await prisma.shift.create({
    data: {
      name: data.name,
      shiftType: data.shiftType,
      startTime: data.startTime,
      endTime: data.endTime,
      gracePeriodMinutes: data.gracePeriodMinutes ?? 15,  // ค่า default 15 นาที ถ้าไม่ส่งมา
      lateThresholdMinutes: data.lateThresholdMinutes ?? 30, // ค่า default 30 นาที
      specificDays: data.specificDays ?? [],               // ถ้าไม่มีวันเฉพาะ ใส่ array ว่าง
      customDate: parsedCustomDate ?? null,
      locationId: data.locationId ?? null,
      userId: data.userId,
      isDeleted: false, // กะใหม่ยังไม่ถูกลบ
    },
    include: {
      location: true, // join ข้อมูล location มาด้วย
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

  // บันทึก audit log ว่าใครสร้างกะนี้
  await createAuditLog({
    userId: data.createdByUserId,
    action: AuditAction.CREATE_SHIFT,
    targetTable: 'shifts',
    targetId: shift.shiftId,
    newValues: shift as unknown as Record<string, unknown>,
  });

  return shift;
};

/**
 * สร้างกะทำงานให้พนักงานหลายคนพร้อมกัน (bulk)
 *
 * SQL เทียบเท่า:
 *   -- 1. ตรวจ active shift ที่มีอยู่แล้วของทุกคนใน list
 *   SELECT shift_id, user_id, name, start_time, end_time
 *   FROM shifts
 *   WHERE user_id = ANY($userIds) AND is_active = true AND is_deleted = false;
 *
 *   -- 2. (ใน transaction) ถ้า replaceExisting=true ให้ soft-delete กะเก่าทั้งหมดก่อน
 *   UPDATE shifts
 *   SET is_active = false, is_deleted = true, delete_reason = 'แทนที่ด้วยกะใหม่ (bulk)'
 *   WHERE user_id = ANY($userIds) AND is_active = true AND is_deleted = false;
 *
 *   -- 3. (ใน transaction เดียวกัน) สร้างกะใหม่ทีละคน
 *   INSERT INTO shifts (name, shift_type, start_time, end_time, ..., user_id, is_deleted)
 *   VALUES (..., $userId, false)
 *   RETURNING shifts.*, locations.*, users.*, branches.*;
 *   -- (วนซ้ำสำหรับทุก userId)
 */
export const createBulkShift = async (data: CreateBulkShiftDTO) => {
  // ตรวจรูปแบบเวลาก่อน ถ้าผิดไม่ต้องทำต่อ
  if (!isValidTimeFormat(data.startTime) || !isValidTimeFormat(data.endTime)) {
    throw new BulkShiftCreateError(
      'รูปแบบเวลาไม่ถูกต้อง (ต้องเป็น HH:MM เช่น 08:30)',
      400,
      'INVALID_PAYLOAD',
      [{ code: 'INVALID_PAYLOAD', message: 'รูปแบบเวลาไม่ถูกต้อง (ต้องเป็น HH:MM เช่น 08:30)' }],
    );
  }

  if (!isEndTimeAfterStartTime(data.startTime, data.endTime)) {
    throw new BulkShiftCreateError(
      'เวลาเลิกงานต้องมากกว่าเวลาเริ่มงาน (เวลาออกต้องหลังเวลาเข้า)',
      400,
      'INVALID_PAYLOAD',
      [{ code: 'INVALID_PAYLOAD', message: 'เวลาเลิกงานต้องมากกว่าเวลาเริ่มงาน (เวลาออกต้องหลังเวลาเข้า)' }],
    );
  }

  // ถ้าส่ง locationId มา ให้ตรวจว่ามีอยู่จริงก่อนสร้างกะ
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

  // SPECIFIC_DAY ต้องมี specificDays บอกว่าจะใช้วันไหน
  if (data.shiftType === 'SPECIFIC_DAY' && (!data.specificDays || data.specificDays.length === 0)) {
    throw new BulkShiftCreateError(
      'กะแบบ SPECIFIC_DAY ต้องระบุวันที่ต้องการ (specificDays)',
      400,
      'INVALID_PAYLOAD',
      [{ code: 'INVALID_PAYLOAD', message: 'กะแบบ SPECIFIC_DAY ต้องระบุวันที่ต้องการ (specificDays)' }],
    );
  }

  // CUSTOM ต้องมีวันที่เฉพาะเจาะจง
  if (data.shiftType === 'CUSTOM' && !data.customDate) {
    throw new BulkShiftCreateError(
      'กะแบบ CUSTOM ต้องระบุวันที่ (customDate)',
      400,
      'INVALID_PAYLOAD',
      [{ code: 'INVALID_PAYLOAD', message: 'กะแบบ CUSTOM ต้องระบุวันที่ (customDate)' }],
    );
  }

  // dedup และกรอง userId ที่ไม่ valid ออก เพื่อป้องกันสร้างกะซ้ำให้คนเดียวกัน
  const normalizedUserIds = Array.from(
    new Set(
      (data.userIds ?? [])
        .map((id) => Number(id))           // แปลงเป็น number ก่อน (กันกรณีส่งมาเป็น string)
        .filter((id) => Number.isInteger(id) && id > 0), // กรอง NaN และ id ติดลบออก
    ),
  );

  // ถ้าหลัง dedup แล้วไม่มี userId เลย ให้ reject ทันที
  if (normalizedUserIds.length === 0) {
    throw new BulkShiftCreateError(
      'กรุณาระบุ userIds อย่างน้อย 1 คน',
      400,
      'INVALID_PAYLOAD',
      [{ code: 'INVALID_PAYLOAD', message: 'กรุณาระบุ userIds อย่างน้อย 1 คน' }],
    );
  }

  // ดึงข้อมูล user ทุกคนใน list พร้อมกันครั้งเดียว (1 query แทนที่จะ query ทีละคน)
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

  // แปลง array เป็น Map เพื่อ lookup O(1) แทน O(n) ตอนวน loop
  const userById = new Map<number, (typeof users)[number]>();
  users.forEach((u) => {
    userById.set(u.userId, u);
  });

  // เก็บ error ทุกตัวก่อน แล้ว throw ครั้งเดียว เพื่อให้ caller เห็นปัญหาทุก userId พร้อมกัน
  const details: BulkShiftErrorDetail[] = [];

  for (const userId of normalizedUserIds) {
    const user = userById.get(userId); // หา user จาก Map
    if (!user) {
      // userId ที่ส่งมาไม่มีในระบบ
      details.push({ userId, code: 'USER_NOT_FOUND', message: 'ไม่พบพนักงานที่ระบุ' });
      continue; // ข้ามไป userId ถัดไป
    }

    // ตรวจสิทธิ์สาขา: ADMIN สร้างกะข้ามสาขาไม่ได้
    if (!canAccessBranch(data.creatorRole, data.creatorBranchId, user.branchId || undefined)) {
      details.push({
        userId,
        code: 'FORBIDDEN_BRANCH',
        message: 'คุณไม่มีสิทธิ์สร้างกะให้พนักงานสาขาอื่น',
        userName: `${user.firstName} ${user.lastName}`.trim(), // ใส่ชื่อเพื่อให้ UI แสดงได้ชัดเจน
        employeeId: user.employeeId,
      });
    }
  }

  // ถ้ามี error ใดๆ ให้ throw ออกทั้งหมดพร้อมกัน
  if (details.length > 0) {
    const hasForbidden = details.some((d) => d.code === 'FORBIDDEN_BRANCH'); // มีปัญหาสิทธิ์ไหม
    const hasNotFound = details.some((d) => d.code === 'USER_NOT_FOUND');    // มี userId ไม่เจอไหม
    throw new BulkShiftCreateError(
      'ไม่สามารถสร้างกะแบบกลุ่มได้ เนื่องจากข้อมูลพนักงานบางรายการไม่ถูกต้อง',
      hasForbidden ? 403 : (hasNotFound ? 404 : 400), // เลือก HTTP status ตาม error ที่ร้ายแรงที่สุด
      hasForbidden ? 'FORBIDDEN_BRANCH' : (hasNotFound ? 'USER_NOT_FOUND' : 'INVALID_PAYLOAD'),
      details,
    );
  }

  // ดึง active shift ที่มีอยู่แล้วของทุกคนใน list พร้อมกัน
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

  // ถ้ามีคนที่มี active shift อยู่แล้ว และยังไม่ยืนยันการย้าย ให้ return ข้อมูล conflict กลับไปให้ UI แสดง
  if (existingActiveShifts.length > 0 && !data.replaceExisting) {
    const conflictDetails: BulkShiftErrorDetail[] = existingActiveShifts.map((shift) => {
      const user = userById.get(shift.userId); // หาชื่อ user จาก Map ที่ build ไว้แล้ว
      return {
        userId: shift.userId,
        code: 'SHIFT_CONFLICT',
        message: `พนักงานมี active shift อยู่แล้ว (${shift.name} ${shift.startTime}-${shift.endTime})`,
        userName: user ? `${user.firstName} ${user.lastName}`.trim() : undefined,
        employeeId: user?.employeeId,
        existingShift: { // ส่ง detail กะเก่ากลับไปด้วย เพื่อให้ UI แสดงข้อมูลครบ
          shiftId: shift.shiftId,
          name: shift.name,
          startTime: shift.startTime,
          endTime: shift.endTime,
        },
      };
    });

    throw new BulkShiftCreateError(
      'พนักงานบางคนมี active shift อยู่แล้ว กรุณายืนยันการย้ายกะด้วย replaceExisting=true',
      409, // 409 Conflict
      'SHIFT_CONFLICT',
      conflictDetails,
    );
  }

  // แปลง customDate จาก string เป็น Date object ถ้าจำเป็น
  const parsedCustomDate = data.customDate
    ? (typeof data.customDate === 'string' ? new Date(data.customDate) : data.customDate)
    : undefined;

  // ใช้ transaction ครอบทั้งหมด: deactivate กะเก่า + create กะใหม่ต้องสำเร็จพร้อมกัน
  const createdShifts = await prisma.$transaction(async (tx) => {
    // ถ้ามีกะเก่าและ caller ยืนยันการย้ายแล้ว ให้ soft-delete กะเก่าทุกคนก่อน
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
          deleteReason: 'แทนที่ด้วยกะใหม่ (bulk)', // บันทึกเหตุผลไว้ใน audit
        },
      });
    }

    // สร้างกะใหม่ให้แต่ละคนทีละ record (ต้องใช้ loop เพราะ Prisma ไม่มี createMany แบบ include)
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
          userId, // userId ของคนนั้นๆ
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

      records.push(created); // เก็บกะที่สร้างแล้วไว้ return
    }

    return records;
  });

  // บันทึก audit log ทุกกะพร้อมกัน (parallel) เพราะแต่ละ log ไม่ขึ้นต่อกัน
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
    createdCount: createdShifts.length, // จำนวนกะที่สร้างสำเร็จ
    shifts: createdShifts,              // ข้อมูลกะทั้งหมดที่สร้าง
  };
};

/**
 * ดึงรายการกะทั้งหมด โดย filter ตาม role ของผู้เรียก
 *
 * SQL เทียบเท่า (กรณี ADMIN):
 *   SELECT s.*, l.*, u.user_id, u.first_name, u.last_name, u.employee_id, u.role, u.branch_id,
 *          b.name AS branch_name, b.code AS branch_code
 *   FROM shifts s
 *   LEFT JOIN locations l ON s.location_id = l.location_id
 *   LEFT JOIN users u ON s.user_id = u.user_id
 *   LEFT JOIN branches b ON u.branch_id = b.branch_id
 *   WHERE s.is_deleted = false
 *     AND u.branch_id = $requesterBranchId    -- ADMIN เห็นเฉพาะสาขาตัวเอง
 *     [AND s.shift_type = $shiftType]         -- optional filter
 *     [AND s.is_active = $isActive]           -- optional filter
 *     [AND s.user_id = $userId]               -- optional filter
 *   ORDER BY s.shift_id DESC;
 *
 * SQL เทียบเท่า (กรณี USER/MANAGER):
 *   WHERE s.is_deleted = false AND s.user_id = $requesterId AND s.is_active = true
 *
 * SQL เทียบเท่า (กรณี SUPERADMIN):
 *   WHERE s.is_deleted = false [AND s.user_id = $userId]
 */
export const getShifts = async (
  requesterId: number,           // userId ของคนที่เรียก API
  requesterRole: string,         // role ของคนที่เรียก (SUPERADMIN / ADMIN / USER / MANAGER)
  requesterBranchId: number | undefined, // สาขาของ ADMIN
  filters?: {
    userId?: number;             // กรองเฉพาะ user นี้
    shiftType?: ShiftType;       // กรองตามประเภทกะ
    isActive?: boolean;          // กรองตาม active status
  },
) => {
  // เริ่มต้น where clause ด้วย shiftType filter (ถ้ามี)
  const whereClause: Prisma.ShiftWhereInput = {
    ...(filters?.shiftType && { shiftType: filters.shiftType }),
  };
  // ซ่อน soft-deleted record เสมอ (cast เพราะ Prisma type ไม่รู้จัก isDeleted จาก extension)
  (whereClause as Record<string, unknown>).isDeleted = false;

  // ถ้า caller ส่ง isActive มาชัดเจน ใช้ตามนั้น
  if (filters?.isActive !== undefined) {
    whereClause.isActive = filters.isActive;
  } else if (requesterRole === 'USER' || requesterRole === 'MANAGER') {
    // USER และ MANAGER เห็นเฉพาะกะที่ active ของตัวเอง ไม่ต้องเห็นกะเก่า
    whereClause.isActive = true;
  }

  // SUPERADMIN เห็นทุกคนทุกสาขา กรองได้เฉพาะ userId ถ้าจะเจาะคนเดียว
  if (requesterRole === 'SUPERADMIN') {
    if (filters?.userId) whereClause.userId = filters.userId;
  } else if (requesterRole === 'ADMIN') {
    // ADMIN เห็นเฉพาะกะของพนักงานในสาขาตัวเอง
    whereClause.user = { branchId: requesterBranchId };
    if (filters?.userId) whereClause.userId = filters.userId; // เจาะคนเดียวถ้าส่งมา
  } else {
    // USER / MANAGER เห็นได้แค่กะของตัวเอง หรือถ้าส่ง userId มาก็ดูคนนั้น (แต่ middleware ควรจำกัดแล้ว)
    whereClause.userId = filters?.userId ?? requesterId;
  }

  return prisma.shift.findMany({
    where: whereClause,
    include: {
      location: true, // join location มาแสดงด้วย
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
    orderBy: { shiftId: 'desc' }, // เรียงล่าสุดก่อน
  });
};

/**
 * ดึงกะ 1 รายการตาม shiftId (ไม่แสดง soft-deleted)
 *
 * SQL เทียบเท่า:
 *   SELECT s.*, l.*,
 *          u.user_id, u.first_name, u.last_name, u.employee_id, u.branch_id,
 *          b.name AS branch_name, b.code AS branch_code
 *   FROM shifts s
 *   LEFT JOIN locations l ON s.location_id = l.location_id
 *   LEFT JOIN users u ON s.user_id = u.user_id
 *   LEFT JOIN branches b ON u.branch_id = b.branch_id
 *   WHERE s.shift_id = $1 AND s.is_deleted = false
 *   LIMIT 1;
 */
export const getShiftById = async (shiftId: number) => {
  const shift = await prisma.shift.findFirst({
    where: { shiftId, isDeleted: false }, // กรอง soft-deleted ออก
    include: {
      location: true, // join location
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

  if (!shift) throw new Error('ไม่พบกะที่ระบุ'); // ไม่เจอหรือถูกลบแล้ว
  return shift;
};

/**
 * แก้ไขข้อมูลกะที่มีอยู่แล้ว (PATCH style — ส่งเฉพาะ field ที่ต้องการเปลี่ยน)
 *
 * SQL เทียบเท่า:
 *   -- 1. ดึงกะเดิมก่อน (เพื่อตรวจสิทธิ์ และเก็บ oldValues สำหรับ audit)
 *   SELECT s.*, u.branch_id
 *   FROM shifts s
 *   JOIN users u ON s.user_id = u.user_id
 *   WHERE s.shift_id = $1 AND s.is_deleted = false;
 *
 *   -- 2. ถ้ากะนี้จะ active และมีกะอื่น active อยู่ ให้ deactivate ก่อน
 *   UPDATE shifts SET is_active = false
 *   WHERE user_id = $targetUserId AND is_active = true
 *     AND is_deleted = false AND shift_id != $shiftId;
 *
 *   -- 3. update กะที่ระบุ
 *   UPDATE shifts
 *   SET
 *     name              = COALESCE($name, name),
 *     start_time        = COALESCE($startTime, start_time),
 *     end_time          = COALESCE($endTime, end_time),
 *     is_active         = COALESCE($isActive, is_active),
 *     ...                                         -- เฉพาะ field ที่ส่งมา (undefined = ไม่เปลี่ยน)
 *   WHERE shift_id = $1
 *   RETURNING shifts.*, locations.*, users.*;
 */
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

  const effectiveStartTime = data.startTime ?? existingShift.startTime;
  const effectiveEndTime = data.endTime ?? existingShift.endTime;
  if (!isEndTimeAfterStartTime(effectiveStartTime, effectiveEndTime)) {
    throw new Error('เวลาเลิกงานต้องมากกว่าเวลาเริ่มงาน (เวลาออกต้องหลังเวลาเข้า)');
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

/**
 * ลบกะ (soft-delete เท่านั้น — ไม่ลบออกจาก DB จริงๆ)
 *
 * ทำไมถึง soft-delete แทน hard delete?
 * → attendance record อ้างอิง shift_id อยู่
 *   ถ้าลบจริงจะ FK violation หรือทำให้ประวัติการเข้างานหาย
 *
 * SQL เทียบเท่า:
 *   -- 1. ตรวจสอบว่ากะยังอยู่และไม่ถูกลบไปแล้ว
 *   SELECT s.*, u.branch_id FROM shifts s
 *   JOIN users u ON s.user_id = u.user_id
 *   WHERE s.shift_id = $1 AND s.is_deleted = false;
 *
 *   -- 2. soft-delete โดย set flag แทนการลบจริง
 *   UPDATE shifts
 *   SET is_active = false, is_deleted = true, delete_reason = $deleteReason
 *   WHERE shift_id = $1
 *   RETURNING *;
 */
export const deleteShift = async (
  shiftId: number,               // ID ของกะที่จะลบ
  deletedByUserId: number,       // userId ของคนที่ลบ (สำหรับ audit log)
  deleterRole: string,           // role ของคนที่ลบ
  deleterBranchId: number | undefined, // สาขาของผู้ลบ
  deleteReason: string,          // เหตุผลการลบ (บังคับกรอก)
) => {
  // ดึงกะมาตรวจสิทธิ์ก่อน และเก็บเป็น oldValues ใน audit log
  const shift = await prisma.shift.findFirst({
    where: { shiftId, isDeleted: false }, // ถ้าลบไปแล้วก็จะหาไม่เจอ
    include: { user: { select: { branchId: true } } },
  });

  if (!shift) throw new Error('ไม่พบกะที่ระบุ');

  // ADMIN ลบกะข้ามสาขาไม่ได้
  if (!canAccessBranch(deleterRole, deleterBranchId, shift.user.branchId || undefined)) {
    throw new Error('คุณไม่มีสิทธิ์ลบกะของสาขาอื่น');
  }

  // บังคับใส่เหตุผล เพื่อให้ audit log มีความหมาย
  if (!deleteReason || deleteReason.trim().length === 0) {
    throw new Error('กรุณาระบุเหตุผลในการลบ');
  }

  // soft-delete: set isDeleted = true แทนการลบจริง เพราะ attendance record ยังอ้างอิงกะอยู่
  const deletedShift = await prisma.shift.update({
    where: { shiftId },
    data: {
      isActive: false,   // ปิดการใช้งาน
      isDeleted: true,   // mark ว่าถูกลบแล้ว
      deleteReason,      // บันทึกเหตุผล
    },
  });

  // บันทึก audit log ว่าใครลบ และก่อนลบข้อมูลเป็นอะไร
  await createAuditLog({
    userId: deletedByUserId,
    action: AuditAction.DELETE_SHIFT,
    targetTable: 'shifts',
    targetId: shiftId,
    oldValues: shift as unknown as Record<string, unknown>,
    newValues: { isActive: false, isDeleted: true, deleteReason }, // บันทึกว่า set อะไรบ้าง
  });

  return deletedShift;
};

/**
 * ดึงกะที่ใช้งานได้ของ user คนนี้ ณ วันนี้ (ใช้สำหรับ check-in)
 *
 * SQL เทียบเท่า:
 *   SELECT s.*, l.*
 *   FROM shifts s
 *   LEFT JOIN locations l ON s.location_id = l.location_id
 *   WHERE s.user_id = $userId
 *     AND s.is_active  = true
 *     AND s.is_deleted = false
 *     AND (
 *       s.shift_type = 'REGULAR'                                          -- ใช้ได้ทุกวัน
 *       OR (s.shift_type = 'SPECIFIC_DAY' AND $dayOfWeek = ANY(s.specific_days)) -- ตรงกับวันนี้
 *       OR (s.shift_type = 'CUSTOM'        AND s.custom_date = $thaiDate::date)   -- ตรงกับวันที่นี้
 *     )
 *   ORDER BY s.shift_id DESC
 *   LIMIT 1;
 */
export const getActiveShiftsForToday = async (userId: number) => {
  // หาวันในสัปดาห์ปัจจุบัน ตามเวลาไทย (ป้องกัน timezone drift ถ้า server ไม่ได้อยู่ในไทย)
  const thaiDayIndex = getThaiDayOfWeekIndex();
  const days: DayOfWeek[] = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const dayOfWeek = days[thaiDayIndex] as DayOfWeek; // เช่น 'MONDAY'
  const thaiDateOnly = getThaiDateOnly(); // เช่น '2026-04-09'

  return prisma.shift.findMany({
    where: {
      userId,
      isActive: true,
      isDeleted: false,
      // กะที่ "ใช้ได้วันนี้" มีได้ 3 แบบ:
      OR: [
        { shiftType: 'REGULAR' },           // REGULAR ใช้ได้ทุกวัน
        {
          shiftType: 'SPECIFIC_DAY',
          specificDays: {
            has: dayOfWeek,                 // SPECIFIC_DAY ใช้ได้เฉพาะวันที่ระบุไว้
          },
        },
        {
          shiftType: 'CUSTOM',
          customDate: {
            equals: new Date(thaiDateOnly), // CUSTOM ใช้ได้เฉพาะวันที่ตรงกัน
          },
        },
      ],
    },
    include: {
      location: true, // โหลด location มาด้วย เพื่อใช้ตรวจ geofence ตอน check-in
    },
    orderBy: { shiftId: 'desc' }, // เรียงล่าสุดก่อน
    take: 1, // เอาแค่ 1 กะ เพราะ business rule กำหนดว่า 1 คนมีได้แค่ 1 active shift
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
