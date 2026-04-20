import type { Request, Response } from 'express';
import * as announcementService from '../services/announcement.service.js';
import { sendSuccess, sendError } from '../utils/response.js';

// แยก Controller ออกจาก Service เพราะ Controller รู้แค่ HTTP / Service รู้แค่ business logic — test ได้ทีละชั้น

// validate ที่ controller เพื่อ fail fast — reject ทันทีไม่ต้องเชื่อม DB ถ้าข้อมูลไม่ครบ
export const createAnnouncement = async (req: Request, res: Response) => {
  try {
    const {
      title,
      content,
      targetRoles,
      targetBranchIds,
      targetUserIds,
    } = req.body;

    if (!title || !content) {
      return sendError(res, 'ต้องระบุ title และ content', 400);
    }

    if (!req.user) {
      return sendError(res, 'ไม่พบข้อมูลผู้ใช้', 401);
    }

    const announcement = await announcementService.createAnnouncement({
      title,
      content,
      targetRoles,
      targetBranchIds,
      targetUserIds,
      createdByUserId: req.user.userId,
    });

    sendSuccess(res, announcement, 'สร้างประกาศเรียบร้อยแล้ว', 201);
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการสร้างประกาศ');
  }
};

// filters เป็น optional เพราะใช้ endpoint เดียวกันทั้ง ADMIN (filter เฉพาะของตัวเอง) และ SUPERADMIN (เห็นทั้งหมด)
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

// parseInt('abc') คืน NaN — ต้อง guard isNaN เพื่อไม่ให้ query ไปดึง WHERE announcement_id = NaN
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

// รองรับ partial update — ส่งแค่ field ที่ต้องการแก้ เช่น title อย่างเดียว content เดิมไม่ถูกแตะ
export const updateAnnouncement = async (req: Request, res: Response) => {
  try {
    const announcementId = parseInt(req.params.id as string);
    const { title, content, targetRoles, targetBranchIds, targetUserIds } = req.body;

    if (!announcementId || isNaN(announcementId)) {
      return sendError(res, 'ต้องระบุ announcementId ที่ถูกต้อง', 400);
    }

    if (!req.user) {
      return sendError(res, 'ไม่พบข้อมูลผู้ใช้', 401);
    }

    const updated = await announcementService.updateAnnouncement(
      announcementId,
      {
        title,
        content,
        targetRoles,
        targetBranchIds,
        targetUserIds,
      },
      req.user.userId,
      req.user.role,
      req.user.branchId
    );

    sendSuccess(res, updated, 'อัปเดตประกาศเรียบร้อยแล้ว');
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการอัปเดตประกาศ');
  }
};

// pass branchId ไปด้วยเพราะ service ต้องสร้าง WHERE branch_id guard สำหรับ ADMIN — ถ้าไม่ส่ง ADMIN จะส่งข้ามสาขาได้
export const sendAnnouncement = async (req: Request, res: Response) => {
  try {
    const announcementId = parseInt(req.params.id as string);

    if (!announcementId || isNaN(announcementId)) {
      return sendError(res, 'ต้องระบุ announcementId ที่ถูกต้อง', 400);
    }

    if (!req.user) {
      return sendError(res, 'ไม่พบข้อมูลผู้ใช้', 401);
    }

    const result = await announcementService.sendAnnouncement(
      announcementId,
      req.user.userId,
      req.user.role,
      req.user.branchId
    );

    sendSuccess(res, result, `ส่งประกาศเรียบร้อยแล้ว ส่งให้ ${result.recipientCount} คน`);
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการส่งประกาศ');
  }
};

// ลบประกาศทั้งฉบับ (hard delete)
export const deleteAnnouncement = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const announcementId = parseInt(req.params.id as string);

    if (!userId) {
      return sendError(res, 'ต้องเข้าสู่ระบบก่อน', 401);
    }

    if (!announcementId || isNaN(announcementId)) {
      return sendError(res, 'ต้องระบุ announcementId ที่ถูกต้อง', 400);
    }

    if (!req.user) {
      return sendError(res, 'ไม่พบข้อมูลผู้ใช้', 401);
    }

    const deleted = await announcementService.deleteAnnouncement(
      announcementId,
      req.user.userId
    );

    sendSuccess(res, deleted, 'ลบประกาศเรียบร้อยแล้ว');
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการลบประกาศ');
  }
};

// แยกจาก clearAll เพราะต้องการ revoke เฉพาะรายโดยไม่กระทบคนอื่น
export const deleteRecipient = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const announcementId = parseInt(req.params.announcementId as string);
    const recipientId = parseInt(req.params.recipientId as string);

    if (!userId) {
      return sendError(res, 'ต้องเข้าสู่ระบบก่อน', 401);
    }

    if (!announcementId || isNaN(announcementId)) {
      return sendError(res, 'ต้องระบุ announcementId ที่ถูกต้อง', 400);
    }

    if (!recipientId || isNaN(recipientId)) {
      return sendError(res, 'ต้องระบุ recipientId ที่ถูกต้อง', 400);
    }

    if (!req.user) {
      return sendError(res, 'ไม่พบข้อมูลผู้ใช้', 401);
    }

    const result = await announcementService.deleteRecipient(
      announcementId,
      recipientId,
      req.user.userId
    );

    sendSuccess(res, result, 'ลบผู้รับประกาศเรียบร้อยแล้ว');
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการลบผู้รับประกาศ');
  }
};

// ต้องระบุ announcementId ใน URL — ถ้าไม่ระบุ Prisma จะลบ recipients ทั้งระบบ (bug เดิมที่เคยเจอ)
export const clearAllRecipients = async (req: Request, res: Response) => {
  try {
    if (!req.user) {
      return sendError(res, 'ไม่พบข้อมูลผู้ใช้', 401);
    }

    const announcementId = parseInt(req.params.announcementId as string);

    if (!announcementId || isNaN(announcementId)) {
      return sendError(res, 'ต้องระบุ announcementId ที่ถูกต้อง', 400);
    }

    const result = await announcementService.clearAllRecipients(
      announcementId,
      req.user.userId
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
