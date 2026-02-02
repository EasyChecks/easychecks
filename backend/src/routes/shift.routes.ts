import { Router } from 'express';
import * as shiftController from '../controllers/shift.controller';
// TODO: หลังจากเพื่อนทำ Auth เสร็จ ให้ uncomment 2 บรรทัดนี้
// import { authenticate } from '../middleware/auth.middleware';
// import { requireRole } from '../middleware/role.middleware';

const router = Router();

/**
 * 📋 Shift Routes - เส้นทาง API สำหรับจัดการตารางงาน/กะ
 * 
 * 🔴 หมายเหตุ: ตอนนี้ยังไม่ใส่ Auth Middleware
 * - รอเพื่อนทำ Auth เสร็จก่อนค่อยเปิดใช้งาน
 * - ตอนนี้ส่ง userId, role มาใน body/query แทน
 * 
 * Permissions (อนาคต):
 * - C (Create): Admin/SuperAdmin only
 * - R (Read): User (own shifts, same branch) | Admin (own branch) | SuperAdmin (all)
 * - U (Update): Admin (own branch) | SuperAdmin (all)
 * - D (Delete): Admin (own branch) | SuperAdmin (all)
 */

// TODO: หลังจากเพื่อนทำ Auth เสร็จ ให้ uncomment บรรทัดนี้
// router.use(authenticate);

/**
 * @route   POST /api/shifts
 * @desc    สร้างกะใหม่ (Admin/SuperAdmin only)
 * @access  ตอนนี้: Public (Dev Mode) | อนาคต: Admin/SuperAdmin only
 * @body    {
 *            createdByUserId: number,   // (จำเป็น) ผู้สร้าง
 *            creatorRole: string,       // (จำเป็น) ADMIN หรือ SUPERADMIN
 *            creatorBranchId?: number,  // (จำเป็นถ้าเป็น ADMIN) สาขาของผู้สร้าง
 *            name: string,              // (จำเป็น) ชื่อกะ เช่น "กะเช้า"
 *            shiftType: string,         // (จำเป็น) REGULAR, SPECIFIC_DAY, CUSTOM
 *            startTime: string,         // (จำเป็น) เวลาเริ่ม HH:MM
 *            endTime: string,           // (จำเป็น) เวลาสิ้นสุด HH:MM
 *            userId: number,            // (จำเป็น) พนักงานที่รับกะนี้
 *            locationId?: number,       // (optional) รหัสสถานที่
 *            gracePeriodMinutes?: number,    // (optional) เข้าก่อนได้กี่นาที (default: 15)
 *            lateThresholdMinutes?: number,  // (optional) สายได้กี่นาที (default: 30)
 *            specificDays?: string[],   // (ถ้า SPECIFIC_DAY) วันที่ใช้กะนี้
 *            customDate?: string        // (ถ้า CUSTOM) วันที่เฉพาะ
 *          }
 */
// TODO: หลังจากเพื่อนทำ Auth เสร็จ ให้เพิ่ม requireRole(['ADMIN', 'SUPERADMIN'])
router.post('/', shiftController.createShift);

/**
 * @route   GET /api/shifts
 * @desc    ดึงกะทั้งหมด (ตาม role และ branch)
 *          - SuperAdmin: ดูได้ทุกกะ
 *          - Admin: ดูได้เฉพาะสาขาตัวเอง
 *          - User: ดูได้เฉพาะกะของตัวเอง
 * @access  ตอนนี้: Public (Dev Mode) | อนาคต: Authenticated
 * @query   {
 *            requesterId: number,     // (จำเป็น) ผู้ขอดูข้อมูล
 *            requesterRole: string,   // (จำเป็น) Role ของผู้ขอ
 *            requesterBranchId?: number, // (ถ้าเป็น ADMIN) สาขาของผู้ขอ
 *            userId?: number,         // (optional) กรองตาม user
 *            shiftType?: string,      // (optional) กรองตามประเภทกะ
 *            isActive?: boolean       // (optional) กรองตามสถานะ
 *          }
 */
router.get('/', shiftController.getShifts);

/**
 * @route   GET /api/shifts/today/:userId
 * @desc    ดึงกะที่ใช้งานได้ในวันนี้ของ user
 * @access  ตอนนี้: Public (Dev Mode) | อนาคต: Authenticated
 */
router.get('/today/:userId', shiftController.getActiveShiftsToday);

/**
 * @route   GET /api/shifts/:id
 * @desc    ดึงกะเฉพาะ ID
 * @access  ตอนนี้: Public (Dev Mode) | อนาคต: Authenticated
 */
router.get('/:id', shiftController.getShiftById);

/**
 * @route   PUT /api/shifts/:id
 * @desc    อัปเดตกะ
 * @access  ตอนนี้: Public (Dev Mode) | อนาคต: Admin/SuperAdmin (based on branch)
 * @body    {
 *            updatedByUserId: number,   // (จำเป็น) ผู้แก้ไข
 *            updaterRole: string,       // (จำเป็น) Role ของผู้แก้ไข
 *            updaterBranchId?: number,  // (ถ้าเป็น ADMIN) สาขาของผู้แก้ไข
 *            name?, startTime?, endTime?, 
 *            gracePeriodMinutes?, lateThresholdMinutes?,
 *            specificDays?, customDate?, locationId?, isActive?
 *          }
 */
router.put('/:id', shiftController.updateShift);

/**
 * @route   DELETE /api/shifts/:id
 * @desc    ลบกะ (soft delete)
 * @access  ตอนนี้: Public (Dev Mode) | อนาคต: Admin/SuperAdmin only
 * @body    { 
 *            deletedByUserId: number,   // (จำเป็น) ผู้ลบ
 *            deleterRole: string,       // (จำเป็น) Role ของผู้ลบ
 *            deleterBranchId?: number,  // (ถ้าเป็น ADMIN) สาขาของผู้ลบ
 *            deleteReason: string       // (จำเป็น) เหตุผลในการลบ
 *          }
 */
// TODO: หลังจากเพื่อนทำ Auth เสร็จ ให้เพิ่ม requireRole(['ADMIN', 'SUPERADMIN'])
router.delete('/:id', shiftController.deleteShift);

export default router;
