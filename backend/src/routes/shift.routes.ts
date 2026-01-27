import { Router } from 'express';
import * as shiftController from '../controllers/shift.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';

const router = Router();

/**
 * 🔐 Shift Routes
 * 
 * Permissions:
 * - C (Create): Admin only
 * - R (Read): User (own shifts) and Admin (all shifts)
 * - U (Update): User (own shifts) and Admin (all shifts)
 * - D (Delete): Admin only
 */

// ต้อง authenticate ทุก route
router.use(authenticate);

/**
 * @route   POST /api/shifts
 * @desc    สร้างกะใหม่
 * @access  Admin only
 */
router.post('/', requireRole(['ADMIN', 'SUPERADMIN']), shiftController.createShift);

/**
 * @route   GET /api/shifts
 * @desc    ดึงกะทั้งหมด (Admin: ดูทุกกะ, User: ดูกะของตัวเอง)
 * @access  Authenticated
 * @query   userId, shiftType, isActive (Admin only)
 */
router.get('/', shiftController.getShifts);

/**
 * @route   GET /api/shifts/today
 * @desc    ดึงกะที่ใช้งานได้ในวันนี้
 * @access  Authenticated
 */
router.get('/today', shiftController.getActiveShiftsToday);

/**
 * @route   GET /api/shifts/:id
 * @desc    ดึงกะเฉพาะ ID
 * @access  Authenticated
 */
router.get('/:id', shiftController.getShiftById);

/**
 * @route   PUT /api/shifts/:id
 * @desc    อัปเดตกะ (User: กะของตัวเอง, Admin: ทุกกะ)
 * @access  Authenticated
 */
router.put('/:id', shiftController.updateShift);

/**
 * @route   DELETE /api/shifts/:id
 * @desc    ลบกะ (soft delete)
 * @access  Admin only
 */
router.delete('/:id', requireRole(['ADMIN', 'SUPERADMIN']), shiftController.deleteShift);

export default router;
