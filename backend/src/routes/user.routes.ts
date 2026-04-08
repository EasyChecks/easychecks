// ═══════════════════════════════════════════════════════════════
// 📁 user.routes.ts — User Management Routes
// ═══════════════════════════════════════════════════════════════
// 👤 เส้นทาง API สำหรับจัดการผู้ใช้ (CRUD + Bulk Import + Statistics)
//
// Routes ในไฟล์นี้ (ทุก route ต้อง authenticate):
//   1️⃣ GET    /api/users/csv-template — ดาวน์โหลด CSV template
//   2️⃣ GET    /api/users/statistics   — ดึงสถิติพนักงาน (Dashboard)
//   3️⃣ POST   /api/users/bulk         — นำเข้าจาก CSV
//   4️⃣ POST   /api/users              — สร้างพนักงานใหม่
//   5️⃣ GET    /api/users              — ดึงรายชื่อ (paginated + RBAC)
//   6️⃣ GET    /api/users/:id          — ดึงข้อมูลตาม ID
//   7️⃣ GET    /api/users/:id/avatar   — ดึง avatar URL
//   8️⃣ PUT    /api/users/:id          — แก้ไขข้อมูล
//   9️⃣ DELETE /api/users/:id          — ลบ (soft delete)
//
// RBAC Permissions:
// - C (Create): Admin/SuperAdmin only
// - R (Read): User (own) | Admin (own branch) | SuperAdmin (all)
// - U (Update): Admin (own branch) | SuperAdmin (all)
// - D (Delete): Admin (own branch) | SuperAdmin (all)
//
// 📌 Source: index.ts → app.use('/api/users', userRoutes)
// ═══════════════════════════════════════════════════════════════

import { Router } from 'express';                                    // ← Express Router
import * as userController from '../controllers/user.controller.js';  // ← User Controller
import { authenticate } from '../middleware/auth.middleware.js';       // ← JWT + Session middleware

const router = Router();  // ← สร้าง router instance

// ── 🔐 ทุก endpoint ต้องมี token ──────────────────────────────
router.use(authenticate);  // ← apply authenticate middleware ทุก route

// ── 1️⃣ Static routes (ต้องอยู่ก่อน /:id เพื่อไม่ให้ match ผิด) ──
router.get('/csv-template', userController.getCsvTemplate);     // ← GET /api/users/csv-template
router.get('/statistics', userController.getUserStatistics);    // ← GET /api/users/statistics

// ── 3️⃣ Bulk import ────────────────────────────────────────────
router.post('/bulk', userController.bulkCreateUsers);           // ← POST /api/users/bulk

// ── 4️⃣ 5️⃣ CRUD: Create + Read All ────────────────────────────
router.post('/', userController.createUser);                    // ← POST /api/users (สร้างใหม่)
router.get('/', userController.getUsers);                       // ← GET /api/users (ดึงรายชื่อ)

// ── 6️⃣ 7️⃣ 8️⃣ 9️⃣ CRUD: Read/Update/Delete by ID ─────────────
router.get('/:id', userController.getUserById);                 // ← GET /api/users/:id (ดึงตาม ID)
router.get('/:id/avatar', userController.getUserAvatar);        // ← GET /api/users/:id/avatar (ดึง avatar)
router.put('/:id', userController.updateUser);                  // ← PUT /api/users/:id (แก้ไข)
router.delete('/:id', userController.deleteUser);               // ← DELETE /api/users/:id (soft delete)

export default router;  // ← export สำหรับ index.ts
