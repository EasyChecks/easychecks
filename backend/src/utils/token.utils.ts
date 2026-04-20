// Legacy token utils — ระบบปัจจุบันใช้ jsonwebtoken library ใน auth.service.ts แทน
// ไฟล์นี้เก็บไว้สำหรับ generateResetToken() และ backward compatibility

import crypto from 'crypto';

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h';

// Simple JWT — ไม่ได้ใช้แล้ว ระบบหลักใช้ jsonwebtoken library
export function generateToken(payload: {
  userId: number;
  employeeId: string;
  role: string;
  email: string;
}): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = parseJwtExpiration(JWT_EXPIRES_IN);

  const tokenPayload = {
    ...payload,
    iat: now,
    exp: now + expiresIn
  };

  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(tokenPayload));
  const signature = generateSignature(`${encodedHeader}.${encodedPayload}`, JWT_SECRET);

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

export function verifyToken(token: string): any {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;

    const [encodedHeader, encodedPayload, signature] = parts;
    const expectedSignature = generateSignature(`${encodedHeader}.${encodedPayload}`, JWT_SECRET);

    if (signature !== expectedSignature) {
      console.warn('⚠️ Invalid token signature');
      return null;
    }

    const payload = JSON.parse(base64urlDecode(encodedPayload));
    const now = Math.floor(Date.now() / 1000);
    if (payload.exp && payload.exp < now) {
      console.warn('⚠️ Token expired');
      return null;
    }

    return payload;
  } catch (error) {
    console.error('❌ Token verification failed:', error);
    return null;
  }
}

// สร้าง random reset token (อายุ 1 ชั่วโมง)
export function generateResetToken(): { token: string; expiresAt: Date } {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000);
  return { token, expiresAt };
}

function parseJwtExpiration(expiresIn: string): number {
  const match = expiresIn.match(/(\d+)([smhd])/);
  if (!match) return 86400;

  const [, value, unit] = match;
  const numValue = parseInt(value, 10);

  switch (unit) {
    case 's': return numValue;
    case 'm': return numValue * 60;
    case 'h': return numValue * 3600;
    case 'd': return numValue * 86400;
    default: return 86400;
  }
}

function base64url(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function base64urlDecode(str: string): string {
  const padded = str.padEnd(str.length + (4 - (str.length % 4)), '=');
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
}

function generateSignature(message: string, secret: string): string {
  const crypto = require('crypto');
  return crypto
    .createHmac('sha256', secret)
    .update(message)
    .digest()
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}
