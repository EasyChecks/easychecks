import { Router } from 'express';
import attendanceRoutes from './attendance.routes.js';
import shiftRoutes from './shift.routes.js';
import downloadRoutes from './download.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import userRoutes from './user.routes.js';
import authRoutes from './auth.routes.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { auditMiddleware } from '../middleware/audit.middleware.js';
import eventRoutes from './event.routes.js';
import lateRequestRoutes from './late-request.routes.js';
import leaveRequestRoutes from './leave-request.routes.js';
import leaveQuotaRoutes from './leave-quota.routes.js';
import locationRoutes from './location.routes.js';
import announcementRoutes from './announcement.routes.js';
import auditRoutes from './audit.routes.js';
import policyRoutes from './policy.routes.js';

const router = Router();

/**
 * 🚀 Main Router - รวม routes ทั้งหมด
 */

// 🔐 Auth Routes (ไม่ต้อง authentication)
router.use('/auth', authRoutes);

// 📜 Policy Routes (ไม่ต้อง authentication — เปิดให้ทุกคนอ่านได้)
router.use('/policies', policyRoutes);

// 🔒 Protected Routes (ต้อง authentication)
router.use(authenticate);

// 📋 Audit Middleware — บันทึกทุก write request อัตโนมัติ
// ใส่หลัง authenticate เพราะต้องการ req.user.userId
router.use(auditMiddleware);

router.use('/attendance', attendanceRoutes);
router.use('/shifts', shiftRoutes);
router.use('/download', downloadRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/users', userRoutes);
router.use('/events', eventRoutes);
router.use('/late-requests', lateRequestRoutes);
router.use('/leave-requests', leaveRequestRoutes);
router.use('/leave-quotas', leaveQuotaRoutes);
router.use('/locations', locationRoutes);
router.use('/announcements', announcementRoutes);
router.use('/audit', auditRoutes);

export default router;
