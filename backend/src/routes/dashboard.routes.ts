import { Router } from 'express';
import { requireRole } from '../middleware/role.middleware.js';
import {
  handleAttendanceSummary,
  handleEmployeesToday,
  handleBranchesMap,
  handleLocationEvents,
} from '../controllers/dashboard.controller.js';

/**
 * 📊 Dashboard Routes - API endpoints สำหรับ Dashboard display
 * 
 * ทำไมต้อง Dashboard routes?
 * - Frontend ต้อง fetch ข้อมูล dashboard เพื่อ render charts/tables
 * - ต้อง authorize เฉพาะ ADMIN/SUPERADMIN (sensitive data)
 * - 4 endpoints รวม: attendance summary, employees today, branches map, location events
 * 
 * Role-based access:
 * - ADMIN: เห็นเฉพาะ branch ของตัวเอง (check ใน controller/service)
 * - SUPERADMIN: เห็นทั้งหมด
 * 
 * Test endpoints:
 * - ทั้งหมด endpoint มี -test version สำหรับ unit test
 * - Test version ไม่มี role middleware (allow direct testing)
 */

const router = Router();

/**
 * GET /api/dashboard/attendance-summary - สรุป attendance นับตามประเภท
 * 
 * ทำไมต้อง endpoint นี้?
 * - Dashboard Donut Chart ต้อง count by status (present, late, absent, on_leave)
 * - ต้อง real-time aggregate ข้อมูล
 * - ADMIN ต้องรู้ overview ของ branch เขา
 * 
 * Response: { present: 15, late: 3, absent: 2, leave: 1 }
 * 
 * Query Parameters:
 * - branchId (optional): filter เฉพาะ branch นี้ (SUPERADMIN only)
 * 
 * Security: requireRole(['ADMIN', 'SUPERADMIN'])
 */
router.get(
  '/attendance-summary',
  requireRole(['ADMIN', 'SUPERADMIN']),
  handleAttendanceSummary
);

/**
 * GET /api/dashboard/attendance-summary-test - สรุป attendance (TEST)
 * 
 * ทำไมต้อง -test endpoint?
 * - Unit test ต้อง test route ไม่มี middleware
 * - ใช้ controller เดียวกัน เพื่อ test logic
 * - Disabled ใน production (ดู API_DOCS)
 */
router.get(
  '/attendance-summary-test',
  handleAttendanceSummary
);

/**
 * GET /api/dashboard/employees-today - List employee พร้อม check-in status วนนี้
 * 
 * ทำไมต้อง endpoint นี้?
 * - Dashboard table ต้อง แสดงรายชื่อพนักงาน + status (PRESENT/LATE/ABSENT/ON_LEAVE/NOT_CHECKED_IN)
 * - ADMIN ต้องเห็น subordinate มี check-in ยัง หรือยัง
 * - ใช้ data ร่อม real-time monitoring
 * 
 * Response: [{ employeeId, firstName, lastName, status, checkInTime, ... }]
 * 
 * Query Parameters:
 * - branchId (optional): filter เฉพาะ branch นี้ (SUPERADMIN only)
 * 
 * Security: requireRole(['ADMIN', 'SUPERADMIN'])
 */
router.get(
  '/employees-today',
  requireRole(['ADMIN', 'SUPERADMIN']),
  handleEmployeesToday
);

/**
 * GET /api/dashboard/employees-today-test - List employee วนนี้ (TEST)
 * 
 * ทำไมต้อง -test endpoint?
 * - วิธีเดียวกับ /attendance-summary-test
 * - Test API ไม่ต้อง role check
 */
router.get(
  '/employees-today-test',
  handleEmployeesToday
);

/**
 * GET /api/dashboard/branches-map - List branch พร้อม location (lat/lng) สำหรับ pin
 * 
 * ทำไมต้อง endpoint นี้?
 * - Dashboard Map ต้อง display pins ของ branch ทั้งหมด
 * - แต่ละ pin ต้องมี: location (lat/lng), name, employee count
 * - ADMIN เห็นเฉพาะ branch ของตัวเอง = limited pins
 * - SUPERADMIN เห็นทั้งหมด = ทั้ง company map
 * 
 * Response: [{ branchId, name, locationLat, locationLng, employeeCount, ... }]
 * 
 * Role-based:
 * - ADMIN: เห็นเฉพาะ branch ของตัวเอง
 * - SUPERADMIN: เห็นทั้งหมด
 * 
 * Security: requireRole(['ADMIN', 'SUPERADMIN'])
 */
router.get(
  '/branches-map',
  requireRole(['ADMIN', 'SUPERADMIN']),
  handleBranchesMap
);

/**
 * GET /api/dashboard/branches-map-test - List branch สำหรับ map (TEST)
 * 
 * ทำไมต้อง -test endpoint?
 * - Test route ไม่มี middleware
 */
router.get(
  '/branches-map-test',
  handleBranchesMap
);

/**
 * GET /api/dashboard/location-events - List check-in/out ที่นอก radius
 * 
 * ทำไมต้อง endpoint นี้?
 * - Security/compliance: monitor จาก check-in ที่ไม่ตรงกับตำแหน่ง branch
 * - Fraud detection: อาจ fake location, cek-in remotely
 * - Alert: ADMIN ต้องรู้ว่า employee ไปที่ไหน
 * 
 * Response: [{ employeeId, firstName, lastName, checkInTime, distance, actualLocation, ... }]
 * 
 * Query Parameters:
 * - branchId (optional): filter เฉพาะ branch นี้ (SUPERADMIN only)
 * 
 * Security: requireRole(['ADMIN', 'SUPERADMIN'])
 */
router.get(
  '/location-events',
  requireRole(['ADMIN', 'SUPERADMIN']),
  handleLocationEvents
);

/**
 * GET /api/dashboard/location-events-test - Location events นอก radius (TEST)
 * 
 * ทำไม -test endpoint?
 * - Test route ไม่มี middleware
 */
router.get(
  '/location-events-test',
  handleLocationEvents
);

export default router;
