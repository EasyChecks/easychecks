import { Router } from 'express';
import attendanceRoutes from './attendance.routes.js';
import shiftRoutes from './shift.routes.js';
import downloadRoutes from './download.routes.js';
import dashboardRoutes from './dashboard.routes.js';
import userRoutes from './user.routes.js';
import eventRoutes from './event.routes.js';
import lateRequestRoutes from './late-request.routes.js';
import leaveRequestRoutes from './leave-request.routes.js';
import locationRoutes from './location.routes.js';

const router = Router();

/**
 * 🚀 Main Router - รวม routes ทั้งหมด
 */

// API Routes
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
