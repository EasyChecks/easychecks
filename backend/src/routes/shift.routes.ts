import { Router } from 'express';
import * as shiftController from '../controllers/shift.controller.js';
import { authenticate, authorizeRole } from '../middleware/auth.middleware.js';

// Router instance — จะถูก mount ที่ /api/shifts ใน routes/index.ts
const router = Router();

/**
 * 📋 Shift Routes — เส้นทาง API จัดการตารางงาน/กะ
 *
 * ทำไม Read ถึงเปิดให้ทุก role แต่ Write ต้องเป็น Admin?
 * พนักงานต้องเห็นกะของตัวเองเพื่อรู้ว่าต้องเข้างานกี่โมง
 * แต่สร้าง/แก้/ลบกะส่งผลต่อการบันทึกเวลาทั้งสาขา → Admin เท่านั้น
 *
 * Flow: authenticate → [authorizeRole] → controller → service → Prisma → response
 */

// ✅ ทุก route ต้อง login ก่อน (token → req.user)
router.use(authenticate);

// POST /api/shifts
// สร้างกะใหม่ให้พนักงาน — Admin/SuperAdmin เท่านั้น
// ทำไม? เพราะ grace/late threshold ส่งผลต่อสถานะ ON_TIME/LATE/ABSENT ของพนักงาน
router.post('/', authorizeRole('ADMIN', 'SUPERADMIN'), shiftController.createShift);

// GET /api/shifts
// ดึงกะทั้งหมด — service กรองตาม role/branch อัตโนมัติ:
//   SuperAdmin → เห็นทุกกะทุกสาขา
//   Admin      → เห็นกะสาขาตัวเอง
//   User       → เห็นเฉพาะกะของตัวเอง
router.get('/', shiftController.getShifts);

// GET /api/shifts/today/:userId
// กะที่ active วันนี้ของพนักงาน — Dashboard ใช้ก่อน check-in เพื่อรู้ว่ากะไหนที่ต้องเข้า
// ทำไม route นี้ต้องมาก่อน /:id? Express match ตาม order — ถ้า /:id ก่อน
// 'today' จะถูกแปลงเป็น id แทน
router.get('/today/:userId', shiftController.getActiveShiftsToday);

// GET /api/shifts/:id
// ดูรายละเอียดกะเดียว — ใช้ก่อนแก้ไขหรือแสดงใน detail modal
router.get('/:id', shiftController.getShiftById);

// PUT /api/shifts/:id
// แก้ไขกะ: เวลา, grace period, late threshold, สถานที่, เปิด/ปิด → Admin only
router.put('/:id', authorizeRole('ADMIN', 'SUPERADMIN'), shiftController.updateShift);

// DELETE /api/shifts/:id (Soft Delete)
// ต้องใส่ deleteReason ใน body — Admin only
router.delete('/:id', authorizeRole('ADMIN', 'SUPERADMIN'), shiftController.deleteShift);

export default router;
