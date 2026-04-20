import { Router } from 'express';
import * as announcementController from '../controllers/announcement.controller.js';
import { authenticate, authorizeRole } from '../middleware/auth.middleware.js';

const router = Router();

// authenticate ทุก endpoint เพราะต้อง login ก่อนถึงจะเห็นประกาศ
// authorizeRole จำกัดเฉพาะ ADMIN/SUPERADMIN เพราะ USER/MANAGER ไม่ควรสร้าง/แก้/ลบประกาศ

router.post('/', authenticate, authorizeRole('ADMIN', 'SUPERADMIN'), announcementController.createAnnouncement);
router.get('/', authenticate, announcementController.getAnnouncements);
router.get('/:id', authenticate, announcementController.getAnnouncementById);
router.put('/:id', authenticate, authorizeRole('ADMIN', 'SUPERADMIN'), announcementController.updateAnnouncement);
router.post('/:id/send', authenticate, authorizeRole('ADMIN', 'SUPERADMIN'), announcementController.sendAnnouncement);
router.delete('/:id', authenticate, authorizeRole('ADMIN', 'SUPERADMIN'), announcementController.deleteAnnouncement);

// แยก deleteRecipient กับ clearAllRecipients เพราะคนละ 1 คน vs ล้างทั้งหมด — use case ต่างกัน
router.delete('/:announcementId/recipients/:recipientId', authenticate, authorizeRole('ADMIN', 'SUPERADMIN'), announcementController.deleteRecipient);
router.delete('/:announcementId/recipients', authenticate, authorizeRole('ADMIN', 'SUPERADMIN'), announcementController.clearAllRecipients);

export default router;
