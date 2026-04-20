import { Router } from 'express';
import { requireRole } from '../middleware/role.middleware.js';
import {
  handleDownloadReport,
  handlePreviewReport,
} from '../controllers/download.controller.js';

/**
 * 📥 Download Routes - API endpoints สำหรับดาวน์โหลดรายงาน
 * 
 * ทำไมต้องมี Download routes?
 * - User ต้องดาวน์โหลด attendance/shift report เป็น Excel
 * - ต้อง authorize ให้เฉพาะ ADMIN/SUPERADMIN เท่านั้น
 * 
 * Route structure:
 * /api/download/report - ดาวน์โหลดรายงาน
 */

const router = Router();

/**
 * GET /api/download/report - ดาวน์โหลดรายงาน Attendance (Excel/PDF)
 * 
 * Security: requireRole(['ADMIN', 'SUPERADMIN'])
 * 
 * ทำไมต้อง role check?
 * - Attendance ข้อมูล sensitive (รายละเอียดการทำงาน)
 * - ต้อง authorize เฉพาะผู้บริหาร/แอดมิน เท่านั้น
 * - ADMIN จะได้ download เฉพาะ branch ของตัวเอง (check ใน service)
 * - SUPERADMIN download ได้ทุก branch
 * 
 * Query Parameters:
 * - type: 'attendance' (required) — รองรับเฉพาะ attendance
 * - format: 'excel' | 'pdf' (required)
 * - startDate: ISO date string (optional)
 * - endDate: ISO date string (optional)
 * - branchId: number (optional) - filter เฉพาะ branch นี้
 * - filterType: 'all' | 'shift' | 'event' (optional) - กรองข้อมูลตามประเภท
 * 
 * Example:
 * GET /api/download/report?type=attendance&format=excel&startDate=2025-01-01&endDate=2025-12-31
 * GET /api/download/report?type=attendance&format=pdf&filterType=event
 */
router.get('/report', requireRole(['ADMIN', 'SUPERADMIN']), handleDownloadReport);
router.get('/preview', requireRole(['ADMIN', 'SUPERADMIN']), handlePreviewReport);

export default router;
