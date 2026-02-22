'use client';

/**
 * AuthContext.tsx (src/contexts/AuthContext.tsx)
 * ────────────────────────────────────────────────
 * Global state สำหรับ Authentication ของระบบทั้งหมด
 *
 * ทำหน้าที่:
 *  - เก็บ user ที่ login อยู่ (AuthUser | null)
 *  - expose: isAuthenticated, login(), logout(), isLoading, error
 *  - ทุก component ที่ต้องการรู้ว่า "ใครกำลัง login อยู่" ให้ใช้ useAuth()
 *
 * วิธีใช้ในหน้าอื่น:
 *   const { user, isAuthenticated, login, logout } = useAuth();
 */

import React, { createContext, useContext, useState, ReactNode } from 'react';
import { AuthUser, UserRole, LoginCredentials, AuthContextType, MOCK_CREDENTIALS, MOCK_USERS } from '@/types/auth';
import { authService } from '@/services/authService';

// ─── สร้าง Context (ค่าเริ่มต้น undefined เพื่อตรวจว่าถูก wrap ด้วย Provider หรือเปล่า) ───
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  /**
   * user state — เก็บข้อมูลผู้ใช้ที่ login อยู่
   *
   * ใช้ Lazy Initializer (ฟังก์ชันใน useState) เพื่ออ่าน sessionStorage แบบ synchronous
   * ตั้งแต่ render ครั้งแรก → ป้องกัน "blank flash" ของ Protected Route
   * (ถ้าใช้ useEffect จะมี 1 render ที่ user = null ก่อน → ProtectedRoute redirect ผิด)
   */
  const [user, setUser] = useState<AuthUser | null>(() => {
    if (typeof window === 'undefined') return null; // SSR: ไม่มี sessionStorage
    try {
      const stored = sessionStorage.getItem('authUser');
      return stored ? JSON.parse(stored) : null;
    } catch {
      return null; // JSON parse ล้มเหลว → ถือว่ายังไม่ได้ login
    }
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /**
   * login() — รับ credentials แล้วคืน role ของผู้ที่ login สำเร็จ
   *
   * มี 2 เส้นทาง:
   *
   * [1] Mock Login — ตรวจ username/password กับ MOCK_CREDENTIALS ใน types/auth.ts
   *     ใช้สำหรับทดสอบโดยไม่ต้องมี backend จริง (dev only)
   *     accounts: user/user123, admin/admin123, superadmin/superadmin123
   *
   * [2] Real API Login — เรียก authService.login() → POST /api/auth/login
   *     ใช้กับ Supabase account จริง โดยส่ง employeeId เป็น username
   *
   * หลัง login สำเร็จ:
   *  - setUser(userData)               → update global state
   *  - sessionStorage.setItem(authUser) → persist ผ่าน page refresh
   *  - sessionStorage.setItem(token)   → ใช้แนบกับทุก API request (ดู api.ts)
   */
  const login = async (credentials: LoginCredentials): Promise<UserRole> => {
    setIsLoading(true);
    setError(null);

    try {
      let finalRole: UserRole = 'user';

      // ── [1] ตรวจ mock credentials ก่อนเสมอ ──
      const mockCred = Object.values(MOCK_CREDENTIALS).find(
        cred => cred.username === credentials.username && cred.password === credentials.password
      );

      if (mockCred) {
        // Mock login: จำลอง network delay 500ms
        await new Promise(resolve => setTimeout(resolve, 500));

        const userData = MOCK_USERS[mockCred.role];
        if (!userData) throw new Error('ไม่พบข้อมูลผู้ใช้');
        if (userData.status === 'suspended') throw new Error('บัญชีของคุณถูกระงับชั่วคราว');
        if (userData.status === 'leave') throw new Error('บัญชีของคุณอยู่ในสถานะลาออก');

        setUser(userData);
        sessionStorage.setItem('authUser', JSON.stringify(userData));
        // token ปลอม เพื่อให้ api.ts แนบกับ request (backend จะ reject แต่ใช้ทดสอบ UI ได้)
        sessionStorage.setItem('token', `mock-token-${mockCred.role}-${Date.now()}`);
        finalRole = mockCred.role;
      } else {
        // ── [2] Real API: ส่ง employeeId (= username ที่กรอก) ไปยัง backend ──
        const response = await authService.login({
          employeeId: credentials.username,
          password: credentials.password
        });

        const userData = response.user; // authService map backend response → AuthUser แล้ว

        setUser(userData);
        sessionStorage.setItem('authUser', JSON.stringify(userData));
        sessionStorage.setItem('token', response.accessToken);  // JWT จริงจาก backend
        if (response.refreshToken) {
          sessionStorage.setItem('refreshToken', response.refreshToken);
        }
        finalRole = userData.role;
      }

      // บันทึก username ถ้าผู้ใช้ติ๊ก "จดจำฉันไว้"
      if (credentials.rememberMe) {
        sessionStorage.setItem('rememberedUsername', credentials.username);
      } else {
        sessionStorage.removeItem('rememberedUsername');
      }

      return finalRole; // login/page.tsx ใช้ค่านี้ตัดสิน redirect
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ';
      setError(errorMessage);
      throw new Error(errorMessage); // throw ต่อให้ login/page.tsx จับแสดง UI
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * logout() — ล้างข้อมูลทั้งหมดออกจาก state + sessionStorage
   * ทุก component ที่เรียก logout() จะทำให้ isAuthenticated = false ทันที
   * → ProtectedRoute จะ redirect ไป /login โดยอัตโนมัติ
   */
  const logout = () => {
    setUser(null);
    sessionStorage.removeItem('authUser');
    sessionStorage.removeItem('token');
    sessionStorage.removeItem('rememberedUsername');
    setError(null);
  };

  // ค่าที่ expose ออกจาก Context ให้ทุก component ที่เรียก useAuth() ได้ใช้
  const value: AuthContextType = {
    user,
    isAuthenticated: !!user, // true ถ้า user ไม่ใช่ null
    login,
    logout,
    isLoading,
    error
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

/**
 * useAuth() — hook สำหรับอ่านค่าจาก AuthContext
 *
 * ต้องเรียกภายใน component ที่อยู่ใต้ <AuthProvider> เท่านั้น
 * ถ้าเรียกนอก AuthProvider จะ throw error ทันที (ป้องกัน silent bug)
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
