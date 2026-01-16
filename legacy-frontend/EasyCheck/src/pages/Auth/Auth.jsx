import React, { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../contexts/useAuth'
import PuffLoader from '../../components/common/PuffLoader'
import { getUserForAuth, mockLoginAPI, getFallbackAdminAccount, usersData as initialUsersData } from '../../data/usersData'


function Auth() {
  const [searchParams] = useSearchParams()
  const [showPwd, setShowPwd] = useState(false)
  const [showReset, setShowReset] = useState(false)
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [rememberMe, setRememberMe] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // 🔄 สถานะสำหรับฟอร์ม Reset Password (Modal ภายในหน้าเดียวกัน)
  const [Username, setUsernameReset] = useState('')
  const [Password, setPasswordReset] = useState('')
  const [NewPassword, setNewPassword] = useState('')
/**
 * Handles Escape key press event. If the showReset state is true, sets
 * showReset state to false.
 * @param {KeyboardEvent} e - the key event
 */
  const [showPassword, setShowPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [resetError, setResetError] = useState('')
  const [resetSuccess, setResetSuccess] = useState('')

  const { login, getDashboardPath } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    const savedUsername = localStorage.getItem('rememberedUsername')
    const savedPassword = localStorage.getItem('rememberedPassword')
    const savedRememberMe = localStorage.getItem('rememberMe') === 'true'
    
    if (savedRememberMe && savedUsername && savedPassword) {
      setUsername(savedUsername)
      setPassword(savedPassword)
      setRememberMe(true)
    }
  }, [])

  // 🔍 ตรวจสอบว่ามาจากหน้า Settings พร้อม mode=reset หรือไม่
  useEffect(() => {
    if (searchParams.get('mode') === 'reset') {
      setShowReset(true)
    }
  }, [searchParams])

  useEffect(() => {
    function onKey(e) {
      if (e.key === 'Enter') {
        if (showReset) {
          handleResetConfirm()
        } else {
          handleLogin(e)
        }
      }
      if (e.key === 'Escape' && showReset) {
        setShowReset(false)
        setResetError('')
        setResetSuccess('')
        // ตรวจสอบว่ามาจากหน้า Settings หรือไม่
        if (searchParams.get('mode') === 'reset') {
          navigate(-1) // กลับไปหน้าก่อนหน้า (Settings)
        } else {
          navigate('/auth', { replace: true }) // กลับไปหน้า Login
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showReset, Username, Password, NewPassword, username, password])

  const handleLogin = async (e) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const response = await mockLoginAPI(username, password)

      if (response.success) {
        // ตรวจสอบสถานะผู้ใช้ - ห้าม login ถ้าเป็น leave หรือ suspended
        const userStatus = response.user.status?.toLowerCase()
        
        if (userStatus === 'leave' || userStatus === 'suspended') {
          setError(
            userStatus === 'leave' 
              ? 'ไม่สามารถเข้าสู่ระบบได้ เนื่องจากบัญชีของคุณอยู่ในสถานะลาออก (Leave)'
              : 'ไม่สามารถเข้าสู่ระบบได้ เนื่องจากบัญชีของคุณถูกระงับชั่วคราว (Suspended)'
          )
          setLoading(false)
          return
        }
        
        // 🔍 Debug: ตรวจสอบ role ก่อน login
        console.log('Login Success:', {
          username,
          name: response.user.name,
          role: response.user.role,
          status: response.user.status,
          isAdminAccount: response.user.isAdminAccount
        });
        
        if (rememberMe) {
          localStorage.setItem('rememberedUsername', username)
          localStorage.setItem('rememberedPassword', password)
          localStorage.setItem('rememberMe', 'true')
        } else {
          localStorage.removeItem('rememberedUsername')
          localStorage.removeItem('rememberedPassword')
          localStorage.removeItem('rememberMe')
        }
        
        login(response.user)
        const dashboardPath = getDashboardPath(response.user.role)
        navigate(dashboardPath, { replace: true })
      } else {
        setError('ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง')
      }
    } catch {
      setError('เกิดข้อผิดพลาดในการเข้าสู่ระบบ')
    } finally {
      setLoading(false)
    }
  }

function handleResetConfirm() {
    setResetError('')
    setResetSuccess('')
    
    if (!Username || !Password || !NewPassword) {
      setResetError('กรุณากรอกข้อมูลให้ครบทุกช่อง')
      return
    }

    if (NewPassword.length < 6) {
      setResetError('รหัสผ่านใหม่ต้องมีอักขระอย่างน้อย 6 ตัว')
      return
    }

    // ดึงรหัสผ่านปัจจุบันจากระบบ Mock
    const storedPasswords = JSON.parse(localStorage.getItem('mockUserPasswords') || '{}')
    
    // ดึงข้อมูล User มาตรวจสอบ
    const userData = getUserForAuth(Username)
    
    if (userData) {
      // ตรวจสอบว่ารหัสผ่านเดิมถูกไหม
      if (userData.password !== Password) {
        setResetError('รหัสผ่านเดิมไม่ถูกต้อง')
        return
      }

      // =======================================================
      // 🛠️ ส่วนที่แก้ไข: เปลี่ยนการบันทึกให้ถูกต้อง (Key: usersData)
      // =======================================================
      
      // 1. อ่านข้อมูลจาก usersData (ถ้าไม่มีให้ใช้ข้อมูลตั้งต้น)
      let allUsers = []
      const storedUsersData = localStorage.getItem('usersData')
      
      if (storedUsersData) {
        allUsers = JSON.parse(storedUsersData)
      } else {
        // ถ้ายังไม่เคยบันทึก ให้ใช้ข้อมูลดิบจากไฟล์ usersData.js
        allUsers = initialUsersData
      }

      // 2. ค้นหา User คนนั้นแล้วเปลี่ยนรหัสผ่านใน List
      const updatedUsers = allUsers.map(user => {
        // เช็คชื่อ Username (ใช้ตัวพิมพ์เล็กเพื่อความชัวร์)
        if (user.username.toLowerCase() === Username.toLowerCase()) {
           return { ...user, password: NewPassword }
        }
        return user
      })

      // 3. บันทึกกลับลงไปใน 'usersData' (เพื่อให้ตรงกับที่ระบบ Login อ่าน)
      localStorage.setItem('usersData', JSON.stringify(updatedUsers))

      // 4. อัปเดตตารางรหัสผ่านสำรอง (mockUserPasswords) ด้วย เพื่อความชัวร์
      const updatedPasswords = { ...storedPasswords }
      updatedPasswords[Username.toLowerCase()] = NewPassword
      
      // ถ้าเป็น Admin ให้แก้รหัสของ User ที่ Link กันด้วย
      if (userData.adminAccount) {
         updatedPasswords[userData.adminAccount.toLowerCase()] = NewPassword
      }

      localStorage.setItem('mockUserPasswords', JSON.stringify(updatedPasswords))
      // =======================================================

      setResetSuccess('เปลี่ยนรหัสผ่านสำเร็จ! กำลังกลับสู่หน้า ลงชื่อเข้าใช้...')
    } else {
      // กรณีไม่พบ User ในระบบ (Fallback Logic)
      const fallbackAccount = getFallbackAdminAccount(Username, storedPasswords)

      if (!fallbackAccount) {
        setResetError('ไม่พบชื่อผู้ใช้นี้ในระบบ')
        return
      }

      if (fallbackAccount.password !== Password) {
        setResetError('รหัสผ่านเดิมไม่ถูกต้อง')
        return
      }

      // อัปเดตรหัสผ่านสำหรับ Fallback Account
      const normalizedUsername = fallbackAccount.username.toLowerCase()
      const updatedPasswords = {
        ...storedPasswords,
        [normalizedUsername]: NewPassword
      }

      if (fallbackAccount.linkedAdminAccount) {
        updatedPasswords[fallbackAccount.linkedAdminAccount.toLowerCase()] = NewPassword
      }

      localStorage.setItem('mockUserPasswords', JSON.stringify(updatedPasswords))
      setResetSuccess('เปลี่ยนรหัสผ่านสำเร็จ! กำลังกลับสู่หน้า ลงชื่อเข้าใช้...')
    }

    // รีโหลดหน้าเว็บเพื่อให้ข้อมูลอัปเดตทันที
    setTimeout(() => {
      window.location.href = '/auth'
    }, 1500)
  }

  return (
    <div className="min-h-screen relative bg-gradient-to-br from-brand-accent-soft via-white to-orange-50">
      {loading && <PuffLoader text="กำลังเข้าสู่ระบบ..." />}

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-20 left-10 w-72 h-72 bg-orange-200 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob"></div>
        <div className="absolute top-40 right-10 w-72 h-72 bg-orange-100 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-2000"></div>
        <div className="absolute bottom-20 left-1/2 w-72 h-72 bg-red-100 rounded-full mix-blend-multiply filter blur-xl opacity-30 animate-blob animation-delay-4000"></div>
      </div>

      <section
        className={`font-prompt fixed inset-x-0 bottom-0 left-0 right-0 xl:left-[400px] xl:right-[500px] 2xl:left-[500px] 2xl:right-[500px] bg-white/95 backdrop-blur-sm rounded-t-[28px] shadow-2xl md:px-[60px] lg:px-[80px] xl:px-[40px] px-6 pb-8 pt-6 z-40 overflow-hidden transition-all duration-500 ease-in-out ${
          showReset ? 'opacity-0 scale-95 pointer-events-none translate-y-4' : 'opacity-100 scale-100 translate-y-0'
        }`}
        style={{ boxShadow: '0 -18px 60px rgba(242,102,35,0.25)' }}
      >
        <div className="space-y-6">
          <header className="w-full flex items-center justify-center text-center font-prompt font-bold md:text-[36px] lg:text-[40px] xl:text-[48px] text-[30px] py-3 bg-gradient-to-r from-brand-primary to-orange-600 bg-clip-text text-transparent">
            ลงชื่อเข้าใช้
          </header>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm animate-shake">
              {error}
            </div>
          )}

          <div className="flex flex-col gap-2 group">
            <label className="sm:text-[18px] md:text-[18px] lg:text-[18px] xl:text-[24px] text-[16px] font-medium text-gray-700 transition-colors group-focus-within:text-orange-500">
              Username
            </label>
            <input
              type="text"
              placeholder="กรอกรหัสผู้ใช้"
              className="bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 w-full outline-none placeholder:text-gray-400 placeholder:text-[14px] sm:placeholder:text-[16px] md:placeholder:text-[16px] lg:placeholder:text-[16px] xl:placeholder:text-[20px] transition-all duration-300 focus:border-orange-400 focus:bg-white focus:shadow-md"
              value={username}
              onChange={e => setUsername(e.target.value)}
            />
          </div>

          {/* 🔒 ช่องกรอกรหัสผ่าน (Password input field) */}
          <div className="flex flex-col gap-2 group">
            <label className="sm:text-[18px] md:text-[18px] lg:text-[18px] xl:text-[24px] text-[16px] font-medium text-gray-700 transition-colors group-focus-within:text-orange-500">
              Password
            </label>
            <div className="relative">
              <input
                type={showPwd ? 'text' : 'password'}
                placeholder="กรอกรหัสผ่าน"
                className="bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 w-full outline-none pr-12 placeholder:text-gray-400 placeholder:text-[14px] sm:placeholder:text-[16px] md:placeholder:text-[16px] lg:placeholder:text-[16px] xl:placeholder:text-[20px] transition-all duration-300 focus:border-orange-400 focus:bg-white focus:shadow-md"
                value={password}
                onChange={e => setPassword(e.target.value)}
              />
              {/* 👁️ ปุ่มแสดง/ซ่อนรหัสผ่าน (Toggle password visibility) */}
              <button
                type="button"
                onClick={() => setShowPwd((s) => !s)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-orange-500 transition-colors duration-200"
                aria-label="toggle password"
              >
                {showPwd ? (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                ) : (
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.477 0-8.268-2.943-9.542-7a9.97 9.97 0 012.223-3.657M6.16 6.16A9.97 9.97 0 0112 5c4.477 0 8.268 2.943 9.542 7a9.956 9.956 0 01-1.524 2.893M3 3l18 18" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* ✅ Checkbox จำฉันไว้ */}
          <div className="flex items-center gap-2 pt-2">
            <input
              type="checkbox"
              id="rememberMe"
              checked={rememberMe}
              onChange={(e) => setRememberMe(e.target.checked)}
              className="w-4 h-4 text-orange-500 bg-gray-100 border-gray-300 rounded focus:ring-orange-500 focus:ring-2 cursor-pointer"
            />
            <label
              htmlFor="rememberMe"
              className="text-gray-600 text-sm sm:text-base cursor-pointer select-none"
            >
              จำชื่อผู้ใช้และรหัสผ่าน
            </label>
          </div>

          {/* ✅ ปุ่มหลัก (Primary button) - เข้าสู่ระบบ */}
          <div className="flex justify-center pt-2">
            <button
              className="bg-gradient-to-r from-brand-primary to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white sm:text-[18px] md:text-[18px] lg:text[18px] xl:text-[24px] text-[16px] font-semibold rounded-xl py-3 px-8 min-w-[200px] shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
              onClick={handleLogin}
              disabled={loading}
            >
              เข้าสู่ระบบ
            </button>
          </div>

          {/* 🔄 ปุ่มเปลี่ยนรหัสผ่าน (Secondary action) */}
          <div className="text-center">
            <button
              type="button"
              onClick={() => setShowReset(true)}
              className="text-gray-500 hover:text-orange-500 sm:text-[18px] md:text-[18px] lg:text[18px] xl:text-[24px] text-[16px] transition-colors duration-200 hover:underline underline-offset-4"
            >
              เปลี่ยนรหัสผ่าน
            </button>
          </div>
        </div>
      </section>

      {/* 🔐 Card เปลี่ยนรหัสผ่าน (Reset Password Overlay Modal) */}
      {showReset && (
        <section
          className={`font-prompt fixed inset-x-0 bottom-0 left-0 right-0 xl:left-[400px] xl:right-[500px] 2xl:left-[500px] 2xl:right-[500px] bg-white/95 backdrop-blur-sm rounded-t-[28px] shadow-2xl md:px-[60px] lg:px-[80px] xl:px-[40px] px-6 pb-8 pt-6 z-50 overflow-hidden transition-all duration-500 ease-in-out ${
            showReset ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-4'
          }`}
          style={{ boxShadow: '0 -18px 60px rgba(242,102,35,0.25)' }}
        >
          <div className="space-y-6 relative z-10">
            <header className="w-full flex items-center justify-center text-center font-prompt font-bold md:text-[36px] lg:text-[40px] xl:text-[48px] text-[30px] py-3 bg-gradient-to-r from-brand-primary to-orange-600 bg-clip-text text-transparent">
              เปลี่ยนรหัสผ่าน
            </header>

            {/* ⚠️ ข้อความแสดงข้อผิดพลาด (Error message) */}
            {resetError && (
              <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm animate-shake">
                {resetError}
              </div>
            )}

            {/* ✅ ข้อความแสดงผลสำเร็จ (Success message) */}
            {resetSuccess && (
              <div className="bg-green-50 border border-green-200 text-green-700 px-4 py-3 rounded-lg text-sm">
                {resetSuccess}
              </div>
            )}

            {/* 📝 ช่องกรอกชื่อผู้ใช้ (Username input field) */}
            <div className="flex flex-col gap-2 group">
              <label className="sm:text-[18px] md:text-[18px] lg:text-[18px] xl:text-[24px] text-[16px] font-medium text-gray-700 transition-colors group-focus-within:text-orange-500">
                Username <span className="text-red-500">*</span>
              </label>
              <input
                value={Username}
                onChange={(e) => {
                  setUsernameReset(e.target.value)
                  setResetError('')
                }}
                type="text"
                placeholder="กรอกรหัสผู้ใช้"
                className="bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 w-full outline-none placeholder:text-gray-400 placeholder:text-[14px] sm:placeholder:text-[16px] md:placeholder:text-[16px] lg:placeholder:text-[16px] xl:placeholder:text-[20px] transition-all duration-300 focus:border-orange-400 focus:bg-white focus:shadow-md"
              />
            </div>

            {/* 🔒 ช่องกรอกรหัสผ่านเดิม (Current Password input field) */}
            <div className="flex flex-col gap-2 group">
              <label className="sm:text-[18px] md:text-[18px] lg:text-[18px] xl:text-[24px] text-[16px] font-medium text-gray-700 transition-colors group-focus-within:text-orange-500">
                Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  value={Password}
                  onChange={(e) => {
                    setPasswordReset(e.target.value)
                    setResetError('')
                  }}
                  type={showPassword ? 'text' : 'password'}
                  placeholder="กรอกรหัสผ่านเดิม"
                  className="bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 w-full outline-none pr-12 placeholder:text-gray-400 placeholder:text-[14px] sm:placeholder:text-[16px] md:placeholder:text-[16px] lg:placeholder:text-[16px] xl:placeholder:text-[20px] transition-all duration-300 focus:border-orange-400 focus:bg-white focus:shadow-md"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-orange-500 transition-colors duration-200"
                  aria-label="toggle password"
                >
                  {showPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.477 0-8.268-2.943-9.542-7a9.97 9.97 0 012.223-3.657M6.16 6.16A9.97 9.97 0 0112 5c4.477 0 8.268 2.943 9.542 7a9.956 9.956 0 01-1.524 2.893M3 3l18 18" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* 🔑 ช่องกรอกรหัสผ่านใหม่ (New Password input field) */}
            <div className="flex flex-col gap-2 group">
              <label className="sm:text-[18px] md:text-[18px] lg:text-[18px] xl:text-[24px] text-[16px] font-medium text-gray-700 transition-colors group-focus-within:text-orange-500">
                New Password <span className="text-red-500">*</span>
              </label>
              <div className="relative">
                <input
                  value={NewPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value)
                    setResetError('')
                  }}
                  type={showNewPassword ? 'text' : 'password'}
                  placeholder="กรอกรหัสผ่านใหม่"
                  className="bg-gray-50 border-2 border-gray-200 rounded-xl px-4 py-3 w-full outline-none pr-12 placeholder:text-gray-400 placeholder:text-[14px] sm:placeholder:text-[16px] md:placeholder:text-[16px] lg:placeholder:text-[16px] xl:placeholder:text-[20px] transition-all duration-300 focus:border-orange-400 focus:bg-white focus:shadow-md"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((s) => !s)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-orange-500 transition-colors duration-200"
                  aria-label="toggle password"
                >
                  {showNewPassword ? (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.477 0 8.268 2.943 9.542 7-1.274 4.057-5.065 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  ) : (
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.477 0-8.268-2.943-9.542-7a9.97 9.97 0 012.223-3.657M6.16 6.16A9.97 9.97 0 0112 5c4.477 0 8.268 2.943 9.542 7a9.956 9.956 0 01-1.524 2.893M3 3l18 18" />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {/* ✅ ปุ่มยืนยันการเปลี่ยนรหัสผ่าน (Confirm button) */}
            <div className='flex justify-center pt-2'>
              <button
                className="bg-gradient-to-r from-brand-primary to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white rounded-xl py-3 sm:text-[18px] md:text-[18px] lg:text[18px] xl:text-[24px] text-[16px] font-semibold px-8 min-w-[200px] shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none"
                onClick={handleResetConfirm}
                disabled={!Username || !Password || !NewPassword || resetSuccess}
              >
                ยืนยัน
              </button>
            </div>

            {/* 🔙 ปุ่มกลับ (Back button) - แสดงตามหน้าที่มา */}
            <div className="text-center mt-2 sm:text-[18px] md:text-[18px] lg:text[18px] xl:text-[24px] text-[16px]">
              <button
                type="button"
                onClick={() => {
                  setShowReset(false)
                  setResetError('')
                  setResetSuccess('')
                  // ตรวจสอบว่ามาจากหน้า Settings หรือไม่
                  if (searchParams.get('mode') === 'reset') {
                    navigate(-1) // กลับไปหน้าก่อนหน้า (Settings)
                  } else {
                    navigate('/auth', { replace: true }) // กลับไปหน้า Login
                  }
                }}
                className="text-gray-500 hover:text-orange-500 transition-colors duration-200 hover:underline underline-offset-4"
              >
                {searchParams.get('mode') === 'reset' ? 'กลับไปหน้าตั้งค่า' : 'กลับหน้า ลงชื่อเข้าใช้'}
              </button>
            </div>
          </div>
        </section>
      )}
    </div>
  )
}

export default Auth