export interface Shift {
  id: number;
  name: string;
  shiftType: 'REGULAR' | 'SPECIFIC_DAY' | 'CUSTOM';
  startTime: string;
  endTime: string;
  gracePeriodMinutes: number;
  lateThresholdMinutes: number;
  specificDays?: ('MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY')[];
  customDate?: string;
  locationId?: number;
  userId?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
  location?: {
    id: number;
    name: string;
    address?: string;
    latitude: number;
    longitude: number;
    radius: number;
  };
  user?: {
    id: number;
    name: string;
    employeeId: string;
  };
}

export interface Attendance {
  id: number;
  userId: number;
  shiftId: number;
  locationId?: number;
  checkIn: string;
  checkOut?: string;
  checkInPhoto?: string;
  checkOutPhoto?: string;
  checkInLatitude?: number;
  checkInLongitude?: number;
  checkOutLatitude?: number;
  checkOutLongitude?: number;
  checkInAddress?: string;
  checkOutAddress?: string;
  checkInDistance?: number;
  checkOutDistance?: number;
  status: 'ON_TIME' | 'LATE' | 'ABSENT';
  lateMinutes?: number;
  note?: string;
  createdAt: string;
  updatedAt: string;
  shift?: Shift;
  user?: {
    id: number;
    name: string;
    employeeId: string;
  };
  location?: {
    id: number;
    name: string;
    address?: string;
  };
}

export interface CheckInRequest {
  shiftId?: number;
  locationId?: number;
  photo?: string;
  latitude: number;
  longitude: number;
  address?: string;
}

export interface CheckOutRequest {
  shiftId?: number;
  photo?: string;
  latitude: number;
  longitude: number;
  address?: string;
}

export interface AttendanceHistoryParams {
  startDate?: string;
  endDate?: string;
  status?: 'ON_TIME' | 'LATE' | 'ABSENT';
}

export interface AttendanceListParams extends AttendanceHistoryParams {
  userId?: number;
}

export interface CreateShiftRequest {
  name: string;
  shiftType: 'REGULAR' | 'SPECIFIC_DAY' | 'CUSTOM';
  startTime: string;
  endTime: string;
  gracePeriodMinutes?: number;
  lateThresholdMinutes?: number;
  specificDays?: ('MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY')[];
  customDate?: string;
  locationId?: number;
  userId?: number;
}

export interface UpdateShiftRequest {
  name?: string;
  shiftType?: 'REGULAR' | 'SPECIFIC_DAY' | 'CUSTOM';
  startTime?: string;
  endTime?: string;
  gracePeriodMinutes?: number;
  lateThresholdMinutes?: number;
  specificDays?: ('MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY')[];
  customDate?: string;
  locationId?: number;
  userId?: number;
  isActive?: boolean;
}

export interface ShiftListParams {
  userId?: number;
  shiftType?: 'REGULAR' | 'SPECIFIC_DAY' | 'CUSTOM';
  isActive?: boolean;
}

export interface UpdateAttendanceRequest {
  status?: 'ON_TIME' | 'LATE' | 'ABSENT';
  note?: string;
  checkIn?: string;
  checkOut?: string;
}
