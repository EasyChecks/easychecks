// ═══════════════════════════════════════════════════════════════
// 📁 auth.middleware.ts — Authentication Middleware
// ═══════════════════════════════════════════════════════════════
// 🔐 ตรวจสอบ Session Token จาก Authorization header
//
// Functions ในไฟล์นี้:
//   1️⃣ authenticate()      — ตรวจ JWT + session → เก็บ user ใน req.user
//   2️⃣ authorizeRole()     — ตรวจ role ที่อนุญาต
//
// Flow:
//   1. อ่าน Authorization header → ดึง token จาก "Bearer <token>"
//   2. ส่ง token ให้ authService.validateToken() ตรวจ JWT + session ใน DB
//   3. ถ้าผ่าน → เก็บข้อมูล user ไว้ใน req.user สำหรับ controller ใช้งานต่อ
//   4. ถ้าไม่ผ่าน → ตอบ 401 Unauthorized ทันที
//
// 📌 Source: routes → authenticate middleware → controller → service
// ═══════════════════════════════════════════════════════════════

import type { Request, Response, NextFunction } from '../types/express.js';  // ← Express types (custom)
import type { Role } from '@prisma/client';                                  // ← Prisma Role enum
import { authService } from '../services/auth.service.js';                   // ← auth business logic

// ── AuthUser Interface ───────────────────────────────────────
// ข้อมูล user ที่จะเก็บใน req.user หลัง authenticate สำเร็จ
export interface AuthUser {
  userId: number;        // ← PK ของ user
  employeeId: string;    // ← รหัสพนักงาน
  firstName: string;     // ← ชื่อ
  lastName: string;      // ← นามสกุล
  email: string;         // ← อีเมล
  role: Role;            // ← role (USER/MANAGER/ADMIN/SUPERADMIN)
  avatarUrl?: string;    // ← avatar URL (optional)
  branchId?: number;     // ← สาขา (optional)
}

// ── ขยาย Express Request ให้รองรับ req.user ─────────────────
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;  // ← เพิ่ม user property ใน Request
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// 1️⃣ authenticate() — ตรวจสอบ JWT Token + Session ใน Database
// ═══════════════════════════════════════════════════════════════
// วิธีใช้: router.get('/protected', authenticate, controller.handler);
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;  // ← ดึง Authorization header

    // ✅ STEP 1: ตรวจว่ามี header และเป็นรูปแบบ "Bearer <token>"
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'ต้องระบุ Token ใน Authorization header'  // ← 401 Unauthorized
      });
    }

    const token = authHeader.substring(7);  // ← ตัด "Bearer " ออก (7 ตัวอักษร)

    // ✅ STEP 2: ตรวจสอบ token (JWT signature + session ใน DB = 2 ชั้น)
    const user = await authService.validateToken(token);  // ← ถ้าไม่ผ่าน จะ throw error
    
    // ✅ STEP 3: เก็บข้อมูล user ใน req.user เพื่อให้ downstream ใช้งาน
    req.user = user as AuthUser;  // ← controller/service จะเข้าถึงได้ผ่าน req.user
    next();  // ← ส่งต่อให้ handler ถัดไป
  } catch (error: any) {
    res.status(401).json({
      error: error.message || 'Token ไม่ถูกต้อง'  // ← 401 Unauthorized
    });
  }
}

// ═══════════════════════════════════════════════════════════════
// 2️⃣ authorizeRole() — ตรวจสอบว่า user มี role ที่อนุญาต
// ═══════════════════════════════════════════════════════════════
// วิธีใช้: router.delete('/admin-only', authenticate, authorizeRole('ADMIN', 'SUPERADMIN'), handler);
// ถ้า role ไม่ตรง → ตอบ 403 Forbidden
export function authorizeRole(...roles: Role[]) {  // ← รับ role ที่อนุญาตเป็น spread args
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {  // ← ตรวจว่า role อยู่ใน allowed list
      return res.status(403).json({
        error: 'ไม่มีสิทธิเข้าถึง'  // ← 403 Forbidden
      });
    }
    next();  // ← ผ่าน → ส่งต่อให้ handler ถัดไป
  };
}

