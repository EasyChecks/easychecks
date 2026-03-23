import type { Request, Response } from 'express';
import * as announcementService from '../services/announcement.service.js';
import { sendSuccess, sendError } from '../utils/response.js';

/**
 * ─────────────────────────────────────────────────────────────
 * 📢 Announcement Controller
 * ─────────────────────────────────────────────────────────────
 * ทำหน้าที่: รับ HTTP request → parse ข้อมูล → ส่งต่อ Service → ส่ง response
 *
 * ทำไมแยก Controller ออกจาก Service?
 * → Controller รู้แค่ HTTP (parse req, return res)
 *   Service รู้แค่ business logic
 *   แยก concern ถึงจะ test ได้ทีละชั้น
 *
 * Pattern: Controller validate input → Service ทำ business logic → Controller return response
 * ─────────────────────────────────────────────────────────────
 */

/**
 * ➕ POST /api/announcements
 *
 * ทำไม validate ที่ controller อีกทั้งที่ service ก็ validate แล้ว?
 * → Controller validate เร็วเพื่อ fail fast — เช็คค่าแล้ว reject ทันที
 *   ไม่ต้องเชื่อม DB เพื่อรู้ว่าข้อมูลไม่ครบ
 */
export const createAnnouncement = async (req: Request, res: Response) => {
  try {
    const {
      title,
      content,
      targetRoles,
      targetBranchIds,
      targetUserIds,
    } = req.body;

    // ตรวจสอบข้อมูล
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

/**
 * 📋 GET /api/announcements
 *
 * ทำไม query filters เป็น optional?
 * → ใช้ endpoint เดียวกันสำหรับทั้ง ADMIN และ SUPERADMIN
 *   ADMIN อาจ filter เฉพาะของตัวเอง ส่วน SUPERADMIN เห็นทั้งหมด
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
 * 🔍 GET /api/announcements/:id
 *
 * ทำไม parseInt แล้ว check isNaN อีก?
 * → parseInt('abc') คืน NaN ซึ่ง truthy ในบาง context
 *   isNaN guard เพื่อไม่ให้ query ไปดึง WHERE announcement_id = NaN
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
 * ✏️ PUT /api/announcements/:id
 *
 * ทำไมใส่เฉพาะ field ที่ส่งมา (partial update)?
 * → รองรับ PATCH-style update — ไม่ต้องส่งทุก field มาทุกครั้ง
 *   Service ใช้ spread conditional เพื่อไม่ overwrite field ที่ไม่ได้ส่งมา
 *   เช่น ส่งแค่ title มา → content เดิมไม่ถูกแตะ
 */
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
      req.user.userId
    );

    sendSuccess(res, updated, 'อัปเดตประกาศเรียบร้อยแล้ว');
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการอัปเดตประกาศ');
  }
};

/**
 * 📤 POST /api/announcements/:id/send
 *
 * Controller นี้แค่ pass-through — logic ทั้งหมดอยู่ใน service
 *
 * ทำไม pass branchId ด้วย?
 * → Service ต้องรู้ branchId ของผู้ส่ง เพื่อสร้าง WHERE branch_id = $x guard ให้ ADMIN
 *   ถ้าไม่ส่งมา ADMIN จะสามารถส่งประกาศข้ามสาขาได้
 */
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

/**
 * 🗑️ DELETE /api/announcements/:id
 */
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

/**
 * 🔄 DELETE /api/announcements/:announcementId/recipients/:recipientId
 *
 * ทำไมมี endpoint นี้แยกจาก clearAll?
 * → รองรับการ revoke เฉพาะราย โดยไม่กระทบคนอื่น
 *   clearAll ลบทั้งสาย — endpoint นี้ลบคนเดียวโดยการ revoke อีเมล / เปลี่ยนชื่อระบุ
 */
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

/**
 * 🔄 DELETE /api/announcements/:announcementId/recipients
 *
 * ทำไมต้องระบุ announcementId ใน URL?
 * → ถ้าใช้แค่ :id Prisma จะไม่รู้ว่าต้องลบ recipients ของ announcement ไหน
 *   (Bug เดิมที่เคยลบ recipients ทั้งระบบโดยไม่ส่ง announcementId)
 */
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
