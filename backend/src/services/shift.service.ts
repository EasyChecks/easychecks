import { ShiftType, DayOfWeek, Prisma } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { createAuditLog, AuditAction } from './audit.service.js';

/**
 * 📋 Shift Service — บริการจัดการตารางงาน/กะ
 *
 * ทำไมต้องมี gracePeriodMinutes และ lateThresholdMinutes ต่อกะ?
 * แต่ละสาขา/ทีมมีนโยบายเวลาต่างกัน บางที่ยืดหยุ่น 30 นาที บางที่เคร่ง 0 นาที
 * การเก็บไว้ใน Shift record ทำให้เปลี่ยน policy ต่อกะได้โดยไม่ต้อง deploy ใหม่
 *
 * สิทธิ์การเข้าถึง:
 * - SuperAdmin: ดู/สร้าง/แก้/ลบ ได้ทุกสาขา
 * - Admin: ดู/สร้าง/แก้/ลบ ได้เฉพาะสาขาตัวเอง
 * - User: ดูได้เฉพาะกะของตัวเอง
 */

// ============================================
// 📦 DTOs (Data Transfer Objects) - รูปแบบข้อมูลที่รับ/ส่ง
// ============================================

export interface CreateShiftDTO {
  name: string;                    // ชื่อกะ เช่น "กะเช้า", "กะบ่าย"
  shiftType: ShiftType;            // ประเภทกะ: REGULAR, SPECIFIC_DAY, CUSTOM
  startTime: string;               // เวลาเริ่ม HH:MM
  endTime: string;                 // เวลาสิ้นสุด HH:MM
  gracePeriodMinutes?: number;     // เข้าก่อนได้กี่นาที (default: 15)
  lateThresholdMinutes?: number;   // สายเกินนี้ถือว่าขาด (default: 30)
  specificDays?: DayOfWeek[];      // วันที่ใช้กะนี้ (ถ้า SPECIFIC_DAY)
  customDate?: Date | string;      // วันที่เฉพาะ (ถ้า CUSTOM)
  locationId?: number;             // รหัสสถานที่
  userId: number;                  // พนักงานที่รับกะนี้
  createdByUserId: number;         // ผู้สร้างกะ (admin/superadmin)
  creatorRole: string;             // Role ของผู้สร้าง
  creatorBranchId?: number;        // สาขาของผู้สร้าง (ถ้าเป็น ADMIN)
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

// ============================================
// 🛠️ Helper Functions - ฟังก์ชันช่วย
// ============================================

/**
 * ✅ Validate time format (HH:MM)
 * 
 * ตัวอย่าง:
 * - "08:30" -> true
 * - "25:00" -> false
 * - "8:30" -> false
 */
function isValidTimeFormat(time: string): boolean {
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  return timeRegex.test(time);
}

/**
 * 🗓️ Convert Date to DayOfWeek enum
 * 
 * ใช้สำหรับตรวจสอบว่าวันนี้ตรงกับวันที่กำหนดใน shift หรือไม่
 */
function getDayOfWeek(date: Date): DayOfWeek {
  const days: DayOfWeek[] = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  return days[date.getDay()] as DayOfWeek;
}

/**
 * 🔐 ตรวจสอบสิทธิ์ตาม branch
 * 
 * - SuperAdmin: ทำได้ทุกสาขา
 * - Admin: ทำได้เฉพาะสาขาตัวเอง
 * 
 * @param role - Role ของผู้ขอ
 * @param requesterBranchId - สาขาของผู้ขอ
 * @param targetBranchId - สาขาเป้าหมาย
 * @returns boolean - มีสิทธิ์หรือไม่
 */
function canAccessBranch(
  role: string, 
  requesterBranchId: number | undefined, 
  targetBranchId: number | undefined
): boolean {
  // SuperAdmin เข้าถึงได้ทุกสาขา
  if (role === 'SUPERADMIN') {
    return true;
  }
  
  // Admin เข้าถึงได้เฉพาะสาขาตัวเอง
  if (role === 'ADMIN') {
    // ถ้าไม่มี branchId = เข้าถึงไม่ได้
    if (!requesterBranchId) {
      return false;
    }
    // ถ้า target ไม่มี branchId = เข้าถึงได้ (legacy data)
    if (!targetBranchId) {
      return true;
    }
    // เช็คว่าเป็นสาขาเดียวกัน
    return requesterBranchId === targetBranchId;
  }
  
  // Role อื่นๆ ไม่มีสิทธิ์
  return false;
}

// ============================================
// 📋 Main Functions — ฟังก์ชันหลัก
// ============================================

/**
 * ➕ สร้างกะใหม่ (Admin/SuperAdmin only)
 *
 * ทำไม flow ถึงตรวจสอบสิทธิ์ branch ก่อน INSERT?
 * ป้องกัน Admin สาขา A สร้างกะให้พนักงานสาขา B โดยบังเอิญหรือจงใจ
 *
 * ทำไม gracePeriodMinutes / lateThresholdMinutes เก็บต่อกะ?
 * แต่ละกะมี policy เวลาต่างกัน (กะเช้าเข้มงวดกว่ากะบ่าย)
 * frontend ส่ง config มาตอนสร้าง → บันทึกไว้ใน Shift → attendance.service อ่านใช้
 *
 * SQL เทียบเท่า:
 * -- ตรวจสอบ location
 * SELECT 1 FROM "Location" WHERE "locationId"=$1
 *
 * -- ตรวจสอบสิทธิ์ branch
 * SELECT "branchId" FROM "User" WHERE "userId"=$1  -- target user
 *
 * -- สร้างกะ
 * INSERT INTO "Shift" ("name","shiftType","startTime","endTime",
 *   "gracePeriodMinutes","lateThresholdMinutes","specificDays",
 *   "customDate","locationId","userId","createdByUserId")
 * VALUES (...)
 * RETURNING *
 */
export const createShift = async (data: CreateShiftDTO) => {
  // ===== 1. Validate เวลา =====
  // "08:00" ผ่าน, "8:0" หรือ "25:00" ไม่ผ่าน → ป้องกัน string แปลก ๆ เข้า DB
  if (!isValidTimeFormat(data.startTime) || !isValidTimeFormat(data.endTime)) {
    throw new Error('รูปแบบเวลาไม่ถูกต้อง (ต้องเป็น HH:MM เช่น 08:30)');
  }

  // ===== 2. ตรวจสอบ location (ถ้ามี) =====
  // SQL: SELECT 1 FROM "Location" WHERE "locationId"=$1
  if (data.locationId) {
    const location = await prisma.location.findUnique({
      where: { locationId: data.locationId },
    });
    if (!location) {
      throw new Error('ไม่พบสถานที่ที่ระบุ'); // locationId ถูกลบหรือไม่มีจริง
    }
  }

  // ===== 3. ตรวจสอบ shiftType และ specificDays/customDate =====
  // SPECIFIC_DAY ต้องมีวันที่ระบุ เช่น ["MONDAY","FRIDAY"]
  if (data.shiftType === 'SPECIFIC_DAY' && (!data.specificDays || data.specificDays.length === 0)) {
    throw new Error('กะแบบ SPECIFIC_DAY ต้องระบุวันที่ต้องการ (specificDays)');
  }
  // CUSTOM ต้องระบุวันที่เจาะจง เช่น "2025-12-31"
  if (data.shiftType === 'CUSTOM' && !data.customDate) {
    throw new Error('กะแบบ CUSTOM ต้องระบุวันที่ (customDate)');
  }

  // ===== 4. ตรวจสอบสิทธิ์ตาม branch =====
  // SQL: SELECT "branchId" FROM "User" WHERE "userId"=$1
  const targetUser = await prisma.user.findUnique({
    where: { userId: data.userId },      // พนักงานที่จะรับกะ
    select: { branchId: true },          // ต้องการแค่ branchId สำหรับตรวจสิทธิ์
  });

  if (!targetUser) {
    throw new Error('ไม่พบพนักงานที่ระบุ'); // userId ไม่มีในระบบ
  }

  // Admin สร้างกะได้เฉพาะสาขาตัวเอง, SuperAdmin ไม่มีข้อจำกัด
  if (!canAccessBranch(data.creatorRole, data.creatorBranchId, targetUser.branchId || undefined)) {
    throw new Error('คุณไม่มีสิทธิ์สร้างกะให้พนักงานสาขาอื่น');
  }

  // ===== 5. แปลง customDate เป็น Date object (ถ้าเป็น string) =====
  // Prisma ต้องการ Date ไม่ใช่ string → แปลงก่อน INSERT
  let parsedCustomDate: Date | undefined = undefined;
  if (data.customDate) {
    parsedCustomDate = typeof data.customDate === 'string'
      ? new Date(data.customDate)   // "2025-12-31" → Date object
      : data.customDate;            // ส่งมาเป็น Date แล้ว ใช้ได้เลย
  }

  // ===== 6. สร้าง shift =====
  // SQL: INSERT INTO "Shift" (...) VALUES (...) RETURNING *
  const shift = await prisma.shift.create({
    data: {
      name: data.name,
      shiftType: data.shiftType,           // REGULAR / SPECIFIC_DAY / CUSTOM
      startTime: data.startTime,           // "HH:MM"
      endTime: data.endTime,               // "HH:MM"
      gracePeriodMinutes: data.gracePeriodMinutes ?? 15,   // default 15 นาที (ถ้าไม่ส่งมา)
      lateThresholdMinutes: data.lateThresholdMinutes ?? 30, // default 30 นาที (ถ้าไม่ส่งมา)
      specificDays: data.specificDays ?? [],       // [] สำหรับ REGULAR
      customDate: parsedCustomDate ?? null,        // null สำหรับ REGULAR/SPECIFIC_DAY
      locationId: data.locationId ?? null,         // null = ไม่ตรวจ GPS
      userId: data.userId,                         // พนักงานเจ้าของกะ
      createdByUserId: data.createdByUserId,       // Admin/SuperAdmin ที่กดสร้าง
    },
    include: {
      // include ทันทีเพื่อให้ response มีข้อมูลครบสำหรับ frontend + WebSocket broadcast
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

  // ===== 7. บันทึก Audit Log =====
  // บันทึกว่าใครสร้างกะอะไร เมื่อไหร่ → ใช้ tracking ย้อนหลัง
  await createAuditLog({
    userId: data.createdByUserId,        // ผู้กระทำ (Admin/SuperAdmin)
    action: AuditAction.CREATE_SHIFT,
    targetTable: 'shifts',
    targetId: shift.shiftId,            // id ที่ Postgres ออกให้หลัง INSERT
    newValues: shift,                   // snapshot ทั้ง record
  });

  return shift; // ส่งกลับ controller → WebSocket broadcast + HTTP response
};

/**
 * 📋 ดึงกะ (ตาม role และ branch)
 *
 * ทำไม getShifts ถึงรับ role มาเป็น param แทนแยก 3 ฟังก์ชัน?
 * เพราะ logic WHERE condition ต่างกันตาม role แต่ return type และ include เหมือนกัน
 * รวมไว้ฟังก์ชันเดียวลด duplication และ test ได้ครอบคลุมกว่า
 *
 * SQL เทียบเท่า:
 * -- SuperAdmin
 * SELECT * FROM "Shift" s JOIN "User" u ON s."userId"=u."userId" WHERE (filters)
 *
 * -- Admin
 * SELECT * FROM "Shift" s JOIN "User" u ON s."userId"=u."userId"
 *   WHERE u."branchId" = $requesterBranchId AND (filters)
 *
 * -- User
 * SELECT * FROM "Shift" WHERE "userId" = $requesterId AND "isActive" = true
 */
export const getShifts = async (
  requesterId: number,
  requesterRole: string,
  requesterBranchId: number | undefined,
  filters?: {
    userId?: number;
    shiftType?: ShiftType;
    isActive?: boolean;
  }
) => {
  // กำหนด where clause ตาม role
  let whereClause: Prisma.ShiftWhereInput = {
    ...(filters?.shiftType && { shiftType: filters.shiftType }),
  };

  // เพิ่ม isActive filter (default: true สำหรับ USER)
  if (filters?.isActive !== undefined) {
    whereClause.isActive = filters.isActive;
  } else if (requesterRole === 'USER' || requesterRole === 'MANAGER') {
    whereClause.isActive = true; // User เห็นเฉพาะกะที่ active
  }

  // กรองตาม role และ branch
  if (requesterRole === 'SUPERADMIN') {
    // SuperAdmin ดูได้ทุกกะ - ไม่ต้องกรองเพิ่ม
    if (filters?.userId) {
      whereClause.userId = filters.userId;
    }
  } else if (requesterRole === 'ADMIN') {
    // Admin ดูได้เฉพาะสาขาตัวเอง
    if (!whereClause.OR) {
      whereClause.OR = [];
    }
    whereClause.OR.push({
      user: {
        branchId: requesterBranchId,
      },
    });
    if (filters?.userId) {
      whereClause.userId = filters.userId;
    }
  } else {
    // User/Manager ดูได้เฉพาะกะของตัวเอง
    whereClause.userId = filters?.userId ?? requesterId;
  }

  const shifts = await prisma.shift.findMany({
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

  return shifts;
};

/**
 * 📋 ดึงกะเฉพาะ ID
 *
 * ทำไมต้อง include creator, updatedBy, deletedBy ด้วย?
 * หน้า Admin ต้องแสดงว่า "ใครสร้าง/แก้ไข/ลบ" เพื่อความโปร่งใส
 *
 * SQL: SELECT s.*, l.*, u."firstName", cr."firstName", ub."firstName", db."firstName"
 *   FROM "Shift" s
 *   LEFT JOIN "Location" l ON s."locationId" = l."locationId"
 *   JOIN "User" u ON s."userId" = u."userId"
 *   LEFT JOIN "User" cr ON s."createdByUserId" = cr."userId"
 *   LEFT JOIN "User" ub ON s."updatedByUserId" = ub."userId"
 *   LEFT JOIN "User" db ON s."deletedByUserId" = db."userId"
 *   WHERE s."shiftId" = $1
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

  if (!shift) {
    throw new Error('ไม่พบกะที่ระบุ');
  }

  return shift;
};

/**
 * 🔄 อัปเดตกะ (Admin/SuperAdmin only)
 *
 * ทำไม frontend ส่ง gracePeriodMinutes / lateThresholdMinutes มาได้ตอน update?
 * Admin ต้องการปรับ policy หลังสร้างกะไปแล้ว โดยไม่ต้องลบและสร้างใหม่
 *
 * SQL: SELECT s.*, u."branchId" FROM "Shift" s JOIN "User" u ... WHERE s."shiftId"=$1
 *      UPDATE "Shift" SET ... WHERE "shiftId"=$1 RETURNING *
 */
export const updateShift = async (
  shiftId: number, 
  updatedByUserId: number, 
  updaterRole: string,
  updaterBranchId: number | undefined,
  data: UpdateShiftDTO
) => {
  // ===== 1. ตรวจสอบว่ามีกะนี้อยู่จริง =====
  const existingShift = await prisma.shift.findUnique({
    where: { shiftId },
    include: {
      user: {
        select: { branchId: true },
      },
    },
  });

  if (!existingShift) {
    throw new Error('ไม่พบกะที่ระบุ');
  }

  // ===== 2. ตรวจสอบสิทธิ์ตาม branch =====
  if (!canAccessBranch(updaterRole, updaterBranchId, existingShift.user.branchId || undefined)) {
    throw new Error('คุณไม่มีสิทธิ์แก้ไขกะของสาขาอื่น');
  }

  // ===== 3. Validate เวลา (ถ้ามีการเปลี่ยน) =====
  if (data.startTime && !isValidTimeFormat(data.startTime)) {
    throw new Error('รูปแบบเวลาเริ่มต้นไม่ถูกต้อง (ต้องเป็น HH:MM)');
  }
  if (data.endTime && !isValidTimeFormat(data.endTime)) {
    throw new Error('รูปแบบเวลาสิ้นสุดไม่ถูกต้อง (ต้องเป็น HH:MM)');
  }

  // ===== 4. แปลง customDate (ถ้ามี) =====
  let updateData: Prisma.ShiftUpdateInput = { ...data };
  if (data.customDate) {
    updateData.customDate = typeof data.customDate === 'string' 
      ? new Date(data.customDate) 
      : data.customDate;
  }

  // ===== 5. อัพเดต shift =====
  const updatedShift = await prisma.shift.update({
    where: { shiftId },
    data: {
      ...updateData,
      updatedByUserId,
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
      updatedBy: {
        select: {
          userId: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  // ===== 6. บันทึก Audit Log =====
  await createAuditLog({
    userId: updatedByUserId,
    action: AuditAction.UPDATE_SHIFT,
    targetTable: 'shifts',
    targetId: shiftId,
    oldValues: existingShift,
    newValues: updatedShift,
  });

  return updatedShift;
};

/**
 * 🗑️ ลบกะ — Soft Delete (Admin/SuperAdmin only)
 *
 * ทำไมใช้ Soft Delete (isActive=false) แทนการลบจริง?
 * - กะที่ผูกกับ Attendance ที่บันทึกไปแล้วจะ orphan ถ้าลบจริง
 * - ต้อง audit trail ว่าใครลบเมื่อไหร่ด้วยเหตุผลอะไร
 * - ถ้าลบผิดสามารถ reactivate ได้
 *
 * ต้องระบุเหตุผลในการลบเสมอ → บังคับ accountability
 *
 * SQL: UPDATE "Shift"
 *   SET "isActive"=false, "deletedAt"=NOW(),
 *       "deletedByUserId"=$2, "deleteReason"=$3
 *   WHERE "shiftId"=$1
 */
export const deleteShift = async (
  shiftId: number,
  deletedByUserId: number,
  deleterRole: string,
  deleterBranchId: number | undefined,
  deleteReason: string
) => {
  // ===== 1. ตรวจสอบว่ามีกะนี้อยู่จริง =====
  const shift = await prisma.shift.findUnique({
    where: { shiftId },
    include: {
      user: {
        select: { branchId: true },
      },
    },
  });

  if (!shift) {
    throw new Error('ไม่พบกะที่ระบุ');
  }

  // ===== 2. ตรวจสอบสิทธิ์ตาม branch =====
  if (!canAccessBranch(deleterRole, deleterBranchId, shift.user.branchId || undefined)) {
    throw new Error('คุณไม่มีสิทธิ์ลบกะของสาขาอื่น');
  }

  // ===== 3. ตรวจสอบเหตุผล =====
  if (!deleteReason || deleteReason.trim().length === 0) {
    throw new Error('กรุณาระบุเหตุผลในการลบ');
  }

  // ===== 4. Soft delete =====
  // เปลี่ยน isActive เป็น false และบันทึกข้อมูลการลบ
  const deletedShift = await prisma.shift.update({
    where: { shiftId },
    data: { 
      isActive: false,
      deletedAt: new Date(),
      deletedByUserId,
      deleteReason,
    },
  });

  // ===== 5. บันทึก Audit Log =====
  await createAuditLog({
    userId: deletedByUserId,
    action: AuditAction.DELETE_SHIFT,
    targetTable: 'shifts',
    targetId: shiftId,
    oldValues: shift,
    newValues: { isActive: false, deleteReason, deletedAt: deletedShift.deletedAt },
  });

  return deletedShift;
};

/**
 * 📋 ดึงกะที่ใช้งานได้ในวันนี้ของ user
 *
 * ทำไมต้อง filter ตาม shiftType แยก 3 แบบ?
 * - REGULAR: กะประจำ ใช้ได้ทุกวันโดยไม่ต้องตรวจวันที่
 * - SPECIFIC_DAY: กะเฉพาะวัน เช่น จันทร์-ศุกร์ → ตรวจ specificDays[] ว่าตรงหรือเปล่า
 * - CUSTOM: กะวันเดียว เช่น ทำงานแทน → ตรวจว่า customDate ตรงกับวันนี้
 *
 * หน้า check-in ของ frontend เรียก endpoint นี้ก่อน แล้วแสดงรายการกะให้เลือก
 *
 * SQL: SELECT * FROM "Shift"
 *   WHERE "userId"=$1 AND "isActive"=true
 *   AND (
 *     "shiftType"='REGULAR' OR
 *     ("shiftType"='SPECIFIC_DAY' AND $dayOfWeek = ANY("specificDays")) OR
 *     ("shiftType"='CUSTOM' AND "customDate"::date = TODAY)
 *   )
 */
export const getActiveShiftsForToday = async (userId: number) => {
  const today = new Date();
  const dayOfWeek = getDayOfWeek(today);

  const shifts = await prisma.shift.findMany({
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
            equals: new Date(today.toISOString().split('T')[0] ?? ''),
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

// ============================================
// ============================================
// 📤 Export
// ============================================

export const shiftService = {
  createShift,
  getShifts,
  getShiftById,
  updateShift,
  deleteShift,
  getActiveShiftsForToday,
};

export default shiftService;
