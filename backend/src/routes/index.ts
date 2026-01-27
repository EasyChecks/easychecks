import { Router } from 'express';
import attendanceRoutes from './attendance.routes';
import shiftRoutes from './shift.routes';

const router = Router();

/**
 * 🚀 Main Router - รวม routes ทั้งหมด
 */

// API Routes
router.use('/attendance', attendanceRoutes);
router.use('/shifts', shiftRoutes);

export default router;
