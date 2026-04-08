// ═══════════════════════════════════════════════════════════════
// 📁 auth.routes.ts — Authentication Routes
// ═══════════════════════════════════════════════════════════════
// 🔐 เส้นทาง API สำหรับ Authentication
//
// Routes ในไฟล์นี้:
//   1️⃣ POST /api/auth/login           — เข้าสู่ระบบ (public, มี rate limit)
//   2️⃣ POST /api/auth/refresh         — ขอ accessToken ใหม่ (public)
//   3️⃣ POST /api/auth/logout          — ออกจากระบบ (protected)
//   4️⃣ POST /api/auth/change-password — เปลี่ยนรหัสผ่าน (protected)
//
// Rate Limit สำหรับ Login:
//   - loginRateLimit: จำกัด 5 request ต่อ 60 วินาที ต่อ IP (ป้องกัน brute force)
//   - loginAttemptMiddleware: log ความพยายาม login ที่ผิดพลาด
//
// 📌 Source: index.ts → app.use('/api/auth', authRoutes)
// ═══════════════════════════════════════════════════════════════

import { Router } from 'express';                                           // ← Express Router
import { authController } from '../controllers/auth.controller.js';          // ← Auth Controller
import { authenticate } from '../middleware/auth.middleware.js';              // ← JWT + Session middleware
import { rateLimitMiddleware, loginAttemptMiddleware } from '../middleware/rateLimit.middleware.js';  // ← Rate Limit

const router = Router();  // ← สร้าง router instance

// ── Rate Limit Config ────────────────────────────────────────
const loginRateLimit = rateLimitMiddleware('login', 5, 60);  // ← 5 ครั้ง / 60 วินาที / IP

// ── 1️⃣ 2️⃣ Public Routes (ไม่ต้องมี token) ──────────────────
router.post('/login', loginRateLimit, loginAttemptMiddleware, authController.login);  // ← เข้าสู่ระบบ (มี rate limit + logging)
router.post('/refresh', authController.refresh);                                     // ← ขอ accessToken ใหม่

// ── 3️⃣ 4️⃣ Protected Routes (ต้องมี token) ──────────────────
router.post('/logout', authenticate, authController.logout);                         // ← ออกจากระบบ
router.post('/change-password', authenticate, authController.changePassword);        // ← เปลี่ยนรหัสผ่าน

export default router;  // ← export สำหรับ index.ts
