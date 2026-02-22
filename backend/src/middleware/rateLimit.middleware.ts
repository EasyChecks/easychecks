import type { Request, Response, NextFunction } from '../types/express.js';

/**
 * 🛡️ RATE LIMIT MIDDLEWARE - ป้องกันการเจาะรหัส Brute Force Attack
 * เช่น การพยายาม login บ่อยๆ ในเวลาสั้นๆ
 */

// Store ข้อมูล attempts ใน memory (ในการใช้จริงควรใช้ Redis)
const attemptStore = new Map<string, { count: number; resetTime: number }>();

/**
 * Rate Limit Middleware
 * @param action - ชนิดของ action (login, reset, etc.)
 * @param maxAttempts - จำนวน attempts ที่อนุญาต
 * @param windowMs - ช่วงเวลา (seconds)
 */
export function rateLimitMiddleware(action: string, maxAttempts: number, windowMs: number) {
  return (req: Request, res: Response, next: NextFunction): void => {
    // ใช้ IP address เป็น identifier
    const identifier = `${action}:${req.ip || 'unknown'}`;
    const now = Date.now();

    // ดึงข้อมูล attempts เก่า
    const attemptData = attemptStore.get(identifier);

    if (attemptData && attemptData.resetTime > now) {
      // ยังอยู่ใน window
      attemptData.count++;

      if (attemptData.count > maxAttempts) {
        console.warn(`⚠️ Rate limit exceeded for ${identifier}`);
        res.status(429).json({
          success: false,
          error: `เกินจำนวนครั้งที่อนุญาต กรุณารอ ${Math.ceil((attemptData.resetTime - now) / 1000)} วินาที`,
          retryAfter: Math.ceil((attemptData.resetTime - now) / 1000)
        });
        return;
      }
    } else {
      // สร้าง window ใหม่
      attemptStore.set(identifier, {
        count: 1,
        resetTime: now + windowMs * 1000
      });
    }

    next();
  };
}

/**
 * Advanced Rate Limit - ตรวจสอบ Pattern การล็อกอิน
 * ตัวอย่าง: ถ้า fail 3 ครั้ง ต้องรอ
 */
export function loginAttemptMiddleware(req: Request, res: Response, next: NextFunction): void {
  const { employeeId } = req.body;

  if (!employeeId) {
    next();
    return;
  }

  const key = `login_attempts:${employeeId}`;
  const attemptData = attemptStore.get(key);
  const now = Date.now();

  if (attemptData) {
    if (attemptData.resetTime > now) {
      // ยังอยู่ใน lockout period
      if (attemptData.count >= 3) {
        console.warn(`🔒 Login locked for ${employeeId}`);
        res.status(429).json({
          success: false,
          error: 'บัญชีถูกล็อค เนื่องจากพยายาม login ล้มเหลวหลายครั้ง',
          retryAfter: Math.ceil((attemptData.resetTime - now) / 1000)
        });
        return;
      }
    } else {
      // Reset count
      attemptStore.delete(key);
    }
  }

  next();
}

/**
 * Record failed login attempt
 */
export function recordLoginAttempt(employeeId: string, success: boolean = false): void {
  if (success) {
    // Clear attempts on successful login
    const key = `login_attempts:${employeeId}`;
    attemptStore.delete(key);
    return;
  }

  // Record failed attempt
  const key = `login_attempts:${employeeId}`;
  const attemptData = attemptStore.get(key);
  const now = Date.now();
  const lockoutDuration = 15 * 60; // 15 minutes

  if (attemptData && attemptData.resetTime > now) {
    attemptData.count++;
  } else {
    attemptStore.set(key, {
      count: 1,
      resetTime: now + lockoutDuration * 1000
    });
  }
}

/**
 * CAPTCHA Middleware (for extra protection)
 * ถ้า login fail 2 ครั้ง ต้องใส่ CAPTCHA
 */
export function captchaRequiredMiddleware(req: Request, res: Response, next: NextFunction): void {
  const { employeeId } = req.body;

  if (!employeeId) {
    next();
    return;
  }

  const key = `login_attempts:${employeeId}`;
  const attemptData = attemptStore.get(key);
  const now = Date.now();

  if (attemptData && attemptData.resetTime > now && attemptData.count >= 2) {
    // ต้องใส่ CAPTCHA
    res.status(400).json({
      success: false,
      error: 'กรุณาใส่ CAPTCHA เพื่อดำเนินการต่อ',
      requiresCaptcha: true
    });
    return;
  }

  next();
}

/**
 * IP Whitelist/Blacklist
 */
const blacklistedIPs = new Set<string>();
const whitelistedIPs = new Set<string>();

export function ipFilterMiddleware(req: Request, res: Response, next: NextFunction): void {
  const ip = req.ip || 'unknown';

  if (blacklistedIPs.has(ip)) {
    console.warn(`🚫 Blocked IP: ${ip}`);
    res.status(403).json({
      success: false,
      error: 'IP นี้ถูกบล็อก'
    });
    return;
  }

  if (whitelistedIPs.size > 0 && !whitelistedIPs.has(ip)) {
    console.warn(`🚫 Non-whitelisted IP: ${ip}`);
    res.status(403).json({
      success: false,
      error: 'IP นี้ไม่มีสิทธิ์'
    });
    return;
  }

  next();
}

/**
 * Block IP
 */
export function blockIP(ip: string): void {
  blacklistedIPs.add(ip);
}

/**
 * Unblock IP
 */
export function unblockIP(ip: string): void {
  blacklistedIPs.delete(ip);
}

/**
 * Add Whitelist IP
 */
export function whitelistIP(ip: string): void {
  whitelistedIPs.add(ip);
}

/**
 * Remove Whitelist IP
 */
export function removeWhitelistIP(ip: string): void {
  whitelistedIPs.delete(ip);
}

/**
 * Cleanup old attempts (run periodically)
 */
export function cleanupAttempts(): void {
  const now = Date.now();
  for (const [key, data] of attemptStore.entries()) {
    if (data.resetTime < now) {
      attemptStore.delete(key);
    }
  }
}

// Run cleanup every 10 minutes
setInterval(cleanupAttempts, 10 * 60 * 1000);
