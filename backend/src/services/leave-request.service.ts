import { prisma } from '../lib/prisma.js';
import type { LeaveRequest, LeaveStatus, LeaveType, Gender } from '@prisma/client';
import { differenceInBusinessDays, parseISO, format, isWeekend, startOfYear, endOfYear } from 'date-fns';
import { createAuditLog, AuditAction } from './audit.service.js';

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
  startDate: Date;
  endDate: Date;
  reason?: string;
  attachmentUrl?: string;
  medicalCertificateUrl?: string; // ใบรับรองแพทย์
}

export interface UpdateLeaveRequestDTO {
  leaveType?: LeaveType;
  startDate?: Date;
  endDate?: Date;
  reason?: string;
  attachmentUrl?: string;
  medicalCertificateUrl?: string;
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
      deletedAt: null,
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
      deletedAt: null,
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
    select: { userId: true, gender: true },
  });

  if (!user) {
    throw new Error('ไม่พบผู้ใช้');
  }

  // Calculate number of business days
  const numberOfDays = calculateBusinessDays(startDate, endDate);

  if (numberOfDays <= 0) {
    throw new Error('ต้องเลือกช่วงวันที่อย่างน้อย 1 วันทำงาน');
  }

  // Validate leave request based on type
  const validation = await validateLeaveRequest(
    data.userId,
    data.leaveType,
    numberOfDays,
    data.medicalCertificateUrl
  );

  if (!validation.isValid) {
    throw new Error(validation.message || 'ข้อมูลการลาไม่ถูกต้อง');
  }

  // Check for overlapping leave requests
  const overlappingLeave = await prisma.leaveRequest.findFirst({
    where: {
      userId: data.userId,
      status: { not: 'REJECTED' },
      deletedAt: null,
      AND: [
        { startDate: { lte: endDate } },
        { endDate: { gte: startDate } },
      ],
    },
  });

  if (overlappingLeave) {
    throw new Error('มีใบลาที่ทับซ้อนกับช่วงวันที่นี้');
  }

  // Calculate paid days
  const paidDays = calculatePaidDays(data.leaveType, numberOfDays);

  const newLeaveRequest = await prisma.leaveRequest.create({
    data: {
      userId: data.userId,
      leaveType: data.leaveType,
      startDate,
      endDate,
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
      approver: {
        select: {
          userId: true,
          employeeId: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  await createAuditLog({
    userId: data.userId,
    action: AuditAction.CREATE_LEAVE,
    targetTable: 'leave_requests',
    targetId: newLeaveRequest.leaveId,
    newValues: { leaveType: data.leaveType, startDate, endDate, numberOfDays, paidDays, reason: data.reason },
  });

  return newLeaveRequest;
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
async function getLeaveRequestById(leaveId: number) {
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

  // Calculate paid days if leaveType is provided
  const leaveType = data.leaveType || leaveRequest.leaveType;
  const paidDays = calculatePaidDays(leaveType, numberOfDays);

  const updatedLeave = await prisma.leaveRequest.update({
    where: { leaveId },
    data: {
      ...(data.leaveType && { leaveType: data.leaveType }),
      startDate,
      endDate,
      numberOfDays: numberOfDays,
      paidDays: paidDays,
      ...(data.reason && { reason: data.reason }),
      ...(data.attachmentUrl && { attachmentUrl: data.attachmentUrl }),
      ...(data.medicalCertificateUrl && { medicalCertificateUrl: data.medicalCertificateUrl }),
      updatedAt: new Date(),
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
      approver: {
        select: {
          userId: true,
          employeeId: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  await createAuditLog({
    userId: leaveRequest.userId,
    action: AuditAction.UPDATE_LEAVE,
    targetTable: 'leave_requests',
    targetId: leaveId,
    oldValues: { leaveType: leaveRequest.leaveType, startDate: leaveRequest.startDate, endDate: leaveRequest.endDate, reason: leaveRequest.reason },
    newValues: { leaveType: updatedLeave.leaveType, startDate: updatedLeave.startDate, endDate: updatedLeave.endDate, reason: updatedLeave.reason },
  });

  return updatedLeave;
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

  const approvedLeave = await prisma.leaveRequest.update({
    where: { leaveId },
    data: {
      status: 'APPROVED',
      approvedByUserId: data.approvedByUserId,
      adminComment: data.adminComment,
      approvedAt: new Date(),
      updatedAt: new Date(),
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
      approver: {
        select: {
          userId: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  await createAuditLog({
    userId: data.approvedByUserId,
    action: AuditAction.APPROVE_LEAVE,
    targetTable: 'leave_requests',
    targetId: leaveId,
    oldValues: { status: leaveRequest.status },
    newValues: { status: 'APPROVED', adminComment: data.adminComment },
  });

  return approvedLeave;
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

  const rejectedLeave = await prisma.leaveRequest.update({
    where: { leaveId },
    data: {
      status: 'REJECTED',
      approvedByUserId: data.approvedByUserId,
      rejectionReason: data.rejectionReason,
      approvedAt: new Date(),
      updatedAt: new Date(),
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
      approver: {
        select: {
          userId: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  await createAuditLog({
    userId: data.approvedByUserId,
    action: AuditAction.REJECT_LEAVE,
    targetTable: 'leave_requests',
    targetId: leaveId,
    oldValues: { status: leaveRequest.status },
    newValues: { status: 'REJECTED', rejectionReason: data.rejectionReason },
  });

  return rejectedLeave;
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
