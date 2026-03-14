import api from './api';
import { AuthUser } from '@/types/auth';
import { User } from '@/types/user';

export interface UserServiceUser {
  id: number;
  name: string;
  employeeId: string;
  email: string;
  role: 'user' | 'manager' | 'admin' | 'superadmin';
  department?: string;
  position?: string;
  branch?: string;
  provinceCode?: string;
  isActive: boolean;
}

export interface GetUsersParams {
  branchId?: number;
  status?: string;
  search?: string;
  page?: number;
  limit?: number;
}

export interface GetUsersResponse {
  users: User[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

function normalizeUserArray(data: unknown): UserServiceUser[] {
  if (Array.isArray(data)) {
    return data as UserServiceUser[];
  }

  if (data && typeof data === 'object') {
    const record = data as Record<string, unknown>;
    if (Array.isArray(record.users)) {
      return record.users as UserServiceUser[];
    }
    if (Array.isArray(record.data)) {
      return record.data as UserServiceUser[];
    }
  }

  return [];
}

/**
 * แปลง backend user object → frontend User type
 */
function mapBackendUserToFrontend(backendUser: Record<string, unknown>): User {
  const roleMap: Record<string, string> = {
    'USER': 'user', 'MANAGER': 'manager', 'ADMIN': 'admin', 'SUPERADMIN': 'superadmin',
    'user': 'user', 'manager': 'manager', 'admin': 'admin', 'superadmin': 'superadmin',
  };
  const statusMap: Record<string, string> = {
    'ACTIVE': 'active', 'RESIGNED': 'leave', 'SUSPENDED': 'suspended', 'PENDING': 'pending',
    'active': 'active', 'leave': 'leave', 'suspended': 'suspended', 'pending': 'pending',
  };

  const emergencyFirstName = String(backendUser.emergent_first_name ?? backendUser.emergentFirstName ?? '');
  const emergencyLastName = String(backendUser.emergent_last_name ?? backendUser.emergentLastName ?? '');

  return {
    id: String(backendUser.userId ?? backendUser.id ?? ''),
    name: backendUser.name
      ? String(backendUser.name)
      : `${backendUser.firstName ?? ''} ${backendUser.lastName ?? ''}`.trim(),
    email: String(backendUser.email ?? ''),
    phone: String(backendUser.phone ?? ''),
    employeeId: String(backendUser.employeeId ?? ''),
    username: String(backendUser.employeeId ?? ''),
    password: '',
    role: (roleMap[String(backendUser.role ?? '')] ?? 'user') as User['role'],
    department: String(backendUser.department ?? ''),
    position: String(backendUser.position ?? ''),
    bloodType: backendUser.bloodType ? String(backendUser.bloodType) : undefined,
    status: (statusMap[String(backendUser.status ?? '')] ?? 'active') as User['status'],
    branch: (() => {
      const b = backendUser.branch;
      if (b && typeof b === 'object') return String((b as Record<string, unknown>).code ?? '');
      return String(b ?? backendUser.branchCode ?? '');
    })(),
    branchCode: (() => {
      const b = backendUser.branch;
      if (b && typeof b === 'object') return String((b as Record<string, unknown>).code ?? '');
      return String(backendUser.branchCode ?? '');
    })(),
    provinceCode: String(backendUser.provinceCode ?? ''),
    profileImage: backendUser.avatarUrl ? String(backendUser.avatarUrl) : undefined,
    birthDate: backendUser.birthDate ? String(backendUser.birthDate).split('T')[0] : undefined,
    nationalId: backendUser.nationalId ? String(backendUser.nationalId) : undefined,
    address: backendUser.address ? String(backendUser.address) : undefined,
    emergencyContact: (emergencyFirstName || emergencyLastName)
      ? {
          name: `${emergencyFirstName} ${emergencyLastName}`.trim(),
          phone: String(backendUser.emergent_tel ?? backendUser.emergentTel ?? ''),
          relation: String(backendUser.emergent_relation ?? backendUser.emergentRelation ?? ''),
        }
      : undefined,
    attendanceRecords: [],
  };
}

export const userService = {
  /**
   * ดึงรายชื่อสมาชิกสำหรับหน้า manage-users
   *  - superadmin: เห็นทุกคน
   *  - admin: เห็นเฉพาะสาขาตัวเอง
   */
  async getManageUsers(
    _currentUser: AuthUser,
    filters?: { status?: string; search?: string; branchId?: number; page?: number; limit?: number }
  ): Promise<GetUsersResponse> {
    // requester identity comes from Bearer token — no need to pass in params
    const params: Record<string, string | number> = {
      limit: filters?.limit ?? 500,
    };

    if (filters?.status && filters.status !== 'all') {
      params.status = filters.status.toUpperCase();
    }
    if (filters?.search) {
      params.search = filters.search;
    }
    if (filters?.branchId) {
      params.branchId = filters.branchId;
    }
    if (filters?.page) {
      params.page = filters.page;
    }

    const response = await api.get('/users', { params });
    const data = response.data.data ?? response.data;

    // รองรับทั้ง { users: [...] } และ array โดยตรง
    const rawUsers: Record<string, unknown>[] = Array.isArray(data)
      ? data
      : Array.isArray(data?.users)
        ? data.users
        : [];

    return {
      users: rawUsers.map(mapBackendUserToFrontend),
      total: data?.total ?? rawUsers.length,
      page: data?.page ?? 1,
      limit: data?.limit ?? rawUsers.length,
      totalPages: data?.totalPages ?? 1,
    };
  },

  /**
   * Get all users (legacy — ไม่ส่ง params, ใช้เป็น fallback)
   */
  async getAll(): Promise<UserServiceUser[]> {
    const response = await api.get('/users');
    return normalizeUserArray(response.data?.data ?? response.data);
  },

  /**
   * Get user by ID
   */
  async getById(id: number): Promise<UserServiceUser> {
    const response = await api.get(`/users/${id}`);
    return response.data.data || response.data;
  },

  /**
   * Get current user profile
   */
  async getProfile(): Promise<UserServiceUser> {
    const response = await api.get('/users/profile');
    return response.data.data || response.data;
  },

  /**
   * Update user by ID
   */
  async updateUser(id: string, data: Record<string, unknown>): Promise<User> {
    // แปลง frontend form → backend format
    const payload: Record<string, unknown> = {};
    if (data.name) {
      const parts = String(data.name).trim().split(' ');
      payload.firstName = parts[0] ?? '';
      payload.lastName = parts.slice(1).join(' ') || parts[0];
    }
    if (data.email !== undefined) payload.email = data.email;
    if (data.phone !== undefined) payload.phone = data.phone;
    if (data.role !== undefined) payload.role = String(data.role).toUpperCase();
    if (data.status !== undefined) {
      const statusMap: Record<string, string> = { active: 'ACTIVE', leave: 'RESIGNED', suspended: 'SUSPENDED' };
      payload.status = statusMap[String(data.status)] ?? String(data.status).toUpperCase();
    }
    if (data.birthDate !== undefined) payload.birthDate = data.birthDate;
    if (data.nationalId !== undefined) payload.nationalId = data.nationalId;
    if (data.department !== undefined) payload.department = data.department;
    if (data.position !== undefined) payload.position = data.position;
    if (data.bloodType !== undefined) payload.bloodType = data.bloodType;
    if (data.password && String(data.password).trim()) payload.password = data.password;
    if (data.emergencyContact && typeof data.emergencyContact === 'object') {
      const ec = data.emergencyContact as Record<string, unknown>;
      payload.emergent_first_name = String(ec.name ?? '').split(' ')[0] ?? '';
      payload.emergent_last_name = String(ec.name ?? '').split(' ').slice(1).join(' ') || String(ec.name ?? '');
      payload.emergent_tel = ec.phone;
      payload.emergent_relation = ec.relation;
    }

    const response = await api.put(`/users/${id}`, payload);
    const backendUser = response.data.data ?? response.data;
    return mapBackendUserToFrontend(backendUser);
  },
};
