import type { Request, Response, NextFunction } from 'express';
import type { Role } from '@prisma/client';

/**
 * 🔐 Role Middleware - ตรวจสอบสิทธิ์ตาม Role
 * (Placeholder - เพื่อนจะทำ Auth จริงเอง)
 */

export function requireRole(...allowedRoles: Role[]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const userRole = req.user?.role;
    
    if (!userRole) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
      return;
    }
    
    if (!allowedRoles.includes(userRole)) {
      res.status(403).json({
        success: false,
        error: 'Forbidden - ไม่มีสิทธิ์เข้าถึง'
      });
      return;
    }
    
    next();
  };
}