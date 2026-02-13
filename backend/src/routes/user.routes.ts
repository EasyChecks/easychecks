import { Router } from 'express';
import * as userController from '../controllers/user.controller.js';
// TODO: หลังจากเพื่อนทำ Auth เสร็จ ให้ uncomment 2 บรรทัดนี้
// import { authenticate } from '../middleware/auth.middleware';
// import { requireRole } from '../middleware/role.middleware';

const router = Router();

/**
 * 👤 User Routes - เส้นทาง API สำหรับจัดการผู้ใช้
 * 
 * 🔴 หมายเหตุ: ตอนนี้ยังไม่ใส่ Auth Middleware
 * - รอเพื่อนทำ Auth เสร็จก่อนค่อยเปิดใช้งาน
 * - ตอนนี้ส่ง userId, role มาใน body/query แทน
 * 
 * Permissions (อนาคต):
 * - C (Create): Admin/SuperAdmin only
 * - R (Read): User (own data) | Admin (own branch) | SuperAdmin (all)
 * - U (Update): Admin (own branch) | SuperAdmin (all)
 * - D (Delete): Admin (own branch) | SuperAdmin (all)
 */

// TODO: หลังจากเพื่อนทำ Auth เสร็จ ให้ uncomment บรรทัดนี้
// router.use(authenticate);

/**
 * @route   GET /api/users/csv-template
 * @desc    Get CSV template for bulk import
 * @access  ตอนนี้: Public (Dev Mode) | อนาคต: Admin/SuperAdmin only
 */
router.get('/csv-template', userController.getCsvTemplate);

/**
 * @route   GET /api/users/statistics
 * @desc    Get user statistics for dashboard
 * @access  ตอนนี้: Public (Dev Mode) | อนาคต: Admin/SuperAdmin only
 * @query   {
 *            requesterRole: string,
 *            requesterBranchId?: number
 *          }
 */
router.get('/statistics', userController.getUserStatistics);

/**
 * @route   POST /api/users/bulk
 * @desc    Bulk import users from CSV
 * @access  ตอนนี้: Public (Dev Mode) | อนาคต: Admin/SuperAdmin only
 * @body    {
 *            createdByUserId: number,
 *            creatorRole: string,
 *            creatorBranchId?: number,
 *            csvData: string (CSV format)
 *          }
 */
// TODO: หลังจากเพื่อนทำ Auth เสร็จ ให้เพิ่ม requireRole(['ADMIN', 'SUPERADMIN'])
router.post('/bulk', userController.bulkCreateUsers);

/**
 * @route   POST /api/users
 * @desc    สร้างผู้ใช้ใหม่ (Admin/SuperAdmin only)
 * @access  ตอนนี้: Public (Dev Mode) | อนาคต: Admin/SuperAdmin only
 * @body    {
 *            createdByUserId: number,
 *            creatorRole: string,
 *            creatorBranchId?: number,
 *            employeeId: string,
 *            firstName: string,
 *            lastName: string,
 *            nickname?: string,
 *            nationalId: string,
 *            emergent_tel: string,
 *            emergent_first_name: string,
 *            emergent_last_name: string,
 *            emergent_relation: string,
 *            phone: string,
 *            email: string,
 *            password: string,
 *            birthDate?: string,
 *            branchId?: number,
 *            role?: string,
 *            avatarGender?: string
 *          }
 */
// TODO: หลังจากเพื่อนทำ Auth เสร็จ ให้เพิ่ม requireRole(['ADMIN', 'SUPERADMIN'])
router.post('/', userController.createUser);

/**
 * @route   GET /api/users
 * @desc    ดึงผู้ใช้ทั้งหมด (ตาม role และ branch)
 *          - SuperAdmin: ดูได้ทุกคน
 *          - Admin: ดูได้เฉพาะสาขาตัวเอง
 *          - User: ดูได้เฉพาะตัวเอง
 * @access  ตอนนี้: Public (Dev Mode) | อนาคต: Authenticated
 * @query   {
 *            requesterId: number,
 *            requesterRole: string,
 *            requesterBranchId?: number,
 *            branchId?: number,
 *            role?: string,
 *            status?: string,
 *            search?: string,
 *            page?: number,
 *            limit?: number
 *          }
 */
router.get('/', userController.getUsers);

/**
 * @route   GET /api/users/:id
 * @desc    ดึงผู้ใช้ตาม ID
 * @access  ตอนนี้: Public (Dev Mode) | อนาคต: Authenticated
 * @query   {
 *            requesterId?: number,
 *            requesterRole?: string,
 *            requesterBranchId?: number
 *          }
 */
router.get('/:id', userController.getUserById);

/**
 * @route   GET /api/users/:id/avatar
 * @desc    ดึง avatar URL ของผู้ใช้
 * @access  ตอนนี้: Public (Dev Mode) | อนาคต: Authenticated
 */
router.get('/:id/avatar', userController.getUserAvatar);

/**
 * @route   PUT /api/users/:id
 * @desc    อัปเดตผู้ใช้
 * @access  ตอนนี้: Public (Dev Mode) | อนาคต: Admin/SuperAdmin (based on branch)
 * @body    {
 *            updatedByUserId: number,
 *            updaterRole: string,
 *            updaterBranchId?: number,
 *            firstName?, lastName?, nickname?, nationalId?,
 *            emergent_tel?, emergent_first_name?, emergent_last_name?, emergent_relation?,
 *            phone?, email?, password?, birthDate?,
 *            branchId?, role?, status?, avatarGender?
 *          }
 */
router.put('/:id', userController.updateUser);

/**
 * @route   DELETE /api/users/:id
 * @desc    ลบผู้ใช้ (soft delete - เปลี่ยน status เป็น RESIGNED)
 * @access  ตอนนี้: Public (Dev Mode) | อนาคต: Admin/SuperAdmin only
 * @body    {
 *            deletedByUserId: number,
 *            deleterRole: string,
 *            deleterBranchId?: number,
 *            deleteReason: string
 *          }
 */
// TODO: หลังจากเพื่อนทำ Auth เสร็จ ให้เพิ่ม requireRole(['ADMIN', 'SUPERADMIN'])
router.delete('/:id', userController.deleteUser);

export default router;
