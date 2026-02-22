import bcrypt from 'bcrypt';
import crypto from 'crypto';
import { prisma } from '../lib/prisma.js';
import { createAuditLog, AuditAction } from './audit.service.js';

/**
 * 🧠 AUTH SERVICE - Database Session with Refresh Token
 */

// Token expiration times
const ACCESS_TOKEN_EXPIRY = 15 * 60 * 1000; // 15 minutes
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60 * 1000; // 7 days

export const authService = {
  /**
   * 🔐 LOGIN - สร้าง access + refresh token
   * Username: employeeId, Password: nationalId
   */
  async login(
    employeeId: string,
    password: string, // nationalId
    ipAddress?: string,
    userAgent?: string
  ) {
    try {
      // 1. หา user ด้วย employeeId
      const user = await prisma.user.findUnique({
        where: { employeeId }
      });

      if (!user) {
        throw new Error('ไม่พบพนักงาน (employeeId ไม่ถูกต้อง)');
      }

      // 2. เช็ค password = nationalId
      if (password !== user.nationalId) {
        throw new Error('รหัสผ่าน (nationalId) ไม่ถูกต้อง');
      }

      // 3. สร้าง tokens
      const accessToken = crypto.randomBytes(32).toString('hex');
      const refreshToken = crypto.randomBytes(32).toString('hex');

      // 4. บันทึก session ใน database
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
        user: {
          userId: user.userId,
          employeeId: user.employeeId,
          firstName: user.firstName,
          lastName: user.lastName,
          email: user.email,
          role: user.role,
          avatarUrl: user.avatarUrl
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
   * ✅ VALIDATE ACCESS TOKEN - ตรวจสอบ session ใน database
   */
  async validateToken(token: string) {
    try {
      // 1. หา session จาก database by access token
      const session = await prisma.session.findUnique({
        where: { token },
        include: { user: true }
      });

      if (!session) {
        throw new Error('Token ไม่พบ');
      }

      // 2. เช็ค expiration
      if (new Date() > session.expiresAt) {
        // ลบ session หมดอายุ
        await prisma.session.delete({ where: { id: session.id } });
        throw new Error('Access Token หมดอายุแล้ว');
      }

      // 3. return user data
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
   * 🔄 VALIDATE REFRESH TOKEN - ตรวจสอบ refresh token
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
        await prisma.session.delete({ where: { id: session.id } });
        throw new Error('Refresh Token หมดอายุแล้ว');
      }

      return session;
    } catch (error) {
      throw error;
    }
  },

  /**
   * 🔁 REFRESH ACCESS TOKEN - ออก access token ใหม่จาก refresh token
   */
  async refreshAccessToken(refreshToken: string) {
    try {
      // 1. ตรวจสอบ refresh token
      const session = await this.validateRefreshToken(refreshToken);

      // 2. สร้าง access token ใหม่
      const newAccessToken = crypto.randomBytes(32).toString('hex');

      // 3. อัพเดท database
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
   * 🚪 LOGOUT - ลบ session ออก database
   */
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
      throw new Error('ไม่สามารถ logout ได้');
    }
  },

  /**
   * 🔄 CHANGE PASSWORD - เปลี่ยนรหัสผ่าน
   */
  async changePassword(userId: number, currentPassword: string, newPassword: string) {
    try {
      // 1. หา user
      const user = await prisma.user.findUnique({
        where: { userId }
      });

      if (!user) {
        throw new Error('ไม่พบผู้ใช้');
      }

      // 2. เช็ค password เก่า
      const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isPasswordValid) {
        throw new Error('รหัสผ่านปัจจุบันไม่ถูกต้อง');
      }

      // 3. Hash password ใหม่
      const hashedPassword = await bcrypt.hash(newPassword, 10);

      // 4. อัพเดท password
      await prisma.user.update({
        where: { userId },
        data: { password: hashedPassword }
      });

      // 5. ลบ session เก่าทั้งหมด (บังคับ login ใหม่)
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

