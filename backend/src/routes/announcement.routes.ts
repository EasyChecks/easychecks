import { Router } from 'express';
import * as announcementController from '../controllers/announcement.controller.js';

const router = Router();

/**
 * 📢 Announcement Routes - เส้นทาง API สำหรับประกาศ/ข่าวสาร
 */

/**
 * @route   POST /api/announcements
 * @desc    สร้างประกาศใหม่
 * @access  Admin/SuperAdmin only
 * @body    {
 *            title: string,              // หัวข้อประกาศ (จำเป็น)
 *            content: string,            // เนื้อหาประกาศ (จำเป็น)
 *            targetRoles?: Role[],       // ประเภทบุคคลากร (ว่าง = EVERYONE)
 *            targetBranchIds?: number[], // ID สาขา (ว่าง = EVERYONE)
 *            createdByUserId: number,    // ID ผู้สร้าง (จำเป็น)
 *          }
 */
router.post('/', announcementController.createAnnouncement);

/**
 * @route   GET /api/announcements
 * @desc    ดึงประกาศทั้งหมด
 * @access  Authenticated users
 * @query   {
 *            status?: string,              // DRAFT | SENT
 *            createdByUserId?: number
 *          }
 */
router.get('/', announcementController.getAnnouncements);

/**
 * @route   GET /api/announcements/:id
 * @desc    ดึงประกาศตาม ID
 * @access  Authenticated users
 */
router.get('/:id', announcementController.getAnnouncementById);

/**
 * @route   PUT /api/announcements/:id
 * @desc    อัปเดตประกาศ
 * @access  Admin/SuperAdmin only
 * @body    {
 *            title?: string,
 *            content?: string,
 *            targetRoles?: Role[],
 *            targetBranchIds?: number[],
 *            updatedByUserId: number     // ID ผู้แก้ไข (จำเป็น)
 *          }
 */
router.put('/:id', announcementController.updateAnnouncement);

/**
 * @route   POST /api/announcements/:id/send
 * @desc    ส่งประกาศ
 * @access  SuperAdmin/Admin only
 * @body    {
 *            sentByUserId: number,       // ID ผู้ส่ง (จำเป็น)
 *            sentByUserRole: string,     // Role ผู้ส่ง (จำเป็น) - ADMIN | SUPER_ADMIN
 *            sentByUserBranchId?: number // Branch ID (สำหรับ ADMIN เท่านั้น)
 *          }
 */
router.post('/:id/send', announcementController.sendAnnouncement);

/**
 * @route   DELETE /api/announcements/:id
 * @desc    ลบประกาศ (Soft Delete)
 * @access  SuperAdmin/Admin only
 * @body    {
 *            deleteReason: string        // เหตุผล (จำเป็น)
 *          }
 */
router.delete('/:id', announcementController.deleteAnnouncement);

/**
 * @route   DELETE /api/announcements/:announcementId/recipients/:recipientId
 * @desc    ลบผู้รับประกาศเพียงคนเดียว
 * @access  Admin/SuperAdmin only
 */
router.delete('/:announcementId/recipients/:recipientId', announcementController.deleteRecipient);

/**
 * @route   DELETE /api/announcements/:announcementId/recipients
 * @desc    ล้างผู้รับประกาศทั้งหมด
 * @access  Admin/SuperAdmin only
 * @body    {
 *            sentByUserId: number        // ID ผู้ส่ง (จำเป็น)
 *          }
 */
router.delete('/:announcementId/recipients', announcementController.clearAllRecipients);

export default router;
