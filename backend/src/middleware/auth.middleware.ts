import type { Request, Response, NextFunction } from 'express';
import { authService } from '../services/auth.service.js';

/**
 * 🔐 Authentication Middleware - ตรวจสอบ Session Token
 */

export interface AuthUser {
  userId: number;
  employeeId: string;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
  avatarUrl?: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export async function authenticate(req: Request, res: Response, next: NextFunction) {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        error: 'ต้องระบุ Token ใน Authorization header'
      });
    }

    const token = authHeader.substring(7);

    // ตรวจสอบ token จาก database
    const user = await authService.validateToken(token);
    
    req.user = user as AuthUser;
    next();
  } catch (error: any) {
    res.status(401).json({
      error: error.message || 'Token ไม่ถูกต้อง'
    });
  }
}

export function authorizeRole(...roles: string[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({
        error: 'ไม่มีสิทธิเข้าถึง'
      });
    }
    next();
  };
}

