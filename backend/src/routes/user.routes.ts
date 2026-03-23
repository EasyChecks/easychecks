import { Router } from 'express';
import * as userController from '../controllers/user.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

/**
 * 👤 User Routes - เส้นทาง API สำหรับจัดการผู้ใช้
 *
 * Permissions:
 * - C (Create): Admin/SuperAdmin only
 * - R (Read): User (own data) | Admin (own branch) | SuperAdmin (all)
 * - U (Update): Admin (own branch) | SuperAdmin (all)
 * - D (Delete): Admin (own branch) | SuperAdmin (all)
 */

// 🔐 ทุก endpoint ใน /api/users ต้องมี token
router.use(authenticate);

/**
 * @route   GET /api/users/csv-template
 * @desc    Get CSV template for bulk import
 * @access  Admin/SuperAdmin only
 */
router.get('/csv-template', userController.getCsvTemplate);

/**
 * @route   GET /api/users/statistics
 * @desc    Get user statistics for dashboard
 * @access  Admin/SuperAdmin only
 */
router.get('/statistics', userController.getUserStatistics);

/**
 * @route   POST /api/users/bulk
 * @desc    Bulk import users from CSV
 * @access  Admin/SuperAdmin only
 * @body    { csvData: string (CSV format) }
 */
router.post('/bulk', userController.bulkCreateUsers);

/**
 * @route   POST /api/users
 * @desc    สร้างผู้ใช้ใหม่ (Admin/SuperAdmin only)
 * @access  Admin/SuperAdmin only
 */
router.post('/', userController.createUser);

/**
 * @route   GET /api/users
 * @desc    ดึงผู้ใช้ทั้งหมด (ตาม role และ branch)
 *          - SuperAdmin: ดูได้ทุกคน
 *          - Admin: ดูได้เฉพาะสาขาตัวเอง
 *          - User: ดูได้เฉพาะตัวเอง
 * @access  Authenticated
 * @query   { branchId?, role?, status?, search?, page?, limit? }
 */
router.get('/', userController.getUsers);

/**
 * @route   GET /api/users/:id
 * @desc    ดึงผู้ใช้ตาม ID
 * @access  Authenticated
 */
router.get('/:id', userController.getUserById);

/**
 * @route   GET /api/users/:id/avatar
 * @desc    ดึง avatar URL ของผู้ใช้
 * @access  Authenticated
 */
router.get('/:id/avatar', userController.getUserAvatar);

/**
 * @route   PUT /api/users/:id
 * @desc    อัปเดตผู้ใช้
 * @access  Admin/SuperAdmin only
 */
router.put('/:id', userController.updateUser);

/**
 * @route   DELETE /api/users/:id
 * @desc    ลบผู้ใช้ (soft delete - เปลี่ยน status เป็น RESIGNED)
 * @access  Admin/SuperAdmin only
 * @body    { deleteReason: string }
 */
router.delete('/:id', userController.deleteUser);

export default router;
