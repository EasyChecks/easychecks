// ระบบ Auth ใช้ JWT + DB session เพื่อรองรับ revoke ทันที (logout แล้ว token ใช้ไม่ได้เลย)
// รหัสผ่านมี 2 ระดับ: (1) bcrypt hash ปกติ (2) adminPassword plain text สำหรับ Admin Dashboard
// ทำไมไม่ hash adminPassword? → เพราะ Admin Dashboard ต้องการ show password ให้ superadmin เห็นได้

import crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { prisma } from '../lib/prisma.js';
import { createAuditLog, AuditAction } from './audit.service.js';

// token expiry เป็น ms สำหรับ Date / วินาทีสำหรับ jwt.sign
const ACCESS_TOKEN_EXPIRY = 30 * 60 * 1000;
const ACCESS_TOKEN_EXPIRY_SECONDS = 30 * 60;
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60 * 1000;

const JWT_SECRET = process.env.JWT_SECRET ?? 'fallback_dev_secret_change_in_production';

export const authService = {

  // login — ตรวจ credentials + สร้าง session
  // Admin/SuperAdmin มี 2 ช่องทาง: adminPassword → Admin Dashboard / รหัสปกติ → User Dashboard
  // SQL: SELECT * FROM users WHERE employee_id = $1
  //      INSERT INTO sessions (user_id, token, expires_at, refresh_token, ...) VALUES (...)
  async login(
    employeeId: string,
    password: string,
    ipAddress?: string,
    userAgent?: string
  ) {
    try {
      const user = await prisma.user.findUnique({
        where: { employeeId }
      });

      if (!user) {
        throw new Error('ไม่พบพนักงาน (employeeId ไม่ถูกต้อง)');
      }

      // กำหนด dashboardMode ตาม credential ที่ใช้ login
      // adminPassword (plain text) → admin dashboard / รหัสปกติ (bcrypt) → user dashboard
      let dashboardMode: 'superadmin' | 'admin' | 'manager' | 'user';

      const isAdminRole = user.role === 'ADMIN' || user.role === 'SUPERADMIN';
      const hasAdminPassword = isAdminRole && user.adminPassword !== null && user.adminPassword !== undefined;

      if (hasAdminPassword && password === user.adminPassword) {
        dashboardMode = user.role === 'SUPERADMIN' ? 'superadmin' : 'admin';
      } else {
        // ตรวจรหัสปกติ — bcrypt hash หรือ fallback nationalId (user เก่าที่ยังไม่ migrate)
        let isValid: boolean;
        if (user.password !== null && user.password !== undefined) {
          isValid = await bcrypt.compare(password, user.password);
        } else {
          // fallback สำหรับ user เก่าที่ password column ยังเป็น null
          isValid = password === user.nationalId;
        }
        if (!isValid) {
          throw new Error('รหัสผ่านไม่ถูกต้อง');
        }
        if (user.role === 'MANAGER') {
          dashboardMode = 'manager';
        } else {
          dashboardMode = 'user';
        }
      }

      // jti สำหรับ revoke token รายตัว — ไม่ต้องเปลี่ยน secret key ทั้งระบบ
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

      // เก็บ session ใน DB เพื่อรองรับ logout (ลบ session = token ใช้ไม่ได้ทันที)
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

      // ดึง branch name สำหรับ frontend แสดงผล
      let branchName: string | undefined;
      let branchCode: string | undefined;
      if (user.branchId) {
        const branch = await prisma.branch.findUnique({
          where: { branchId: user.branchId },
          select: { name: true, code: true },
        });
        branchName = branch?.name ?? undefined;
        branchCode = branch?.code ?? undefined;
      }

      const result = {
        accessToken: session.token,
        refreshToken: session.refreshToken,
        expiresIn: Math.floor(ACCESS_TOKEN_EXPIRY / 1000),
        dashboardMode,
        user: {
          userId: user.userId,
          employeeId: user.employeeId,
          title: user.title,
          firstName: user.firstName,
          lastName: user.lastName,
          gender: user.gender,
          email: user.email,
          role: user.role,
          avatarUrl: user.avatarUrl,
          branchId: user.branchId ?? undefined,
          department: user.department ?? undefined,
          position: user.position ?? undefined,
          phone: user.phone ?? undefined,
          branch: branchName,
          branchCode,
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

  // validateToken — ตรวจ JWT + session 2 ชั้น
  // ชั้น 1: jwt.verify (signature + expiry) / ชั้น 2: DB session (revoke support)
  // ถ้า session ถูกลบ (logout) → token ใช้ไม่ได้แม้ JWT ยังไม่หมดอายุ
  async validateToken(token: string) {
    try {
      let decoded: jwt.JwtPayload;
      try {
        decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;
      } catch (jwtError: any) {
        if (jwtError.name === 'TokenExpiredError') {
          throw new Error('Access Token หมดอายุแล้ว');
        }
        throw new Error('Token ไม่ถูกต้อง');
      }

      // ตรวจ DB อีกรอบ — ทำให้ logout มีผลทันที
      const session = await prisma.session.findUnique({
        where: { token },
        include: { user: true }
      });

      if (!session) {
        throw new Error('Token ถูก revoke แล้ว หรือไม่พบ Session');
      }

      // ข้อมูลนี้จะถูก set เป็น req.user ใน auth middleware
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

  // validateRefreshToken — ตรวจว่ายังไม่หมดอายุ ถ้าหมดลบทิ้งบังคับ login ใหม่
  async validateRefreshToken(refreshToken: string) {
    try {
      const session = await prisma.session.findUnique({
        where: { refreshToken },
        include: { user: true }
      });

      if (!session) {
        throw new Error('Refresh Token ไม่พบ');
      }

      if (new Date() > session.refreshTokenExpiresAt) {
        // หมดอายุ → ลบ session บังคับ login ใหม่
        await prisma.session.delete({ where: { id: session.id } });
        throw new Error('Refresh Token หมดอายุแล้ว');
      }

      return session;
    } catch (error) {
      throw error;
    }
  },

  // refreshAccessToken — ออก accessToken ใหม่โดยไม่ต้อง login ซ้ำ
  // frontend ควร intercept 401 แล้ว call endpoint นี้อัตโนมัติ
  async refreshAccessToken(refreshToken: string) {
    try {
      const session = await this.validateRefreshToken(refreshToken);

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

      // อัปเดต token เดิมใน session (ไม่สร้างใหม่) เพื่อให้ token เก่าใช้ไม่ได้
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
          title: session.user.title,
          firstName: session.user.firstName,
          lastName: session.user.lastName,
          gender: session.user.gender,
          email: session.user.email,
          role: session.user.role
        }
      };
    } catch (error: any) {
      console.error('❌ Refresh token error:', error.message);
      throw error;
    }
  },

  // logout — ลบ session ออก DB ทำให้ token ใช้ไม่ได้ทันที
  // ทำงานได้เพราะ validateToken() เช็ค DB เสมอ (2 ชั้น)
  async logout(token: string) {
    try {
      const session = await prisma.session.findUnique({
        where: { token },
      });

      if (!session) {
        throw new Error('ไม่สามารถ logout ได้');
      }

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
      // error เดียวกันทุกกรณี — ป้องกัน info leak
      throw new Error('ไม่สามารถ logout ได้');
    }
  },

  // changePassword — เปลี่ยนรหัสปกติ (ไม่ใช่ adminPassword)
  // หลังเปลี่ยน: ลบ session ทั้งหมด → บังคับ login ใหม่ทุก device
  // nationalId ไม่เปลี่ยน แต่ใช้ login ไม่ได้อีกเพราะ bcrypt จะไม่ match กับ hash ใหม่
  async changePassword(
    userId: number,
    currentPassword: string,
    newPassword: string
  ) {
    try {
      const user = await prisma.user.findUnique({
        where: { userId }
      });

      if (!user) {
        throw new Error('ไม่พบผู้ใช้');
      }

      // ตรวจรหัสปัจจุบัน — bcrypt hash หรือ fallback nationalId
      let isCurrentValid: boolean;
      if (user.password !== null && user.password !== undefined) {
        isCurrentValid = await bcrypt.compare(currentPassword, user.password);
      } else {
        isCurrentValid = currentPassword === user.nationalId;
      }
      if (!isCurrentValid) {
        throw new Error('รหัสผ่านปัจจุบันไม่ถูกต้อง');
      }

      const hashedNewPassword = await bcrypt.hash(newPassword, 10);
      await prisma.user.update({
        where: { userId },
        data: { password: hashedNewPassword }
      });

      // ลบ session ทั้งหมด → logout ทุก device ทันที
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

