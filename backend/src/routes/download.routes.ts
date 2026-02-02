import { Router } from 'express';
import { requireRole } from '../middleware/role.middleware.js';
import {
  handleDownloadReport,
  handleDownloadHistory,
} from '../controllers/download.controller.js';

/**
 * 📥 Download Routes
 * /api/download/*
 */

const router = Router();

/**
 * GET /api/download/report
 * ดาวน์โหลดรายงาน (ADMIN, SUPERADMIN)
 * 
 * Query Parameters:
 * - type: 'attendance' | 'shift' (required)
 * - format: 'excel' | 'pdf' (required)
 * - startDate: ISO string (optional)
 * - endDate: ISO string (optional)
 * - branchId: number (optional, SUPERADMIN only)
 * 
 * Example: GET /api/download/report?type=attendance&format=excel&startDate=2025-01-01&endDate=2025-12-31
 */
router.get('/report', requireRole(['ADMIN', 'SUPERADMIN']), handleDownloadReport);

/**
 * GET /api/download/report-test
 * ดาวน์โหลดรายงาน (TEST - ไม่ต้องมี role middleware)
 */
router.get('/report-test', handleDownloadReport);

/**
 * GET /api/download/history
 * ดูประวัติการดาวน์โหลด
 * 
 * Query Parameters:
 * - limit: number (default: 10)
 * - offset: number (default: 0)
 * 
 * Example: GET /api/download/history?limit=20&offset=0
 */
router.get('/history', requireRole(['ADMIN', 'SUPERADMIN']), handleDownloadHistory);

/**
 * GET /api/download/history-test
 * ดูประวัติการดาวน์โหลด (TEST - ไม่ต้องมี role middleware)
 */
router.get('/history-test', handleDownloadHistory);

export default router;
