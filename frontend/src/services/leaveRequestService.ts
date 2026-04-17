import api from './api';

export interface LeaveQuotaItem {
  leaveType: string;
  usedDays: number;
  usedPaidDays: number;
  maxDaysPerYear: number | null;
  maxPaidDaysPerYear: number | null;
  maxDaysTotal?: number | null;
  remainingPaidDays: number | null;
  isPaid: boolean;
  requireMedicalCert: boolean | number;
  genderRestriction: string | null;
}

export interface LeaveRequest {
  leaveId: number;
  userId: number;
  leaveType: string;
  isHourly?: boolean;
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  leaveHours?: number;
  numberOfDays: number;
  paidDays?: number;
  reason?: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  attachmentUrl?: string;
  medicalCertificateUrl?: string;
  adminComment?: string;
  rejectionReason?: string;
  approvedByUserId?: number;
  createdAt: string;
  updatedAt: string;
  user?: {
    userId: number;
    name: string;
    employeeId: string;
  };
  approvedBy?: {
    userId: number;
    name: string;
  };
}

export interface CreateLeaveRequestDTO {
  leaveType: string;
  startDate: string;
  endDate: string;
  reason?: string;
  attachmentUrl?: string;
  medicalCertificateUrl?: string;
  isHourly?: boolean;
  startTime?: string;
  endTime?: string;
  leaveHours?: number;
}
export const leaveRequestService = {
  async getMyLeaveRequests(params?: { status?: string; query?: string; skip?: number; take?: number }) {
    const res = await api.get('/leave-requests/my', { params });
    const raw = res.data.data as { data: LeaveRequest[]; total: number };
    return { leaveRequests: raw.data ?? [], total: raw.total };
  },

  async getMyLeaveQuota() {
    const res = await api.get('/leave-requests/my/quota');
    return res.data.data as LeaveQuotaItem[];
  },

  async getMyLeaveStatistics() {
    const res = await api.get('/leave-requests/my/statistics');
    return res.data.data;
  },

  async createLeaveRequest(data: CreateLeaveRequestDTO) {
    const res = await api.post('/leave-requests', data);
    return res.data.data as LeaveRequest;
  },

  async updateLeaveRequest(id: number, data: Partial<CreateLeaveRequestDTO>) {
    const res = await api.put(`/leave-requests/${id}`, data);
    return res.data.data as LeaveRequest;
  },

  async deleteLeaveRequest(id: number) {
    const res = await api.delete(`/leave-requests/${id}`);
    return res.data;
  },

  async uploadAttachment(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64 = (reader.result as string).split(',')[1];
          const res = await api.post('/leave-requests/upload-attachment', {
            base64,
            mimeType: file.type,
            filename: file.name,
          });
          resolve(res.data.data.url as string);
        } catch (err) {
          reject(err);
        }
      };
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
  },

  // Admin / Manager
  async getAllLeaveRequests(params?: { status?: string; skip?: number; take?: number }) {
    const res = await api.get('/leave-requests', { params });
    const raw = res.data.data as { data: LeaveRequest[]; total: number };
    return { leaveRequests: raw.data ?? [], total: raw.total };
  },

  async approveLeaveRequest(id: number, adminComment?: string) {
    const res = await api.post(`/leave-requests/${id}/approve`, { adminComment });
    return res.data.data;
  },

  async rejectLeaveRequest(id: number, rejectionReason: string) {
    const res = await api.post(`/leave-requests/${id}/reject`, { rejectionReason });
    return res.data.data;
  },
};
