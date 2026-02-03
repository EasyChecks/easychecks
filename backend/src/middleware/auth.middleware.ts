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
  branchId?: number;
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
    
    // Placeholder: ใช้ข้อมูลจาก header ชั่วคราว (Mock Auth)
    let userId = req.headers['x-user-id'];
    let employeeId = req.headers['x-employee-id'];
    let role = req.headers['x-user-role'] as any;
    let branchId = req.headers['x-branch-id'];
    
    // Default test user (if headers not provided)
    if (!userId || !employeeId || !role) {
      userId = userId || '1';
      employeeId = employeeId || 'TEST001';
      role = role || 'ADMIN';
      branchId = branchId || '1';
      
      console.log('⚠️ Using default test user (no auth headers provided)');
    }
    
    req.user = {
      userId: parseInt(userId as string),
      employeeId: employeeId as string,
      role,
      email: 'test@example.com',
      branchId: branchId ? parseInt(branchId as string) : undefined
    };
    
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Invalid token'
    });
  }
}