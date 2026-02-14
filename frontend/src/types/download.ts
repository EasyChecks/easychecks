// Download Data Types

export interface DataOption {
  id: 'attendanceData' | 'personalData' | 'eventStats';
  label: string;
  description: string;
  color: string;
}

export interface Branch {
  id: string;
  name: string;
}

export interface Report {
  id: number;
  title: string;
  subtitle: string;
  description: string;
  color: string;
}

export interface ReportMetadata {
  title: string;
  startDate: string;
  endDate: string;
  statistics: Statistics;
}

export interface Statistics {
  totalEmployees: number;
  totalDepartments: number;
  avgAttendanceRate: number;
}

export interface ReportData {
  [key: string]: string | number;
}

export const DATA_OPTIONS: DataOption[] = [
  {
    id: 'attendanceData',
    label: 'ข้อมูลการเข้างาน',
    description: 'เวลาเข้า-ออก, สถานะ, ชั่วโมงทำงาน',
    color: 'blue'
  },
  {
    id: 'personalData',
    label: 'ข้อมูลส่วนตัว',
    description: 'ชื่อ, แผนก, ตำแหน่ง, ติดต่อ',
    color: 'purple'
  },
  {
    id: 'eventStats',
    label: 'สถิติกิจกรรม',
    description: 'การเข้าร่วมกิจกรรม, อีเวนต์',
    color: 'orange'
  }
];
