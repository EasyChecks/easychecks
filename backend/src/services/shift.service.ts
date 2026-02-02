import { PrismaClient, ShiftType, DayOfWeek, Role } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { createAuditLog, AuditAction } from './audit.service.js';

/**
 * 📋 Shift Service - จัดการตารางงาน/กะ
 * 
 * 🔴 หมายเหตุ: ตอนนี้ยังไม่มี Auth
 * - รับ userId, role, branchId จาก parameter แทน
 * - รอเพื่อนทำ Auth เสร็จค่อยเปลี่ยน
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
// 📋 Main Functions - ฟังก์ชันหลัก
// ============================================

/**
 * ➕ สร้างกะใหม่ (Admin/SuperAdmin only)
 * 
 * Flow:
 * 1. Validate เวลา (HH:MM)
 * 2. ตรวจสอบ location (ถ้ามี)
 * 3. ตรวจสอบ shiftType และ specificDays/customDate
 * 4. ตรวจสอบสิทธิ์ตาม branch
 * 5. สร้าง shift
 * 6. บันทึก Audit Log
 */
export const createShift = async (data: CreateShiftDTO) => {
  // ===== 1. Validate เวลา =====
  if (!isValidTimeFormat(data.startTime) || !isValidTimeFormat(data.endTime)) {
    throw new Error('รูปแบบเวลาไม่ถูกต้อง (ต้องเป็น HH:MM เช่น 08:30)');
  }

  // ===== 2. ตรวจสอบ location (ถ้ามี) =====
  if (data.locationId) {
    const location = await prisma.location.findUnique({
      where: { locationId: data.locationId },
    });
    if (!location) {
      throw new Error('ไม่พบสถานที่ที่ระบุ');
    }
  }

  // ===== 3. ตรวจสอบ shiftType และ specificDays/customDate =====
  if (data.shiftType === 'SPECIFIC_DAY' && (!data.specificDays || data.specificDays.length === 0)) {
    throw new Error('กะแบบ SPECIFIC_DAY ต้องระบุวันที่ต้องการ (specificDays)');
  }
  if (data.shiftType === 'CUSTOM' && !data.customDate) {
    throw new Error('กะแบบ CUSTOM ต้องระบุวันที่ (customDate)');
  }

  // ===== 4. ตรวจสอบสิทธิ์ตาม branch =====
  // ดึงข้อมูล user ที่จะรับกะ (เพื่อเช็ค branch)
  const targetUser = await prisma.user.findUnique({
    where: { userId: data.userId },
    select: { branchId: true },
  });

  if (!targetUser) {
    throw new Error('ไม่พบพนักงานที่ระบุ');
  }

  // Admin สามารถสร้างได้เฉพาะสาขาตัวเอง
  if (!canAccessBranch(data.creatorRole, data.creatorBranchId, targetUser.branchId || undefined)) {
    throw new Error('คุณไม่มีสิทธิ์สร้างกะให้พนักงานสาขาอื่น');
  }

  // ===== 5. แปลง customDate เป็น Date object (ถ้าเป็น string) =====
  let parsedCustomDate: Date | undefined = undefined;
  if (data.customDate) {
    parsedCustomDate = typeof data.customDate === 'string' 
      ? new Date(data.customDate) 
      : data.customDate;
  }

  // ===== 6. สร้าง shift =====
  const shift = await prisma.shift.create({
    data: {
      name: data.name,
      shiftType: data.shiftType,
      startTime: data.startTime,
      endTime: data.endTime,
      gracePeriodMinutes: data.gracePeriodMinutes ?? 15, // default 15 นาที
      lateThresholdMinutes: data.lateThresholdMinutes ?? 30, // default 30 นาที
      specificDays: data.specificDays ?? [],
      customDate: parsedCustomDate ?? null,
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

  // ===== 7. บันทึก Audit Log =====
  await createAuditLog({
    userId: data.createdByUserId,
    action: AuditAction.CREATE_SHIFT,
    targetTable: 'shifts',
    targetId: shift.shiftId,
    newValues: shift,
  });

  return shift;
};

/**
 * 📋 ดึงกะ (ตาม role และ branch)
 * 
 * สิทธิ์:
 * - SuperAdmin: ดูได้ทุกกะ
 * - Admin: ดูได้เฉพาะสาขาตัวเอง
 * - User/Manager: ดูได้เฉพาะกะของตัวเอง
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
  let whereClause: any = {
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
 * 📋 ดึงกะของ user (เฉพาะตัวเอง)
 * 
 * ใช้สำหรับ User ดูกะของตัวเอง
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
 * 📋 ดึงกะทั้งหมด (Admin only) - Legacy function
 * 
 * TODO: ควรใช้ getShifts แทน
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
 * 📋 ดึงกะเฉพาะ ID
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
 * 🔄 อัปเดตกะ
 * 
 * สิทธิ์:
 * - SuperAdmin: แก้ได้ทุกกะ
 * - Admin: แก้ได้เฉพาะสาขาตัวเอง
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
  let updateData: any = { ...data };
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
 * 🗑️ ลบกะ (soft delete)
 * 
 * สิทธิ์:
 * - SuperAdmin: ลบได้ทุกกะ
 * - Admin: ลบได้เฉพาะสาขาตัวเอง
 * 
 * ต้องระบุเหตุผลในการลบ!
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
 * ใช้สำหรับแสดงกะที่ต้องเข้างานวันนี้
 * 
 * Logic:
 * - REGULAR: ใช้ได้ทุกวัน
 * - SPECIFIC_DAY: ตรวจว่าวันนี้ตรงกับ specificDays หรือไม่
 * - CUSTOM: ตรวจว่าวันนี้ตรงกับ customDate หรือไม่
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
// 📤 Export
// ============================================

export const shiftService = {
  createShift,
  getShifts,
  getShiftsByUserId,
  getAllShifts,
  getShiftById,
  updateShift,
  deleteShift,
  getActiveShiftsForToday,
};

export default shiftService;
