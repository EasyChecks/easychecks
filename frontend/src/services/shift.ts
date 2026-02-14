import api from './api';
import {
  Shift,
  CreateShiftRequest,
  UpdateShiftRequest,
  ShiftListParams,
} from '@/types/attendance';

export const shiftService = {
  /**
   * Create a new shift (Admin only)
   */
  async create(data: CreateShiftRequest): Promise<Shift> {
    const response = await api.post('/shifts', data);
    return response.data.data;
  },

  /**
   * Get all shifts
   */
  async getAll(params?: ShiftListParams): Promise<Shift[]> {
    const response = await api.get('/shifts', { params });
    return response.data.data;
  },

  /**
   * Get shifts available today
   */
  async getToday(): Promise<Shift[]> {
    const response = await api.get('/shifts/today');
    return response.data.data;
  },

  /**
   * Get shift by ID
   */
  async getById(id: number): Promise<Shift> {
    const response = await api.get(`/shifts/${id}`);
    return response.data.data;
  },

  /**
   * Update shift
   */
  async update(id: number, data: UpdateShiftRequest): Promise<Shift> {
    const response = await api.put(`/shifts/${id}`, data);
    return response.data.data;
  },

  /**
   * Delete shift (Admin only)
   */
  async delete(id: number): Promise<void> {
    await api.delete(`/shifts/${id}`);
  },

  /**
   * Get shifts for a specific user
   */
  async getByUserId(userId: number): Promise<Shift[]> {
    const response = await api.get('/shifts', { params: { userId } });
    return response.data.data;
  },

  /**
   * Get active shifts
   */
  async getActive(): Promise<Shift[]> {
    const response = await api.get('/shifts', { params: { isActive: true } });
    return response.data.data;
  },
};

export default shiftService;
