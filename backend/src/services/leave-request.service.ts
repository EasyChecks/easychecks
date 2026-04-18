import { prisma } from '../lib/prisma.js';
import type { LeaveRequest, LeaveStatus, LeaveType, Gender, Prisma, Role } from '@prisma/client';
import { differenceInBusinessDays, differenceInCalendarDays, startOfYear, endOfYear } from 'date-fns';
import { createAuditLog, AuditAction } from './audit.service.js';
import { BadRequestError, ConflictError, NotFoundError, ForbiddenError } from '../utils/custom-errors.js';
import { LEAVE_RULES } from './leave-rules.js';
import { getEffectiveLeaveRulesForUser, type EffectiveLeaveRules } from './leave-quota.service.js';

/**
 * Leave Request Service - จัดการใบลา
 * ใช้ date-fns สำหรับจัดการวันที่
 */

// ========================================================================================
// ROLE HIERARCHY VALIDATION
// ========================================================================================

/**
 * 🔐 ตรวจสอบว่า approver มีสิทธิ์อนุมัติผู้ขอได้หรือไม่
 * 
 * ลำดับ role hierarchy (สูง → ต่ำ):
 * 1. SUPERADMIN - อนุมัติได้ทั้งตัวเองและคนต่ำกว่า
 * 2. ADMIN - อนุมัติได้แต่คนต่ำกว่า (MANAGER, USER)
 * 3. MANAGER - อนุมัติได้แต่คนต่ำกว่า (USER)
 * 4. USER - ไม่สามารถอนุมัติใครได้
 */
function canApprove(approverRole: Role, requesterRole: Role): boolean {
  const roleHierarchy: Record<Role, number> = {
    SUPERADMIN: 4,
    ADMIN: 3,
    MANAGER: 2,
    USER: 1,
  };

  const approverLevel = roleHierarchy[approverRole];
  const requesterLevel = roleHierarchy[requesterRole];

  // SUPERADMIN สามารถอนุมัติตัวเอง + ทุกคนต่ำกว่า
  if (approverRole === 'SUPERADMIN') {
    return requesterLevel <= approverLevel;
  }

  // Role อื่นอนุมัติได้แต่คนต่ำกว่า (ไม่สามารถอนุมัติเท่าเดิมหรือสูงกว่า)
  return requesterLevel < approverLevel;
}

/**
 * Leave Request Service - จัดการใบลา
 * ใช้ date-fns สำหรับจัดการวันที่
 */

// Type definition for leave quota item
export interface LeaveQuotaItem {
  leaveType: LeaveType;
  usedDays: number;
  usedPaidDays: number;
  maxDaysPerYear: number | null;
  maxPaidDaysPerYear: number | null;
  maxDaysTotal: number | null;
  remainingPaidDays: number | null;
  displayName: string;
  displayNameEng: string;
  iconName: string;
  isPaid: boolean;
  requireMedicalCert: boolean | number;
  genderRestriction: Gender | null;
}


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
  action: string;
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
      adminComment: (request.adminComment ?? latest?.adminComment ?? null) as string | null,
      rejectionReason: (request.rejectionReason ?? latest?.rejectionReason ?? null) as string | null,
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
  // differenceInBusinessDays returns difference between dates (not inclusive of both)
  // Adding +1 to include both start and end dates in the count
  const days = differenceInBusinessDays(endDate, startDate) + 1;
  return days > 0 ? days : 0;
}

/**
 * ฟังก์ชันคำนวณจำนวนวันแบบปฏิทิน (รวมเสาร์-อาทิตย์)
 */
function calculateCalendarDays(startDate: Date, endDate: Date): number {
  const days = differenceInCalendarDays(endDate, startDate) + 1;
  return days > 0 ? days : 0;
}

/**
 * เลือกวิธีนับวันตามประเภทการลา
 */
function calculateLeaveDays(leaveType: LeaveType, startDate: Date, endDate: Date): number {
  if (leaveType === 'MATERNITY') {
    return calculateCalendarDays(startDate, endDate);
  }
  return calculateBusinessDays(startDate, endDate);
}

/**
 * ฟังก์ชันคำนวณวันที่ได้รับค่าจ้างตามประเภทการลา
 * 
 * เป้าหมาย: คำนวณว่าวันลาที่ขอได้รับค่าจ้างกี่วัน (ตามกฎของแต่ละประเภท)
 * 
 * เหตุผล: แต่ละประเภทลามีกฎต่างกัน (SICK: 30 วัน, VACATION: 6 วัน, ฯลฯ)
 *            บางประเภทไม่ได้รับค่าจ้างเลย (PERSONAL, TRAINING)
 */
function calculatePaidDays(
  rules: EffectiveLeaveRules,
  numberOfDays: number,
  remainingPaidDays?: number | null
): number {
  if (!rules.paid) {
    return 0; // ไม่ได้รับค่าจ้าง
  }

  // ถ้ามีข้อจำกัดวันที่ได้รับค่าจ้าง
  const paidLimit = remainingPaidDays ?? rules.maxPaidDaysPerYear;
  if (paidLimit !== null && paidLimit !== undefined) {
    return Math.min(numberOfDays, paidLimit);
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
async function getUsedLeaveDaysInRange(
  userId: number,
  leaveType: LeaveType,
  rangeStart: Date,
  rangeEnd: Date
): Promise<number> {
  const HOURS_PER_DAY = 8;
  const leaves = await prisma.leaveRequest.findMany({
    where: {
      userId,
      leaveType,
      status: 'APPROVED',
      deletedAt: null, // Exclude soft deleted
      startDate: {
        gte: rangeStart,
        lte: rangeEnd,
      },
    },
    select: {
      numberOfDays: true,
      isHourly: true,
      leaveHours: true,
    },
  });

  return leaves.reduce((sum: number, leave: { numberOfDays: number; isHourly?: boolean; leaveHours?: number | null }) => {
    if (leave.isHourly) {
      const hours = Math.max(0, leave.leaveHours ?? 0);
      return sum + (hours / HOURS_PER_DAY);
    }
    return sum + leave.numberOfDays;
  }, 0);
}

async function getUsedLeaveDaysThisYear(userId: number, leaveType: LeaveType): Promise<number> {
  const yearStart = startOfYear(new Date());
  const yearEnd = endOfYear(new Date());
  return getUsedLeaveDaysInRange(userId, leaveType, yearStart, yearEnd);
}

/**
 * ตรวจสอบจำนวนวันลาที่ได้รับค่าจ้างในปีนี้
 */
async function getUsedPaidLeaveDaysThisYear(userId: number, leaveType: LeaveType): Promise<number> {
  const HOURS_PER_DAY = 8;
  const yearStart = startOfYear(new Date());
  const yearEnd = endOfYear(new Date());

  const leaves = await prisma.leaveRequest.findMany({
    where: {
      userId,
      leaveType,
      status: 'APPROVED',
      deletedAt: null, // Exclude soft deleted
      startDate: {
        gte: yearStart,
        lte: yearEnd,
      },
    },
    select: {
      paidDays: true,
      numberOfDays: true,
      isHourly: true,
      leaveHours: true,
    },
  });

  return leaves.reduce((sum: number, leave: { paidDays: number | null; numberOfDays: number; isHourly?: boolean; leaveHours?: number | null }) => {
    if (leave.isHourly) {
      const hours = Math.max(0, leave.leaveHours ?? 0);
      return sum + (hours / HOURS_PER_DAY);
    }
    return sum + (leave.paidDays ?? leave.numberOfDays);
  }, 0);
}

async function getEmploymentStartDate(userId: number): Promise<Date> {
  const user = await prisma.user.findUnique({
    where: { userId },
    select: { createdAt: true },
  });

  if (!user) {
    throw new NotFoundError('ไม่พบผู้ใช้');
  }

  return user.createdAt;
}

async function getVacationAnnualLimits(
  userId: number,
  rules: EffectiveLeaveRules
): Promise<{ eligible: boolean; maxDaysPerYear: number | null; maxPaidDaysPerYear: number | null }> {
  const employmentStart = await getEmploymentStartDate(userId);
  const baseDays = rules.maxDaysPerYear ?? rules.maxPaidDaysPerYear ?? 6;
  const carryOverCap = rules.carryOverMaxDays ?? 20;
  const currentYear = new Date().getFullYear();
  const firstEligibleYear = employmentStart.getFullYear() + 1;

  let carryOver = 0;
  for (let year = firstEligibleYear; year < currentYear; year += 1) {
    const yearStart = new Date(year, 0, 1);
    const yearEnd = endOfYear(yearStart);
    const totalAllowed = Math.min(carryOverCap, baseDays + carryOver);
    const usedDays = await getUsedLeaveDaysInRange(userId, 'VACATION', yearStart, yearEnd);
    carryOver = Math.max(0, totalAllowed - usedDays);
  }

  const totalAllowed = Math.min(carryOverCap, baseDays + carryOver);
  return { eligible: true, maxDaysPerYear: totalAllowed, maxPaidDaysPerYear: totalAllowed };
}

async function getAnnualLimitsForUser(
  userId: number,
  leaveType: LeaveType,
  rules: EffectiveLeaveRules
): Promise<{ eligible: boolean; maxDaysPerYear: number | null; maxPaidDaysPerYear: number | null }> {
  if (leaveType === 'VACATION') {
    return getVacationAnnualLimits(userId, rules);
  }

  return {
    eligible: true,
    maxDaysPerYear: rules.maxDaysPerYear ?? null,
    maxPaidDaysPerYear: rules.maxPaidDaysPerYear ?? null,
  };
}

/**
 * ดูสถิติการลาแต่ละประเภทของผู้ใช้
 * 
 * returns: 
 * - leaveType: ประเภทการลา
 * - usedDays: จำนวนวันลาที่ใช้ไปในปีนี้ (APPROVED เท่านั้น)
 * - usedPaidDays: จำนวนวันลาที่ได้รับค่าจ้างในปีนี้
 * - maxPaidDaysPerYear: จำนวนวันลาสูงสุดต่อปี (เมื่อได้รับค่าจ้าง)
 * - maxDaysTotal: จำนวนวันลาสูงสุดต่อครั้ง (สำหรับการลาระยะยาว เช่น ลาคลอด, ลาบวช)
 * - remainingPaidDays: จำนวนวันลาสะสมที่เหลือในปีนี้ (null = ไม่มีข้อจำกัด)
 * - displayName: ชื่อการลาตามประเภท (ภาษาไทย)
 * - iconName: ชื่อ icon สำหรับแสดง UI
 * - isPaid: ได้รับค่าจ้างหรือไม่
 * - requireMedicalCert: ต้องใบรับรองแพทย์หรือไม่ (number=ต้องเมื่อลา>=วัน, true=ต้องเสมอ, false=ไม่ต้อง)
 * - genderRestriction: ระบุเพศ (MALE=เฉพาะชาย, FEMALE=เฉพาะหญิง, null=ทั้งสองเพศ)
 */
async function getLeaveQuota(userId: number): Promise<LeaveQuotaItem[]> {
  const effectiveRulesByType = await getEffectiveLeaveRulesForUser(userId);
  const quotas = await Promise.all(
    (Object.keys(LEAVE_RULES) as LeaveType[]).map(async (type) => {
      const rules = effectiveRulesByType[type];
      const usedDays = await getUsedLeaveDaysThisYear(userId, type);
      const usedPaidDays = await getUsedPaidLeaveDaysThisYear(userId, type);

      const annualLimits = await getAnnualLimitsForUser(userId, type, rules);
      const maxPaid = annualLimits.maxPaidDaysPerYear ?? rules?.maxPaidDaysPerYear ?? null;
      const maxDaysPerYear = annualLimits.maxDaysPerYear ?? rules?.maxDaysPerYear ?? null;
      const maxTotal = rules?.maxDaysTotal ?? null;

      let remainingPaidDays: number | null = null;
      if (!annualLimits.eligible) {
        remainingPaidDays = 0;
      } else if (rules?.paid && maxPaid !== null && maxPaid !== undefined) {
        remainingPaidDays = Math.max(0, maxPaid - usedPaidDays);
      } else if (maxDaysPerYear !== null && maxDaysPerYear !== undefined) {
        remainingPaidDays = Math.max(0, maxDaysPerYear - usedDays);
      }

      return {
        leaveType: type,
        usedDays,
        usedPaidDays,
        maxDaysPerYear: maxDaysPerYear as (typeof maxDaysPerYear extends number ? number : null) | null,
        maxPaidDaysPerYear: maxPaid as (typeof maxPaid extends number ? number : null) | null,
        maxDaysTotal: maxTotal as (typeof maxTotal extends number ? number : null) | null,
        remainingPaidDays,
        displayName: rules.displayName as string,
        displayNameEng: rules.displayNameEng as string,
        iconName: rules.iconName as string,
        isPaid: rules.paid as boolean,
        requireMedicalCert: rules.requireMedicalCert as (boolean | number),
        genderRestriction: (rules.genderRestriction as Gender) || null,
      } as LeaveQuotaItem;
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
  const effectiveRulesByType = await getEffectiveLeaveRulesForUser(userId);
  const rules = effectiveRulesByType[leaveType];
  const displayName = rules.displayName as string;

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
      message: `การลาประเภท ${displayName} สามารถใช้ได้เฉพาะเพศ${genderText}เท่านั้น` 
    };
  }

  // ตรวจสอบใบรับรองแพทย์
  if (rules.requireMedicalCert) {
    if (typeof rules.requireMedicalCert === 'number') {
      // ต้องมีใบรับรองแพทย์เมื่อลา >= จำนวนวันที่กำหนด
      if (numberOfDays >= rules.requireMedicalCert && !medicalCertificateUrl) {
        return { 
          isValid: false, 
          message: `การลาประเภท ${displayName} ${rules.requireMedicalCert} วันขึ้นไป ต้องแนบใบรับรองแพทย์` 
        };
      }
    } else if (rules.requireMedicalCert === true && !medicalCertificateUrl) {
      return { 
        isValid: false, 
        message: `การลาประเภท ${displayName} ต้องแนบใบรับรองแพทย์` 
      };
    }
  }

  // ตรวจสอบจำนวนวันสูงสุดต่อครั้ง
  if ('maxDaysTotal' in rules && rules.maxDaysTotal) {
    if (numberOfDays > rules.maxDaysTotal) {
      return { 
        isValid: false, 
        message: `การลาประเภท ${displayName} ลาได้ไม่เกิน ${rules.maxDaysTotal} วันต่อครั้ง` 
      };
    }
  }

  const annualLimits = await getAnnualLimitsForUser(userId, leaveType, rules);
  if (!annualLimits.eligible) {
    return {
      isValid: false,
      message: `การลาประเภท ${displayName} ต้องมีอายุงานอย่างน้อย 1 ปี`,
    };
  }

  if (annualLimits.maxDaysPerYear !== null && annualLimits.maxDaysPerYear !== undefined) {
    const usedDays = await getUsedLeaveDaysThisYear(userId, leaveType);
    if (usedDays + numberOfDays > annualLimits.maxDaysPerYear) {
      return {
        isValid: false,
        message: `คุณใช้วันลาประเภท ${displayName} ไปแล้ว ${usedDays} วัน (สูงสุด ${annualLimits.maxDaysPerYear} วันต่อปี)`,
      };
    }
  } else if (annualLimits.maxPaidDaysPerYear !== null && annualLimits.maxPaidDaysPerYear !== undefined) {
    const usedPaidDays = await getUsedPaidLeaveDaysThisYear(userId, leaveType);
    if (usedPaidDays + numberOfDays > annualLimits.maxPaidDaysPerYear) {
      return {
        isValid: false,
        message: `คุณใช้วันลาประเภท ${displayName} ที่ได้รับค่าจ้างไปแล้ว ${usedPaidDays} วัน (สูงสุด ${annualLimits.maxPaidDaysPerYear} วันต่อปี)`,
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
  const numberOfDays = isHourly ? 0 : calculateLeaveDays(data.leaveType, startDate, endDate);

  const leaveHours = isHourly
    ? (data.leaveHours && data.leaveHours > 0
      ? data.leaveHours
      : calculateLeaveHours(data.startTime as string, data.endTime as string))
    : null;

  const quotaDays = isHourly ? ((leaveHours ?? 0) / 8) : numberOfDays;

  if (!isHourly && numberOfDays <= 0) {
    throw new BadRequestError('ต้องเลือกช่วงวันที่อย่างน้อย 1 วันทำงาน');
  }

  // Validate leave request based on type
  const validation = await validateLeaveRequest(
    data.userId,
    data.leaveType,
    quotaDays,
    data.medicalCertificateUrl
  );

  if (!validation.isValid) {
    throw new BadRequestError(validation.message || 'ข้อมูลการลาไม่ถูกต้อง');
  }

  // Check for overlapping leave requests (exclude soft-deleted records)
  const overlappingLeave = await prisma.leaveRequest.findFirst({
    where: {
      userId: data.userId,
      deletedAt: null, // Exclude soft-deleted records
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
  const effectiveRulesByType = await getEffectiveLeaveRulesForUser(data.userId);
  const rules = effectiveRulesByType[data.leaveType];
  const annualLimits = await getAnnualLimitsForUser(data.userId, data.leaveType, rules);
  const usedPaidDays = annualLimits.maxPaidDaysPerYear !== null && annualLimits.maxPaidDaysPerYear !== undefined
    ? await getUsedPaidLeaveDaysThisYear(data.userId, data.leaveType)
    : 0;
  const remainingPaidDays = annualLimits.maxPaidDaysPerYear !== null && annualLimits.maxPaidDaysPerYear !== undefined
    ? Math.max(0, annualLimits.maxPaidDaysPerYear - usedPaidDays)
    : null;
  const paidDays = isHourly ? 0 : calculatePaidDays(rules, numberOfDays, remainingPaidDays);

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
  take?: number,
  query?: string
): Promise<{ data: LeaveRequestWithApprover[]; total: number }> {
  const where: Prisma.LeaveRequestWhereInput = { userId, deletedAt: null };

  if (status) {
    where.status = status;
  }

  const search = query?.trim();
  if (search) {
    const lower = search.toLowerCase();
    const matchedTypes = (Object.keys(LEAVE_RULES) as LeaveType[]).filter((type) => {
      const rules = LEAVE_RULES[type];
      const name = String(rules.displayName ?? '').toLowerCase();
      const nameEng = String(rules.displayNameEng ?? '').toLowerCase();
      return name.includes(lower) || nameEng.includes(lower) || String(type).toLowerCase().includes(lower);
    });
    const statusMatches: LeaveStatus[] = [];
    if (lower.includes('อนุมัติ') || lower.includes('approved')) statusMatches.push('APPROVED');
    if (lower.includes('ไม่อนุมัติ') || lower.includes('rejected')) statusMatches.push('REJECTED');
    if (lower.includes('รอ') || lower.includes('pending')) statusMatches.push('PENDING');

    const or: Prisma.LeaveRequestWhereInput[] = [
      { reason: { contains: search, mode: 'insensitive' } },
      { rejectionReason: { contains: search, mode: 'insensitive' } },
    ];
    if (matchedTypes.length) {
      or.push({ leaveType: { in: matchedTypes } });
    }
    if (statusMatches.length) {
      or.push({ status: { in: statusMatches } });
    }
    where.OR = or;
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
  const currentStartDateOnly = leaveRequest.startDate.toISOString().slice(0, 10);
  const currentEndDateOnly = leaveRequest.endDate.toISOString().slice(0, 10);
  const nextStartDateOnly = data.startDate ?? currentStartDateOnly;
  const nextEndDateOnly = data.endDate ?? currentEndDateOnly;
  const dateRangeChanged = nextStartDateOnly !== currentStartDateOnly || nextEndDateOnly !== currentEndDateOnly;

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

  // Check for overlapping leave requests (exclude soft-deleted records)
  if (dateRangeChanged) {
    const overlappingLeave = await prisma.leaveRequest.findFirst({
      where: {
        userId: leaveRequest.userId,
        leaveId: { not: leaveId },
        deletedAt: null, // Exclude soft deleted
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

  const leaveType = data.leaveType || leaveRequest.leaveType;

  // Calculate number of days
  const numberOfDays = isHourly ? 0 : calculateLeaveDays(leaveType, startDate, endDate);
  const leaveHours = isHourly
    ? (data.leaveHours && data.leaveHours > 0 ? data.leaveHours : calculateLeaveHours(startTime as string, endTime as string))
    : null;

  if (!isHourly && numberOfDays <= 0) {
    throw new BadRequestError('ต้องเลือกช่วงวันที่อย่างน้อย 1 วันทำงาน');
  }

  // Calculate paid days if leaveType is provided
  const effectiveRulesByType = await getEffectiveLeaveRulesForUser(leaveRequest.userId);
  const rules = effectiveRulesByType[leaveType];
  const annualLimits = await getAnnualLimitsForUser(leaveRequest.userId, leaveType, rules);
  const usedPaidDays = annualLimits.maxPaidDaysPerYear !== null && annualLimits.maxPaidDaysPerYear !== undefined
    ? await getUsedPaidLeaveDaysThisYear(leaveRequest.userId, leaveType)
    : 0;
  const remainingPaidDays = annualLimits.maxPaidDaysPerYear !== null && annualLimits.maxPaidDaysPerYear !== undefined
    ? Math.max(0, annualLimits.maxPaidDaysPerYear - usedPaidDays)
    : null;
  const paidDays = isHourly ? 0 : calculatePaidDays(rules, numberOfDays, remainingPaidDays);

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
 * ลบใบลา (Soft Delete - อนุญาตแค่เมื่อ PENDING)
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

  // Soft delete: set deletedAt instead of hard delete
  const deletedLeave = await prisma.leaveRequest.update({
    where: { leaveId },
    data: {
      deletedAt: new Date(),
    },
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
  const baseWhere = { userId, deletedAt: null };
  const [total, approved, pending, rejected] = await Promise.all([
    prisma.leaveRequest.count({ where: baseWhere }),
    prisma.leaveRequest.count({ where: { ...baseWhere, status: 'APPROVED' } }),
    prisma.leaveRequest.count({ where: { ...baseWhere, status: 'PENDING' } }),
    prisma.leaveRequest.count({ where: { ...baseWhere, status: 'REJECTED' } }),
  ]);

  const allLeaves = await prisma.leaveRequest.findMany({
    where: baseWhere,
    select: { numberOfDays: true, status: true },
  });

  const totalDays = allLeaves.reduce((sum: number, leave: { numberOfDays: number; status: LeaveStatus }) => sum + leave.numberOfDays, 0);
  const approvedDays = allLeaves
    .filter((leave: { numberOfDays: number; status: LeaveStatus }) => leave.status === 'APPROVED')
    .reduce((sum: number, leave: { numberOfDays: number; status: LeaveStatus }) => sum + leave.numberOfDays, 0);

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
 * ดึงใบลาทั้งหมด สำหรับอนุมัติ (filtered by approval hierarchy)
 * - SUPERADMIN: เห็นทั้งหมด
 * - ADMIN: เห็น MANAGER + USER เท่านั้น (เพื่ออนุมัติ)
 * - MANAGER: เห็น USER เท่านั้น (เพื่ออนุมัติ)
 * - Default to PENDING status if not specified (approval use case)
 */
async function getAllLeaveRequests(
  status?: LeaveStatus,
  skip?: number,
  take?: number,
  userRole?: string, // Current user's role for approval hierarchy filtering
  currentUserId?: number // Current user's ID to include self-request
): Promise<{ data: LeaveRequestWithApprover[]; total: number }> {
  const where: Prisma.LeaveRequestWhereInput = { 
    deletedAt: null,
    // Default to PENDING if not specified (for approval workflow)
    status: status || 'PENDING',
  };

  // Normalize role to uppercase for comparison
  const normalizedRole = userRole?.toUpperCase();

  // Filter by approval hierarchy - who can approve whom
  // Also include self-requests (where userId = current user)
  if (normalizedRole === 'ADMIN') {
    // ADMIN can only approve MANAGER and USER requests, OR their own requests
    const orConditions: any[] = [
      { user: { role: { in: ['MANAGER', 'USER'] } } },
    ];
    if (currentUserId) {
      orConditions.push({ userId: currentUserId });
    }
    where.OR = orConditions;
  } else if (normalizedRole === 'MANAGER') {
    // MANAGER can only approve USER requests, OR their own requests
    const orConditions: any[] = [
      { user: { role: { in: ['USER'] } } },
    ];
    if (currentUserId) {
      orConditions.push({ userId: currentUserId });
    }
    where.OR = orConditions;
  } else if (normalizedRole === 'SUPERADMIN') {
    // SUPERADMIN: can approve all, including self
    // No additional filter needed - can see/approve all roles + self
  }
  // For other roles, they can at least see their own requests

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
    include: {
      user: {
        select: { role: true },
      },
    },
  });

  if (!leaveRequest) {
    throw new NotFoundError('ไม่พบใบลา');
  }

  if (leaveRequest.status !== 'PENDING') {
    throw new ConflictError('ไม่สามารถอนุมัติใบลาที่มีสถานะอื่นได้');
  }

  // 🔐 ตรวจสอบ role hierarchy - Approver ต้องมี role ที่พอเพียง
  const approverUser = await prisma.user.findUnique({
    where: { userId: data.approvedByUserId },
    select: { role: true },
  });

  if (!approverUser) {
    throw new NotFoundError('ไม่พบผู้อนุมัติ');
  }

  const requesterRole = leaveRequest.user.role;
  if (!canApprove(approverUser.role, requesterRole)) {
    throw new ForbiddenError(
      `${approverUser.role} ไม่สามารถอนุมัติใบลาของ ${requesterRole} ได้`
    );
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
    include: {
      user: {
        select: { role: true },
      },
    },
  });

  if (!leaveRequest) {
    throw new NotFoundError('ไม่พบใบลา');
  }

  if (leaveRequest.status !== 'PENDING') {
    throw new ConflictError('ไม่สามารถปฏิเสธใบลาที่มีสถานะอื่นได้');
  }

  // 🔐 ตรวจสอบ role hierarchy - Approver ต้องมี role ที่พอเพียง
  const approverUser = await prisma.user.findUnique({
    where: { userId: data.approvedByUserId },
    select: { role: true },
  });

  if (!approverUser) {
    throw new NotFoundError('ไม่พบผู้อนุมัติ');
  }

  const requesterRole = leaveRequest.user.role;
  if (!canApprove(approverUser.role, requesterRole)) {
    throw new ForbiddenError(
      `${approverUser.role} ไม่สามารถปฏิเสธใบลาของ ${requesterRole} ได้`
    );
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
