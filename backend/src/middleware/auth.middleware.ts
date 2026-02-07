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
    
    // Simplified Auth: Read from headers or use defaults
    const role = (req.headers['x-user-role'] as string) || 'ADMIN';
    const userId = req.headers['x-user-id'] ? parseInt(req.headers['x-user-id'] as string) : 1;
    const employeeId = (req.headers['x-employee-id'] as string) || 'TEST001';
    const branchId = req.headers['x-branch-id'] ? parseInt(req.headers['x-branch-id'] as string) : 1;
    
    // Default test user with values from headers
    req.user = {
      userId,
      employeeId,
      role: role as 'SUPERADMIN' | 'ADMIN' | 'MANAGER' | 'USER',
      email: `user${userId}@example.com`,
      branchId
    };
    
    next();
  } catch (error) {
    res.status(401).json({
      success: false,
      error: 'Invalid token'
    });
  }
}