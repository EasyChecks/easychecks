import { Router } from 'express';
import * as attendanceController from '../controllers/attendance.controller.js';
// TODO: หลังจากเพื่อนทำ Auth เสร็จ ให้ uncomment 2 บรรทัดนี้
// import { authenticate } from '../middleware/auth.middleware';
// import { requireRole } from '../middleware/role.middleware';

const router = Router();

/**
 * 📋 Attendance Routes - เส้นทาง API สำหรับการเข้า-ออกงาน
 * 
 * 🔴 หมายเหตุ: ตอนนี้ยังไม่ใส่ Auth Middleware
 * - รอเพื่อนทำ Auth เสร็จก่อนค่อยเปิดใช้งาน
 * - ตอนนี้ส่ง userId มาใน body แทน
 * 
 * Permissions (อนาคต):
 * - Check-in/Check-out: ทุก Role ที่ authenticate แล้ว
 * - Read History: User (own history) and Admin (all history)
 * - Update/Delete: Admin only
 */

// TODO: หลังจากเพื่อนทำ Auth เสร็จ ให้ uncomment บรรทัดนี้
// router.use(authenticate);

/**
 * @route   POST /api/attendance/check-in
 * @desc    เข้างาน (บันทึกเวลาเข้า)
 * @access  ตอนนี้: Public (Dev Mode) | อนาคต: Authenticated (ทุก Role)
 * @body    {
 *            userId: number,        // (จำเป็น) รหัสผู้ใช้
 *            shiftId?: number,      // (optional) รหัสกะงาน
 *            locationId?: number,   // (optional) รหัสสถานที่
 *            photo?: string,        // (optional) รูปภาพ Base64
 *            latitude?: number,     // (optional) ละติจูด GPS
 *            longitude?: number,    // (optional) ลองจิจูด GPS
 *            address?: string       // (optional) ที่อยู่
 *          }
 */
router.post('/check-in', attendanceController.checkIn);

/**
 * @route   POST /api/attendance/check-out
 * @desc    ออกงาน (บันทึกเวลาออก)
 * @access  ตอนนี้: Public (Dev Mode) | อนาคต: Authenticated (ทุก Role)
 * @body    {
 *            userId: number,        // (จำเป็น) รหัสผู้ใช้
 *            attendanceId?: number, // (optional) รหัส attendance ที่จะออก
 *            shiftId?: number,      // (optional) รหัสกะงาน
 *            photo?: string,        // (optional) รูปภาพ Base64
 *            latitude?: number,     // (optional) ละติจูด GPS
 *            longitude?: number,    // (optional) ลองจิจูด GPS
 *            address?: string       // (optional) ที่อยู่
 *          }
 */
router.post('/check-out', attendanceController.checkOut);

/**
 * @route   GET /api/attendance/history/:userId
 * @desc    ดึงประวัติการเข้างานของ user คนนั้น
 * @access  ตอนนี้: Public (Dev Mode) | อนาคต: Authenticated
 * @query   startDate?, endDate?, status?
 */
router.get('/history/:userId', attendanceController.getHistory);

/**
 * @route   GET /api/attendance
 * @desc    ดึงประวัติการเข้างานทั้งหมด (Admin only)
 * @access  ตอนนี้: Public (Dev Mode) | อนาคต: Admin only
 * @query   userId?, startDate?, endDate?, status?
 */
// TODO: หลังจากเพื่อนทำ Auth เสร็จ ให้เพิ่ม requireRole(['ADMIN', 'SUPERADMIN'])
router.get('/', attendanceController.getAllAttendances);

/**
 * @route   GET /api/attendance/today/:userId
 * @desc    ดึงข้อมูลการเข้างานวันนี้ของ user
 * @access  ตอนนี้: Public (Dev Mode) | อนาคต: Authenticated
 */
router.get('/today/:userId', attendanceController.getTodayAttendance);

/**
 * @route   PUT /api/attendance/:id
 * @desc    อัปเดตการเข้างาน (แก้ไขข้อมูล)
 * @access  ตอนนี้: Public (Dev Mode) | อนาคต: Admin only
 * @body    { 
 *            updatedByUserId: number, // (จำเป็น) ผู้แก้ไข
 *            status?, note?, checkIn?, checkOut? 
 *          }
 */
// TODO: หลังจากเพื่อนทำ Auth เสร็จ ให้เพิ่ม requireRole(['ADMIN', 'SUPERADMIN'])
router.put('/:id', attendanceController.updateAttendance);

/**
 * @route   DELETE /api/attendance/:id
 * @desc    ลบการเข้างาน
 * @access  ตอนนี้: Public (Dev Mode) | อนาคต: Admin only
 * @body    { deletedByUserId: number } // (จำเป็น) ผู้ลบ
 */
// TODO: หลังจากเพื่อนทำ Auth เสร็จ ให้เพิ่ม requireRole(['ADMIN', 'SUPERADMIN'])
router.delete('/:id', attendanceController.deleteAttendance);

export default router;
