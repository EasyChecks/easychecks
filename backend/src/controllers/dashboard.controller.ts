import type { Request, Response } from 'express';
import {
  getAttendanceSummary,
  getEmployeesToday,
  getBranchesMap,
  getLocationEvents,
  getBranchStats,
} from '../services/dashboard.service.js';

/**
 * 📊 Dashboard Controller
 * จัดการ HTTP requests สำหรับ Dashboard
 */

/**
 * GET /api/dashboard/attendance-summary
 * ดึง Attendance Summary (Donut Chart)
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

    const summary = await getAttendanceSummary(user, branchId ? parseInt(branchId as string) : undefined);

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
 * ดึงพนักงานวันนี้พร้อม Status
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

    const employees = await getEmployeesToday(user, branchId ? parseInt(branchId as string) : undefined);

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
 * ดึง Branches สำหรับ Map (Pins)
 */
export async function handleBranchesMap(req: Request, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    console.log('🗺️ Fetching branches map for:', { userId: user.userId, role: user.role });

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
 * ดึง Location Events (Check-in Outside Locations)
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

    const events = await getLocationEvents(user, branchId ? parseInt(branchId as string) : undefined);

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
 * ดึง Branch Statistics
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

    const stats = await getBranchStats(user, branchId ? parseInt(branchId as string) : undefined);

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
