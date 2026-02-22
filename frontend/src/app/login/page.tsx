'use client';

/**
 * หน้า Login (src/app/login/page.tsx)
 * ────────────────────────────────────
 * ทำหน้าที่: รับ username + password จากผู้ใช้ ส่งให้ AuthContext.login()
 * แล้ว redirect ไปหน้า dashboard ตาม role ที่ได้กลับมา
 *
 * Flow:
 *   ผู้ใช้กรอกฟอร์ม → handleSubmit → AuthContext.login() → ได้ role → redirect
 */

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

export default function LoginPage() {
  const router = useRouter();
  // ดึงฟังก์ชัน login มาจาก AuthContext (จัดการ authentication ทั้งหมดอยู่ที่นั่น)
  const { login } = useAuth();
  
  // State สำหรับ form fields
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [showPassword, setShowPassword] = useState(false); // toggle ดูรหัสผ่าน
  const [isLoading, setIsLoading] = useState(false);       // แสดง spinner ระหว่าง login
  const [error, setError] = useState('');                  // ข้อความผิดพลาดจาก API

  /**
   * handleSubmit — เรียกเมื่อกดปุ่ม "เข้าสู่ระบบ"
   *
   * 1. ป้องกัน form refresh หน้า (e.preventDefault)
   * 2. เรียก login() ซึ่ง return role กลับมา
   * 3. redirect ไปหน้า dashboard ตาม role
   *    - superadmin → /superadmin/dashboard
   *    - admin      → /admin/dashboard
   *    - manager    → /manager/dashboard
   *    - user       → /user/dashboard
   * 4. ถ้า login ล้มเหลว → แสดง error message ใต้ฟอร์ม
   */
  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // login() คืนค่า role ของผู้ใช้ที่ login สำเร็จ
      const role = await login({ username, password, rememberMe });
      
      // redirect ตาม role
      if (role === 'superadmin') {
        router.push('/superadmin/dashboard');
      } else if (role === 'admin') {
        router.push('/admin/dashboard');
      } else if (role === 'manager') {
        router.push('/manager/dashboard');
      } else {
        router.push('/user/dashboard');
      }
    } catch (err) {
      // แสดง error message ที่ได้จาก AuthContext (เช่น "รหัสผ่านผิด", "บัญชีถูกระงับ")
      setError(err instanceof Error ? err.message : 'เกิดข้อผิดพลาด');
    } finally {
      // ซ่อน spinner ไม่ว่าจะสำเร็จหรือล้มเหลว
      setIsLoading(false);
    }
  };

  return (
    // พื้นหลัง gradient แบบ full-screen
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-slate-50 via-orange-50 to-slate-100 p-4">
      <div className="w-full max-w-md">
        {/* ── ส่วนหัว: โลโก้ + ชื่อแอป ── */}
        <div className="text-center mb-8">
          <div className="w-20 h-20 bg-linear-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-lg">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-10 w-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold text-gray-800 mb-2">EasyCheck</h1>
          <p className="text-gray-600">ระบบบันทึกเวลาเข้า-ออกงาน</p>
        </div>

        {/* ── Card หลัก: ฟอร์ม login ── */}
        <Card className="p-8 shadow-xl border-2 border-gray-200">
          <h2 className="text-2xl font-bold text-gray-800 mb-6 text-center">เข้าสู่ระบบ</h2>

          {/* แสดง error message เมื่อ login ล้มเหลว */}
          {error && (
            <div className="mb-4 p-3 bg-red-50 border-2 border-red-200 rounded-lg">
              <p className="text-sm text-red-700 text-center font-medium">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* ── ช่องกรอก Username ── */}
            <div>
              <label htmlFor="username" className="block text-sm font-semibold text-gray-700 mb-2">
                ชื่อผู้ใช้
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition-all"
                placeholder="กรอกชื่อผู้ใช้"
                required
              />
            </div>

            {/* ── ช่องกรอก Password (มีปุ่ม toggle แสดง/ซ่อน) ── */}
            <div>
              <label htmlFor="password" className="block text-sm font-semibold text-gray-700 mb-2">
                รหัสผ่าน
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-4 py-3 pr-12 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none transition-all"
                  placeholder="กรอกรหัสผ่าน"
                  required
                />
                {/* ปุ่ม toggle ดู/ซ่อนรหัสผ่าน */}
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                >
                  {showPassword ? (
                    // ไอคอน "ตาขีด" = กำลังแสดงรหัส → กดเพื่อซ่อน
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                    </svg>
                  ) : (
                    // ไอคอน "ตา" = กำลังซ่อนรหัส → กดเพื่อแสดง
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* ── Checkbox "จดจำฉันไว้" ── */}
            {/* เมื่อติ๊ก → AuthContext จะบันทึก username ไว้ใน sessionStorage */}
            <div className="flex items-center">
              <input
                id="remember"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 text-orange-500 border-gray-300 rounded focus:ring-orange-500"
              />
              <label htmlFor="remember" className="ml-2 text-sm text-gray-700">
                จดจำฉันไว้
              </label>
            </div>

            {/* ── ปุ่ม Submit ── */}
            {/* disabled ระหว่าง loading เพื่อป้องกัน double submit */}
            <Button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-orange-500 hover:bg-orange-600 text-white font-semibold rounded-lg transition-all shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                // แสดง spinner + ข้อความระหว่างรอ API ตอบกลับ
                <div className="flex items-center justify-center gap-2">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>กำลังเข้าสู่ระบบ...</span>
                </div>
              ) : (
                'เข้าสู่ระบบ'
              )}
            </Button>
          </form>
        </Card>
      </div>
    </div>
  );
}
