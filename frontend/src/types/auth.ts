// Authentication Types

export type UserRole = 'user' | 'manager' | 'admin' | 'superadmin';

export type UserStatus = 'active' | 'suspended' | 'leave' | 'pending';

export interface AuthUser {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  username: string;
  role: UserRole;
  status: UserStatus;
  department?: string;
  position?: string;
  branch?: string;
  provinceCode?: string;
  branchCode?: string;
  avatar?: string;
  phone?: string;
}

export interface LoginCredentials {
  username: string;
  password: string;
  rememberMe?: boolean;
}

export interface AuthContextType {
  user: AuthUser | null;
  isAuthenticated: boolean;
  login: (credentials: LoginCredentials) => Promise<void>;
  logout: () => void;
  isLoading: boolean;
  error: string | null;
}

// Mock User Credentials for Testing
export const MOCK_CREDENTIALS = {
  user: {
    username: 'user',
    password: 'user123',
    role: 'user' as UserRole
  },
  manager: {
    username: 'manager',
    password: 'manager123',
    role: 'manager' as UserRole
  },
  admin: {
    username: 'admin',
    password: 'admin123',
    role: 'admin' as UserRole
  },
  superadmin: {
    username: 'superadmin',
    password: 'superadmin123',
    role: 'superadmin' as UserRole
  }
};

// Mock Users Data
export const MOCK_USERS: Record<string, AuthUser> = {
  user: {
    id: 'U001',
    employeeId: 'BKK001001',
    name: 'สมชาย ใจดี',
    email: 'user@easycheck.com',
    username: 'user',
    role: 'user',
    status: 'active',
    department: 'IT',
    position: 'นักพัฒนาระบบ',
    branch: 'กรุงเทพมหานคร',
    provinceCode: 'BKK',
    branchCode: 'BKK001',
    phone: '081-234-5678'
  },
  manager: {
    id: 'M001',
    employeeId: 'BKK002001',
    name: 'สมหญิง จัดการ',
    email: 'manager@easycheck.com',
    username: 'manager',
    role: 'manager',
    status: 'active',
    department: 'IT',
    position: 'ผู้จัดการแผนก',
    branch: 'กรุงเทพมหานคร',
    provinceCode: 'BKK',
    branchCode: 'BKK002',
    phone: '082-345-6789'
  },
  admin: {
    id: 'A001',
    employeeId: 'BKK003001',
    name: 'สมศรี ดูแล',
    email: 'admin@easycheck.com',
    username: 'admin',
    role: 'admin',
    status: 'active',
    department: 'HR',
    position: 'ผู้ดูแลระบบ',
    branch: 'กรุงเทพมหานคร',
    provinceCode: 'BKK',
    branchCode: 'BKK003',
    phone: '083-456-7890'
  },
  superadmin: {
    id: 'SA001',
    employeeId: 'HQ001001',
    name: 'สมปอง ควบคุม',
    email: 'superadmin@easycheck.com',
    username: 'superadmin',
    role: 'superadmin',
    status: 'active',
    department: 'Executive',
    position: 'ผู้ดูแลระบบสูงสุด',
    branch: 'สำนักงานใหญ่',
    provinceCode: 'HQ',
    branchCode: 'HQ001',
    phone: '084-567-8901'
  }
};
