// Leave Quota Management Types

export interface LeaveQuotaSettings {
  totalDays: number;
  requireDocument: boolean;
  documentAfterDays: number;
}

export interface LeaveQuotaMap {
  [leaveType: string]: LeaveQuotaSettings;
}

export interface IndividualQuotas {
  [userId: string]: LeaveQuotaMap;
}

export interface LeaveQuotaEditForm {
  totalDays: number | string;
  requireDocument: boolean;
  documentAfterDays: number | string;
}

export interface Branch {
  id: string;
  name: string;
  provinceCode?: string;
}

export interface AlertState {
  isOpen: boolean;
  type: 'success' | 'error' | 'warning' | 'info';
  title: string;
  message: string;
  autoClose?: boolean;
}

export type LeaveType = 
  | 'ลาป่วย'
  | 'ลากิจ'
  | 'ลาพักร้อน'
  | 'ลาคลอด'
  | 'ลาเพื่อทำหมัน'
  | 'ลาเพื่อรับราชการทหาร'
  | 'ลาเพื่อฝึกอบรม'
  | 'ลาไม่รับค่าจ้าง';

export const DEFAULT_LEAVE_QUOTA: LeaveQuotaMap = {
  'ลาป่วย': { totalDays: 60, requireDocument: true, documentAfterDays: 3 },
  'ลากิจ': { totalDays: 45, requireDocument: false, documentAfterDays: 0 },
  'ลาพักร้อน': { totalDays: 10, requireDocument: false, documentAfterDays: 0 },
  'ลาคลอด': { totalDays: 90, requireDocument: false, documentAfterDays: 0 },
  'ลาเพื่อทำหมัน': { totalDays: 30, requireDocument: true, documentAfterDays: 0 },
  'ลาเพื่อรับราชการทหาร': { totalDays: 60, requireDocument: true, documentAfterDays: 0 },
  'ลาเพื่อฝึกอบรม': { totalDays: 30, requireDocument: false, documentAfterDays: 0 },
  'ลาไม่รับค่าจ้าง': { totalDays: 90, requireDocument: false, documentAfterDays: 0 }
};

export const LEAVE_TYPE_DESCRIPTIONS: Record<LeaveType, string> = {
  'ลาป่วย': 'ลาเนื่องจากเจ็บป่วย สามารถใช้สิทธิ์ได้ตามจำนวนวันที่กำหนด',
  'ลากิจ': 'ลาเพื่อธุระส่วนตัว ปีแรก 15 วัน ปีถัดไป 45 วัน',
  'ลาพักร้อน': 'ลาพักผ่อนประจําปี สะสมได้ไม่เกิน 20 วัน',
  'ลาคลอด': 'ลาเพื่อคลอดบุตร สำหรับพนักงานหญิง',
  'ลาเพื่อทำหมัน': 'ลาเพื่อทำหมัน ตามระยะเวลาที่แพทย์กำหนด',
  'ลาเพื่อรับราชการทหาร': 'ลาเพื่อเรียกพล ฝึกวิชาทหาร หรือทดสอบความพร้อม',
  'ลาเพื่อฝึกอบรม': 'ลาเพื่อฝึกอบรมหรือพัฒนาความรู้ความสามารถ',
  'ลาไม่รับค่าจ้าง': 'ลาเพื่อธุระส่วนตัว ติดตามคู่สมรส หรือพักฟื้น'
};
