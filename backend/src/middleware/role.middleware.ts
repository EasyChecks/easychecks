import type { Request, Response, NextFunction } from 'express';
import type { Role } from '@prisma/client';

/**
 * 🔐 Role Middleware - ตรวจสอบสิทธิ์ตาม Role
 * (Placeholder - เพื่อนจะทำ Auth จริงเอง)
 */

export function requireRole(allowedRoles: Role[] | Role) {
  // รองรับทั้ง array และ spread
  const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];
  
  return (req: Request, res: Response, next: NextFunction): void => {
    const userRole = req.user?.role as Role | undefined;
    
    if (!userRole) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized'
      });
      return;
    }
    
    if (!roles.includes(userRole)) {
      res.status(403).json({
        success: false,
        error: 'Forbidden - ไม่มีสิทธิ์เข้าถึง',
        yourRole: userRole,
        allowedRoles: roles
      });
      return;
    }
    
    next();
  };
}