import api from './api';

export interface User {
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

export const userService = {
  /**
   * Get all users (Admin only)
   */
  async getAll(): Promise<User[]> {
    const response = await api.get('/users');
    return response.data.data || response.data;
  },

  /**
   * Get user by ID
   */
  async getById(id: number): Promise<User> {
    const response = await api.get(`/users/${id}`);
    return response.data.data || response.data;
  },

  /**
   * Get current user profile
   */
  async getProfile(): Promise<User> {
    const response = await api.get('/users/profile');
    return response.data.data || response.data;
  },
};

export default userService;
