// ═══════════════════════════════════════════════════════════════
// 👤 USER SERVICE - จัดการข้อมูลพนักงาน (CRUD + Bulk Import + Statistics)
// ═══════════════════════════════════════════════════════════════
// 📌 Source: src/services/user.service.ts
//
// ฟังก์ชันหลักใน service นี้:
//   1️⃣ createUser()        — สร้างพนักงานใหม่ + auto-generate employeeId
//   2️⃣ getUsers()          — ดึงรายชื่อพนักงาน (filter, search, pagination)
//   3️⃣ getUserById()       — ดึงพนักงานตาม ID (มี RBAC ตรวจสิทธิ์)
//   4️⃣ updateUser()        — แก้ไขข้อมูลพนักงาน (role, status, password, etc.)
//   5️⃣ deleteUser()        — ลบพนักงาน (soft delete → status = RESIGNED)
//   6️⃣ bulkCreateUsers()   — Import หลายคนจาก CSV พร้อมกัน
//   7️⃣ getUserStatistics() — นับสถิติพนักงาน (dashboard)
//
// สิทธิ์การเข้าถึง (RBAC):
//   - SuperAdmin: ดู/สร้าง/แก้/ลบ ได้ทุกสาขา
//   - Admin: ดู/สร้าง/แก้/ลบ ได้เฉพาะสาขาตัวเอง
//   - User: ดูได้เฉพาะข้อมูลตัวเอง
//
// 📝 employeeId Format: {branchCode}{runningNumber}
//   - เช่น BKK001, CNX002, HKT003
//   - running number นับจากจำนวน user ในสาขานั้น + 1
// ═══════════════════════════════════════════════════════════════

import { Role, UserStatus, Gender, Title } from '@prisma/client';            // ← Prisma enum types (Role, UserStatus, Gender, Title)
import { prisma } from '../lib/prisma.js';                                   // ← Prisma ORM client สำหรับเชื่อมต่อ database
import { createAuditLog, AuditAction } from './audit.service.js';            // ← บันทึก audit log (ใครทำอะไร เมื่อไหร่)
import { uploadAvatarToSupabase } from '../utils/supabase-storage.js';       // ← Upload avatar ไปยัง Supabase Storage
import { createClient } from '@supabase/supabase-js';                       // ← Supabase client สำหรับจัดการ avatar
import * as bcrypt from 'bcrypt';                                            // ← Hash/compare password ด้วย bcrypt (one-way hash)

// ═══════════════════════════════════════════════════════════════
// ⚙️ Supabase Client — สำหรับจัดการ avatar storage
// ═══════════════════════════════════════════════════════════════
const supabaseUrl = process.env.SUPABASE_URL;                                       // ← URL ของ Supabase project
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;  // ← Service Role Key (มีสิทธิ์เต็ม) หรือ Anon Key (อ่านอย่างเดียว)
const bucketName = process.env.SUPABASE_BUCKET_NAME || 'easycheck-bucket';          // ← ชื่อ bucket สำหรับเก็บ avatar

let supabase: ReturnType<typeof createClient> | null = null;  // ← Supabase client instance (lazy init)
if (supabaseUrl && supabaseKey) {  // ← ถ้ามีทั้ง URL และ Key ถึงจะสร้าง client
  supabase = createClient(supabaseUrl, supabaseKey);  // ← สร้าง Supabase client
}

// ═══════════════════════════════════════════════════════════════
// 📦 DTOs (Data Transfer Objects) — โครงสร้างข้อมูลที่รับ/ส่ง
// ═══════════════════════════════════════════════════════════════

/**
 * 📦 DTO สำหรับสร้างพนักงานใหม่
 * - employeeId จะถูก auto-generate จาก branchId (เช่น BKK001)
 * - password optional → ถ้าไม่ระบุจะใช้ nationalId เป็นรหัสเริ่มต้น
 */
export interface CreateUserDTO {
  title: Title;                   // ← คำนำหน้าชื่อ: MR (นาย), MRS (นาง), MISS (นางสาว)
  firstName: string;              // ← ชื่อ
  lastName: string;               // ← นามสกุล
  nickname?: string;              // ← ชื่อเล่น (optional)
  gender: Gender;                 // ← เพศ: MALE หรือ FEMALE
  nationalId: string;             // ← เลขบัตรประชาชน 13 หลัก (ใช้เป็น default password)
  emergent_tel: string;           // ← เบอร์โทรฉุกเฉิน
  emergent_first_name: string;    // ← ชื่อผู้ติดต่อฉุกเฉิน
  emergent_last_name: string;     // ← นามสกุลผู้ติดต่อฉุกเฉิน
  emergent_relation: string;      // ← ความสัมพันธ์ (เช่น พ่อ, แม่, คู่สมรส)
  phone: string;                  // ← เบอร์โทรศัพท์
  email: string;                  // ← อีเมล (ต้องไม่ซ้ำ)
  password?: string;              // ← รหัสผ่าน (optional — ถ้าไม่ระบุจะใช้ nationalId)
  birthDate: Date | string;       // ← วันเกิด (Date object หรือ string format)
  branchId: number;               // ← สาขา (บังคับ — ใช้สร้าง employeeId)
  role?: Role;                    // ← role (optional — default = USER)
  status?: UserStatus;            // ← status (optional — default = ACTIVE)
  createdByUserId?: number;       // ← ID ของ Admin/SuperAdmin ที่สร้าง (สำหรับ audit log)
  creatorRole?: string;           // ← role ของผู้สร้าง (ADMIN/SUPERADMIN)
  creatorBranchId?: number;       // ← สาขาของผู้สร้าง (สำหรับตรวจสิทธิ์)
}

/**
 * 📦 DTO สำหรับแก้ไขข้อมูลพนักงาน
 * - ทุก field เป็น optional → ส่งเฉพาะ field ที่ต้องการเปลี่ยน
 * - ถ้าส่ง password → จะ hash ด้วย bcrypt แล้วเขียนทับ
 */
export interface UpdateUserDTO {
  title?: Title;                  // ← คำนำหน้าชื่อ
  firstName?: string;             // ← ชื่อ
  lastName?: string;              // ← นามสกุล
  nickname?: string;              // ← ชื่อเล่น
  gender?: Gender;                // ← เพศ
  nationalId?: string;            // ← เลขบัตรประชาชน
  emergent_tel?: string;          // ← เบอร์โทรฉุกเฉิน
  emergent_first_name?: string;   // ← ชื่อผู้ติดต่อฉุกเฉิน
  emergent_last_name?: string;    // ← นามสกุลผู้ติดต่อฉุกเฉิน
  emergent_relation?: string;     // ← ความสัมพันธ์
  phone?: string;                 // ← เบอร์โทร
  email?: string;                 // ← อีเมล
  password?: string;              // ← รหัสผ่านใหม่ (จะถูก hash ด้วย bcrypt)
  birthDate?: Date | string;      // ← วันเกิด
  branchId?: number;              // ← สาขา (Admin ย้ายสาขาไม่ได้)
  role?: Role;                    // ← role
  status?: UserStatus;            // ← status
  avatarGender?: string;          // ← เพศสำหรับอัปเดต avatar (male/female)
  department?: string;            // ← แผนก
  position?: string;              // ← ตำแหน่ง
  bloodType?: string;             // ← กรุ๊ปเลือด
}

/**
 * 📦 DTO สำหรับ Bulk Import จาก CSV
 * - employeeId จะถูก auto-generate ให้ทุกคน
 * - password optional → ใช้ nationalId เป็น default
 */
export interface BulkCreateUserDTO {
  title: string;                  // ← MR, MRS, MISS (string จาก CSV)
  firstName: string;              // ← ชื่อ
  lastName: string;               // ← นามสกุล
  nickname?: string;              // ← ชื่อเล่น (optional)
  gender: string;                 // ← MALE หรือ FEMALE (string จาก CSV)
  nationalId: string;             // ← เลขบัตรประชาชน
  emergent_tel: string;           // ← เบอร์โทรฉุกเฉิน
  emergent_first_name: string;    // ← ชื่อผู้ติดต่อฉุกเฉิน
  emergent_last_name: string;     // ← นามสกุลผู้ติดต่อฉุกเฉิน
  emergent_relation: string;      // ← ความสัมพันธ์
  phone: string;                  // ← เบอร์โทร
  email: string;                  // ← อีเมล
  password?: string;              // ← รหัสผ่าน (optional)
  birthDate: string;              // ← วันเกิด (string จาก CSV)
  branchId: string | number;      // ← สาขา (string จาก CSV → parse เป็น number)
  role?: string;                  // ← role (optional — default = USER)
}

/**
 * 📦 Interface สำหรับ filter parameters ใน getUsers()
 */
export interface UserFilters {
  branchId?: number;              // ← กรองตามสาขา
  role?: Role;                    // ← กรองตาม role (USER/MANAGER/ADMIN)
  status?: UserStatus;            // ← กรองตาม status (ACTIVE/SUSPENDED/RESIGNED)
  search?: string;                // ← ค้นหาจากชื่อ/email/employeeId
}

// ═══════════════════════════════════════════════════════════════
// 🛠️ Helper Functions — ฟังก์ชันช่วยเหลือภายใน
// ═══════════════════════════════════════════════════════════════

const SALT_ROUNDS = 10;  // ← bcrypt salt rounds (ยิ่งมากยิ่งปลอดภัย แต่ช้าขึ้น)

/**
 * 🔒 Hash password ด้วย bcrypt
 * ใช้กับทุก password ก่อน INSERT/UPDATE ลง database
 */
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);  // ← hash password ด้วย bcrypt (one-way)
}

/**
 * 🔐 ตรวจสอบสิทธิ์ตาม branch (RBAC)
 * - SUPERADMIN: เข้าถึงได้ทุกสาขา → return true เสมอ
 * - ADMIN: เข้าถึงได้เฉพาะสาขาตัวเอง → เทียบ requesterBranchId กับ targetBranchId
 * - อื่นๆ: ไม่มีสิทธิ์ → return false
 */
function canAccessBranch(
  role: string,                                    // ← role ของผู้ร้องขอ (ADMIN/SUPERADMIN)
  requesterBranchId: number | undefined,           // ← สาขาของผู้ร้องขอ
  targetBranchId: number | undefined | null         // ← สาขาของ user เป้าหมาย
): boolean {
  if (role === 'SUPERADMIN') return true;           // ← SuperAdmin เข้าถึงได้ทุกสาขา
  if (role === 'ADMIN') {
    if (!requesterBranchId) return false;            // ← Admin ไม่มี branchId → ไม่ให้เข้า
    if (!targetBranchId) return true;                // ← target ไม่มี branch → legacy data ให้ผ่าน
    return requesterBranchId === targetBranchId;     // ← ต้องเป็นสาขาเดียวกัน
  }
  return false;  // ← role อื่นๆ ไม่มีสิทธิ์
}

/**
 * ✂️ Split full name เป็น firstName + lastName
 * สำหรับ emergency contact names หรือชื่อเต็ม
 */
export function splitName(fullName: string): { firstName: string; lastName: string } {
  if (!fullName) {                                  // ← ชื่อว่าง → return ว่าง
    return { firstName: '', lastName: '' };
  }

  const parts = fullName.trim().split(/\s+/);      // ← แยกด้วย whitespace (1 ตัวขึ้นไป)
  
  if (parts.length === 0) {                         // ← ไม่มีส่วนใด → return ว่าง
    return { firstName: '', lastName: '' };
  }
  
  if (parts.length === 1) {                         // ← มีแค่ชื่อเดียว → เป็น firstName
    return { firstName: parts[0], lastName: '' };
  }
  
  // มีหลายส่วน → ส่วนแรก = firstName, ที่เหลือ = lastName
  const firstName = parts[0];                       // ← คำแรก = ชื่อ
  const lastName = parts.slice(1).join(' ');         // ← คำที่เหลือรวมกัน = นามสกุล
  
  return { firstName, lastName };
}

/**
 * 🔢 Generate Employee ID จาก branchCode + running number
 * Format: {branchCode}{3-digit running number}
 * เช่น BKK001, CNX002, HKT003
 */
async function generateEmployeeId(branchId: number): Promise<string> {
  // ✅ STEP 1: ดึงข้อมูล branch → เอา code มาใช้
  // ═════════════════════════════════════════════
  const branch = await prisma.branch.findUnique({
    where: { branchId },          // ← ค้นหา branch จาก branchId
    select: { code: true },       // ← เลือกเฉพาะ code (เช่น BKK, CNX, HKT)
  });

  if (!branch) {                   // ← ไม่พบ branch → throw error
    throw new Error('ไม่พบสาขาที่ระบุ');
  }

  const branchCode = branch.code.toUpperCase();  // ← แปลง code เป็นตัวพิมพ์ใหญ่

  // ✅ STEP 2: นับจำนวน user ในสาขานั้น
  // ═════════════════════════════════════
  const userCount = await prisma.user.count({
    where: { branchId },          // ← นับเฉพาะ user ในสาขานี้
  });

  // ✅ STEP 3: สร้าง running number (userCount + 1, pad 3 หลัก)
  // ═══════════════════════════════════════════════════════════
  const runningNumber = (userCount + 1).toString().padStart(3, '0');  // ← 1 → "001", 10 → "010"

  // ✅ STEP 4: รวมเป็น employeeId
  // ══════════════════════════════
  const employeeId = `${branchCode}${runningNumber}`;  // ← เช่น BKK001, CNX002

  // ✅ STEP 5: ตรวจสอบว่า employeeId ซ้ำหรือไม่ (edge case)
  // ═══════════════════════════════════════════════════════
  const existing = await prisma.user.findUnique({
    where: { employeeId },        // ← เช็คว่ามี employeeId นี้แล้วหรือยัง
  });

  if (existing) {  // ← ถ้าซ้ำ → หา max employeeId ในสาขานั้นแล้ว + 1
    const maxUser = await prisma.user.findFirst({
      where: {
        employeeId: { startsWith: branchCode },  // ← ค้นหาเฉพาะ employeeId ที่ขึ้นต้นด้วย branchCode
      },
      orderBy: { employeeId: 'desc' },           // ← เรียงจากมากไปน้อย
      select: { employeeId: true },              // ← เลือกเฉพาะ employeeId
    });

    if (maxUser) {
      const maxNumber = parseInt(maxUser.employeeId.replace(branchCode, ''), 10);  // ← ดึงตัวเลขออก
      return `${branchCode}${(maxNumber + 1).toString().padStart(3, '0')}`;        // ← +1 แล้ว pad 3 หลัก
    }
  }

  return employeeId;  // ← ส่ง employeeId ที่สร้างได้
}

/**
 * 📷 ดึง Avatar URL จาก Supabase Storage
 * - ลอง .jpg ก่อน → ถ้าไม่พบลอง .png
 * - ถ้าไม่พบทั้งคู่ → return null (ใช้ fallback ui-avatars.com)
 */
export async function getAvatarUrl(employeeId: string): Promise<string | null> {
  if (!supabase) return null;  // ← ไม่มี Supabase client → return null
  
  try {
    const fileName = `avatars/${employeeId}.jpg`;  // ← ลอง .jpg ก่อน
    const { data } = supabase.storage.from(bucketName).getPublicUrl(fileName);  // ← สร้าง public URL
    
    // ตรวจว่าไฟล์มีจริงหรือไม่ (download เพื่อเช็ค)
    const { data: fileData, error } = await supabase.storage
      .from(bucketName)
      .download(fileName);  // ← ลอง download .jpg
    
    if (error || !fileData) {  // ← .jpg ไม่พบ → ลอง .png
      const pngFileName = `avatars/${employeeId}.png`;  // ← เปลี่ยนเป็น .png
      const { data: pngFileData, error: pngError } = await supabase.storage
        .from(bucketName)
        .download(pngFileName);  // ← ลอง download .png
      
      if (!pngError && pngFileData) {  // ← พบ .png
        const { data: pngData } = supabase.storage.from(bucketName).getPublicUrl(pngFileName);
        return pngData.publicUrl;  // ← return URL ของ .png
      }
      
      return null;  // ← ไม่พบทั้ง .jpg และ .png → return null
    }
    
    return data.publicUrl;  // ← พบ .jpg → return URL ของ .jpg
  } catch (error) {
    console.error('Error getting avatar URL:', error);  // ← log error
    return null;  // ← เกิดข้อผิดพลาด → return null (ใช้ fallback)
  }
}

/**
 * 🖼️ Format user object พร้อม avatar URL
 * - ถ้ามี avatarUrl อยู่แล้ว → ใช้เลย
 * - ถ้าไม่มี → ลองดึงจาก Supabase Storage
 * - ถ้าไม่พบใน Storage → ใช้ fallback ui-avatars.com
 */
async function formatUserWithAvatar(user: any): Promise<any> {
  if (user.avatarUrl) {  // ← มี avatarUrl อยู่แล้ว → return เลย
    return user;
  }
  
  const avatarUrl = await getAvatarUrl(user.employeeId);  // ← ลองดึงจาก Supabase Storage
  
  return {
    ...user,
    avatarUrl: avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.firstName + ' ' + user.lastName)}&background=random&size=200`,  // ← fallback: สร้าง avatar จากชื่อ
  };
}

/**
 * 🖼️ Format หลาย users พร้อม avatar URLs
 * ใช้ Promise.all เพื่อ parallel processing
 */
async function formatUsersWithAvatars(users: any[]): Promise<any[]> {
  return Promise.all(users.map(formatUserWithAvatar));  // ← format ทุก user พร้อมกัน (parallel)
}

// ═══════════════════════════════════════════════════════════════
// 📋 Main Functions - CRUD Operations
// ═══════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════
// 1️⃣ CREATE USER - สร้างพนักงานใหม่
// ═══════════════════════════════════════════════════════════════
/**
 * ➕ สร้างพนักงานใหม่
 *
 * ขั้นตอนทั้งหมด:
 * 1. ตรวจ branchId มีอยู่จริง
 * 2. Auto-generate employeeId จาก branchCode + running number
 * 3. ตรวจสิทธิ์: Admin สร้างได้เฉพาะสาขาตัวเอง, SuperAdmin สร้างได้ทุกสาขา
 * 4. ตรวจ email/nationalId ซ้ำ
 * 5. Hash รหัสเริ่มต้น → ถ้าไม่ได้ระบุ password จะใช้ nationalId เป็นรหัสเริ่มต้น
 *    Supabase จะเห็น bcrypt hash ทุก row — ไม่มี plain text หรือ null
 *    พนักงาน login ด้วย nationalId ได้ทันที, เปลี่ยนรหัสแล้ว nationalId ใช้ไม่ได้อีก
 * 6. Upload avatar อัตโนมัติตามเพศ ไป Supabase Storage
 * 7. บันทึก Audit Log
 * 8. Return ข้อมูล user โดยไม่มี password field
 */
export const createUser = async (data: CreateUserDTO) => {
  // ✅ STEP 1: ตรวจสอบ branchId (บังคับสำหรับสร้าง employeeId)
  // ═══════════════════════════════════════════════════════════
  if (!data.branchId) {  // ← ไม่มี branchId → ไม่สามารถสร้าง employeeId ได้
    throw new Error('กรุณาระบุสาขา (branchId) เพื่อสร้างรหัสพนักงาน');
  }

  // ✅ STEP 2: ตรวจสอบ branch มีอยู่จริง
  // ═════════════════════════════════════
  const branch = await prisma.branch.findUnique({
    where: { branchId: data.branchId },  // ← ค้นหา branch จาก branchId
  });
  if (!branch) {  // ← ไม่พบ branch → throw error
    throw new Error('ไม่พบสาขาที่ระบุ');
  }

  // ✅ STEP 3: Auto-generate employeeId จาก branchCode + running number
  // ═══════════════════════════════════════════════════════════════════
  const employeeId = await generateEmployeeId(data.branchId);  // ← เช่น B00KK1, CNX002

  // ✅ STEP 4: ตรวจสอบ email และ nationalId ซ้ำ
  // ═════════════════════════════════════════════
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { email: data.email },        // ← เช็ค email ซ้ำ
        { nationalId: data.nationalId },  // ← เช็ค nationalId ซ้ำ
      ],
    },
  });

  if (existingUser) {
    if (existingUser.email === data.email) {  // ← email ซ้ำ
      throw new Error('อีเมลนี้มีอยู่ในระบบแล้ว');
    }
    if (existingUser.nationalId === data.nationalId) {  // ← nationalId ซ้ำ
      throw new Error('เลขบัตรประชาชนนี้มีอยู่ในระบบแล้ว');
    }
  }

  // ✅ STEP 5: ตรวจสอบสิทธิ์ (Admin สร้างได้เฉพาะสาขาตัวเอง)
  // ═══════════════════════════════════════════════════════════
  if (data.creatorRole === 'ADMIN' && data.branchId) {
    if (!canAccessBranch(data.creatorRole, data.creatorBranchId, data.branchId)) {
      throw new Error('คุณไม่มีสิทธิ์สร้างผู้ใช้ในสาขาอื่น');  // ← Admin ข้ามสาขาไม่ได้
    }
  }

  // ✅ STEP 6: Hash รหัสเริ่มต้น → ใช้ nationalId ถ้าไม่ได้ระบุ password
  // ═══════════════════════════════════════════════════════════════════
  // พนักงานจะ login ด้วย nationalId ได้ทันที (bcrypt.compare ทำงานถูกต้อง)
  // ถ้าเปลี่ยนรหัสภายหลัง hash ใหม่จะ overwrite ค่านี้
  const hashedPassword = await hashPassword(data.password ?? data.nationalId);  // ← hash ด้วย bcrypt (salt rounds 10)

  // ✅ STEP 7: Upload avatar ไปยัง Supabase Storage
  // ════════════════════════════════════════════════
  // fallback เป็น ui-avatars.com ถ้า upload ล้มเหลว
  let avatarUrl: string | null = null;  // ← URL ของ avatar
  try {
    const avatarGender = data.gender === 'FEMALE' ? 'female' : 'male';  // ← กำหนดเพศสำหรับ avatar
    avatarUrl = await uploadAvatarToSupabase(employeeId, avatarGender);   // ← upload ไป Supabase
  } catch (error) {
    console.error('Failed to upload avatar:', error);  // ← log error
    // ใช้ fallback avatar จาก ui-avatars.com
    avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(data.firstName + ' ' + data.lastName)}&background=random&size=200`;
  }

  // ✅ STEP 8: Parse birthDate (string → Date object)
  // ═════════════════════════════════════════════════
  let birthDate: Date | null = null;  // ← วันเกิด (อาจเป็น null)
  if (data.birthDate) {
    birthDate = typeof data.birthDate === 'string'  // ← ถ้าเป็น string ให้แปลงเป็น Date
      ? new Date(data.birthDate) 
      : data.birthDate;
  }

  // ✅ STEP 9: INSERT พนักงานใหม่ลง database
  // ═════════════════════════════════════════
  const user = await prisma.user.create({
    data: {
      employeeId,                                    // ← auto-generated (เช่น BKK001)
      title: data.title,                             // ← คำนำหน้าชื่อ (MR/MRS/MISS)
      firstName: data.firstName,                     // ← ชื่อ
      lastName: data.lastName,                       // ← นามสกุล
      nickname: data.nickname || null,               // ← ชื่อเล่น (optional)
      gender: data.gender,                           // ← เพศ (MALE/FEMALE)
      nationalId: data.nationalId,                   // ← เลขบัตรประชาชน
      emergent_tel: data.emergent_tel,               // ← เบอร์โทรฉุกเฉิน
      emergent_first_name: data.emergent_first_name, // ← ชื่อผู้ติดต่อฉุกเฉิน
      emergent_last_name: data.emergent_last_name,   // ← นามสกุลผู้ติดต่อฉุกเฉิน
      emergent_relation: data.emergent_relation,     // ← ความสัมพันธ์
      phone: data.phone,                             // ← เบอร์โทร
      email: data.email,                             // ← อีเมล
      password: hashedPassword,                      // ← bcrypt hash ของ password/nationalId
      avatarUrl,                                     // ← URL รูปโปรไฟล์ (Supabase หรือ fallback)
      birthDate,                                     // ← วันเกิด
      branchId: data.branchId,                       // ← สาขา
      role: data.role || 'USER',                     // ← role (default = USER)
      status: data.status || 'ACTIVE',               // ← status (default = ACTIVE)
    },
    include: {
      branch: {
        select: {
          branchId: true,   // ← ID สาขา
          name: true,       // ← ชื่อสาขา
          code: true,       // ← รหัสสาขา (BKK, CNX, etc.)
        },
      },
    },
  });

  // ✅ STEP 10: บันทึก Audit Log (ใครสร้างใคร)
  // ═══════════════════════════════════════════
  if (data.createdByUserId) {  // ← มี createdByUserId → บันทึก audit log
    await createAuditLog({
      userId: data.createdByUserId,           // ← Admin/SuperAdmin ที่สร้าง
      action: AuditAction.CREATE_USER,        // ← action = CREATE_USER
      targetTable: 'users',                   // ← ตาราง
      targetId: user.userId,                  // ← ID ของ user ที่สร้าง
      newValues: {
        employeeId: user.employeeId,          // ← รหัสพนักงาน
        title: user.title,                    // ← คำนำหน้า
        firstName: user.firstName,            // ← ชื่อ
        lastName: user.lastName,              // ← นามสกุล
        email: user.email,                    // ← อีเมล
        gender: user.gender,                  // ← เพศ
        role: user.role,                      // ← role
        branchId: user.branchId,              // ← สาขา
      },
    });
  }

  // ✅ Return ข้อมูลพนักงาน (ลบ password ออกเพื่อความปลอดภัย)
  const { password: _, ...userWithoutPassword } = user;  // ← destructure เอา password ออก
  return userWithoutPassword;  // ← return ข้อมูล user โดยไม่มี password
};

// ═══════════════════════════════════════════════════════════════
// 2️⃣ GET USERS - ดึงรายชื่อพนักงาน (filter, search, pagination)
// ═══════════════════════════════════════════════════════════════
/**
 * 📋 ดึงผู้ใช้ทั้งหมด (ตาม role และ branch)
 * - SUPERADMIN: ดูทุกสาขา + กรองตาม branchId ได้
 * - ADMIN: ดูเฉพาะสาขาตัวเอง (lock branchId อัตโนมัติ)
 * - USER: ดูได้เฉพาะข้อมูลตัวเอง
 */
export const getUsers = async (
  requesterId: number,              // ← ID ของผู้ร้องขอ
  requesterRole: string,            // ← role ของผู้ร้องขอ (ADMIN/SUPERADMIN/USER)
  requesterBranchId?: number,       // ← สาขาของผู้ร้องขอ
  filters?: UserFilters,            // ← ตัวกรอง (branchId, role, status, search)
  page: number = 1,                 // ← หน้าที่ต้องการ (default = 1)
  limit: number = 20                // ← จำนวนต่อหน้า (default = 20)
) => {
  // ✅ STEP 1: สร้าง WHERE clause ตาม RBAC
  // ═══════════════════════════════════════
  const where: any = {};

  // RBAC: กรองตาม branch ตาม role ของผู้ร้องขอ
  if (requesterRole === 'ADMIN' && requesterBranchId) {
    where.branchId = requesterBranchId;  // ← Admin ดูได้เฉพาะสาขาตัวเอง (lock)
  } else if (requesterRole === 'USER') {
    where.userId = requesterId;  // ← User ดูได้เฉพาะตัวเอง
  }
  // SUPERADMIN ไม่ต้อง lock → ดูทั้งระบบ

  // ✅ STEP 2: เพิ่มตัวกรอง (ถ้ามี)
  // ═════════════════════════════════
  if (filters?.branchId && requesterRole === 'SUPERADMIN') {
    where.branchId = filters.branchId;  // ← SuperAdmin กรองตามสาขาที่เลือก
  }
  if (filters?.role) {
    where.role = filters.role;  // ← กรองตาม role (USER/MANAGER/ADMIN)
  }
  if (filters?.status) {
    where.status = filters.status;  // ← กรองตาม status (ACTIVE/SUSPENDED/RESIGNED)
  }
  if (filters?.search) {  // ← ค้นหาจากหลาย field พร้อมกัน (OR condition)
    where.OR = [
      { firstName: { contains: filters.search, mode: 'insensitive' } },   // ← ค้นหาชื่อ
      { lastName: { contains: filters.search, mode: 'insensitive' } },    // ← ค้นหานามสกุล
      { employeeId: { contains: filters.search, mode: 'insensitive' } },  // ← ค้นหารหัสพนักงาน
      { email: { contains: filters.search, mode: 'insensitive' } },       // ← ค้นหาอีเมล
      { nickname: { contains: filters.search, mode: 'insensitive' } },    // ← ค้นหาชื่อเล่น
    ];
  }

  // ✅ STEP 3: นับจำนวนทั้งหมด (สำหรับ pagination)
  // ════════════════════════════════════════════════
  const total = await prisma.user.count({ where });  // ← COUNT(*) WHERE ...

  // ✅ STEP 4: SELECT ข้อมูลพนักงาน (มี pagination)
  // ════════════════════════════════════════════════
  const users = await prisma.user.findMany({
    where,                          // ← ใช้ WHERE clause ที่สร้างไว้
    select: {
      userId: true,                 // ← ID ของพนักงาน
      employeeId: true,             // ← รหัสพนักงาน
      firstName: true,              // ← ชื่อ
      lastName: true,               // ← นามสกุล
      nickname: true,               // ← ชื่อเล่น
      nationalId: true,             // ← เลขบัตรประชาชน
      emergent_tel: true,           // ← เบอร์โทรฉุกเฉิน
      emergent_first_name: true,    // ← ชื่อผู้ติดต่อฉุกเฉิน
      emergent_last_name: true,     // ← นามสกุลผู้ติดต่อฉุกเฉิน
      emergent_relation: true,      // ← ความสัมพันธ์
      phone: true,                  // ← เบอร์โทร
      email: true,                  // ← อีเมล
      avatarUrl: true,              // ← URL รูปโปรไฟล์
      birthDate: true,              // ← วันเกิด
      department: true,             // ← แผนก
      position: true,               // ← ตำแหน่ง
      bloodType: true,              // ← กรุ๊ปเลือด
      branchId: true,               // ← สาขา
      role: true,                   // ← role
      status: true,                 // ← status
      createdAt: true,              // ← วันที่สร้าง
      updatedAt: true,              // ← วันที่อัปเดตล่าสุด
      branch: {                     // ← JOIN กับ branches table
        select: {
          branchId: true,           // ← ID สาขา
          name: true,               // ← ชื่อสาขา
          code: true,               // ← รหัสสาขา
        },
      },
      // ⚠️ password ไม่ดึง (ปลอดภัย)
    },
    orderBy: requesterRole === 'SUPERADMIN'
      ? [{ branchId: 'asc' as const }, { employeeId: 'asc' as const }]  // ← SuperAdmin: เรียงตามสาขา → empId
      : [{ employeeId: 'asc' as const }],                                // ← อื่นๆ: เรียงตาม empId
    skip: (page - 1) * limit,      // ← ข้ามกี่ row (pagination offset)
    take: limit,                    // ← เอากี่ row (pagination limit)
  });

  // ✅ STEP 5: Format avatar URLs สำหรับทุก user
  // ══════════════════════════════════════════════
  const formattedUsers = await formatUsersWithAvatars(users);  // ← เพิ่ม avatar URL ให้ทุก user

  // ✅ STEP 6: Return ข้อมูล + pagination info
  // ═══════════════════════════════════════════
  return {
    users: formattedUsers,                          // ← รายชื่อพนักงาน
    pagination: {
      page,                                         // ← หน้าปัจจุบัน
      limit,                                        // ← จำนวนต่อหน้า
      total,                                        // ← จำนวนทั้งหมด
      totalPages: Math.ceil(total / limit),          // ← จำนวนหน้าทั้งหมด
    },
  };
};

// ═══════════════════════════════════════════════════════════════
// 3️⃣ GET USER BY ID - ดึงพนักงานตาม ID
// ═══════════════════════════════════════════════════════════════
/**
 * 📋 ดึงผู้ใช้ตาม ID (มี RBAC ตรวจสิทธิ์)
 * - SUPERADMIN: ดูได้ทุกคน
 * - ADMIN: ดูได้เฉพาะคนในสาขาตัวเอง
 * - USER: ดูได้เฉพาะตัวเอง
 */
export const getUserById = async (
  userId: number,                   // ← ID ของ user ที่ต้องการดู
  requesterId?: number,             // ← ID ของผู้ร้องขอ (optional)
  requesterRole?: string,           // ← role ของผู้ร้องขอ (optional)
  requesterBranchId?: number        // ← สาขาของผู้ร้องขอ (optional)
) => {
  // ✅ STEP 1: ดึงข้อมูล user จาก database
  // ═══════════════════════════════════════
  const user = await prisma.user.findUnique({
    where: { userId },              // ← ค้นหาจาก userId (PK)
    select: {
      userId: true,                 // ← ID ของพนักงาน
      employeeId: true,             // ← รหัสพนักงาน
      firstName: true,              // ← ชื่อ
      lastName: true,               // ← นามสกุล
      nickname: true,               // ← ชื่อเล่น
      nationalId: true,             // ← เลขบัตรประชาชน
      emergent_tel: true,           // ← เบอร์โทรฉุกเฉิน
      emergent_first_name: true,    // ← ชื่อผู้ติดต่อฉุกเฉิน
      emergent_last_name: true,     // ← นามสกุลผู้ติดต่อฉุกเฉิน
      emergent_relation: true,      // ← ความสัมพันธ์
      phone: true,                  // ← เบอร์โทร
      email: true,                  // ← อีเมล
      avatarUrl: true,              // ← URL รูปโปรไฟล์
      birthDate: true,              // ← วันเกิด
      department: true,             // ← แผนก
      position: true,               // ← ตำแหน่ง
      bloodType: true,              // ← กรุ๊ปเลือด
      branchId: true,               // ← สาขา
      role: true,                   // ← role
      status: true,                 // ← status
      createdAt: true,              // ← วันที่สร้าง
      updatedAt: true,              // ← วันที่อัปเดตล่าสุด
      branch: {                     // ← JOIN กับ branches table
        select: {
          branchId: true,           // ← ID สาขา
          name: true,               // ← ชื่อสาขา
          code: true,               // ← รหัสสาขา
        },
      },
      // ⚠️ password ไม่ดึง (ปลอดภัย)
    },
  });

  if (!user) {  // ← ไม่พบ user
    throw new Error('ไม่พบผู้ใช้');
  }

  // ✅ STEP 2: ตรวจสอบสิทธิ์ RBAC
  // ═══════════════════════════════
  if (requesterRole && requesterRole !== 'SUPERADMIN') {
    if (requesterRole === 'ADMIN' && !canAccessBranch('ADMIN', requesterBranchId, user.branchId)) {
      throw new Error('คุณไม่มีสิทธิ์ดูข้อมูลผู้ใช้สาขาอื่น');  // ← Admin ข้ามสาขาไม่ได้
    }
    if (requesterRole === 'USER' && requesterId !== userId) {
      throw new Error('คุณไม่มีสิทธิ์ดูข้อมูลผู้ใช้คนอื่น');  // ← User ดูได้แค่ตัวเอง
    }
  }

  // ✅ Return ข้อมูล user พร้อม avatar
  return formatUserWithAvatar(user);  // ← format avatar URL ก่อน return
};

// ═══════════════════════════════════════════════════════════════
// 4️⃣ UPDATE USER - แก้ไขข้อมูลพนักงาน
// ═══════════════════════════════════════════════════════════════
/**
 * 🔄 อัปเดตข้อมูลพนักงาน
 *
 * ขั้นตอน:
 * 1. ตรวจสิทธิ์สาขา: Admin แก้ได้เฉพาะคนในสาขาตัวเอง, SuperAdmin แก้ได้ทุกคน
 * 2. ตรวจ email/nationalId ซ้ำ (ถ้ามีการเปลี่ยน)
 * 3. ถ้า Admin ย้าย branchId ไม่ได้ (ต้องเป็นสาขาเดียวกัน)
 * 4. ถ้ามี field `password` ใน body → reset รหัสผ่านทันที (hash bcrypt เก็บใน password column)
 * 5. บันทึก Audit Log
 */
export const updateUser = async (
  userId: number,                               // ← ID ของพนักงานที่จะแก้
  updatedByUserId: number,                      // ← ID ของ Admin/SuperAdmin ที่แก้
  updaterRole: string,                          // ← role ของผู้แก้ (ADMIN/SUPERADMIN)
  updaterBranchId: number | undefined,          // ← สาขาของผู้แก้
  data: UpdateUserDTO                           // ← ข้อมูลที่ต้องการแก้ (เฉพาะ field ที่ส่งมา)
) => {
  // ✅ STEP 1: ดึงข้อมูล user เดิม (สำหรับ RBAC + audit log)
  // ═══════════════════════════════════════════════════════════
  const existingUser = await prisma.user.findUnique({
    where: { userId },  // ← ค้นหา user จาก userId
  });

  if (!existingUser) {  // ← ไม่พบ user
    throw new Error('ไม่พบผู้ใช้');
  }

  // ✅ STEP 2: ตรวจสิทธิ์สาขา (RBAC)
  // ═══════════════════════════════════
  // Admin แก้ได้เฉพาะคนในสาขาตัวเอง, SuperAdmin แก้ได้ทุกคน
  if (!canAccessBranch(updaterRole, updaterBranchId, existingUser.branchId)) {
    throw new Error('คุณไม่มีสิทธิ์แก้ไขข้อมูลผู้ใช้สาขาอื่น');  // ← Admin ข้ามสาขาไม่ได้
  }

  // ✅ STEP 3: ตรวจ email/nationalId ซ้ำ (เฉพาะกรณีมีการเปลี่ยน)
  // ═══════════════════════════════════════════════════════════════
  if (data.email && data.email !== existingUser.email) {  // ← email เปลี่ยน → เช็คซ้ำ
    const emailExists = await prisma.user.findUnique({
      where: { email: data.email },  // ← หา email ในระบบ
    });
    if (emailExists) {
      throw new Error('อีเมลนี้มีอยู่ในระบบแล้ว');  // ← email ซ้ำ
    }
  }

  if (data.nationalId && data.nationalId !== existingUser.nationalId) {  // ← nationalId เปลี่ยน → เช็คซ้ำ
    const nationalIdExists = await prisma.user.findUnique({
      where: { nationalId: data.nationalId },  // ← หา nationalId ในระบบ
    });
    if (nationalIdExists) {
      throw new Error('เลขบัตรประชาชนนี้มีอยู่ในระบบแล้ว');  // ← nationalId ซ้ำ
    }
  }

  // ✅ STEP 4: ตรวจ branch ใหม่ (ถ้ามีการย้ายสาขา)
  // ════════════════════════════════════════════════
  if (data.branchId) {
    const branch = await prisma.branch.findUnique({
      where: { branchId: data.branchId },  // ← ตรวจว่า branch ใหม่มีอยู่จริง
    });
    if (!branch) {
      throw new Error('ไม่พบสาขาที่ระบุ');  // ← branch ไม่พบ
    }
    // Admin ไม่สามารถย้ายคนไปสาขาอื่นได้
    if (updaterRole === 'ADMIN' && data.branchId !== updaterBranchId) {
      throw new Error('คุณไม่มีสิทธิ์ย้ายผู้ใช้ไปสาขาอื่น');  // ← Admin ย้ายสาขาไม่ได้
    }
  }

  // ✅ STEP 5: เตรียมข้อมูลอัปเดต (เฉพาะ field ที่ส่งมา)
  // ═══════════════════════════════════════════════════════
  // undefined = ไม่เปลี่ยน — ส่งเฉพาะ field ที่ต้องการ update
  const updateData: any = {};

  if (data.firstName !== undefined) updateData.firstName = data.firstName;              // ← อัปเดตชื่อ
  if (data.lastName !== undefined) updateData.lastName = data.lastName;                // ← อัปเดตนามสกุล
  if (data.nickname !== undefined) updateData.nickname = data.nickname;                // ← อัปเดตชื่อเล่น
  if (data.nationalId !== undefined) updateData.nationalId = data.nationalId;          // ← อัปเดตเลขบัตร
  if (data.emergent_tel !== undefined) updateData.emergent_tel = data.emergent_tel;    // ← อัปเดตเบอร์ฉุกเฉิน
  if (data.emergent_first_name !== undefined) updateData.emergent_first_name = data.emergent_first_name;  // ← อัปเดตชื่อฉุกเฉิน
  if (data.emergent_last_name !== undefined) updateData.emergent_last_name = data.emergent_last_name;    // ← อัปเดตนามสกุลฉุกเฉิน
  if (data.emergent_relation !== undefined) updateData.emergent_relation = data.emergent_relation;        // ← อัปเดตความสัมพันธ์
  if (data.phone !== undefined) updateData.phone = data.phone;                        // ← อัปเดตเบอร์โทร
  if (data.email !== undefined) updateData.email = data.email;                        // ← อัปเดตอีเมล
  if (data.branchId !== undefined) updateData.branchId = data.branchId;               // ← อัปเดตสาขา
  if (data.role !== undefined) updateData.role = data.role;                           // ← อัปเดต role
  if (data.status !== undefined) updateData.status = data.status;                     // ← อัปเดต status
  if (data.department !== undefined) updateData.department = data.department || null;  // ← อัปเดตแผนก (หรือ null)
  if (data.position !== undefined) updateData.position = data.position || null;       // ← อัปเดตตำแหน่ง (หรือ null)
  if (data.bloodType !== undefined) updateData.bloodType = data.bloodType || null;    // ← อัปเดตกรุ๊ปเลือด (หรือ null)

  // Admin reset password: hash ด้วย bcrypt แล้วบันทึกใน password column
  if (data.password) {
    updateData.password = await hashPassword(data.password);  // ← hash รหัสใหม่ด้วย bcrypt
  }

  // Parse birthDate (string → Date)
  if (data.birthDate !== undefined) {
    updateData.birthDate = data.birthDate 
      ? (typeof data.birthDate === 'string' ? new Date(data.birthDate) : data.birthDate)  // ← แปลง string → Date
      : null;  // ← null = ลบวันเกิด
  }

  // อัปเดต avatar ถ้า gender เปลี่ยน
  if (data.avatarGender) {
    try {
      const avatarGender = data.avatarGender.toLowerCase() === 'female' ? 'female' : 'male';  // ← กำหนดเพศ
      updateData.avatarUrl = await uploadAvatarToSupabase(
        existingUser.employeeId,  // ← ใช้ employeeId เดิมเป็นชื่อไฟล์
        avatarGender              // ← เพศสำหรับเลือก avatar
      );
    } catch (error) {
      console.error('Failed to update avatar:', error);  // ← log error (ไม่ throw — ให้ update ต่อได้)
    }
  }

  // ✅ STEP 6: UPDATE ลง database
  // ═══════════════════════════════
  const updatedUser = await prisma.user.update({
    where: { userId },              // ← ค้นหา user จาก userId
    data: updateData,               // ← อัปเดตเฉพาะ field ที่เตรียมไว้
    select: {
      userId: true,                 // ← ID ของพนักงาน
      employeeId: true,             // ← รหัสพนักงาน
      firstName: true,              // ← ชื่อ
      lastName: true,               // ← นามสกุล
      nickname: true,               // ← ชื่อเล่น
      nationalId: true,             // ← เลขบัตรประชาชน
      emergent_tel: true,           // ← เบอร์โทรฉุกเฉิน
      emergent_first_name: true,    // ← ชื่อผู้ติดต่อฉุกเฉิน
      emergent_last_name: true,     // ← นามสกุลผู้ติดต่อฉุกเฉิน
      emergent_relation: true,      // ← ความสัมพันธ์
      phone: true,                  // ← เบอร์โทร
      email: true,                  // ← อีเมล
      avatarUrl: true,              // ← URL รูปโปรไฟล์
      birthDate: true,              // ← วันเกิด
      department: true,             // ← แผนก
      position: true,               // ← ตำแหน่ง
      bloodType: true,              // ← กรุ๊ปเลือด
      branchId: true,               // ← สาขา
      role: true,                   // ← role
      status: true,                 // ← status
      createdAt: true,              // ← วันที่สร้าง
      updatedAt: true,              // ← วันที่อัปเดตล่าสุด
      branch: {                     // ← JOIN กับ branches table
        select: {
          branchId: true,           // ← ID สาขา
          name: true,               // ← ชื่อสาขา
          code: true,               // ← รหัสสาขา
        },
      },
      // ⚠️ password ไม่ดึง (ปลอดภัย)
    },
  });

  // ✅ STEP 7: บันทึก Audit Log (ใครแก้ใคร เปลี่ยนอะไร)
  // ═══════════════════════════════════════════════════════
  await createAuditLog({
    userId: updatedByUserId,                  // ← Admin/SuperAdmin ที่แก้
    action: AuditAction.UPDATE_USER,          // ← action = UPDATE_USER
    targetTable: 'users',                     // ← ตาราง
    targetId: userId,                         // ← ID ของ user ที่ถูกแก้
    oldValues: {                              // ← ค่าเก่า (ก่อนแก้)
      firstName: existingUser.firstName,      // ← ชื่อเก่า
      lastName: existingUser.lastName,        // ← นามสกุลเก่า
      email: existingUser.email,              // ← อีเมลเก่า
      role: existingUser.role,                // ← role เก่า
      status: existingUser.status,            // ← status เก่า
      branchId: existingUser.branchId,        // ← สาขาเก่า
    },
    newValues: {                              // ← ค่าใหม่ (หลังแก้)
      firstName: updatedUser.firstName,       // ← ชื่อใหม่
      lastName: updatedUser.lastName,         // ← นามสกุลใหม่
      email: updatedUser.email,               // ← อีเมลใหม่
      role: updatedUser.role,                 // ← role ใหม่
      status: updatedUser.status,             // ← status ใหม่
      branchId: updatedUser.branchId,         // ← สาขาใหม่
    },
  });

  return formatUserWithAvatar(updatedUser);  // ← return ข้อมูล user พร้อม avatar URL
};

// ═══════════════════════════════════════════════════════════════
// 5️⃣ DELETE USER - ลบพนักงาน (Soft Delete → status = RESIGNED)
// ═══════════════════════════════════════════════════════════════
/**
 * 🗑️ ลบผู้ใช้ (เปลี่ยน status เป็น RESIGNED — ไม่ลบจริง)
 * - ตรวจสิทธิ์สาขา + ป้องกันลบตัวเอง + ป้องกันลบ SuperAdmin
 */
export const deleteUser = async (
  userId: number,                   // ← ID ของพนักงานที่จะลบ
  deletedByUserId: number,          // ← ID ของ Admin/SuperAdmin ที่ลบ
  deleterRole: string,              // ← role ของผู้ลบ (ADMIN/SUPERADMIN)
  deleterBranchId: number | undefined,  // ← สาขาของผู้ลบ
  deleteReason: string              // ← เหตุผลการลบ (เช่น ลาออก, เลิกจ้าง)
) => {
  // ✅ STEP 1: ดึงข้อมูล user ที่จะลบ
  // ═══════════════════════════════════
  const existingUser = await prisma.user.findUnique({
    where: { userId },  // ← ค้นหา user จาก userId
  });

  if (!existingUser) {  // ← ไม่พบ user
    throw new Error('ไม่พบผู้ใช้');
  }

  // ✅ STEP 2: ตรวจสอบสิทธิ์สาขา (RBAC)
  // ═════════════════════════════════════
  if (!canAccessBranch(deleterRole, deleterBranchId, existingUser.branchId)) {
    throw new Error('คุณไม่มีสิทธิ์ลบผู้ใช้สาขาอื่น');  // ← Admin ข้ามสาขาไม่ได้
  }

  // ✅ STEP 3: ป้องกัน self-deletion (ลบตัวเอง)
  // ═════════════════════════════════════════════
  if (userId === deletedByUserId) {
    throw new Error('ไม่สามารถลบตัวเองได้');  // ← ห้ามลบตัวเอง
  }

  // ✅ STEP 4: ป้องกันลบ SuperAdmin (ถ้าไม่ใช่ SuperAdmin)
  // ═══════════════════════════════════════════════════════
  if (existingUser.role === 'SUPERADMIN' && deleterRole !== 'SUPERADMIN') {
    throw new Error('ไม่มีสิทธิ์ลบ SuperAdmin');  // ← เฉพาะ SuperAdmin ลบ SuperAdmin ได้
  }

  // ✅ STEP 5: UPDATE status เป็น RESIGNED (soft delete)
  // ═══════════════════════════════════════════════════
  const deletedUser = await prisma.user.update({
    where: { userId },              // ← ค้นหา user จาก userId
    data: {
      status: 'RESIGNED',           // ← เปลี่ยน status เป็น RESIGNED (ไม่ลบจริง)
    },
  });

  // ✅ STEP 6: บันทึก Audit Log (ใครลบใคร + เหตุผล)
  // ═════════════════════════════════════════════════
  await createAuditLog({
    userId: deletedByUserId,                              // ← Admin/SuperAdmin ที่ลบ
    action: AuditAction.DELETE_USER,                      // ← action = DELETE_USER
    targetTable: 'users',                                 // ← ตาราง
    targetId: userId,                                     // ← ID ของ user ที่ถูกลบ
    oldValues: {
      status: existingUser.status,                        // ← status เดิม
    },
    newValues: {
      status: 'RESIGNED',                                 // ← status ใหม่
      deleteReason,                                        // ← เหตุผล
    },
  });

  // ✅ Return ข้อมูล user ที่ลบแล้ว + เหตุผล
  return { userId, status: 'RESIGNED', deleteReason };  // ← return status + reason
};

// ═══════════════════════════════════════════════════════════════
// 6️⃣ BULK IMPORT - Import หลายคนจาก CSV พร้อมกัน
// ═══════════════════════════════════════════════════════════════

/**
 * 📤 Interface สำหรับผลลัพธ์ Bulk Import
 */
export interface BulkImportResult {
  success: number;           // ← จำนวนที่สร้างสำเร็จ
  failed: number;            // ← จำนวนที่สร้างไม่สำเร็จ
  errors: Array<{
    row: number;             // ← แถวที่ error (1-based, +1 สำหรับ header)
    employeeId?: string;     // ← employeeId (ถ้ามี)
    error: string;           // ← ข้อความ error
  }>;
  createdUsers: Array<{
    userId: number;          // ← ID ของ user ที่สร้างสำเร็จ
    employeeId: string;      // ← รหัสพนักงาน
    firstName: string;       // ← ชื่อ
    lastName: string;        // ← นามสกุล
  }>;
}

/**
 * 📤 Bulk Import Users จาก CSV
 * - วน loop ทีละ row → validate → auto-generate employeeId → create user
 * - เก็บ error ของแต่ละ row เพื่อ report กลับ
 * - ใช้ Set เก็บ email/nationalId ที่มีอยู่แล้ว + ที่เพิ่งสร้าง (ป้องกันซ้ำภายใน batch)
 */
export const bulkCreateUsers = async (
  users: BulkCreateUserDTO[],       // ← array ของ user data จาก CSV
  createdByUserId: number,          // ← ID ของ Admin/SuperAdmin ที่ import
  creatorRole: string,              // ← role ของผู้ import (ADMIN/SUPERADMIN)
  creatorBranchId?: number          // ← สาขาของผู้ import (สำหรับตรวจสิทธิ์)
): Promise<BulkImportResult> => {
  const result: BulkImportResult = {
    success: 0,        // ← นับจำนวนสำเร็จ
    failed: 0,         // ← นับจำนวนล้มเหลว
    errors: [],        // ← เก็บ error ของแต่ละ row
    createdUsers: [],  // ← เก็บ user ที่สร้างสำเร็จ
  };

  // ✅ STEP 1: ดึง employeeIds, emails, nationalIds ที่มีอยู่แล้วในระบบ
  // ═══════════════════════════════════════════════════════════════════
  // ใช้ Set สำหรับ O(1) lookup (เร็วกว่า query ทุก row)
  const existingEmployeeIds = new Set(
    (await prisma.user.findMany({ select: { employeeId: true } })).map((u: { employeeId: string }) => u.employeeId)  // ← ดึง employeeId ทั้งหมด
  );
  const existingEmails = new Set(
    (await prisma.user.findMany({ select: { email: true } })).map((u: { email: string }) => u.email)  // ← ดึง email ทั้งหมด
  );
  const existingNationalIds = new Set(
    (await prisma.user.findMany({ select: { nationalId: true } })).map((u: { nationalId: string }) => u.nationalId)  // ← ดึง nationalId ทั้งหมด
  );

  // ✅ STEP 2: วน loop ทีละ row ใน CSV
  // ═══════════════════════════════════
  for (let i = 0; i < users.length; i++) {
    const userData = users[i];
    if (!userData) continue;          // ← ข้าม undefined entries
    
    const rowNumber = i + 2;          // ← +2 เพราะ row 1 = header, index เริ่มที่ 0

    try {
      // ── Validate required fields ──────────────────────────────────
      if (!userData.title || !userData.firstName || !userData.lastName ||
          !userData.email || !userData.nationalId ||
          !userData.phone || !userData.emergent_tel || !userData.emergent_first_name ||
          !userData.emergent_last_name || !userData.emergent_relation || !userData.branchId || !userData.gender) {
        result.failed++;
        result.errors.push({
          row: rowNumber,
          error: 'ข้อมูลไม่ครบ (ต้องมี: title, firstName, lastName, email, nationalId, phone, emergent_tel, emergent_first_name, emergent_last_name, emergent_relation, branchId, gender)',
        });
        continue;  // ← ข้าม row นี้
      }

      // ── เช็ค email ซ้ำ ─────────────────────────────────────────────
      if (existingEmails.has(userData.email)) {
        result.failed++;
        result.errors.push({ row: rowNumber, error: 'อีเมลซ้ำ' });
        continue;  // ← ข้าม row นี้
      }

      // ── เช็ค nationalId ซ้ำ ────────────────────────────────────────
      if (existingNationalIds.has(userData.nationalId)) {
        result.failed++;
        result.errors.push({ row: rowNumber, error: 'เลขบัตรประชาชนซ้ำ' });
        continue;  // ← ข้าม row นี้
      }

      // ── Parse branchId ─────────────────────────────────────────────
      const branchId = typeof userData.branchId === 'string' 
        ? parseInt(userData.branchId)    // ← string → number
        : userData.branchId;
      
      if (!branchId || isNaN(branchId)) {  // ← branchId ไม่ถูกต้อง
        result.failed++;
        result.errors.push({ row: rowNumber, error: 'branchId ไม่ถูกต้อง' });
        continue;
      }

      // ── ตรวจว่า branch มีอยู่จริง ──────────────────────────────────
      const branch = await prisma.branch.findUnique({
        where: { branchId },  // ← ค้นหา branch
      });
      if (!branch) {
        result.failed++;
        result.errors.push({ row: rowNumber, error: `ไม่พบสาขา branchId: ${branchId}` });
        continue;
      }

      // ── ตรวจสิทธิ์สาขา (Admin) ─────────────────────────────────────
      if (creatorRole === 'ADMIN' && branchId !== creatorBranchId) {
        result.failed++;
        result.errors.push({ row: rowNumber, error: 'ไม่มีสิทธิ์สร้างผู้ใช้ในสาขาอื่น' });
        continue;  // ← Admin ข้ามสาขาไม่ได้
      }

      // ── Parse gender ───────────────────────────────────────────────
      const genderUpper = userData.gender.toUpperCase();  // ← แปลงเป็นตัวพิมพ์ใหญ่
      if (genderUpper !== 'MALE' && genderUpper !== 'FEMALE') {
        result.failed++;
        result.errors.push({ row: rowNumber, error: 'gender ต้องเป็น MALE หรือ FEMALE' });
        continue;
      }
      const gender = genderUpper as Gender;  // ← cast เป็น Gender enum

      // ── Parse title ────────────────────────────────────────────────
      const titleUpper = userData.title?.toUpperCase();
      if (!titleUpper || !['MR', 'MRS', 'MISS'].includes(titleUpper)) {
        result.failed++;
        result.errors.push({ row: rowNumber, error: 'title ต้องเป็น MR, MRS หรือ MISS' });
        continue;
      }
      const title = titleUpper as Title;  // ← cast เป็น Title enum

      // ── Parse role ─────────────────────────────────────────────────
      let role: Role = 'USER';  // ← default = USER
      if (userData.role) {
        const upperRole = userData.role.toUpperCase();
        if (['SUPERADMIN', 'ADMIN', 'MANAGER', 'USER'].includes(upperRole)) {
          // Admin ไม่สามารถสร้าง SUPERADMIN ได้
          if (upperRole === 'SUPERADMIN' && creatorRole !== 'SUPERADMIN') {
            result.failed++;
            result.errors.push({ row: rowNumber, error: 'ไม่มีสิทธิ์สร้าง SUPERADMIN' });
            continue;
          }
          role = upperRole as Role;  // ← cast เป็น Role enum
        }
      }

      // ── Auto-generate employeeId ───────────────────────────────────
      const employeeId = await generateEmployeeId(branchId);  // ← เช่น BKK001

      // ── Hash password (ใช้ nationalId เป็น default) ────────────────
      const hashedPassword = await hashPassword(userData.password ?? userData.nationalId);  // ← bcrypt hash

      // ── Upload avatar ──────────────────────────────────────────────
      let avatarUrl: string | null = null;
      try {
        const avatarGender = gender === 'FEMALE' ? 'female' : 'male';
        avatarUrl = await uploadAvatarToSupabase(employeeId, avatarGender);  // ← upload ไป Supabase
      } catch (error) {
        avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.firstName + ' ' + userData.lastName)}&background=random&size=200`;  // ← fallback
      }

      // ── Parse birthDate ────────────────────────────────────────────
      let birthDate: Date | null = null;
      if (userData.birthDate) {
        birthDate = new Date(userData.birthDate);  // ← string → Date
        if (isNaN(birthDate.getTime())) {  // ← Date ไม่ถูกต้อง
          result.failed++;
          result.errors.push({ row: rowNumber, error: 'รูปแบบวันเกิดไม่ถูกต้อง' });
          continue;
        }
      }

      // ── INSERT user ลง database ─────────────────────────────────────
      const user = await prisma.user.create({
        data: {
          employeeId,                                    // ← auto-generated
          title,                                         // ← คำนำหน้า
          firstName: userData.firstName,                 // ← ชื่อ
          lastName: userData.lastName,                   // ← นามสกุล
          nickname: userData.nickname || null,            // ← ชื่อเล่น
          gender,                                        // ← เพศ
          nationalId: userData.nationalId,                // ← เลขบัตร
          emergent_tel: userData.emergent_tel,            // ← เบอร์ฉุกเฉิน
          emergent_first_name: userData.emergent_first_name,  // ← ชื่อฉุกเฉิน
          emergent_last_name: userData.emergent_last_name,    // ← นามสกุลฉุกเฉิน
          emergent_relation: userData.emergent_relation,      // ← ความสัมพันธ์
          phone: userData.phone,                         // ← เบอร์โทร
          email: userData.email,                         // ← อีเมล
          password: hashedPassword,                      // ← bcrypt hash
          avatarUrl,                                     // ← avatar URL
          birthDate,                                     // ← วันเกิด
          branchId,                                      // ← สาขา
          role,                                          // ← role
          status: 'ACTIVE',                              // ← default = ACTIVE
        },
      });

      // ── เพิ่มเข้า Set เพื่อป้องกันซ้ำภายใน batch เดียวกัน ──────────
      existingEmployeeIds.add(employeeId);          // ← เพิ่ม employeeId
      existingEmails.add(userData.email);            // ← เพิ่ม email
      existingNationalIds.add(userData.nationalId);  // ← เพิ่ม nationalId

      result.success++;  // ← นับจำนวนสำเร็จ
      result.createdUsers.push({
        userId: user.userId,          // ← ID ของ user ที่สร้าง
        employeeId: user.employeeId,  // ← รหัสพนักงาน
        firstName: user.firstName,    // ← ชื่อ
        lastName: user.lastName,      // ← นามสกุล
      });

    } catch (error: any) {
      result.failed++;  // ← นับจำนวนล้มเหลว
      result.errors.push({
        row: rowNumber,
        error: error.message || 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ',  // ← ข้อความ error
      });
    }
  }

  // ✅ STEP 3: บันทึก Audit Log สำหรับ bulk import
  // ═══════════════════════════════════════════════
  if (result.success > 0) {  // ← บันทึกเฉพาะเมื่อมีสร้างสำเร็จอย่างน้อย 1 คน
    await createAuditLog({
      userId: createdByUserId,             // ← Admin/SuperAdmin ที่ import
      action: AuditAction.CREATE_USER,     // ← action = CREATE_USER
      targetTable: 'users',               // ← ตาราง
      targetId: 0,                         // ← 0 = bulk operation (ไม่มี target เดียว)
      newValues: {
        operation: 'BULK_IMPORT',          // ← ชนิดการทำงาน
        totalRows: users.length,           // ← จำนวน row ทั้งหมด
        success: result.success,           // ← จำนวนสำเร็จ
        failed: result.failed,             // ← จำนวนล้มเหลว
      },
    });
  }

  return result;  // ← return ผลลัพธ์ทั้งหมด
};

// ═══════════════════════════════════════════════════════════════
// 7️⃣ getUserStatistics() — นับสถิติพนักงาน (สำหรับ Dashboard)
// ═══════════════════════════════════════════════════════════════
// 📌 Source: controllers/user.controller.ts → GET /api/users/statistics
/**
 * 📊 ดึงสถิติจำนวนพนักงาน สำหรับแสดงบน Dashboard
 * - Admin เห็นเฉพาะสาขาตัวเอง
 * - SuperAdmin เห็นทั้งหมด
 */
export const getUserStatistics = async (
  requesterRole: string,         // ← role ของผู้ request
  requesterBranchId?: number     // ← สาขาของผู้ request (สำหรับ Admin)
) => {
  // ✅ STEP 1: สร้าง WHERE filter ตาม RBAC
  // ═══════════════════════════════════════
  const where: any = {};

  if (requesterRole === 'ADMIN' && requesterBranchId) {
    where.branchId = requesterBranchId;  // ← Admin เห็นเฉพาะสาขาตัวเอง
  }
  // ← SuperAdmin ไม่มี filter = เห็นทั้งหมด

  // ✅ STEP 2: นับจำนวนตาม status (ใช้ Promise.all สำหรับ parallel query)
  // ══════════════════════════════════════════════════════════════════════
  const [total, active, suspended, resigned] = await Promise.all([
    prisma.user.count({ where }),                                    // ← จำนวนรวมทั้งหมด
    prisma.user.count({ where: { ...where, status: 'ACTIVE' } }),    // ← จำนวน ACTIVE
    prisma.user.count({ where: { ...where, status: 'SUSPENDED' } }), // ← จำนวน SUSPENDED
    prisma.user.count({ where: { ...where, status: 'RESIGNED' } }),  // ← จำนวน RESIGNED
  ]);

  // ✅ STEP 3: นับจำนวนตาม role (groupBy)
  // ══════════════════════════════════════
  const byRole = await prisma.user.groupBy({
    by: ['role'],             // ← group ตาม role
    where,                    // ← ใช้ filter เดียวกัน
    _count: { role: true },   // ← นับจำนวนในแต่ละ group
  });

  // ✅ STEP 4: return ข้อมูลสถิติ
  // ═══════════════════════════════
  return {
    total,                                      // ← จำนวนรวม
    byStatus: { active, suspended, resigned },  // ← แยกตาม status
    byRole: byRole.reduce((acc: Record<string, number>, item: { role: string; _count: { role: number } }) => {
      acc[item.role] = item._count.role;  // ← แปลง groupBy array → object { ADMIN: 5, USER: 20, ... }
      return acc;
    }, {} as Record<string, number>),
  };
};

// ═══════════════════════════════════════════════════════════════
// 📦 Default Export — รวมทุก function ที่ export
// ═══════════════════════════════════════════════════════════════
export default {
  createUser,           // ← 1️⃣ สร้างพนักงานใหม่
  getUsers,             // ← 2️⃣ ดึงรายชื่อพนักงาน (paginated + RBAC)
  getUserById,          // ← 3️⃣ ดึงข้อมูลพนักงานตาม ID
  updateUser,           // ← 4️⃣ แก้ไขข้อมูลพนักงาน
  deleteUser,           // ← 5️⃣ ลบพนักงาน (soft delete)
  bulkCreateUsers,      // ← 6️⃣ Import พนักงานจาก CSV
  getUserStatistics,    // ← 7️⃣ ดึงสถิติ (Dashboard)
  getAvatarUrl,         // ← Helper: ดึง avatar URL
};