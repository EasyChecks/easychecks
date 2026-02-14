import { Router } from 'express';
import * as attendanceController from '../controllers/attendance.controller.js';
import { authenticate, authorizeRole } from '../middleware/auth.middleware.js';

const router = Router();

/**
 * 📋 Attendance Routes - เส้นทาง API สำหรับการเข้า-ออกงาน
 * 
 * Permissions:
 * - Check-in/Check-out: ทุก Role ที่ authenticate แล้ว
 * - Read History: User (own history) and Admin (all history)
 * - Update/Delete: Admin only
 * 
 * 📚 Swagger docs: /api-docs
 */

// ✅ ทุก route ต้อง login ก่อน
router.use(authenticate);

// POST /api/attendance/check-in - เข้างาน (ทุก Role)
router.post('/check-in', attendanceController.checkIn);

// POST /api/attendance/check-out - ออกงาน (ทุก Role)
router.post('/check-out', attendanceController.checkOut);

// GET /api/attendance/history/:userId - ดึงประวัติการเข้างานของ user
router.get('/history/:userId', attendanceController.getHistory);

// GET /api/attendance - ดึงประวัติการเข้างานทั้งหมด (Admin only)
router.get('/', authorizeRole('ADMIN', 'SUPERADMIN'), attendanceController.getAllAttendances);

// GET /api/attendance/today/:userId - ดึงข้อมูลการเข้างานวันนี้
router.get('/today/:userId', attendanceController.getTodayAttendance);

// PUT /api/attendance/:id - อัปเดตการเข้างาน (Admin only)
router.put('/:id', authorizeRole('ADMIN', 'SUPERADMIN'), attendanceController.updateAttendance);

// DELETE /api/attendance/:id - ลบการเข้างาน (Admin only)
router.delete('/:id', authorizeRole('ADMIN', 'SUPERADMIN'), attendanceController.deleteAttendance);

export default router;
