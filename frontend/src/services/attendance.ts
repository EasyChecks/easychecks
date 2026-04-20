import api from './api';
import {
  Attendance,
  CheckInRequest,
  CheckOutRequest,
  AttendanceHistoryParams,
  AttendanceListParams,
  UpdateAttendanceRequest,
} from '@/types/attendance';

// normalize โครง response ที่หลากหลายจาก endpoint เก่า/ใหม่ให้ UI ใช้ shape เดียวกัน
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function mapAttendance(raw: any): Attendance {
  if (!raw) return raw;
  return {
    ...raw,
    id: raw.attendanceId ?? raw.id,
    checkIn: raw.checkIn,
    checkOut: raw.checkOut ?? undefined,
    checkInPhoto: raw.checkInPhoto ?? undefined,
    checkOutPhoto: raw.checkOutPhoto ?? undefined,
    checkInLatitude: raw.checkInLat ?? raw.checkInLatitude,
    checkInLongitude: raw.checkInLng ?? raw.checkInLongitude,
    checkOutLatitude: raw.checkOutLat ?? raw.checkOutLatitude,
    checkOutLongitude: raw.checkOutLng ?? raw.checkOutLongitude,
    checkInAddress: raw.checkInAddress ?? undefined,
    checkOutAddress: raw.checkOutAddress ?? undefined,
    checkInDistance: raw.checkInDistance ?? undefined,
    checkOutDistance: raw.checkOutDistance ?? undefined,
    workedMinutes: raw.workedMinutes ?? undefined,
    breakDeductedMinutes: raw.breakDeductedMinutes ?? undefined,
    leaveDeductedMinutes: raw.leaveDeductedMinutes ?? undefined,
    netWorkedMinutes: raw.netWorkedMinutes ?? undefined,
    shift: raw.shift ? {
      ...raw.shift,
      id: raw.shift.shiftId ?? raw.shift.id,
      name: raw.shift.name ?? raw.shift.shiftName ?? '',
      location: raw.shift.location
        ? {
            ...raw.shift.location,
            id: raw.shift.location.locationId ?? raw.shift.location.id,
            name: raw.shift.location.name ?? raw.shift.location.locationName ?? '',
          }
        : undefined,
    } : undefined,
    location: raw.location ? {
      ...raw.location,
      id: raw.location.locationId ?? raw.location.id,
      name: raw.location.name ?? raw.location.locationName ?? '',
    } : undefined,
    user: raw.user ? {
      ...raw.user,
      id: raw.user.userId ?? raw.user.id,
      name: raw.user.name ?? `${raw.user.firstName ?? ''} ${raw.user.lastName ?? ''}`.trim(),
      avatarUrl: raw.user.avatarUrl ?? undefined,
    } : undefined,
  };
}

export const attendanceService = {
  async checkIn(data: CheckInRequest): Promise<Attendance> {
    const response = await api.post('/attendance/check-in', data);
    return mapAttendance(response.data.data);
  },

  async checkOut(data: CheckOutRequest): Promise<Attendance> {
    const response = await api.post('/attendance/check-out', data);
    return mapAttendance(response.data.data);
  },

  async getMyHistory(userId: number, params?: AttendanceHistoryParams): Promise<Attendance[]> {
    const response = await api.get(`/attendance/history/${userId}`, { params });
    return (response.data.data ?? []).map(mapAttendance);
  },

  async getAll(params?: AttendanceListParams): Promise<Attendance[]> {
    const response = await api.get('/attendance', { params });
    return (response.data.data ?? []).map(mapAttendance);
  },

  async getById(id: number): Promise<Attendance> {
    const response = await api.get(`/attendance/${id}`);
    return mapAttendance(response.data.data);
  },

  async update(id: number, data: UpdateAttendanceRequest): Promise<Attendance> {
    const response = await api.put(`/attendance/${id}`, data);
    return mapAttendance(response.data.data);
  },

  async delete(id: number, deleteReason: string): Promise<void> {
    await api.delete(`/attendance/${id}`, { data: { deleteReason } });
  },

  // ตรึงแหล่งคำนวณระยะไว้ที่ backend เพื่อลดความต่างผลลัพธ์ข้ามอุปกรณ์
  async checkGps(params: {
    latitude: number;
    longitude: number;
    locationId?: number;
    shiftId?: number;
  }): Promise<{
    withinRadius: boolean;
    distance: number | null;
    radius: number | null;
    location: { locationId: number; locationName: string; latitude: number; longitude: number; address?: string } | null;
    message: string;
  }> {
    const res = await api.post('/attendance/check-gps', params);
    return res.data.data;
  },

  async getTodayStatus(userId: number): Promise<{
    hasCheckedIn: boolean;
    hasCheckedOut: boolean;
    attendance?: Attendance;
  }> {
    try {
      const response = await api.get(`/attendance/today/${userId}`);
      const data = response.data.data;

      // ตัด event attendance ออกเพื่อไม่ให้ปุ่มเข้า/ออกงานในกะผิดสถานะ
      const rows = Array.isArray(data)
        ? data
        : (data ? [data] : []);

      const rawShiftAttendance = rows.find((row) => {
        if (!row) return false;
        const hasEventId = row.eventId !== undefined && row.eventId !== null;
        const hasShiftId = row.shiftId !== undefined && row.shiftId !== null;
        return !hasEventId && hasShiftId;
      }) ?? null;

      const todayAttendance = rawShiftAttendance ? mapAttendance(rawShiftAttendance) : null;

      return {
        hasCheckedIn: !!todayAttendance,
        hasCheckedOut: !!todayAttendance?.checkOut,
        attendance: todayAttendance ?? undefined,
      };
    } catch (error) {
      console.error('Error fetching today status:', error);
      // fallback เป็นยังไม่ลงเวลาเพื่อป้องกัน UI ล็อกผู้ใช้ผิดฝั่ง
      return {
        hasCheckedIn: false,
        hasCheckedOut: false,
      };
    }
  },
};

export default attendanceService;
