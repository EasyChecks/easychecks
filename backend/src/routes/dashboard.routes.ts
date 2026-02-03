import { Router } from 'express';
import { requireRole } from '../middleware/role.middleware.js';
import {
  handleAttendanceSummary,
  handleEmployeesToday,
  handleBranchesMap,
  handleLocationEvents,
  handleBranchStats,
} from '../controllers/dashboard.controller.js';

/**
 * 📊 Dashboard Routes
 * /api/dashboard/*
 */

const router = Router();

/**
 * GET /api/dashboard/attendance-summary
 * ดึง Attendance Summary (Donut Chart)
 * 
 * Query Parameters:
 * - branchId: number (optional, SUPERADMIN only)
 */
router.get(
  '/attendance-summary',
  requireRole(['ADMIN', 'SUPERADMIN']),
  handleAttendanceSummary
);

/**
 * GET /api/dashboard/attendance-summary-test
 * ดึง Attendance Summary (TEST - ไม่ต้องมี role middleware)
 */
router.get(
  '/attendance-summary-test',
  handleAttendanceSummary
);

/**
 * GET /api/dashboard/employees-today
 * ดึงพนักงานวันนี้พร้อม Status
 * 
 * Query Parameters:
 * - branchId: number (optional, SUPERADMIN only)
 */
router.get(
  '/employees-today',
  requireRole(['ADMIN', 'SUPERADMIN']),
  handleEmployeesToday
);

/**
 * GET /api/dashboard/employees-today-test
 * ดึงพนักงานวันนี้ (TEST - ไม่ต้องมี role middleware)
 */
router.get(
  '/employees-today-test',
  handleEmployeesToday
);

/**
 * GET /api/dashboard/branches-map
 * ดึง Branches สำหรับ Map (Pins)
 * Admin: เห็นเฉพาะสาขาตัวเอง
 * SuperAdmin: เห็นทุกสาขา
 */
router.get(
  '/branches-map',
  requireRole(['ADMIN', 'SUPERADMIN']),
  handleBranchesMap
);

/**
 * GET /api/dashboard/branches-map-test
 * ดึง Branches สำหรับ Map (TEST - ไม่ต้องมี role middleware)
 */
router.get(
  '/branches-map-test',
  handleBranchesMap
);

/**
 * GET /api/dashboard/location-events
 * ดึง Location Events (Check-in Outside Locations)
 * 
 * Query Parameters:
 * - branchId: number (optional, SUPERADMIN only)
 */
router.get(
  '/location-events',
  requireRole(['ADMIN', 'SUPERADMIN']),
  handleLocationEvents
);

/**
 * GET /api/dashboard/location-events-test
 * ดึง Location Events (TEST - ไม่ต้องมี role middleware)
 */
router.get(
  '/location-events-test',
  handleLocationEvents
);

/**
 * GET /api/dashboard/branch-stats
 * ดึง Branch Statistics
 * 
 * Query Parameters:
 * - branchId: number (optional, SUPERADMIN only)
 */
router.get(
  '/branch-stats',
  requireRole(['ADMIN', 'SUPERADMIN']),
  handleBranchStats
);

/**
 * GET /api/dashboard/branch-stats-test
 * ดึง Branch Statistics (TEST - ไม่ต้องมี role middleware)
 */
router.get(
  '/branch-stats-test',
  handleBranchStats
);

export default router;
