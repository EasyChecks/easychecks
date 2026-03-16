import api from './api';

export type LeaveType =
  | 'SICK'
  | 'PERSONAL'
  | 'VACATION'
  | 'MILITARY'
  | 'TRAINING'
  | 'MATERNITY'
  | 'STERILIZATION'
  | 'ORDINATION';

export interface CreateLeaveRequestPayload {
  leaveType: LeaveType;
  isHourly?: boolean;
  startDate: string;
  endDate: string;
  startTime?: string;
  endTime?: string;
  leaveHours?: number;
  reason?: string;
  attachmentUrl?: string;
  medicalCertificateUrl?: string;
}

export interface LeaveRequestItem {
  leaveId: number;
  leaveType: LeaveType;
  isHourly?: boolean;
  startDate: string;
  endDate: string;
  startTime?: string | null;
  endTime?: string | null;
  leaveHours?: number | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reason?: string | null;
  createdAt?: string;
}

function normalizeListResponse(data: unknown): LeaveRequestItem[] {
  if (!data || typeof data !== 'object') return [];

  const record = data as Record<string, unknown>;
  const payload = (record.data ?? record) as Record<string, unknown>;

  if (Array.isArray(payload.data)) {
    return payload.data as LeaveRequestItem[];
  }
  if (Array.isArray(payload.items)) {
    return payload.items as LeaveRequestItem[];
  }
  if (Array.isArray(payload)) {
    return payload as unknown as LeaveRequestItem[];
  }

  return [];
}

export const leaveRequestService = {
  async create(payload: CreateLeaveRequestPayload): Promise<LeaveRequestItem> {
    const response = await api.post('/leave-requests', payload);
    const data = response.data?.data ?? response.data;
    return data as LeaveRequestItem;
  },

  async getMine(params?: { status?: 'PENDING' | 'APPROVED' | 'REJECTED'; take?: number; skip?: number }): Promise<LeaveRequestItem[]> {
    const response = await api.get('/leave-requests/my', { params });
    return normalizeListResponse(response.data);
  },
};

export default leaveRequestService;
