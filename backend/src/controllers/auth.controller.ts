import type { Request, Response } from 'express';
import { authService } from '../services/auth.service.js';

/**
 * 🔐 AUTH CONTROLLER - Database Session
 */

export const authController = {
  /**
   * POST /api/auth/login
   */
  async login(req: Request, res: Response) {
    try {
      const { employeeId, password } = req.body;

      if (!employeeId || !password) {
        return res.status(400).json({
          error: 'employeeId และ password จำเป็นต้องระบุ'
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
   * ใช้ refreshToken เพื่อได้ accessToken ใหม่
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

