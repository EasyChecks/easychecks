import { Router } from 'express';
import attendanceRoutes from './attendance.routes.js';
import shiftRoutes from './shift.routes.js';
import downloadRoutes from './download.routes.js';

const router = Router();

/**
 * 🚀 Main Router - รวม routes ทั้งหมด
 */

// API Routes
router.use('/attendance', attendanceRoutes);
router.use('/shifts', shiftRoutes);
router.use('/download', downloadRoutes);

export default router;
