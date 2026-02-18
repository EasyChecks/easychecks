import { AttendanceStatus } from '@prisma/client';
import type { Shift, Location } from '@prisma/client';
import { getDistance } from 'geolib';
import { prisma } from '../lib/prisma.js';
import { createAuditLog, AuditAction } from './audit.service.js';

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
  shiftId?: number;     // ถ้าไม่ส่งมา ระบบจะบันทึกแบบไม่มีกะ (walk-in)
  locationId?: number;  // ถ้าไม่ส่งมา ระบบจะไม่ตรวจสอบพิกัด
  photo?: string;       // Base64 selfie ใช้พิสูจน์ตัวตน
  latitude?: number;    // GPS จาก frontend — ใช้คู่กับ locationId
  longitude?: number;
  address?: string;     // ที่อยู่ที่ reverse geocode มาจาก frontend
}

export interface CheckOutDTO {
  userId: number;
  attendanceId?: number; // ระบุตรงเพื่อ check-out กะใดกะหนึ่ง; ถ้าไม่ระบุ → หาล่าสุดอัตโนมัติ
  shiftId?: number;
  photo?: string;
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

/**
 * ตัดสินสถานะการเข้างาน ON_TIME / LATE / ABSENT
 *
 * ทำไมไม่ hardcode threshold?
 * Admin สามารถตั้ง gracePeriodMinutes และ lateThresholdMinutes ต่อกะได้
 * → frontend ส่งมาใน CreateShiftDTO, บันทึกไว้ใน Shift record
 *
 * Logic:
 * diff ≤ 0  AND |diff| ≤ gracePeriod  → ON_TIME  (มาก่อน ภายใน grace)
 * diff = 0                             → ON_TIME  (ตรงเวลาพอดี)
 * 0 < diff ≤ lateThreshold             → LATE
 * diff > lateThreshold                 → ABSENT   (สายมากเกินไป)
 */
function calculateAttendanceStatus(
  checkInTime: string,
  shift: Shift,
): { status: AttendanceStatus; lateMinutes: number; message: string } {
  const diff = calculateTimeDifference(checkInTime, shift.startTime);
  const grace = shift.gracePeriodMinutes;       // เข้าก่อนได้กี่นาที
  const threshold = shift.lateThresholdMinutes; // สายเกินนี้ถือว่าขาด

  if (diff <= 0 && Math.abs(diff) <= grace) {
    return { status: 'ON_TIME', lateMinutes: 0, message: `เข้างานตรงเวลา (มาก่อน ${Math.abs(diff)} นาที)` };
  }
  if (diff === 0) {
    return { status: 'ON_TIME', lateMinutes: 0, message: 'เข้างานตรงเวลา' };
  }
  if (diff > 0 && diff <= threshold) {
    return { status: 'LATE', lateMinutes: diff, message: `มาสาย ${diff} นาที` };
  }
  return { status: 'ABSENT', lateMinutes: diff, message: `สายเกิน ${threshold} นาที — ถือว่าขาดงาน` };
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
  const { userId, shiftId, locationId, photo, latitude, longitude, address } = data;

  // ===== 1. ตรวจสอบการลงชื่อซ้ำในวันเดียวกัน =====
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1); // วันพรุ่งนี้ 00:00 → ใช้เป็น upper bound ของ range วันนี้

  // SQL: SELECT 1 FROM "LeaveRequest"
  //   WHERE "userId"=$1 AND status='APPROVED'
  //   AND "startDate" <= TODAY AND "endDate" >= TODAY
  //   AND "deletedAt" IS NULL
  const approvedLeave = await prisma.leaveRequest.findFirst({
    where: {
      userId,
      status: 'APPROVED',     // เฉพาะใบลาที่อนุมัติแล้วเท่านั้น
      deletedAt: null,         // soft-delete: ไม่นับใบลาที่ถูกลบ
      startDate: { lte: today },  // ใบลาเริ่มก่อนหรือวันนี้
      endDate: { gte: today },    // ใบลายังไม่หมด
    },
  });
  const hasApprovedLeave = approvedLeave !== null; // true = มีใบลาอนุมัติวันนี้

  // SQL: SELECT 1 FROM "Attendance"
  //   WHERE "userId"=$1 AND "checkIn" >= TODAY AND "checkIn" < TOMORROW
  //   AND ("shiftId"=$2 OR $2 IS NULL)
  const existingAttendance = await prisma.attendance.findFirst({
    where: {
      userId,
      ...(shiftId !== undefined && { shiftId }), // spread ว่างถ้า shiftId ไม่มี → ตรวจทุกกะ
      checkIn: { gte: today, lt: tomorrow },       // ช่วงวันนี้เท่านั้น
    },
  });
  if (existingAttendance !== null) {
    // พบ record วันนี้แล้ว → โยน Error ให้ controller ส่ง 500
    throw new Error(shiftId !== undefined ? 'คุณได้ check-in กะนี้ไปแล้ววันนี้' : 'คุณได้ check-in ไปแล้ววันนี้');
  }

  // ===== 2. ดึงข้อมูล Shift (ถ้ามี) =====
  // SQL: SELECT * FROM "Shift" WHERE "shiftId"=$1
  let shift: Shift | null = null;
  if (shiftId !== undefined) {
    shift = await prisma.shift.findUnique({ where: { shiftId } });
    if (shift === null) throw new Error('ไม่พบกะที่ระบุ');               // กะถูกลบไปแล้ว
    if (shift.userId !== userId) throw new Error('กะนี้ไม่ใช่ของคุณ');  // ป้องกัน check-in สลับกะคนอื่น
    if (!shift.isActive) throw new Error('กะนี้ถูกปิดใช้งานแล้ว');      // Admin ปิดกะแล้ว
  }

  // ===== 3. ตรวจสอบ Location (ถ้ามี) =====
  // SQL: SELECT * FROM "Location" WHERE "locationId"=$1
  let location: Location | null = null;
  let distance: number | null = null;
  // ลำดับความสำคัญ: locationId ที่ส่งมาตรง > locationId จาก Shift > ไม่มี
  const targetLocationId = locationId ?? shift?.locationId ?? undefined;

  if (targetLocationId !== undefined) {
    location = await prisma.location.findUnique({ where: { locationId: targetLocationId } });
    if (location === null) throw new Error('ไม่พบสถานที่ที่ระบุ');

    // ทำไมต้องตรวจสอบ GPS ก่อน write?
    // ป้องกัน record ค้างที่ไม่มี checkOut เพราะ location ผิด
    if (latitude !== undefined && longitude !== undefined) {
      distance = calculateDistance(latitude, longitude, location.latitude, location.longitude);
      // distance > radius → อยู่นอกพื้นที่ → ไม่อนุญาต
      if (distance > location.radius) {
        throw new Error(
          `คุณอยู่นอกพื้นที่ (ห่าง ${distance.toFixed(0)} ม., อนุญาตสูงสุด ${location.radius} ม.)`,
        );
      }
    }
  }

  // ===== 4. คำนวณสถานะ =====
  // แปลงเวลาปัจจุบันเป็น "HH:MM" เพื่อเปรียบเทียบกับ shift.startTime
  const checkInTime = new Date().toLocaleTimeString('th-TH', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });

  let status: AttendanceStatus = 'ON_TIME'; // default ถ้าไม่มีกะ
  let lateMinutes = 0;
  let message = 'เข้างาน';

  if (hasApprovedLeave) {
    // ทำไม LEAVE_APPROVED ไม่บล็อก check-in?
    // บางองค์กรต้องให้พนักงานลงชื่อแม้ในวันลา เพื่อยืนยันว่ามาจริง
    status = 'LEAVE_APPROVED';
    lateMinutes = 0;
    message = 'เข้างานในวันที่มีใบลาอนุมัติ';
  } else if (shift !== null) {
    // มีกะ → คำนวณด้วย gracePeriodMinutes และ lateThresholdMinutes ของกะนั้น
    const result = calculateAttendanceStatus(checkInTime, shift);
    status = result.status;           // ON_TIME / LATE / ABSENT
    lateMinutes = result.lateMinutes; // จำนวนนาทีที่สาย
    message = result.message;         // ข้อความสำหรับบันทึกใน note
  }

  // ===== 5. บันทึกลง Database =====
  // SQL: INSERT INTO "Attendance" (...) VALUES (...) RETURNING *
  //      + JOIN "User", "Shift", "Location"
  const attendance = await prisma.attendance.create({
    data: {
      userId,
      shiftId: shiftId ?? null,                    // null ถ้าเป็น walk-in
      locationId: targetLocationId ?? null,         // null ถ้าไม่ตรวจ GPS
      checkInPhoto: photo ?? null,                  // Base64 selfie
      checkInLat: latitude ?? null,                 // พิกัดตอนเข้า
      checkInLng: longitude ?? null,
      checkInAddress: address ?? null,              // ที่อยู่ reverse geocode
      checkInDistance: distance ?? null,            // ระยะห่างจาก location (เมตร)
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

  // ===== 1. หา record check-in ที่ยังไม่ได้ check-out =====
  let attendance;
  if (attendanceId !== undefined) {
    // มี attendanceId ตรง → ใช้กันกรณีพนักงานเปิดหลายกะพร้อมกัน (เลือก check-out กะใดกะหนึ่ง)
    // WHERE "attendanceId"=$1 AND "userId"=$2 AND "checkOut" IS NULL
    attendance = await prisma.attendance.findFirst({
      where: { attendanceId, userId, checkOut: null }, // checkOut: null = ยังไม่ออก
      include: { location: true }, // ต้องการ location.radius สำหรับตรวจ GPS
    });
  } else {
    // ไม่มี attendanceId → หา record ล่าสุดที่ยังไม่ check-out ของ user นี้
    // SQL: ORDER BY "checkIn" DESC LIMIT 1
    attendance = await prisma.attendance.findFirst({
      where: {
        userId,
        ...(shiftId !== undefined && { shiftId }), // กรองเพิ่มถ้าระบุ shiftId
        checkOut: null,                             // ยังไม่ได้ออก
      },
      orderBy: { checkIn: 'desc' }, // เอาล่าสุดก่อนเสมอ
      include: { location: true },
    });
  }

  // ไม่พบ record → อาจ check-out ซ้ำ หรือยังไม่เคย check-in เลย
  if (attendance === null || attendance === undefined) {
    throw new Error('ไม่พบการ check-in ที่ยังไม่ได้ check-out');
  }

  // ===== 2. ตรวจสอบ GPS (ถ้ามี location ผูกอยู่) =====
  let distance: number | null = null;
  if (attendance.location !== null && latitude !== undefined && longitude !== undefined) {
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
  const updatedAttendance = await prisma.attendance.update({
    where: { attendanceId: attendance.attendanceId }, // id ของ record ที่พบข้างบน
    data: {
      checkOut: new Date(),          // timestamp ปัจจุบัน
      checkOutPhoto: photo ?? null,  // selfie ตอนออก
      checkOutLat: latitude ?? null, // GPS ตอนออก
      checkOutLng: longitude ?? null,
      checkOutAddress: address ?? null,    // reverse geocode ตอนออก
      checkOutDistance: distance ?? null,  // ระยะห่างจาก location (เมตร)
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

  return updatedAttendance; // ส่งกลับ controller → WebSocket broadcast
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
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  return prisma.attendance.findMany({
    where: { userId, checkIn: { gte: today, lt: tomorrow } },
    include: { shift: true, location: true },
    orderBy: { checkIn: 'desc' },
  });
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
  return prisma.attendance.findMany({
    where: {
      userId,
      ...(filters?.startDate !== undefined && { checkIn: { gte: filters.startDate } }),
      ...(filters?.endDate !== undefined && { checkIn: { lte: filters.endDate } }),
      ...(filters?.status !== undefined && { status: filters.status }),
    },
    include: { shift: true, location: true },
    orderBy: { checkIn: 'desc' },
  });
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
  return prisma.attendance.findMany({
    where: {
      ...(filters?.userId !== undefined && { userId: filters.userId }),
      ...(filters?.startDate !== undefined && { checkIn: { gte: filters.startDate } }),
      ...(filters?.endDate !== undefined && { checkIn: { lte: filters.endDate } }),
      ...(filters?.status !== undefined && { status: filters.status }),
    },
    include: {
      user: {
        select: { userId: true, firstName: true, lastName: true, employeeId: true, role: true },
      },
      shift: true,
      location: true,
    },
    orderBy: { checkIn: 'desc' },
  });
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
  data: { status?: AttendanceStatus; note?: string; checkIn?: Date; checkOut?: Date },
  updatedByUserId?: number,
) => {
  // SQL: SELECT 1 FROM "Attendance" WHERE "attendanceId"=$1
  const attendance = await prisma.attendance.findUnique({ where: { attendanceId } });
  if (attendance === null) throw new Error('ไม่พบข้อมูลการเข้างานที่ระบุ');

  const updatedAttendance = await prisma.attendance.update({
    where: { attendanceId },
    data,
    include: {
      user: { select: { userId: true, firstName: true, lastName: true, employeeId: true } },
      shift: true,
      location: true,
    },
  });

  await createAuditLog({
    userId: updatedByUserId ?? attendance.userId,
    action: AuditAction.UPDATE_ATTENDANCE,
    targetTable: 'attendance',
    targetId: attendanceId,
    oldValues: attendance,
    newValues: updatedAttendance,
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
 *   SET "deletedAt"=NOW(), "deletedByUserId"=$2, "deleteReason"=$3
 *   WHERE "attendanceId"=$1
 */
export const deleteAttendance = async (
  attendanceId: number,
  deletedByUserId?: number,
  deleteReason?: string,
) => {
  const attendance = await prisma.attendance.findUnique({ where: { attendanceId } });
  if (attendance === null) throw new Error('ไม่พบข้อมูลการเข้างานที่ระบุ');

  await prisma.attendance.update({
    where: { attendanceId },
    data: {
      deletedAt: new Date(),
      deletedByUserId: deletedByUserId ?? attendance.userId,
      deleteReason: deleteReason ?? null,
    },
  });

  await createAuditLog({
    userId: deletedByUserId ?? attendance.userId,
    action: AuditAction.DELETE_ATTENDANCE,
    targetTable: 'attendance',
    targetId: attendanceId,
    oldValues: attendance,
  });

  return { message: 'ลบข้อมูลการเข้างานเรียบร้อยแล้ว (Soft Delete)' };
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
};

export default attendanceService;
