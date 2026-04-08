// ═══════════════════════════════════════════════════════════════
// 🧠 AUTH SERVICE - จัดการ Authentication ด้วย Database Session + JWT
// ═══════════════════════════════════════════════════════════════
// 📌 Source: src/services/auth.service.ts
//
// สถาปัตยกรรม:
//   - accessToken  : JWT (HS256) อายุ 30 นาที — ใช้แนบทุก request
//   - refreshToken : random hex อายุ 7 วัน  — ใช้ขอ accessToken ใหม่
//   - session      : บันทึกใน database เพื่อรองรับการ revoke (logout ทันที)
//
// ระบบรหัสผ่าน (2 ระดับ):
//   1. รหัสปกติ     : bcrypt hash ใน password column เสมอ
//      - ยังไม่เคยเปลี่ยนรหัส → hash ของ nationalId (ตั้งแต่สร้าง account)
//      - เปลี่ยนรหัสแล้ว    → hash ของรหัสใหม่ (nationalId ใช้ไม่ได้อีก)
//   2. adminPassword : plain text — สำหรับ Admin/SuperAdmin เข้า Admin Dashboard เท่านั้น
//
// ฟังก์ชันใน service นี้:
//   1️⃣ login()              — ตรวจ credentials + สร้าง session
//   2️⃣ validateToken()      — ตรวจ JWT + session (2 ชั้น)
//   3️⃣ validateRefreshToken() — ตรวจ refreshToken ก่อน issue ใหม่
//   4️⃣ refreshAccessToken() — ออก accessToken ใหม่โดยไม่ต้อง login ซ้ำ
//   5️⃣ logout()             — ลบ session ทันที
//   6️⃣ changePassword()     — เปลี่ยนรหัส + ลบ session ทั้งหมด
// ═══════════════════════════════════════════════════════════════

import crypto from 'crypto';                                       // ← สร้าง random bytes สำหรับ jti และ refreshToken
import * as bcrypt from 'bcrypt';                                  // ← Hash/compare password ด้วย bcrypt (one-way hash)
import jwt from 'jsonwebtoken';                                    // ← สร้าง/ตรวจสอบ JWT (JSON Web Token)
import { prisma } from '../lib/prisma.js';                         // ← Prisma ORM client สำหรับเชื่อมต่อ database
import { createAuditLog, AuditAction } from './audit.service.js';  // ← บันทึก audit log (ใครทำอะไร เมื่อไหร่)

// ═══════════════════════════════════════════════════════════════
// ⚙️ ค่าคงที่ — อายุ Token และ JWT Secret
// ═══════════════════════════════════════════════════════════════
const ACCESS_TOKEN_EXPIRY = 30 * 60 * 1000;           // ← accessToken หมดอายุใน 30 นาที (มิลลิวินาที สำหรับ Date)
const ACCESS_TOKEN_EXPIRY_SECONDS = 30 * 60;           // ← accessToken หมดอายุใน 30 นาที (วินาที สำหรับ jwt.sign)
const REFRESH_TOKEN_EXPIRY = 7 * 24 * 60 * 60 * 1000; // ← refreshToken หมดอายุใน 7 วัน (มิลลิวินาที)

const JWT_SECRET = process.env.JWT_SECRET ?? 'fallback_dev_secret_change_in_production'; // ← ดึง secret จาก env (ถ้าไม่มีใช้ fallback สำหรับ dev เท่านั้น)

export const authService = {
  // ═══════════════════════════════════════════════════════════════
  // 1️⃣ LOGIN - ตรวจสอบ credentials และสร้าง session
  // ═══════════════════════════════════════════════════════════════
  /**
   * 🔐 LOGIN - ตรวจสอบ credentials และสร้าง session
   *
   * Logic การตรวจรหัสผ่าน:
   * ┌─────────────────────────────────────────────────────────────────┐
   * │ ① Admin/SuperAdmin + ใส่ adminPassword (plain text ตรงกัน)     │
   * │   → dashboardMode: 'admin' | 'superadmin'                     │
   * │                                                                │
   * │ ② ทุก role + ใส่รหัสปกติ                                       │
   * │   • password column มีค่า → bcrypt.compare()                  │
   * │   • password column เป็น null → เทียบ nationalId (plain text) │
   * │     (fallback สำหรับ user เก่าที่ยังไม่ได้รัน migrate script) │
   * │   → dashboardMode: 'manager' (Manager) | 'user' (อื่นๆ)       │
   * └─────────────────────────────────────────────────────────────────┘
   */
  async login(
    employeeId: string,   // ← รหัสพนักงาน (เช่น BKK001, CNX002)
    password: string,     // ← nationalId หรือรหัสที่เปลี่ยนแล้ว หรือ adminPassword
    ipAddress?: string,   // ← IP address ของ client (optional, สำหรับ audit log)
    userAgent?: string    // ← User-Agent header ของ client (optional, สำหรับ audit log)
  ) {
    try {
      // ✅ STEP 1: ค้นหา user จาก employeeId
      // ═════════════════════════════════════
      const user = await prisma.user.findUnique({
        where: { employeeId }  // ← ค้นหาจาก employeeId (unique column ใน users table)
      });

      if (!user) {  // ← ไม่พบ user ในระบบ
        throw new Error('ไม่พบพนักงาน (employeeId ไม่ถูกต้อง)');
      }

      // ✅ STEP 2: ตรวจสอบรหัสผ่านและกำหนด dashboardMode
      // ═══════════════════════════════════════════════════
      // Admin/SuperAdmin มี 2 ช่องทาง login:
      //   - adminPassword → เข้า Admin/SuperAdmin Dashboard (จัดการระบบ)
      //   - รหัสปกติ      → เข้า User Dashboard (ดูข้อมูลตัวเอง)
      let dashboardMode: 'superadmin' | 'admin' | 'manager' | 'user';  // ← กำหนดว่าจะเข้า dashboard ไหน

      const isAdminRole = user.role === 'ADMIN' || user.role === 'SUPERADMIN';  // ← เช็คว่าเป็น Admin role หรือไม่
      const hasAdminPassword = isAdminRole && user.adminPassword !== null && user.adminPassword !== undefined;  // ← เช็คว่ามี adminPassword ตั้งไว้

      if (hasAdminPassword && password === user.adminPassword) {
        // ── เส้นทาง Admin Dashboard — adminPassword ตรงกัน (plain text compare) ──
        dashboardMode = user.role === 'SUPERADMIN' ? 'superadmin' : 'admin';  // ← SUPERADMIN → superadmin, ADMIN → admin
      } else {
        // ── เส้นทาง User Dashboard — ตรวจรหัสปกติ (bcrypt compare) ──
        let isValid: boolean;  // ← ผลการตรวจรหัสผ่าน (true = ตรง, false = ไม่ตรง)
        if (user.password !== null && user.password !== undefined) {
          // bcrypt.compare ทำงานได้ทั้งสองกรณี:
          //   - ยังไม่เคยเปลี่ยนรหัส → hash ของ nationalId อยู่ใน password column
          //   - เปลี่ยนรหัสแล้ว      → hash ของรหัสใหม่อยู่ใน password column
          isValid = await bcrypt.compare(password, user.password);  // ← เปรียบเทียบ password กับ hash ใน DB
        } else {
          // fallback สำหรับ user เก่าที่ยังไม่ได้รัน migrate script (ไม่ควรเกิดขึ้นแล้ว)
          isValid = password === user.nationalId;  // ← เทียบ plain text กับ nationalId โดยตรง
        }
        if (!isValid) {  // ← รหัสผ่านไม่ตรงทั้ง 2 กรณี
          throw new Error('รหัสผ่านไม่ถูกต้อง');
        }
        if (user.role === 'MANAGER') {
          dashboardMode = 'manager';  // ← MANAGER → manager dashboard
        } else {
          // USER, และ Admin/SuperAdmin ที่ login ด้วยรหัสปกติ → User Dashboard
          dashboardMode = 'user';  // ← ทุก role อื่น → user dashboard
        }
      }

      // ✅ STEP 3: สร้าง JWT accessToken + random refreshToken
      // ═══════════════════════════════════════════════════════
      // jti (JWT ID) ใช้สำหรับ revoke token รายตัว — ไม่ต้องเปลี่ยน secret key ทั้งระบบ
      const jti = crypto.randomBytes(16).toString('hex');  // ← สร้าง unique ID 32 chars hex
      const accessToken = jwt.sign(
        {
          sub: String(user.userId),    // ← subject = userId (แปลงเป็น string ตาม JWT spec)
          employeeId: user.employeeId, // ← รหัสพนักงาน (ใช้แสดงผลใน frontend)
          role: user.role,             // ← role (ADMIN/SUPERADMIN/MANAGER/USER) สำหรับ RBAC
          dashboardMode,               // ← dashboard ที่จะเข้า (superadmin/admin/manager/user)
          jti                          // ← JWT ID สำหรับ revoke เฉพาะ token นี้
        },
        JWT_SECRET,                                    // ← secret key สำหรับ sign (HS256)
        { expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS }     // ← หมดอายุใน 30 นาที (1800 วินาที)
      );
      const refreshToken = crypto.randomBytes(32).toString('hex');  // ← สร้าง random refresh token 64 chars hex

      // ✅ STEP 4: บันทึก session ลง database
      // ══════════════════════════════════════
      // เก็บทั้ง accessToken และ refreshToken ไว้ใน session table
      // เพื่อรองรับ logout (ลบ session = token ใช้ไม่ได้ทันที) และ token refresh
      const session = await prisma.session.create({
        data: {
          userId: user.userId,                                           // ← เจ้าของ session (FK → users.userId)
          token: accessToken,                                            // ← JWT accessToken (ใช้ค้นหาตอน validate)
          expiresAt: new Date(Date.now() + ACCESS_TOKEN_EXPIRY),         // ← หมดอายุใน 30 นาที
          refreshToken,                                                  // ← random refreshToken (ใช้ขอ accessToken ใหม่)
          refreshTokenExpiresAt: new Date(Date.now() + REFRESH_TOKEN_EXPIRY),  // ← หมดอายุใน 7 วัน
          ipAddress,                                                     // ← IP ของ client (สำหรับ audit)
          userAgent                                                      // ← User-Agent ของ client (สำหรับ audit)
        }
      });

      // ✅ STEP 5: ดึง branch name (ถ้า user มี branchId)
      // ═════════════════════════════════════════════════
      let branchName: string | undefined;  // ← ชื่อสาขา (optional)
      if (user.branchId) {  // ← ถ้า user สังกัดสาขา
        const branch = await prisma.branch.findUnique({
          where: { branchId: user.branchId },  // ← ค้นหาสาขาจาก branchId
          select: { name: true, code: true },  // ← เลือกเฉพาะ name และ code
        });
        branchName = branch?.name ?? undefined;  // ← ถ้าพบใช้ชื่อสาขา, ไม่พบ = undefined
      }

      // ✅ STEP 6: สร้าง response object สำหรับส่งกลับ frontend
      // ═══════════════════════════════════════════════════════
      const result = {
        accessToken: session.token,                              // ← JWT accessToken จาก session
        refreshToken: session.refreshToken,                      // ← refreshToken จาก session
        expiresIn: Math.floor(ACCESS_TOKEN_EXPIRY / 1000),       // ← อายุ token เป็นวินาที (1800)
        dashboardMode,                                           // ← 'superadmin' | 'admin' | 'manager' | 'user'
        user: {
          userId: user.userId,                   // ← ID ของพนักงาน (PK)
          employeeId: user.employeeId,           // ← รหัสพนักงาน (เช่น BKK001)
          title: user.title,                     // ← คำนำหน้าชื่อ (นาย/นาง/นางสาว)
          firstName: user.firstName,             // ← ชื่อ
          lastName: user.lastName,               // ← นามสกุล
          gender: user.gender,                   // ← เพศ (MALE/FEMALE)
          email: user.email,                     // ← อีเมล
          role: user.role,                       // ← role (ADMIN/SUPERADMIN/MANAGER/USER)
          avatarUrl: user.avatarUrl,             // ← URL รูปโปรไฟล์ (Supabase Storage)
          branchId: user.branchId ?? undefined,      // ← ID สาขา (ถ้ามี)
          department: user.department ?? undefined,   // ← แผนก (ถ้ามี)
          position: user.position ?? undefined,      // ← ตำแหน่ง (ถ้ามี)
          phone: user.phone ?? undefined,            // ← เบอร์โทร (ถ้ามี)
          branch: branchName,                        // ← ชื่อสาขา (ถ้ามี)
        }
      };

      // ✅ STEP 7: บันทึก Audit Log (LOGIN event)
      // ══════════════════════════════════════════
      await createAuditLog({
        userId: user.userId,                                              // ← ใครทำ (userId)
        action: AuditAction.LOGIN,                                        // ← action = LOGIN
        targetTable: 'users',                                             // ← ตารางที่เกี่ยวข้อง
        targetId: user.userId,                                            // ← record ID ที่เกี่ยวข้อง
        ipAddress,                                                        // ← IP ของ client
        userAgent,                                                        // ← User-Agent ของ client
        newValues: { employeeId: user.employeeId, role: user.role },      // ← ข้อมูลที่บันทึกใน log
      });

      return result;  // ← ส่ง response กลับให้ controller → frontend
    } catch (error: any) {
      console.error('❌ Login service error:', error.message);  // ← log error เพื่อ debug
      throw error;                                               // ← โยน error ต่อให้ controller จัดการ
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // 2️⃣ VALIDATE ACCESS TOKEN - ตรวจสอบ JWT + session ใน database
  // ═══════════════════════════════════════════════════════════════
  /**
   * ✅ VALIDATE ACCESS TOKEN - ตรวจสอบ JWT + session ใน database
   *
   * ทำ 2 ชั้น:
   * 1. ตรวจ JWT signature และ expiration (ด้วย jwt.verify)
   * 2. ตรวจใน database อีกรอบ — เพื่อให้ logout มีผลทันที (revoke)
   *    ถ้า token ถูก delete ออกจาก session table → ใช้ไม่ได้แม้ JWT ยังไม่หมดอายุ
   */
  async validateToken(token: string) {  // ← รับ JWT accessToken string
    try {
      // ✅ STEP 1: ตรวจ JWT signature และ expiration
      // ═════════════════════════════════════════════
      let decoded: jwt.JwtPayload;  // ← ข้อมูลที่ decode ได้จาก JWT (sub, role, jti, etc.)
      try {
        decoded = jwt.verify(token, JWT_SECRET) as jwt.JwtPayload;  // ← verify ลายเซ็น + เช็คหมดอายุ
      } catch (jwtError: any) {
        if (jwtError.name === 'TokenExpiredError') {  // ← JWT หมดอายุแล้ว (เกิน 30 นาที)
          throw new Error('Access Token หมดอายุแล้ว');
        }
        throw new Error('Token ไม่ถูกต้อง');  // ← JWT ผิดรูปแบบ หรือ signature ไม่ตรง
      }

      // ✅ STEP 2: ตรวจ session ใน database (ป้องกัน revoke)
      // ════════════════════════════════════════════════════
      const session = await prisma.session.findUnique({
        where: { token },        // ← ค้นหา session จาก token string (unique column)
        include: { user: true }  // ← JOIN กับ users table เพื่อดึงข้อมูล user มาด้วย
      });

      if (!session) {  // ← ไม่พบ session → token ถูก revoke (logout) หรือ session หมดอายุแล้วถูกลบ
        throw new Error('Token ถูก revoke แล้ว หรือไม่พบ Session');
      }

      // ✅ STEP 3: คืนข้อมูล user สำหรับ req.user ใน middleware
      // ═══════════════════════════════════════════════════════
      // ข้อมูลนี้จะถูก set เป็น req.user ใน auth.middleware.ts
      // เพื่อให้ controller/service ดึงใช้ได้ (เช่น req.user.role, req.user.userId)
      return {
        userId: session.user.userId,                  // ← ID ของพนักงาน (PK)
        employeeId: session.user.employeeId,          // ← รหัสพนักงาน
        firstName: session.user.firstName,            // ← ชื่อ
        lastName: session.user.lastName,              // ← นามสกุล
        email: session.user.email,                    // ← อีเมล
        role: session.user.role,                      // ← role (ใช้ใน RBAC middleware)
        avatarUrl: session.user.avatarUrl,            // ← URL รูปโปรไฟล์
        branchId: session.user.branchId ?? undefined  // ← ID สาขา (ใช้ใน branch-level access control)
      };
    } catch (error) {
      throw error;  // ← โยน error ต่อให้ auth.middleware.ts จัดการ (ตอบ 401)
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // 3️⃣ VALIDATE REFRESH TOKEN - ตรวจสอบ refresh token ก่อน issue ใหม่
  // ═══════════════════════════════════════════════════════════════
  /**
   * 🔄 VALIDATE REFRESH TOKEN - ตรวจสอบ refresh token ก่อน issue token ใหม่
   *
   * ตรวจว่า refreshToken มีอยู่จริงใน database และยังไม่หมดอายุ
   * ถ้าหมดอายุ → ลบทิ้งทันที และบังคับ login ใหม่
   */
  async validateRefreshToken(refreshToken: string) {  // ← รับ refreshToken string (64 chars hex)
    try {
      // ✅ STEP 1: ค้นหา session จาก refreshToken
      // ═══════════════════════════════════════════
      const session = await prisma.session.findUnique({
        where: { refreshToken },    // ← ค้นหาจาก refreshToken (unique column)
        include: { user: true }     // ← JOIN กับ users table เพื่อดึงข้อมูล user
      });

      if (!session) {  // ← ไม่พบ session → refreshToken ไม่ถูกต้อง
        throw new Error('Refresh Token ไม่พบ');
      }

      // ✅ STEP 2: เช็ค expiration ของ refresh token
      // ═════════════════════════════════════════════
      if (new Date() > session.refreshTokenExpiresAt) {  // ← เวลาปัจจุบัน > เวลาหมดอายุ
        // หมดอายุแล้ว → ลบ session ทิ้ง บังคับ login ใหม่
        await prisma.session.delete({ where: { id: session.id } });  // ← ลบ session ที่หมดอายุออก
        throw new Error('Refresh Token หมดอายุแล้ว');
      }

      return session;  // ← ส่ง session กลับ (มีข้อมูล user ด้วย) สำหรับใช้ใน refreshAccessToken()
    } catch (error) {
      throw error;  // ← โยน error ต่อ
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // 4️⃣ REFRESH ACCESS TOKEN - ออก accessToken ใหม่โดยไม่ต้อง login ซ้ำ
  // ═══════════════════════════════════════════════════════════════
  /**
   * 🔁 REFRESH ACCESS TOKEN - ออก accessToken ใหม่โดยไม่ต้อง login ซ้ำ
   *
   * Flow: refreshToken → ตรวจสอบ → สร้าง accessToken ใหม่ → อัพเดท session
   * ใช้เมื่อ accessToken หมดอายุ (API ตอบ 401) — Frontend ควร intercept อัตโนมัติ
   */
  async refreshAccessToken(refreshToken: string) {  // ← รับ refreshToken string
    try {
      // ✅ STEP 1: ตรวจสอบ refreshToken (เรียก validateRefreshToken)
      // ════════════════════════════════════════════════════════════
      const session = await this.validateRefreshToken(refreshToken);  // ← ตรวจว่ายังไม่หมดอายุ + มีอยู่จริง

      // ✅ STEP 2: สร้าง accessToken ใหม่พร้อม jti ใหม่
      // ═════════════════════════════════════════════════
      const jti = crypto.randomBytes(16).toString('hex');  // ← สร้าง unique JWT ID ใหม่
      const newAccessToken = jwt.sign(
        {
          sub: String(session.user.userId),    // ← subject = userId
          employeeId: session.user.employeeId, // ← รหัสพนักงาน
          role: session.user.role,             // ← role สำหรับ RBAC
          jti                                  // ← JWT ID ใหม่
        },
        JWT_SECRET,                                    // ← secret key (HS256)
        { expiresIn: ACCESS_TOKEN_EXPIRY_SECONDS }     // ← หมดอายุใน 30 นาที
      );

      // ✅ STEP 3: อัพเดท token เดิมใน session (ไม่สร้าง session ใหม่)
      // ═══════════════════════════════════════════════════════════════
      await prisma.session.update({
        where: { id: session.id },  // ← ค้นหา session จาก id (PK)
        data: {
          token: newAccessToken,                                   // ← เปลี่ยน accessToken เป็นตัวใหม่
          expiresAt: new Date(Date.now() + ACCESS_TOKEN_EXPIRY)    // ← ขยายเวลาหมดอายุเป็น 30 นาทีจากตอนนี้
        }
      });

      console.log('✅ Access token refreshed for user:', session.user.userId);  // ← log สำหรับ debug

      // ✅ STEP 4: ส่ง response กลับ (accessToken ใหม่ + ข้อมูล user)
      // ═══════════════════════════════════════════════════════════════
      return {
        accessToken: newAccessToken,                              // ← JWT accessToken ตัวใหม่
        expiresIn: Math.floor(ACCESS_TOKEN_EXPIRY / 1000),        // ← อายุเป็นวินาที (1800)
        user: {
          userId: session.user.userId,           // ← ID ของพนักงาน
          employeeId: session.user.employeeId,   // ← รหัสพนักงาน
          title: session.user.title,             // ← คำนำหน้าชื่อ
          firstName: session.user.firstName,     // ← ชื่อ
          lastName: session.user.lastName,       // ← นามสกุล
          gender: session.user.gender,           // ← เพศ
          email: session.user.email,             // ← อีเมล
          role: session.user.role                // ← role
        }
      };
    } catch (error: any) {
      console.error('❌ Refresh token error:', error.message);  // ← log error เพื่อ debug
      throw error;                                               // ← โยน error ต่อ
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // 5️⃣ LOGOUT - ลบ session ออกจาก database ทันที
  // ═══════════════════════════════════════════════════════════════
  /**
   * 🚪 LOGOUT - ลบ session ออกจาก database ทันที
   *
   * การลบ session ทำให้ token ใช้ไม่ได้ทันที แม้ JWT ยังไม่หมดอายุ
   * (เพราะ validateToken() เช็ค database เป็น 2 ชั้นเสมอ)
   */
  async logout(token: string) {  // ← รับ JWT accessToken ที่ต้องการ revoke
    try {
      // ✅ STEP 1: ค้นหา session จาก token
      // ════════════════════════════════════
      const session = await prisma.session.findUnique({
        where: { token },  // ← ค้นหา session จาก accessToken (unique column)
      });

      if (!session) {  // ← ไม่พบ session → อาจ logout ไปแล้ว หรือ token ไม่ถูกต้อง
        throw new Error('ไม่สามารถ logout ได้');
      }

      // ✅ STEP 2: ลบ session → token ใช้ไม่ได้ทันที
      // ═════════════════════════════════════════════
      await prisma.session.delete({
        where: { token }  // ← ลบ session ออกจาก DB (token ถูก revoke ทันที)
      });

      // ✅ STEP 3: บันทึก Audit Log (LOGOUT event)
      // ═══════════════════════════════════════════
      await createAuditLog({
        userId: session.userId,          // ← ใครทำ (userId จาก session)
        action: AuditAction.LOGOUT,      // ← action = LOGOUT
        targetTable: 'users',            // ← ตารางที่เกี่ยวข้อง
        targetId: session.userId,        // ← record ID
      });

      return { success: true };  // ← ส่งสถานะ success กลับ
    } catch (_error) {
      throw new Error('ไม่สามารถ logout ได้');  // ← error กรณีใดก็ตาม → ส่ง error เดียวกัน (ป้องกัน info leak)
    }
  },

  // ═══════════════════════════════════════════════════════════════
  // 6️⃣ CHANGE PASSWORD - เปลี่ยนรหัสผ่านปกติ (ไม่ใช่ adminPassword)
  // ═══════════════════════════════════════════════════════════════
  /**
   * 🔄 CHANGE PASSWORD - เปลี่ยนรหัสผ่านปกติ (ไม่ใช่ adminPassword)
   *
   * Logic:
   * 1. ตรวจรหัสปัจจุบัน:
   *    - password column มีค่า → ใช้ bcrypt.compare()
   *    - password column เป็น null → เทียบกับ nationalId (plain text)
   * 2. Hash รหัสใหม่ด้วย bcrypt (salt rounds 10) แล้วบันทึกใน password column
   * 3. ลบ session ทั้งหมด → บังคับ login ใหม่ด้วยรหัสใหม่
   *
   * หมายเหตุ: nationalId ไม่เปลี่ยน — แต่หลังเปลี่ยนรหัสแล้ว password column จะเป็น hash ใหม่
   *           ทำให้ nationalId ใช้ login ไม่ได้อีก (bcrypt จะไม่ match กับ hash ของรหัสใหม่)
   */
  async changePassword(
    userId: number,          // ← ID ของ user ที่ต้องการเปลี่ยนรหัส
    currentPassword: string, // ← รหัสผ่านปัจจุบัน (nationalId หรือรหัสที่เคยเปลี่ยนแล้ว)
    newPassword: string      // ← รหัสผ่านใหม่ที่ต้องการตั้ง
  ) {
    try {
      // ✅ STEP 1: ค้นหา user จาก userId
      // ══════════════════════════════════
      const user = await prisma.user.findUnique({
        where: { userId }  // ← ค้นหาจาก userId (PK)
      });

      if (!user) {  // ← ไม่พบ user ในระบบ
        throw new Error('ไม่พบผู้ใช้');
      }

      // ✅ STEP 2: ตรวจรหัสผ่านปัจจุบัน
      // ═════════════════════════════════
      // ถ้าเคยเปลี่ยนแล้ว → เช็ค password column (bcrypt hash)
      // ถ้ายังไม่เคยเปลี่ยน → เช็ค nationalId (plain text fallback)
      let isCurrentValid: boolean;  // ← ผลการตรวจรหัสปัจจุบัน
      if (user.password !== null && user.password !== undefined) {
        isCurrentValid = await bcrypt.compare(currentPassword, user.password);  // ← เปรียบเทียบกับ hash ใน DB
      } else {
        isCurrentValid = currentPassword === user.nationalId;  // ← เทียบ plain text กับ nationalId
      }
      if (!isCurrentValid) {  // ← รหัสปัจจุบันไม่ถูกต้อง
        throw new Error('รหัสผ่านปัจจุบันไม่ถูกต้อง');
      }

      // ✅ STEP 3: Hash รหัสใหม่และบันทึกใน password column
      // ════════════════════════════════════════════════════
      // nationalId ไม่เปลี่ยน — password column จะเป็น hash ของรหัสใหม่
      const hashedNewPassword = await bcrypt.hash(newPassword, 10);  // ← hash รหัสใหม่ (salt rounds = 10)
      await prisma.user.update({
        where: { userId },                      // ← ค้นหา user จาก userId
        data: { password: hashedNewPassword }    // ← อัพเดท password column เป็น hash ใหม่
      });

      // ✅ STEP 4: ลบ session ทั้งหมดของ user นี้ → บังคับ login ใหม่
      // ═══════════════════════════════════════════════════════════════
      // ทุก device/browser ที่ login อยู่จะถูก logout ทันที
      await prisma.session.deleteMany({
        where: { userId }  // ← ลบทุก session ของ user นี้ (logout ทุก device)
      });

      // ✅ STEP 5: บันทึก Audit Log (CHANGE_PASSWORD event)
      // ════════════════════════════════════════════════════
      await createAuditLog({
        userId,                                // ← ใครทำ (userId)
        action: AuditAction.CHANGE_PASSWORD,   // ← action = CHANGE_PASSWORD
        targetTable: 'users',                  // ← ตารางที่เกี่ยวข้อง
        targetId: userId,                      // ← record ID
      });

      return { success: true };  // ← ส่งสถานะ success กลับ
    } catch (error) {
      throw error;  // ← โยน error ต่อให้ controller จัดการ
    }
  }
};

