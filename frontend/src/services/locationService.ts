/**
 * locationService.ts
 * ─────────────────────────────────────────
 * HTTP client สำหรับ Location API
 * Base URL: /api/locations
 */

import api from './api';

export type LocationType = 'OFFICE' | 'BRANCH' | 'EVENT' | 'SITE' | 'MEETING' | 'OTHER';

export const LOCATION_TYPE_LABELS: Record<LocationType, string> = {
  OFFICE: 'สำนักงาน',
  BRANCH: 'สาขา',
  EVENT: 'กิจกรรม',
  SITE: 'ไซต์งาน',
  MEETING: 'ห้องประชุม',
  OTHER: 'อื่นๆ',
};

export interface LocationItem {
  locationId: number;
  locationName: string;
  address?: string;
  locationType: LocationType;
  latitude: number;
  longitude: number;
  radius: number;
  description?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string | null;
  deletedAt?: string | null;
  deleteReason?: string | null;
  deletedBy?: { userId: number; firstName: string; lastName: string } | null;
}

export interface LocationListResponse {
  data: LocationItem[];
  total: number;
  active: number;
  inactive: number;
}

export interface CreateLocationRequest {
  locationName: string;
  address?: string;
  locationType: LocationType;
  latitude: number;
  longitude: number;
  radius?: number;
  description?: string;
  isActive?: boolean;
}

export interface LocationListParams {
  search?: string;
  locationType?: LocationType;
  isActive?: boolean;
  skip?: number;
  take?: number;
  onlyDeleted?: boolean;
}

// ── Service Methods ──

export const locationService = {
  /**
   * GET /api/locations - ดึงรายการสถานที่ทั้งหมด
   */
  async getAll(params?: LocationListParams): Promise<LocationListResponse> {
    const res = await api.get('/locations', { params });
    const raw = res.data?.data ?? res.data;
    if (Array.isArray(raw)) {
      return { data: raw, total: raw.length, active: 0, inactive: 0 };
    }
    return raw;
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
   * PUT /api/locations/:id - แก้ไขสถานที่ (Admin/SuperAdmin)
   */
  async update(id: number, data: Partial<CreateLocationRequest>): Promise<LocationItem> {
    const res = await api.put(`/locations/${id}`, data);
    return res.data.data;
  },

  /**
   * DELETE /api/locations/:id - ลบสถานที่ (Admin/SuperAdmin - soft delete)
   */
  async delete(id: number, deleteReason?: string): Promise<void> {
    await api.delete(`/locations/${id}`, { data: { deleteReason } });
  },

  /**
   * POST /api/locations/:id/restore - กู้คืนสถานที่
   */
  async restore(id: number): Promise<LocationItem> {
    const res = await api.post(`/locations/${id}/restore`);
    return res.data.data;
  },
};

export default locationService;
