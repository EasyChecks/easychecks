// ═══════════════════════════════════════════════════════════════
// 📁 auth.controller.ts — Authentication Controller
// ═══════════════════════════════════════════════════════════════
// 🔐 รับ HTTP Request ที่เกี่ยวกับ Authentication แล้วส่งต่อให้ authService
//
// Functions ในไฟล์นี้:
//   1️⃣ login()          — POST /api/auth/login           (public)
//   2️⃣ logout()         — POST /api/auth/logout          (ต้องมี token)
//   3️⃣ changePassword() — POST /api/auth/change-password (ต้องมี token)
//   4️⃣ refresh()        — POST /api/auth/refresh         (public)
//
// 📌 Source: routes/auth.routes.ts → auth.controller → auth.service
// ═══════════════════════════════════════════════════════════════

import type { Request, Response } from 'express';  // ← Express types
import { authService } from '../services/auth.service.js';  // ← business logic layer

export const authController = {

  // ═══════════════════════════════════════════════════════════════
  // 1️⃣ login() — เข้าสู่ระบบ
  // ═══════════════════════════════════════════════════════════════
  // POST /api/auth/login
  // Body: { employeeId, password }
  // password อาจเป็น: nationalId (default) | รหัสที่เปลี่ยนแล้ว | adminPassword
  // Rate limit: 5 ครั้งต่อ 60 วินาที ต่อ IP (กำหนดใน auth.routes.ts)
  async login(req: Request, res: Response) {
    try {
      const { employeeId, password } = req.body;  // ← ดึงข้อมูลจาก body

      // ✅ STEP 1: Validate required fields
      if (!employeeId || !password) {
        return res.status(400).json({
          error: 'employeeId และ password (nationalId) จำเป็นต้องระบุ'  // ← ข้อความ error ภาษาไทย
        });
      }

      // ✅ STEP 2: ส่งต่อให้ authService.login()
      const result = await authService.login(
        employeeId,               // ← รหัสพนักงาน
        password,                 // ← รหัสผ่าน
        req.ip,                   // ← IP ของ client (เก็บใน session)
        req.get('user-agent')     // ← browser/device info (เก็บใน session)
      );

      return res.json(result);  // ← return { accessToken, refreshToken, user }
    } catch (error: any) {
      console.error('❌ Login error:', error);  // ← log error สำหรับ debug
      return res.status(401).json({
        error: error.message || 'เข้าสู่ระบบล้มเหลว'  // ← 401 Unauthorized
      });
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // 2️⃣ logout() — ออกจากระบบ
  // ═══════════════════════════════════════════════════════════════
  // POST /api/auth/logout
  // Header: Authorization: Bearer <token>
  // ลบ session ออก database → token ใช้ไม่ได้ทันที แม้ JWT ยังไม่หมดอายุ
  async logout(req: Request, res: Response) {
    try {
      const token = req.headers.authorization?.replace('Bearer ', '');  // ← ดึง token จาก header

      // ✅ STEP 1: ตรวจว่ามี token
      if (!token) {
        return res.status(400).json({
          error: 'ต้องระบุ Token'  // ← ไม่มี token ใน header
        });
      }

      // ✅ STEP 2: ส่งต่อให้ authService.logout()
      await authService.logout(token);  // ← ลบ session ออก DB
      res.json({ message: 'Logout สำเร็จ' });  // ← return success
    } catch (error: any) {
      res.status(400).json({
        error: error.message || 'Logout ล้มเหลว'  // ← error response
      });
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // 3️⃣ changePassword() — เปลี่ยนรหัสผ่าน
  // ═══════════════════════════════════════════════════════════════
  // POST /api/auth/change-password
  // Body: { currentPassword, newPassword }
  // - currentPassword: nationalId (ถ้ายังไม่เคยเปลี่ยน) หรือรหัสที่เปลี่ยนไว้แล้ว
  // - newPassword: ต้องมีความยาว ≥ 6 ตัวอักษร
  // หลังเปลี่ยนสำเร็จ → session ทั้งหมดถูกลบ → บังคับ login ใหม่
  async changePassword(req: Request, res: Response) {
    try {
      const { currentPassword, newPassword } = req.body;  // ← ดึงข้อมูลจาก body

      // ✅ STEP 1: Validate required fields
      if (!currentPassword || !newPassword) {
        return res.status(400).json({
          error: 'ต้องระบุ currentPassword และ newPassword'  // ← ข้อมูลไม่ครบ
        });
      }

      // ✅ STEP 2: Validate password length
      if (newPassword.length < 6) {
        return res.status(400).json({
          error: 'รหัสผ่านต้องมีความยาวอย่างน้อย 6 ตัวอักษร'  // ← สั้นเกินไป
        });
      }

      // ✅ STEP 3: ส่งต่อให้ authService.changePassword()
      await authService.changePassword(
        req.user!.userId,    // ← userId จาก auth middleware (JWT payload)
        currentPassword,     // ← รหัสเดิม
        newPassword          // ← รหัสใหม่
      );

      res.json({ message: 'เปลี่ยนรหัสผ่านสำเร็จ' });  // ← return success
    } catch (error: any) {
      res.status(400).json({
        error: error.message || 'เปลี่ยนรหัสผ่านล้มเหลว'  // ← error response
      });
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // 4️⃣ refresh() — ขอ accessToken ใหม่
  // ═══════════════════════════════════════════════════════════════
  // POST /api/auth/refresh
  // Body: { refreshToken }
  // ใช้ refreshToken (อายุ 7 วัน) เพื่อออก accessToken ใหม่ (อายุ 30 นาที)
  // Frontend ควร intercept response 401 แล้ว call endpoint นี้อัตโนมัติ
  async refresh(req: Request, res: Response) {
    try {
      const { refreshToken } = req.body;  // ← ดึง refreshToken จาก body

      // ✅ STEP 1: ตรวจว่ามี refreshToken
      if (!refreshToken) {
        return res.status(400).json({
          error: 'ต้องระบุ refreshToken'  // ← ไม่มี refreshToken
        });
      }

      // ✅ STEP 2: ส่งต่อให้ authService.refreshAccessToken()
      const result = await authService.refreshAccessToken(refreshToken);  // ← get new accessToken
      return res.json(result);  // ← return { accessToken }
    } catch (error: any) {
      console.error('❌ Refresh token error:', error);  // ← log error สำหรับ debug
      return res.status(401).json({
        error: error.message || 'Refresh token ล้มเหลว'  // ← 401 Unauthorized
      });
    }
  }
};

