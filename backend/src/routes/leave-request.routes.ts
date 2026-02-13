import { Router } from 'express';
import * as leaveRequestController from '../controllers/leave-request.controller.js';
import { authenticate, authorizeRole } from '../middleware/auth.middleware.js';

const router = Router();

/**
 * Leave Request Routes - การจัดการใบลา
 * 
 * Permissions:
 * - Create: ทุก Role ที่ authenticate แล้ว
 * - Read (own): User สามารถดูใบลาของตัวเอง
 * - Read (all): Admin/Superadmin/Manager
 * - Update (own): User สามารถแก้ไขใบลา PENDING ของตัวเอง
 * - Approve: Admin/Superadmin/Manager only
 * - Reject: Admin/Superadmin/Manager only
 * - Delete (own): User สามารถลบใบลา PENDING ของตัวเอง
 */

/**
 * @route   POST /api/leave-requests
 * @desc    สร้างใบลาใหม่
 * @access  Authenticated (ทุก Role)
 * @body    leaveType (SICK|PERSONAL|VACATION), startDate, endDate, reason?, attachmentUrl?
 */
router.post('/', authenticate, leaveRequestController.createLeaveRequest);

/**
 * @route   GET /api/leave-requests/my
 * @desc    ดึงใบลาของผู้ใช้เอง
 * @access  Authenticated
 * @query   status? (PENDING|APPROVED|REJECTED), skip?, take?
 */
router.get('/my', authenticate, leaveRequestController.getMyLeaveRequests);

/**
 * @route   GET /api/leave-requests/my/statistics
 * @desc    ดึงสถิติการลาของผู้ใช้เอง
 * @access  Authenticated
 */
router.get('/my/statistics', authenticate, leaveRequestController.getMyLeaveStatistics);

/**
 * @route   GET /api/leave-requests/my/quota
 * @desc    ดึงโควต้าการลาของผู้ใช้เอง (วันลาคงเหลือทุกประเภท)
 * @access  Authenticated
 */
router.get('/my/quota', authenticate, leaveRequestController.getMyLeaveQuota);

/**
 * @route   GET /api/leave-requests
 * @desc    ดึงใบลาทั้งหมด (Admin/Manager only)
 * @access  Admin/Superadmin/Manager
 * @query   status? (PENDING|APPROVED|REJECTED), skip?, take?
 */
router.get('/', authenticate, authorizeRole('ADMIN', 'SUPERADMIN', 'MANAGER'), leaveRequestController.getAllLeaveRequests);

/**
 * @route   GET /api/leave-requests/:id
 * @desc    ดึงใบลาด้วย ID
 * @access  Authenticated
 */
router.get('/:id', authenticate, leaveRequestController.getLeaveRequestById);

/**
 * @route   PATCH /api/leave-requests/:id
 * @desc    แก้ไขใบลา (เฉพาะ PENDING)
 * @access  Owner หรือ Admin
 * @body    leaveType?, startDate?, endDate?, reason?, attachmentUrl?
 */
router.patch('/:id', authenticate, leaveRequestController.updateLeaveRequest);

/**
 * @route   POST /api/leave-requests/:id/approve
 * @desc    อนุมัติใบลา
 * @access  Admin/Superadmin/Manager only
 * @body    adminComment?
 */
router.post('/:id/approve', authenticate, authorizeRole('ADMIN', 'SUPERADMIN', 'MANAGER'), leaveRequestController.approveLeaveRequest);

/**
 * @route   POST /api/leave-requests/:id/reject
 * @desc    ปฏิเสธใบลา
 * @access  Admin/Superadmin/Manager only
 * @body    rejectionReason (required)
 */
router.post('/:id/reject', authenticate, authorizeRole('ADMIN', 'SUPERADMIN', 'MANAGER'), leaveRequestController.rejectLeaveRequest);

/**
 * @route   DELETE /api/leave-requests/:id
 * @desc    ลบใบลา (เฉพาะ PENDING)
 * @access  Owner หรือ Admin
 */
router.delete('/:id', authenticate, leaveRequestController.deleteLeaveRequest);

export default router;
