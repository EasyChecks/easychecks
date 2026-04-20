// requireRole — ใช้ร่วมกับ authenticate เพื่อจำกัดสิทธิ์ตาม role
// แยกจาก authorizeRole ใน auth.middleware เพราะรองรับทั้ง array และ single role
// และส่ง debug info (yourRole, allowedRoles) กลับไปด้วย

import type { Request, Response, NextFunction } from '../types/express.js';
import type { Role } from '@prisma/client';

// รองรับทั้ง requireRole(['ADMIN', 'SUPERADMIN']) และ requireRole('SUPERADMIN')
export function requireRole(allowedRoles: Role[] | Role) {
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
      // ส่ง yourRole + allowedRoles กลับเพื่อให้ frontend แสดง error ได้ชัดเจน
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