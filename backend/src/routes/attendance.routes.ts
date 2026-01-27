import { Router } from 'express';
import * as attendanceController from '../controllers/attendance.controller';
import { authenticate } from '../middleware/auth.middleware';
import { requireRole } from '../middleware/role.middleware';

const router = Router();

/**
 * 🔐 Attendance Routes
 * 
 * Permissions:
 * - Check-in/Check-out: ทุก Role ที่ authenticate แล้ว
 * - Read History: User (own history) and Admin (all history)
 * - Update/Delete: Admin only
 */

// ต้อง authenticate ทุก route
router.use(authenticate);

/**
 * @route   POST /api/attendance/check-in
 * @desc    เข้างาน
 * @access  Authenticated (ทุก Role)
 * @body    shiftId?, locationId?, photo?, latitude?, longitude?, address?
 */
router.post('/check-in', attendanceController.checkIn);

/**
 * @route   POST /api/attendance/check-out
 * @desc    ออกงาน
 * @access  Authenticated (ทุก Role)
 * @body    shiftId?, photo?, latitude?, longitude?, address?
 */
router.post('/check-out', attendanceController.checkOut);

/**
 * @route   GET /api/attendance/history
 * @desc    ดึงประวัติการเข้างานของตัวเอง
 * @access  Authenticated
 * @query   startDate?, endDate?, status?
 */
router.get('/history', attendanceController.getHistory);

/**
 * @route   GET /api/attendance
 * @desc    ดึงประวัติการเข้างานทั้งหมด (Admin only)
 * @access  Admin only
 * @query   userId?, startDate?, endDate?, status?
 */
router.get('/', requireRole(['ADMIN', 'SUPERADMIN']), attendanceController.getAllAttendances);

/**
 * @route   PUT /api/attendance/:id
 * @desc    อัปเดตการเข้างาน (แก้ไขข้อมูล)
 * @access  Admin only
 * @body    status?, note?, checkIn?, checkOut?
 */
router.put('/:id', requireRole(['ADMIN', 'SUPERADMIN']), attendanceController.updateAttendance);

/**
 * @route   DELETE /api/attendance/:id
 * @desc    ลบการเข้างาน
 * @access  Admin only
 */
router.delete('/:id', requireRole(['ADMIN', 'SUPERADMIN']), attendanceController.deleteAttendance);

export default router;
