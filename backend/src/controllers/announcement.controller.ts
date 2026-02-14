import type { Request, Response } from 'express';
import * as announcementService from '../services/announcement.service.js';
import { sendSuccess, sendError } from '../utils/response.js';

/**
 * 📢 Announcement Controller - จัดการ API ประกาศ
 */

/**
 * ➕ สร้างประกาศใหม่
 * POST /api/announcements
 */
export const createAnnouncement = async (req: Request, res: Response) => {
  try {
    const {
      title,
      content,
      targetRoles,
      targetBranchIds,
      createdByUserId,
    } = req.body;

    // ตรวจสอบข้อมูล
    if (!title || !content) {
      return sendError(res, 'ต้องระบุ title และ content', 400);
    }

    if (!createdByUserId) {
      return sendError(res, 'ต้องระบุ createdByUserId', 400);
    }

    // สร้างประกาศ
    const announcement = await announcementService.createAnnouncement({
      title,
      content,
      targetRoles,
      targetBranchIds,
      createdByUserId: parseInt(createdByUserId),
    });

    sendSuccess(res, announcement, 'สร้างประกาศเรียบร้อยแล้ว', 201);
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการสร้างประกาศ');
  }
};

/**
 * 📋 ดึงประกาศทั้งหมด
 * GET /api/announcements
 */
export const getAnnouncements = async (req: Request, res: Response) => {
  try {
    const { status, createdByUserId } = req.query;

    const filters: any = {};
    if (status) filters.status = status;
    if (createdByUserId) filters.createdByUserId = parseInt(createdByUserId as string);

    const announcements = await announcementService.getAnnouncements(filters);

    sendSuccess(res, announcements);
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการดึงประกาศ');
  }
};

/**
 * 🔍 ดึงประกาศตาม ID
 * GET /api/announcements/:id
 */
export const getAnnouncementById = async (req: Request, res: Response) => {
  try {
    const announcementId = parseInt(req.params.id as string);

    if (!announcementId || isNaN(announcementId)) {
      return sendError(res, 'ต้องระบุ announcementId ที่ถูกต้อง', 400);
    }

    const announcement = await announcementService.getAnnouncementById(announcementId);

    sendSuccess(res, announcement);
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการดึงประกาศ');
  }
};

/**
 * ✏️ อัปเดตประกาศ
 * PUT /api/announcements/:id
 */
export const updateAnnouncement = async (req: Request, res: Response) => {
  try {
    const announcementId = parseInt(req.params.id as string);
    const { title, content, targetRoles, targetBranchIds, updatedByUserId } = req.body;

    if (!announcementId || isNaN(announcementId)) {
      return sendError(res, 'ต้องระบุ announcementId ที่ถูกต้อง', 400);
    }

    if (!updatedByUserId) {
      return sendError(res, 'ต้องระบุ updatedByUserId', 400);
    }

    const updated = await announcementService.updateAnnouncement(
      announcementId,
      {
        title,
        content,
        targetRoles,
        targetBranchIds,
      },
      parseInt(updatedByUserId)
    );

    sendSuccess(res, updated, 'อัปเดตประกาศเรียบร้อยแล้ว');
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการอัปเดตประกาศ');
  }
};



/**
 * 📤 ส่งประกาศ
 * POST /api/announcements/:id/send
 * 
 * Body: { sentByUserId, sentByUserRole, sentByUserBranchId? }
 */
export const sendAnnouncement = async (req: Request, res: Response) => {
  try {
    const announcementId = parseInt(req.params.id as string);
    const { sentByUserId, sentByUserRole, sentByUserBranchId } = req.body;

    if (!announcementId || isNaN(announcementId)) {
      return sendError(res, 'ต้องระบุ announcementId ที่ถูกต้อง', 400);
    }

    if (!sentByUserId) {
      return sendError(res, 'ต้องระบุ sentByUserId', 400);
    }

    if (!sentByUserRole) {
      return sendError(res, 'ต้องระบุ sentByUserRole', 400);
    }

    const result = await announcementService.sendAnnouncement(
      announcementId,
      parseInt(sentByUserId),
      sentByUserRole,
      sentByUserBranchId ? parseInt(sentByUserBranchId) : undefined
    );

    sendSuccess(res, result, `ส่งประกาศเรียบร้อยแล้ว ส่งให้ ${result.recipientCount} คน`);
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการส่งประกาศ');
  }
};

/**
 * 🗑️ ลบประกาศ (Soft Delete)
 * DELETE /api/announcements/:id
 */
export const deleteAnnouncement = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const announcementId = parseInt(req.params.id as string);
    const { deleteReason } = req.body;

    if (!userId) {
      return sendError(res, 'ต้องเข้าสู่ระบบก่อน', 401);
    }

    if (!announcementId || isNaN(announcementId)) {
      return sendError(res, 'ต้องระบุ announcementId ที่ถูกต้อง', 400);
    }

    if (!deleteReason) {
      return sendError(res, 'ต้องระบุ deleteReason', 400);
    }

    const deleted = await announcementService.deleteAnnouncement(
      announcementId,
      deleteReason,
      userId
    );

    sendSuccess(res, deleted, 'ลบประกาศเรียบร้อยแล้ว (Soft Delete)');
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการลบประกาศ');
  }
};

/**
 * 🔄 ลบผู้รับประกาศ (ลบตัวรับ 1 คน)
 * DELETE /api/announcements/:announcementId/recipients/:recipientId
 */
export const deleteRecipient = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const recipientId = parseInt(req.params.recipientId as string);

    if (!userId) {
      return sendError(res, 'ต้องเข้าสู่ระบบก่อน', 401);
    }

    if (!recipientId || isNaN(recipientId)) {
      return sendError(res, 'ต้องระบุ recipientId ที่ถูกต้อง', 400);
    }

    const result = await announcementService.deleteRecipient(
      recipientId,
      userId
    );

    sendSuccess(res, result, 'ลบผู้รับประกาศเรียบร้อยแล้ว');
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการลบผู้รับประกาศ');
  }
};

/**
 * 🔄 ล้างผู้รับประกาศทั้งหมด
 * DELETE /api/announcements/:announcementId/recipients
 * Body: { sentByUserId }
 */
export const clearAllRecipients = async (req: Request, res: Response) => {
  try {
    const { sentByUserId } = req.body;

    if (!sentByUserId) {
      return sendError(res, 'ต้องระบุ sentByUserId', 400);
    }

    const result = await announcementService.clearAllRecipients(
      parseInt(sentByUserId)
    );

    sendSuccess(res, result, `ล้างผู้รับประกาศเรียบร้อยแล้ว ลบ ${result.clearedCount} รายการ`);
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการล้างผู้รับประกาศ');
  }
};

export default {
  createAnnouncement,
  getAnnouncements,
  getAnnouncementById,
  updateAnnouncement,
  sendAnnouncement,
  deleteAnnouncement,
  deleteRecipient,
  clearAllRecipients,
};
