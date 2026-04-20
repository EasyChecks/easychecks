import { prisma } from '../lib/prisma.js';
import type { LateRequest, ApprovalStatus, Gender, ApprovalActionType, Role, AttendanceStatus } from '@prisma/client';
import { Prisma } from '@prisma/client';
import { createAuditLog, AuditAction } from './audit.service.js';
import { BadRequestError, ConflictError, NotFoundError, ForbiddenError } from '../utils/custom-errors.js';
import {
  calculateLateMinutesFromTimes,
  evaluateAttendanceStatus,
  resolveAttendanceWithApprovedLateWindow,
} from '../utils/late-policy.js';
import { getThaiDayRange, getThaiTimeHHMM } from '../utils/timezone.js';

/**
 * Late Request Service - จัดการการขอมาสาย
 * ใช้ date-fns สำหรับจัดการเวลา
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

export interface CreateLateRequestDTO {
  userId: number;
  attendanceId?: number;
  requestDate: Date;
  scheduledTime: string; // HH:MM
  actualTime: string; // HH:MM
  reason: string;
  attachmentUrl?: string;
}

export interface UpdateLateRequestDTO {
  requestDate?: Date;
  scheduledTime?: string;
  actualTime?: string;
  reason?: string;
  attachmentUrl?: string;
}

export interface ApproveLateRequestDTO {
  approvedByUserId: number;
  adminComment?: string;
}

export interface RejectLateRequestDTO {
  approvedByUserId: number;
  rejectionReason: string;
}

interface LateApproverSummary {
  userId: number;
  firstName: string;
  lastName: string;
  employeeId?: string;
  email?: string;
  role?: string;
  gender?: Gender;
}

interface LateRequestUserSummary {
  userId: number;
  firstName: string;
  lastName: string;
  email: string;
  employeeId?: string;
  role?: string;
  gender?: Gender;
}

interface LateRequestFrontend {
  id: number;
  userId: number;
  attendanceId: number | null;
  requestDate: Date;
  scheduledTime: string;
  actualTime: string;
  lateMinutes: number;
  reason: string;
  status: ApprovalStatus;
  attachmentUrl: string | null;
  adminComment: string | null;
  rejectionReason: string | null;
  approvedByUserId: number | null;
  user?: LateRequestUserSummary | null;
  approver?: LateApproverSummary | null;
}

type LateRequestWithApprover = LateRequest & {
  approvedByUserId: number | null;
  approver: LateApproverSummary | null;
};

type LateApprovalActionRow = {
  lateRequestId: number;
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

async function getLatestLateApprovalMap(lateRequestIds: number[]): Promise<Map<number, LateApprovalActionRow>> {
  if (lateRequestIds.length === 0) {
    return new Map();
  }

  const actions = await prisma.approvalAction.findMany({
    where: {
      lateRequestId: { in: lateRequestIds },
    },
    orderBy: [
      { approvalActionId: 'desc' },
    ],
    select: {
      lateRequestId: true,
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

  const latestMap = new Map<number, LateApprovalActionRow>();
  for (const action of actions) {
    if (action.lateRequestId && !latestMap.has(action.lateRequestId)) {
      latestMap.set(action.lateRequestId, action as LateApprovalActionRow);
    }
  }

  return latestMap;
}

function mapLateRequestForFrontend(
  request: LateRequest & {
    approver?: LateApproverSummary | null;
    adminComment?: string | null;
    rejectionReason?: string | null;
    approvedByUserId?: number | null;
    user?: LateRequestUserSummary | null;
  }
): LateRequestFrontend {
  return {
    id: request.lateRequestId,
    userId: request.userId,
    attendanceId: request.attendanceId,
    requestDate: request.requestDate,
    scheduledTime: request.scheduledTime,
    actualTime: request.actualTime,
    lateMinutes: request.lateMinutes,
    reason: request.reason,
    status: request.status,
    attachmentUrl: request.attachmentUrl,
    adminComment: request.adminComment ?? null,
    rejectionReason: request.rejectionReason ?? null,
    approvedByUserId: request.approvedByUserId ?? null,
    user: request.user ?? null,
    approver: request.approver ?? null,
  };
}

function attachLateApprover<T extends LateRequest>(
  requests: T[],
  latestMap: Map<number, LateApprovalActionRow>
): LateRequestWithApprover[] {
  return requests.map((request) => {
    const latest = latestMap.get(request.lateRequestId);
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
 * 📊 ฟังก์ชันคำนวณจำนวนนาทีที่มาสาย
 * 
 * 🎯 เป้าหมาย: คำนวณความต่างของเวลามาถึงจริงกับเวลาที่กำหนด
 * 
 * 💡 เหตุผล: ใช้ date-fns เพื่อคำนวณความต่างของเวลาอย่างถูกต้อง
 *            ตั้ง baseDate เป็นวันเดียวกันเพราะต้องการเปรียบเทียบเฉพาะเวลา (ไม่สนใจวันที่)
 */
function calculateLateMinutes(scheduledTime: string, actualTime: string): number {
  return calculateLateMinutesFromTimes(scheduledTime, actualTime);
}

const THAI_MONTHS: Record<string, number> = {
  'ม.ค': 1,
  'มกราคม': 1,
  'ก.พ': 2,
  'กุมภาพันธ์': 2,
  'มี.ค': 3,
  'มีนาคม': 3,
  'เม.ย': 4,
  'เมษายน': 4,
  'พ.ค': 5,
  'พฤษภาคม': 5,
  'มิ.ย': 6,
  'มิถุนายน': 6,
  'ก.ค': 7,
  'กรกฎาคม': 7,
  'ส.ค': 8,
  'สิงหาคม': 8,
  'ก.ย': 9,
  'กันยายน': 9,
  'ต.ค': 10,
  'ตุลาคม': 10,
  'พ.ย': 11,
  'พฤศจิกายน': 11,
  'ธ.ค': 12,
  'ธันวาคม': 12,
};

function normalizeSearchYear(rawYear: string): number | null {
  const yearNum = Number(rawYear);
  if (!Number.isFinite(yearNum)) return null;

  if (rawYear.length === 4) {
    return yearNum > 2400 ? yearNum - 543 : yearNum;
  }

  if (rawYear.length === 2) {
    const currentYear = new Date().getFullYear();
    const candidateA = 2000 + yearNum;
    const candidateB = 1957 + yearNum;
    return Math.abs(candidateA - currentYear) <= Math.abs(candidateB - currentYear)
      ? candidateA
      : candidateB;
  }

  return yearNum;
}

function toDateRange(year: number, month: number, day: number): { start: Date; end: Date } | null {
  const start = new Date(year, month - 1, day);
  if (
    start.getFullYear() !== year ||
    start.getMonth() !== month - 1 ||
    start.getDate() !== day
  ) {
    return null;
  }
  const end = new Date(year, month - 1, day + 1);
  return { start, end };
}

function toMonthRange(year: number, month: number): { start: Date; end: Date } {
  const start = new Date(year, month - 1, 1);
  const end = new Date(year, month, 1);
  return { start, end };
}

function normalizeMonthKey(raw: string): string {
  return raw.replace(/\./g, '').trim();
}

function matchThaiMonthPrefix(search: string): number[] {
  const normalized = normalizeMonthKey(search);
  if (!normalized) return [];

  const months = new Set<number>();
  for (const [rawKey, monthValue] of Object.entries(THAI_MONTHS)) {
    const key = normalizeMonthKey(rawKey);
    if (key.startsWith(normalized)) {
      months.add(monthValue);
    }
  }

  return Array.from(months);
}

function parseDateSearch(search: string): { start: Date; end: Date } | null {
  const trimmed = search.trim();

  let match = trimmed.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (match) {
    const year = normalizeSearchYear(match[1]);
    if (!year) return null;
    return toDateRange(year, Number(match[2]), Number(match[3]));
  }

  match = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (match) {
    const year = normalizeSearchYear(match[3]);
    if (!year) return null;
    return toDateRange(year, Number(match[2]), Number(match[1]));
  }

  match = trimmed.match(/^(\d{1,2})\s+([^\s]+)\s+(\d{2,4})$/);
  if (match) {
    const day = Number(match[1]);
    const monthKey = match[2].replace(/\./g, '').trim();
    const month = THAI_MONTHS[monthKey];
    const year = normalizeSearchYear(match[3]);
    if (!month || !year) return null;
    return toDateRange(year, month, day);
  }

  match = trimmed.match(/^([^\s]+)\s+(\d{2,4})$/);
  if (match) {
    const monthKey = match[1].replace(/\./g, '').trim();
    const month = THAI_MONTHS[monthKey];
    const year = normalizeSearchYear(match[2]);
    if (!month || !year) return null;
    return toMonthRange(year, month);
  }

  return null;
}

// ========================================================================================
// USER ACTIONS - การดำเนินการของพนักงานทั่วไป
// ========================================================================================

/**
 * ✨ ฟังก์ชันสร้างคำขอมาสายใหม่
 * 
 * 🎯 เป้าหมาย: สร้างคำขอมาสายและคำนวณนาทีที่มาสาย
 * 
 * 💡 เหตุผล: ต้อง validate รูปแบบเวลาและตรวจสอบ duplicate ก่อนบันทึก
 *            เพื่อป้องกันการสร้างคำขอซ้ำในวันเดียวกัน
 *            ตรวจสอบ status != REJECTED เพราะคำขอที่ถูกปฏิเสธสามารถขอใหม่ได้
 */
async function createLateRequest(
  data: CreateLateRequestDTO
): Promise<LateRequestFrontend> {
  // ✅ Validate รูปแบบเวลา HH:MM (00:00 - 23:59)
  // เพื่อป้องกัน invalid format ก่อนที่จะคำนวณ
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  if (!timeRegex.test(data.scheduledTime) || !timeRegex.test(data.actualTime)) {
    throw new BadRequestError('รูปแบบเวลาไม่ถูกต้อง กรุณาใช้รูปแบบ HH:MM (เช่น 08:30)');
  }

  // 📊 คำนวณนาทีที่มาสายจากความต่างของเวลา
  const lateMinutes = calculateLateMinutes(data.scheduledTime, data.actualTime);

  // ⚠️ ต้องมาสายจริง (เวลามาถึงต้องมากกว่าเวลาที่กำหนด)
  if (lateMinutes <= 0) {
    throw new BadRequestError('เวลามาถึงต้องมากกว่าเวลาที่กำหนด');
  }

  // 🔍 ตรวจสอบว่า user มีอยู่จริงเพื่อป้องกัน invalid userId
  // SQL: SELECT * FROM User WHERE userId = ?
  const user = await prisma.user.findUnique({
    where: { userId: data.userId },
  });

  if (!user) {
    throw new NotFoundError('ไม่พบผู้ใช้');
  }

  // 🚫 ตรวจสอบคำขอซ้ำในวันเดียวกัน
  // เพื่อป้องกันการขอมาสายหลายครั้งในวันเดียวกัน
  // ยกเว้น status = REJECTED เพราะสามารถขอใหม่ได้ถ้าถูกปฏิเสธ
  // ⚠️ ต้อง filter deletedAt = null เพRAะเป็น soft delete เท่านั้น
  const requestDate = new Date(data.requestDate);
  const { start: requestDayStart, end: requestDayEnd } = getThaiDayRange(requestDate);

  const existingRequest = await prisma.lateRequest.findFirst({
    where: {
      userId: data.userId,
      requestDate: {
        gte: requestDayStart,
        lt: requestDayEnd,
      },
      status: { not: 'REJECTED' },
      deletedAt: null, // Filter out soft-deleted records
    },
  });

  if (existingRequest) {
    throw new ConflictError('มีคำขอมาสายในวันนี้อยู่แล้ว');
  }

  // 📝 บันทึกคำขอมาสายลงฐานข้อมูล สถานะเริ่มต้นเป็น PENDING
  const newLateRequest = await prisma.lateRequest.create({
    data: {
      userId: data.userId,
      attendanceId: data.attendanceId,
      requestDate,
      scheduledTime: data.scheduledTime,
      actualTime: data.actualTime,
      lateMinutes,
      reason: data.reason,
      attachmentUrl: data.attachmentUrl,
      status: 'PENDING',
    },
  });

  await createAuditLog({
    userId: data.userId,
    action: AuditAction.CREATE_LATE_REQUEST,
    targetTable: 'late_requests',
    targetId: newLateRequest.lateRequestId,
    newValues: { requestDate: data.requestDate, scheduledTime: data.scheduledTime, actualTime: data.actualTime, lateMinutes, reason: data.reason },
  });

  const latestMap = await getLatestLateApprovalMap([newLateRequest.lateRequestId]);
  const [enriched] = attachLateApprover([newLateRequest], latestMap);
  return mapLateRequestForFrontend(enriched);
}

/**
 * ดึงคำขอมาสายของผู้ใช้เอง
 */
async function getLateRequestsByUser(
  userId: number,
  status?: ApprovalStatus,
  skip?: number,
  take?: number,
  query?: string
): Promise<{ data: LateRequestFrontend[]; total: number }> {
  const where: Prisma.LateRequestWhereInput = { 
    userId,
    deletedAt: null,
  };

  if (status) {
    where.status = status;
  }

  const search = query?.trim();
  if (search) {
    const orConditions: Prisma.LateRequestWhereInput[] = [
      { reason: { contains: search, mode: 'insensitive' } },
      { rejectionReason: { contains: search, mode: 'insensitive' } },
    ];

    const dateRange = parseDateSearch(search);
    if (dateRange) {
      orConditions.push({ requestDate: { gte: dateRange.start, lt: dateRange.end } });
    }

    const dayMatch = search.match(/^\d{1,2}$/);
    if (dayMatch) {
      const dayPrefix = dayMatch[0];
      const rows = await prisma.$queryRaw<Array<{ lateRequestId: number }>>`
        SELECT late_request_id AS "lateRequestId"
        FROM late_requests
        WHERE user_id = ${userId}
          AND deleted_at IS NULL
          AND to_char(request_date, 'FMDD') LIKE ${`${dayPrefix}%`}
      `;
      const ids = rows.map((row) => row.lateRequestId).filter((id) => Number.isFinite(id));
      if (ids.length) {
        orConditions.push({ lateRequestId: { in: ids } });
      }
    }

    const monthCandidates = matchThaiMonthPrefix(search);
    if (monthCandidates.length) {
      const rows = await prisma.$queryRaw<Array<{ lateRequestId: number }>>`
        SELECT late_request_id AS "lateRequestId"
        FROM late_requests
        WHERE user_id = ${userId}
          AND deleted_at IS NULL
          AND EXTRACT(MONTH FROM request_date) IN (${Prisma.join(monthCandidates)})
      `;
      const ids = rows.map((row) => row.lateRequestId).filter((id) => Number.isFinite(id));
      if (ids.length) {
        orConditions.push({ lateRequestId: { in: ids } });
      }
    }

    where.OR = orConditions;
  }

  const [data, total] = await Promise.all([
    prisma.lateRequest.findMany({
      where,
      skip: skip || 0,
      take: take || 10,
      orderBy: { lateRequestId: 'desc' },
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
    prisma.lateRequest.count({ where }),
  ]);

  const latestMap = await getLatestLateApprovalMap(data.map((request) => request.lateRequestId));
  const enriched = attachLateApprover(data, latestMap);
  return { data: enriched.map(mapLateRequestForFrontend), total };
}

/**
 * ดึงคำขอมาสายด้วย ID
 */
async function getLateRequestById(
  lateRequestId: number
): Promise<LateRequestFrontend | null> {
  const lateRequest = await prisma.lateRequest.findFirst({
    where: { 
      lateRequestId,
      deletedAt: null,
    },
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

  if (!lateRequest) {
    return null;
  }

  const latestMap = await getLatestLateApprovalMap([lateRequestId]);
  const [enriched] = attachLateApprover([lateRequest], latestMap);
  return enriched ? mapLateRequestForFrontend(enriched) : null;
}

/**
 * แก้ไขคำขอมาสาย (อนุญาตแก้ไขเฉพาะ PENDING)
 */
async function updateLateRequest(
  lateRequestId: number,
  data: UpdateLateRequestDTO
): Promise<LateRequestFrontend> {
  const lateRequest = await prisma.lateRequest.findFirst({
    where: {
      lateRequestId,
      deletedAt: null,
    },
  });

  if (!lateRequest) {
    throw new NotFoundError('ไม่พบคำขอมาสาย');
  }

  if (lateRequest.status !== 'PENDING') {
    throw new BadRequestError('สามารถแก้ไขได้เฉพาะคำขอที่อยู่ในสถานะรอการอนุมัติเท่านั้น');
  }

  // Validate time format if provided
  if (data.scheduledTime || data.actualTime) {
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (data.scheduledTime && !timeRegex.test(data.scheduledTime)) {
      throw new BadRequestError('รูปแบบเวลาที่กำหนดไม่ถูกต้อง กรุณาใช้รูปแบบ HH:MM');
    }
    if (data.actualTime && !timeRegex.test(data.actualTime)) {
      throw new BadRequestError('รูปแบบเวลาที่มาจริงไม่ถูกต้อง กรุณาใช้รูปแบบ HH:MM');
    }
  }

  const scheduledTime = data.scheduledTime || lateRequest.scheduledTime;
  const actualTime = data.actualTime || lateRequest.actualTime;
  const requestDate = data.requestDate ? new Date(data.requestDate) : lateRequest.requestDate;

  // กันการย้ายวันแล้วชนกับคำขอเดิมที่ยังไม่ถูกปฏิเสธ
  const { start: requestDayStart, end: requestDayEnd } = getThaiDayRange(requestDate);
  const duplicateRequest = await prisma.lateRequest.findFirst({
    where: {
      userId: lateRequest.userId,
      lateRequestId: { not: lateRequestId },
      requestDate: {
        gte: requestDayStart,
        lt: requestDayEnd,
      },
      status: { not: 'REJECTED' },
      deletedAt: null,
    },
  });

  if (duplicateRequest) {
    throw new ConflictError('มีคำขอมาสายในวันนี้อยู่แล้ว');
  }

  // Recalculate late minutes if time changed
  const lateMinutes = calculateLateMinutes(scheduledTime, actualTime);

  if (lateMinutes <= 0) {
    throw new BadRequestError('เวลามาถึงต้องมากกว่าเวลาที่กำหนด');
  }

  const updatedLateRequest = await prisma.lateRequest.update({
    where: { lateRequestId },
    data: {
      requestDate,
      scheduledTime,
      actualTime,
      lateMinutes,
      reason: data.reason,
      attachmentUrl: data.attachmentUrl,
    },
  });

  await createAuditLog({
    userId: lateRequest.userId,
    action: AuditAction.UPDATE_LATE_REQUEST,
    targetTable: 'late_requests',
    targetId: lateRequestId,
    oldValues: { scheduledTime: lateRequest.scheduledTime, actualTime: lateRequest.actualTime, lateMinutes: lateRequest.lateMinutes, reason: lateRequest.reason },
    newValues: { scheduledTime, actualTime, lateMinutes, reason: data.reason },
  });

  const latestMap = await getLatestLateApprovalMap([updatedLateRequest.lateRequestId]);
  const [enriched] = attachLateApprover([updatedLateRequest], latestMap);
  return mapLateRequestForFrontend(enriched);
}

/**
 * ลบคำขอมาสาย (อนุญาตแค่เมื่อ PENDING)
 */
async function deleteLateRequest(lateRequestId: number): Promise<LateRequest> {
  const lateRequest = await prisma.lateRequest.findFirst({
    where: {
      lateRequestId,
      deletedAt: null,
    },
  });

  if (!lateRequest) {
    throw new NotFoundError('ไม่พบคำขอมาสาย');
  }

  if (lateRequest.status !== 'PENDING') {
    throw new BadRequestError('สามารถลบได้เฉพาะคำขอที่อยู่ในสถานะรอการอนุมัติเท่านั้น');
  }

  // Soft delete: set deletedAt instead of hard delete
  const deletedLateRequest = await prisma.lateRequest.update({
    where: { lateRequestId },
    data: {
      deletedAt: new Date(),
    },
  });

  await createAuditLog({
    userId: lateRequest.userId,
    action: AuditAction.DELETE_LATE_REQUEST,
    targetTable: 'late_requests',
    targetId: lateRequestId,
    oldValues: { requestDate: lateRequest.requestDate, scheduledTime: lateRequest.scheduledTime, actualTime: lateRequest.actualTime, reason: lateRequest.reason, status: lateRequest.status },
  });

  return deletedLateRequest;
}

/**
 * สถิติการมาสายของผู้ใช้
 */
async function getLateStatistics(userId: number): Promise<{
  total: number;
  approved: number;
  pending: number;
  rejected: number;
  totalLateMinutes: number;
  approvedLateMinutes: number;
}> {
  const baseWhere: Prisma.LateRequestWhereInput = { userId, deletedAt: null };

  const [total, approved, pending, rejected] = await Promise.all([
    prisma.lateRequest.count({ where: baseWhere }),
    prisma.lateRequest.count({ where: { ...baseWhere, status: 'APPROVED' } }),
    prisma.lateRequest.count({ where: { ...baseWhere, status: 'PENDING' } }),
    prisma.lateRequest.count({ where: { ...baseWhere, status: 'REJECTED' } }),
  ]);

  const allRequests = await prisma.lateRequest.findMany({
    where: baseWhere,
    select: { lateMinutes: true, status: true },
  });

  const totalLateMinutes = allRequests.reduce((sum, req) => sum + req.lateMinutes, 0);
  const approvedLateMinutes = allRequests
    .filter((req) => req.status === 'APPROVED')
    .reduce((sum, req) => sum + req.lateMinutes, 0);

  return {
    total,
    approved,
    pending,
    rejected,
    totalLateMinutes,
    approvedLateMinutes,
  };
}

async function findAttendanceForLateSync(
  tx: Prisma.TransactionClient,
  lateRequest: Pick<LateRequest, 'attendanceId' | 'userId' | 'requestDate'>,
) {
  if (lateRequest.attendanceId) {
    return tx.attendance.findFirst({
      where: {
        attendanceId: lateRequest.attendanceId,
        userId: lateRequest.userId,
        isDeleted: false,
      },
      include: {
        shift: {
          select: {
            startTime: true,
            gracePeriodMinutes: true,
            lateThresholdMinutes: true,
          },
        },
      },
    });
  }

  const { start, end } = getThaiDayRange(lateRequest.requestDate);
  return tx.attendance.findFirst({
    where: {
      userId: lateRequest.userId,
      isDeleted: false,
      checkIn: {
        gte: start,
        lt: end,
      },
    },
    orderBy: {
      checkIn: 'desc',
    },
    include: {
      shift: {
        select: {
          startTime: true,
          gracePeriodMinutes: true,
          lateThresholdMinutes: true,
        },
      },
    },
  });
}

async function syncAttendanceOnApprovedLate(
  tx: Prisma.TransactionClient,
  lateRequest: Pick<LateRequest, 'attendanceId' | 'userId' | 'requestDate' | 'scheduledTime' | 'actualTime'>,
): Promise<void> {
  const attendance = await findAttendanceForLateSync(tx, lateRequest);
  if (!attendance) return;

  if (attendance.status === 'LEAVE_APPROVED') {
    return;
  }

  const checkInTime = getThaiTimeHHMM(attendance.checkIn);
  const shiftPolicy = attendance.shift
    ? {
      startTime: attendance.shift.startTime,
      gracePeriodMinutes: attendance.shift.gracePeriodMinutes,
      lateThresholdMinutes: attendance.shift.lateThresholdMinutes,
    }
    : {
      startTime: lateRequest.scheduledTime,
      gracePeriodMinutes: 0,
      lateThresholdMinutes: 0,
    };

  const baseResolution = evaluateAttendanceStatus(checkInTime, shiftPolicy);
  const resolved = resolveAttendanceWithApprovedLateWindow({
    baseResolution,
    checkInTime,
    shiftStartTime: shiftPolicy.startTime,
    approvedActualTime: lateRequest.actualTime,
  });

  const nextStatus = resolved.status as AttendanceStatus;
  const nextLateMinutes = resolved.lateMinutes;
  const nextNote = resolved.message;

  if (
    attendance.status === nextStatus
    && (attendance.lateMinutes ?? 0) === nextLateMinutes
    && (attendance.note ?? '') === nextNote
  ) {
    return;
  }

  await tx.attendance.update({
    where: { attendanceId: attendance.attendanceId },
    data: {
      status: nextStatus,
      lateMinutes: nextLateMinutes,
      note: nextNote,
    },
  });
}

// ========================================================================================
// ADMIN ACTIONS - การดำเนินการของผู้จัดการ/แอดมิน
// ========================================================================================

/**
 * ดึงคำขอมาสายทั้งหมด (Admin only)
 */
async function getAllLateRequests(
  status?: ApprovalStatus,
  skip?: number,
  take?: number,
  userRole?: string, // Current user's role for approval hierarchy filtering
  currentUserId?: number // Current user's ID to include self-requests
): Promise<{ data: LateRequestFrontend[]; total: number }> {
  const where: Prisma.LateRequestWhereInput = { 
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
    const orConditions: Prisma.LateRequestWhereInput[] = [
      { user: { role: { in: ['MANAGER', 'USER'] } } },
    ];
    if (currentUserId) {
      orConditions.push({ userId: currentUserId });
    }
    where.OR = orConditions;
  } else if (normalizedRole === 'MANAGER') {
    // MANAGER can only approve USER requests, OR their own requests
    const orConditions: Prisma.LateRequestWhereInput[] = [
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
    prisma.lateRequest.findMany({
      where,
      skip: skip || 0,
      take: take || 10,
      orderBy: { lateRequestId: 'desc' },
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
    prisma.lateRequest.count({ where }),
  ]);

  const latestMap = await getLatestLateApprovalMap(data.map((request) => request.lateRequestId));
  const enriched = attachLateApprover(data, latestMap);
  const mapped = enriched.map(mapLateRequestForFrontend);

  return { data: mapped, total };
}

/**
 * อนุมัติคำขอมาสาย
 */
async function approveLateRequest(
  lateRequestId: number,
  data: ApproveLateRequestDTO
): Promise<LateRequestFrontend> {
  const lateRequest = await prisma.lateRequest.findFirst({
    where: {
      lateRequestId,
      deletedAt: null,
    },
    include: {
      user: {
        select: { role: true },
      },
    },
  });

  if (!lateRequest) {
    throw new NotFoundError('ไม่พบคำขอมาสาย');
  }

  if (lateRequest.status !== 'PENDING') {
    throw new ConflictError('ไม่สามารถอนุมัติคำขอที่มีสถานะอื่นได้');
  }

  // 🔐 ตรวจสอบ role hierarchy - Approver ต้องมี role ที่พอเพียง
  const approverUser = await prisma.user.findUnique({
    where: { userId: data.approvedByUserId },
    select: { role: true },
  });

  if (!approverUser) {
    throw new NotFoundError('ไม่พบผู้อนุมัติ');
  }

  const requesterRole = lateRequest.user.role;
  if (!canApprove(approverUser.role, requesterRole)) {
    throw new ForbiddenError(
      `${approverUser.role} ไม่สามารถอนุมัติคำขอของ ${requesterRole} ได้`
    );
  }

  const approvedRequest = await prisma.$transaction(async (tx) => {
    const updatedResult = await tx.lateRequest.updateMany({
      where: {
        lateRequestId,
        deletedAt: null,
        status: 'PENDING',
      },
      data: {
        status: 'APPROVED',
        adminComment: data.adminComment,
        rejectionReason: null,
      },
    });

    if (updatedResult.count === 0) {
      throw new ConflictError('ไม่สามารถอนุมัติคำขอที่มีสถานะอื่นได้');
    }

    await tx.approvalAction.create({
      data: {
        lateRequestId,
        actorUserId: data.approvedByUserId,
        action: 'APPROVED',
        adminComment: data.adminComment,
      },
    });

    const updated = await tx.lateRequest.findFirst({
      where: {
        lateRequestId,
        deletedAt: null,
      },
    });

    if (!updated) {
      throw new NotFoundError('ไม่พบคำขอมาสาย');
    }

    await syncAttendanceOnApprovedLate(tx, updated);

    return updated;
  });

  const latestMap = await getLatestLateApprovalMap([approvedRequest.lateRequestId]);
  const [enriched] = attachLateApprover([approvedRequest], latestMap);

  await createAuditLog({
    userId: data.approvedByUserId,
    action: AuditAction.APPROVE_LATE_REQUEST,
    targetTable: 'late_requests',
    targetId: lateRequestId,
    oldValues: { status: lateRequest.status },
    newValues: { status: 'APPROVED', adminComment: data.adminComment },
  });

  return mapLateRequestForFrontend(enriched);
}

/**
 * ปฏิเสธคำขอมาสาย
 */
async function rejectLateRequest(
  lateRequestId: number,
  data: RejectLateRequestDTO
): Promise<LateRequestFrontend> {
  const lateRequest = await prisma.lateRequest.findFirst({
    where: {
      lateRequestId,
      deletedAt: null,
    },
    include: {
      user: {
        select: { role: true },
      },
    },
  });

  if (!lateRequest) {
    throw new NotFoundError('ไม่พบคำขอมาสาย');
  }

  if (lateRequest.status !== 'PENDING') {
    throw new ConflictError('ไม่สามารถปฏิเสธคำขอที่มีสถานะอื่นได้');
  }

  // 🔐 ตรวจสอบ role hierarchy - Approver ต้องมี role ที่พอเพียง
  const approverUser = await prisma.user.findUnique({
    where: { userId: data.approvedByUserId },
    select: { role: true },
  });

  if (!approverUser) {
    throw new NotFoundError('ไม่พบผู้อนุมัติ');
  }

  const requesterRole = lateRequest.user.role;
  if (!canApprove(approverUser.role, requesterRole)) {
    throw new ForbiddenError(
      `${approverUser.role} ไม่สามารถปฏิเสธคำขอของ ${requesterRole} ได้`
    );
  }

  const rejectedRequest = await prisma.$transaction(async (tx) => {
    const updatedResult = await tx.lateRequest.updateMany({
      where: {
        lateRequestId,
        deletedAt: null,
        status: 'PENDING',
      },
      data: {
        status: 'REJECTED',
        rejectionReason: data.rejectionReason,
      },
    });

    if (updatedResult.count === 0) {
      throw new ConflictError('ไม่สามารถปฏิเสธคำขอที่มีสถานะอื่นได้');
    }

    await tx.approvalAction.create({
      data: {
        lateRequestId,
        actorUserId: data.approvedByUserId,
        action: 'REJECTED',
        rejectionReason: data.rejectionReason,
      },
    });

    const updated = await tx.lateRequest.findFirst({
      where: {
        lateRequestId,
        deletedAt: null,
      },
    });

    if (!updated) {
      throw new NotFoundError('ไม่พบคำขอมาสาย');
    }

    return updated;
  });

  const latestMap = await getLatestLateApprovalMap([rejectedRequest.lateRequestId]);
  const [enriched] = attachLateApprover([rejectedRequest], latestMap);

  await createAuditLog({
    userId: data.approvedByUserId,
    action: AuditAction.REJECT_LATE_REQUEST,
    targetTable: 'late_requests',
    targetId: lateRequestId,
    oldValues: { status: lateRequest.status },
    newValues: { status: 'REJECTED', rejectionReason: data.rejectionReason },
  });

  return mapLateRequestForFrontend(enriched);
}

// ========================================================================================
// EXPORTS - แยก exports เป็น 2 กลุ่มตามหน้าที่
// ========================================================================================

/**
 * User Actions - ใช้โดยพนักงานทั่วไป
 */
export const LateRequestUserActions = {
  createLateRequest,
  getLateRequestsByUser,
  getLateRequestById,
  updateLateRequest,
  deleteLateRequest,
  getLateStatistics,
};

/**
 * Admin Actions - ใช้โดยผู้จัดการ/แอดมิน
 */
export const LateRequestAdminActions = {
  getAllLateRequests,
  approveLateRequest,
  rejectLateRequest,
};
