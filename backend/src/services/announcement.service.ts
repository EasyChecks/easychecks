import { PrismaClient, Role } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { createAuditLog, AuditAction } from './audit.service.js';

/**
 * 📢 Announcement Service - จัดการประกาศ/ข่าวสาร
 */

// ============================================
// 📦 DTOs (Data Transfer Objects)
// ============================================

export interface CreateAnnouncementDTO {
  title: string;                    // หัวข้อประกาศ (จำเป็น)
  content: string;                  // เนื้อหาประกาศ (จำเป็น)
  targetAudience: string;           // EVERYONE | SPECIFIC_ROLE | SPECIFIC_BRANCH | SPECIFIC_GROUP
  targetRoles?: string[];           // บุคลากรประเภท (ถ้า SPECIFIC_ROLE)
  targetBranchIds?: number[];       // สาขาเฉพาะ (ถ้า SPECIFIC_BRANCH)
  channel?: string;                 // ช่องส่ง (default: GMAIL)
  createdByUserId: number;          // ผู้สร้าง
  creatorRole: string;              // Role ของผู้สร้าง (SUPERADMIN/ADMIN)
}

export interface UpdateAnnouncementDTO {
  title?: string;
  content?: string;
  targetAudience?: string;
  targetRoles?: string[];
  targetBranchIds?: number[];
  status?: string;
}

// ============================================
// 📋 Main Functions
// ============================================

/**
 * ➕ สร้างประกาศใหม่
 */
export const createAnnouncement = async (data: CreateAnnouncementDTO) => {
  // ตรวจสอบข้อมูล
  if (!data.title || !data.content) {
    throw new Error('ต้องระบุ title และ content');
  }

  // สร้างประกาศ
  const announcement = await prisma.announcement.create({
    data: {
      title: data.title,
      content: data.content,
      targetAudience: data.targetAudience || 'EVERYONE',
      targetRoles: data.targetRoles || [],
      targetBranchIds: data.targetBranchIds || [],
      channel: data.channel || 'GMAIL',
      status: 'DRAFT',
      createdByUserId: data.createdByUserId,
    },
    include: {
      creator: {
        select: {
          userId: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  // บันทึก Audit Log
  await createAuditLog({
    userId: data.createdByUserId,
    action: AuditAction.CREATE_ANNOUNCEMENT,
    targetTable: 'announcements',
    targetId: announcement.announcementId,
    newValues: announcement,
  });

  return announcement;
};

/**
 * 📋 ดึงประกาศทั้งหมด
 */
export const getAnnouncements = async (
  filters?: {
    status?: string;
    createdByUserId?: number;
  }
) => {
  const whereClause: any = {};
  
  if (filters?.status) {
    whereClause.status = filters.status;
  }
  if (filters?.createdByUserId) {
    whereClause.createdByUserId = filters.createdByUserId;
  }
  // ไม่ดึงข้อมูลที่ลบไปแล้ว
  whereClause.deletedAt = null;

  const announcements = await prisma.announcement.findMany({
    where: whereClause,
    include: {
      creator: {
        select: {
          userId: true,
          firstName: true,
          lastName: true,
        },
      },
      approvedBy: {
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

  return announcements;
};

/**
 * 🔍 ดึงประกาศตาม ID
 */
export const getAnnouncementById = async (announcementId: number) => {
  const announcement = await prisma.announcement.findUnique({
    where: { announcementId },
    include: {
      creator: {
        select: {
          userId: true,
          firstName: true,
          lastName: true,
        },
      },
      approvedBy: {
        select: {
          userId: true,
          firstName: true,
          lastName: true,
        },
      },
      recipients: {
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
      },
    },
  });

  if (!announcement) {
    throw new Error('ไม่พบประกาศที่ระบุ');
  }

  return announcement;
};

/**
 * ✏️ อัปเดตประกาศ
 */
export const updateAnnouncement = async (
  announcementId: number,
  data: UpdateAnnouncementDTO,
  updatedByUserId: number
) => {
  const existing = await prisma.announcement.findUnique({
    where: { announcementId },
  });

  if (!existing) {
    throw new Error('ไม่พบประกาศที่ระบุ');
  }

  // ถ้าประกาศถูกส่งไปแล้ว ไม่สามารถแก้ไข
  if (existing.status === 'SENT') {
    throw new Error('ไม่สามารถแก้ไขประกาศที่ส่งไปแล้ว');
  }

  const updated = await prisma.announcement.update({
    where: { announcementId },
    data: {
      ...(data.title && { title: data.title }),
      ...(data.content && { content: data.content }),
      ...(data.targetAudience && { targetAudience: data.targetAudience }),
      ...(data.targetRoles && { targetRoles: data.targetRoles }),
      ...(data.targetBranchIds && { targetBranchIds: data.targetBranchIds }),
      updatedByUserId,
    },
    include: {
      creator: {
        select: {
          userId: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  // บันทึก Audit Log
  await createAuditLog({
    userId: updatedByUserId,
    action: AuditAction.UPDATE_ANNOUNCEMENT,
    targetTable: 'announcements',
    targetId: announcementId,
    oldValues: existing,
    newValues: updated,
  });

  return updated;
};

/**
 * ✅ อนุมัติประกาศ
 */
export const approveAnnouncement = async (
  announcementId: number,
  approvedByUserId: number
) => {
  const existing = await prisma.announcement.findUnique({
    where: { announcementId },
  });

  if (!existing) {
    throw new Error('ไม่พบประกาศที่ระบุ');
  }

  if (existing.status !== 'PENDING') {
    throw new Error('ประกาศต้องอยู่ในสถานะ PENDING ถึงจะอนุมัติได้');
  }

  const updated = await prisma.announcement.update({
    where: { announcementId },
    data: {
      status: 'APPROVED',
      approvedByUserId,
      approvedAt: new Date(),
    },
    include: {
      approvedBy: {
        select: {
          userId: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  // บันทึก Audit Log
  await createAuditLog({
    userId: approvedByUserId,
    action: AuditAction.APPROVE_ANNOUNCEMENT,
    targetTable: 'announcements',
    targetId: announcementId,
    newValues: { status: 'APPROVED' },
  });

  return updated;
};

/**
 * ❌ ปฏิเสธประกาศ
 */
export const rejectAnnouncement = async (
  announcementId: number,
  rejectedByUserId: number,
  rejectionReason: string
) => {
  const existing = await prisma.announcement.findUnique({
    where: { announcementId },
  });

  if (!existing) {
    throw new Error('ไม่พบประกาศที่ระบุ');
  }

  const updated = await prisma.announcement.update({
    where: { announcementId },
    data: {
      status: 'SUSPENDED',
      rejectionReason,
    },
  });

  // บันทึก Audit Log
  await createAuditLog({
    userId: rejectedByUserId,
    action: AuditAction.REJECT_ANNOUNCEMENT,
    targetTable: 'announcements',
    targetId: announcementId,
    newValues: { status: 'SUSPENDED', rejectionReason },
  });

  return updated;
};

/**
 * 📤 ส่งประกาศ
 * 
 * Permission Check:
 * - ADMIN: ส่งได้เฉพาะใน branch เดียวกัน + ไม่สามารถส่งให้ SUPER_ADMIN
 * - SUPER_ADMIN: ส่งได้ทุกคน ทุก Role
 */
export const sendAnnouncement = async (
  announcementId: number,
  sentByUserId: number,
  sentByUserRole: string,
  sentByUserBranchId?: number
) => {
  const announcement = await prisma.announcement.findUnique({
    where: { announcementId },
  });

  if (!announcement) {
    throw new Error('ไม่พบประกาศที่ระบุ');
  }

  if (announcement.status !== 'APPROVED') {
    throw new Error('ประกาศต้องผ่านการอนุมัติเสียก่อน');
  }

  // ดึงรายชื่อผู้รับตามเงื่อนไข
  let recipientIds: number[] = [];
  let recipientQuery: any = { status: 'ACTIVE' };

  // Target Audience Filtering
  if (announcement.targetAudience === 'EVERYONE') {
    recipientQuery = { status: 'ACTIVE' };
  } else if (announcement.targetAudience === 'SPECIFIC_ROLE') {
    recipientQuery = {
      status: 'ACTIVE',
      role: { in: (announcement.targetRoles || []) as any },
    };
  } else if (announcement.targetAudience === 'SPECIFIC_BRANCH') {
    recipientQuery = {
      status: 'ACTIVE',
      branchId: { in: announcement.targetBranchIds },
    };
  }

  // Permission Check & Apply Restrictions
  if (sentByUserRole === 'ADMIN') {
    // ADMIN สามารถส่งได้เฉพาะใน branch เดียวกัน
    if (!sentByUserBranchId) {
      throw new Error('Admin ต้องมี branchId เพื่อส่งประกาศ');
    }
    recipientQuery.branchId = sentByUserBranchId;
    
    // ADMIN ไม่สามารถส่งให้ SUPER_ADMIN
    recipientQuery.role = { not: 'SUPERADMIN' };
  } else if (sentByUserRole === 'SUPER_ADMIN') {
    // SUPER_ADMIN สามารถส่งให้ทุกคน ทุก Role (ใช้ query เดิม)
  } else {
    // Role อื่นไม่สามารถส่งประกาศได้
    throw new Error('เฉพาะ Admin และ Super Admin เท่านั้นที่สามารถส่งประกาศได้');
  }

  // ดึง recipients
  const users = await prisma.user.findMany({
    where: recipientQuery,
    select: { userId: true },
  });
  recipientIds = users.map((u) => u.userId);

  // บันทึกผู้รับ
  if (recipientIds.length > 0) {
    await prisma.announcementRecipient.createMany({
      data: recipientIds.map((userId) => ({
        announcementId,
        userId,
        sentAt: new Date(),
      })),
    });
  }

  // อัปเดตสถานะประกาศ
  const updated = await prisma.announcement.update({
    where: { announcementId },
    data: {
      status: 'SENT',
      sentAt: new Date(),
      sentByUserId,
    },
  });

  // บันทึก Audit Log
  await createAuditLog({
    userId: sentByUserId,
    action: AuditAction.SEND_ANNOUNCEMENT,
    targetTable: 'announcements',
    targetId: announcementId,
    newValues: { status: 'SENT', sentAt: new Date(), recipientCount: recipientIds.length },
  });

  return {
    announcement: updated,
    recipientCount: recipientIds.length,
  };
};

/**
 * 🗑️ ลบประกาศ (Soft Delete)
 */
export const deleteAnnouncement = async (
  announcementId: number,
  deletedByUserId: number,
  deleteReason: string
) => {
  const existing = await prisma.announcement.findUnique({
    where: { announcementId },
  });

  if (!existing) {
    throw new Error('ไม่พบประกาศที่ระบุ');
  }

  const deleted = await prisma.announcement.update({
    where: { announcementId },
    data: {
      deletedAt: new Date(),
      deletedByUserId,
      deleteReason,
    },
  });

  // บันทึก Audit Log
  await createAuditLog({
    userId: deletedByUserId,
    action: AuditAction.DELETE_ANNOUNCEMENT,
    targetTable: 'announcements',
    targetId: announcementId,
    oldValues: existing,
    newValues: { deletedAt: new Date(), deleteReason },
  });

  return deleted;
};

/**
 * 🗑️ ลบรายการที่ส่งไป (Delete Single Recipient)
 */
export const deleteRecipient = async (
  recipientId: number,
  deletedByUserId: number
) => {
  const recipient = await prisma.announcementRecipient.findUnique({
    where: { recipientId },
  });

  if (!recipient) {
    throw new Error('ไม่พบรายการที่ส่ง');
  }

  // ลบ recipient record
  const deleted = await prisma.announcementRecipient.delete({
    where: { recipientId },
  });

  // บันทึก Audit Log
  await createAuditLog({
    userId: deletedByUserId,
    action: AuditAction.DELETE_ANNOUNCEMENT,
    targetTable: 'announcement_recipients',
    targetId: recipientId,
    oldValues: recipient,
  });

  return deleted;
};

/**
 * 🗑️ ล้างประวัติทั้งหมด (Clear All Recipients)
 * 
 * ลบทั้งหมดที่ user นั้นส่ง - ไม่ส่งผลต่อ user อื่น
 */
export const clearAllRecipients = async (
  sentByUserId: number,
  clearedByUserId: number
) => {
  // ดึงทั้งหมดที่ user นั้นส่ง
  const recipients = await prisma.announcementRecipient.findMany({
    where: {
      announcement: {
        sentByUserId,
      },
    },
    select: { recipientId: true },
  });

  const recipientIds = recipients.map((r) => r.recipientId);

  // ลบทั้งหมด
  if (recipientIds.length > 0) {
    await prisma.announcementRecipient.deleteMany({
      where: {
        recipientId: { in: recipientIds },
      },
    });
  }

  // บันทึก Audit Log
  await createAuditLog({
    userId: clearedByUserId,
    action: AuditAction.DELETE_ANNOUNCEMENT,
    targetTable: 'announcement_recipients',
    targetId: sentByUserId,
    newValues: { action: 'CLEAR_ALL', count: recipientIds.length },
  });

  return {
    clearedCount: recipientIds.length,
  };
};

// ============================================
// 📤 Export
// ============================================

export const announcementService = {
  createAnnouncement,
  getAnnouncements,
  getAnnouncementById,
  updateAnnouncement,
  approveAnnouncement,
  rejectAnnouncement,
  sendAnnouncement,
  deleteAnnouncement,
  deleteRecipient,
  clearAllRecipients,
};

export default announcementService;
