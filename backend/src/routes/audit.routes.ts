/**
 * 📋 Audit Routes — เส้นทาง API สำหรับ Audit Logs
 * ─────────────────────────────────────────────────────────────────────
 * ทุก route ต้องเป็น ADMIN หรือ SUPERADMIN เท่านั้น
 * เพราะ audit log มีข้อมูลอ่อนไหว (ใครทำอะไร เมื่อไหร่)
 *
 * Routes:
 *   GET /api/audit          — ดึง audit logs (paginated + filters)
 *   GET /api/audit/actions  — ดึง action types ทั้งหมด (สำหรับ dropdown)
 */

import { Router } from 'express';
import { requireRole } from '../middleware/role.middleware.js';
import { getAuditLogsHandler, getAuditActionsHandler } from '../controllers/audit.controller.js';

const router = Router();

// ทุก route ต้อง authenticate แล้ว (ผ่าน main router) + เป็น admin
router.use(requireRole(['ADMIN', 'SUPERADMIN']));

// GET /api/audit/actions — ต้องอยู่ก่อน /:id pattern (ถ้ามี)
router.get('/actions', getAuditActionsHandler);

// GET /api/audit — ดึง audit logs ตาม query params
router.get('/', getAuditLogsHandler);

export default router;
