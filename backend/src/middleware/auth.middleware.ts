import type { Request, Response, NextFunction } from '../types/express.js';
import type { Role } from '@prisma/client';
import { authService } from '../services/auth.service.js';

/**
 * 🔐 Authentication Middleware - ตรวจสอบ Session Token
 *
 * วิธีใช้: ใส่ `authenticate` เป็น middleware ก่อน route handler ที่ต้องการ token
 *   router.get('/protected', authenticate, controller.handler);
 *
 * Flow:
 *   1. อ่าน Authorization header → ดึง token จาก "Bearer <token>"
 *   2. ส่ง token ให้ authService.validateToken() ตรวจสอบ JWT + session ใน database
 *   3. ถ้าผ่าน → เก็บข้อมูล user ไว้ใน req.user สำหรับ controller ใช้งานต่อ
 *   4. ถ้าไม่ผ่าน → ตอบ 401 Unauthorized ทันที
 */

export interface AuthUser {
  userId: number;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: Role;
  avatarUrl?: string;
  branchId?: number;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    // ตรวจว่ามี Authorization header และเป็นรูปแบบ "Bearer <token>"
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'ต้องระบุ Token ใน Authorization header'
      });
    }

    const token = authHeader.substring(7); // ตัด "Bearer " ออก (7 ตัวอักษร)

    // ตรวจสอบ token: JWT signature + session ใน database (2 ชั้น)
    const user = await authService.validateToken(token);
    
    // เก็บข้อมูล user ไว้ใน req.user เพื่อให้ controller/service (downstream) ใช้งาน
    req.user = user as AuthUser;
    next();
  } catch (error: any) {
    res.status(401).json({
      error: error.message || 'Token ไม่ถูกต้อง'
    });
  }
}

/**
 * authorizeRole - ตรวจสอบว่า user มี role ที่อนุญาตหรือไม่
 *
 * วิธีใช้: ใส่หลัง authenticate
 *   router.delete('/admin-only', authenticate, authorizeRole('ADMIN', 'SUPERADMIN'), handler);
 *
 * ถ้า role ไม่ตรง → ตอบ 403 Forbidden
 */
export function authorizeRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'ไม่มีสิทธิเข้าถึง'
      });
    }
    next();
  };
}

