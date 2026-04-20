import type { Request, Response } from 'express';
import { getAllPolicies, getPolicyByKey } from '../services/policy.service.js';
import { sendSuccess } from '../utils/response.js';
import { asyncHandler } from '../utils/async-handler.js';
import { NotFoundError } from '../utils/custom-errors.js';

/**
 * GET /api/policies — ดึง policy ทั้งหมด
 */
export const getAll = asyncHandler(async (_req: Request, res: Response) => {
  const policies = await getAllPolicies();
  sendSuccess(res, policies, 'ดึงนโยบายสำเร็จ');
});

/**
 * GET /api/policies/:key — ดึง policy ตาม key
 */
export const getByKey = asyncHandler(async (req: Request, res: Response) => {
  const keyParam = req.params.key;
  const key = Array.isArray(keyParam) ? keyParam[0] : keyParam;

  if (!key) {
    throw new NotFoundError('ไม่พบนโยบายที่ระบุ');
  }

  try {
    const policy = await getPolicyByKey(key);
    sendSuccess(res, policy, 'ดึงนโยบายสำเร็จ');
  } catch {
    throw new NotFoundError('ไม่พบนโยบายที่ระบุ');
  }
});
