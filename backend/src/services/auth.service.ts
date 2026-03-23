import crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { createAuditLog, AuditAction } from './audit.service.js';

/**
 * 🧠 AUTH SERVICE - จัดการ Authentication ด้วย Database Session + JWT
 *
 * สถาปัตยกรรม:
 * - accessToken  : JWT (HS256) อายุ 30 นาที — ใช้แนบทุก request
 * - refreshToken : random hex อายุ 7 วัน  — ใช้ขอ accessToken ใหม่
 * - session      : บันทึกใน database เพื่อรองรับการ revoke (logout ทันที)
 *
 * ระบบรหัสผ่าน (2 ระดับ):
 * 1. รหัสปกติ  : bcrypt hash ใน password column เสมอ
 *               - ยังไม่เคยเปลี่ยนรหัส → hash ของ nationalId (ตั้งแต่สร้าง account)
 *               - เปลี่ยนรหัสแล้ว    → hash ของรหัสใหม่ (nationalId ใช้ไม่ได้อีก)
 * 2. adminPassword : plain text — สำหรับ Admin/SuperAdmin เข้า Admin Dashboard เท่านั้น
 */

// ─── อายุ Token ───────────────────────────────────────────────
const ACCESS_TOKEN_EXPIRY = 30 * 60 * 1000;         // 30 นาที (ms)
const ACCESS_TOKEN_EXPIRY_SECONDS = 30 * 60;         // 30 นาที (วินาที สำหรับ JWT)
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 วัน (ms)

const JWT_SECRET = process.env.JWT_SECRET ?? 'fallback_dev_secret_change_in_production';

export const authService = {
  /**
   * 🔐 LOGIN - ตรวจสอบ credentials และสร้าง session
   *
   * Logic การตรวจรหัสผ่าน:
   * ┌─────────────────────────────────────────────────────────────────┐
   * │ ① Admin/SuperAdmin + ใส่ adminPassword (plain text ตรงกัน)     │
   * │   → dashboardMode: 'admin' | 'superadmin'                       │
   * │                                                                 │
   * │ ② ทุก role + ใส่รหัสปกติ                                        │
   * │   • password column มีค่า → bcrypt.compare()                   │
   * │   • password column เป็น null → เทียบ nationalId (plain text)  │
   * │     (fallback สำหรับ user เก่าที่ยังไม่ได้รัน migrate script)  │
   * │   → dashboardMode: 'manager' (Manager) | 'user' (อื่นๆ)        │
   * └─────────────────────────────────────────────────────────────────┘
   */
  async login(
    employeeId: string,
    password: string, // nationalId หรือรหัสที่เปลี่ยนแล้ว หรือ adminPassword
    ipAddress?: string,
    userAgent?: string
  ) {
    try {
      // ── ขั้น 1: ค้นหา user จาก employeeId ──────────────────────────
      const user = await prisma.user.findUnique({
        where: { employeeId }
      });

      if (!user) {
        throw new Error('ไม่พบพนักงาน (employeeId ไม่ถูกต้อง)');
      }

      // ── ขั้น 2: ตรวจสอบรหัสผ่านและกำหนด dashboardMode ─────────────
      // Admin/SuperAdmin มี 2 ช่องทาง login:
      //   - adminPassword → เข้า Admin/SuperAdmin Dashboard (จัดการระบบ)
      //   - รหัสปกติ      → เข้า User Dashboard (ดูข้อมูลตัวเอง)
      let dashboardMode: 'superadmin' | 'admin' | 'manager' | 'user';

      const isAdminRole = user.role === 'ADMIN' || user.role === 'SUPERADMIN';
      const hasAdminPassword = isAdminRole && user.adminPassword !== null && user.adminPassword !== undefined;

      if (hasAdminPassword && password === user.adminPassword) {
        // เส้นทาง Admin Dashboard — adminPassword ตรงกัน
        dashboardMode = user.role === 'SUPERADMIN' ? 'superadmin' : 'admin';
      } else {
        // เส้นทาง User Dashboard — ตรวจรหัสปกติ
        let isValid: boolean;
        if (user.password !== null && user.password !== undefined) {
          // bcrypt.compare ทำงานได้ทั้งสองกรณี:
          //   - ยังไม่เคยเปลี่ยนรหัส → hash ของ nationalId อยู่ใน password column
          //   - เปลี่ยนรหัสแล้ว      → hash ของรหัสใหม่อยู่ใน password column
          isValid = await bcrypt.compare(password, user.password);
        } else {
          // fallback สำหรับ user เก่าที่ยังไม่ได้รัน migrate script (ไม่ควรเกิดขึ้นแล้ว)
          isValid = password === user.nationalId;
        }
        if (!isValid) {
          throw new Error('รหัสผ่านไม่ถูกต้อง');
        }
        if (user.role === 'MANAGER') {
          dashboardMode = 'manager';
        } else {
          // USER, และ Admin/SuperAdmin ที่ login ด้วยรหัสปกติ → User Dashboard
          dashboardMode = 'user';
        }
      }

      // ── ขั้น 3: สร้าง JWT accessToken + random refreshToken ────────
      // jti (JWT ID) ใช้สำหรับ revoke token รายตัว ไม่ต้องลบ secret
      const jti = crypto.randomBytes(16).toString('hex');
      const accessToken = jwt.sign(
        {
          sub: String(user.userId),
          employeeId: user.employeeId,
          role: user.role,
          dashboardMode,
          jti
        },
        JWT_SECRET,
        { expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS }
      );
      const refreshToken = crypto.randomBytes(32).toString('hex');

      // ── ขั้น 4: บันทึก session ลง database ─────────────────────────
      // เก็บทั้ง accessToken และ refreshToken เพื่อรองรับ logout และ revoke
      const session = await prisma.session.create({
        data: {
          userId: user.userId,
          token: accessToken,
          expiresAt: new Date(Date.now() + ACCESS_TOKEN_EXPIRY),
          refreshToken,
          refreshTokenExpiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY),
          ipAddress,
          userAgent
        }
      });

      const result = {
        accessToken: session.token,
        refreshToken: session.refreshToken,
        expiresIn: Math.floor(ACCESS_TOKEN_EXPIRY / 1000), // seconds
        dashboardMode, // 'superadmin' | 'admin' | 'manager' | 'user'
        user: {
          userId: user.userId,
          employeeId: user.employeeId,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          avatarUrl: user.avatarUrl,
          branchId: user.branchId ?? undefined
        }
      };

      await createAuditLog({
        userId: user.userId,
        action: AuditAction.LOGIN,
        targetTable: 'users',
        targetId: user.userId,
        ipAddress,
        userAgent,
        newValues: { employeeId: user.employeeId, role: user.role },
      });

      return result;
    } catch (error: any) {
      console.error('❌ Login service error:', error.message);
      throw error;
    }
  },

  /**
   * ✅ VALIDATE ACCESS TOKEN - ตรวจสอบ JWT + session ใน database
   *
   * ทำ 2 ชั้น:
   * 1. ตรวจ JWT signature และ expiration (ด้วย jwt.verify)
   * 2. ตรวจใน database อีกรอบ — เพื่อให้ logout มีผลทันที (revoke)
   *    ถ้า token ถูก delete ออกจาก session table → ใช้ไม่ได้แม้ JWT ยังไม่หมดอายุ
   */
  async validateToken(token: string) {
    try {
      // ขั้น 1: ตรวจ JWT signature และ expiration
      let decoded: jwt.JwtPayload;
      try {
        decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
      } catch (jwtError: any) {
        if (jwtError.name === 'TokenExpiredError') {
          throw new Error('Access Token หมดอายุแล้ว');
        }
        throw new Error('Token ไม่ถูกต้อง');
      }

      // ขั้น 2: ตรวจ session ใน database เพื่อรองรับ revoke (logout)
      const session = await prisma.session.findUnique({
        where: { token },
        include: { user: true }
      });

      if (!session) {
        throw new Error('Token ถูก revoke แล้ว หรือไม่พบ Session');
      }

      // คืนข้อมูล user สำหรับ req.user ใน middleware
      return {
        userId: session.user.userId,
        employeeId: session.user.employeeId,
        firstName: session.user.firstName,
        lastName: session.user.lastName,
        email: session.user.email,
        role: session.user.role,
        avatarUrl: session.user.avatarUrl,
        branchId: session.user.branchId ?? undefined
      };
    } catch (error) {
      throw error;
    }
  },

  /**
   * 🔄 VALIDATE REFRESH TOKEN - ตรวจสอบ refresh token ก่อน issue token ใหม่
   *
   * ตรวจว่า refreshToken มีอยู่จริงใน database และยังไม่หมดอายุ
   * ถ้าหมดอายุ → ลบทิ้งทันที และบังคับ login ใหม่
   */
  async validateRefreshToken(refreshToken: string) {
    try {
      const session = await prisma.session.findUnique({
        where: { refreshToken },
        include: { user: true }
      });

      if (!session) {
        throw new Error('Refresh Token ไม่พบ');
      }

      // เช็ค expiration ของ refresh token
      if (new Date() > session.refreshTokenExpiresAt) {
        // หมดอายุแล้ว → ลบ session ทิ้ง บังคับ login ใหม่
        await prisma.session.delete({ where: { id: session.id } });
        throw new Error('Refresh Token หมดอายุแล้ว');
      }

      return session;
    } catch (error) {
      throw error;
    }
  },

  /**
   * 🔁 REFRESH ACCESS TOKEN - ออก accessToken ใหม่โดยไม่ต้อง login ซ้ำ
   *
   * Flow: refreshToken → ตรวจสอบ → สร้าง accessToken ใหม่ → อัพเดท session
   * ใช้เมื่อ accessToken หมดอายุ (API ตอบ 401) — Frontend ควร intercept อัตโนมัติ
   */
  async refreshAccessToken(refreshToken: string) {
    try {
      // ขั้น 1: ตรวจสอบ refreshToken
      const session = await this.validateRefreshToken(refreshToken);

      // ขั้น 2: สร้าง accessToken ใหม่พร้อม jti ใหม่
      const jti = crypto.randomBytes(16).toString('hex');
      const newAccessToken = jwt.sign(
        {
          sub: String(session.user.userId),
          employeeId: session.user.employeeId,
          role: session.user.role,
          jti
        },
        JWT_SECRET,
        { expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS }
      );

      // ขั้น 3: อัพเดท token เดิมใน session (ไม่สร้าง session ใหม่)
      await prisma.session.update({
        where: { id: session.id },
        data: {
          token: newAccessToken,
          expiresAt: new Date(Date.now() + ACCESS_TOKEN_EXPIRY)
        }
      });

      console.log('✅ Access token refreshed for user:', session.user.userId);

      return {
        accessToken: newAccessToken,
        expiresIn: Math.floor(ACCESS_TOKEN_EXPIRY / 1000),
        user: {
          userId: session.user.userId,
          employeeId: session.user.employeeId,
          firstName: session.user.firstName,
          lastName: session.user.lastName,
          email: session.user.email,
          role: session.user.role
        }
      };
    } catch (error: any) {
      console.error('❌ Refresh token error:', error.message);
      throw error;
    }
  },

  /**
   * 🚪 LOGOUT - ลบ session ออกจาก database ทันที
   *
   * การลบ session ทำให้ token ใช้ไม่ได้ทันที แม้ JWT ยังไม่หมดอายุ
   * (เพราะ validateToken เช็ค database เป็น 2 ชั้นเสมอ)
   */
  async logout(token: string) {
    try {
      const session = await prisma.session.findUnique({
        where: { token },
      });

      if (!session) {
        throw new Error('ไม่สามารถ logout ได้');
      }

      // ลบ session → token ใช้ไม่ได้ทันที
      await prisma.session.delete({
        where: { token }
      });

      await createAuditLog({
        userId: session.userId,
        action: AuditAction.LOGOUT,
        targetTable: 'users',
        targetId: session.userId,
      });

      return { success: true };
    } catch (_error) {
      throw new Error('ไม่สามารถ logout ได้');
    }
  },

  /**
   * 🔄 CHANGE PASSWORD - เปลี่ยนรหัสผ่านปกติ (ไม่ใช่ adminPassword)
   *
   * Logic:
   * 1. ตรวจรหัสปัจจุบัน:
   *    - password column มีค่า → ใช้ bcrypt.compare()
   *    - password column เป็น null → เทียบกับ nationalId (plain text)
   * 2. Hash รหัสใหม่ด้วย bcrypt (salt rounds 10) แล้วบันทึกใน password column
   * 3. ลบ session ทั้งหมด → บังคับ login ใหม่ด้วยรหัสใหม่
   *
   * หมายเหตุ: nationalId ไม่เปลี่ยน — แต่หลังเปลี่ยนรหัสแล้ว password column จะเป็น hash ใหม่
   *           ทำให้ nationalId ใช้ login ไม่ได้อีก (bcrypt จะไม่ match)
   */
  async changePassword(userId: number, currentPassword: string, newPassword: string) {
    try {
      // ขั้น 1: หา user
      const user = await prisma.user.findUnique({
        where: { userId }
      });

      if (!user) {
        throw new Error('ไม่พบผู้ใช้');
      }

      // ขั้น 2: ตรวจรหัสผ่านปัจจุบัน
      // ถ้าเคยเปลี่ยนแล้ว → เช็ค password (bcrypt), ถ้ายังไม่เคย → เช็ค nationalId (plain text)
      let isCurrentValid: boolean;
      if (user.password !== null && user.password !== undefined) {
        isCurrentValid = await bcrypt.compare(currentPassword, user.password);
      } else {
        isCurrentValid = currentPassword === user.nationalId;
      }
      if (!isCurrentValid) {
        throw new Error('รหัสผ่านปัจจุบันไม่ถูกต้อง');
      }

      // ขั้น 3: Hash รหัสใหม่และบันทึกใน password column (nationalId ไม่เปลี่ยน)
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);
      await prisma.user.update({
        where: { userId },
        data: { password: hashedNewPassword }
      });

      // ขั้น 4: ลบ session ทั้งหมดของ user นี้ → บังคับ login ใหม่
      await prisma.session.deleteMany({
        where: { userId }
      });

      await createAuditLog({
        userId,
        action: AuditAction.CHANGE_PASSWORD,
        targetTable: 'users',
        targetId: userId,
      });

      return { success: true };
    } catch (error) {
      throw error;
    }
  }
};

