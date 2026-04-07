import type { Gender, LeaveType } from '@prisma/client';

// กำหนดกฎการลาแต่ละประเภท
export const LEAVE_RULES = {
  SICK: {
    displayName: 'ลาป่วย',
    displayNameEng: 'Sick Leave',
    iconName: 'Thermometer',
    maxDaysPerYear: 30,
    maxPaidDaysPerYear: 30,
    requireMedicalCert: 3,
    paid: true,
    genderRestriction: null,
  },
  PERSONAL: {
    displayName: 'ลากิจธุระอันจำเป็น',
    displayNameEng: 'Personal/Urgent Leave',
    iconName: 'FileText',
    maxDaysPerYear: 15,
    maxPaidDaysPerYear: 3,
    requireMedicalCert: null,
    paid: true,
    genderRestriction: null,
  },
  VACATION: {
    displayName: 'ลาพักร้อน',
    displayNameEng: 'Vacation/Holiday Leave',
    iconName: 'Plane',
    maxDaysPerYear: 6,
    maxPaidDaysPerYear: 6,
    requireMedicalCert: null,
    paid: true,
    carryOver: true,
    carryOverMaxDays: 20,
    genderRestriction: null,
  },
  MILITARY: {
    displayName: 'ลาเพื่อรับราชการทหาร',
    displayNameEng: 'Military Service Leave',
    iconName: 'Shield',
    maxDaysPerYear: 60,
    maxPaidDaysPerYear: 60,
    requireMedicalCert: null,
    paid: true,
    genderRestriction: 'MALE' as Gender,
  },
  TRAINING: {
    displayName: 'ลาฝึกอบรม',
    displayNameEng: 'Training/Educational Leave',
    iconName: 'BookOpen',
    maxDaysPerYear: null,
    maxPaidDaysPerYear: null,
    requireMedicalCert: null,
    paid: false,
    genderRestriction: null,
  },
  MATERNITY: {
    displayName: 'ลาคลอดบุตร',
    displayNameEng: 'Maternity Leave',
    iconName: 'Heart',
    maxDaysTotal: 98,
    maxDaysPerYear: 98,
    maxPaidDaysPerYear: 45,
    requireMedicalCert: true,
    paid: true,
    genderRestriction: 'FEMALE' as Gender,
  },
  STERILIZATION: {
    displayName: 'ลาทำหมัน',
    displayNameEng: 'Sterilization Leave',
    iconName: 'Stethoscope',
    maxDaysPerYear: null,
    maxPaidDaysPerYear: null,
    maxDaysTotal: null,
    requireMedicalCert: true,
    paid: true,
    genderRestriction: null,
  },
  ORDINATION: {
    displayName: 'ลาบวช',
    displayNameEng: 'Ordination/Monkhood Leave',
    iconName: 'Sparkles',
    maxDaysTotal: 120,
    maxDaysPerYear: 120,
    maxPaidDaysPerYear: 120,
    requireMedicalCert: null,
    paid: true,
    genderRestriction: 'MALE' as Gender,
  },
  PATERNITY: {
    displayName: 'ลาเพื่อช่วยเหลือภริยาคลอดบุตร',
    displayNameEng: 'Paternity/Spousal Maternity Support Leave',
    iconName: 'Heart',
    maxDaysPerYear: 15,
    maxPaidDaysPerYear: 15,
    requireMedicalCert: false,
    paid: true,
    genderRestriction: 'MALE' as Gender,
  },
} as const;

export function getLeaveTypeDisplay(leaveType: LeaveType) {
  const rules = LEAVE_RULES[leaveType];
  return {
    leaveType,
    displayName: rules?.displayName || leaveType,
    displayNameEng: rules?.displayNameEng || leaveType,
    iconName: rules?.iconName || 'FileText',
  };
}

export function getLeaveTypeRules(leaveType: LeaveType) {
  return LEAVE_RULES[leaveType];
}
