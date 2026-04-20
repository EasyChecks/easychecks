import { AttendanceStatus } from '@prisma/client';
import type { Shift, Location } from '@prisma/client';
import { getDistance } from 'geolib';
import { prisma } from '../lib/prisma.js';
import { createAuditLog, AuditAction } from './audit.service.js';
import { getThaiDayRange, getThaiTimeHHMM } from '../utils/timezone.js';
import { uploadAttendancePhotoToSupabase } from '../utils/supabase-storage.js';

const THAI_OFFSET_MS = 7 * 60 * 60 * 1000;
const AUTO_CHECKOUT_GRACE_MINUTES = 30;
const MIN_CHECKOUT_MINUTES_AFTER_CHECKIN = 1;
const MAX_EARLY_CHECKIN_MINUTES = 30;

/**
 * เก็บกติกาการลงเวลาไว้ที่เดียวเพื่อให้ controller เหลือหน้าที่ HTTP อย่างเดียว
 * และทำให้เปลี่ยน transport ได้โดยไม่แตะ business rule.
 */

export interface CheckInDTO {
  userId: number;
  shiftId?: number;
  locationId?: number;
  eventId?: number;
  photo?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
}

export interface CheckOutDTO {
  userId: number;
  attendanceId?: number;
  shiftId?: number;
  photo?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
}

/**
 * แปลงเวลา "HH:MM" เป็นนาที
 * ทำไม? เพื่อให้คำนวณผลต่างเวลาด้วย arithmetic ธรรมดา แทนการ parse Date
 * เช่น "08:30" → 510
 */
function timeToMinutes(time: string): number {
  const [hours, minutes] = time.split(':').map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

/**
 * คำนวณผลต่างเวลา checkIn − shiftStart (หน่วย: นาที)
 *
 * ทำไมต้องจัดการ edge case ±720?
 * กะข้ามเที่ยงคืน เช่น กะ 23:00–07:00 ถ้า check-in 00:30
 * ผลต่างปกติ = 0:30 − 23:00 = −1350 → ผิด
 * ต้องบวก 1440 (24h) เพื่อให้ได้ +90 (สาย 90 นาที) ✓
 */
function calculateTimeDifference(checkInTime: string, shiftStart: string): number {
  let diff = timeToMinutes(checkInTime) - timeToMinutes(shiftStart);
  if (diff > 720) diff -= 1440;   // check-in ข้ามเที่ยงคืนไปแล้ว
  if (diff < -720) diff += 1440;  // กะข้ามเที่ยงคืน, check-in หลังเที่ยงคืน
  return diff;
}

/**
 * คำนวณระยะห่างระหว่างพนักงานกับสถานที่ (หน่วย: เมตร)
 *
 * ทำไมใช้ geolib แทน pure Haversine สูตรเอง?
 * - geolib ผ่าน unit test จาก community มาแล้ว → ไม่ต้อง maintain สูตรเอง
 * - รองรับ edge case ขั้วโลก, antimeridian ได้ถูกต้อง
 * - API ชัดเจน อ่านง่าย แทนที่จะมีตัวแปร φ, Δλ ที่งงกัน
 *
 * geolib.getDistance({ latitude, longitude }, { latitude, longitude }) → เมตร
 */
function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  return getDistance(
    { latitude: lat1, longitude: lon1 },
    { latitude: lat2, longitude: lon2 },
  );
}

const THAI_DAY_ENUMS = [
  'SUNDAY',
  'MONDAY',
  'TUESDAY',
  'WEDNESDAY',
  'THURSDAY',
  'FRIDAY',
  'SATURDAY',
] as const;

type ThaiDayEnum = (typeof THAI_DAY_ENUMS)[number];

function toThaiDate(date: Date): Date {
  return new Date(date.getTime() + THAI_OFFSET_MS);
}

function toThaiDateKey(date: Date): string {
  const thai = toThaiDate(date);
  const year = thai.getUTCFullYear();
  const month = String(thai.getUTCMonth() + 1).padStart(2, '0');
  const day = String(thai.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function toThaiHHMM(date: Date): string {
  const thai = toThaiDate(date);
  const hour = String(thai.getUTCHours()).padStart(2, '0');
  const minute = String(thai.getUTCMinutes()).padStart(2, '0');
  return `${hour}:${minute}`;
}

function shiftMatchesAttendanceDate(shift: Shift, checkIn: Date): boolean {
  const thaiDay = THAI_DAY_ENUMS[toThaiDate(checkIn).getUTCDay()] as ThaiDayEnum;

  if (shift.shiftType === 'REGULAR') {
    return thaiDay !== 'SATURDAY' && thaiDay !== 'SUNDAY';
  }

  if (shift.shiftType === 'SPECIFIC_DAY') {
    return (shift.specificDays ?? []).includes(thaiDay);
  }

  if (shift.shiftType === 'CUSTOM') {
    if (!shift.customDate) return false;
    return toThaiDateKey(shift.customDate) === toThaiDateKey(checkIn);
  }

  return true;
}

function inferShiftForAttendance(checkIn: Date, userShifts: Shift[]): Shift | null {
  if (userShifts.length === 0) return null;

  const checkInHHMM = toThaiHHMM(checkIn);
  const candidates = userShifts.filter((shift) => shiftMatchesAttendanceDate(shift, checkIn));
  if (candidates.length === 0) return null;

  let bestShift: Shift | null = null;
  let bestScore = Number.POSITIVE_INFINITY;

  for (const shift of candidates) {
    const score = Math.abs(calculateTimeDifference(checkInHHMM, shift.startTime));
    if (score < bestScore) {
      bestScore = score;
      bestShift = shift;
      continue;
    }

    if (score === bestScore && bestShift && shift.isActive && !bestShift.isActive) {
      bestShift = shift;
    }
  }

  return bestShift;
}

type AttendanceRowWithShift = {
  userId: number;
  checkIn: Date;
  checkOut: Date | null;
  shift: Shift | null;
};

async function attachMissingShiftRelations<T extends AttendanceRowWithShift>(rows: T[]): Promise<T[]> {
  if (rows.length === 0 || rows.every((row) => row.shift !== null)) {
    return rows;
  }

  const missingUserIds = Array.from(
    new Set(rows.filter((row) => row.shift === null).map((row) => row.userId)),
  );

  if (missingUserIds.length === 0) {
    return rows;
  }

  const userShifts = await prisma.shift.findMany({
    where: {
      userId: { in: missingUserIds },
      isDeleted: false,
    },
    orderBy: [
      { isActive: 'desc' },
      { shiftId: 'desc' },
    ],
  });

  const shiftsByUserId = new Map<number, Shift[]>();
  for (const shift of userShifts) {
    const existing = shiftsByUserId.get(shift.userId) ?? [];
    existing.push(shift);
    shiftsByUserId.set(shift.userId, existing);
  }

  return rows.map((row) => {
    if (row.shift !== null) return row;

    const inferredShift = inferShiftForAttendance(row.checkIn, shiftsByUserId.get(row.userId) ?? []);
    if (!inferredShift) return row;

    return {
      ...row,
      shift: inferredShift,
    };
  });
}

function getShiftEndDateFromCheckIn(checkIn: Date, shiftEndTime: string): Date {
  const [endHour, endMinute] = shiftEndTime.split(':').map((v) => Number(v));

  const thaiCheckIn = new Date(checkIn.getTime() + THAI_OFFSET_MS);
  const thaiShiftEnd = new Date(thaiCheckIn);
  thaiShiftEnd.setUTCHours(endHour ?? 0, endMinute ?? 0, 0, 0);

  // กะข้ามวัน: เวลาเลิก <= เวลาเข้างานในวันเดียวกัน ให้เลื่อนไปวันถัดไป
  if (thaiShiftEnd.getTime() <= thaiCheckIn.getTime()) {
    thaiShiftEnd.setUTCDate(thaiShiftEnd.getUTCDate() + 1);
  }

  return new Date(thaiShiftEnd.getTime() - THAI_OFFSET_MS);
}

function getShiftDurationMinutes(startTime: string, endTime: string): number {
  const start = timeToMinutes(startTime);
  const end = timeToMinutes(endTime);
  let diff = end - start;
  if (diff <= 0) diff += 24 * 60;
  return diff;
}

async function getApprovedHourlyLeaveMinutes(userId: number, baseDate: Date): Promise<number> {
  const { start: dayStart } = getThaiDayRange(baseDate);

  const hourlyLeaves = await prisma.leaveRequest.findMany({
    where: {
      userId,
      status: 'APPROVED',
      isHourly: true,
      startDate: { lte: dayStart },
      endDate: { gte: dayStart },
    },
    select: {
      leaveHours: true,
      startTime: true,
      endTime: true,
    },
  });

  if (hourlyLeaves.length === 0) return 0;

  return hourlyLeaves.reduce((sum, leave) => {
    if (leave.leaveHours !== null && leave.leaveHours !== undefined) {
      return sum + Math.max(0, Math.round(leave.leaveHours * 60));
    }

    if (leave.startTime && leave.endTime) {
      let duration = timeToMinutes(leave.endTime) - timeToMinutes(leave.startTime);
      if (duration < 0) duration += 24 * 60;
      return sum + Math.max(0, duration);
    }

    return sum;
  }, 0);
}

type AttendanceWithShiftForSummary = {
  userId: number;
  checkIn: Date;
  checkOut: Date | null;
  shift: Pick<Shift, 'startTime' | 'endTime'> | null;
};

async function enrichWithWorkSummary<T extends AttendanceWithShiftForSummary>(attendance: T): Promise<T & {
  workedMinutes: number | null;
  breakDeductedMinutes: number;
  leaveDeductedMinutes: number;
  netWorkedMinutes: number | null;
}> {
  if (!attendance.checkOut) {
    return {
      ...attendance,
      workedMinutes: null,
      breakDeductedMinutes: 0,
      leaveDeductedMinutes: 0,
      netWorkedMinutes: null,
    };
  }

  const workedMinutes = Math.max(
    0,
    Math.round((attendance.checkOut.getTime() - attendance.checkIn.getTime()) / 60000),
  );

  const shiftDurationMinutes = attendance.shift
    ? getShiftDurationMinutes(attendance.shift.startTime, attendance.shift.endTime)
    : 0;

  const breakDeductedMinutes = shiftDurationMinutes > 5 * 60 ? 60 : 0;
  const leaveDeductedMinutes = await getApprovedHourlyLeaveMinutes(attendance.userId, attendance.checkIn);
  const netWorkedMinutes = Math.max(0, workedMinutes - breakDeductedMinutes - leaveDeductedMinutes);

  return {
    ...attendance,
    workedMinutes,
    breakDeductedMinutes,
    leaveDeductedMinutes,
    netWorkedMinutes,
  };
}

/**
 * ตัดสินสถานะการเข้างาน ON_TIME / LATE / ABSENT
 *
 * ทำไมไม่ hardcode threshold?
 * Admin สามารถตั้ง gracePeriodMinutes และ lateThresholdMinutes ต่อกะได้
 * → frontend ส่งมาใน CreateShiftDTO, บันทึกไว้ใน Shift record
 *
 * Logic ที่แก้แล้ว (v2):
 * diff ≤ grace  → ON_TIME  (มาก่อน หรือสายไม่เกิน grace — ยังถือว่าตรงเวลา)
 * grace < diff ≤ threshold → LATE    (สายแต่ยังไม่ถึงเกณฑ์ขาด)
 * diff > threshold         → ABSENT  (สายเกินไป — ขาดงาน)
 *
 * ทำไมเปลี่ยน?
 * เวอร์ชันเก่ามี bug: เงื่อนไข `diff === 0` อยู่หลัง `diff <= 0` → ไม่มีทางเข้าถึง
 * และ grace ควรรวม "มาก่อน" + "สายนิดหน่อย" ด้วย เช่น grace=15 แปลว่า
 * มาสายได้ 15 นาทีแล้วยังถือว่า ON_TIME
 */
function calculateAttendanceStatus(
  checkInTime: string,
  shift: Shift,
): { status: AttendanceStatus; lateMinutes: number; message: string } {
  const diff = calculateTimeDifference(checkInTime, shift.startTime);
  const grace = shift.gracePeriodMinutes;       // สายไม่เกินกี่นาทียังตรงเวลา
  const threshold = shift.lateThresholdMinutes; // สายเกินนี้ถือว่าขาด

  // diff ≤ 0 = มาก่อนเวลา, diff > 0 = มาหลังเวลา
  if (diff <= grace) {
    // มาก่อนหรือสายไม่เกิน grace → ตรงเวลา
    const earlyOrLate = diff <= 0 ? `มาก่อน ${Math.abs(diff)} นาที` : 'ตรงเวลาพอดี';
    return { status: 'ON_TIME', lateMinutes: 0, message: `เข้างานตรงเวลา (${earlyOrLate})` };
  }
  if (diff <= threshold) {
    // สายแต่ยังไม่ถึง threshold → LATE
    return { status: 'LATE', lateMinutes: diff, message: `มาสาย ${diff} นาที` };
  }
  // สายเกิน threshold → ABSENT
  return { status: 'ABSENT', lateMinutes: diff, message: `สายเกิน ${threshold} นาที — ถือว่าขาดงาน` };
}

/**
 * ลำดับ check-in ถูกบังคับให้ "validate ก่อน write" เพื่อกันข้อมูลผิดเข้าระบบ
 * และลดโอกาสสร้าง record ซ้ำจากการกดซ้ำหลายหน้าจอพร้อมกัน.
 */
export const checkIn = async (data: CheckInDTO) => {
  const { userId, shiftId, locationId, eventId, photo, latitude, longitude, address } = data;

  // บังคับผูกกับกะเสมอเพื่อไม่ให้เกิด attendance กำกวมที่ตรวจ location ไม่ได้
  if (shiftId === undefined || shiftId === null) {
    throw new Error('กรุณาเลือกกะก่อนเข้างาน');
  }

  // ปฏิเสธพิกัด (0,0) เพราะเป็นค่า fallback ตอน GPS ใช้งานไม่ได้
  if (latitude === undefined || longitude === undefined || latitude === null || longitude === null) {
    throw new Error('กรุณาเปิด GPS เพื่อบันทึกพิกัดตำแหน่ง');
  }
  if (latitude === 0 && longitude === 0) {
    throw new Error('พิกัด GPS ไม่ถูกต้อง (0,0) — กรุณาเปิด GPS แล้วลองใหม่');
  }

  // ไม่นับ soft-deleted เพื่อให้แก้ไขย้อนหลังแล้วลงเวลาใหม่ได้จริง
  const { start: today, end: tomorrow } = getThaiDayRange();

  // SQL เทียบเท่า:
  // SELECT 1 FROM "LeaveRequest"
  // WHERE "userId"=$1 AND "status"='APPROVED' AND "isHourly"=false
  //   AND "startDate" <= $today AND "endDate" >= $today
  // LIMIT 1;
  const approvedLeave = await prisma.leaveRequest.findFirst({
    where: {
      userId,
      status: 'APPROVED',
      isHourly: false,
      startDate: { lte: today },
      endDate: { gte: today },
    },
  });
  const hasApprovedLeave = approvedLeave !== null;

  if (hasApprovedLeave) {
    throw new Error('คุณมีใบลาอนุมัติในวันนี้ ไม่สามารถ check-in ได้');
  }

  // SQL เทียบเท่า:
  // SELECT 1 FROM "Attendance"
  // WHERE "userId"=$1 AND "isDeleted"=false AND "eventId" IS NULL
  //   AND "checkIn" >= $today AND "checkIn" < $tomorrow
  //   AND ("shiftId"=$2 OR $2 IS NULL)
  // LIMIT 1;
  const existingAttendance = await prisma.attendance.findFirst({
    where: {
      userId,
      isDeleted: false,
      eventId: null,
      ...(shiftId !== undefined && { shiftId }),
      checkIn: { gte: today, lt: tomorrow },
    },
  });
  if (existingAttendance !== null) {
    throw new Error(shiftId !== undefined ? 'คุณได้ check-in กะนี้ไปแล้ววันนี้' : 'คุณได้ check-in ไปแล้ววันนี้');
  }

  // SQL เทียบเท่า:
  // SELECT s.*, l.* FROM "Shift" s
  // LEFT JOIN "Location" l ON s."locationId" = l."locationId"
  // WHERE s."shiftId"=$1 LIMIT 1;
  let shift: Shift | null = null;
  shift = await prisma.shift.findUnique({
    where: { shiftId },
    include: { location: true },
  });
  if (shift === null) throw new Error('ไม่พบกะที่ระบุ');
  if (shift.userId !== userId) throw new Error('กะนี้ไม่ใช่ของคุณ');
  if (!shift.isActive) throw new Error('กะนี้ถูกปิดใช้งานแล้ว');

  if (!shiftMatchesAttendanceDate(shift, new Date())) {
    if (shift.shiftType === 'SPECIFIC_DAY') {
      throw new Error('วันนี้ไม่ใช่วันที่กำหนดสำหรับกะนี้');
    }
    if (shift.shiftType === 'CUSTOM') {
      throw new Error('กะนี้ใช้ได้เฉพาะวันที่กำหนดเท่านั้น');
    }
    throw new Error('วันนี้ไม่สามารถเข้างานกะนี้ได้');
  }

  // กันการลงเวลาหลังเลิกกะ เพราะข้อมูลแบบนั้นใช้สรุปงานต่อไม่ได้
  const currentTimeHHMM = getThaiTimeHHMM();
  const diffFromStart = calculateTimeDifference(currentTimeHHMM, shift.startTime);
  if (diffFromStart < -MAX_EARLY_CHECKIN_MINUTES) {
    throw new Error(`คุณต้องเข้างานก่อนเวลาได้ไม่เกิน ${MAX_EARLY_CHECKIN_MINUTES} นาที`);
  }

  const diffFromEnd = calculateTimeDifference(currentTimeHHMM, shift.endTime);
  if (diffFromEnd > 0) {
    throw new Error(`ไม่สามารถเข้างานได้ — เลยเวลาออกงาน (${shift.endTime}) แล้ว`);
  }

  // ให้ request override location ของกะได้เพื่อรองรับเคสย้ายจุดทำงานเฉพาะกิจ
  let location: Location | null = null;
  let distance: number | null = null;
  const targetLocationId = locationId ?? shift?.locationId ?? undefined;

  if (targetLocationId !== undefined) {
    // SQL เทียบเท่า:
    // SELECT * FROM "Location" WHERE "locationId"=$1 LIMIT 1;
    location = await prisma.location.findUnique({ where: { locationId: targetLocationId } });
    if (location === null) throw new Error('ไม่พบสถานที่ที่ระบุ');

    distance = calculateDistance(latitude, longitude, location.latitude, location.longitude);
    if (distance > location.radius) {
      throw new Error(
        `คุณอยู่นอกพื้นที่ (ห่าง ${distance.toFixed(0)} ม., อนุญาตสูงสุด ${location.radius} ม.)`,
      );
    }
  }

  // ใช้ timezone helper แทน locale ของเครื่องเพื่อกันผลลัพธ์ต่างกันข้าม environment
  const checkInTime = getThaiTimeHHMM();

  // SQL เทียบเท่า:
  // SELECT * FROM "LateRequest"
  // WHERE "userId"=$1 AND "status"='APPROVED'
  //   AND "requestDate" >= $today AND "requestDate" < $tomorrow
  // ORDER BY "lateRequestId" DESC LIMIT 1;
  const approvedLateRequest = await prisma.lateRequest.findFirst({
    where: {
      userId,
      status: 'APPROVED',
      requestDate: { gte: today, lt: tomorrow },
    },
    orderBy: { lateRequestId: 'desc' },
  });

  let status: AttendanceStatus = 'ON_TIME';
  let lateMinutes = 0;
  let message = 'เข้างาน';

  if (approvedLateRequest) {
    status = 'LATE_APPROVED' as AttendanceStatus;
    lateMinutes = approvedLateRequest.lateMinutes;
    message = `มาสายอนุมัติแล้ว ${approvedLateRequest.lateMinutes} นาที`;
  } else {
    const result = calculateAttendanceStatus(checkInTime, shift);
    status = result.status;
    lateMinutes = result.lateMinutes;
    message = result.message;
  }

  // SQL เทียบเท่า:
  // INSERT INTO "Attendance" (...)
  // VALUES (...)
  // RETURNING *;
  const checkInPhotoUrl = photo
    ? await uploadAttendancePhotoToSupabase(userId, photo, 'check-in')
    : null;

  const attendance = await prisma.attendance.create({
    data: {
      userId,
      shiftId,
      locationId: targetLocationId ?? null,
      eventId: eventId ?? null,
      checkInPhoto: checkInPhotoUrl,
      checkInLat: latitude,
      checkInLng: longitude,
      checkInAddress: address ?? null,
      checkInDistance: distance,
      status,
      lateMinutes,
      note: message,
    },
    include: {
      user: { select: { userId: true, firstName: true, lastName: true, employeeId: true } },
      shift: true,
      location: true,
    },
  });

  // audit เป็น append-only จึงแยกจากธุรกรรมหลักเพื่อไม่ให้ block การลงเวลา
  await createAuditLog({
    userId,
    action: AuditAction.CHECK_IN,
    targetTable: 'attendance',
    targetId: attendance.attendanceId,
    newValues: attendance,
  });

  return attendance;
};

/**
 * 🚪 Check-out (ออกงาน)
 *
 * ทำไม flow ถึงเป็นแบบนี้?
 * 1. หา record check-in ที่ยังไม่ได้ออก → ป้องกัน check-out ซ้ำ
 * 2. ตรวจ GPS ซ้ำ → พนักงานต้องออกจากสถานที่เดิมที่เช็คอิน
 * 3. UPDATE แทน INSERT → 1 record ต่องานเสมอ (ไม่ซ้ำข้อมูล)
 *
 * SQL เทียบเท่า:
 * -- หา check-in ที่ยังไม่ได้ออก
 * SELECT * FROM "Attendance"
 *   WHERE "userId"=$1 AND "checkOut" IS NULL
 *   ORDER BY "checkIn" DESC LIMIT 1
 *
 * ใช้ UPDATE บน record เดิมแทน INSERT เพื่อคงกติกา 1 งานต่อ 1 attendance record.
 */
export const checkOut = async (data: CheckOutDTO) => {
  const { userId, attendanceId, shiftId, photo, latitude, longitude, address } = data;

  if (latitude === undefined || longitude === undefined || latitude === null || longitude === null) {
    throw new Error('กรุณาเปิด GPS เพื่อบันทึกพิกัดตำแหน่ง');
  }
  if (latitude === 0 && longitude === 0) {
    throw new Error('พิกัด GPS ไม่ถูกต้อง (0,0) — กรุณาเปิด GPS แล้วลองใหม่');
  }

  // บังคับหาเฉพาะ record ที่ยังเปิดอยู่เพื่อกัน check-out ซ้ำ
  let attendance;
  if (attendanceId !== undefined) {
    // SQL เทียบเท่า:
    // SELECT * FROM "Attendance"
    // WHERE "attendanceId"=$1 AND "userId"=$2
    //   AND "checkOut" IS NULL AND "isDeleted"=false
    // LIMIT 1;
    attendance = await prisma.attendance.findFirst({
      where: { attendanceId, userId, checkOut: null, isDeleted: false },
      include: { location: true, shift: true },
    });
  } else {
    // SQL เทียบเท่า:
    // SELECT * FROM "Attendance"
    // WHERE "userId"=$1 AND "checkOut" IS NULL AND "isDeleted"=false
    //   AND ("shiftId"=$2 OR $2 IS NULL)
    // ORDER BY "checkIn" DESC
    // LIMIT 1;
    attendance = await prisma.attendance.findFirst({
      where: {
        userId,
        ...(shiftId !== undefined && { shiftId }),
        checkOut: null,
        isDeleted: false,
      },
      orderBy: { checkIn: 'desc' },
      include: { location: true, shift: true },
    });
  }

  if (attendance === null || attendance === undefined) {
    throw new Error('ไม่พบการ check-in ที่ยังไม่ได้ check-out');
  }

  const now = new Date();
  const minutesSinceCheckIn = (now.getTime() - attendance.checkIn.getTime()) / 60000;
  if (minutesSinceCheckIn < MIN_CHECKOUT_MINUTES_AFTER_CHECKIN) {
    throw new Error(`เพิ่งเข้างานเมื่อสักครู่ กรุณารออย่างน้อย ${MIN_CHECKOUT_MINUTES_AFTER_CHECKIN} นาทีจึงจะออกงานได้`);
  }

  if (attendance.shift !== null) {
    const shiftEndDate = getShiftEndDateFromCheckIn(attendance.checkIn, attendance.shift.endTime);
    if (now.getTime() < shiftEndDate.getTime()) {
      const remainingMinutes = Math.ceil((shiftEndDate.getTime() - now.getTime()) / 60000);
      throw new Error(`คุณต้องออกงานหลังเวลาเลิกกะ (${attendance.shift.endTime}) หรือรออีกประมาณ ${remainingMinutes} นาที`);
    }
  }

  let distance: number | null = null;
  if (attendance.location !== null) {
    distance = calculateDistance(
      latitude,
      longitude,
      attendance.location.latitude,
      attendance.location.longitude,
    );
    if (distance > attendance.location.radius) {
      throw new Error(
        `คุณอยู่นอกพื้นที่ (ห่าง ${distance.toFixed(0)} ม., อนุญาตสูงสุด ${attendance.location.radius} ม.)`,
      );
    }
  }

  // SQL เทียบเท่า:
  // UPDATE "Attendance"
  // SET "checkOut"=$1, "checkOutPhoto"=$2, "checkOutLat"=$3,
  //     "checkOutLng"=$4, "checkOutAddress"=$5, "checkOutDistance"=$6
  // WHERE "attendanceId"=$7
  // RETURNING *;
  const checkOutPhotoUrl = photo
    ? await uploadAttendancePhotoToSupabase(userId, photo, 'check-out')
    : null;

  const updatedAttendance = await prisma.attendance.update({
    where: { attendanceId: attendance.attendanceId },
    data: {
      checkOut: now,
      checkOutPhoto: checkOutPhotoUrl,
      checkOutLat: latitude,
      checkOutLng: longitude,
      checkOutAddress: address ?? null,
      checkOutDistance: distance,
    },
    include: {
      user: { select: { userId: true, firstName: true, lastName: true, employeeId: true } },
      shift: true,
      location: true,
    },
  });

  // ใส่ oldValues แบบย่อเพื่ออ่าน timeline audit ได้ชัดว่าจาก "ยังไม่ออก" ไป "ออกแล้ว"
  await createAuditLog({
    userId,
    action: AuditAction.CHECK_OUT,
    targetTable: 'attendance',
    targetId: updatedAttendance.attendanceId,
    oldValues: { checkOut: null },
    newValues: updatedAttendance,
  });

  const responseAttendance = await enrichWithWorkSummary(updatedAttendance);

  return responseAttendance;
};

/**
 * include shift/location ไว้ตั้งแต่ query แรกเพื่อลด API fan-out ฝั่ง dashboard.
 */
export const getTodayAttendance = async (userId: number) => {
  const { start: today, end: tomorrow } = getThaiDayRange();

  // SQL เทียบเท่า:
  // SELECT * FROM "Attendance"
  // WHERE "userId"=$1 AND "isDeleted"=false AND "eventId" IS NULL
  //   AND "checkIn" >= $today AND "checkIn" < $tomorrow
  // ORDER BY "checkIn" DESC;
  const rows = await prisma.attendance.findMany({
    where: { userId, isDeleted: false, eventId: null, checkIn: { gte: today, lt: tomorrow } },
    include: { shift: true, location: true },
    orderBy: { checkIn: 'desc' },
  });

  const rowsWithShift = await attachMissingShiftRelations(rows);
  return Promise.all(rowsWithShift.map((row) => enrichWithWorkSummary(row)));
};

/** SQL เทียบเท่าอยู่ในคอมเมนต์ก่อน query เพื่อให้เทียบ Prisma กับ DB plan ได้ตรงจุด */
export const getAttendanceHistory = async (
  userId: number,
  filters?: { startDate?: Date; endDate?: Date; status?: AttendanceStatus },
) => {
  // SQL เทียบเท่า:
  // SELECT * FROM "Attendance"
  // WHERE "userId"=$1 AND "isDeleted"=false AND "eventId" IS NULL
  //   AND ("checkIn" >= $startDate OR $startDate IS NULL)
  //   AND ("checkIn" <= $endDate OR $endDate IS NULL)
  //   AND ("status" = $status OR $status IS NULL)
  // ORDER BY "checkIn" DESC;
  const rows = await prisma.attendance.findMany({
    where: {
      userId,
      isDeleted: false,
      eventId: null,
      ...(filters?.startDate !== undefined && { checkIn: { gte: filters.startDate } }),
      ...(filters?.endDate !== undefined && { checkIn: { lte: filters.endDate } }),
      ...(filters?.status !== undefined && { status: filters.status }),
    },
    include: { shift: true, location: true },
    orderBy: { checkIn: 'desc' },
  });

  const rowsWithShift = await attachMissingShiftRelations(rows);
  return Promise.all(rowsWithShift.map((row) => enrichWithWorkSummary(row)));
};

/** Admin list รวม role/avatar เพราะหน้า monitor ใช้แยกสีและ context ของพนักงาน */
export const getAllAttendances = async (filters?: {
  userId?: number;
  startDate?: Date;
  endDate?: Date;
  status?: AttendanceStatus;
}) => {
  // SQL เทียบเท่า:
  // SELECT a.*, u."role", u."avatarUrl", s.*, l.*
  // FROM "Attendance" a
  // LEFT JOIN "User" u ON a."userId"=u."userId"
  // LEFT JOIN "Shift" s ON a."shiftId"=s."shiftId"
  // LEFT JOIN "Location" l ON a."locationId"=l."locationId"
  // WHERE a."isDeleted"=false AND a."eventId" IS NULL
  //   AND (a."userId"=$1 OR $1 IS NULL)
  //   AND (a."checkIn" >= $2 OR $2 IS NULL)
  //   AND (a."checkIn" <= $3 OR $3 IS NULL)
  //   AND (a."status" = $4 OR $4 IS NULL)
  // ORDER BY a."checkIn" DESC;
  const rows = await prisma.attendance.findMany({
    where: {
      isDeleted: false,
      eventId: null,
      ...(filters?.userId !== undefined && { userId: filters.userId }),
      ...(filters?.startDate !== undefined && { checkIn: { gte: filters.startDate } }),
      ...(filters?.endDate !== undefined && { checkIn: { lte: filters.endDate } }),
      ...(filters?.status !== undefined && { status: filters.status }),
    },
    include: {
      user: {
        select: { userId: true, firstName: true, lastName: true, employeeId: true, role: true, avatarUrl: true },
      },
      shift: true,
      location: true,
    },
    orderBy: { checkIn: 'desc' },
  });

  const rowsWithShift = await attachMissingShiftRelations(rows);
  return Promise.all(rowsWithShift.map((row) => enrichWithWorkSummary(row)));
};

/** บังคับมีเหตุผลเมื่อแก้เวลา เพื่อรักษา traceability ของข้อมูล payroll */
export const updateAttendance = async (
  attendanceId: number,
  data: { status?: AttendanceStatus; note?: string; checkIn?: Date; checkOut?: Date; editReason?: string },
  editedByUserId?: number,
) => {
  // SQL เทียบเท่า:
  // SELECT 1 FROM "Attendance" WHERE "attendanceId"=$1 AND "isDeleted"=false LIMIT 1;
  const attendance = await prisma.attendance.findFirst({ where: { attendanceId, isDeleted: false } });
  if (attendance === null) throw new Error('ไม่พบข้อมูลการเข้างานที่ระบุ');

  const isTimeChanged = (
    (data.checkIn && attendance.checkIn.getTime() !== data.checkIn.getTime())
    || (data.checkOut && attendance.checkOut?.getTime() !== data.checkOut.getTime())
  );
  if (isTimeChanged && (!data.editReason || data.editReason.trim().length === 0)) {
    throw new Error('การแก้เวลาเข้างาน/ออกงานต้องระบุเหตุผล (editReason)');
  }

  const effectiveCheckIn = data.checkIn ?? attendance.checkIn;
  const effectiveCheckOut = data.checkOut ?? attendance.checkOut;
  if (effectiveCheckOut !== null && effectiveCheckOut.getTime() < effectiveCheckIn.getTime()) {
    throw new Error('เวลาออกงานต้องไม่น้อยกว่าเวลาเข้างาน');
  }

  const { editReason, ...updatePayload } = data;

  // SQL เทียบเท่า:
  // UPDATE "Attendance" SET ... WHERE "attendanceId"=$1 RETURNING *;
  const updatedAttendance = await prisma.attendance.update({
    where: { attendanceId },
    data: updatePayload,
    include: {
      user: { select: { userId: true, firstName: true, lastName: true, employeeId: true } },
      shift: true,
      location: true,
    },
  });

  await createAuditLog({
    userId: editedByUserId ?? attendance.userId,
    action: AuditAction.UPDATE_ATTENDANCE,
    targetTable: 'attendance',
    targetId: attendanceId,
    oldValues: attendance as unknown as Record<string, unknown>,
    newValues: {
      ...(updatedAttendance as unknown as Record<string, unknown>),
      editReason: editReason ?? null,
    },
  });

  return updatedAttendance;
};

/** ใช้ soft-delete เพื่อคงประวัติการลงเวลาและความต่อเนื่องของ audit trail */
export const deleteAttendance = async (
  attendanceId: number,
  deletedByUserId?: number,
  deleteReason?: string,
) => {
  // SQL เทียบเท่า:
  // SELECT 1 FROM "Attendance" WHERE "attendanceId"=$1 AND "isDeleted"=false LIMIT 1;
  const attendance = await prisma.attendance.findFirst({ where: { attendanceId, isDeleted: false } });
  if (attendance === null) throw new Error('ไม่พบข้อมูลการเข้างานที่ระบุ');

  // SQL เทียบเท่า:
  // UPDATE "Attendance"
  // SET "isDeleted"=true, "deleteReason"=$2
  // WHERE "attendanceId"=$1;
  await prisma.attendance.update({
    where: { attendanceId },
    data: {
      isDeleted: true,
      deleteReason: deleteReason ?? null,
    },
  });

  await createAuditLog({
    userId: deletedByUserId ?? attendance.userId,
    action: AuditAction.DELETE_ATTENDANCE,
    targetTable: 'attendance',
    targetId: attendanceId,
    oldValues: attendance as unknown as Record<string, unknown>,
    newValues: { isDeleted: true, deleteReason: deleteReason ?? null },
  });

  return { message: 'ลบข้อมูลการเข้างานเรียบร้อยแล้ว (Soft Delete)' };
};

/** ลดงานค้างปลายกะและทำให้รายงานปิดวันได้ แม้พนักงานลืมกดออกงาน */
export const autoCheckoutOverdueAttendances = async (): Promise<number> => {
  const now = new Date();

  // SQL เทียบเท่า:
  // SELECT a.*, s.*
  // FROM "Attendance" a
  // LEFT JOIN "Shift" s ON a."shiftId"=s."shiftId"
  // WHERE a."isDeleted"=false AND a."checkOut" IS NULL AND a."shiftId" IS NOT NULL
  // ORDER BY a."checkIn" ASC;
  const openAttendances = await prisma.attendance.findMany({
    where: {
      isDeleted: false,
      checkOut: null,
      shiftId: { not: null },
    },
    include: {
      shift: true,
    },
    orderBy: { checkIn: 'asc' },
  });

  let updatedCount = 0;

  for (const attendance of openAttendances) {
    if (!attendance.shift) continue;

    const shiftEndDate = getShiftEndDateFromCheckIn(attendance.checkIn, attendance.shift.endTime);
    const autoCheckoutAt = new Date(shiftEndDate.getTime() + AUTO_CHECKOUT_GRACE_MINUTES * 60 * 1000);

    if (now < autoCheckoutAt) continue;

    // SQL เทียบเท่า:
    // UPDATE "Attendance"
    // SET "checkOut"=$1, "isAutoCheckout"=true, "note"=$2
    // WHERE "attendanceId"=$3;
    await prisma.attendance.update({
      where: { attendanceId: attendance.attendanceId },
      data: {
        checkOut: autoCheckoutAt,
        isAutoCheckout: true,
        note: attendance.note
          ? `${attendance.note} | auto-checkout`
          : 'auto-checkout',
      },
    });

    await createAuditLog({
      userId: attendance.userId,
      action: AuditAction.AUTO_CHECK_OUT,
      targetTable: 'attendance',
      targetId: attendance.attendanceId,
      oldValues: {
        checkOut: attendance.checkOut,
        isAutoCheckout: attendance.isAutoCheckout,
      },
      newValues: {
        checkOut: autoCheckoutAt,
        isAutoCheckout: true,
      },
    });

    updatedCount += 1;
  }

  return updatedCount;
};

export const attendanceService = {
  checkIn,
  checkOut,
  getTodayAttendance,
  getAttendanceHistory,
  getAllAttendances,
  updateAttendance,
  deleteAttendance,
  autoCheckoutOverdueAttendances,
};

export default attendanceService;
