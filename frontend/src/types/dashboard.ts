// Dashboard Types
export interface User {
  id: string;
  name: string;
  email: string;
  department: string;
  position: string;
  role: 'user' | 'admin' | 'superadmin';
  branchCode?: string;
  provinceCode?: string;
  branch?: string;
}

export interface Location {
  id: string;
  name: string;
  description?: string;
  latitude: number;
  longitude: number;
  radius: number;
  type: 'mapping' | 'event';
  team?: string;
  time?: string;
  checkInStatus: string;
  statusColor: string;
  createdBy?: {
    branch?: string;
  };
  branchCode?: string;
  provinceCode?: string;
}

export interface Event {
  id: string;
  name: string;
  locationName: string;
  date?: string;
  startDate?: string;
  startTime?: string;
  latitude: number;
  longitude: number;
  radius: number;
  status: 'ongoing' | 'completed' | 'upcoming';
  teams?: string[];
  createdBy?: {
    branch?: string;
  };
  branchCode?: string;
  provinceCode?: string;
}

export interface AttendanceStats {
  totalEmployees: number;
  absentCount: number;
  leaveCount: number;
  lateCount: number;
  onTimeCount: number;
  absentUsers: User[];
  leaveUsers: User[];
  lateUsers: User[];
  onTimeUsers: User[];
}

export interface EventStats {
  totalEvents: number;
  activeEvents: number;
  todayEvents: number;
  completedEvents: number;
  notParticipatedCount: number;
  leaveEventCount: number;
  lateEventCount: number;
  notParticipatedUsers: User[];
  leaveEventUsers: User[];
  lateEventUsers: User[];
}

export interface BranchOption {
  code: string;
  name: string;
}

export type StatsType = 'attendance' | 'event';
export type MapType = 'default' | 'satellite';
export type FilterType = 'all' | 'location' | 'event';
export type DetailType = 'absent' | 'leave' | 'late' | 'notParticipated';
