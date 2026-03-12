import type { Request, Response } from 'express';
import { authService } from '../services/auth.service.js';

/**
 * 🔐 AUTH CONTROLLER - รับ HTTP request และส่งต่อให้ authService
 *
 * Endpoints:
 * - POST /api/auth/login           → เข้าสู่ระบบ (public)
 * - POST /api/auth/logout          → ออกจากระบบ (ต้องมี token)
 * - POST /api/auth/refresh         → ขอ accessToken ใหม่ (public)
 * - POST /api/auth/change-password → เปลี่ยนรหัสผ่าน (ต้องมี token)
 */

export const authController = {
  /**
   * POST /api/auth/login
   *
   * รับ employeeId + password แล้วส่งต่อให้ authService.login()
   * password อาจเป็น: nationalId (default) | รหัสที่เปลี่ยนแล้ว | adminPassword
   *
   * Rate limit: 5 ครั้งต่อ 60 วินาที ต่อ IP (กำหนดใน auth.routes.ts)
   */
  async login(req: Request, res: Response) {
    try {
      const { employeeId, password } = req.body;

      if (!employeeId || !password) {
        return res.status(400).json({
          error: 'employeeId และ password (nationalId) จำเป็นต้องระบุ'
        });
      }

      const result = await authService.login(
        employeeId,
        password,
        req.ip,
        req.get('user-agent')
      );

      return res.json(result);
    } catch (error: any) {
      console.error('❌ Login error:', error);
      return res.status(401).json({
        error: error.message || 'เข้าสู่ระบบล้มเหลว'
      });
    }
  },

  /**
   * POST /api/auth/logout
   *
   * ดึง token จาก Authorization header แล้วลบ session ออก database
   * หลัง logout token ใช้ไม่ได้ทันที แม้ JWT ยังไม่หมดอายุ
   */
  async logout(req: Request, res: Response) {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');
      
      if (!token) {
        return res.status(400).json({
          error: 'ต้องระบุ Token'
        });
      }

      await authService.logout(token);
      res.json({ message: 'Logout สำเร็จ' });
    } catch (error: any) {
      res.status(400).json({
        error: error.message || 'Logout ล้มเหลว'
      });
    }
  },

  /**
   * POST /api/auth/change-password
   * Body: { currentPassword, newPassword }
   *
   * เปลี่ยนรหัสผ่านปกติของตัวเอง (ไม่ใช่ adminPassword)
   * - currentPassword: nationalId (ถ้ายังไม่เคยเปลี่ยน) หรือรหัสที่เปลี่ยนไว้แล้ว
   * - newPassword: ต้องมีความยาว ≥ 6 ตัวอักษร
   * หลังเปลี่ยนสำเร็จ → session ทั้งหมดถูกลบ → บังคับ login ใหม่
   */
  async changePassword(req: Request, res: Response) {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          error: 'ต้องระบุ currentPassword และ newPassword'
        });
      }

      if (newPassword.length < 6) {
        return res.status(400).json({
          error: 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร'
        });
      }

      await authService.changePassword(
        req.user!.userId,
        currentPassword,
        newPassword
      );

      res.json({ message: 'เปลี่ยนรหัสผ่านสำเร็จ' });
    } catch (error: any) {
      res.status(400).json({
        error: error.message || 'เปลี่ยนรหัสผ่านล้มเหลว'
      });
    }
  },

  /**
   * POST /api/auth/refresh
   * Body: { refreshToken }
   *
   * ใช้ refreshToken (อายุ 7 วัน) เพื่อออก accessToken ใหม่ (อายุ 30 นาที)
   * Frontend ควร intercept response 401 แล้ว call endpoint นี้อัตโนมัติ
   */
  async refresh(req: Request, res: Response) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        return res.status(400).json({
          error: 'ต้องระบุ refreshToken'
        });
      }

      const result = await authService.refreshAccessToken(refreshToken);
      return res.json(result);
    } catch (error: any) {
      console.error('❌ Refresh token error:', error);
      return res.status(401).json({
        error: error.message || 'Refresh token ล้มเหลว'
      });
    }
  }
};

