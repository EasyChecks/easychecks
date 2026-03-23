import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { rateLimitMiddleware, loginAttemptMiddleware } from '../middleware/rateLimit.middleware.js';

const router = Router();

/**
 * 🔐 AUTH ROUTES - เส้นทาง API สำหรับ Authentication
 *
 * Public (ไม่ต้องมี token):
 *   POST /api/auth/login    → เข้าสู่ระบบ (มี rate limit)
 *   POST /api/auth/refresh  → ขอ accessToken ใหม่จาก refreshToken
 *
 * Protected (ต้องมี Authorization: Bearer <token>):
 *   POST /api/auth/logout          → ออกจากระบบ ลบ session ทันที
 *   POST /api/auth/change-password → เปลี่ยนรหัสผ่านปกติ (ไม่ใช่ adminPassword)
 *
 * Rate Limit สำหรับ Login:
 *   - loginRateLimit      : จำกัด 5 request ต่อ 60 วินาที ต่อ IP (ป้องกัน brute force)
 *   - loginAttemptMiddleware : log ความพยายาม login ที่ผิดพลาด
 */

// Rate limit: 5 login attempts per 60 seconds per IP
const loginRateLimit = rateLimitMiddleware('login', 5, 60);

// ── Public Routes (ไม่ต้องมี token) ──────────────────────────
router.post('/login', loginRateLimit, loginAttemptMiddleware, authController.login);
router.post('/refresh', authController.refresh);

// ── Protected Routes (ต้องมี token ผ่าน authenticate middleware) ──
router.post('/logout', authenticate, authController.logout);
router.post('/change-password', authenticate, authController.changePassword);

export default router;
