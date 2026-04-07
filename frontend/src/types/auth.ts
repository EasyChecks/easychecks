// Authentication Types

export type UserRole = 'user' | 'manager' | 'admin' | 'superadmin';

export type UserStatus = 'active' | 'suspended' | 'leave' | 'pending';

export interface AuthUser {
  id: string;
  employeeId: string;
  name: string;
  email: string;
  username: string;
  gender?: string;
  title?: string;
  role: UserRole;
  dashboardMode?: UserRole; // effective dashboard: may differ from role (e.g. admin logging in as user)
  status: UserStatus;
  department?: string;
  position?: string;
  branch?: string;
  provinceCode?: string;
  branchCode?: string;
  branchId?: number;
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
  login: (credentials: LoginCredentials) => Promise<UserRole>;
  logout: () => void;
  isLoading: boolean;
  error: string | null;
}


