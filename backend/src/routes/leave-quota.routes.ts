import { Router } from 'express';
import * as leaveQuotaController from '../controllers/leave-quota.controller.js';
import { authorizeRole } from '../middleware/auth.middleware.js';

const router = Router();

// Admin/Superadmin only
router.use(authorizeRole('ADMIN', 'SUPERADMIN'));

/**
 * @route GET /api/leave-quotas/effective
 * @desc  ดึงโควต้าที่มีผลใช้งานตาม scope/target
 */
router.get('/effective', leaveQuotaController.getEffectiveQuota);

/**
 * @route GET /api/leave-quotas/overrides
 * @desc  ดึง override ตาม scope/target
 */
router.get('/overrides', leaveQuotaController.getOverrides);

/**
 * @route GET /api/leave-quotas/overrides/all
 * @desc  ดึง override ทั้งหมดตาม scope
 */
router.get('/overrides/all', leaveQuotaController.getOverridesByScope);

/**
 * @route PUT /api/leave-quotas
 * @desc  บันทึก override
 */
router.put('/', leaveQuotaController.saveOverride);

/**
 * @route DELETE /api/leave-quotas
 * @desc  ลบ override
 */
router.delete('/', leaveQuotaController.removeOverride);

export default router;
