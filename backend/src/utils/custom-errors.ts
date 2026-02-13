/**
 * Custom Error Classes
 * สำหรับจัดการ Error แบบ Type-safe
 */

export class AppError extends Error {
  statusCode: number;
  isOperational: boolean;

  constructor(message: string, statusCode: number) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

export class BadRequestError extends AppError {
  constructor(message: string = 'คำขอไม่ถูกต้อง') {
    super(message, 400);
  }
}

export class UnauthorizedError extends AppError {
  constructor(message: string = 'ไม่ได้รับอนุญาต') {
    super(message, 401);
  }
}

export class ForbiddenError extends AppError {
  constructor(message: string = 'ไม่มีสิทธิ์เข้าถึง') {
    super(message, 403);
  }
}

export class NotFoundError extends AppError {
  constructor(message: string = 'ไม่พบข้อมูล') {
    super(message, 404);
  }
}

export class ConflictError extends AppError {
  constructor(message: string = 'ข้อมูลซ้ำ') {
    super(message, 409);
  }
}

export class ValidationError extends AppError {
  errors: any[];

  constructor(message: string = 'ข้อมูลไม่ถูกต้อง', errors: any[] = []) {
    super(message, 422);
    this.errors = errors;
  }
}

export class InternalServerError extends AppError {
  constructor(message: string = 'เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์') {
    super(message, 500);
  }
}
