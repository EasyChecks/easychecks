import api from './api';

export interface LateRequest {
  id: number;
  userId: number;
  attendanceId?: number;
  requestDate: string;
  scheduledTime: string;
  actualTime: string;
  lateMinutes: number;
  reason: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  attachmentUrl?: string;
  adminComment?: string;
  rejectionReason?: string;
  approvedByUserId?: number;
  createdAt: string;
  updatedAt: string;
  user?: {
    userId: number;
    name?: string;
    firstName?: string;
    lastName?: string;
    employeeId?: string;
  };
  approvedBy?: {
    userId: number;
    name: string;
  };
}

export interface CreateLateRequestDTO {
  requestDate: string;
  scheduledTime: string;
  actualTime: string;
  reason: string;
  attendanceId?: number;
  attachmentUrl?: string;
}

export interface UpdateLateRequestDTO {
  scheduledTime?: string;
  actualTime?: string;
  reason?: string;
  attachmentUrl?: string;
}

export const lateRequestService = {
  async getMyLateRequests(params?: { status?: string; query?: string; skip?: number; take?: number }) {
    const res = await api.get('/late-requests/my', { params });
    const raw = res.data.data as { data: LateRequest[]; total: number };
    return { lateRequests: raw.data ?? [], total: raw.total };
  },

  async getMyLateStatistics() {
    const res = await api.get('/late-requests/my/statistics');
    return res.data.data;
  },

  async createLateRequest(data: CreateLateRequestDTO) {
    const res = await api.post('/late-requests', data);
    return res.data.data as LateRequest;
  },

  async updateLateRequest(id: number, data: UpdateLateRequestDTO) {
    const res = await api.put(`/late-requests/${id}`, data);
    return res.data.data as LateRequest;
  },

  async deleteLateRequest(id: number) {
    const res = await api.delete(`/late-requests/${id}`);
    return res.data;
  },

  // Admin / Manager
  async getAllLateRequests(params?: { status?: string; skip?: number; take?: number }) {
    const res = await api.get('/late-requests', { params });
    const raw = res.data.data as { data: LateRequest[]; total: number };
    return { lateRequests: raw.data ?? [], total: raw.total };
  },

  async approveLateRequest(id: number, adminComment?: string) {
    const res = await api.post(`/late-requests/${id}/approve`, { adminComment });
    return res.data.data;
  },

  async rejectLateRequest(id: number, rejectionReason: string) {
    const res = await api.post(`/late-requests/${id}/reject`, { rejectionReason });
    return res.data.data;
  },

  async uploadAttachment(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = (reader.result as string).split(',')[1];
          const res = await api.post('/late-requests/upload-attachment', {
            base64,
            mimeType: file.type,
            filename: file.name,
          });
          resolve(res.data.data.url as string);
        } catch (err) {
          reject(err);
        }
      };
      reader.readAsDataURL(file);
    });
  },
};
