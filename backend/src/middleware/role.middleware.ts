// ═══════════════════════════════════════════════════════════════
// 📁 role.middleware.ts — Role Authorization Middleware
// ═══════════════════════════════════════════════════════════════
// 🔐 ตรวจสอบสิทธิ์ตาม Role ของ user
//
// Functions ในไฟล์นี้:
//   1️⃣ requireRole() — ตรวจว่า user มี role ที่อนุญาต
//
// วิธีใช้ (ใส่หลัง authenticate middleware):
//   router.post('/admin-action', authenticate, requireRole(['ADMIN', 'SUPERADMIN']), handler);
//   router.get('/superadmin-only', authenticate, requireRole('SUPERADMIN'), handler);
//
// 📌 Source: routes → authenticate → requireRole → controller
// ═══════════════════════════════════════════════════════════════

import type { Request, Response, NextFunction } from '../types/express.js';  // ← Express types (custom)
import type { Role } from '@prisma/client';                                  // ← Prisma Role enum

// ═══════════════════════════════════════════════════════════════
// 1️⃣ requireRole() — ตรวจสอบ Role ที่อนุญาต
// ═══════════════════════════════════════════════════════════════
// รองรับทั้ง array และ single role:
//   requireRole(['ADMIN', 'SUPERADMIN'])  ← array
//   requireRole('SUPERADMIN')             ← single
export function requireRole(allowedRoles: Role[] | Role) {
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];  // ← รองรับทั้ง array และ single
  
  return (req: Request, res: Response, next: NextFunction): void => {
    const userRole = req.user?.role as Role | undefined;  // ← ดึง role จาก req.user (ผ่าน authenticate)
    
    // ✅ STEP 1: ตรวจว่ามี user (ต้อง authenticate ก่อน)
    if (!userRole) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized'  // ← 401 ไม่มี token / ยังไม่ authenticate
      });
      return;
    }
    
    // ✅ STEP 2: ตรวจว่า role อยู่ใน allowed list
    if (!roles.includes(userRole)) {
      res.status(403).json({
        success: false,
        error: 'Forbidden - ไม่มีสิทธิ์เข้าถึง',  // ← 403 role ไม่ตรง
        yourRole: userRole,        // ← role ปัจจุบันของ user (สำหรับ debug)
        allowedRoles: roles        // ← role ที่อนุญาต (สำหรับ debug)
      });
      return;
    }
    
    next();  // ← ผ่าน → ส่งต่อให้ handler ถัดไป
  };
}