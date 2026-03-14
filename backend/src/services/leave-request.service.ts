import { prisma } from '../lib/prisma.js';
import type { LeaveRequest, LeaveStatus, LeaveType, Gender, ApprovalActionType } from '@prisma/client';
import { differenceInBusinessDays, parseISO, format, isWeekend, startOfYear, endOfYear } from 'date-fns';
import { createAuditLog, AuditAction } from './audit.service.js';
import { BadRequestError, ConflictError, NotFoundError } from '../utils/custom-errors.js';

/**
 * Leave Request Service - จัดการใบลา
 * ใช้ date-fns สำหรับจัดการวันที่
 */

// กำหนดกฎการลาแต่ละประเภท
export const LEAVE_RULES = {
  SICK: { 
    maxPaidDaysPerYear: 30, 
    requireMedicalCert: 3, // ต้องมีใบรับรองแพทย์เมื่อลา >= 3 วัน
    paid: true,
    genderRestriction: null 
  },
  PERSONAL: { 
    maxPaidDaysPerYear: null, // ไม่จำกัด แต่ตามข้อบังคับบริษัท
    requireMedicalCert: null,
    paid: false, // หรือตามข้อบังคับบริษัท
    genderRestriction: null 
  },
  VACATION: { 
    maxPaidDaysPerYear: 6, // 6 วันต่อปี (ทำงานครบ 1 ปี)
    requireMedicalCert: null,
    paid: true,
    carryOver: true, // สะสมได้
    genderRestriction: null 
  },
  MILITARY: { 
    maxPaidDaysPerYear: 60,
    requireMedicalCert: null,
    paid: true,
    genderRestriction: 'MALE' as Gender // เฉพาะชาย
  },
  TRAINING: { 
    maxPaidDaysPerYear: null,
    requireMedicalCert: null,
    paid: false, // ไม่ได้รับค่าจ้าง
    genderRestriction: null 
  },
  MATERNITY: { 
    maxDaysTotal: 90, // ไม่เกิน 90 วัน
    maxPaidDaysPerYear: 45, // ได้รับค่าจ้างไม่เกิน 45 วัน
    requireMedicalCert: true, // ต้องมีใบรับรองแพทย์
    paid: true,
    genderRestriction: 'FEMALE' as Gender // เฉพาะหญิง
  },
  STERILIZATION: { 
    maxPaidDaysPerYear: null, // ตามที่แพทย์กำหนด
    requireMedicalCert: true, // ต้องมีใบรับรองแพทย์
    paid: true,
    genderRestriction: null // ทั้งสองเพศ
  },
  ORDINATION: { 
    maxDaysTotal: 120,
    requireMedicalCert: null,
    paid: false, // ตามข้อบังคับบริษัท (เบื้องต้นไม่จ่าย)
    genderRestriction: 'MALE' as Gender // เฉพาะชาย (เบื้องต้น)
  },
} as const;

export interface CreateLeaveRequestDTO {
  userId: number;
  leaveType: LeaveType;
  isHourly?: boolean;
  startDate: Date;
  endDate: Date;
  startTime?: string;
  endTime?: string;
  leaveHours?: number;
  reason?: string;
  attachmentUrl?: string;
  medicalCertificateUrl?: string; // ใบรับรองแพทย์
}

export interface UpdateLeaveRequestDTO {
  leaveType?: LeaveType;
  isHourly?: boolean;
  startDate?: Date;
  endDate?: Date;
  startTime?: string;
  endTime?: string;
  leaveHours?: number;
  reason?: string;
  attachmentUrl?: string;
  medicalCertificateUrl?: string;
}

function isValidTimeFormat(time: string): boolean {
  return /^([01]\d|2[0-3]):([0-5]\d)$/.test(time);
}

function calculateLeaveHours(startTime: string, endTime: string): number {
  const [startHour, startMinute] = startTime.split(':').map(Number);
  const [endHour, endMinute] = endTime.split(':').map(Number);
  const startTotal = (startHour ?? 0) * 60 + (startMinute ?? 0);
  const endTotal = (endHour ?? 0) * 60 + (endMinute ?? 0);
  const diffMinutes = endTotal - startTotal;

  if (diffMinutes <= 0) {
    throw new BadRequestError('เวลาเริ่มต้องน้อยกว่าเวลาสิ้นสุดสำหรับการลาเป็นชั่วโมง');
  }

  return Number((diffMinutes / 60).toFixed(2));
}

export interface ApproveLeaveRequestDTO {
  approvedByUserId: number;
  adminComment?: string;
}

export interface RejectLeaveRequestDTO {
  approvedByUserId: number;
  rejectionReason: string;
}

interface LeaveApproverSummary {
  userId: number;
  firstName: string;
  lastName: string;
  employeeId?: string;
  email?: string;
  role?: string;
  gender?: Gender;
}

type LeaveRequestWithApprover = LeaveRequest & {
  approvedByUserId: number | null;
  approver: LeaveApproverSummary | null;
};

type LeaveApprovalActionRow = {
  leaveId: number;
  actorUserId: number;
  action: ApprovalActionType;
  adminComment: string | null;
  rejectionReason: string | null;
  actor: {
    userId: number;
    firstName: string;
    lastName: string;
    employeeId: string;
    email: string;
    role: string;
    gender: Gender;
  };
};

async function getLatestLeaveApprovalMap(leaveIds: number[]): Promise<Map<number, LeaveApprovalActionRow>> {
  if (leaveIds.length === 0) {
    return new Map();
  }

  const actions = await prisma.approvalAction.findMany({
    where: {
      leaveId: { in: leaveIds },
    },
    orderBy: [
      { approvalActionId: 'desc' },
    ],
    select: {
      leaveId: true,
      actorUserId: true,
      action: true,
      adminComment: true,
      rejectionReason: true,
      actor: {
        select: {
          userId: true,
          firstName: true,
          lastName: true,
          employeeId: true,
          email: true,
          role: true,
          gender: true,
        },
      },
    },
  });

  const latestMap = new Map<number, LeaveApprovalActionRow>();
  for (const action of actions) {
    if (action.leaveId && !latestMap.has(action.leaveId)) {
      latestMap.set(action.leaveId, action as LeaveApprovalActionRow);
    }
  }

  return latestMap;
}

function attachLeaveApprover<T extends LeaveRequest>(
  requests: T[],
  latestMap: Map<number, LeaveApprovalActionRow>
): LeaveRequestWithApprover[] {
  return requests.map((request) => {
    const latest = latestMap.get(request.leaveId);
    const approver = latest
      ? {
          userId: latest.actor.userId,
          firstName: latest.actor.firstName,
          lastName: latest.actor.lastName,
          employeeId: latest.actor.employeeId,
          email: latest.actor.email,
          role: latest.actor.role,
          gender: latest.actor.gender,
        }
      : null;

    return {
      ...request,
      approvedByUserId: latest?.actorUserId ?? null,
      approver,
      adminComment: request.adminComment ?? latest?.adminComment ?? null,
      rejectionReason: request.rejectionReason ?? latest?.rejectionReason ?? null,
    };
  });
}

/**
 * ฟังก์ชันคำนวณจำนวนวันทำงาน (ไม่นับเสาร์-อาทิตย์)
 * 
 * เป้าหมาย: หาวันทำงานจริง (ไม่รวมวันหยุด)เพื่อคำนวณวันลาที่ใช้
 * 
 * เหตุผล: +1 เพราะวันเริ่มต้นนับด้วย (ถ้าลา 1 วันต้องนับวันเริ่มต้น)
 */
function calculateBusinessDays(startDate: Date, endDate: Date): number {
  const days = differenceInBusinessDays(endDate, startDate) + 1; // +1 เพราะนับวันเริ่มต้นด้วย
  return days > 0 ? days : 0;
}

/**
 * ฟังก์ชันคำนวณวันที่ได้รับค่าจ้างตามประเภทการลา
 * 
 * เป้าหมาย: คำนวณว่าวันลาที่ขอได้รับค่าจ้างกี่วัน (ตามกฎของแต่ละประเภท)
 * 
 * เหตุผล: แต่ละประเภทลามีกฎต่างกัน (SICK: 30 วัน, VACATION: 6 วัน, ฯลฯ)
 *            บางประเภทไม่ได้รับค่าจ้างเลย (PERSONAL, TRAINING)
 */
function calculatePaidDays(leaveType: LeaveType, numberOfDays: number): number {
  const rules = LEAVE_RULES[leaveType];
  
  if (!rules.paid) {
    return 0; // ไม่ได้รับค่าจ้าง
  }

  // ถ้ามีข้อจำกัดวันที่ได้รับค่าจ้าง
  if (rules.maxPaidDaysPerYear !== null && rules.maxPaidDaysPerYear !== undefined) {
    return Math.min(numberOfDays, rules.maxPaidDaysPerYear);
  }

  return numberOfDays; // ได้รับค่าจ้างทุกวัน
}

/**
 * ตรวจสอบจำนวนวันลาที่ใช้ไปในปีนี้ (ตามประเภท)
 * 
 * เป้าหมาย: นับจำนวนวันลาที่ APPROVED ในปีนี้ตามประเภท
 * 
 * เหตุผล: เพื่อตรวจสอบว่าความเหลือ (quota) ก่อนอนุมัติใบลาใหม่
 *            กรองเฉพาะ APPROVED และไม่ถูก soft delete
 *            กรองวันที่ในปีปัจจุบัน (startOfYear - endOfYear)
 * 
 * SQL: SELECT SUM(numberOfDays) FROM LeaveRequest
 *      WHERE userId = ? AND leaveType = ? AND status = 'APPROVED' 
 *      AND deletedAt IS NULL AND startDate BETWEEN ? AND ?
 */
async function getUsedLeaveDaysThisYear(userId: number, leaveType: LeaveType): Promise<number> {
  const yearStart = startOfYear(new Date());
  const yearEnd = endOfYear(new Date());

  const leaves = await prisma.leaveRequest.findMany({
    where: {
      userId,
      leaveType,
      status: 'APPROVED',
      startDate: {
        gte: yearStart,
        lte: yearEnd,
      },
    },
    select: {
      numberOfDays: true,
    },
  });

  return leaves.reduce((sum: number, leave: any) => sum + leave.numberOfDays, 0);
}

/**
 * ตรวจสอบจำนวนวันลาที่ได้รับค่าจ้างในปีนี้
 */
async function getUsedPaidLeaveDaysThisYear(userId: number, leaveType: LeaveType): Promise<number> {
  const yearStart = startOfYear(new Date());
  const yearEnd = endOfYear(new Date());

  const leaves = await prisma.leaveRequest.findMany({
    where: {
      userId,
      leaveType,
      status: 'APPROVED',
      startDate: {
        gte: yearStart,
        lte: yearEnd,
      },
    },
    select: {
      paidDays: true,
    },
  });

  return leaves.reduce((sum: number, leave: any) => sum + (leave.paidDays || 0), 0);
}

/**
 * ดูสถิติการลาแต่ละประเภทของผู้ใช้
 */
async function getLeaveQuota(userId: number): Promise<any> {
  const quotas = await Promise.all(
    Object.keys(LEAVE_RULES).map(async (leaveType) => {
      const type = leaveType as LeaveType;
      const rules = LEAVE_RULES[type];
      const usedDays = await getUsedLeaveDaysThisYear(userId, type);
      const usedPaidDays = await getUsedPaidLeaveDaysThisYear(userId, type);

      // Get maxPaidDaysPerYear safely (some types have it, some don't)
      const maxPaid = 'maxPaidDaysPerYear' in rules ? rules.maxPaidDaysPerYear : null;
      const maxTotal = 'maxDaysTotal' in rules ? rules.maxDaysTotal : null;

      return {
        leaveType: type,
        usedDays,
        usedPaidDays,
        maxPaidDaysPerYear: maxPaid,
        maxDaysTotal: maxTotal,
        remainingPaidDays: maxPaid 
          ? Math.max(0, maxPaid - usedPaidDays)
          : null,
        isPaid: rules.paid,
        requireMedicalCert: rules.requireMedicalCert || false,
        genderRestriction: rules.genderRestriction || null,
      };
    })
  );

  return quotas;
}

/**
 * Validate leave request based on leave type rules
 */
async function validateLeaveRequest(
  userId: number,
  leaveType: LeaveType,
  numberOfDays: number,
  medicalCertificateUrl?: string
): Promise<{ isValid: boolean; message?: string }> {
  const rules = LEAVE_RULES[leaveType];

  // ตรวจสอบข้อมูลผู้ใช้
  const user = await prisma.user.findUnique({
    where: { userId },
    select: { gender: true },
  });

  if (!user) {
    return { isValid: false, message: 'ไม่พบผู้ใช้' };
  }

  // ตรวจสอบเพศ
  if (rules.genderRestriction && user.gender !== rules.genderRestriction) {
    const genderText = rules.genderRestriction === 'MALE' ? 'ชาย' : 'หญิง';
    return { 
      isValid: false, 
      message: `การลาประเภท ${leaveType} สามารถใช้ได้เฉพาะเพศ${genderText}เท่านั้น` 
    };
  }

  // ตรวจสอบใบรับรองแพทย์
  if (rules.requireMedicalCert) {
    if (typeof rules.requireMedicalCert === 'number') {
      // ต้องมีใบรับรองแพทย์เมื่อลา >= จำนวนวันที่กำหนด
      if (numberOfDays >= rules.requireMedicalCert && !medicalCertificateUrl) {
        return { 
          isValid: false, 
          message: `การลาป่วย ${rules.requireMedicalCert} วันขึ้นไป ต้องแนบใบรับรองแพทย์` 
        };
      }
    } else if (rules.requireMedicalCert === true && !medicalCertificateUrl) {
      return { 
        isValid: false, 
        message: `การลาประเภท ${leaveType} ต้องแนบใบรับรองแพทย์` 
      };
    }
  }

  // ตรวจสอบจำนวนวันสูงสุดต่อครั้ง
  if ('maxDaysTotal' in rules && rules.maxDaysTotal) {
    if (numberOfDays > rules.maxDaysTotal) {
      return { 
        isValid: false, 
        message: `การลาประเภท ${leaveType} ลาได้ไม่เกิน ${rules.maxDaysTotal} วันต่อครั้ง` 
      };
    }
  }

  // ตรวจสอบจำนวนวันที่ใช้ไปในปีนี้ (สำหรับประเภทที่มี maxPaidDaysPerYear)
  if ('maxPaidDaysPerYear' in rules && rules.maxPaidDaysPerYear) {
    const usedPaidDays = await getUsedPaidLeaveDaysThisYear(userId, leaveType);
    const paidDays = calculatePaidDays(leaveType, numberOfDays);
    
    if (usedPaidDays + paidDays > rules.maxPaidDaysPerYear) {
      return { 
        isValid: false, 
        message: `คุณใช้วันลา${leaveType}ที่ได้รับค่าจ้างไปแล้ว ${usedPaidDays} วัน (สูงสุด ${rules.maxPaidDaysPerYear} วันต่อปี)` 
      };
    }
  }

  return { isValid: true };
}

// ========================================================================================
// USER ACTIONS - การดำเนินการของพนักงานทั่วไป
// ========================================================================================

/**
 * สร้างใบลาใหม่
 */
async function createLeaveRequest(
  data: CreateLeaveRequestDTO
): Promise<LeaveRequestWithApprover> {
  // Validate dates
  const startDate = new Date(data.startDate);
  const endDate = new Date(data.endDate);

  if (startDate > endDate) {
    throw new BadRequestError('วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด');
  }

  // Check if user exists
  const user = await prisma.user.findUnique({
    where: { userId: data.userId },
    select: { userId: true, gender: true },
  });

  if (!user) {
    throw new NotFoundError('ไม่พบผู้ใช้');
  }

  const isHourly = data.isHourly === true;

  if (isHourly) {
    if (!data.startTime || !data.endTime) {
      throw new BadRequestError('การลาเป็นชั่วโมงต้องระบุ startTime และ endTime');
    }
    if (!isValidTimeFormat(data.startTime) || !isValidTimeFormat(data.endTime)) {
      throw new BadRequestError('รูปแบบเวลาไม่ถูกต้อง (ต้องเป็น HH:MM)');
    }
    const startDateOnly = startDate.toISOString().slice(0, 10);
    const endDateOnly = endDate.toISOString().slice(0, 10);
    if (startDateOnly !== endDateOnly) {
      throw new BadRequestError('การลาเป็นชั่วโมงต้องอยู่ภายในวันเดียวกัน');
    }
  }

  // Calculate number of business days
  const numberOfDays = isHourly ? 0 : calculateBusinessDays(startDate, endDate);

  const leaveHours = isHourly
    ? (data.leaveHours && data.leaveHours > 0
      ? data.leaveHours
      : calculateLeaveHours(data.startTime as string, data.endTime as string))
    : null;

  if (!isHourly && numberOfDays <= 0) {
    throw new BadRequestError('ต้องเลือกช่วงวันที่อย่างน้อย 1 วันทำงาน');
  }

  // Validate leave request based on type
  const validation = await validateLeaveRequest(
    data.userId,
    data.leaveType,
    numberOfDays,
    data.medicalCertificateUrl
  );

  if (!validation.isValid) {
    throw new BadRequestError(validation.message || 'ข้อมูลการลาไม่ถูกต้อง');
  }

  // Check for overlapping leave requests
  const overlappingLeave = await prisma.leaveRequest.findFirst({
    where: {
      userId: data.userId,
      status: { not: 'REJECTED' },
      AND: [
        { startDate: { lte: endDate } },
        { endDate: { gte: startDate } },
      ],
    },
  });

  if (overlappingLeave) {
    throw new ConflictError('มีใบลาที่ทับซ้อนกับช่วงวันที่นี้');
  }

  // Calculate paid days
  const paidDays = isHourly ? 0 : calculatePaidDays(data.leaveType, numberOfDays);

  const newLeaveRequest = await prisma.leaveRequest.create({
    data: {
      userId: data.userId,
      leaveType: data.leaveType,
      isHourly,
      startDate,
      endDate,
      startTime: isHourly ? data.startTime ?? null : null,
      endTime: isHourly ? data.endTime ?? null : null,
      leaveHours,
      reason: data.reason,
      attachmentUrl: data.attachmentUrl,
      medicalCertificateUrl: data.medicalCertificateUrl,
      numberOfDays: numberOfDays,
      paidDays: paidDays,
      status: 'PENDING',
    },
    include: {
      user: {
        select: {
          userId: true,
          employeeId: true,
          firstName: true,
          lastName: true,
          gender: true,
        },
      },
    },
  });

  const latestMap = await getLatestLeaveApprovalMap([newLeaveRequest.leaveId]);
  const [enriched] = attachLeaveApprover([newLeaveRequest], latestMap);

  await createAuditLog({
    userId: data.userId,
    action: AuditAction.CREATE_LEAVE,
    targetTable: 'leave_requests',
    targetId: newLeaveRequest.leaveId,
    newValues: {
      leaveType: data.leaveType,
      isHourly,
      startDate,
      endDate,
      startTime: isHourly ? data.startTime ?? null : null,
      endTime: isHourly ? data.endTime ?? null : null,
      leaveHours,
      numberOfDays,
      paidDays,
      reason: data.reason,
    },
  });

  return enriched;
}

/**
 * ดึงใบลาของผู้ใช้เอง
 */
async function getLeaveRequestsByUser(
  userId: number,
  status?: LeaveStatus,
  skip?: number,
  take?: number
): Promise<{ data: LeaveRequestWithApprover[]; total: number }> {
  const where: any = { userId };

  if (status) {
    where.status = status;
  }

  const [data, total] = await Promise.all([
    prisma.leaveRequest.findMany({
      where,
      skip: skip || 0,
      take: take || 10,
      orderBy: { leaveId: 'desc' },
      include: {
        user: {
          select: {
            userId: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    }),
    prisma.leaveRequest.count({ where }),
  ]);

  const latestMap = await getLatestLeaveApprovalMap(data.map((request) => request.leaveId));
  return { data: attachLeaveApprover(data, latestMap), total };
}

/**
 * ดึงใบลาด้วย ID
 */
async function getLeaveRequestById(leaveId: number) {
  const leaveRequest = await prisma.leaveRequest.findUnique({
    where: { leaveId },
    include: {
      user: {
        select: {
          userId: true,
          employeeId: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
        },
      },
    },
  });

  if (!leaveRequest) {
    return null;
  }

  const latestMap = await getLatestLeaveApprovalMap([leaveId]);
  const [enriched] = attachLeaveApprover([leaveRequest], latestMap);
  return enriched;
}

/**
 * แก้ไขใบลา (อนุญาตแก้ไขเฉพาะใบลาที่ PENDING)
 */
async function updateLeaveRequest(
  leaveId: number,
  data: UpdateLeaveRequestDTO
): Promise<LeaveRequestWithApprover> {
  const leaveRequest = await prisma.leaveRequest.findUnique({
    where: { leaveId },
  });

  if (!leaveRequest) {
    throw new NotFoundError('ไม่พบใบลา');
  }

  if (leaveRequest.status !== 'PENDING') {
    throw new ConflictError('สามารถแก้ไขได้เฉพาะใบลาที่อยู่ในสถานะรอการอนุมัติเท่านั้น');
  }

  const currentLeave = leaveRequest as unknown as {
    isHourly?: boolean;
    startTime?: string | null;
    endTime?: string | null;
    leaveHours?: number | null;
  };
  const isHourly = data.isHourly ?? currentLeave.isHourly ?? false;

  const startDate = data.startDate ? new Date(data.startDate) : leaveRequest.startDate;
  const endDate = data.endDate ? new Date(data.endDate) : leaveRequest.endDate;
  const startTime = data.startTime ?? currentLeave.startTime ?? null;
  const endTime = data.endTime ?? currentLeave.endTime ?? null;

  // Validate dates
  if (startDate > endDate) {
    throw new BadRequestError('วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด');
  }

  if (isHourly) {
    if (!startTime || !endTime) {
      throw new BadRequestError('การลาเป็นชั่วโมงต้องระบุ startTime และ endTime');
    }
    if (!isValidTimeFormat(startTime) || !isValidTimeFormat(endTime)) {
      throw new BadRequestError('รูปแบบเวลาไม่ถูกต้อง (ต้องเป็น HH:MM)');
    }
    const startDateOnly = startDate.toISOString().slice(0, 10);
    const endDateOnly = endDate.toISOString().slice(0, 10);
    if (startDateOnly !== endDateOnly) {
      throw new BadRequestError('การลาเป็นชั่วโมงต้องอยู่ภายในวันเดียวกัน');
    }
  }

  // Check for overlapping leave requests
  if (data.startDate || data.endDate) {
    const overlappingLeave = await prisma.leaveRequest.findFirst({
      where: {
        userId: leaveRequest.userId,
        leaveId: { not: leaveId },
        status: { not: 'REJECTED' },
        AND: [
          { startDate: { lte: endDate } },
          { endDate: { gte: startDate } },
        ],
      },
    });

    if (overlappingLeave) {
      throw new ConflictError('มีใบลาที่ทับซ้อนกับช่วงวันที่นี้');
    }
  }

  // Calculate number of days
  const numberOfDays = isHourly ? 0 : calculateBusinessDays(startDate, endDate);
  const leaveHours = isHourly
    ? (data.leaveHours && data.leaveHours > 0 ? data.leaveHours : calculateLeaveHours(startTime as string, endTime as string))
    : null;

  if (!isHourly && numberOfDays <= 0) {
    throw new BadRequestError('ต้องเลือกช่วงวันที่อย่างน้อย 1 วันทำงาน');
  }

  // Calculate paid days if leaveType is provided
  const leaveType = data.leaveType || leaveRequest.leaveType;
  const paidDays = isHourly ? 0 : calculatePaidDays(leaveType, numberOfDays);

  const updatedLeave = await prisma.leaveRequest.update({
    where: { leaveId },
    data: {
      ...(data.leaveType && { leaveType: data.leaveType }),
      isHourly,
      startDate,
      endDate,
      startTime: isHourly ? startTime : null,
      endTime: isHourly ? endTime : null,
      leaveHours,
      numberOfDays: numberOfDays,
      paidDays: paidDays,
      ...(data.reason && { reason: data.reason }),
      ...(data.attachmentUrl && { attachmentUrl: data.attachmentUrl }),
      ...(data.medicalCertificateUrl && { medicalCertificateUrl: data.medicalCertificateUrl }),
    },
    include: {
      user: {
        select: {
          userId: true,
          employeeId: true,
          firstName: true,
          lastName: true,
          gender: true,
        },
      },
    },
  });

  const latestMap = await getLatestLeaveApprovalMap([updatedLeave.leaveId]);
  const [enriched] = attachLeaveApprover([updatedLeave], latestMap);

  await createAuditLog({
    userId: leaveRequest.userId,
    action: AuditAction.UPDATE_LEAVE,
    targetTable: 'leave_requests',
    targetId: leaveId,
    oldValues: {
      leaveType: leaveRequest.leaveType,
      isHourly: currentLeave.isHourly ?? false,
      startDate: leaveRequest.startDate,
      endDate: leaveRequest.endDate,
      startTime: currentLeave.startTime ?? null,
      endTime: currentLeave.endTime ?? null,
      leaveHours: currentLeave.leaveHours ?? null,
      reason: leaveRequest.reason,
    },
    newValues: {
      leaveType: updatedLeave.leaveType,
      isHourly,
      startDate: updatedLeave.startDate,
      endDate: updatedLeave.endDate,
      startTime: isHourly ? startTime : null,
      endTime: isHourly ? endTime : null,
      leaveHours,
      reason: updatedLeave.reason,
    },
  });

  return enriched;
}

/**
 * ลบใบลา (อนุญาตแค่เมื่อ PENDING)
 */
async function deleteLeaveRequest(leaveId: number): Promise<LeaveRequest> {
  const leaveRequest = await prisma.leaveRequest.findUnique({
    where: { leaveId },
  });

  if (!leaveRequest) {
    throw new NotFoundError('ไม่พบใบลา');
  }

  if (leaveRequest.status !== 'PENDING') {
    throw new ConflictError('สามารถลบได้เฉพาะใบลาที่อยู่ในสถานะรอการอนุมัติเท่านั้น');
  }

  const deletedLeave = await prisma.leaveRequest.delete({
    where: { leaveId },
  });

  await createAuditLog({
    userId: leaveRequest.userId,
    action: AuditAction.DELETE_LEAVE,
    targetTable: 'leave_requests',
    targetId: leaveId,
    oldValues: { leaveType: leaveRequest.leaveType, startDate: leaveRequest.startDate, endDate: leaveRequest.endDate, status: leaveRequest.status },
  });

  return deletedLeave;
}

/**
 * สถิติการลาของผู้ใช้
 */
async function getLeaveStatistics(userId: number): Promise<{
  total: number;
  approved: number;
  pending: number;
  rejected: number;
  totalDays: number;
  approvedDays: number;
}> {
  const [total, approved, pending, rejected] = await Promise.all([
    prisma.leaveRequest.count({ where: { userId } }),
    prisma.leaveRequest.count({ where: { userId, status: 'APPROVED' } }),
    prisma.leaveRequest.count({ where: { userId, status: 'PENDING' } }),
    prisma.leaveRequest.count({ where: { userId, status: 'REJECTED' } }),
  ]);

  const allLeaves = await prisma.leaveRequest.findMany({
    where: { userId },
    select: { numberOfDays: true, status: true },
  });

  const totalDays = allLeaves.reduce((sum: number, leave: any) => sum + leave.numberOfDays, 0);
  const approvedDays = allLeaves
    .filter((leave: any) => leave.status === 'APPROVED')
    .reduce((sum: number, leave: any) => sum + leave.numberOfDays, 0);

  return {
    total,
    approved,
    pending,
    rejected,
    totalDays,
    approvedDays,
  };
}

// ========================================================================================
// ADMIN ACTIONS - การดำเนินการของผู้จัดการ/แอดมิน
// ========================================================================================

/**
 * ดึงใบลาทั้งหมด (Admin only)
 */
async function getAllLeaveRequests(
  status?: LeaveStatus,
  skip?: number,
  take?: number
): Promise<{ data: LeaveRequestWithApprover[]; total: number }> {
  const where: any = {};

  if (status) {
    where.status = status;
  }

  const [data, total] = await Promise.all([
    prisma.leaveRequest.findMany({
      where,
      skip: skip || 0,
      take: take || 10,
      orderBy: { leaveId: 'desc' },
      include: {
        user: {
          select: {
            userId: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            email: true,
            role: true,
          },
        },
      },
    }),
    prisma.leaveRequest.count({ where }),
  ]);

  const latestMap = await getLatestLeaveApprovalMap(data.map((request) => request.leaveId));
  return { data: attachLeaveApprover(data, latestMap), total };
}

/**
 * อนุมัติใบลา
 */
async function approveLeaveRequest(
  leaveId: number,
  data: ApproveLeaveRequestDTO
): Promise<LeaveRequestWithApprover> {
  const leaveRequest = await prisma.leaveRequest.findUnique({
    where: { leaveId },
  });

  if (!leaveRequest) {
    throw new NotFoundError('ไม่พบใบลา');
  }

  if (leaveRequest.status !== 'PENDING') {
    throw new ConflictError('ไม่สามารถอนุมัติใบลาที่มีสถานะอื่นได้');
  }

  const approvedLeave = await prisma.$transaction(async (tx) => {
    const updated = await tx.leaveRequest.update({
      where: { leaveId },
      data: {
        status: 'APPROVED',
        adminComment: data.adminComment,
        rejectionReason: null,
      },
      include: {
        user: {
          select: {
            userId: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    await tx.approvalAction.create({
      data: {
        leaveId,
        actorUserId: data.approvedByUserId,
        action: 'APPROVED',
        adminComment: data.adminComment,
      },
    });

    return updated;
  });

  const latestMap = await getLatestLeaveApprovalMap([approvedLeave.leaveId]);
  const [enriched] = attachLeaveApprover([approvedLeave], latestMap);

  await createAuditLog({
    userId: data.approvedByUserId,
    action: AuditAction.APPROVE_LEAVE,
    targetTable: 'leave_requests',
    targetId: leaveId,
    oldValues: { status: leaveRequest.status },
    newValues: { status: 'APPROVED', adminComment: data.adminComment },
  });

  return enriched;
}

/**
 * ปฏิเสธใบลา
 */
async function rejectLeaveRequest(
  leaveId: number,
  data: RejectLeaveRequestDTO
): Promise<LeaveRequestWithApprover> {
  const leaveRequest = await prisma.leaveRequest.findUnique({
    where: { leaveId },
  });

  if (!leaveRequest) {
    throw new NotFoundError('ไม่พบใบลา');
  }

  if (leaveRequest.status !== 'PENDING') {
    throw new ConflictError('ไม่สามารถปฏิเสธใบลาที่มีสถานะอื่นได้');
  }

  const rejectedLeave = await prisma.$transaction(async (tx) => {
    const updated = await tx.leaveRequest.update({
      where: { leaveId },
      data: {
        status: 'REJECTED',
        rejectionReason: data.rejectionReason,
      },
      include: {
        user: {
          select: {
            userId: true,
            employeeId: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    });

    await tx.approvalAction.create({
      data: {
        leaveId,
        actorUserId: data.approvedByUserId,
        action: 'REJECTED',
        rejectionReason: data.rejectionReason,
      },
    });

    return updated;
  });

  const latestMap = await getLatestLeaveApprovalMap([rejectedLeave.leaveId]);
  const [enriched] = attachLeaveApprover([rejectedLeave], latestMap);

  await createAuditLog({
    userId: data.approvedByUserId,
    action: AuditAction.REJECT_LEAVE,
    targetTable: 'leave_requests',
    targetId: leaveId,
    oldValues: { status: leaveRequest.status },
    newValues: { status: 'REJECTED', rejectionReason: data.rejectionReason },
  });

  return enriched;
}

// ========================================================================================
// EXPORTS - แยก exports เป็น 2 กลุ่มตามหน้าที่
// ========================================================================================

/**
 * User Actions - ใช้โดยพนักงานทั่วไป
 */
export const LeaveRequestUserActions = {
  createLeaveRequest,
  getLeaveRequestsByUser,
  getLeaveRequestById,
  updateLeaveRequest,
  deleteLeaveRequest,
  getLeaveStatistics,
  getLeaveQuota,
};

/**
 * Admin Actions - ใช้โดยผู้จัดการ/แอดมิน
 */
export const LeaveRequestAdminActions = {
  getAllLeaveRequests,
  approveLeaveRequest,
  rejectLeaveRequest,
};
