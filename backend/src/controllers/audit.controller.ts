/**
 * 📋 Audit Controller — API สำหรับดึง Audit Logs (Admin เท่านั้น)
 * ─────────────────────────────────────────────────────────────────────
 * ทำหน้าที่:
 *   1. GET /api/audit — ดึง audit logs ตามเงื่อนไข (paginated)
 *   2. GET /api/audit/actions — ดึง action types ทั้งหมดที่มี (สำหรับ dropdown)
 *
 * ทำไมต้องมี endpoint นี้?
 * — Admin ต้องตรวจสอบได้ว่า "ใครทำอะไร เมื่อไหร่"
 * — เป็นไปตามข้อกำหนด PDPA: organisasi ต้อง account for ทุก data access/change
 * — เดิม audit log ถูกเขียนได้อย่างเดียว ไม่มีทาง read ผ่าน API
 */

import type { Request, Response } from '../types/express.js';
import { getAuditLogs, AuditAction } from '../services/audit.service.js';
import { sendSuccess, sendError } from '../utils/response.js';

/**
 * GET /api/audit
 * ดึง audit logs ตาม query params
 *
 * Query params:
 *   userId     — กรองเฉพาะ user คนนี้
 *   action     — กรองเฉพาะ action นี้ เช่น "CHECK_IN"
 *   targetTable — กรองเฉพาะตารางนี้ เช่น "attendance"
 *   targetId   — กรองเฉพาะ record ID นี้
 *   startDate  — วันเริ่มต้น (ISO string)
 *   endDate    — วันสิ้นสุด (ISO string)
 *   limit      — จำนวนสูงสุด (default: 100)
 *
 * SQL เทียบเท่า:
 * SELECT al.*, u."firstName", u."lastName", u."employeeId"
 * FROM "audit_logs" al
 * LEFT JOIN "users" u ON al."userId" = u."userId"
 * WHERE (conditions)
 * ORDER BY al."createdAt" DESC
 * LIMIT $limit
 */
export const getAuditLogsHandler = async (req: Request, res: Response) => {
  try {
    const { userId, action, targetTable, targetId, startDate, endDate, limit } = req.query;

    const logs = await getAuditLogs({
      userId: userId ? Number(userId) : undefined,
      action: action as string | undefined,
      targetTable: targetTable as string | undefined,
      targetId: targetId ? Number(targetId) : undefined,
      startDate: startDate ? new Date(startDate as string) : undefined,
      endDate: endDate ? new Date(endDate as string) : undefined,
      limit: limit ? Number(limit) : 100,
    });

    sendSuccess(res, logs, 'ดึง audit logs สำเร็จ');
  } catch (error) {
    console.error('Error getting audit logs:', error);
    sendError(res, 'เกิดข้อผิดพลาดในการดึง audit logs', 500);
  }
};

/**
 * GET /api/audit/actions
 * ดึงรายชื่อ action ทั้งหมด — สำหรับ dropdown filter ฝั่ง frontend
 *
 * ทำไมส่ง AuditAction object กลับไปแทน hardcode ฝั่ง frontend?
 * — ถ้าเพิ่ม action ใหม่ใน backend → frontend ได้อัตโนมัติ ไม่ต้องแก้ 2 ที่
 */
export const getAuditActionsHandler = async (_req: Request, res: Response) => {
  try {
    sendSuccess(res, AuditAction, 'ดึงรายชื่อ action สำเร็จ');
  } catch (error) {
    console.error('Error getting audit actions:', error);
    sendError(res, 'เกิดข้อผิดพลาด', 500);
  }
};
