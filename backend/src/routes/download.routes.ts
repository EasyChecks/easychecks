import { Router } from 'express';
import { requireRole } from '../middleware/role.middleware.js';
import {
  handleDownloadReport,
  handleDownloadHistory,
} from '../controllers/download.controller.js';

/**
 * 📥 Download Routes - API endpoints สำหรับดาวน์โหลดรายงาน
 * 
 * ทำไมต้องมี Download routes?
 * - User ต้องดาวน์โหลด attendance/shift report เป็น Excel หรือ PDF
 * - ต้อง authorize ให้เฉพาะ ADMIN/SUPERADMIN เท่านั้น
 * - ต้องเก็บ audit log (history) ว่าใครดาวน์โหลดอะไร เมื่อไร
 * 
 * Route structure:
 * /api/download/report - ดาวน์โหลดรายงาน (production)
 * /api/download/report-test - ดาวน์โหลดรายงาน (unit test)
 * /api/download/history - ดูประวัติการดาวน์โหลด
 */

const router = Router();

/**
 * GET /api/download/report - ดาวน์โหลดรายงาน (Attendance/Shift)
 * 
 * Security: requireRole(['ADMIN', 'SUPERADMIN'])
 * 
 * ทำไมต้อง role check?
 * - Attendance/Shift ข้อมูล sensitive (รายละเอียดการทำงาน)
 * - ต้อง authorize เฉพาะผู้บริหาร/แอดมิน เท่านั้น
 * - ADMIN จะได้ download เฉพาะ branch ของตัวเอง (check ใน service)
 * - SUPERADMIN download ได้ทุก branch
 * 
 * Query Parameters:
 * - type: 'attendance' | 'shift' (required)
 * - format: 'excel' | 'pdf' (required)
 * - startDate: ISO DateTime string (optional) - filter records from this date
 * - endDate: ISO DateTime string (optional) - filter records until this date
 * - branchId: number (optional) - filter เฉพาะ branch นี้
 * 
 * Example:
 * GET /api/download/report?type=attendance&format=excel&startDate=2025-01-01&endDate=2025-12-31
 * GET /api/download/report?type=shift&format=pdf&branchId=2
 */
router.get('/report', requireRole(['ADMIN', 'SUPERADMIN']), handleDownloadReport);

/**
 * GET /api/download/report-test - ดาวน์โหลดรายงาน (TEST ONLY)
 * 
 * ทำไมต้อง -test endpoint?
 * - Unit test ต้อ end-to-end test route ที่ไม่ require role middleware
 * - ไม่ allow ใน production (ดู API_DOCS สำหรับ environment setup)
 * - ใช้เดียวกับ controller/handler เพื่อ test logic เดียวกัน
 */
router.get('/report-test', handleDownloadReport);

/**
 * GET /api/download/history - ดูประวัติการดาวน์โหลด
 * 
 * Security: requireRole(['ADMIN', 'SUPERADMIN'])
 * 
 * ทำไมต้อง history endpoint?
 * - Audit trail: รู้ว่าใครดาวน์โหลดรายงาน เมื่อไร ดาวน์โหลดอะไร
 * - Compliance: ต้องบันทึก data access สำหรับ GDPR/regulation
 * - Security monitoring: ตรวจจับการดาวน์โหลดผิดปกติ
 * 
 * Role-based behavior:
 * - ADMIN: เห็นเฉพาะ download history ของตัวเอง
 * - SUPERADMIN: เห็นทั้งหมด (check ใน service/controller)
 * 
 * Query Parameters:
 * - limit: number (default: 10) - จำนวน record ต่อหน้า
 * - offset: number (default: 0) - ข้าม record กี่อันสำหรับ pagination
 * 
 * Example:
 * GET /api/download/history?limit=20&offset=0 - page 1
 * GET /api/download/history?limit=20&offset=20 - page 2
 */
router.get('/history', requireRole(['ADMIN', 'SUPERADMIN']), handleDownloadHistory);

/**
 * GET /api/download/history-test - ดูประวัติการดาวน์โหลด (TEST ONLY)
 * 
 * ทำไม -test endpoint?
 * - วิธีเดียวกับ /report-test
 * - ใช้ test route เพื่อ test history API โดยไม่ต้อง role check
 */
router.get('/history-test', handleDownloadHistory);

export default router;
