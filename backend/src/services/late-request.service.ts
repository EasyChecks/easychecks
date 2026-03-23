import { prisma } from '../lib/prisma.js';
import type { LateRequest, ApprovalStatus, Gender, ApprovalActionType } from '@prisma/client';
import { differenceInMinutes, parse, format } from 'date-fns';
import { createAuditLog, AuditAction } from './audit.service.js';

/**
 * Late Request Service - จัดการการขอมาสาย
 * ใช้ date-fns สำหรับจัดการเวลา
 */

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
  try {
    const baseDate = '2000-01-01'; // ใช้วันเดียวกันสำหรับเปรียบเทียบเวลา
    const scheduled = parse(`${baseDate} ${scheduledTime}`, 'yyyy-MM-dd HH:mm', new Date());
    const actual = parse(`${baseDate} ${actualTime}`, 'yyyy-MM-dd HH:mm', new Date());

    const minutes = differenceInMinutes(actual, scheduled);
    return minutes > 0 ? minutes : 0;
  } catch (error) {
    throw new Error('รูปแบบเวลาไม่ถูกต้อง กรุณาใช้รูปแบบ HH:MM');
  }
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
): Promise<LateRequestWithApprover> {
  // ✅ Validate รูปแบบเวลา HH:MM (00:00 - 23:59)
  // เพื่อป้องกัน invalid format ก่อนที่จะคำนวณ
  const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
  if (!timeRegex.test(data.scheduledTime) || !timeRegex.test(data.actualTime)) {
    throw new Error('รูปแบบเวลาไม่ถูกต้อง กรุณาใช้รูปแบบ HH:MM (เช่น 08:30)');
  }

  // 📊 คำนวณนาทีที่มาสายจากความต่างของเวลา
  const lateMinutes = calculateLateMinutes(data.scheduledTime, data.actualTime);

  // ⚠️ ต้องมาสายจริง (เวลามาถึงต้องมากกว่าเวลาที่กำหนด)
  if (lateMinutes <= 0) {
    throw new Error('เวลามาถึงต้องมากกว่าเวลาที่กำหนด');
  }

  // 🔍 ตรวจสอบว่า user มีอยู่จริงเพื่อป้องกัน invalid userId
  // SQL: SELECT * FROM User WHERE userId = ?
  const user = await prisma.user.findUnique({
    where: { userId: data.userId },
  });

  if (!user) {
    throw new Error('ไม่พบผู้ใช้');
  }

  // 🚫 ตรวจสอบคำขอซ้ำในวันเดียวกัน
  // เพื่อป้องกันการขอมาสายหลายครั้งในวันเดียวกัน
  // ยกเว้น status = REJECTED เพราะสามารถขอใหม่ได้ถ้าถูกปฏิเสธ
  // SQL: SELECT * FROM LateRequest 
  //      WHERE userId = ? AND requestDate = ? AND status != 'REJECTED'
  //      LIMIT 1
  const existingRequest = await prisma.lateRequest.findFirst({
    where: {
      userId: data.userId,
      requestDate: new Date(data.requestDate),
      status: { not: 'REJECTED' },
    },
  });

  if (existingRequest) {
    throw new Error('มีคำขอมาสายในวันนี้อยู่แล้ว');
  }

  // 📝 บันทึกคำขอมาสายลงฐานข้อมูล สถานะเริ่มต้นเป็น PENDING
  const newLateRequest = await prisma.lateRequest.create({
    data: {
      userId: data.userId,
      attendanceId: data.attendanceId,
      requestDate: new Date(data.requestDate),
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
  return enriched;
}

/**
 * ดึงคำขอมาสายของผู้ใช้เอง
 */
async function getLateRequestsByUser(
  userId: number,
  status?: ApprovalStatus,
  skip?: number,
  take?: number
): Promise<{ data: LateRequestWithApprover[]; total: number }> {
  const where: any = { userId };

  if (status) {
    where.status = status;
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
  return { data: attachLateApprover(data, latestMap), total };
}

/**
 * ดึงคำขอมาสายด้วย ID
 */
async function getLateRequestById(
  lateRequestId: number
): Promise<LateRequestWithApprover | null> {
  const lateRequest = await prisma.lateRequest.findUnique({
    where: { lateRequestId },
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
  return enriched;
}

/**
 * แก้ไขคำขอมาสาย (อนุญาตแก้ไขเฉพาะ PENDING)
 */
async function updateLateRequest(
  lateRequestId: number,
  data: UpdateLateRequestDTO
): Promise<LateRequestWithApprover> {
  const lateRequest = await prisma.lateRequest.findUnique({
    where: { lateRequestId },
  });

  if (!lateRequest) {
    throw new Error('ไม่พบคำขอมาสาย');
  }

  if (lateRequest.status !== 'PENDING') {
    throw new Error('สามารถแก้ไขได้เฉพาะคำขอที่อยู่ในสถานะรอการอนุมัติเท่านั้น');
  }

  // Validate time format if provided
  if (data.scheduledTime || data.actualTime) {
    const timeRegex = /^([01]\d|2[0-3]):([0-5]\d)$/;
    if (data.scheduledTime && !timeRegex.test(data.scheduledTime)) {
      throw new Error('รูปแบบเวลาที่กำหนดไม่ถูกต้อง กรุณาใช้รูปแบบ HH:MM');
    }
    if (data.actualTime && !timeRegex.test(data.actualTime)) {
      throw new Error('รูปแบบเวลาที่มาจริงไม่ถูกต้อง กรุณาใช้รูปแบบ HH:MM');
    }
  }

  const scheduledTime = data.scheduledTime || lateRequest.scheduledTime;
  const actualTime = data.actualTime || lateRequest.actualTime;

  // Recalculate late minutes if time changed
  const lateMinutes = calculateLateMinutes(scheduledTime, actualTime);

  if (lateMinutes <= 0) {
    throw new Error('เวลามาถึงต้องมากกว่าเวลาที่กำหนด');
  }

  const updatedLateRequest = await prisma.lateRequest.update({
    where: { lateRequestId },
    data: {
      requestDate: data.requestDate ? new Date(data.requestDate) : undefined,
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
  return enriched;
}

/**
 * ลบคำขอมาสาย (อนุญาตแค่เมื่อ PENDING)
 */
async function deleteLateRequest(lateRequestId: number): Promise<LateRequest> {
  const lateRequest = await prisma.lateRequest.findUnique({
    where: { lateRequestId },
  });

  if (!lateRequest) {
    throw new Error('ไม่พบคำขอมาสาย');
  }

  if (lateRequest.status !== 'PENDING') {
    throw new Error('สามารถลบได้เฉพาะคำขอที่อยู่ในสถานะรอการอนุมัติเท่านั้น');
  }

  const deletedLateRequest = await prisma.lateRequest.delete({
    where: { lateRequestId },
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
  const [total, approved, pending, rejected] = await Promise.all([
    prisma.lateRequest.count({ where: { userId } }),
    prisma.lateRequest.count({ where: { userId, status: 'APPROVED' } }),
    prisma.lateRequest.count({ where: { userId, status: 'PENDING' } }),
    prisma.lateRequest.count({ where: { userId, status: 'REJECTED' } }),
  ]);

  const allRequests = await prisma.lateRequest.findMany({
    where: { userId },
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

// ========================================================================================
// ADMIN ACTIONS - การดำเนินการของผู้จัดการ/แอดมิน
// ========================================================================================

/**
 * ดึงคำขอมาสายทั้งหมด (Admin only)
 */
async function getAllLateRequests(
  status?: ApprovalStatus,
  skip?: number,
  take?: number
): Promise<{ data: LateRequestWithApprover[]; total: number }> {
  const where: any = {};

  if (status) {
    where.status = status;
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
  return { data: attachLateApprover(data, latestMap), total };
}

/**
 * อนุมัติคำขอมาสาย
 */
async function approveLateRequest(
  lateRequestId: number,
  data: ApproveLateRequestDTO
): Promise<LateRequestWithApprover> {
  const lateRequest = await prisma.lateRequest.findUnique({
    where: { lateRequestId },
  });

  if (!lateRequest) {
    throw new Error('ไม่พบคำขอมาสาย');
  }

  if (lateRequest.status !== 'PENDING') {
    throw new Error('ไม่สามารถอนุมัติคำขอที่มีสถานะอื่นได้');
  }

  const approvedRequest = await prisma.$transaction(async (tx) => {
    const updated = await tx.lateRequest.update({
      where: { lateRequestId },
      data: {
        status: 'APPROVED',
        adminComment: data.adminComment,
        rejectionReason: null,
      },
    });

    await tx.approvalAction.create({
      data: {
        lateRequestId,
        actorUserId: data.approvedByUserId,
        action: 'APPROVED',
        adminComment: data.adminComment,
      },
    });

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

  return enriched;
}

/**
 * ปฏิเสธคำขอมาสาย
 */
async function rejectLateRequest(
  lateRequestId: number,
  data: RejectLateRequestDTO
): Promise<LateRequestWithApprover> {
  const lateRequest = await prisma.lateRequest.findUnique({
    where: { lateRequestId },
  });

  if (!lateRequest) {
    throw new Error('ไม่พบคำขอมาสาย');
  }

  if (lateRequest.status !== 'PENDING') {
    throw new Error('ไม่สามารถปฏิเสธคำขอที่มีสถานะอื่นได้');
  }

  const rejectedRequest = await prisma.$transaction(async (tx) => {
    const updated = await tx.lateRequest.update({
      where: { lateRequestId },
      data: {
        status: 'REJECTED',
        rejectionReason: data.rejectionReason,
      },
    });

    await tx.approvalAction.create({
      data: {
        lateRequestId,
        actorUserId: data.approvedByUserId,
        action: 'REJECTED',
        rejectionReason: data.rejectionReason,
      },
    });

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

  return enriched;
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
