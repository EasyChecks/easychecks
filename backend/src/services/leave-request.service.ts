import { prisma } from '../lib/prisma.js';
import type { LeaveRequest, LeaveStatus } from '@prisma/client';
import { differenceInBusinessDays, parseISO, format, isWeekend } from 'date-fns';

/**
 * Leave Request Service - จัดการใบลา
 * ใช้ date-fns สำหรับจัดการวันที่
 */

export interface CreateLeaveRequestDTO {
  userId: number;
  leaveType: 'SICK' | 'PERSONAL' | 'VACATION';
  startDate: Date;
  endDate: Date;
  reason?: string;
  attachmentUrl?: string;
}

export interface UpdateLeaveRequestDTO {
  leaveType?: 'SICK' | 'PERSONAL' | 'VACATION';
  startDate?: Date;
  endDate?: Date;
  reason?: string;
  attachmentUrl?: string;
}

export interface ApproveLeaveRequestDTO {
  approvedByUserId: number;
  adminComment?: string;
}

export interface RejectLeaveRequestDTO {
  approvedByUserId: number;
  rejectionReason: string;
}

/**
 * คำนวณจำนวนวันทำงาน (ไม่นับเสาร์-อาทิตย์)
 */
function calculateBusinessDays(startDate: Date, endDate: Date): number {
  const days = differenceInBusinessDays(endDate, startDate) + 1; // +1 เพราะนับวันเริ่มต้นด้วย
  return days > 0 ? days : 0;
}

// ========================================================================================
// USER ACTIONS - การดำเนินการของพนักงานทั่วไป
// ========================================================================================

/**
 * สร้างใบลาใหม่
 */
async function createLeaveRequest(
  data: CreateLeaveRequestDTO
): Promise<LeaveRequest> {
  // Validate dates
  const startDate = new Date(data.startDate);
  const endDate = new Date(data.endDate);

  if (startDate > endDate) {
    throw new Error('วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด');
  }

  // Check if user exists
  const user = await prisma.user.findUnique({
    where: { userId: data.userId },
  });

  if (!user) {
    throw new Error('ไม่พบผู้ใช้');
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
    throw new Error('มีใบลาที่ทับซ้อนกับช่วงวันที่นี้');
  }

  // Calculate number of business days
  const numberOfDays = calculateBusinessDays(startDate, endDate);

  if (numberOfDays <= 0) {
    throw new Error('ต้องเลือกช่วงวันที่อย่างน้อย 1 วันทำงาน');
  }

  return prisma.leaveRequest.create({
    data: {
      userId: data.userId,
      leaveType: data.leaveType,
      startDate,
      endDate,
      numberOfDays,
      reason: data.reason,
      attachmentUrl: data.attachmentUrl,
      status: 'PENDING',
    },
  });
}

/**
 * ดึงใบลาของผู้ใช้เอง
 */
async function getLeaveRequestsByUser(
  userId: number,
  status?: LeaveStatus,
  skip?: number,
  take?: number
): Promise<{ data: LeaveRequest[]; total: number }> {
  const where: any = { userId };

  if (status) {
    where.status = status;
  }

  const [data, total] = await Promise.all([
    prisma.leaveRequest.findMany({
      where,
      skip: skip || 0,
      take: take || 10,
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: {
            userId: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
        approver: {
          select: {
            userId: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    }),
    prisma.leaveRequest.count({ where }),
  ]);

  return { data, total };
}

/**
 * ดึงใบลาด้วย ID
 */
async function getLeaveRequestById(
  leaveId: number
): Promise<LeaveRequest | null> {
  return prisma.leaveRequest.findUnique({
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
      approver: {
        select: {
          userId: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });
}

/**
 * แก้ไขใบลา (อนุญาตแก้ไขเฉพาะใบลาที่ PENDING)
 */
async function updateLeaveRequest(
  leaveId: number,
  data: UpdateLeaveRequestDTO
): Promise<LeaveRequest> {
  const leaveRequest = await prisma.leaveRequest.findUnique({
    where: { leaveId },
  });

  if (!leaveRequest) {
    throw new Error('ไม่พบใบลา');
  }

  if (leaveRequest.status !== 'PENDING') {
    throw new Error('สามารถแก้ไขได้เฉพาะใบลาที่อยู่ในสถานะรอการอนุมัติเท่านั้น');
  }

  const startDate = data.startDate ? new Date(data.startDate) : leaveRequest.startDate;
  const endDate = data.endDate ? new Date(data.endDate) : leaveRequest.endDate;

  // Validate dates
  if (startDate > endDate) {
    throw new Error('วันที่เริ่มต้นต้องไม่เกินวันที่สิ้นสุด');
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
      throw new Error('มีใบลาที่ทับซ้อนกับช่วงวันที่นี้');
    }
  }

  // Calculate number of days
  const numberOfDays = calculateBusinessDays(startDate, endDate);

  if (numberOfDays <= 0) {
    throw new Error('ต้องเลือกช่วงวันที่อย่างน้อย 1 วันทำงาน');
  }

  return prisma.leaveRequest.update({
    where: { leaveId },
    data: {
      leaveType: data.leaveType,
      startDate,
      endDate,
      numberOfDays,
      reason: data.reason,
      attachmentUrl: data.attachmentUrl,
      updatedAt: new Date(),
    },
  });
}

/**
 * ลบใบลา (อนุญาตแค่เมื่อ PENDING)
 */
async function deleteLeaveRequest(leaveId: number): Promise<LeaveRequest> {
  const leaveRequest = await prisma.leaveRequest.findUnique({
    where: { leaveId },
  });

  if (!leaveRequest) {
    throw new Error('ไม่พบใบลา');
  }

  if (leaveRequest.status !== 'PENDING') {
    throw new Error('สามารถลบได้เฉพาะใบลาที่อยู่ในสถานะรอการอนุมัติเท่านั้น');
  }

  return prisma.leaveRequest.delete({
    where: { leaveId },
  });
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

  const totalDays = allLeaves.reduce((sum, leave) => sum + leave.numberOfDays, 0);
  const approvedDays = allLeaves
    .filter((leave) => leave.status === 'APPROVED')
    .reduce((sum, leave) => sum + leave.numberOfDays, 0);

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
): Promise<{ data: LeaveRequest[]; total: number }> {
  const where: any = {};

  if (status) {
    where.status = status;
  }

  const [data, total] = await Promise.all([
    prisma.leaveRequest.findMany({
      where,
      skip: skip || 0,
      take: take || 10,
      orderBy: { createdAt: 'desc' },
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
        approver: {
          select: {
            userId: true,
            firstName: true,
            lastName: true,
          },
        },
      },
    }),
    prisma.leaveRequest.count({ where }),
  ]);

  return { data, total };
}

/**
 * อนุมัติใบลา
 */
async function approveLeaveRequest(
  leaveId: number,
  data: ApproveLeaveRequestDTO
): Promise<LeaveRequest> {
  const leaveRequest = await prisma.leaveRequest.findUnique({
    where: { leaveId },
  });

  if (!leaveRequest) {
    throw new Error('ไม่พบใบลา');
  }

  if (leaveRequest.status !== 'PENDING') {
    throw new Error('ไม่สามารถอนุมัติใบลาที่มีสถานะอื่นได้');
  }

  return prisma.leaveRequest.update({
    where: { leaveId },
    data: {
      status: 'APPROVED',
      approvedByUserId: data.approvedByUserId,
      adminComment: data.adminComment,
      approvedAt: new Date(),
      updatedAt: new Date(),
    },
  });
}

/**
 * ปฏิเสธใบลา
 */
async function rejectLeaveRequest(
  leaveId: number,
  data: RejectLeaveRequestDTO
): Promise<LeaveRequest> {
  const leaveRequest = await prisma.leaveRequest.findUnique({
    where: { leaveId },
  });

  if (!leaveRequest) {
    throw new Error('ไม่พบใบลา');
  }

  if (leaveRequest.status !== 'PENDING') {
    throw new Error('ไม่สามารถปฏิเสธใบลาที่มีสถานะอื่นได้');
  }

  return prisma.leaveRequest.update({
    where: { leaveId },
    data: {
      status: 'REJECTED',
      approvedByUserId: data.approvedByUserId,
      rejectionReason: data.rejectionReason,
      approvedAt: new Date(),
      updatedAt: new Date(),
    },
  });
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
};

/**
 * Admin Actions - ใช้โดยผู้จัดการ/แอดมิน
 */
export const LeaveRequestAdminActions = {
  getAllLeaveRequests,
  approveLeaveRequest,
  rejectLeaveRequest,
};
