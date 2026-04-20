'use client';

// Global auth state — ทุก component ที่ต้องรู้ว่าใคร login อยู่ ให้ใช้ useAuth()
import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AuthUser, UserRole, LoginCredentials, AuthContextType } from '@/types/auth';
import { authService } from '@/services/authService';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  // เริ่ม null เสมอเพื่อป้องกัน hydration mismatch — restore จาก sessionStorage หลัง mount
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Restore user จาก sessionStorage หลัง mount (client-side only)
  useEffect(() => {
    try {
      const stored = sessionStorage.getItem('authUser');
      if (stored) setUser(JSON.parse(stored));
    } catch {
    } finally {
      setIsLoading(false);
    }
  }, []);

  // login → เรียก authService.login() → เก็บ token + user ใน sessionStorage → return role สำหรับ redirect
  const login = async (credentials: LoginCredentials): Promise<UserRole> => {
    setIsLoading(true);
    setError(null);

    try {
      // Real API: ส่ง employeeId (= username ที่กรอก) ไปยัง backend
      const response = await authService.login({
        employeeId: credentials.username,
        password: credentials.password
      });

      const userData = response.user;

      setUser(userData);
      sessionStorage.setItem('authUser', JSON.stringify(userData));
      sessionStorage.setItem('token', response.accessToken);
      if (response.refreshToken) {
        sessionStorage.setItem('refreshToken', response.refreshToken);
      }

      // บันทึก username ถ้าผู้ใช้ติ๊ก "จดจำฉันไว้"
      if (credentials.rememberMe) {
        localStorage.setItem('rememberedUsername', credentials.username);
      } else {
        localStorage.removeItem('rememberedUsername');
      }

      return response.dashboardMode as UserRole;
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  // logout — ล้าง state + sessionStorage → ProtectedRoute redirect ไป /login
  const logout = () => {
    setUser(null);
    sessionStorage.removeItem('authUser');
    sessionStorage.removeItem('token');
    setError(null);
  };

  const value: AuthContextType = {
    user,
    isAuthenticated: !!user,
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

// ต้องเรียกภายใต้ <AuthProvider> เท่านั้น ไม่งั้น throw
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
