import { Role, UserStatus, Gender, Title } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { createAuditLog, AuditAction } from './audit.service.js';
import { uploadAvatarToSupabase } from '../utils/supabase-storage.js';
import { createClient } from '@supabase/supabase-js';
import * as bcrypt from 'bcrypt';

/**
 * 👤 User Service - จัดการข้อมูลผู้ใช้
 * 
 * 🔴 หมายเหตุ: ตอนนี้ยังไม่มี Auth
 * - รับ userId, role, branchId จาก parameter แทน
 * - รอเพื่อนทำ Auth เสร็จค่อยเปลี่ยน
 * 
 * สิทธิ์การเข้าถึง:
 * - SuperAdmin: ดู/สร้าง/แก้/ลบ ได้ทุกสาขา
 * - Admin: ดู/สร้าง/แก้/ลบ ได้เฉพาะสาขาตัวเอง
 * - User: ดูได้เฉพาะข้อมูลตัวเอง
 * 
 * 📝 employeeId Format: {branchCode}{runningNumber}
 * - เช่น BKK001, CNX002, HKT003
 * - running number นับจากจำนวน user ในสาขานั้น + 1
 */

// Supabase client for avatar management
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const bucketName = process.env.SUPABASE_BUCKET_NAME || 'easycheck-bucket';

let supabase: ReturnType<typeof createClient> | null = null;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

// ============================================
// 📦 DTOs (Data Transfer Objects)
// ============================================

export interface CreateUserDTO {
  // employeeId จะถูก auto-generate จาก branchId
  title: Title; // นาย (MR), นาง (MRS), นางสาว (MISS)
  firstName: string;
  lastName: string;
  nickname?: string;
  gender: Gender;
  nationalId: string;
  emergent_tel: string;
  emergent_first_name: string;
  emergent_last_name: string;
  emergent_relation: string;
  phone: string;
  email: string;
  password: string;
  birthDate: Date | string;
  branchId: number; // บังคับเพื่อสร้าง employeeId
  role?: Role;
  status?: UserStatus;
  // Auth info (ตอนนี้ยังไม่มี auth)
  createdByUserId?: number;
  creatorRole?: string;
  creatorBranchId?: number;
}

export interface UpdateUserDTO {
  title?: Title;
  firstName?: string;
  lastName?: string;
  nickname?: string;
  gender?: Gender;
  nationalId?: string;
  emergent_tel?: string;
  emergent_first_name?: string;
  emergent_last_name?: string;
  emergent_relation?: string;
  phone?: string;
  email?: string;
  password?: string;
  birthDate?: Date | string;
  branchId?: number;
  role?: Role;
  status?: UserStatus;
  avatarGender?: string; // สำหรับอัปเดต avatar
}

export interface BulkCreateUserDTO {
  // employeeId จะถูก auto-generate
  title: string; // MR, MRS, MISS
  firstName: string;
  lastName: string;
  nickname?: string;
  gender: string; // MALE หรือ FEMALE
  nationalId: string;
  emergent_tel: string;
  emergent_first_name: string;
  emergent_last_name: string;
  emergent_relation: string;
  phone: string;
  email: string;
  password: string;
  birthDate: string;
  branchId: string | number; // บังคับ
  role?: string;
}

export interface UserFilters {
  branchId?: number;
  role?: Role;
  status?: UserStatus;
  search?: string;
}

// ============================================
// 🛠️ Helper Functions
// ============================================

const SALT_ROUNDS = 10;

/**
 * 🔒 Hash password
 */
async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

/**
 * 🔐 ตรวจสอบสิทธิ์ตาม branch
 */
function canAccessBranch(
  role: string,
  requesterBranchId: number | undefined,
  targetBranchId: number | undefined | null
): boolean {
  if (role === 'SUPERADMIN') return true;
  if (role === 'ADMIN') {
    if (!requesterBranchId) return false;
    if (!targetBranchId) return true; // legacy data
    return requesterBranchId === targetBranchId;
  }
  return false;
}

/**
 * � Split full name into first name and last name
 * For emergency contact names or any full names
 */
export function splitName(fullName: string): { firstName: string; lastName: string } {
  if (!fullName) {
    return { firstName: '', lastName: '' };
  }

  const parts = fullName.trim().split(/\s+/);
  
  if (parts.length === 0) {
    return { firstName: '', lastName: '' };
  }
  
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }
  
  // Take first part as first name, rest as last name
  const firstName = parts[0];
  const lastName = parts.slice(1).join(' ');
  
  return { firstName, lastName };
}

/**
 * �🔢 Generate Employee ID from branch code + running number
 * Format: {branchCode}{3-digit running number}
 * เช่น BKK001, CNX002, HKT003
 */
async function generateEmployeeId(branchId: number): Promise<string> {
  // 1. ดึงข้อมูล branch
  const branch = await prisma.branch.findUnique({
    where: { branchId },
    select: { code: true },
  });

  if (!branch) {
    throw new Error('ไม่พบสาขาที่ระบุ');
  }

  const branchCode = branch.code.toUpperCase();

  // 2. นับจำนวน user ในสาขานั้น
  const userCount = await prisma.user.count({
    where: { branchId },
  });

  // 3. สร้าง running number (user count + 1, pad ด้วย 0 ให้ครบ 3 หลัก)
  const runningNumber = (userCount + 1).toString().padStart(3, '0');

  // 4. สร้าง employeeId
  const employeeId = `${branchCode}${runningNumber}`;

  // 5. ตรวจสอบว่า employeeId ซ้ำหรือไม่ (กรณี edge case)
  const existing = await prisma.user.findUnique({
    where: { employeeId },
  });

  if (existing) {
    // ถ้าซ้ำ หา employeeId ที่มากที่สุดในสาขานั้น + 1
    const maxUser = await prisma.user.findFirst({
      where: {
        employeeId: { startsWith: branchCode },
      },
      orderBy: { employeeId: 'desc' },
      select: { employeeId: true },
    });

    if (maxUser) {
      const maxNumber = parseInt(maxUser.employeeId.replace(branchCode, ''), 10);
      return `${branchCode}${(maxNumber + 1).toString().padStart(3, '0')}`;
    }
  }

  return employeeId;
}

/**
 * 📷 Get avatar URL from Supabase Storage
 */
export async function getAvatarUrl(employeeId: string): Promise<string | null> {
  if (!supabase) return null;
  
  try {
    const fileName = `avatars/${employeeId}.jpg`;
    const { data } = supabase.storage.from(bucketName).getPublicUrl(fileName);
    
    // Check if file exists by trying to get it
    const { data: fileData, error } = await supabase.storage
      .from(bucketName)
      .download(fileName);
    
    if (error || !fileData) {
      // File doesn't exist, try png
      const pngFileName = `avatars/${employeeId}.png`;
      const { data: pngFileData, error: pngError } = await supabase.storage
        .from(bucketName)
        .download(pngFileName);
      
      if (!pngError && pngFileData) {
        const { data: pngData } = supabase.storage.from(bucketName).getPublicUrl(pngFileName);
        return pngData.publicUrl;
      }
      
      return null;
    }
    
    return data.publicUrl;
  } catch (error) {
    console.error('Error getting avatar URL:', error);
    return null;
  }
}

/**
 * 🖼️ Format user with avatar URL
 */
async function formatUserWithAvatar(user: any): Promise<any> {
  // ถ้ามี avatarUrl อยู่แล้วให้ใช้เลย
  if (user.avatarUrl) {
    return user;
  }
  
  // ถ้าไม่มีลองดึงจาก Supabase Storage
  const avatarUrl = await getAvatarUrl(user.employeeId);
  
  return {
    ...user,
    avatarUrl: avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.firstName + ' ' + user.lastName)}&background=random&size=200`,
  };
}

/**
 * 🖼️ Format multiple users with avatar URLs
 */
async function formatUsersWithAvatars(users: any[]): Promise<any[]> {
  return Promise.all(users.map(formatUserWithAvatar));
}

// ============================================
// 📋 Main Functions - CRUD
// ============================================

/**
 * ➕ สร้างผู้ใช้ใหม่
 */
export const createUser = async (data: CreateUserDTO) => {
  // 1. ตรวจสอบ branchId (บังคับสำหรับสร้าง employeeId)
  if (!data.branchId) {
    throw new Error('กรุณาระบุสาขา (branchId) เพื่อสร้างรหัสพนักงาน');
  }

  // 2. ตรวจสอบ branch exists
  const branch = await prisma.branch.findUnique({
    where: { branchId: data.branchId },
  });
  if (!branch) {
    throw new Error('ไม่พบสาขาที่ระบุ');
  }

  // 3. Auto-generate employeeId
  const employeeId = await generateEmployeeId(data.branchId);

  // 4. ตรวจสอบ email และ nationalId ซ้ำ
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { email: data.email },
        { nationalId: data.nationalId },
      ],
    },
  });

  if (existingUser) {
    if (existingUser.email === data.email) {
      throw new Error('อีเมลนี้มีอยู่ในระบบแล้ว');
    }
    if (existingUser.nationalId === data.nationalId) {
      throw new Error('เลขบัตรประชาชนนี้มีอยู่ในระบบแล้ว');
    }
  }

  // 5. ตรวจสอบสิทธิ์ (ถ้าเป็น Admin ต้องสร้างคนในสาขาตัวเองเท่านั้น)
  if (data.creatorRole === 'ADMIN' && data.branchId) {
    if (!canAccessBranch(data.creatorRole, data.creatorBranchId, data.branchId)) {
      throw new Error('คุณไม่มีสิทธิ์สร้างผู้ใช้ในสาขาอื่น');
    }
  }

  // 6. Hash password
  const hashedPassword = await hashPassword(data.password);

  // 7. Upload avatar to Supabase (ใช้ gender จริง)
  let avatarUrl: string | null = null;
  try {
    const avatarGender = data.gender === 'FEMALE' ? 'female' : 'male';
    avatarUrl = await uploadAvatarToSupabase(employeeId, avatarGender);
  } catch (error) {
    console.error('Failed to upload avatar:', error);
    // ใช้ fallback avatar
    avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(data.firstName + ' ' + data.lastName)}&background=random&size=200`;
  }

  // 8. Parse birthDate
  let birthDate: Date | null = null;
  if (data.birthDate) {
    birthDate = typeof data.birthDate === 'string' 
      ? new Date(data.birthDate) 
      : data.birthDate;
  }

  // 9. สร้าง user
  const user = await prisma.user.create({
    data: {
      employeeId,
      title: data.title,
      firstName: data.firstName,
      lastName: data.lastName,
      nickname: data.nickname || null,
      gender: data.gender,
      nationalId: data.nationalId,
      emergent_tel: data.emergent_tel,
      emergent_first_name: data.emergent_first_name,
      emergent_last_name: data.emergent_last_name,
      emergent_relation: data.emergent_relation,
      phone: data.phone,
      email: data.email,
      password: hashedPassword,
      avatarUrl,
      birthDate,
      branchId: data.branchId,
      role: data.role || 'USER',
      status: data.status || 'ACTIVE',
      updatedByUserId: data.createdByUserId || null,
    },
    include: {
      branch: {
        select: {
          branchId: true,
          name: true,
          code: true,
        },
      },
    },
  });

  // 10. บันทึก Audit Log
  if (data.createdByUserId) {
    await createAuditLog({
      userId: data.createdByUserId,
      action: AuditAction.CREATE_USER,
      targetTable: 'users',
      targetId: user.userId,
      newValues: {
        employeeId: user.employeeId,
        title: user.title,
        firstName: user.firstName,
        lastName: user.lastName,
        email: user.email,
        gender: user.gender,
        role: user.role,
        branchId: user.branchId,
      },
    });
  }

  // ลบ password ออกจาก response
  const { password: _, ...userWithoutPassword } = user;
  return userWithoutPassword;
};

/**
 * 📋 ดึงผู้ใช้ทั้งหมด (ตาม role และ branch)
 */
export const getUsers = async (
  requesterId: number,
  requesterRole: string,
  requesterBranchId?: number,
  filters?: UserFilters,
  page: number = 1,
  limit: number = 20
) => {
  // สร้าง where clause
  const where: any = {};

  // กรองตาม branch (ถ้าเป็น Admin)
  if (requesterRole === 'ADMIN' && requesterBranchId) {
    where.branchId = requesterBranchId;
  } else if (requesterRole === 'USER') {
    // User ดูได้เฉพาะตัวเอง
    where.userId = requesterId;
  }

  // Apply filters
  if (filters?.branchId && requesterRole === 'SUPERADMIN') {
    where.branchId = filters.branchId;
  }
  if (filters?.role) {
    where.role = filters.role;
  }
  if (filters?.status) {
    where.status = filters.status;
  }
  if (filters?.search) {
    where.OR = [
      { firstName: { contains: filters.search, mode: 'insensitive' } },
      { lastName: { contains: filters.search, mode: 'insensitive' } },
      { employeeId: { contains: filters.search, mode: 'insensitive' } },
      { email: { contains: filters.search, mode: 'insensitive' } },
      { nickname: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  // Count total
  const total = await prisma.user.count({ where });

  // Get users with pagination
  const users = await prisma.user.findMany({
    where,
    select: {
      userId: true,
      employeeId: true,
      firstName: true,
      lastName: true,
      nickname: true,
      nationalId: true,
      emergent_tel: true,
      emergent_first_name: true,
      emergent_last_name: true,
      emergent_relation: true,
      phone: true,
      email: true,
      avatarUrl: true,
      birthDate: true,
      branchId: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      branch: {
        select: {
          branchId: true,
          name: true,
          code: true,
        },
      },
    },
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * limit,
    take: limit,
  });

  // Format users with avatar URLs
  const formattedUsers = await formatUsersWithAvatars(users);

  return {
    users: formattedUsers,
    pagination: {
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    },
  };
};

/**
 * 📋 ดึงผู้ใช้ตาม ID
 */
export const getUserById = async (
  userId: number,
  requesterId?: number,
  requesterRole?: string,
  requesterBranchId?: number
) => {
  const user = await prisma.user.findUnique({
    where: { userId },
    select: {
      userId: true,
      employeeId: true,
      firstName: true,
      lastName: true,
      nickname: true,
      nationalId: true,
      emergent_tel: true,
      emergent_first_name: true,
      emergent_last_name: true,
      emergent_relation: true,
      phone: true,
      email: true,
      avatarUrl: true,
      birthDate: true,
      branchId: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      branch: {
        select: {
          branchId: true,
          name: true,
          code: true,
        },
      },
    },
  });

  if (!user) {
    throw new Error('ไม่พบผู้ใช้');
  }

  // ตรวจสอบสิทธิ์
  if (requesterRole && requesterRole !== 'SUPERADMIN') {
    if (requesterRole === 'ADMIN' && !canAccessBranch('ADMIN', requesterBranchId, user.branchId)) {
      throw new Error('คุณไม่มีสิทธิ์ดูข้อมูลผู้ใช้สาขาอื่น');
    }
    if (requesterRole === 'USER' && requesterId !== userId) {
      throw new Error('คุณไม่มีสิทธิ์ดูข้อมูลผู้ใช้คนอื่น');
    }
  }

  return formatUserWithAvatar(user);
};

/**
 * 🔄 อัปเดตผู้ใช้
 */
export const updateUser = async (
  userId: number,
  updatedByUserId: number,
  updaterRole: string,
  updaterBranchId: number | undefined,
  data: UpdateUserDTO
) => {
  // 1. ดึงข้อมูล user เดิม
  const existingUser = await prisma.user.findUnique({
    where: { userId },
  });

  if (!existingUser) {
    throw new Error('ไม่พบผู้ใช้');
  }

  // 2. ตรวจสอบสิทธิ์
  if (!canAccessBranch(updaterRole, updaterBranchId, existingUser.branchId)) {
    throw new Error('คุณไม่มีสิทธิ์แก้ไขข้อมูลผู้ใช้สาขาอื่น');
  }

  // 3. ถ้าเปลี่ยน email หรือ nationalId ต้องตรวจสอบซ้ำ
  if (data.email && data.email !== existingUser.email) {
    const emailExists = await prisma.user.findUnique({
      where: { email: data.email },
    });
    if (emailExists) {
      throw new Error('อีเมลนี้มีอยู่ในระบบแล้ว');
    }
  }

  if (data.nationalId && data.nationalId !== existingUser.nationalId) {
    const nationalIdExists = await prisma.user.findUnique({
      where: { nationalId: data.nationalId },
    });
    if (nationalIdExists) {
      throw new Error('เลขบัตรประชาชนนี้มีอยู่ในระบบแล้ว');
    }
  }

  // 4. ตรวจสอบ branch ใหม่ (ถ้ามี)
  if (data.branchId) {
    const branch = await prisma.branch.findUnique({
      where: { branchId: data.branchId },
    });
    if (!branch) {
      throw new Error('ไม่พบสาขาที่ระบุ');
    }
    // Admin ไม่สามารถย้ายคนไปสาขาอื่นได้
    if (updaterRole === 'ADMIN' && data.branchId !== updaterBranchId) {
      throw new Error('คุณไม่มีสิทธิ์ย้ายผู้ใช้ไปสาขาอื่น');
    }
  }

  // 5. เตรียมข้อมูลอัปเดต
  const updateData: any = {
    updatedByUserId,
  };

  if (data.firstName !== undefined) updateData.firstName = data.firstName;
  if (data.lastName !== undefined) updateData.lastName = data.lastName;
  if (data.nickname !== undefined) updateData.nickname = data.nickname;
  if (data.nationalId !== undefined) updateData.nationalId = data.nationalId;
  if (data.emergent_tel !== undefined) updateData.emergent_tel = data.emergent_tel;
  if (data.emergent_first_name !== undefined) updateData.emergent_first_name = data.emergent_first_name;
  if (data.emergent_last_name !== undefined) updateData.emergent_last_name = data.emergent_last_name;
  if (data.emergent_relation !== undefined) updateData.emergent_relation = data.emergent_relation;
  if (data.phone !== undefined) updateData.phone = data.phone;
  if (data.email !== undefined) updateData.email = data.email;
  if (data.branchId !== undefined) updateData.branchId = data.branchId;
  if (data.role !== undefined) updateData.role = data.role;
  if (data.status !== undefined) updateData.status = data.status;

  // Hash password if provided
  if (data.password) {
    updateData.password = await hashPassword(data.password);
  }

  // Parse birthDate
  if (data.birthDate !== undefined) {
    updateData.birthDate = data.birthDate 
      ? (typeof data.birthDate === 'string' ? new Date(data.birthDate) : data.birthDate)
      : null;
  }

  // Update avatar if gender changed
  if (data.avatarGender) {
    try {
      const avatarGender = data.avatarGender.toLowerCase() === 'female' ? 'female' : 'male';
      updateData.avatarUrl = await uploadAvatarToSupabase(
        existingUser.employeeId,
        avatarGender
      );
    } catch (error) {
      console.error('Failed to update avatar:', error);
    }
  }

  // 6. อัปเดต user
  const updatedUser = await prisma.user.update({
    where: { userId },
    data: updateData,
    select: {
      userId: true,
      employeeId: true,
      firstName: true,
      lastName: true,
      nickname: true,
      nationalId: true,
      emergent_tel: true,
      emergent_first_name: true,
      emergent_last_name: true,
      emergent_relation: true,
      phone: true,
      email: true,
      avatarUrl: true,
      birthDate: true,
      branchId: true,
      role: true,
      status: true,
      createdAt: true,
      updatedAt: true,
      branch: {
        select: {
          branchId: true,
          name: true,
          code: true,
        },
      },
    },
  });

  // 7. บันทึก Audit Log
  await createAuditLog({
    userId: updatedByUserId,
    action: AuditAction.UPDATE_USER,
    targetTable: 'users',
    targetId: userId,
    oldValues: {
      firstName: existingUser.firstName,
      lastName: existingUser.lastName,
      email: existingUser.email,
      role: existingUser.role,
      status: existingUser.status,
      branchId: existingUser.branchId,
    },
    newValues: {
      firstName: updatedUser.firstName,
      lastName: updatedUser.lastName,
      email: updatedUser.email,
      role: updatedUser.role,
      status: updatedUser.status,
      branchId: updatedUser.branchId,
    },
  });

  return formatUserWithAvatar(updatedUser);
};

/**
 * 🗑️ ลบผู้ใช้ (เปลี่ยน status เป็น RESIGNED)
 */
export const deleteUser = async (
  userId: number,
  deletedByUserId: number,
  deleterRole: string,
  deleterBranchId: number | undefined,
  deleteReason: string
) => {
  // 1. ดึงข้อมูล user
  const existingUser = await prisma.user.findUnique({
    where: { userId },
  });

  if (!existingUser) {
    throw new Error('ไม่พบผู้ใช้');
  }

  // 2. ตรวจสอบสิทธิ์
  if (!canAccessBranch(deleterRole, deleterBranchId, existingUser.branchId)) {
    throw new Error('คุณไม่มีสิทธิ์ลบผู้ใช้สาขาอื่น');
  }

  // 3. ไม่สามารถลบตัวเองได้
  if (userId === deletedByUserId) {
    throw new Error('ไม่สามารถลบตัวเองได้');
  }

  // 4. ไม่สามารถลบ SuperAdmin ได้ (ถ้าไม่ใช่ SuperAdmin)
  if (existingUser.role === 'SUPERADMIN' && deleterRole !== 'SUPERADMIN') {
    throw new Error('ไม่มีสิทธิ์ลบ SuperAdmin');
  }

  // 5. อัปเดต status เป็น RESIGNED (soft delete)
  const deletedUser = await prisma.user.update({
    where: { userId },
    data: {
      status: 'RESIGNED',
      updatedByUserId: deletedByUserId,
    },
  });

  // 6. บันทึก Audit Log
  await createAuditLog({
    userId: deletedByUserId,
    action: AuditAction.DELETE_USER,
    targetTable: 'users',
    targetId: userId,
    oldValues: {
      status: existingUser.status,
    },
    newValues: {
      status: 'RESIGNED',
      deleteReason,
    },
  });

  return { userId, status: 'RESIGNED', deleteReason };
};

// ============================================
// 📤 Bulk Import - CSV
// ============================================

export interface BulkImportResult {
  success: number;
  failed: number;
  errors: Array<{
    row: number;
    employeeId?: string;
    error: string;
  }>;
  createdUsers: Array<{
    userId: number;
    employeeId: string;
    firstName: string;
    lastName: string;
  }>;
}

/**
 * 📤 Bulk Import Users จาก CSV
 */
export const bulkCreateUsers = async (
  users: BulkCreateUserDTO[],
  createdByUserId: number,
  creatorRole: string,
  creatorBranchId?: number
): Promise<BulkImportResult> => {
  const result: BulkImportResult = {
    success: 0,
    failed: 0,
    errors: [],
    createdUsers: [],
  };

  // ดึง employeeIds และ emails ที่มีอยู่แล้ว
  const existingEmployeeIds = new Set(
    (await prisma.user.findMany({ select: { employeeId: true } })).map((u: { employeeId: string }) => u.employeeId)
  );
  const existingEmails = new Set(
    (await prisma.user.findMany({ select: { email: true } })).map((u: { email: string }) => u.email)
  );
  const existingNationalIds = new Set(
    (await prisma.user.findMany({ select: { nationalId: true } })).map((u: { nationalId: string }) => u.nationalId)
  );

  // Process each user
  for (let i = 0; i < users.length; i++) {
    const userData = users[i];
    if (!userData) continue; // Skip undefined entries
    
    const rowNumber = i + 2; // +2 เพราะ row 1 คือ header และ index เริ่มที่ 0

    try {
      // Validate required fields (ไม่ต้องมี employeeId แล้ว เพราะ auto-generate)
      if (!userData.title || !userData.firstName || !userData.lastName ||
          !userData.email || !userData.password || !userData.nationalId ||
          !userData.phone || !userData.emergent_tel || !userData.emergent_first_name ||
          !userData.emergent_last_name || !userData.emergent_relation || !userData.branchId || !userData.gender) {
        result.failed++;
        result.errors.push({
          row: rowNumber,
          error: 'ข้อมูลไม่ครบ (ต้องมี: title, firstName, lastName, email, password, nationalId, phone, emergent_tel, emergent_first_name, emergent_last_name, emergent_relation, branchId, gender)',
        });
        continue;
      }

      // Check duplicates (ไม่ต้อง check employeeId เพราะ auto-generate)
      if (existingEmails.has(userData.email)) {
        result.failed++;
        result.errors.push({
          row: rowNumber,
          error: 'อีเมลซ้ำ',
        });
        continue;
      }

      if (existingNationalIds.has(userData.nationalId)) {
        result.failed++;
        result.errors.push({
          row: rowNumber,
          error: 'เลขบัตรประชาชนซ้ำ',
        });
        continue;
      }

      // Parse branchId (บังคับ)
      const branchId = typeof userData.branchId === 'string' 
        ? parseInt(userData.branchId) 
        : userData.branchId;
      
      if (!branchId || isNaN(branchId)) {
        result.failed++;
        result.errors.push({
          row: rowNumber,
          error: 'branchId ไม่ถูกต้อง',
        });
        continue;
      }

      // Verify branch exists
      const branch = await prisma.branch.findUnique({
        where: { branchId },
      });
      if (!branch) {
        result.failed++;
        result.errors.push({
          row: rowNumber,
          error: `ไม่พบสาขา branchId: ${branchId}`,
        });
        continue;
      }

      // Check branch access for Admin
      if (creatorRole === 'ADMIN' && branchId !== creatorBranchId) {
        result.failed++;
        result.errors.push({
          row: rowNumber,
          error: 'ไม่มีสิทธิ์สร้างผู้ใช้ในสาขาอื่น',
        });
        continue;
      }

      // Parse gender
      const genderUpper = userData.gender.toUpperCase();
      if (genderUpper !== 'MALE' && genderUpper !== 'FEMALE') {
        result.failed++;
        result.errors.push({
          row: rowNumber,
          error: 'gender ต้องเป็น MALE หรือ FEMALE',
        });
        continue;
      }
      const gender = genderUpper as Gender;

      // Parse title
      const titleUpper = userData.title?.toUpperCase();
      if (!titleUpper || !['MR', 'MRS', 'MISS'].includes(titleUpper)) {
        result.failed++;
        result.errors.push({
          row: rowNumber,
          error: 'title ต้องเป็น MR, MRS หรือ MISS',
        });
        continue;
      }
      const title = titleUpper as Title;

      // Parse role
      let role: Role = 'USER';
      if (userData.role) {
        const upperRole = userData.role.toUpperCase();
        if (['SUPERADMIN', 'ADMIN', 'MANAGER', 'USER'].includes(upperRole)) {
          // Admin ไม่สามารถสร้าง SUPERADMIN ได้
          if (upperRole === 'SUPERADMIN' && creatorRole !== 'SUPERADMIN') {
            result.failed++;
            result.errors.push({
              row: rowNumber,
              error: 'ไม่มีสิทธิ์สร้าง SUPERADMIN',
            });
            continue;
          }
          role = upperRole as Role;
        }
      }

      // Auto-generate employeeId
      const employeeId = await generateEmployeeId(branchId);

      // Hash password
      const hashedPassword = await hashPassword(userData.password);

      // Upload avatar (ใช้ gender จริง)
      let avatarUrl: string | null = null;
      try {
        const avatarGender = gender === 'FEMALE' ? 'female' : 'male';
        avatarUrl = await uploadAvatarToSupabase(employeeId, avatarGender);
      } catch (error) {
        avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.firstName + ' ' + userData.lastName)}&background=random&size=200`;
      }

      // Parse birthDate (บังคับ)
      let birthDate: Date | null = null;
      if (userData.birthDate) {
        birthDate = new Date(userData.birthDate);
        if (isNaN(birthDate.getTime())) {
          result.failed++;
          result.errors.push({
            row: rowNumber,
            error: 'รูปแบบวันเกิดไม่ถูกต้อง',
          });
          continue;
        }
      }

      // Create user
      const user = await prisma.user.create({
        data: {
          employeeId,
          title,
          firstName: userData.firstName,
          lastName: userData.lastName,
          nickname: userData.nickname || null,
          gender,
          nationalId: userData.nationalId,
          emergent_tel: userData.emergent_tel,
          emergent_first_name: userData.emergent_first_name,
          emergent_last_name: userData.emergent_last_name,
          emergent_relation: userData.emergent_relation,
          phone: userData.phone,
          email: userData.email,
          password: hashedPassword,
          avatarUrl,
          birthDate,
          branchId,
          role,
          status: 'ACTIVE',
          updatedByUserId: createdByUserId,
        },
      });

      // Add to sets to prevent duplicates within the same batch
      existingEmployeeIds.add(employeeId);
      existingEmails.add(userData.email);
      existingNationalIds.add(userData.nationalId);

      result.success++;
      result.createdUsers.push({
        userId: user.userId,
        employeeId: user.employeeId,
        firstName: user.firstName,
        lastName: user.lastName,
      });

    } catch (error: any) {
      result.failed++;
      result.errors.push({
        row: rowNumber,
        error: error.message || 'เกิดข้อผิดพลาดที่ไม่ทราบสาเหตุ',
      });
    }
  }

  // บันทึก Audit Log สำหรับ bulk import
  if (result.success > 0) {
    await createAuditLog({
      userId: createdByUserId,
      action: AuditAction.CREATE_USER,
      targetTable: 'users',
      targetId: 0, // Bulk operation
      newValues: {
        operation: 'BULK_IMPORT',
        totalRows: users.length,
        success: result.success,
        failed: result.failed,
      },
    });
  }

  return result;
};

/**
 * 📊 Get user statistics (for dashboard)
 */
export const getUserStatistics = async (
  requesterRole: string,
  requesterBranchId?: number
) => {
  const where: any = {};

  if (requesterRole === 'ADMIN' && requesterBranchId) {
    where.branchId = requesterBranchId;
  }

  const [total, active, suspended, resigned] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.count({ where: { ...where, status: 'ACTIVE' } }),
    prisma.user.count({ where: { ...where, status: 'SUSPENDED' } }),
    prisma.user.count({ where: { ...where, status: 'RESIGNED' } }),
  ]);

  // Count by role
  const byRole = await prisma.user.groupBy({
    by: ['role'],
    where,
    _count: { role: true },
  });

  return {
    total,
    byStatus: { active, suspended, resigned },
    byRole: byRole.reduce((acc: Record<string, number>, item: { role: string; _count: { role: number } }) => {
      acc[item.role] = item._count.role;
      return acc;
    }, {} as Record<string, number>),
  };
};

export default {
  createUser,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  bulkCreateUsers,
  getUserStatistics,
  getAvatarUrl,
};