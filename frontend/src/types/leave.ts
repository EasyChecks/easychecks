// Leave Quota Management Types

export interface LeaveQuotaSettings {
  maxDaysPerYear: number | null;
  maxPaidDaysPerYear: number | null;
  maxDaysTotal: number | null;
  paid: boolean;
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
  maxDaysPerYear: number | string;
  maxPaidDaysPerYear: number | string;
  maxDaysTotal: number | string;
  paid: boolean;
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
  | 'SICK'
  | 'PERSONAL'
  | 'VACATION'
  | 'MILITARY'
  | 'TRAINING'
  | 'MATERNITY'
  | 'STERILIZATION'
  | 'ORDINATION'
  | 'PATERNITY';

export const DEFAULT_LEAVE_QUOTA: LeaveQuotaMap = {
  SICK: { maxDaysPerYear: 30, maxPaidDaysPerYear: 30, maxDaysTotal: null, paid: true, requireDocument: true, documentAfterDays: 3 },
  PERSONAL: { maxDaysPerYear: 15, maxPaidDaysPerYear: 3, maxDaysTotal: null, paid: true, requireDocument: false, documentAfterDays: 0 },
  VACATION: { maxDaysPerYear: 6, maxPaidDaysPerYear: 6, maxDaysTotal: null, paid: true, requireDocument: false, documentAfterDays: 0 },
  MILITARY: { maxDaysPerYear: 60, maxPaidDaysPerYear: 60, maxDaysTotal: null, paid: true, requireDocument: false, documentAfterDays: 0 },
  TRAINING: { maxDaysPerYear: null, maxPaidDaysPerYear: null, maxDaysTotal: null, paid: false, requireDocument: false, documentAfterDays: 0 },
  MATERNITY: { maxDaysPerYear: 98, maxPaidDaysPerYear: 45, maxDaysTotal: 98, paid: true, requireDocument: true, documentAfterDays: 0 },
  STERILIZATION: { maxDaysPerYear: null, maxPaidDaysPerYear: null, maxDaysTotal: null, paid: true, requireDocument: true, documentAfterDays: 0 },
  ORDINATION: { maxDaysPerYear: 120, maxPaidDaysPerYear: 120, maxDaysTotal: 120, paid: true, requireDocument: false, documentAfterDays: 0 },
  PATERNITY: { maxDaysPerYear: 15, maxPaidDaysPerYear: 15, maxDaysTotal: null, paid: true, requireDocument: false, documentAfterDays: 0 },
};

export const LEAVE_TYPE_DESCRIPTIONS: Record<LeaveType, string> = {
  SICK: 'ลาเนื่องจากเจ็บป่วย สามารถใช้สิทธิ์ได้ตามจำนวนวันที่กำหนด',
  PERSONAL: 'ลาเพื่อธุระส่วนตัว ตามสิทธิ์ที่กำหนด',
  VACATION: 'ลาพักผ่อนประจําปี',
  MATERNITY: 'ลาเพื่อคลอดบุตร สำหรับพนักงานหญิง',
  STERILIZATION: 'ลาเพื่อทำหมัน ตามระยะเวลาที่แพทย์กำหนด',
  MILITARY: 'ลาเพื่อรับราชการทหาร',
  TRAINING: 'ลาเพื่อฝึกอบรมหรือพัฒนาความรู้ความสามารถ',
  ORDINATION: 'ลาเพื่ออุปสมบท',
  PATERNITY: 'ลาเพื่อช่วยเหลือภริยาคลอดบุตร',
};
