export interface EmergencyContact {
  name: string;
  phone: string;
  relation: string;
}

export interface WorkHistory {
  company: string;
  position: string;
  startDate: string;
  endDate: string;
  description?: string;
}

export interface Education {
  institution: string;
  degree: string;
  fieldOfStudy: string;
  graduationYear: string;
}

export interface AttendanceCheckData {
  time: string;
  location?: string;
  coordinates?: {
    lat: number;
    lng: number;
  };
  status?: 'onTime' | 'late';
  note?: string;
}

export interface AttendanceRecord {
  date: string;
  checkIn?: AttendanceCheckData;
  checkOut?: AttendanceCheckData;
}

export interface User {
  id: string;
  name: string;
  email: string;
  phone: string;
  employeeId: string;
  username: string;
  password: string;
  role: 'user' | 'manager' | 'admin' | 'superadmin';
  department: string;
  position: string;
  title?: string;
  gender?: string;
  status: 'active' | 'leave' | 'suspended' | 'pending';
  branch?: string;
  branchCode?: string;
  provinceCode?: string;
  profileImage?: string;
  birthDate?: string;
  age?: string | number;
  address?: string;
  nationalId?: string;
  bloodType?: string;
  salary?: string | number;
  idCardNumber?: string;
  passportNumber?: string;
  emergencyContact?: EmergencyContact;
  startDate?: string;
  workPeriod?: string;
  workHistory?: WorkHistory[];
  education?: Education[];
  skills?: string[];
  attendanceRecords?: AttendanceRecord[];
  adminAccount?: string;
  adminPassword?: string;
}

export interface AlertDialogState {
  isOpen: boolean;
  type: 'info' | 'success' | 'error' | 'warning';
  title: string;
  message: string;
  autoClose?: boolean;
}

export interface AttendanceEditData {
  userId?: string;
  date?: string;
  type: 'checkIn' | 'checkOut';
  data?: Partial<AttendanceCheckData>;
  record?: AttendanceRecord;
}

export interface BranchOption {
  value: string;
  label: string;
}

export interface CsvUserData {
  name: string;
  email: string;
  provinceCode: string;
  branchCode: string;
  role: string;
  department: string;
  position: string;
  nationalId: string;
  phone?: string;
  address?: string;
  birthDate?: string;
  [key: string]: string | undefined;
}
