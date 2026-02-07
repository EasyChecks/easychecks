import crypto from 'crypto';

/**
 * 🔑 TOKEN UTILITIES - สำหรับจัดการ Token
 */

// ใช้ Secret key จาก environment
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key-change-this-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '24h'; // 24 ชั่วโมง

/**
 * สร้าง JWT Token (Simple JWT - ไม่ใช้ library)
 * ถ้าต้องการ JWT ที่ standard ให้ใช้ jsonwebtoken library
 */
export function generateToken(payload: {
  userId: number;
  employeeId: string;
  role: string;
  email: string;
}): string {
  // สร้าง Header
  const header = {
    alg: 'HS256',
    typ: 'JWT'
  };

  // สร้าง Payload พร้อม Expiration
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = parseJwtExpiration(JWT_EXPIRES_IN);

  const tokenPayload = {
    ...payload,
    iat: now, // issued at
    exp: now + expiresIn // expiration time
  };

  // Encode
  const encodedHeader = base64url(JSON.stringify(header));
  const encodedPayload = base64url(JSON.stringify(tokenPayload));

  // Sign
  const signature = generateSignature(`${encodedHeader}.${encodedPayload}`, JWT_SECRET);

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

/**
 * ตรวจสอบ JWT Token
 */
export function verifyToken(token: string): any {
  try {
    const parts = token.split('.');

    if (parts.length !== 3) {
      return null;
    }

    const [encodedHeader, encodedPayload, signature] = parts;

    // ตรวจสอบ signature
    const expectedSignature = generateSignature(`${encodedHeader}.${encodedPayload}`, JWT_SECRET);

    if (signature !== expectedSignature) {
      console.warn('⚠️ Invalid token signature');
      return null;
    }

    // Decode payload
    const payload = JSON.parse(base64urlDecode(encodedPayload));

    // ตรวจสอบ expiration
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

/**
 * สร้าง Reset Token (random string)
 * - Token ใช้ได้ 1 ชั่วโมง
 */
export function generateResetToken(): { token: string; expiresAt: Date } {
  const token = crypto.randomBytes(32).toString('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 ชั่วโมง

  return { token, expiresAt };
}

/**
 * Parse JWT expiration format
 * เช่น "24h" -> 86400 seconds
 */
function parseJwtExpiration(expiresIn: string): number {
  const match = expiresIn.match(/(\d+)([smhd])/);

  if (!match) {
    return 86400; // default 1 day
  }

  const [, value, unit] = match;
  const numValue = parseInt(value, 10);

  switch (unit) {
    case 's':
      return numValue;
    case 'm':
      return numValue * 60;
    case 'h':
      return numValue * 3600;
    case 'd':
      return numValue * 86400;
    default:
      return 86400;
  }
}

/**
 * Base64URL Encoding
 */
function base64url(str: string): string {
  return Buffer.from(str)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

/**
 * Base64URL Decoding
 */
function base64urlDecode(str: string): string {
  // เพิ่ม padding
  const padded = str.padEnd(str.length + (4 - (str.length % 4)), '=');
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString();
}

/**
 * Generate Signature (HMAC-SHA256)
 */
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
