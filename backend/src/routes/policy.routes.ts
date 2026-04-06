import express from 'express';
import { getAll, getByKey } from '../controllers/policy.controller.js';

const router = express.Router();

// ดึง policy ทั้งหมด
router.get('/', getAll);

// ดึง policy ตาม key เช่น /api/policies/privacy
router.get('/:key', getByKey);

export default router;
