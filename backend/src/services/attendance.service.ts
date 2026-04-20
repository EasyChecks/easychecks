import { AttendanceStatus } from '@prisma/client';
import type { Shift, Location } from '@prisma/client';
import { getDistance } from 'geolib';
import { prisma } from '../lib/prisma.js';
import { createAuditLog, AuditAction } from './audit.service.js';
import { getThaiDayRange, getThaiTimeHHMM } from '../utils/timezone.js';
import { uploadAttendancePhotoToSupabase } from '../utils/supabase-storage.js';
import {
  calculateTimeDifferenceFromShift,
  evaluateAttendanceStatus,
  resolveAttendanceWithApprovedLateWindow,
} from '../utils/late-policy.js';

const THAI_OFFSET_MS = 7 * 60 * 60 * 1000;
const AUTO_CHECKOUT_GRACE_MINUTES = 30;
const MIN_CHECKOUT_MINUTES_AFTER_CHECKIN = 1;
const MAX_EARLY_CHECKIN_MINUTES = 30;

/**
 * 📋 Attendance Service — บริการจัดการการเข้า-ออกงาน
 *
 * ทำไมต้องมี service layer แยกจาก controller?
 * - Controller ควรรู้แค่ HTTP (request/response)
 * - Service ถือ business logic ทั้งหมด → test ง่าย, เปลี่ยน transport layer ได้
 */

// ============================================
// 📦 DTOs — รูปแบบข้อมูลที่ service รับเข้า
// ============================================

export interface CheckInDTO {
  userId: number;       // รหัสพนักงาน — ดึงจาก req.user หลัง authenticate
  shiftId?: number;     // บังคับต้องส่งสำหรับ check-in ปกติ
  locationId?: number;  // ถ้าไม่ส่งมา ระบบจะไม่ตรวจสอบพิกัด
  eventId?: number;     // ถ้า check-in ผ่านกิจกรรม จะมี eventId มาด้วย
  photo?: string;       // Base64/DataURL selfie (อัปโหลด Supabase แล้วเก็บ URL)
  latitude?: number;    // GPS จาก frontend — ใช้คู่กับ locationId
  longitude?: number;
  address?: string;     // ที่อยู่ที่ reverse geocode มาจาก frontend
}

export interface CheckOutDTO {
  userId: number;
  attendanceId?: number; // ระบุตรงเพื่อ check-out กะใดกะหนึ่ง; ถ้าไม่ระบุ → หาล่าสุดอัตโนมัติ
  shiftId?: number;
  photo?: string;        // Base64/DataURL selfie (อัปโหลด Supabase แล้วเก็บ URL)
  latitude?: number;
  longitude?: number;
  address?: string;
}

// ============================================
// 🛠️ Helper Functions — ล็อก logic ที่ใช้ซ้ำ
// ============================================

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
  if (shift.shiftType === 'REGULAR') return true;

  const thaiDay = THAI_DAY_ENUMS[toThaiDate(checkIn).getUTCDay()] as ThaiDayEnum;

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
    const score = Math.abs(calculateTimeDifferenceFromShift(checkInHHMM, shift.startTime));
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

// ============================================
// 📋 Main Functions — ฟังก์ชันหลัก
// ============================================

/**
 * ✅ Check-in (เข้างาน)
 *
 * ทำไม flow ถึงเป็นแบบนี้?
 * 1. ตรวจ double check-in → ป้องกัน race condition (2 tab กด check-in พร้อมกัน)
 * 2. ตรวจใบลา → ถ้ามีใบลาอนุมัติ บันทึกเป็น LEAVE_APPROVED แทน
 *    (ไม่บล็อก เพราะบางบริษัทยังให้มาลงชื่อแม้ลา)
 * 3. ตรวจ GPS → เช็คก่อน write เพื่อไม่ให้สร้าง record ค้างถ้า location ผิด
 * 4. สร้าง record + audit → atomicity ไม่สมบูรณ์ แต่ audit เป็น append-only
 *    → ถ้า audit fail ไม่กระทบ attendance
 *
 * SQL เทียบเท่า:
 * -- ตรวจ double check-in
 * SELECT * FROM "Attendance"
 *   WHERE "userId" = $1
 *   AND "checkIn" >= TODAY
 *   AND "checkIn" <  TOMORROW
 *   AND "shiftId" = $2  -- ถ้ามี
 *
 * -- สร้าง record
 * INSERT INTO "Attendance" ("userId","shiftId","locationId","checkInPhoto",
 *   "checkInLat","checkInLng","status","lateMinutes","note")
 * VALUES (...)
 * RETURNING *
 */
export const checkIn = async (data: CheckInDTO) => {
  // [A] Destructure ทุก field จาก DTO ที่ controller ส่งมา
  const { userId, shiftId, locationId, eventId, photo, latitude, longitude, address } = data;

  // ===== 0.5 Validate shift selection =====
  // บังคับให้ check-in ต้องอิงกะเสมอ เพื่อใช้ location ของกะและป้องกันความคลุมเครือ
  if (shiftId === undefined || shiftId === null) {
    throw new Error('กรุณาเลือกกะก่อนเข้างาน');
  }

  // ===== 0. Validate GPS — ปฏิเสธพิกัด (0,0) เพราะเป็น default ที่ frontend ส่งมาเมื่อ GPS ไม่ทำงาน =====
  // ทำไมต้องตรวจ? frontend เดิมส่ง lat:0, lng:0 เมื่อ GPS ไม่พร้อม
  // พิกัด (0,0) อยู่กลางมหาสมุทรแอตแลนติก → ไม่มีทางเป็นตำแหน่งจริง
  if (latitude === undefined || longitude === undefined || latitude === null || longitude === null) {
    throw new Error('กรุณาเปิด GPS เพื่อบันทึกพิกัดตำแหน่ง');
  }
  if (latitude === 0 && longitude === 0) {
    throw new Error('พิกัด GPS ไม่ถูกต้อง (0,0) — กรุณาเปิด GPS แล้วลองใหม่');
  }

  // ===== 1. ตรวจสอบการลงชื่อซ้ำในวันเดียวกัน (Double-Punch Prevention) =====
  // ทำไมต้องเพิ่ม isDeleted: false?
  // ถ้า Admin soft-delete record เก่าไปแล้ว → ต้องให้ check-in ใหม่ได้
  // ไม่งั้น record ที่ถูกลบจะยังบล็อกอยู่ตลอด
  const { start: today, end: tomorrow } = getThaiDayRange(); // ขอบวันอ้างอิง Asia/Bangkok

  // SQL: SELECT 1 FROM "LeaveRequest"
  //   WHERE "userId"=$1 AND status='APPROVED'
  //   AND "startDate" <= TODAY AND "endDate" >= TODAY
  //   AND "isDeleted" = false
  const approvedLeave = await prisma.leaveRequest.findFirst({
    where: {
      userId,
      status: 'APPROVED',     // เฉพาะใบลาที่อนุมัติแล้วเท่านั้น
      isHourly: false,        // บล็อกเฉพาะใบลาเต็มวัน
      startDate: { lte: today },  // ใบลาเริ่มก่อนหรือวันนี้
      endDate: { gte: today },    // ใบลายังไม่หมด
    },
  });
  const hasApprovedLeave = approvedLeave !== null; // true = มีใบลาอนุมัติวันนี้

  if (hasApprovedLeave) {
    throw new Error('คุณมีใบลาอนุมัติในวันนี้ ไม่สามารถ check-in ได้');
  }

  // SQL: SELECT 1 FROM "Attendance"
  //   WHERE "userId"=$1 AND "checkIn" >= TODAY AND "checkIn" < TOMORROW
  //   AND ("shiftId"=$2 OR $2 IS NULL)
  //   AND "isDeleted" = false  ← สำคัญ: ไม่นับ record ที่ soft-delete แล้ว
  const existingAttendance = await prisma.attendance.findFirst({
    where: {
      userId,
      isDeleted: false,
      eventId: null,                               // ไม่นับ record ที่เป็นของ Event
      ...(shiftId !== undefined && { shiftId }), // spread ว่างถ้า shiftId ไม่มี → ตรวจทุกกะ
      checkIn: { gte: today, lt: tomorrow },       // ช่วงวันนี้เท่านั้น
    },
  });
  if (existingAttendance !== null) {
    // พบ record วันนี้แล้ว → โยน Error (จะถูก map เป็น 409 Conflict)
    throw new Error(shiftId !== undefined ? 'คุณได้ check-in กะนี้ไปแล้ววันนี้' : 'คุณได้ check-in ไปแล้ววันนี้');
  }

  // ===== 2. ดึงข้อมูล Shift (ถ้ามี) =====
  // SQL: SELECT * FROM "Shift" WHERE "shiftId"=$1
  let shift: Shift | null = null;
  shift = await prisma.shift.findUnique({
    where: { shiftId },
    include: { location: true }, // ← เพิ่ม: ดึง location ที่ผูกกับกะ เพื่อใช้คำนวณ GPS
  });
  if (shift === null) throw new Error('ไม่พบกะที่ระบุ');               // กะถูกลบไปแล้ว
  if (shift.userId !== userId) throw new Error('กะนี้ไม่ใช่ของคุณ');  // ป้องกัน check-in สลับกะคนอื่น
  if (!shift.isActive) throw new Error('กะนี้ถูกปิดใช้งานแล้ว');      // Admin ปิดกะแล้ว

  if (!shiftMatchesAttendanceDate(shift, new Date())) {
    if (shift.shiftType === 'SPECIFIC_DAY') {
      throw new Error('วันนี้ไม่ใช่วันที่กำหนดสำหรับกะนี้');
    }
    if (shift.shiftType === 'CUSTOM') {
      throw new Error('กะนี้ใช้ได้เฉพาะวันที่กำหนดเท่านั้น');
    }
    throw new Error('วันนี้ไม่สามารถเข้างานกะนี้ได้');
  }

  // ===== 2.1 ตรวจสอบว่าเลยเวลาออกงานหรือยัง =====
  // ทำไมต้องเช็ค? ถ้ากะ 08:00-17:00 แล้วมาเข้างานตอน 18:00
  // ไม่มีประโยชน์แล้ว → บล็อกไว้เลย ไม่ให้สร้าง record ขยะ
  // ใช้ calculateTimeDifference ซึ่งรองรับกะข้ามเที่ยงคืน (เช่น 22:00-06:00) ด้วย
  //
  // SQL เทียบเท่า: ไม่มี — เป็น business logic ฝั่ง application
  const currentTimeHHMM = getThaiTimeHHMM();
  const diffFromStart = calculateTimeDifferenceFromShift(currentTimeHHMM, shift.startTime);
  if (diffFromStart < -MAX_EARLY_CHECKIN_MINUTES) {
    throw new Error(`คุณต้องเข้างานก่อนเวลาได้ไม่เกิน ${MAX_EARLY_CHECKIN_MINUTES} นาที`);
  }

  const diffFromEnd = calculateTimeDifferenceFromShift(currentTimeHHMM, shift.endTime);
  if (diffFromEnd > 0) {
    throw new Error(`ไม่สามารถเข้างานได้ — เลยเวลาออกงาน (${shift.endTime}) แล้ว`);
  }

  // ===== 3. ตรวจสอบ Location (ถ้ามี) =====
  // ลำดับความสำคัญ: locationId ที่ส่งมาตรง > locationId จาก Shift > ไม่มี
  // ทำไมใช้ลำดับนี้? Admin อาจส่ง locationId เฉพาะกิจ override location ของกะ
  let location: Location | null = null;
  let distance: number | null = null;
  const targetLocationId = locationId ?? shift?.locationId ?? undefined;

  if (targetLocationId !== undefined) {
    // SQL: SELECT * FROM "Location" WHERE "locationId"=$1
    location = await prisma.location.findUnique({ where: { locationId: targetLocationId } });
    if (location === null) throw new Error('ไม่พบสถานที่ที่ระบุ');

    // คำนวณระยะห่างระหว่างพนักงานกับศูนย์กลาง location เสมอ
    // ทำไมบังคับ? เพื่อให้ distance ถูกบันทึกทุกครั้ง ไม่เป็น NULL
    distance = calculateDistance(latitude, longitude, location.latitude, location.longitude);
    // distance > radius → อยู่นอกพื้นที่ → ไม่อนุญาต
    if (distance > location.radius) {
      throw new Error(
        `คุณอยู่นอกพื้นที่ (ห่าง ${distance.toFixed(0)} ม., อนุญาตสูงสุด ${location.radius} ม.)`,
      );
    }
  }

  // ===== 4. คำนวณสถานะ =====
  // ทำไมใช้ UTC+7 แทน toLocaleTimeString?
  // toLocaleTimeString('th-TH') ขึ้นกับ locale ของ server → ต่าง OS ได้ค่าต่างกัน
  // ใช้ manual offset ให้ได้ format "HH:MM" ที่แน่นอนเสมอ
  const checkInTime = getThaiTimeHHMM();

  // ถ้ามีคำขอมาสายที่อนุมัติแล้วของวันนี้ ให้ override เป็น LATE_APPROVED ตาม policy
  const approvedLateRequest = await prisma.lateRequest.findFirst({
    where: {
      userId,
      status: 'APPROVED',
      requestDate: { gte: today, lt: tomorrow },
      deletedAt: null,
    },
    orderBy: { lateRequestId: 'desc' },
  });

  const baseResolution = evaluateAttendanceStatus(checkInTime, {
    startTime: shift.startTime,
    gracePeriodMinutes: shift.gracePeriodMinutes,
    lateThresholdMinutes: shift.lateThresholdMinutes,
  });

  const finalResolution = approvedLateRequest
    ? resolveAttendanceWithApprovedLateWindow({
      baseResolution,
      checkInTime,
      shiftStartTime: shift.startTime,
      approvedActualTime: approvedLateRequest.actualTime,
    })
    : baseResolution;

  const status: AttendanceStatus = finalResolution.status;
  const lateMinutes = finalResolution.lateMinutes;
  const message = finalResolution.message;

  // ===== 5. บันทึกลง Database =====
  // SQL: INSERT INTO "Attendance" (...) VALUES (...) RETURNING *
  //      + JOIN "User", "Shift", "Location"
  const checkInPhotoUrl = photo
    ? await uploadAttendancePhotoToSupabase(userId, photo, 'check-in')
    : null;

  const attendance = await prisma.attendance.create({
    data: {
      userId,
      shiftId,                                     // check-in ปกติบังคับต้องมีกะ
      locationId: targetLocationId ?? null,         // ← บันทึก locationId FK เสมอ (ไม่ NULL ถ้ามี shift.location)
      eventId: eventId ?? null,                     // ← บันทึก eventId ถ้า check-in ผ่านกิจกรรม
      checkInPhoto: checkInPhotoUrl,                // URL รูปจาก Supabase Storage
      checkInLat: latitude,                         // ← บังคับบันทึก GPS (ไม่ใช่ null)
      checkInLng: longitude,
      checkInAddress: address ?? null,              // ที่อยู่ reverse geocode
      checkInDistance: distance,                    // ← บันทึกระยะห่างจาก location (เมตร)
      status,                                       // ON_TIME / LATE / ABSENT / LEAVE_APPROVED
      lateMinutes,                                  // 0 ถ้าตรงเวลา
      note: message,                                // ข้อความสรุปสถานะ
    },
    include: {
      // include เพื่อให้ response มีข้อมูลครบ ไม่ต้องยิง API เพิ่ม
      user: { select: { userId: true, firstName: true, lastName: true, employeeId: true } },
      shift: true,
      location: true,
    },
  });

  // ===== 6. Audit Log =====
  // ทำไมบันทึกแยก? audit เป็น append-only ไม่ส่งผลต่อ transaction หลัก
  // ถ้า audit fail → attendance ยังสำเร็จ (ไม่ rollback)
  await createAuditLog({
    userId,
    action: AuditAction.CHECK_IN,
    targetTable: 'attendance',
    targetId: attendance.attendanceId, // id ที่ Postgres ออกให้หลัง INSERT
    newValues: attendance,             // snapshot ทั้ง record เก็บไว้ใน audit
  });

  return attendance; // ส่งกลับ controller → WebSocket broadcast
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
 * -- บันทึก check-out
 * UPDATE "Attendance"
 *   SET "checkOut"=NOW(), "checkOutPhoto"=$2, "checkOutLat"=$3, ...
 *   WHERE "attendanceId"=$4
 * RETURNING *
 */
export const checkOut = async (data: CheckOutDTO) => {
  // [A] Destructure จาก DTO ที่ controller ส่งมา
  const { userId, attendanceId, shiftId, photo, latitude, longitude, address } = data;

  // ===== 0. Validate GPS — เหมือน checkIn, ปฏิเสธพิกัดที่ไม่ถูกต้อง =====
  if (latitude === undefined || longitude === undefined || latitude === null || longitude === null) {
    throw new Error('กรุณาเปิด GPS เพื่อบันทึกพิกัดตำแหน่ง');
  }
  if (latitude === 0 && longitude === 0) {
    throw new Error('พิกัด GPS ไม่ถูกต้อง (0,0) — กรุณาเปิด GPS แล้วลองใหม่');
  }

  // ===== 1. หา record check-in ที่ยังไม่ได้ check-out =====
  // เพิ่ม isDeleted: false เพื่อไม่ให้หา record ที่ soft-delete ไปแล้ว
  let attendance;
  if (attendanceId !== undefined) {
    // มี attendanceId ตรง → ใช้กันกรณีพนักงานเปิดหลายกะพร้อมกัน (เลือก check-out กะใดกะหนึ่ง)
    // WHERE "attendanceId"=$1 AND "userId"=$2 AND "checkOut" IS NULL AND "isDeleted"=false
    attendance = await prisma.attendance.findFirst({
      where: { attendanceId, userId, checkOut: null, isDeleted: false },
      include: { location: true, shift: true }, // ต้องการ location.radius และเวลาเลิกกะสำหรับตรวจเวลา
    });
  } else {
    // ไม่มี attendanceId → หา record ล่าสุดที่ยังไม่ check-out ของ user นี้
    // SQL: ... AND "isDeleted"=false ORDER BY "checkIn" DESC LIMIT 1
    attendance = await prisma.attendance.findFirst({
      where: {
        userId,
        ...(shiftId !== undefined && { shiftId }), // กรองเพิ่มถ้าระบุ shiftId
        checkOut: null,                             // ยังไม่ได้ออก
        isDeleted: false,
      },
      orderBy: { checkIn: 'desc' }, // เอาล่าสุดก่อนเสมอ
      include: { location: true, shift: true },
    });
  }

  // ไม่พบ record → อาจ check-out ซ้ำ หรือยังไม่เคย check-in เลย
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

  // ===== 2. ตรวจสอบ GPS (ถ้ามี location ผูกอยู่) =====
  let distance: number | null = null;
  if (attendance.location !== null) {
    // คำนวณระยะห่างระหว่างพนักงานกับ location ที่ผูกไว้ตอน check-in
    distance = calculateDistance(
      latitude,             // GPS ปัจจุบันของพนักงาน
      longitude,
      attendance.location.latitude,  // พิกัดศูนย์กลาง location
      attendance.location.longitude,
    );
    // เกิน radius → กำลังออกงานนอกพื้นที่ → ไม่อนุญาต
    if (distance > attendance.location.radius) {
      throw new Error(
        `คุณอยู่นอกพื้นที่ (ห่าง ${distance.toFixed(0)} ม., อนุญาตสูงสุด ${attendance.location.radius} ม.)`,
      );
    }
  }

  // ===== 3. อัพเดต check-out =====
  // SQL: UPDATE "Attendance" SET ... WHERE "attendanceId"=$1 RETURNING *
  const checkOutPhotoUrl = photo
    ? await uploadAttendancePhotoToSupabase(userId, photo, 'check-out')
    : null;

  const updatedAttendance = await prisma.attendance.update({
    where: { attendanceId: attendance.attendanceId }, // id ของ record ที่พบข้างบน
    data: {
      checkOut: now,          // timestamp ปัจจุบัน
      checkOutPhoto: checkOutPhotoUrl, // URL รูปจาก Supabase Storage
      checkOutLat: latitude,         // ← บังคับบันทึก GPS (ไม่ใช่ null)
      checkOutLng: longitude,
      checkOutAddress: address ?? null,    // reverse geocode ตอนออก
      checkOutDistance: distance,          // ← บันทึกระยะห่างจาก location (เมตร)
    },
    include: {
      // include เพื่อให้ response ที่ส่งกลับมีข้อมูลครบ
      user: { select: { userId: true, firstName: true, lastName: true, employeeId: true } },
      shift: true,
      location: true,
    },
  });

  // ===== 4. Audit Log =====
  // บันทึก oldValues: { checkOut: null } เพื่อให้เห็นว่าก่อนหน้านี้ยังไม่ได้ออก
  await createAuditLog({
    userId,
    action: AuditAction.CHECK_OUT,
    targetTable: 'attendance',
    targetId: updatedAttendance.attendanceId,
    oldValues: { checkOut: null },       // สภาพก่อน update
    newValues: updatedAttendance,        // สภาพหลัง update (มี checkOut แล้ว)
  });

  const responseAttendance = await enrichWithWorkSummary(updatedAttendance);

  return responseAttendance; // ส่งกลับ controller → WebSocket broadcast
};

/**
 * 📋 ดึงข้อมูลการเข้างานวันนี้ของ user
 *
 * ทำไมต้อง include shift และ location?
 * Frontend ต้องแสดงข้อมูลครบ (ชื่อกะ, สถานที่) บนหน้า Dashboard ทันที
 * ไม่ต้องยิง API เพิ่ม
 *
 * SQL: SELECT * FROM "Attendance"
 *   WHERE "userId"=$1
 *   AND "checkIn" >= TODAY AND "checkIn" < TOMORROW
 *   ORDER BY "checkIn" DESC
 */
export const getTodayAttendance = async (userId: number) => {
  const { start: today, end: tomorrow } = getThaiDayRange();

  const rows = await prisma.attendance.findMany({
    where: { userId, isDeleted: false, eventId: null, checkIn: { gte: today, lt: tomorrow } },
    include: { shift: true, location: true },
    orderBy: { checkIn: 'desc' },
  });

  const rowsWithShift = await attachMissingShiftRelations(rows);
  return Promise.all(rowsWithShift.map((row) => enrichWithWorkSummary(row)));
};

/**
 * 📋 ดึงประวัติการเข้างานของ user (ตัวเอง)
 *
 * SQL: SELECT * FROM "Attendance"
 *   WHERE "userId"=$1
 *   AND ("checkIn" >= $startDate)   -- ถ้ามี filter
 *   AND ("checkIn" <= $endDate)
 *   AND ("status" = $status)
 *   ORDER BY "checkIn" DESC
 */
export const getAttendanceHistory = async (
  userId: number,
  filters?: { startDate?: Date; endDate?: Date; status?: AttendanceStatus },
) => {
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

/**
 * 📋 ดึงประวัติการเข้างานทั้งหมด (Admin only)
 *
 * ทำไม Admin ถึงต้องเห็น role ของพนักงานด้วย?
 * เพื่อให้ filter หรือแสดงสีตาม role (Manager/User) บนหน้า Dashboard ได้
 *
 * SQL: SELECT a.*, u."firstName", u."role", s.*, l.*
 *   FROM "Attendance" a
 *   JOIN "User" u ON a."userId" = u."userId"
 *   LEFT JOIN "Shift" s ON a."shiftId" = s."shiftId"
 *   LEFT JOIN "Location" l ON a."locationId" = l."locationId"
 *   WHERE (conditions)
 *   ORDER BY a."checkIn" DESC
 */
export const getAllAttendances = async (filters?: {
  userId?: number;
  startDate?: Date;
  endDate?: Date;
  status?: AttendanceStatus;
}) => {
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

/**
 * 🔄 อัปเดตการเข้างาน (Admin only)
 *
 * ทำไม Admin ถึงต้องแก้ได้?
 * พนักงานลืม check-in/out, ระบบล่ม, หรือข้อมูล GPS ผิดพลาด
 * Admin ต้องแก้ไขแบบ manual พร้อมบันทึก audit ว่าใครแก้เมื่อไหร่
 *
 * SQL: UPDATE "Attendance" SET ... WHERE "attendanceId"=$1 RETURNING *
 */
export const updateAttendance = async (
  attendanceId: number,
  data: { status?: AttendanceStatus; note?: string; checkIn?: Date; checkOut?: Date; editReason?: string },
  editedByUserId?: number,
) => {
  // SQL: SELECT 1 FROM "Attendance" WHERE "attendanceId"=$1
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

/**
 * 🗑️ ลบการเข้างาน — Soft Delete (Admin only)
 *
 * ทำไมใช้ Soft Delete แทน Hard Delete?
 * - ข้อมูลการเข้างานเป็น historical record ที่มีนัยสำคัญทางกฎหมาย
 * - Audit Trail จะขาดหายถ้าลบจริง
 * - ถ้าลบผิดสามารถ restore ได้
 *
 * SQL: UPDATE "Attendance"
 *   SET "isDeleted"=true, "deleteReason"=$2
 *   WHERE "attendanceId"=$1
 */
export const deleteAttendance = async (
  attendanceId: number,
  deletedByUserId?: number,
  deleteReason?: string,
) => {
  const attendance = await prisma.attendance.findFirst({ where: { attendanceId, isDeleted: false } });
  if (attendance === null) throw new Error('ไม่พบข้อมูลการเข้างานที่ระบุ');

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

/**
 * 🤖 Auto Checkout
 * ปิดงานอัตโนมัติเมื่อเลยเวลาเลิกกะ + grace แล้ว แต่ยังไม่ได้ check-out
 */
export const autoCheckoutOverdueAttendances = async (): Promise<number> => {
  const now = new Date();

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

// ============================================
// 📤 Export
// ============================================

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
