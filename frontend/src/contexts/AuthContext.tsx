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

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AuthUser, UserRole, LoginCredentials, AuthContextType } from '@/types/auth';
import { authService } from '@/services/authService';

// ─── สร้าง Context (ค่าเริ่มต้น undefined เพื่อตรวจว่าถูก wrap ด้วย Provider หรือเปล่า) ───
const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  /**
   * user state — เก็บข้อมูลผู้ใช้ที่ login อยู่
   *
   * เริ่มต้นที่ null เสมอ (ทั้ง server และ client) เพื่อป้องกัน hydration mismatch
   * หลัง mount จะ restore จาก sessionStorage ผ่าน useEffect ด้านล่าง
   */
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true); // true จนกว่าจะ restore sessionStorage แล้ว
  const [error, setError] = useState<string | null>(null);

  // Restore user จาก sessionStorage หลัง mount (client-side only)
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('authUser');
      if (stored) {
        setUser(JSON.parse(stored));
      }
    } catch {
      // JSON parse ล้มเหลว → ถือว่ายังไม่ได้ login
    } finally {
      setIsLoading(false);
    }
  }, []);

  /**
   * login() — รับ credentials แล้วคืน role ของผู้ที่ login สำเร็จ
   *
   * Real API Login — เรียก authService.login() → POST /api/auth/login
   * ใช้กับ Supabase account จริง โดยส่ง employeeId เป็น username
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
      // Real API: ส่ง employeeId (= username ที่กรอก) ไปยัง backend
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

      // บันทึก username ถ้าผู้ใช้ติ๊ก "จดจำฉันไว้"
      if (credentials.rememberMe) {
        localStorage.setItem('rememberedUsername', credentials.username);
      } else {
        localStorage.removeItem('rememberedUsername');
      }

      return response.dashboardMode as UserRole; // dashboardMode บอก redirect target ที่ถูกต้อง
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
