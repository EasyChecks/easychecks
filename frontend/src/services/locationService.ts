/**
 * locationService.ts
 * ─────────────────────────────────────────
 * HTTP client สำหรับ Location API
 * Base URL: /api/locations
 */

import api from './api';

export interface LocationItem {
  locationId: number;
  locationName: string;
  address?: string;
  latitude: number;
  longitude: number;
  radius: number;
  isActive?: boolean;
  createdAt?: string;
}

export interface CreateLocationRequest {
  locationName: string;
  address?: string;
  latitude: number;
  longitude: number;
  radius: number;
}

// ── Service Methods ──

export const locationService = {
  /**
   * GET /api/locations - ดึงรายการสถานที่ทั้งหมด
   */
  async getAll(): Promise<LocationItem[]> {
    const res = await api.get('/locations');
    return res.data.data || res.data;
  },

  /**
   * GET /api/locations/:id - ดึงสถานที่ตาม ID
   */
  async getById(id: number): Promise<LocationItem> {
    const res = await api.get(`/locations/${id}`);
    return res.data.data;
  },

  /**
   * POST /api/locations - สร้างสถานที่ใหม่ (Admin/SuperAdmin)
   */
  async create(data: CreateLocationRequest): Promise<LocationItem> {
    const res = await api.post('/locations', data);
    return res.data.data;
  },

  /**
   * PATCH /api/locations/:id - แก้ไขสถานที่ (Admin/SuperAdmin)
   */
  async update(id: number, data: Partial<CreateLocationRequest>): Promise<LocationItem> {
    const res = await api.patch(`/locations/${id}`, data);
    return res.data.data;
  },

  /**
   * DELETE /api/locations/:id - ลบสถานที่ (Admin/SuperAdmin)
   */
  async delete(id: number): Promise<void> {
    await api.delete(`/locations/${id}`);
  },
};

export default locationService;
