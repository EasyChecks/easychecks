import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { rateLimitMiddleware, loginAttemptMiddleware } from '../middleware/rateLimit.middleware.js';

const router = Router();

// rate limit login เพื่อป้องกัน brute force (5 ครั้ง / 60 วินาที / IP)
const loginRateLimit = rateLimitMiddleware('login', 5, 60);

// public routes — ไม่ต้องมี token
router.post('/login', loginRateLimit, loginAttemptMiddleware, authController.login);
router.post('/refresh', authController.refresh);

// protected routes — ต้อง authenticate ก่อนเพื่อรู้ว่าใครกำลัง logout/เปลี่ยนรหัส
router.post('/logout', authenticate, authController.logout);
router.post('/change-password', authenticate, authController.changePassword);

export default router;
