import { Router } from 'express';
import {
  createEvent,
  getAllEvents,
  getMyEvents,
  getEventStatistics,
  getEventById,
  updateEvent,
  deleteEvent,
  restoreEvent,
} from '../controllers/event.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/role.middleware.js';

const router = Router();

/**
 * Event Routes
 * 
 * ทุก route ต้อง authenticate
 * Admin/SuperAdmin: สร้าง, แก้ไข, ลบ, กู้คืน
 * ทุกคน: ดูรายการ, ดูกิจกรรมตัวเอง
 */

// ต้อง authenticate ทุก route
router.use(authenticate);

/**
 * POST /api/events
 * สร้างกิจกรรมใหม่ (Admin/SuperAdmin only)
 */
router.post('/', requireRole(['ADMIN', 'SUPERADMIN']), createEvent);

/**
 * GET /api/events/my
 * ดึงกิจกรรมที่ผู้ใช้เข้าร่วม
 */
router.get('/my', getMyEvents);

/**
 * GET /api/events/statistics
 * ดึงสถิติกิจกรรม (Admin only)
 */
router.get(
  '/statistics',
  requireRole(['ADMIN', 'SUPERADMIN']),
  getEventStatistics
);

/**
 * GET /api/events
 * ดึงรายการกิจกรรมทั้งหมด
 * Query params:
 * - search: ค้นหาจากชื่อหรือรายละเอียด
 * - participantType: กรองตามประเภทผู้เข้าร่วม (ALL, INDIVIDUAL, BRANCH, ROLE)
 * - isActive: กรองตามสถานะ (true/false)
 * - startDate: วันที่เริ่มต้น
 * - endDate: วันที่สิ้นสุด
 * - skip: จำนวนที่ข้าม (pagination)
 * - take: จำนวนที่ดึง (pagination)
 */
router.get('/', getAllEvents);

/**
 * GET /api/events/:id
 * ดึงกิจกรรมด้วย ID
 */
router.get('/:id', getEventById);

/**
 * PATCH /api/events/:id
 * แก้ไขกิจกรรม (Admin/SuperAdmin only)
 */
router.patch('/:id', requireRole(['ADMIN', 'SUPERADMIN']), updateEvent);

/**
 * DELETE /api/events/:id
 * ลบกิจกรรม (Soft Delete) (Admin/SuperAdmin only)
 */
router.delete('/:id', requireRole(['ADMIN', 'SUPERADMIN']), deleteEvent);

/**
 * POST /api/events/:id/restore
 * กู้คืนกิจกรรมที่ถูกลบ (Admin/SuperAdmin only)
 */
router.post(
  '/:id/restore',
  requireRole(['ADMIN', 'SUPERADMIN']),
  restoreEvent
);

export default router;
