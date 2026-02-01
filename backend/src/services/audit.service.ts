import { prisma } from '../lib/prisma.js';

/**
 * 📋 Audit Service - บันทึก Log ทุกการกระทำ
 */

export interface CreateAuditLogDTO {
  userId: number;
  action: string;
  targetTable: string;
  targetId: number;
  oldValues?: any;
  newValues?: any;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * บันทึก Audit Log
 */
export const createAuditLog = async (data: CreateAuditLogDTO) => {
  try {
    const log = await prisma.auditLog.create({
      data: {
        userId: data.userId,
        action: data.action,
        targetTable: data.targetTable,
        targetId: data.targetId,
        oldValues: data.oldValues || null,
        newValues: data.newValues || null,
        ipAddress: data.ipAddress || null,
        userAgent: data.userAgent || null,
      },
    });
    return log;
  } catch (error) {
    console.error('Failed to create audit log:', error);
    // ไม่ throw error เพื่อไม่ให้ audit log failure กระทบ main operation
  }
};

/**
 * ดึง Audit Logs ตาม filters
 */
export const getAuditLogs = async (filters?: {
  userId?: number;
  action?: string;
  targetTable?: string;
  targetId?: number;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
}) => {
  const logs = await prisma.auditLog.findMany({
    where: {
      ...(filters?.userId && { userId: filters.userId }),
      ...(filters?.action && { action: filters.action }),
      ...(filters?.targetTable && { targetTable: filters.targetTable }),
      ...(filters?.targetId && { targetId: filters.targetId }),
      ...(filters?.startDate || filters?.endDate) && {
        createdAt: {
          ...(filters?.startDate && { gte: filters.startDate }),
          ...(filters?.endDate && { lte: filters.endDate }),
        },
      },
    },
    include: {
      user: {
        select: {
          userId: true,
          firstName: true,
          lastName: true,
          employeeId: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc',
    },
    take: filters?.limit || 100,
  });

  return logs;
};

// Action constants
export const AuditAction = {
  // Shift
  CREATE_SHIFT: 'CREATE_SHIFT',
  UPDATE_SHIFT: 'UPDATE_SHIFT',
  DELETE_SHIFT: 'DELETE_SHIFT',
  
  // Attendance
  CHECK_IN: 'CHECK_IN',
  CHECK_OUT: 'CHECK_OUT',
  UPDATE_ATTENDANCE: 'UPDATE_ATTENDANCE',
  DELETE_ATTENDANCE: 'DELETE_ATTENDANCE',
  
  // User
  CREATE_USER: 'CREATE_USER',
  UPDATE_USER: 'UPDATE_USER',
  DELETE_USER: 'DELETE_USER',
  
  // Leave
  CREATE_LEAVE: 'CREATE_LEAVE',
  APPROVE_LEAVE: 'APPROVE_LEAVE',
  REJECT_LEAVE: 'REJECT_LEAVE',
  CANCEL_LEAVE: 'CANCEL_LEAVE',
} as const;
