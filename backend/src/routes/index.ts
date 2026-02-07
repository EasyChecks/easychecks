import { Router } from 'express';
import attendanceRoutes from './attendance.routes.js';
import shiftRoutes from './shift.routes.js';
import downloadRoutes from './download.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import userRoutes from './user.routes.js';
import authRoutes from './auth.routes.js';
import { authenticate } from '../middleware/auth.middleware.js';
import eventRoutes from './event.routes.js';
import lateRequestRoutes from './late-request.routes.js';
import leaveRequestRoutes from './leave-request.routes.js';
import locationRoutes from './location.routes.js';

const router = Router();

/**
 * 🚀 Main Router - รวม routes ทั้งหมด
 */

// 🔐 Auth Routes (ไม่ต้อง authentication)
router.use('/auth', authRoutes);

// 🔒 Protected Routes (ต้อง authentication)
router.use(authenticate);

router.use('/attendance', attendanceRoutes);
router.use('/shifts', shiftRoutes);
router.use('/download', downloadRoutes);
router.use('/dashboard', dashboardRoutes);
router.use('/users', userRoutes);
router.use('/events', eventRoutes);
router.use('/late-requests', lateRequestRoutes);
router.use('/leave-requests', leaveRequestRoutes);
router.use('/locations', locationRoutes);

export default router;
