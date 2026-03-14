import type { Response } from 'express';
import { toThaiIso } from './timezone.js';

/**
 * 📤 Response Utilities - ฟังก์ชันช่วยส่ง Response แบบ standardized
 */

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  data?: T;
  error?: string;
}

/**
 * 🕐 Convert UTC date to Thailand time (UTC+7)
 */
export function convertToThaiTime(date: Date | string | null | undefined): string | null {
  return toThaiIso(date);
}

/**
 * 🕐 Convert object dates to Thailand time recursively
 */
export function convertDatesToThaiTime(obj: unknown): unknown {
  if (obj === null || obj === undefined) return obj;
  
  if (obj instanceof Date) {
    return convertToThaiTime(obj);
  }
  
  if (Array.isArray(obj)) {
    return obj.map(item => convertDatesToThaiTime(item));
  }
  
  if (typeof obj === 'object') {
    const converted: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(obj)) {
      // Convert common date/time keys to Thailand time
      if (
        [
          'checkIn',
          'checkOut',
          'createdAt',
          'updatedAt',
          'deletedAt',
          'customDate',
          'timestamp',
          'startDateTime',
          'endDateTime',
          'approvedAt',
          'expiresAt',
          'refreshTokenExpiresAt',
          'sentAt',
          'checkInTime',
          'checkOutTime',
        ].includes(key)
      ) {
        converted[key] = convertToThaiTime(value as Date | string | null | undefined);
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
  const convertedData = data === undefined ? undefined : (convertDatesToThaiTime(data) as T);

  const response: ApiResponse<T> = {
    success: true,
    message,
    ...(convertedData !== undefined && { data: convertedData }),
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