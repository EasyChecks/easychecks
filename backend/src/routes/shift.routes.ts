import { Router } from 'express';
import * as shiftController from '../controllers/shift.controller.js';
import { authenticate, authorizeRole } from '../middleware/auth.middleware.js';

const router = Router();

/**
 * 📋 Shift Routes - เส้นทาง API สำหรับจัดการตารางงาน/กะ
 * 
 * Permissions:
 * - C (Create): Admin/SuperAdmin only
 * - R (Read): User (own shifts, same branch) | Admin (own branch) | SuperAdmin (all)
 * - U (Update): Admin (own branch) | SuperAdmin (all)
 * - D (Delete): Admin (own branch) | SuperAdmin (all)
 * 
 * 📚 Swagger docs: /api-docs
 */

// ✅ ทุก route ต้อง login ก่อน
router.use(authenticate);

// POST /api/shifts - สร้างกะใหม่ (Admin/SuperAdmin only)
router.post('/', authorizeRole('ADMIN', 'SUPERADMIN'), shiftController.createShift);

// GET /api/shifts - ดึงกะทั้งหมด (ตาม role และ branch)
router.get('/', shiftController.getShifts);

// GET /api/shifts/today/:userId - ดึงกะที่ใช้งานได้ในวันนี้
router.get('/today/:userId', shiftController.getActiveShiftsToday);

// GET /api/shifts/:id - ดึงกะเฉพาะ ID
router.get('/:id', shiftController.getShiftById);

// PUT /api/shifts/:id - อัปเดตกะ (Admin/SuperAdmin only)
router.put('/:id', authorizeRole('ADMIN', 'SUPERADMIN'), shiftController.updateShift);

// DELETE /api/shifts/:id - ลบกะ (Admin/SuperAdmin only)
router.delete('/:id', authorizeRole('ADMIN', 'SUPERADMIN'), shiftController.deleteShift);

export default router;
