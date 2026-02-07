'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { AuthUser, LoginCredentials, AuthContextType, MOCK_CREDENTIALS, MOCK_USERS } from '@/types/auth';

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load user from localStorage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('authUser');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (err) {
        console.error('Failed to parse stored user:', err);
        localStorage.removeItem('authUser');
      }
    }
    setIsLoading(false);
  }, []);

  const login = async (credentials: LoginCredentials): Promise<void> => {
    setIsLoading(true);
    setError(null);

    try {
      // Simulate API delay
      await new Promise(resolve => setTimeout(resolve, 500));

      // Check mock credentials
      const mockCred = Object.values(MOCK_CREDENTIALS).find(
        cred => cred.username === credentials.username && cred.password === credentials.password
      );

      if (!mockCred) {
        throw new Error('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง');
      }

      // Get user data
      const userData = MOCK_USERS[mockCred.role];

      if (!userData) {
        throw new Error('ไม่พบข้อมูลผู้ใช้');
      }

      // Check user status
      if (userData.status === 'suspended') {
        throw new Error('บัญชีของคุณถูกระงับชั่วคราว');
      }

      if (userData.status === 'leave') {
        throw new Error('บัญชีของคุณอยู่ในสถานะลาออก');
      }

      // Save to state and localStorage
      setUser(userData);
      localStorage.setItem('authUser', JSON.stringify(userData));

      // Handle remember me
      if (credentials.rememberMe) {
        localStorage.setItem('rememberedUsername', credentials.username);
      } else {
        localStorage.removeItem('rememberedUsername');
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'เกิดข้อผิดพลาดในการเข้าสู่ระบบ';
      setError(errorMessage);
      throw new Error(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const logout = () => {
    setUser(null);
    localStorage.removeItem('authUser');
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

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
