import type { AttendanceStatus } from '@prisma/client';
import { differenceInMinutes, parse } from 'date-fns';
import { BadRequestError } from './custom-errors.js';

const TIME_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export interface ShiftAttendancePolicy {
  startTime: string;
  gracePeriodMinutes: number;
  lateThresholdMinutes: number;
}

export interface AttendanceStatusResolution {
  status: AttendanceStatus;
  lateMinutes: number;
  message: string;
}

export interface ApprovedLateWindowInput {
  baseResolution: AttendanceStatusResolution;
  checkInTime: string;
  shiftStartTime: string;
  approvedActualTime: string;
}

function ensureValidHHMM(time: string, label: string): void {
  if (!TIME_REGEX.test(time)) {
    throw new BadRequestError(`${label}ไม่ถูกต้อง กรุณาใช้รูปแบบ HH:MM`);
  }
}

function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

export function calculateTimeDifferenceFromShift(timeHHMM: string, shiftStartHHMM: string): number {
  let diff = timeToMinutes(timeHHMM) - timeToMinutes(shiftStartHHMM);
  if (diff > 720) diff -= 1440;
  if (diff < -720) diff += 1440;
  return diff;
}

export function calculateLateMinutesFromTimes(scheduledTime: string, actualTime: string): number {
  ensureValidHHMM(scheduledTime, 'รูปแบบเวลาที่กำหนด');
  ensureValidHHMM(actualTime, 'รูปแบบเวลาที่มาจริง');

  try {
    const baseDate = '2000-01-01';
    const scheduled = parse(`${baseDate} ${scheduledTime}`, 'yyyy-MM-dd HH:mm', new Date());
    const actual = parse(`${baseDate} ${actualTime}`, 'yyyy-MM-dd HH:mm', new Date());
    const minutes = differenceInMinutes(actual, scheduled);
    return minutes > 0 ? minutes : 0;
  } catch {
    throw new BadRequestError('รูปแบบเวลาไม่ถูกต้อง กรุณาใช้รูปแบบ HH:MM');
  }
}

export function evaluateAttendanceStatus(
  checkInTime: string,
  shiftPolicy: ShiftAttendancePolicy,
): AttendanceStatusResolution {
  const diff = calculateTimeDifferenceFromShift(checkInTime, shiftPolicy.startTime);
  const grace = shiftPolicy.gracePeriodMinutes;
  const threshold = shiftPolicy.lateThresholdMinutes;

  if (diff <= grace) {
    const earlyOrLate = diff <= 0 ? `มาก่อน ${Math.abs(diff)} นาที` : 'ตรงเวลาพอดี';
    return { status: 'ON_TIME', lateMinutes: 0, message: `เข้างานตรงเวลา (${earlyOrLate})` };
  }

  if (diff <= threshold) {
    return { status: 'LATE', lateMinutes: diff, message: `มาสาย ${diff} นาที` };
  }

  return {
    status: 'ABSENT',
    lateMinutes: diff,
    message: `สายเกิน ${threshold} นาที - ถือว่าขาดงาน`,
  };
}

export function resolveAttendanceWithApprovedLateWindow(
  input: ApprovedLateWindowInput,
): AttendanceStatusResolution {
  const checkInDiff = calculateTimeDifferenceFromShift(input.checkInTime, input.shiftStartTime);
  const approvedDiff = Math.max(
    0,
    calculateTimeDifferenceFromShift(input.approvedActualTime, input.shiftStartTime),
  );

  // เกินกรอบอนุมัติแม้ 1 นาที ให้ถือว่า ABSENT ตาม policy
  if (checkInDiff > approvedDiff) {
    return {
      status: 'ABSENT',
      lateMinutes: Math.max(0, checkInDiff),
      message: `เลยเวลามาสายที่อนุมัติ (${input.approvedActualTime}) แม้ 1 นาที - ถือว่าขาดงาน`,
    };
  }

  if (input.baseResolution.status === 'ON_TIME') {
    return input.baseResolution;
  }

  return {
    status: 'LATE_APPROVED',
    lateMinutes: Math.max(0, checkInDiff),
    message: `มาสาย ${Math.max(0, checkInDiff)} นาที (อยู่ในช่วงที่อนุมัติถึง ${input.approvedActualTime})`,
  };
}
