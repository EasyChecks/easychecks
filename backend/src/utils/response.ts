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

/**
 * 🕐 Convert UTC date to Thailand time (UTC+7)
 */
export function convertToThaiTime(date: Date | string | null | undefined): string | null {
  if (!date) return null;
  
  const utcDate = new Date(date);
  if (isNaN(utcDate.getTime())) return null;

  // Convert to Thailand time (UTC+7)
  return new Date(utcDate.getTime() + 7 * 60 * 60 * 1000).toISOString().replace('Z', '+07:00');
}

/**
 * 🕐 Convert object dates to Thailand time recursively
 */
export function convertDatesToThaiTime(obj: any): any {
  if (obj === null || obj === undefined) return obj;
  
  if (obj instanceof Date) {
    return convertToThaiTime(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => convertDatesToThaiTime(item));
  }
  
  if (typeof obj === 'object') {
    const converted: any = {};
    for (const [key, value] of Object.entries(obj)) {
      // Convert checkIn, checkOut, createdAt, updatedAt, deletedAt เป็น Thailand time
      if (['checkIn', 'checkOut', 'createdAt', 'updatedAt', 'deletedAt', 'customDate'].includes(key)) {
        converted[key] = convertToThaiTime(value as any);
      } else if (typeof value === 'object') {
        converted[key] = convertDatesToThaiTime(value);
      } else {
        converted[key] = value;
      }
    }
    return converted;
  }
  
  return obj;
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
    ...(data !== undefined && { data: convertDatesToThaiTime(data) }),
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