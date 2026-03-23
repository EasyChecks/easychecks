import { Router } from 'express';
import * as attendanceController from '../controllers/attendance.controller.js';
import { authenticate, authorizeRole } from '../middleware/auth.middleware.js';

// Router instance ของ Express — จะถูก mount ที่ /api/attendance ใน routes/index.ts
const router = Router();

/**
 * 📋 Attendance Routes — เส้นทาง API การเข้า-ออกงาน
 *
 * ทำไมทุก route ถึงต้องผ่าน authenticate ก่อน?
 * ป้องกัน anonymous request เข้าถึงข้อมูลการเข้างาน
 * authenticate middleware จะถอดรหัส Bearer token แล้วเซ็ต req.user
 *
 * Flow แต่ละ request:
 *   HTTP Request
 *     → authenticate (ตรวจ token, เซ็ต req.user)
 *     → [authorizeRole] (ตรวจ role — เฉพาะ route ที่ต้องการ)
 *     → Controller handler
 *     → Service (business logic)
 *     → Prisma (database)
 *     → Response
 */

// ✅ ใส่ authenticate ก่อนทุก route ใน router นี้
// ทำไมใช้ router.use แทนใส่ทีละ route? ลด duplication ถ้าเพิ่ม route ใหม่ก็ protected ทันที
router.use(authenticate);

// POST /api/attendance/check-gps
// ตรวจสอบว่า GPS อยู่ในรัศมีสถานที่ของกะหรือไม่ — ทุก role ใช้ได้
router.post('/check-gps', attendanceController.checkGps);

// POST /api/attendance/check-in
// ทำไมไม่มี authorizeRole? พนักงานทุก role (USER/MANAGER/ADMIN) เข้างานได้ทั้งนั้น
router.post('/check-in', attendanceController.checkIn);

// POST /api/attendance/check-out
// เช่นกัน — ทุก role ออกงานได้
router.post('/check-out', attendanceController.checkOut);

// GET /api/attendance/history/:userId
// User ดูประวัติตัวเอง, Admin ดูประวัติพนักงานคนอื่น
// ทำไมไม่ lock ด้วย authorizeRole? เพราะ service จะ enforce ว่า User ดูได้แค่ตัวเอง
router.get('/history/:userId', attendanceController.getHistory);

// GET /api/attendance
// ดูประวัติ *ทั้งหมด* → Admin/SuperAdmin เท่านั้น
// authorizeRole ตรวจก่อนเข้า controller ถ้า role ไม่ผ่านจะ return 403 ทันที
router.get('/', authorizeRole('ADMIN', 'SUPERADMIN'), attendanceController.getAllAttendances);

// GET /api/attendance/today/:userId
// Dashboard ใช้ดูสถานะวันนี้แบบ real-time — ทุก role เห็นของตัวเองได้
router.get('/today/:userId', attendanceController.getTodayAttendance);

// PUT /api/attendance/:id
// Admin แก้ไข record ที่ผิดพลาด (GPS ผิด, ลืม check-out ฯ) → Admin only
router.put('/:id', authorizeRole('ADMIN', 'SUPERADMIN'), attendanceController.updateAttendance);

// DELETE /api/attendance/:id (Soft Delete)
// Admin ลบ record — ต้องใส่ deleteReason ใน body → Admin only
router.delete('/:id', authorizeRole('ADMIN', 'SUPERADMIN'), attendanceController.deleteAttendance);

export default router;
