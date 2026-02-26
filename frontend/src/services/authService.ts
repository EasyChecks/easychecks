/**
 * authService.ts (src/services/authService.ts)
 * ──────────────────────────────────────────────
 * HTTP client สำหรับ Authentication API
 *
 * ทำหน้าที่: ส่ง request ไปยัง backend /api/auth/*
 * ถูกเรียกใช้โดย: AuthContext.tsx (ใน login flow เส้นทาง Real API)
 *
 * API Endpoints ที่รองรับ:
 *  POST /auth/login               → login ได้ token + user
 *  POST /auth/refresh             → ขอ access token ใหม่ด้วย refresh token
 *  POST /auth/logout              → แจ้ง backend ว่า logout แล้ว
 *  POST /auth/request-password-reset → ขอ reset password
 *  GET  /auth/verify-reset-token/:token → ตรวจ token reset ว่ายังใช้ได้ไหม
 *  POST /auth/reset-password      → reset password จริง
 *  POST /auth/change-password     → เปลี่ยน password สำหรับผู้ที่ login อยู่
 */

import api from './api';
import { AuthUser } from '@/types/auth';

// ── Types สำหรับ request / response ──
export interface LoginRequest {
  employeeId: string; // username ที่ผู้ใช้กรอก ส่งไปเป็น employeeId
  password: string;
}

export interface LoginResponse {
  accessToken: string;  // JWT สำหรับแนบกับ API request ถัดไปทั้งหมด
  refreshToken: string; // ใช้ขอ accessToken ใหม่เมื่อหมดอายุ
  expiresIn: number;    // อายุของ accessToken (วินาที)
  user: AuthUser;       // ข้อมูล user ที่ map มาจาก backend แล้ว
}

export const authService = {
  /**
   * login() — ส่ง employeeId + password ไป POST /auth/login
   *
   * backend ตอบกลับด้วย: { accessToken, refreshToken, user: {...} }
   * แต่ข้อมูล user จาก backend มีโครงสร้างต่างกับ AuthUser (frontend)
   * → mapBackendUserToAuthUser() แปลงก่อนส่งกลับ
   */
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    try {
      const response = await api.post<LoginResponse>('api/auth/login', {
        employeeId: credentials.employeeId,
        password: credentials.password
      });

      // แปลง backend user → AuthUser format ที่ frontend ใช้
      // cast เป็น unknown ก่อน เพราะ backend ส่งมาเป็น raw object ไม่ใช่ AuthUser จริงๆ
      const user = mapBackendUserToAuthUser(response.data.user as unknown as Record<string, unknown>);

      return {
        ...response.data,
        user
      };
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      const message = err.response?.data?.error || 'เข้าสู่ระบบล้มเหลว';
      throw new Error(message);
    }
  },

  /**
   * refreshToken() — ขอ accessToken ใหม่โดยใช้ refreshToken เดิม
   * เรียกเมื่อ accessToken หมดอายุ (HTTP 401) เพื่อให้ผู้ใช้ไม่ต้อง login ซ้ำ
   */
  async refreshToken(refreshToken: string): Promise<string> {
    try {
      const response = await api.post<{ accessToken: string; expiresIn: number }>(
        '/auth/refresh',
        { refreshToken }
      );
      return response.data.accessToken;
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      const message = err.response?.data?.error || 'Refresh token failed';
      throw new Error(message);
    }
  },

  /**
   * logout() — แจ้ง backend ว่า logout แล้ว (invalidate token ฝั่ง server)
   * ล้าง sessionStorage ไม่ว่า API จะสำเร็จหรือไม่
   * (การล้าง sessionStorage ซ้ำก็ทำใน AuthContext.logout() ด้วย เพื่อความแน่ใจ)
   */
  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      // ล้างเสมอแม้ API ล้มเหลว
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('refreshToken');
      sessionStorage.removeItem('authUser');
    }
  },

  /** ขอ reset password → backend ส่ง link ไปทาง email ของ employeeId นั้น */
  async requestPasswordReset(employeeId: string): Promise<void> {
    try {
      await api.post('/auth/request-password-reset', { employeeId });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      const message = err.response?.data?.error || 'ขอรีเซ็ตรหัสผ่านล้มเหลว';
      throw new Error(message);
    }
  },

  /** ตรวจสอบว่า reset token ยังใช้ได้อยู่ไหม (ก่อนแสดงหน้ากรอก password ใหม่) */
  async verifyResetToken(token: string): Promise<boolean> {
    try {
      await api.get(`/auth/verify-reset-token/${token}`);
      return true;
    } catch {
      return false;
    }
  },

  /** ยืนยัน reset password ด้วย token ที่ได้จาก email */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    try {
      await api.post('/auth/reset-password', { token, newPassword });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      const message = err.response?.data?.error || 'รีเซ็ตรหัสผ่านล้มเหลว';
      throw new Error(message);
    }
  },

  /** เปลี่ยน password เอง (ต้อง login อยู่) */
  async changePassword(currentPassword: string, newPassword: string): Promise<void> {
    try {
      await api.post('/auth/change-password', { currentPassword, newPassword });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      const message = err.response?.data?.error || 'เปลี่ยนรหัสผ่านล้มเหลว';
      throw new Error(message);
    }
  }
};

/**
 * mapBackendUserToAuthUser()
 * ─────────────────────────
 * แปลง object ที่ได้จาก backend → AuthUser ที่ frontend ใช้
 *
 * Backend ส่งมา:  { userId, employeeId, firstName, lastName, email, role, avatarUrl, ... }
 * Frontend ต้องการ: { id, employeeId, name, email, username, role (lowercase), status, ... }
 *
 * จุดสำคัญ:
 *  - role: backend ใช้ uppercase (USER/ADMIN/SUPERADMIN) → map เป็น lowercase
 *  - name: ต่อ firstName + lastName เป็น string เดียว
 *  - id:   แปลง userId (number) เป็น string
 *  - username: ใช้ employeeId แทน (ไม่มี field username แยกใน backend)
 */
function mapBackendUserToAuthUser(backendUser: Record<string, unknown>): AuthUser {
  // ตาราง map role: รองรับทั้ง uppercase (จาก backend) และ lowercase (fallback)
  const roleMap: Record<string, string> = {
    'USER': 'user',
    'MANAGER': 'manager',
    'ADMIN': 'admin',
    'SUPERADMIN': 'superadmin',
    'user': 'user',
    'manager': 'manager',
    'admin': 'admin',
    'superadmin': 'superadmin'
  };

  const role = roleMap[backendUser.role as string] || 'user';

  return {
    id: String(backendUser.userId ?? ''),
    employeeId: String(backendUser.employeeId ?? ''),
    name: `${backendUser.firstName ?? ''} ${backendUser.lastName ?? ''}`.trim(),
    email: String(backendUser.email ?? ''),
    username: String(backendUser.employeeId ?? ''),
    role: role as AuthUser['role'],
    status: 'active',
    department: String(backendUser.department ?? ''),
    position: String(backendUser.position ?? ''),
    branch: String(backendUser.branch ?? ''),
    provinceCode: String(backendUser.provinceCode ?? ''),
    branchCode: String(backendUser.branchCode ?? ''),
    avatar: String(backendUser.avatarUrl ?? ''),
    phone: String(backendUser.phone ?? '')
  };
}
