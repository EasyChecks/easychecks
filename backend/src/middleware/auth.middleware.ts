import type { Request, Response, NextFunction } from 'express';

/**
 * 🔐 Authentication Middleware - ตรวจสอบ JWT Token
 * (Placeholder สำหรับการทำ JWT authentication จริง)
 */

export interface AuthUser {
  userId: number;
  employeeId: string;
  role: 'SUPERADMIN' | 'ADMIN' | 'MANAGER' | 'USER';
  email: string;
}

// Extend Express Request type
declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

export function authenticate(req: Request, res: Response, next: NextFunction): void {
  try {
    // TODO: ถอดรหัส JWT token จาก Authorization header
    // const token = req.headers.authorization?.replace('Bearer ', '');
    // const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    // Placeholder: ใช้ข้อมูลจาก header ชั่วคราว
    const userId = req.headers['x-user-id'];
    const employeeId = req.headers['x-employee-id'];
    const role = req.headers['x-role'] as any;
    
    if (!userId || !employeeId || !role) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized - กรุณา login ก่อน'
      });
      return;
    }
    
    req.user = {
      userId: parseInt(userId as string),
      employeeId: employeeId as string,
      role,
      email: ''
    };
    
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Invalid token'
    });
  }
}