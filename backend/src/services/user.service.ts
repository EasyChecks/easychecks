// User CRUD + Bulk Import + Statistics
// RBAC: SuperAdmin ทุกสาขา, Admin เฉพาะสาขาตัวเอง, User เฉพาะตัวเอง
// employeeId auto-gen จาก branchCode + running number (เช่น BKK001)

import { Role, UserStatus, Gender, Title } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { createAuditLog, AuditAction } from './audit.service.js';
import { uploadAvatarToSupabase } from '../utils/supabase-storage.js';
import { createClient } from '@supabase/supabase-js';
import * as bcrypt from 'bcrypt';

// Supabase client สำหรับ avatar storage — lazy init เฉพาะเมื่อมี credentials
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const bucketName = process.env.SUPABASE_BUCKET_NAME || 'easycheck-bucket';

let supabase: ReturnType<typeof createClient> | null = null;
if (supabaseUrl && supabaseKey) {
  supabase = createClient(supabaseUrl, supabaseKey);
}

// --- DTOs ---

export interface CreateUserDTO {
  title: Title;
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
  // ถ้าไม่ระบุ password จะใช้ nationalId เป็นรหัสเริ่มต้น
  password?: string;
  birthDate: Date | string;
  branchId: number;
  role?: Role;
  status?: UserStatus;
  department?: string;
  position?: string;
  bloodType?: string;
  address?: string;
  createdByUserId?: number;
  creatorRole?: string;
  creatorBranchId?: number;
}

// ส่งเฉพาะ field ที่ต้องการเปลี่ยน (undefined = ไม่แก้)
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
  // ถ้าส่ง password → hash bcrypt แล้ว overwrite
  password?: string;
  birthDate?: Date | string;
  branchId?: number;
  role?: Role;
  status?: UserStatus;
  avatarGender?: string;
  department?: string;
  position?: string;
  bloodType?: string;
}

export interface BulkCreateUserDTO {
  title: string;
  firstName: string;
  lastName: string;
  nickname?: string;
  gender: string;
  nationalId: string;
  emergent_tel: string;
  emergent_first_name: string;
  emergent_last_name: string;
  emergent_relation: string;
  phone: string;
  email: string;
  password?: string;
  birthDate: string;
  branchId: string | number;
  role?: string;
}

export interface UserFilters {
  branchId?: number;
  role?: Role;
  status?: UserStatus;
  search?: string;
}

// --- Helpers ---

const SALT_ROUNDS = 10;

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

// RBAC: SuperAdmin เข้าทุกสาขา, Admin เฉพาะสาขาตัวเอง
function canAccessBranch(
  role: string,
  requesterBranchId: number | undefined,
  targetBranchId: number | undefined | null
): boolean {
  if (role === 'SUPERADMIN') return true;
  if (role === 'ADMIN') {
    if (!requesterBranchId) return false;
    // target ไม่มี branch = legacy data → ให้ผ่าน
    if (!targetBranchId) return true;
    return requesterBranchId === targetBranchId;
  }
  return false;
}

export function splitName(fullName: string): { firstName: string; lastName: string } {
  if (!fullName) return { firstName: '', lastName: '' };

  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 0) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: parts[0], lastName: '' };

  // คำแรก = ชื่อ, ที่เหลือรวมกัน = นามสกุล
  return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
}

// adminPassword format: ADMIN → admXXXX, SUPERADMIN → supXXXX
async function generateAdminPassword(role: string): Promise<string | null> {
  if (role === 'ADMIN') {
    const count = await prisma.user.count({
      where: { role: 'ADMIN', adminPassword: { not: null } },
    });
    return `adm${String(count + 1).padStart(4, '0')}`;
  }
  if (role === 'SUPERADMIN') {
    const count = await prisma.user.count({
      where: { role: 'SUPERADMIN', adminPassword: { not: null } },
    });
    return `sup${String(count + 1).padStart(4, '0')}`;
  }
  return null;
}

// employeeId = branchCode + running number (เช่น BKK0001)
// ถ้าซ้ำจะหา max ในสาขาแล้ว +1
async function generateEmployeeId(branchId: number): Promise<string> {
  const branch = await prisma.branch.findUnique({
    where: { branchId },
    select: { code: true },
  });

  if (!branch) throw new Error('ไม่พบสาขาที่ระบุ');

  const branchCode = branch.code.toUpperCase();

  const userCount = await prisma.user.count({ where: { branchId } });
  const runningNumber = (userCount + 1).toString().padStart(4, '0');
  const employeeId = `${branchCode}${runningNumber}`;

  // ตรวจซ้ำ — ถ้าซ้ำหา max แล้ว +1
  const existing = await prisma.user.findUnique({ where: { employeeId } });

  if (existing) {
    const maxUser = await prisma.user.findFirst({
      where: { employeeId: { startsWith: branchCode } },
      orderBy: { employeeId: 'desc' },
      select: { employeeId: true },
    });

    if (maxUser) {
      const maxNumber = parseInt(maxUser.employeeId.replace(branchCode, ''), 10);
      return `${branchCode}${(maxNumber + 1).toString().padStart(4, '0')}`;
    }
  }

  return employeeId;
}

// ลอง .jpg ก่อน → .png → null (ใช้ fallback ui-avatars.com)
export async function getAvatarUrl(employeeId: string): Promise<string | null> {
  if (!supabase) return null;
  
  try {
    const fileName = `avatars/${employeeId}.jpg`;
    const { data } = supabase.storage.from(bucketName).getPublicUrl(fileName);
    
    const { data: fileData, error } = await supabase.storage
      .from(bucketName)
      .download(fileName);
    
    if (error || !fileData) {
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

// fallback เป็น ui-avatars.com ถ้าไม่มี avatar ใน Supabase
async function formatUserWithAvatar(user: any): Promise<any> {
  if (user.avatarUrl) return user;
  
  const avatarUrl = await getAvatarUrl(user.employeeId);
  
  return {
    ...user,
    avatarUrl: avatarUrl || `https://ui-avatars.com/api/?name=${encodeURIComponent(user.firstName + ' ' + user.lastName)}&background=random&size=200`,
  };
}

async function formatUsersWithAvatars(users: any[]): Promise<any[]> {
  return Promise.all(users.map(formatUserWithAvatar));
}

// --- CRUD Functions ---

// createUser: ตรวจ branch → gen employeeId → เช็คซ้ำ → RBAC → hash password → upload avatar → INSERT → audit
export const createUser = async (data: CreateUserDTO) => {
  if (!data.branchId) {
    throw new Error('กรุณาระบุสาขา (branchId) เพื่อสร้างรหัสพนักงาน');
  }

  const branch = await prisma.branch.findUnique({
    where: { branchId: data.branchId },
  });
  if (!branch) throw new Error('ไม่พบสาขาที่ระบุ');

  const employeeId = await generateEmployeeId(data.branchId);

  // เช็ค email + nationalId ซ้ำพร้อมกัน (SQL: WHERE email = ? OR nationalId = ?)
  const existingUser = await prisma.user.findFirst({
    where: {
      OR: [
        { email: data.email },
        { nationalId: data.nationalId },
      ],
    },
  });

  if (existingUser) {
    if (existingUser.email === data.email) throw new Error('อีเมลนี้มีอยู่ในระบบแล้ว');
    if (existingUser.nationalId === data.nationalId) throw new Error('เลขบัตรประชาชนนี้มีอยู่ในระบบแล้ว');
  }

  // Admin สร้างได้เฉพาะสาขาตัวเอง
  if (data.creatorRole === 'ADMIN' && data.branchId) {
    if (!canAccessBranch(data.creatorRole, data.creatorBranchId, data.branchId)) {
      throw new Error('คุณไม่มีสิทธิ์สร้างผู้ใช้ในสาขาอื่น');
    }
  }

  // ใช้ nationalId เป็นรหัสเริ่มต้นถ้าไม่ระบุ password — พนักงาน login ได้ทันที
  const hashedPassword = await hashPassword(data.password ?? data.nationalId);

  const effectiveRole = data.role || 'USER';
  const adminPassword = await generateAdminPassword(effectiveRole);

  // upload avatar ตามเพศ → fallback เป็น ui-avatars.com
  let avatarUrl: string | null = null;
  try {
    const avatarGender = data.gender === 'FEMALE' ? 'female' : 'male';
    avatarUrl = await uploadAvatarToSupabase(employeeId, avatarGender);
  } catch (error) {
    console.error('Failed to upload avatar:', error);
    avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(data.firstName + ' ' + data.lastName)}&background=random&size=200`;
  }

  let birthDate: Date | null = null;
  if (data.birthDate) {
    birthDate = typeof data.birthDate === 'string' ? new Date(data.birthDate) : data.birthDate;
  }

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
      adminPassword,
      department: data.department || null,
      position: data.position || null,
      bloodType: data.bloodType || null,
      address: data.address || null,
    },
    include: {
      branch: {
        select: { branchId: true, name: true, code: true },
      },
    },
  });

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

  // ไม่ส่ง password กลับ
  const { password: _, ...userWithoutPassword } = user;
  return userWithoutPassword;
};

// getUsers: RBAC filter → search → pagination → format avatar
// SQL equiv: SELECT ... FROM users WHERE branchId = ? AND (name LIKE ? OR ...) ORDER BY ... LIMIT ? OFFSET ?
export const getUsers = async (
  requesterId: number,
  requesterRole: string,
  requesterBranchId?: number,
  filters?: UserFilters,
  page: number = 1,
  limit: number = 20
) => {
  const where: any = {};

  // RBAC: Admin lock สาขาตัวเอง, User lock ตัวเอง, SuperAdmin ดูทั้งหมด
  if (requesterRole === 'ADMIN' && requesterBranchId) {
    where.branchId = requesterBranchId;
  } else if (requesterRole === 'USER') {
    where.userId = requesterId;
  }

  if (filters?.branchId && requesterRole === 'SUPERADMIN') {
    where.branchId = filters.branchId;
  }
  if (filters?.role) where.role = filters.role;
  if (filters?.status) where.status = filters.status;
  if (filters?.search) {
    where.OR = [
      { firstName: { contains: filters.search, mode: 'insensitive' } },
      { lastName: { contains: filters.search, mode: 'insensitive' } },
      { employeeId: { contains: filters.search, mode: 'insensitive' } },
      { email: { contains: filters.search, mode: 'insensitive' } },
      { nickname: { contains: filters.search, mode: 'insensitive' } },
    ];
  }

  const total = await prisma.user.count({ where });

  const users = await prisma.user.findMany({
    where,
    select: {
      userId: true, employeeId: true, firstName: true, lastName: true,
      nickname: true, nationalId: true, emergent_tel: true,
      emergent_first_name: true, emergent_last_name: true, emergent_relation: true,
      phone: true, email: true, avatarUrl: true, birthDate: true,
      department: true, position: true, bloodType: true,
      branchId: true, role: true, status: true, adminPassword: true,
      createdAt: true, updatedAt: true,
      branch: { select: { branchId: true, name: true, code: true } },
      // password ไม่ดึง
    },
    // SuperAdmin เรียงตามสาขาก่อน แล้วตาม empId
    orderBy: requesterRole === 'SUPERADMIN'
      ? [{ branchId: 'asc' as const }, { employeeId: 'asc' as const }]
      : [{ employeeId: 'asc' as const }],
    skip: (page - 1) * limit,
    take: limit,
  });

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

// getUserById: ดึง user → ตรวจ RBAC (Admin=สาขาตัวเอง, User=ตัวเองเท่านั้น)
export const getUserById = async (
  userId: number,
  requesterId?: number,
  requesterRole?: string,
  requesterBranchId?: number
) => {
  const user = await prisma.user.findUnique({
    where: { userId },
    select: {
      userId: true, employeeId: true, firstName: true, lastName: true,
      nickname: true, nationalId: true, emergent_tel: true,
      emergent_first_name: true, emergent_last_name: true, emergent_relation: true,
      phone: true, email: true, avatarUrl: true, birthDate: true,
      department: true, position: true, bloodType: true,
      branchId: true, role: true, status: true, adminPassword: true,
      createdAt: true, updatedAt: true,
      branch: { select: { branchId: true, name: true, code: true } },
    },
  });

  if (!user) throw new Error('ไม่พบผู้ใช้');

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

// updateUser: RBAC → เช็คซ้ำ → partial update → audit
// Admin ย้ายสาขาไม่ได้, ส่ง password → hash bcrypt overwrite
export const updateUser = async (
  userId: number,
  updatedByUserId: number,
  updaterRole: string,
  updaterBranchId: number | undefined,
  data: UpdateUserDTO
) => {
  const existingUser = await prisma.user.findUnique({ where: { userId } });
  if (!existingUser) throw new Error('ไม่พบผู้ใช้');

  if (!canAccessBranch(updaterRole, updaterBranchId, existingUser.branchId)) {
    throw new Error('คุณไม่มีสิทธิ์แก้ไขข้อมูลผู้ใช้สาขาอื่น');
  }

  // เช็คซ้ำเฉพาะ field ที่เปลี่ยน
  if (data.email && data.email !== existingUser.email) {
    const emailExists = await prisma.user.findUnique({ where: { email: data.email } });
    if (emailExists) throw new Error('อีเมลนี้มีอยู่ในระบบแล้ว');
  }

  if (data.nationalId && data.nationalId !== existingUser.nationalId) {
    const nationalIdExists = await prisma.user.findUnique({ where: { nationalId: data.nationalId } });
    if (nationalIdExists) throw new Error('เลขบัตรประชาชนนี้มีอยู่ในระบบแล้ว');
  }

  if (data.branchId) {
    const branch = await prisma.branch.findUnique({ where: { branchId: data.branchId } });
    if (!branch) throw new Error('ไม่พบสาขาที่ระบุ');
    // Admin ย้ายคนไปสาขาอื่นไม่ได้
    if (updaterRole === 'ADMIN' && data.branchId !== updaterBranchId) {
      throw new Error('คุณไม่มีสิทธิ์ย้ายผู้ใช้ไปสาขาอื่น');
    }
  }

  // สร้าง updateData เฉพาะ field ที่ส่งมา (undefined = ไม่แก้)
  const updateData: any = {};

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

  // เปลี่ยน role → gen/ลบ adminPassword อัตโนมัติ
  if (data.role !== undefined) {
    const newRole = String(data.role).toUpperCase();
    const oldRole = existingUser.role;
    if ((newRole === 'ADMIN' || newRole === 'SUPERADMIN') && newRole !== oldRole) {
      updateData.adminPassword = await generateAdminPassword(newRole);
    } else if (newRole !== 'ADMIN' && newRole !== 'SUPERADMIN' && existingUser.adminPassword) {
      updateData.adminPassword = null;
    }
  }

  if (data.department !== undefined) updateData.department = data.department || null;
  if (data.position !== undefined) updateData.position = data.position || null;
  if (data.bloodType !== undefined) updateData.bloodType = data.bloodType || null;

  if (data.password) {
    updateData.password = await hashPassword(data.password);
  }

  if (data.birthDate !== undefined) {
    updateData.birthDate = data.birthDate
      ? (typeof data.birthDate === 'string' ? new Date(data.birthDate) : data.birthDate)
      : null;
  }

  // อัปเดต avatar ถ้า gender เปลี่ยน
  if (data.avatarGender) {
    try {
      const avatarGender = data.avatarGender.toLowerCase() === 'female' ? 'female' : 'male';
      updateData.avatarUrl = await uploadAvatarToSupabase(existingUser.employeeId, avatarGender);
    } catch (error) {
      console.error('Failed to update avatar:', error);
    }
  }

  const updatedUser = await prisma.user.update({
    where: { userId },
    data: updateData,
    select: {
      userId: true, employeeId: true, firstName: true, lastName: true,
      nickname: true, nationalId: true, emergent_tel: true,
      emergent_first_name: true, emergent_last_name: true, emergent_relation: true,
      phone: true, email: true, avatarUrl: true, birthDate: true,
      department: true, position: true, bloodType: true,
      branchId: true, role: true, status: true, adminPassword: true,
      createdAt: true, updatedAt: true,
      branch: { select: { branchId: true, name: true, code: true } },
    },
  });

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

// deleteUser: soft delete → status = RESIGNED (ไม่ลบจริง)
// ป้องกัน: ลบตัวเอง, ลบ SuperAdmin (ถ้าไม่ใช่ SuperAdmin)
export const deleteUser = async (
  userId: number,
  deletedByUserId: number,
  deleterRole: string,
  deleterBranchId: number | undefined,
  deleteReason: string
) => {
  const existingUser = await prisma.user.findUnique({ where: { userId } });
  if (!existingUser) throw new Error('ไม่พบผู้ใช้');

  if (!canAccessBranch(deleterRole, deleterBranchId, existingUser.branchId)) {
    throw new Error('คุณไม่มีสิทธิ์ลบผู้ใช้สาขาอื่น');
  }

  if (userId === deletedByUserId) throw new Error('ไม่สามารถลบตัวเองได้');

  if (existingUser.role === 'SUPERADMIN' && deleterRole !== 'SUPERADMIN') {
    throw new Error('ไม่มีสิทธิ์ลบ SuperAdmin');
  }

  // SQL equiv: UPDATE users SET status = 'RESIGNED' WHERE userId = ?
  await prisma.user.update({
    where: { userId },
    data: { status: 'RESIGNED' },
  });

  await createAuditLog({
    userId: deletedByUserId,
    action: AuditAction.DELETE_USER,
    targetTable: 'users',
    targetId: userId,
    oldValues: { status: existingUser.status },
    newValues: { status: 'RESIGNED', deleteReason },
  });

  return { userId, status: 'RESIGNED', deleteReason };
};

// bulkCreateUsers: วน loop CSV → validate → gen employeeId → create
// ใช้ Set เก็บ email/nationalId ที่มีอยู่ + ที่เพิ่งสร้าง (ป้องกันซ้ำภายใน batch)

export interface BulkImportResult {
  success: number;
  failed: number;
  errors: Array<{ row: number; employeeId?: string; error: string }>;
  createdUsers: Array<{ userId: number; employeeId: string; firstName: string; lastName: string }>;
}

export const bulkCreateUsers = async (
  users: BulkCreateUserDTO[],
  createdByUserId: number,
  creatorRole: string,
  creatorBranchId?: number
): Promise<BulkImportResult> => {
  const result: BulkImportResult = {
    success: 0, failed: 0, errors: [], createdUsers: [],
  };

  // ดึง existing data ทั้งหมดก่อน loop เพื่อ O(1) lookup
  const existingEmployeeIds = new Set(
    (await prisma.user.findMany({ select: { employeeId: true } })).map((u: { employeeId: string }) => u.employeeId)
  );
  const existingEmails = new Set(
    (await prisma.user.findMany({ select: { email: true } })).map((u: { email: string }) => u.email)
  );
  const existingNationalIds = new Set(
    (await prisma.user.findMany({ select: { nationalId: true } })).map((u: { nationalId: string }) => u.nationalId)
  );

  for (let i = 0; i < users.length; i++) {
    const userData = users[i];
    if (!userData) continue;
    
    // +2 เพราะ row 1 = header, index เริ่มที่ 0
    const rowNumber = i + 2;

    try {
      if (!userData.title || !userData.firstName || !userData.lastName ||
          !userData.email || !userData.nationalId ||
          !userData.phone || !userData.emergent_tel || !userData.emergent_first_name ||
          !userData.emergent_last_name || !userData.emergent_relation || !userData.branchId || !userData.gender) {
        result.failed++;
        result.errors.push({
          row: rowNumber,
          error: 'ข้อมูลไม่ครบ (ต้องมี: title, firstName, lastName, email, nationalId, phone, emergent_tel, emergent_first_name, emergent_last_name, emergent_relation, branchId, gender)',
        });
        continue;
      }

      if (existingEmails.has(userData.email)) {
        result.failed++;
        result.errors.push({ row: rowNumber, error: 'อีเมลซ้ำ' });
        continue;
      }

      if (existingNationalIds.has(userData.nationalId)) {
        result.failed++;
        result.errors.push({ row: rowNumber, error: 'เลขบัตรประชาชนซ้ำ' });
        continue;
      }

      const branchId = typeof userData.branchId === 'string' 
        ? parseInt(userData.branchId)
        : userData.branchId;
      
      if (!branchId || isNaN(branchId)) {
        result.failed++;
        result.errors.push({ row: rowNumber, error: 'branchId ไม่ถูกต้อง' });
        continue;
      }

      const branch = await prisma.branch.findUnique({ where: { branchId } });
      if (!branch) {
        result.failed++;
        result.errors.push({ row: rowNumber, error: `ไม่พบสาขา branchId: ${branchId}` });
        continue;
      }

      // Admin สร้างข้ามสาขาไม่ได้
      if (creatorRole === 'ADMIN' && branchId !== creatorBranchId) {
        result.failed++;
        result.errors.push({ row: rowNumber, error: 'ไม่มีสิทธิ์สร้างผู้ใช้ในสาขาอื่น' });
        continue;
      }

      const genderUpper = userData.gender.toUpperCase();
      if (genderUpper !== 'MALE' && genderUpper !== 'FEMALE') {
        result.failed++;
        result.errors.push({ row: rowNumber, error: 'gender ต้องเป็น MALE หรือ FEMALE' });
        continue;
      }
      const gender = genderUpper as Gender;

      const titleUpper = userData.title?.toUpperCase();
      if (!titleUpper || !['MR', 'MRS', 'MISS'].includes(titleUpper)) {
        result.failed++;
        result.errors.push({ row: rowNumber, error: 'title ต้องเป็น MR, MRS หรือ MISS' });
        continue;
      }
      const title = titleUpper as Title;

      let role: Role = 'USER';
      if (userData.role) {
        const upperRole = userData.role.toUpperCase();
        if (['SUPERADMIN', 'ADMIN', 'MANAGER', 'USER'].includes(upperRole)) {
          // Admin สร้าง SUPERADMIN ไม่ได้
          if (upperRole === 'SUPERADMIN' && creatorRole !== 'SUPERADMIN') {
            result.failed++;
            result.errors.push({ row: rowNumber, error: 'ไม่มีสิทธิ์สร้าง SUPERADMIN' });
            continue;
          }
          role = upperRole as Role;
        }
      }

      const employeeId = await generateEmployeeId(branchId);
      const hashedPassword = await hashPassword(userData.password ?? userData.nationalId);

      let avatarUrl: string | null = null;
      try {
        const avatarGender = gender === 'FEMALE' ? 'female' : 'male';
        avatarUrl = await uploadAvatarToSupabase(employeeId, avatarGender);
      } catch (error) {
        avatarUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.firstName + ' ' + userData.lastName)}&background=random&size=200`;
      }

      let birthDate: Date | null = null;
      if (userData.birthDate) {
        birthDate = new Date(userData.birthDate);
        if (isNaN(birthDate.getTime())) {
          result.failed++;
          result.errors.push({ row: rowNumber, error: 'รูปแบบวันเกิดไม่ถูกต้อง' });
          continue;
        }
      }

      const user = await prisma.user.create({
        data: {
          employeeId, title,
          firstName: userData.firstName, lastName: userData.lastName,
          nickname: userData.nickname || null, gender,
          nationalId: userData.nationalId,
          emergent_tel: userData.emergent_tel,
          emergent_first_name: userData.emergent_first_name,
          emergent_last_name: userData.emergent_last_name,
          emergent_relation: userData.emergent_relation,
          phone: userData.phone, email: userData.email,
          password: hashedPassword, avatarUrl, birthDate,
          branchId, role, status: 'ACTIVE',
        },
      });

      // เพิ่มเข้า Set เพื่อป้องกันซ้ำภายใน batch เดียวกัน
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

  if (result.success > 0) {
    await createAuditLog({
      userId: createdByUserId,
      action: AuditAction.CREATE_USER,
      targetTable: 'users',
      targetId: 0,
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

// getUserStatistics: นับสถิติสำหรับ Dashboard
// Promise.all ยิง 4 count พร้อมกัน + groupBy role
export const getUserStatistics = async (
  requesterRole: string,
  requesterBranchId?: number
) => {
  // Admin เห็นเฉพาะสาขาตัวเอง, SuperAdmin ไม่มี filter
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

  // groupBy role → แปลงเป็น { ADMIN: 5, USER: 20, ... }
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
  createUser, getUsers, getUserById, updateUser,
  deleteUser, bulkCreateUsers, getUserStatistics, getAvatarUrl,
};