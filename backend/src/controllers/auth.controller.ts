// แยก controller ออกจาก service เพื่อให้ controller รู้แค่ HTTP, service รู้แค่ business logic — test ง่ายกว่า
// validate ที่ controller เพื่อ fail fast ก่อนเข้า service

import type { Request, Response } from 'express';
import { authService } from '../services/auth.service.js';

export const authController = {

  // login — password อาจเป็น nationalId (default) / รหัสที่เปลี่ยนแล้ว / adminPassword
  async login(req: Request, res: Response) {
    try {
      const { employeeId, password } = req.body;

      if (!employeeId || !password) {
        return res.status(400).json({
          error: 'employeeId และ password (nationalId) จำเป็นต้องระบุ'
        });
      }

      // pass IP + user-agent เพื่อเก็บใน session table สำหรับ audit trail
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

  // logout — ลบ session ออก DB ทำให้ token ใช้ไม่ได้ทันที แม้ JWT ยังไม่หมดอายุ
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

  // changePassword — หลังเปลี่ยนสำเร็จ session ทั้งหมดถูกลบ บังคับ login ใหม่ทุก device
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

      // userId จาก auth middleware (JWT payload)
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

  // refresh — ใช้ refreshToken (7 วัน) ออก accessToken ใหม่ (30 นาที)
  // frontend ควร intercept 401 แล้ว call endpoint นี้อัตโนมัติ
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

