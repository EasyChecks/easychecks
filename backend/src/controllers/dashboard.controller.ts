import type { Request, Response } from 'express';
import {
  getAttendanceSummary,
  getEmployeesToday,
  getBranchesMap,
  getLocationEvents,
  getBranchStats,
} from '../services/dashboard.service.js';

/**
 * 📊 DashboardController - จัดการ HTTP Request/Response สำหรับ Dashboard API
 * 
 * ทำไมต้องแยก Controller?
 * - Controller เป็นชั้นรับ request จาก HTTP, validate, return response
 * - Service handle business logic (query, aggregate, filter)
 * - แยกกัน ทำให้ code maintainable, testable, reusable
 * 
 * Dashboard ประกอบด้วย 5 endpoints:
 * 1. attendance-summary - Donut chart (present/late/absent/leave)
 * 2. employees-today - List ของ employee พร้อม status
 * 3. branches-map - Location pins ของ branch ทั้งหมด
 * 4. location-events - Alert ของคนออก commit นอก branch
 * 5. branch-stats - % present, on-time, etc.
 */

/**
 * GET /api/dashboard/attendance-summary
 * ดึง Attendance Summary (Donut Chart) - Count by status
 * 
 * ทำไมต้อง endpoint นี้?
 * - Dashboard ต้องแสดง overview ตัวเลข (present/late/absent/leave)
 * - ดูได้ด้วย Donut Chart เพื่อให้เห็น distribution
 * - Admin ต้องรู้สถานะพนักงานของเขา (ADMIN: own branch, SUPERADMIN: all)
 * 
 * Query param:
 * - branchId (optional): filter เฉพาะ branch นี้ (อื่นๆ ใช้ user.branchId)
 */
export async function handleAttendanceSummary(req: Request, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { branchId } = req.query;
    console.log('📊 Fetching attendance summary for:', { userId: user.userId, branchId });

    /**
     * เรียก service เพื่อ aggregate ข้อมูล
     * 
     * ข้อมูล return:
     * { present: 15, late: 3, absent: 2, leave: 1 }
     */
    const date = req.query.date as string | undefined;
    const summary = await getAttendanceSummary(user, branchId ? parseInt(branchId as string) : undefined, date);

    res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('❌ Error:', message);
    res.status(500).json({ success: false, error: message });
  }
}

/**
 * GET /api/dashboard/employees-today
 * ดึง List Employee พร้อม Attendance Status วันนี้
 * 
 * ทำไมต้อง endpoint นี้?
 * - Dashboard ต้องแสดงรายชื่อพนักงาน + status วันนี้
 * - Admin ต้องรู้ว่าใครยังไม่ check-in, ใครออกเร็ว, ใครลาป่วย
 * - ใช้ table format เพื่อข้อมูลละเอียด
 * 
 * Data return:
 * - employeeId, firstName, lastName
 * - status (PRESENT, LATE, ABSENT, ON_LEAVE, NOT_CHECKED_IN)
 * - checkInTime, checkOutTime
 * - location info
 * 
 * Query param:
 * - branchId (optional): filter เฉพาะ branch นี้
 */
export async function handleEmployeesToday(req: Request, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { branchId } = req.query;
    console.log('👥 Fetching employees today for:', { userId: user.userId, branchId });

    /**
     * เรียก service เพื่อจับข้อมูล employee + attendance
     * 
     * SQL (Pseudo-code):
     * SELECT e.*, a.status, a.checkInTime, a.checkOutTime, a.address
     * FROM employee e
     * LEFT JOIN attendance a ON e.employeeId = a.employeeId AND DATE(a.createdDate) = TODAY()
     * WHERE (user.role = 'SUPERADMIN' OR e.branchId = user.branchId)
     * AND (branchId IS NULL OR e.branchId = branchId)
     * ORDER BY e.firstName;
     */
    const employees = await getEmployeesToday(user, branchId ? parseInt(branchId as string) : undefined, req.query.date as string | undefined);

    res.status(200).json({
      success: true,
      data: employees,
      total: employees.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('❌ Error:', message);
    res.status(500).json({ success: false, error: message });
  }
}

/**
 * GET /api/dashboard/branches-map
 * ดึง Branches สำหรับ Map Display (Pins)
 * 
 * ทำไมต้อง endpoint นี้?
 * - Dashboard แสดง map ของ branch ทั้งหมด
 * - แต่ละ pin ต้องมี location (lat/lng), name, employee count
 * - เพื่อ Admin เห็น overview ตำแหน่ง branch ของเขา
 * 
 * Permission:
 * - ADMIN: เห็นเฉพาะ branch ของตัวเอง
 * - SUPERADMIN: เห็น branch ทั้งหมด
 * 
 * Data return:
 * - branchId, name, location (lat, lng)
 * - employeeCount: จำนวน employee ในแต่ละ branch
 */
export async function handleBranchesMap(req: Request, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    console.log('🗺️ Fetching branches map for:', { userId: user.userId, role: user.role });

    /**
     * เรียก service เพื่อ fetch branch + count employee
     * 
     * SQL (Pseudo-code):
     * SELECT b.*, COUNT(e.employeeId) as employeeCount
     * FROM branch b
     * LEFT JOIN employee e ON b.branchId = e.branchId
     * WHERE (user.role = 'SUPERADMIN' OR b.branchId = user.branchId)
     * GROUP BY b.branchId;
     */
    const branches = await getBranchesMap(user);

    res.status(200).json({
      success: true,
      data: branches,
      total: branches.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('❌ Error:', message);
    res.status(500).json({ success: false, error: message });
  }
}

/**
 * GET /api/dashboard/location-events
 * ดึง Location Events (Check-in/Check-out Outside Allowed Radius)
 * 
 * ทำไมต้อง endpoint นี้?
 * - Security monitoring: ต้องรู้ว่า employee ออก commit นอก branch ตั้งจาก ไหน
 * - Fraud detection: check-in จากที่ห่างไกล (อาจจะ fake location)
 * - GPS validation: ต้อง flag ถ้า location ไม่ตรงกับ branch
 * 
 * Data return:
 * - employeeId, firstName, lastName
 * - checkInTime, checkOutTime
 * - actualLocation (lat, lng)
 * - distance: ระยะห่างจาก branch center
 * 
 * Query param:
 * - branchId (optional): filter เฉพาะ branch นี้
 */
export async function handleLocationEvents(req: Request, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { branchId } = req.query;
    console.log('📍 Fetching location events for:', { userId: user.userId, branchId });

    /**
     * เรียก service เพื่อจับ attendance ที่ location นอก radius
     * 
     * SQL (Pseudo-code):
     * SELECT a.*, e.firstName, e.lastName, b.locationLat, b.locationLng
     * FROM attendance a
     * JOIN employee e ON a.employeeId = e.employeeId
     * JOIN branch b ON e.branchId = b.branchId
     * WHERE DATE(a.createdDate) = TODAY()
     * AND DISTANCE(a.latitude, a.longitude, b.locationLat, b.locationLng) > b.radiusMeters
     * AND (user.role = 'SUPERADMIN' OR e.branchId = user.branchId)
     * ORDER BY a.createdDate DESC;
     */
    const events = await getLocationEvents(user, branchId ? parseInt(branchId as string) : undefined, req.query.date as string | undefined);

    res.status(200).json({
      success: true,
      data: events,
      total: events.length,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('❌ Error:', message);
    res.status(500).json({ success: false, error: message });
  }
}

/**
 * GET /api/dashboard/branch-stats
 * ดึง Branch Statistics (Aggregate Data)
 * 
 * ทำไมต้อง endpoint นี้?
 * - KPI dashboard: แสดง % on-time, % present, % productivity
 * - Management overview: ผู้บริหารต้องรู้ performance ของแต่ละ branch
 * - Comparison: เปรียบเทียบ branch ไหนดีสุด
 * 
 * Data return:
 * - branchId, name
 * - presentCount, lateCount, absentCount, onLeaveCount
 * - onTimePercentage, presentPercentage
 * - employeeCount (active)
 * 
 * Query param:
 * - branchId (optional): filter เฉพาะ branch นี้
 */
export async function handleBranchStats(req: Request, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { branchId } = req.query;
    console.log('📈 Fetching branch stats for:', { userId: user.userId, branchId });

    /**
     * เรียก service เพื่อ calculate statistics
     * 
     * SQL (Pseudo-code):
     * SELECT 
     *   b.branchId, b.name,
     *   COUNT(a.attendanceId) as totalRecords,
     *   SUM(CASE WHEN a.status = 'PRESENT' THEN 1 ELSE 0 END) as presentCount,
     *   SUM(CASE WHEN a.status = 'LATE' THEN 1 ELSE 0 END) as lateCount,
     *   SUM(CASE WHEN a.status = 'ABSENT' THEN 1 ELSE 0 END) as absentCount,
     *   SUM(CASE WHEN a.status = 'ON_LEAVE' THEN 1 ELSE 0 END) as onLeaveCount,
     *   ROUND(SUM(CASE WHEN a.status = 'PRESENT' THEN 1 ELSE 0 END) / COUNT(a.attendanceId) * 100, 2) as presentPercentage
     * FROM branch b
     * LEFT JOIN employee e ON b.branchId = e.branchId
     * LEFT JOIN attendance a ON e.employeeId = a.employeeId AND DATE(a.createdDate) = TODAY()
     * GROUP BY b.branchId;
     */
    const stats = await getBranchStats(user, branchId ? parseInt(branchId as string) : undefined, req.query.date as string | undefined);

    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('❌ Error:', message);
    res.status(500).json({ success: false, error: message });
  }
}
