// HTTP client สำหรับ auth API — ถูกเรียกจาก AuthContext.tsx
import api from './api';
import { AuthUser, UserRole } from '@/types/auth';

export interface LoginRequest {
  employeeId: string;
  password: string;
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  dashboardMode: 'superadmin' | 'admin' | 'manager' | 'user';
  user: AuthUser;
}

export const authService = {
  // backend ส่ง raw user object → ต้อง map เป็น AuthUser ก่อน return
  async login(credentials: LoginRequest): Promise<LoginResponse> {
    try {
      const response = await api.post<LoginResponse>('/auth/login', {
        employeeId: credentials.employeeId,
        password: credentials.password
      });

      const user = mapBackendUserToAuthUser(response.data.user as unknown as Record<string, unknown>);
      // dashboardMode กำหนด redirect target หลัง login
      user.dashboardMode = response.data.dashboardMode as UserRole;

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

  // เรียกเมื่อ accessToken หมดอายุ → ต่ออายุ session โดยไม่ต้อง login ใหม่
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

  // ล้าง sessionStorage เสมอแม้ API ล้มเหลว (AuthContext.logout() ก็ล้างซ้ำอีกชั้น)
  async logout(): Promise<void> {
    try {
      await api.post('/auth/logout');
    } catch (error) {
      console.error('Logout error:', error);
    } finally {
      sessionStorage.removeItem('token');
      sessionStorage.removeItem('refreshToken');
      sessionStorage.removeItem('authUser');
    }
  },

  async requestPasswordReset(employeeId: string): Promise<void> {
    try {
      await api.post('/auth/request-password-reset', { employeeId });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      const message = err.response?.data?.error || 'ขอรีเซ็ตรหัสผ่านล้มเหลว';
      throw new Error(message);
    }
  },

  async verifyResetToken(token: string): Promise<boolean> {
    try {
      await api.get(`/auth/verify-reset-token/${token}`);
      return true;
    } catch {
      return false;
    }
  },

  async resetPassword(token: string, newPassword: string): Promise<void> {
    try {
      await api.post('/auth/reset-password', { token, newPassword });
    } catch (error: unknown) {
      const err = error as { response?: { data?: { error?: string } } };
      const message = err.response?.data?.error || 'รีเซ็ตรหัสผ่านล้มเหลว';
      throw new Error(message);
    }
  },

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

// แปลง backend user → AuthUser: role uppercase→lowercase, firstName+lastName→name
function mapBackendUserToAuthUser(backendUser: Record<string, unknown>): AuthUser {
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
  const rawGender = backendUser.gender;
  const normalizedGender = typeof rawGender === 'string' && rawGender
    ? rawGender.toUpperCase()
    : undefined;

  return {
    id: String(backendUser.userId ?? ''),
    employeeId: String(backendUser.employeeId ?? ''),
    name: `${backendUser.firstName ?? ''} ${backendUser.lastName ?? ''}`.trim(),
    email: String(backendUser.email ?? ''),
    username: String(backendUser.employeeId ?? ''),
    gender: normalizedGender,
    title: String(backendUser.title ?? ''),
    role: role as AuthUser['role'],
    status: 'active',
    department: String(backendUser.department ?? ''),
    position: String(backendUser.position ?? ''),
    branch: String(backendUser.branch ?? ''),
    provinceCode: String(backendUser.provinceCode ?? ''),
    branchCode: String(backendUser.branchCode ?? ''),
    branchId: backendUser.branchId != null ? Number(backendUser.branchId) : undefined,
    avatar: String(backendUser.avatarUrl ?? ''),
    phone: String(backendUser.phone ?? '')
  };
}
