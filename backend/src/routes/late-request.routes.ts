import { Router } from 'express';
import * as lateRequestController from '../controllers/late-request.controller.js';
import { authenticate, authorizeRole } from '../middleware/auth.middleware.js';

const router = Router();

/**
 * Late Request Routes - การจัดการคำขอมาสาย
 * 
 * Permissions:
 * - Create: ทุก Role ที่ authenticate แล้ว
 * - Read (own): User สามารถดูคำขอของตัวเอง
 * - Read (all): Admin/Superadmin/Manager
 * - Update (own): User สามารถแก้ไขคำขอ PENDING ของตัวเอง
 * - Approve: Admin/Superadmin/Manager only
 * - Reject: Admin/Superadmin/Manager only
 * - Delete (own): User สามารถลบคำขอ PENDING ของตัวเอง
 */

/**
 * @route   POST /api/late-requests
 * @desc    สร้างคำขอมาสายใหม่
 * @access  Authenticated (ทุก Role)
 * @body    requestDate, scheduledTime (HH:MM), actualTime (HH:MM), reason, attendanceId?, attachmentUrl?
 */
router.post('/', authenticate, lateRequestController.createLateRequest);

/**
 * @route   GET /api/late-requests/my
 * @desc    ดึงคำขอมาสายของผู้ใช้เอง
 * @access  Authenticated
 * @query   status? (PENDING|APPROVED|REJECTED), skip?, take?
 */
router.get('/my', authenticate, lateRequestController.getMyLateRequests);

/**
 * @route   GET /api/late-requests/my/statistics
 * @desc    ดึงสถิติการมาสายของผู้ใช้เอง
 * @access  Authenticated
 */
router.get('/my/statistics', authenticate, lateRequestController.getMyLateStatistics);

/**
 * @route   GET /api/late-requests
 * @desc    ดึงคำขอมาสายทั้งหมด (Admin/Manager only)
 * @access  Admin/Superadmin/Manager
 * @query   status? (PENDING|APPROVED|REJECTED), skip?, take?
 */
router.get('/', authenticate, authorizeRole('ADMIN', 'SUPERADMIN', 'MANAGER'), lateRequestController.getAllLateRequests);

/**
 * @route   GET /api/late-requests/:id
 * @desc    ดึงคำขอมาสายด้วย ID
 * @access  Authenticated
 */
router.get('/:id', authenticate, lateRequestController.getLateRequestById);

/**
 * @route   PATCH /api/late-requests/:id
 * @desc    แก้ไขคำขอมาสาย (เฉพาะ PENDING)
 * @access  Owner หรือ Admin
 * @body    requestDate?, scheduledTime?, actualTime?, reason?, attachmentUrl?
 */
router.patch('/:id', authenticate, lateRequestController.updateLateRequest);

/**
 * @route   POST /api/late-requests/:id/approve
 * @desc    อนุมัติคำขอมาสาย
 * @access  Admin/Superadmin/Manager only
 * @body    adminComment?
 */
router.post('/:id/approve', authenticate, authorizeRole('ADMIN', 'SUPERADMIN', 'MANAGER'), lateRequestController.approveLateRequest);

/**
 * @route   POST /api/late-requests/:id/reject
 * @desc    ปฏิเสธคำขอมาสาย
 * @access  Admin/Superadmin/Manager only
 * @body    rejectionReason (required)
 */
router.post('/:id/reject', authenticate, authorizeRole('ADMIN', 'SUPERADMIN', 'MANAGER'), lateRequestController.rejectLateRequest);

/**
 * @route   DELETE /api/late-requests/:id
 * @desc    ลบคำขอมาสาย (เฉพาะ PENDING)
 * @access  Owner หรือ Admin
 */
router.delete('/:id', authenticate, lateRequestController.deleteLateRequest);

export default router;
