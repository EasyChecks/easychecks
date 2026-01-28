import type { Response } from 'express';

/**
 * 📤 Response Utilities - ฟังก์ชันช่วยส่ง Response แบบ standardized
 */

export interface ApiResponse<T = any> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

export function sendSuccess<T>(
  res: Response,
  data?: T,
  message: string = 'Success',
  statusCode: number = 200
): void {
  const response: ApiResponse<T> = {
    success: true,
    message,
    data,
  };
  res.status(statusCode).json(response);
}

export function sendError(
  res: Response,
  error: string = 'An error occurred',
  statusCode: number = 500
): void {
  const response: ApiResponse = {
    success: false,
    error,
  };
  res.status(statusCode).json(response);
}