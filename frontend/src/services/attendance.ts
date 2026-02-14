import api from './api';
import {
  Attendance,
  CheckInRequest,
  CheckOutRequest,
  AttendanceHistoryParams,
  AttendanceListParams,
  UpdateAttendanceRequest,
} from '@/types/attendance';

export const attendanceService = {
  /**
   * Check-in to work
   */
  async checkIn(data: CheckInRequest): Promise<Attendance> {
    const response = await api.post('/attendance/check-in', data);
    return response.data.data;
  },

  /**
   * Check-out from work
   */
  async checkOut(data: CheckOutRequest): Promise<Attendance> {
    const response = await api.post('/attendance/check-out', data);
    return response.data.data;
  },

  /**
   * Get my attendance history
   */
  async getMyHistory(params?: AttendanceHistoryParams): Promise<Attendance[]> {
    const response = await api.get('/attendance/history', { params });
    return response.data.data;
  },

  /**
   * Get all attendance records (Admin only)
   */
  async getAll(params?: AttendanceListParams): Promise<Attendance[]> {
    const response = await api.get('/attendance', { params });
    return response.data.data;
  },

  /**
   * Get attendance by ID
   */
  async getById(id: number): Promise<Attendance> {
    const response = await api.get(`/attendance/${id}`);
    return response.data.data;
  },

  /**
   * Update attendance (Admin only)
   */
  async update(id: number, data: UpdateAttendanceRequest): Promise<Attendance> {
    const response = await api.put(`/attendance/${id}`, data);
    return response.data.data;
  },

  /**
   * Delete attendance (Admin only)
   */
  async delete(id: number): Promise<void> {
    await api.delete(`/attendance/${id}`);
  },

  /**
   * Get today's attendance status for current user
   */
  async getTodayStatus(): Promise<{
    hasCheckedIn: boolean;
    hasCheckedOut: boolean;
    attendance?: Attendance;
  }> {
    try {
      const today = new Date().toISOString().split('T')[0];
      const response = await api.get('/attendance/history', {
        params: { startDate: today, endDate: today }
      });
      const todayAttendance = response.data.data[0];
      
      return {
        hasCheckedIn: !!todayAttendance,
        hasCheckedOut: !!todayAttendance?.checkOut,
        attendance: todayAttendance,
      };
    } catch (error) {
      console.error('Error fetching today status:', error);
      return {
        hasCheckedIn: false,
        hasCheckedOut: false,
      };
    }
  },
};

export default attendanceService;
