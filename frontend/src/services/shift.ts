import api from './api';
import {
  Shift,
  CreateShiftRequest,
  UpdateShiftRequest,
  ShiftListParams,
} from '@/types/attendance';

/**
 * แปลง Shift จาก backend (shiftId) → frontend (id)
 * Backend Prisma model ใช้ shiftId, locationId เป็น PK
 * แต่ Frontend type ใช้ id
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapShift(raw: any): Shift {
  return {
    ...raw,
    id: raw.shiftId ?? raw.id,
    location: raw.location ? {
      ...raw.location,
      id: raw.location.locationId ?? raw.location.id,
    } : undefined,
    user: raw.user ? {
      ...raw.user,
      id: raw.user.userId ?? raw.user.id,
      name: raw.user.name ?? `${raw.user.firstName ?? ''} ${raw.user.lastName ?? ''}`.trim(),
    } : undefined,
  };
}

export const shiftService = {
  /**
   * Create a new shift (Admin only)
   */
  async create(data: CreateShiftRequest): Promise<Shift> {
    const response = await api.post('/shifts', data);
    return mapShift(response.data.data);
  },

  /**
   * Create one shift pattern for many users (creates one record per user)
   */
  async createMany(baseData: Omit<CreateShiftRequest, 'userId'>, userIds: number[]): Promise<Shift[]> {
    const created: Shift[] = [];
    for (const userId of userIds) {
      const shift = await this.create({ ...baseData, userId });
      created.push(shift);
    }
    return created;
  },

  /**
   * Get all shifts
   */
  async getAll(params?: ShiftListParams): Promise<Shift[]> {
    const response = await api.get('/shifts', { params });
    return (response.data.data ?? []).map(mapShift);
  },

  /**
   * Get shifts available today for a specific user
   * GET /api/shifts/today/:userId
   */
  async getTodayByUserId(userId: number): Promise<Shift[]> {
    const response = await api.get(`/shifts/today/${userId}`);
    return (response.data.data ?? []).map(mapShift);
  },

  /**
   * Get shift by ID
   */
  async getById(id: number): Promise<Shift> {
    const response = await api.get(`/shifts/${id}`);
    return mapShift(response.data.data);
  },

  /**
   * Update shift
   */
  async update(id: number, data: UpdateShiftRequest): Promise<Shift> {
    const response = await api.put(`/shifts/${id}`, data);
    return mapShift(response.data.data);
  },

  /**
   * Delete shift (Admin only)
   */
  async delete(id: number, deleteReason: string): Promise<void> {
    await api.delete(`/shifts/${id}`, { data: { deleteReason } });
  },

  /**
   * Get shifts for a specific user
   */
  async getByUserId(userId: number): Promise<Shift[]> {
    const response = await api.get('/shifts', { params: { userId } });
    return (response.data.data ?? []).map(mapShift);
  },

  /**
   * Get active shifts
   */
  async getActive(): Promise<Shift[]> {
    const response = await api.get('/shifts', { params: { isActive: true } });
    return (response.data.data ?? []).map(mapShift);
  },
};

export default shiftService;
