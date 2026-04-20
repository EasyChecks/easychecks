import { prisma } from '../lib/prisma.js';
import type { Event, EventParticipantType, Role } from '@prisma/client';
import { getDistance } from 'geolib';
import { createAuditLog, AuditAction } from './audit.service.js';

/**
 * Event Service - จัดการกิจกรรม/อีเวนต์
 */

export interface CreateEventDTO {
  userId: number; // ผู้สร้าง (Admin/SuperAdmin)
  eventName: string;
  description?: string;
  // Mode A: link to existing check-in location
  locationId?: number;
  // Mode B: custom venue (name + coordinates)
  venueName?: string;
  venueLatitude?: number;
  venueLongitude?: number;
  startDateTime: Date;
  endDateTime: Date;
  participantType: EventParticipantType;
  // รายชื่อผู้เข้าร่วม (ตาม participantType)
  participants?: {
    userIds?: number[]; // สำหรับ INDIVIDUAL
    branchIds?: number[]; // สำหรับ BRANCH
    roles?: Role[]; // สำหรับ ROLE
  };
}

export interface UpdateEventDTO {
  eventName?: string;
  description?: string;
  locationId?: number | null; // null = clear location (switch to custom)
  venueName?: string;
  venueLatitude?: number;
  venueLongitude?: number;
  startDateTime?: Date;
  endDateTime?: Date;
  participantType?: EventParticipantType;
  isActive?: boolean;
  updatedByUserId: number;
  // รายชื่อผู้เข้าร่วมใหม่ (ถ้าอัพเดต)
  participants?: {
    userIds?: number[];
    branchIds?: number[];
    roles?: Role[];
  };
}

export interface DeleteEventDTO {
  deletedByUserId: number;
  deleteReason?: string;
}

export interface SearchEventParams {
  search?: string;
  participantType?: EventParticipantType;
  isActive?: boolean;
  startDate?: Date;
  endDate?: Date;
  skip?: number;
  take?: number;
  branchId?: number; // กรองกิจกรรมตามสาขา (ALL หรือ BRANCH ที่มี branchId นี้)
  includeDeleted?: boolean; // รวมกิจกรรมที่ถูกลบด้วย
  onlyDeleted?: boolean; // แสดงเฉพาะกิจกรรมที่ลบแล้ว
}

// ========================================================================================
// ADMIN ACTIONS - การดำเนินการของผู้จัดการ/แอดมิน (เฉพาะ Admin/SuperAdmin)
// ========================================================================================

/**
 * ✨ ฟังก์ชันสร้างกิจกรรมใหม่
 * 
 * 🎯 เป้าหมาย: สร้างกิจกรรมและกำหนดผู้เข้าร่วมตามประเภทที่เลือก
 * 
 * 💡 เหตุผล: ต้องตรวจสอบสถานที่และวันเวลาก่อนเพื่อป้องกันการสร้างกิจกรรมที่ไม่สมบูรณ์
 *            แยกการเพิ่มผู้เข้าร่วมออกมาเพราะมีหลายประเภท (ALL, INDIVIDUAL, BRANCH, ROLE)
 */
async function createEvent(data: CreateEventDTO): Promise<Event> {
  // ── ① ตรวจสอบสถานที่ (เฉพาะ Mode A ที่ส่ง locationId มา) ───────────────────
  // Mode B = กำหนดสถานที่เอง (venueName + lat/lng) → ไม่มี locationId → ข้ามส่วนนี้ได้
  if (data.locationId) {
    // [READ] SELECT * FROM locations WHERE location_id = $1 LIMIT 1
    // findUnique ค้นด้วย Primary Key → คืน object ถ้าเจอ, null ถ้าไม่เจอ
    const location = await prisma.location.findUnique({
      where: { locationId: data.locationId },
    });

    if (!location) throw new Error('ไม่พบสถานที่'); // หาไม่เจอ → หยุดทันที

    // ตาราง locations ใช้ Soft Delete ผ่านฟิลด์ delete_reason
    // null = ยังใช้งานได้ | มีค่า = ถูกลบแล้ว → ห้ามสร้างกิจกรรมในสถานที่ที่ลบไปแล้ว
    if (location.deleteReason) throw new Error('ไม่สามารถสร้างกิจกรรมในสถานที่ที่ถูกลบแล้ว');
  }

  // ── ② ตรวจสอบช่วงวันเวลา ─────────────────────────────────────────────────────
  const startDateTime = new Date(data.startDateTime); // แปลงเป็น Date object เพื่อเปรียบเทียบ
  const endDateTime   = new Date(data.endDateTime);   // วันเวลาสิ้นสุด

  // เวลาเริ่มต้อง "น้อยกว่า" เวลาสิ้นสุดเสมอ เช่น 09:00 < 17:00
  if (startDateTime >= endDateTime) throw new Error('วันเวลาเริ่มต้องน้อยกว่าวันเวลาสิ้นสุด');

  // ── ③ INSERT กิจกรรมลงตาราง events ─────────────────────────────────────────
  // [CREATE] INSERT INTO events (event_name, description, location_id, venue_name,
  //          venue_latitude, venue_longitude, start_date_time, end_date_time,
  //          participant_type, created_by_user_id) VALUES (...) RETURNING *
  // include = LEFT JOIN → ดึง location + creator กลับมาพร้อมกัน (ไม่ต้อง query แยก)
  const event = await prisma.event.create({
    data: {
      eventName: data.eventName,              // ชื่อกิจกรรม → event_name
      description: data.description,          // คำอธิบาย (optional) → description
      locationId: data.locationId ?? null,    // FK → locations.location_id (Mode A)
      venueName: data.venueName ?? null,      // ชื่อสถานที่กำหนดเอง (Mode B) → venue_name
      venueLatitude: data.venueLatitude ?? null,   // พิกัด lat (Mode B) → venue_latitude
      venueLongitude: data.venueLongitude ?? null, // พิกัด lng (Mode B) → venue_longitude
      startDateTime,                          // วันเวลาเริ่มต้น → start_date_time
      endDateTime,                            // วันเวลาสิ้นสุด → end_date_time
      participantType: data.participantType,  // ALL | INDIVIDUAL | BRANCH | ROLE
      createdByUserId: data.userId,           // FK → users.user_id (ผู้สร้างกิจกรรม)
    },
    include: {
      location: true, // LEFT JOIN locations ON events.location_id = locations.location_id
      creator: {
        select: { userId: true, firstName: true, lastName: true },
      },              // LEFT JOIN users ON events.created_by_user_id = users.user_id
    },
  });

  // ── ④ INSERT ผู้เข้าร่วม (ถ้าไม่ใช่ ALL) ─────────────────────────────────────
  // ALL → ทุกคนเข้าร่วมได้อัตโนมัติ ไม่ต้องระบุรายชื่อ
  // INDIVIDUAL / BRANCH / ROLE → ต้อง INSERT ลงตาราง event_participants แยกต่างหาก
  if (data.participantType !== 'ALL' && data.participants) {
    await addEventParticipants(event.eventId, data.participantType, data.participants);
  }

  // ── ⑤ บันทึก Audit Log ───────────────────────────────────────────────────────
  // [CREATE] INSERT INTO audit_logs → เก็บประวัติ: "ใคร ทำอะไร กับ record ไหน เมื่อไหร่"
  await createAuditLog({
    userId: data.userId,               // ผู้ดำเนินการ → FK → users.user_id
    action: AuditAction.CREATE_EVENT,  // ประเภท = สร้างกิจกรรม
    targetTable: 'events',             // ตารางที่ถูกเปลี่ยนแปลง
    targetId: event.eventId,           // event_id ของ record ที่เพิ่งสร้าง
    newValues: { eventName: event.eventName, locationId: event.locationId, participantType: event.participantType, startDateTime: event.startDateTime, endDateTime: event.endDateTime },
  });

  return event; // ส่ง event object (พร้อม location + creator) กลับไปให้ controller
}

/**
 * ✨ ฟังก์ชันเพิ่มผู้เข้าร่วมกิจกรรม
 * 
 * 🎯 เป้าหมาย: เพิ่มผู้เข้าร่วมตามประเภทที่กำหนด (INDIVIDUAL, BRANCH, ROLE)
 * 
 * 💡 เหตุผล: แยกฟังก์ชันนี้ออกมาเพราะโลจิกการเพิ่มผู้เข้าร่วมแต่ละประเภทต่างกัน
 *            - INDIVIDUAL: ต้องตรวจสอบว่า user มีอยู่จริงในระบบ
 *            - BRANCH: ต้องตรวจสอบว่า branch มีอยู่จริง
 *            - ROLE: ไม่ต้องตรวจสอบเพราะเป็น enum ที่กำหนดไว้แล้ว
 *            - ALL: ไม่ต้องเพิ่มรายชื่อเพราะทุกคนเข้าร่วมได้อัตโนมัติ
 */
async function addEventParticipants(
  eventId: number,
  participantType: EventParticipantType,
  participants: {
    userIds?: number[];
    branchIds?: number[];
    roles?: Role[];
  }
) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const participantsToCreate: any[] = []; // array กลางที่จะสะสม rows สำหรับ Bulk INSERT

  // ── กรณี INDIVIDUAL — ระบุรายบุคคล ──────────────────────────────────────────
  if (participantType === 'INDIVIDUAL' && participants.userIds) {
    // [READ] SELECT * FROM users WHERE user_id IN ($1, $2, ...)
    // findMany + IN clause → ดึงทุก user ที่ระบุในครั้งเดียว (ดีกว่า loop query ทีละ ID)
    const users = await prisma.user.findMany({
      where: { userId: { in: participants.userIds } },
    });

    // ถ้าจำนวนที่หาได้ ≠ จำนวนที่ส่งมา → มี userId บางตัวไม่มีในระบบ → หยุดทันที
    if (users.length !== participants.userIds.length) {
      throw new Error('พบผู้ใช้บางคนไม่อยู่ในระบบ');
    }

    // เตรียม rows: { eventId, userId } → จะ INSERT ทีเดียวในขั้นตอนสุดท้าย
    participantsToCreate.push(
      ...participants.userIds.map((userId) => ({ eventId, userId }))
    );
  }

  // ── กรณี BRANCH — ระบุตามสาขา ───────────────────────────────────────────────
  if (participantType === 'BRANCH' && participants.branchIds) {
    // [READ] SELECT * FROM branches WHERE branch_id IN ($1, $2, ...)
    // ตรวจว่า branchId ทุกตัวที่ส่งมามีอยู่ในตาราง branches จริง
    const branches = await prisma.branch.findMany({
      where: { branchId: { in: participants.branchIds } },
    });

    // จำนวนไม่ตรง → มี branchId ที่ไม่มีในระบบ → หยุดทันที
    if (branches.length !== participants.branchIds.length) {
      throw new Error('พบสาขาบางแห่งไม่อยู่ในระบบ');
    }

    // เตรียม rows: { eventId, branchId } → สำหรับแต่ละสาขา
    participantsToCreate.push(
      ...participants.branchIds.map((branchId) => ({ eventId, branchId }))
    );
  }

  // ── กรณี ROLE — ระบุตามบทบาท ─────────────────────────────────────────────────
  if (participantType === 'ROLE' && participants.roles) {
    // role เป็น enum ที่กำหนดไว้แล้วใน schema → ไม่ต้องตรวจว่ามีในตารางหรือไม่
    // เตรียม rows: { eventId, role } → สำหรับแต่ละ role
    participantsToCreate.push(
      ...participants.roles.map((role) => ({ eventId, role }))
    );
  }

  // ── Bulk INSERT ผู้เข้าร่วมทั้งหมดในครั้งเดียว ────────────────────────────────
  if (participantsToCreate.length > 0) {
    // [CREATE] INSERT INTO event_participants (event_id, user_id, branch_id, role)
    //          VALUES ($1,$2,$3,$4), ($5,$6,$7,$8), ... → หลาย rows ในคำสั่งเดียว
    // createMany ดีกว่า loop create() เพราะส่ง query เดียวไป DB (ลด round-trip)
    await prisma.eventParticipant.createMany({
      data: participantsToCreate,
    });
  }
}

/**
 * ✨ ฟังก์ชันดึงรายการกิจกรรมทั้งหมดพร้อมการกรองและนับสถิติ
 * 
 * 🎯 เป้าหมาย: ดึงกิจกรรมตามเงื่อนไขพร้อมสถิติจำนวนทั้งหมด/ใช้งาน/ไม่ใช้งาน
 * 
 * 💡 เหตุผล: ใช้ Promise.all เพื่อ query ข้อมูลและนับสถิติพร้อมกัน (parallel queries)
 *            ทำให้ได้ประสิทธิภาพดีกว่า query ทีละอัน
 *            กรอง deletedAt: null เพื่อไม่แสดงที่ถูก soft delete
 */
async function getAllEvents(params: SearchEventParams): Promise<{
  data: Event[];
  total: number;
  active: number;
  inactive: number;
}> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const where: any = {}; // object นี้จะค่อยๆ สะสมเงื่อนไข WHERE ตาม parameter ที่รับมา

  // ── ① กำหนดเงื่อนไขการลบ (soft-deleted records) ───────────────────────
  // delete_reason: null = ยังใช้งานปกติ | มีค่า = ถูกลบแล้ว
  if (params.onlyDeleted) {
    where.deleteReason = { not: null }; // WHERE delete_reason IS NOT NULL → เอาเฉพาะสิ่งที่ถูกลบ
  } else if (!params.includeDeleted) {
    where.deleteReason = null; // WHERE delete_reason IS NULL → ซ่อนสิ่งที่ถูกลบ (default)
  }
  // includeDeleted = true → ไม่เพิ่มเงื่อนไข delete_reason → แสดงทุก record

  // ── ② กำหนดเงื่อนไขการค้นหา (full-text search) ─────────────────────────────
  // 📍 SQL เบื้องหลัง: WHERE (event_name ILIKE '%search%' OR description ILIKE '%search%')
  if (params.search) {
    // contains + insensitive = ILIKE → ค้นหาแบบไม่สนใจตัวพิมพ์เล็ก-ใหญ่
    where.OR = [
      { eventName: { contains: params.search, mode: 'insensitive' } }, // ค้นจากชื่อกิจกรรม
      { description: { contains: params.search, mode: 'insensitive' } }, // ค้นจากคำอธิบาย
    ];
  }

  // ── ③ กรองตามประเภทผู้เข้าร่วม ──────────────────────────────────────────
  if (params.participantType) {
    where.participantType = params.participantType; // WHERE participant_type = $1
  }

  // ── ④ กรองตามสถานะ active/inactive ────────────────────────────────────
  if (params.isActive !== undefined) {
    where.isActive = params.isActive; // WHERE is_active = true หรือ WHERE is_active = false
  }

  // ── ⑤ กรองตามช่วงวันที่ ────────────────────────────────────────────────
  if (params.startDate || params.endDate) {
    where.AND = []; // AND รวมหลายเงื่อนไขพร้อมกัน
    if (params.startDate) {
      where.AND.push({ startDateTime: { gte: params.startDate } }); // start_date_time >= $startDate
    }
    if (params.endDate) {
      where.AND.push({ endDateTime: { lte: params.endDate } }); // end_date_time <= $endDate
    }
  }

  // ── ⑥ กรองตามสาขา (เฉพาะ Admin ที่มี branchId) ─────────────────────────────
  if (params.branchId) {
    if (!where.AND) where.AND = [];
    // แสดงกิจกรรมที่ user สาขานี้เห็นได้: participantType=ALL หรือ participantType=BRANCH ที่มี branchId นี้
    // WHERE (participant_type = 'ALL' OR (participant_type = 'BRANCH' AND
    //        EXISTS (SELECT 1 FROM event_participants WHERE event_id = $1 AND branch_id = $2)))
    where.AND.push({
      OR: [
        { participantType: 'ALL' }, // กิจกรรมสำหรับทุกคน → เห็นได้เสมอ
        {
          participantType: 'BRANCH',
          event_participants: {
            some: { branchId: params.branchId }, // EXISTS subquery → มี branch นี้ใน event_participants
          },
        },
      ],
    });
  }

  // ── ⑦ ยิง 4 queries พร้อมกัน (Parallel) เพื่อลดเวลารอ ──────────────────────
  // [READ] ใช้ Promise.all → ส่งทุก query ไป DB พร้อมกัน แทนที่จะรอทีละอัน
  // ├── Query 1: SELECT ... FROM events WHERE ... LIMIT $take OFFSET $skip  (ดึงข้อมูลพร้อม pagination)
  // ├── Query 2: SELECT COUNT(*) FROM events WHERE ...                      (นับทั้งหมด)
  // ├── Query 3: SELECT COUNT(*) FROM events WHERE ... AND is_active = true  (นับ active)
  // └── Query 4: SELECT COUNT(*) FROM events WHERE ... AND is_active = false (นับ inactive)
  const [data, total, active, inactive] = await Promise.all([
    prisma.event.findMany({
      where,
      skip: params.skip || 0,
      take: params.take || 20,
      orderBy: [{ startDateTime: 'desc' }],
      include: {
        location: {
          select: {
            locationId: true,
            locationName: true,
            address: true,
            latitude: true,
            longitude: true,
            radius: true,
          },
        },
        creator: {
          select: {
            userId: true,
            firstName: true,
            lastName: true,
            branchId: true,
            role: true,
          },
        },
        _count: {
          select: {
            event_participants: true,
            attendance: true,
          },
        },
        event_participants: {
          select: {
            branchId: true,
          },
        },
      },
    }),
    prisma.event.count({ where }),
    prisma.event.count({ where: { ...where, isActive: true } }),
    prisma.event.count({ where: { ...where, isActive: false } }),
  ]);

  return { data, total, active, inactive };
}

/**
 * ดึงกิจกรรมด้วย ID พร้อมรายชื่อผู้เข้าร่วม
 */
async function getEventById(eventId: number): Promise<Event | null> {
  // [READ] SELECT e.*, l.*, u.* (creator), ep.*, eu.* (user), eb.* (branch)
  //        FROM events e
  //        LEFT JOIN locations l        ON e.location_id = l.location_id
  //        LEFT JOIN users u            ON e.created_by_user_id = u.user_id
  //        LEFT JOIN event_participants ep ON e.event_id = ep.event_id
  //        LEFT JOIN users eu           ON ep.user_id = eu.user_id
  //        LEFT JOIN branches eb        ON ep.branch_id = eb.branch_id
  //        WHERE e.event_id = $1
  // findUnique + ชุด include ที่ซ้อนกัน = ยิง query เดียวได้ข้อมูลครบทุก JOIN
  const event = await prisma.event.findUnique({
    where: { eventId },
    include: {
      location: true,
      creator: {
        select: {
          userId: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
        },
      },
      event_participants: {
        include: {
          users: {
            select: {
              userId: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          branches: {
            select: {
              branchId: true,
              name: true,
              code: true,
            },
          },
        },
      },
      _count: {
        select: {
          attendance: true,
        },
      },
      attendance: {
        where: { isDeleted: false },
        select: {
          attendanceId: true,
          checkIn: true,
          checkOut: true,
          user: {
            select: {
              userId: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
        orderBy: { checkIn: 'asc' },
      },
    },
  });

  return event;
}

/**
 * แก้ไขกิจกรรม
 */
async function updateEvent(
  eventId: number,
  data: UpdateEventDTO
): Promise<Event> {
  // ── ① ดึงข้อมูลกิจกรรมเดิมจาก DB ──────────────────────────────────────────────
  // [READ] SELECT * FROM events WHERE event_id = $1 LIMIT 1
  // เก็บชื่อกิจกรรมเดิมไว้เพื่อใช้ใน oldValues ของ Audit Log และตรวจสอบเงื่อนไข
  const event = await prisma.event.findUnique({
    where: { eventId },
    include: { creator: { select: { branchId: true } } },
  });

  if (!event) throw new Error('ไม่พบกิจกรรม'); // ไม่ล้ะ record นี้ใน DB → หยุดทันที

  // กิจกรรมที่ลบไปแล้ว ไม่สามารถแก้ไขได้อีก (delete_reason มีค่า = ถูกลบ)
  if (event.deleteReason) throw new Error('ไม่สามารถแก้ไขกิจกรรมที่ถูกลบแล้ว');

  // Security: Admin แก้ไขได้เฉพาะกิจกรรมที่สร้างโดยคนในสาขาเดียวกัน
  const updatingUser = await prisma.user.findUnique({
    where: { userId: data.updatedByUserId },
    select: { role: true, branchId: true },
  });
  if (updatingUser?.role === 'ADMIN' && event.creator?.branchId !== updatingUser.branchId) {
    throw new Error('คุณไม่มีสิทธิ์จัดการกิจกรรมของสาขาอื่น');
  }

  // ── ② ตรวจสอบวันเวลา (ถ้ามีการเปลี่ยน) ────────────────────────────────────
  if (data.startDateTime || data.endDateTime) {
    // ถ้าอัพเดตเพียงวันเดียว ใช้ค่าเดิมของอีกวันร่วมตรวจสอบ
    const startDateTime = data.startDateTime ? new Date(data.startDateTime) : event.startDateTime;
    const endDateTime   = data.endDateTime   ? new Date(data.endDateTime)   : event.endDateTime;

    // เวลาเริ่มต้องน้อยกว่าเวลาสิ้นสุดเสมอ เช่น 09:00 < 17:00
    if (startDateTime >= endDateTime) throw new Error('วันเวลาเริ่มต้องน้อยกว่าวันเวลาสิ้นสุด');
  }

  // ── ③ อัพเดตผู้เข้าร่วม (ถ้ามีการเปลี่ยน) ───────────────────────────────────
  if (data.participantType || data.participants) {
    const newParticipantType = data.participantType || event.participantType;

    // [DELETE] DELETE FROM event_participants WHERE event_id = $1
    // ลบผู้เข้าร่วมชุดเดิมทั้งหมดก่อน (Delete-then-Insert pattern: ง่ายกว่าเพิ่ม-ลบ-เปลี่ยน)
    await prisma.eventParticipant.deleteMany({ where: { eventId } });

    // [CREATE] INSERT INTO event_participants ... → เพิ่มผู้เข้าร่วมชุดใหม่
    if (newParticipantType !== 'ALL' && data.participants) {
      await addEventParticipants(eventId, newParticipantType, data.participants);
    }
  }

  // ── ④ UPDATE กิจกรรมในตาราง events ──────────────────────────────────────────
  // [UPDATE] UPDATE events SET event_name=$1, description=$2, location_id=$3, ... WHERE event_id=$N RETURNING *
  // Prisma อัพเดตเฉพาะฟิลด์ที่มีค่าอยู่ (ฟิลด์ที่เป็น undefined → ไม่เปลี่ยนค่าใน DB)
  const updatedEvent = await prisma.event.update({
    where: { eventId }, // WHERE event_id = $1 → Primary Key
    data: {
      eventName: data.eventName,              // ชื่อกิจกรรม
      description: data.description,          // คำอธิบาย
      locationId: data.locationId,            // undefined = ไม่เปลี่ยน, null = ล้างค่า
      venueName: data.venueName,              // ชื่อสถานที่กำหนดเอง
      venueLatitude: data.venueLatitude,      // พิกัด lat
      venueLongitude: data.venueLongitude,    // พิกัด lng
      startDateTime: data.startDateTime,      // วันเวลาเริ่ม
      endDateTime: data.endDateTime,          // วันเวลาสิ้น
      participantType: data.participantType,  // ประเภทผู้เข้าร่วม
      isActive: data.isActive,               // เปิด/ปิดกิจกรรม
    },
    include: {
      location: true, // LEFT JOIN locations → คืนข้อมูลสถานที่มาด้วย
      creator: {
        select: { userId: true, firstName: true, lastName: true },
      },              // LEFT JOIN users → คืนชื่อผู้สร้างมาด้วย
    },
  });

  // ── ⑤ บันทึก Audit Log ──────────────────────────────────────────────────────
  // [CREATE] INSERT INTO audit_logs → เก็บค่าเดิม (oldValues) และค่าใหม่ (newValues) เพื่อตรวจย้อนหลัง
  await createAuditLog({
    userId: data.updatedByUserId,               // ผู้มีสิทธ(ิ แก้ไขกิจกรรม)
    action: AuditAction.UPDATE_EVENT,           // ประเภท = แก้ไขกิจกรรม
    targetTable: 'events',
    targetId: eventId,
    oldValues: { eventName: event.eventName, isActive: event.isActive, startDateTime: event.startDateTime, endDateTime: event.endDateTime },
    newValues: { eventName: updatedEvent.eventName, isActive: updatedEvent.isActive, startDateTime: updatedEvent.startDateTime, endDateTime: updatedEvent.endDateTime },
  });

  return updatedEvent; // ส่งกิจกรรมที่อัพเดตแล้ว (พร้อม location + creator) กลับไปให้ controller
}

/**
 * ลบกิจกรรม (Hard Delete — ลบออกจาก DB จริงทันที)
 */
async function deleteEvent(
  eventId: number,
  data: DeleteEventDTO
): Promise<Event> {
  // ── ① ดึงกิจกรรมเพื่อเก็บชื่อไว้บันทึก Audit Log ─────────────────────────
  // [READ] SELECT * FROM events WHERE event_id = $1 LIMIT 1
  const event = await prisma.event.findUnique({
    where: { eventId },
    include: { creator: { select: { branchId: true } } },
  });

  if (!event) throw new Error('ไม่พบกิจกรรม'); // หาไม่เจอ → หยุดทันที

  // Security: Admin ลบได้เฉพาะกิจกรรมที่สร้างโดยคนในสาขาเดียวกัน
  const deletingUser = await prisma.user.findUnique({
    where: { userId: data.deletedByUserId },
    select: { role: true, branchId: true },
  });
  if (deletingUser?.role === 'ADMIN' && event.creator?.branchId !== deletingUser.branchId) {
    throw new Error('คุณไม่มีสิทธิ์จัดการกิจกรรมของสาขาอื่น');
  }

  // ── ② ลบผู้เข้าร่วมก่อน (FK constraint) ────────────────────────────────────────
  // [DELETE] DELETE FROM event_participants WHERE event_id = $1
  // ต้องลบตารางลูกก่อน เพราะ event_participants.event_id เป็น FK อ้างอิง events.event_id
  await prisma.eventParticipant.deleteMany({ where: { eventId } });

  // ── ③ ลบ attendance records ที่เกี่ยวข้อง ───────────────────────────────────────
  // [DELETE] DELETE FROM attendance WHERE event_id = $1
  // attendance.event_id เป็น FK อ้างอิง events.event_id → ต้องลบก่อนเช่นกัน
  await prisma.attendance.deleteMany({ where: { eventId } });

  // ── ④ ลบตัวกิจกรรมออกจาก DB จริง ──────────────────────────────────────────
  // [DELETE] DELETE FROM events WHERE event_id = $1 RETURNING *
  // ข้อมูลถูกลบถาวร ไม่สามารถกู้คืนได้
  const deletedEvent = await prisma.event.delete({ where: { eventId } });

  // ── ⑤ บันทึก Audit Log ──────────────────────────────────────────────────────
  // [CREATE] INSERT INTO audit_logs → เก็บประวัติการลบสำหรับตรวจสอบย้อนหลัง
  await createAuditLog({
    userId: data.deletedByUserId,       // ผู้ดำเนินการ → FK → users.user_id
    action: AuditAction.DELETE_EVENT,   // ประเภท = ลบกิจกรรม
    targetTable: 'events',
    targetId: eventId,
    oldValues: { eventName: event.eventName }, // ชื่อกิจกรรมก่อนลบ
    newValues: { deleted: true },             // สถานะหลังลบ
  });

  return deletedEvent; // ส่ง record ที่เพิ่งลบกลับไปตามมาตรฐาน Prisma
}

/**
 * ✨ ฟังก์ชันดึงกิจกรรมที่ผู้ใช้เข้าร่วมได้
 * 
 * 🎯 เป้าหมาย: แสดงเฉพาะกิจกรรมที่เกี่ยวข้องกับผู้ใช้ตาม participantType
 * 
 * 💡 เหตุผล: ต้อง query branch และ role ของผู้ใช้ก่อนเพื่อใช้ในการกรอง
 *            ใช้ OR conditions เพื่อครอบคลุมทั้ง 4 ประเภท (ALL, INDIVIDUAL, BRANCH, ROLE)
 *            กรองเฉพาะกิจกรรมที่ยังไม่สิ้นสุด (endDateTime >= now)
 */
async function getMyEvents(userId: number): Promise<Event[]> {
  // [READ] SELECT branch_id, role FROM users WHERE user_id = $1 LIMIT 1
  // ดึงเฉพาะ branchId + role ของ user ก่อน → ต้องใช้ในการสร้าง WHERE condition ด้านล่าง
  // (เพราะต้องกรองกิจกรรมตาม BRANCH และ ROLE ของ user คนนี้)
  const user = await prisma.user.findUnique({
    where: { userId },
    select: { branchId: true, role: true },
  });

  if (!user) {
    throw new Error('ไม่พบผู้ใช้');
  }

  const now = new Date();

  // [READ] ค้นหากิจกรรมที่ user เข้าร่วมได้ ด้วย OR condition 4 แบบ:
  // 🎯 สาเหตุที่ต้องครอบคลุมทั้ง 4 รูปแบบ:
  //    1. participantType = ALL: ทุกคนเข้าร่วมได้
  //    2. participantType = INDIVIDUAL: ตรวจว่ามี userId ใน EventParticipant
  //    3. participantType = BRANCH: ตรวจว่ามี branchId ตรงกัน
  //    4. participantType = ROLE: ตรวจว่ามี role ตรงกัน
  // 📍 SQL เบื้องหลัง:
  // SELECT e.*, l.location_id, l.location_name, l.address, l.latitude, l.longitude, l.radius
  // FROM events e
  // LEFT JOIN locations l ON e.location_id = l.location_id
  // WHERE e.delete_reason IS NULL AND e.is_active = true AND e.end_date_time >= NOW()
  // AND (
  //   e.participant_type = 'ALL'
  //   OR (e.participant_type = 'INDIVIDUAL' AND EXISTS (SELECT 1 FROM event_participants WHERE event_id = e.event_id AND user_id = $1))
  //   OR (e.participant_type = 'BRANCH' AND EXISTS (SELECT 1 FROM event_participants WHERE event_id = e.event_id AND branch_id = $2))
  //   OR (e.participant_type = 'ROLE' AND EXISTS (SELECT 1 FROM event_participants WHERE event_id = e.event_id AND role = $3))
  // )
  // ORDER BY e.start_date_time ASC
  const events = await prisma.event.findMany({
    where: {
      deleteReason: null,
      isActive: true,
      endDateTime: { gte: now }, // แสดงเฉพาะกิจกรรมที่ยังไม่จบ
      OR: [
        { participantType: 'ALL' }, // กิจกรรมสำหรับทุกคน
        {
          // กิจกรรมที่ระบุรายบุคคล
          participantType: 'INDIVIDUAL',
          event_participants: {
            some: { userId },
          },
        },
        {
          // กิจกรรมที่ระบุตามสาขา
          participantType: 'BRANCH',
          event_participants: {
            some: { branchId: user.branchId },
          },
        },
        {
          // กิจกรรมที่ระบุตามบทบาท
          participantType: 'ROLE',
          event_participants: {
            some: { role: user.role },
          },
        },
      ],
    },
    orderBy: { startDateTime: 'asc' },
    include: {
      location: {
        select: {
          locationId: true,
          locationName: true,
          address: true,
          latitude: true,
          longitude: true,
          radius: true,
        },
      },
      _count: {
        select: {
          attendance: true,
        },
      },
    },
  });

  return events;
}

/**
 * ✨ ฟังก์ชันดึงสถิติกิจกรรมทั้งหมด
 * 
 * 🎯 เป้าหมาย: คำนวณสถิติและจัดกลุ่มกิจกรรมแบบต่างๆ สำหรับ Dashboard
 * 
 * 💡 เหตุผล: แยกกิจกรรมตามสถานะเวลา (upcoming, ongoing, past)
 *            เพื่อเห็นภาพรวมของกิจกรรม
 *            ใช้ groupBy เพื่อจัดกลุ่มตาม participantType
 */
async function getEventStatistics(): Promise<{
  totalEvents: number;
  activeEvents: number;
  upcomingEvents: number;
  ongoingEvents: number;
  pastEvents: number;
  deletedEvents: number;
  byParticipantType: { type: string; count: number }[];
}> {
  const now = new Date();

  // [READ] ยิง 7 queries พร้อมกัน (Parallel) ด้วย Promise.all → ได้ครบทุกสถิติในครั้งเดียว
  // ├── 1. COUNT(*) WHERE delete_reason IS NULL                                   (ทั้งหมด)
  // ├── 2. COUNT(*) WHERE delete_reason IS NULL AND is_active = true              (active)
  // ├── 3. COUNT(*) WHERE ... AND start_date_time > NOW()                         (ยังไม่เริ่ม)
  // ├── 4. COUNT(*) WHERE ... AND start_date_time <= NOW() AND end_date_time >= NOW() (กำลังดำเนินการ)
  // ├── 5. COUNT(*) WHERE delete_reason IS NULL AND end_date_time < NOW()          (สิ้นสุดแล้ว)
  // ├── 6. COUNT(*) WHERE delete_reason IS NOT NULL                               (ถูกลบ)
  // └── 7. GROUP BY participant_type, COUNT(*) WHERE delete_reason IS NULL        (จำแนกตามประเภท)
  const [
    totalEvents,
    activeEvents,
    upcomingEvents,
    ongoingEvents,
    pastEvents,
    deletedEvents,
    byTypeRaw,
  ] = await Promise.all([
    prisma.event.count({ where: { deleteReason: null } }),
    prisma.event.count({ where: { deleteReason: null, isActive: true } }),
    prisma.event.count({
      where: { deleteReason: null, isActive: true, startDateTime: { gt: now } },
    }),
    prisma.event.count({
      where: {
        deleteReason: null,
        isActive: true,
        startDateTime: { lte: now },
        endDateTime: { gte: now },
      },
    }),
    prisma.event.count({
      where: { deleteReason: null, endDateTime: { lt: now } },
    }),
    prisma.event.count({ where: { deleteReason: { not: null } } }),
    prisma.event.groupBy({
      by: ['participantType'],
      where: { deleteReason: null },
      _count: true,
    }),
  ]);

  const byParticipantType = byTypeRaw.map((item) => ({
    type: item.participantType,
    count: item._count,
  }));

  return {
    totalEvents,
    activeEvents,
    upcomingEvents,
    ongoingEvents,
    pastEvents,
    deletedEvents,
    byParticipantType,
  };
}

// ========================================================================================
// USER EVENT CHECK-IN/CHECK-OUT — การเข้าร่วมกิจกรรมของพนักงาน
// ========================================================================================

export interface EventCheckInDTO {
  userId: number;
  eventId: number;
  photo?: string;       // Base64 selfie
  latitude?: number;
  longitude?: number;
  address?: string;
}

export interface EventCheckOutDTO {
  userId: number;
  eventId: number;
  photo?: string;
  latitude?: number;
  longitude?: number;
  address?: string;
}

/**
 * ตรวจสอบว่า user เป็นผู้เข้าร่วมกิจกรรมที่ eligible หรือไม่
 */
async function isEligibleParticipant(userId: number, eventId: number): Promise<boolean> {
  // [READ] SELECT branch_id, role FROM users WHERE user_id = $1 LIMIT 1
  // ดึงเฉพาะฟิลด์ที่จำเป็นแทนที่จะดึง user ทั้งแถว (select ลด bandwidth)
  const user = await prisma.user.findUnique({
    where: { userId },
    select: { branchId: true, role: true }, // เอาแค่ branchId + role ที่จำเป็น
  });
  if (!user) return false; // ไม่มี user นี้ในระบบ → ไม่มีสิทธิ์

  // [READ] SELECT participant_type FROM events WHERE event_id = $1 LIMIT 1
  // ดึงเฉพาะ participantType เพื่อตรวจว่ากิจกรรมนี้ใช้เกณฑ์เข้าร่วมแบบไหน
  const event = await prisma.event.findUnique({
    where: { eventId },
    select: { participantType: true }, // เอาแค่ฟิลด์เดียวที่ต้องการ
  });
  if (!event) return false; // ไม่มีกิจกรรมนี้ในระบบ → ไม่มีสิทธิ์

  // ALL → ทุกคนเข้าร่วมได้อัตโนมัติ ไม่ต้องตรวจสอบเพิ่มเติม
  if (event.participantType === 'ALL') return true;

  if (event.participantType === 'INDIVIDUAL') {
    // [READ] SELECT * FROM event_participants WHERE event_id = $1 AND user_id = $2 LIMIT 1
    // ค้นหาว่ามีชื่อ user นี้อยู่ในรายชื่อผู้เข้าร่วมของกิจกรรมนี้หรือไม่
    const participant = await prisma.eventParticipant.findFirst({
      where: { eventId, userId },
    });
    return participant !== null; // null = ไม่ได้รับมอบหมายให้เข้าร่วม
  }

  if (event.participantType === 'BRANCH') {
    // [READ] SELECT * FROM event_participants WHERE event_id = $1 AND branch_id = $2 LIMIT 1
    // ค้นหาว่าสาขาของ user อยู่ในรายชื่อสาขาที่เข้าร่วมได้หรือไม่
    const participant = await prisma.eventParticipant.findFirst({
      where: { eventId, branchId: user.branchId }, // branchId ของ user ที่ดึงมาจากขั้นตอนแรก
    });
    return participant !== null;
  }

  if (event.participantType === 'ROLE') {
    // [READ] SELECT * FROM event_participants WHERE event_id = $1 AND role = $2 LIMIT 1
    // ค้นหาว่า role ของ user อยู่ในรายชื่อ role ที่เข้าร่วมได้หรือไม่
    const participant = await prisma.eventParticipant.findFirst({
      where: { eventId, role: user.role }, // role ของ user ที่ดึงมาจากขั้นตอนแรก
    });
    return participant !== null;
  }

  return false; // participantType ไม่ตรงกับเกณฑ์ใดเลย → ไม่มีสิทธิ์
}

/**
 * ✅ Event Check-in — เข้าร่วมกิจกรรม
 *
 * Flow:
 * 1. ตรวจสอบว่ากิจกรรมมีอยู่, active, และอยู่ในช่วงเวลา
 * 2. ตรวจสอบว่า user เป็น eligible participant
 * 3. ตรวจสอบว่ายังไม่ได้ check-in กิจกรรมนี้
 * 4. ตรวจสอบ GPS ว่าอยู่ในรัศมี
 * 5. สร้าง Attendance record โดยใส่ eventId (ไม่ใช้ shiftId)
 */
async function eventCheckIn(data: EventCheckInDTO) {
  const { userId, eventId, photo, latitude, longitude, address } = data;

  // ── ① ตรวจสอบกิจกรรม ──────────────────────────────────────────────────────────────────
  // [READ] SELECT e.*, l.* FROM events e LEFT JOIN locations l ON e.location_id = l.location_id
  //        WHERE e.event_id = $1 LIMIT 1
  // include location มาด้วย เพราะไว้ใช้ตรวจ GPS รัศมีในขั้นตอนถัดไป
  const event = await prisma.event.findUnique({
    where: { eventId },
    include: { location: true },
  });

  if (!event) throw new Error('ไม่พบกิจกรรม');             // ไม่มี event_id นี้ใน DB
  if (event.deleteReason) throw new Error('กิจกรรมนี้ถูกลบแล้ว'); // ถูกลบไปแล้ว
  if (!event.isActive) throw new Error('กิจกรรมนี้ถูกปิดใช้งานแล้ว'); // ปิดโดย Admin

  const now = new Date();
  const allowedCheckInTime = new Date(event.startDateTime.getTime() - 30 * 60 * 1000);
  if (now < allowedCheckInTime) throw new Error('กิจกรรมยังไม่เริ่ม (สามารถเช็คอินล่วงหน้าได้ 30 นาที)'); // ยังไม่ถึงเวลาเริ่ม
  if (now > event.endDateTime) throw new Error('กิจกรรมสิ้นสุดแล้ว');   // เลยเวลาสิ้นสุดไปแล้ว

  // ── ② ตรวจสอบสิทธิ์การเข้าร่วม ──────────────────────────────────────────────────
  // เรียกฟังก์ชัน isEligibleParticipant (SELECT 3 queries) → return true/false
  const eligible = await isEligibleParticipant(userId, eventId);
  if (!eligible) throw new Error('คุณไม่ได้รับมอบหมายให้เข้าร่วมกิจกรรมนี้'); // ไม่แม้เป็น eligible participant

  // ── ③ ตรวจสอบ check-in ซ้ำ ─────────────────────────────────────────────────────
  // [READ] SELECT * FROM attendance WHERE user_id = $1 AND event_id = $2 LIMIT 1
  // ค้นหาว่า user นี้เคย check-in กิจกรรมนี้ไปแล้วหรือไม่
  const existingAttendance = await prisma.attendance.findFirst({
    where: { userId, eventId },
  });
  if (existingAttendance) throw new Error('คุณได้ check-in กิจกรรมนี้ไปแล้ว'); // ห้าม check-in ซ้ำ

  // ── ④ ตรวจสอบ GPS — อยู่ในรัศมีหรือไม่ ────────────────────────────────────
  // Security: บังคับ GPS ถ้ากิจกรรมกำหนดสถานที่ (mode A หรือ mode B)
  if ((event.location || (event.venueLatitude != null && event.venueLongitude != null)) &&
      (latitude == null || longitude == null)) {
    throw new Error('กรุณาเปิด GPS และส่งพิกัดเพื่อใช้ในการเช็คอิน/เช็คเอาท์');
  }

  let distance: number | null = null;
  let locationId: number | null = null;

  if (event.location && latitude != null && longitude != null) {
    // Mode A: ใช้ location จากตาราง locations (คำนวณระยะทางคน-ไป-สถานที่)
    distance = getDistance(
      { latitude, longitude },                                               // จุดที่ผู้ใช้ยืนอยู่
      { latitude: event.location.latitude, longitude: event.location.longitude }, // จุดศูนย์กลางสถานที่
    );
    if (distance > event.location.radius) { // เกินรัศมี (ม.) → หยุด
      throw new Error(
        `คุณอยู่นอกพื้นที่ (ห่าง ${distance.toFixed(0)} ม., อนุญาตสูงสุด ${event.location.radius} ม.)`
      );
    }
    locationId = event.location.locationId; // เก็บไว้เพื่อเชื่อม FK ในตาราง attendance
  } else if (event.venueLatitude != null && event.venueLongitude != null && latitude != null && longitude != null) {
    // Mode B: ใช้ custom venue coordinates (รัศมี default 500ม.)
    const venueRadius = 500;
    distance = getDistance(
      { latitude, longitude },
      { latitude: event.venueLatitude, longitude: event.venueLongitude },
    );
    if (distance > venueRadius) {
      throw new Error(
        `คุณอยู่นอกพื้นที่ (ห่าง ${distance.toFixed(0)} ม., อนุญาตสูงสุด ${venueRadius} ม.)`
      );
    }
  }

  // ── ⑤ สร้าง Attendance record ─────────────────────────────────────────────────────
  // [CREATE] INSERT INTO attendance (user_id, event_id, location_id, shift_id, check_in_photo,
  //          check_in_lat, check_in_lng, check_in_address, check_in_distance, status, late_minutes, note)
  //          VALUES (...) RETURNING *
  const attendance = await prisma.attendance.create({
    data: {
      userId,                             // FK → users.user_id
      eventId,                            // FK → events.event_id
      locationId,                         // FK → locations.location_id (null ถ้า Mode B)
      shiftId: null,                      // event check-in ไม่ใช้ shiftId → NULL
      checkInPhoto: photo ?? null,         // รูป selfie ตอน check-in (Base64)
      checkInLat: latitude ?? null,        // พิกัด latitude ตอน check-in
      checkInLng: longitude ?? null,       // พิกัด longitude ตอน check-in
      checkInAddress: address ?? null,     // ที่อยู่เป็นข้อความ
      checkInDistance: distance ?? null,   // ระยะห่างจากศูนย์กลาง (ม.)
      status: 'ON_TIME',                  // event check-in ถือว่า ON_TIME เสมอ (ไม่มี grace period)
      lateMinutes: 0,                     // ไม่มีการนับเวลาสายสำหรับกิจกรรม
      note: `เข้าร่วมกิจกรรม: ${event.eventName}`, // หมายเหตุบอกว่า check-in กิจกรรมอะไร
    },
    include: {
      user:     { select: { userId: true, firstName: true, lastName: true, employeeId: true } },
      event:    { select: { eventId: true, eventName: true } },
      location: true, // LEFT JOIN locations
    },
  });

  // ── ⑥ บันทึก Audit Log ───────────────────────────────────────────────────────
  // [CREATE] INSERT INTO audit_logs → เก็บประวัติการ check-in
  await createAuditLog({
    userId,
    action: AuditAction.EVENT_CHECK_IN, // ประเภท = check-in กิจกรรม
    targetTable: 'attendance',          // ตารางที่ถูกเปลี่ยนแปลง
    targetId: attendance.attendanceId,
    newValues: { eventId, eventName: event.eventName },
  });

  return attendance; // ส่ง attendance record กลับไปให้ controller
}

/**
 * 🚪 Event Check-out — ออกจากกิจกรรม
 */
async function eventCheckOut(data: EventCheckOutDTO) {
  const { userId, eventId, photo, latitude, longitude, address } = data;

  // ── ① ค้นหา check-in record ที่ยังไม่ได้ check-out ─────────────────────────────────────
  // [READ] SELECT a.*, l.*, e.* FROM attendance a
  //        LEFT JOIN locations l ON a.location_id = l.location_id
  //        LEFT JOIN events e ON a.event_id = e.event_id
  //        WHERE a.user_id = $1 AND a.event_id = $2 AND a.check_out IS NULL LIMIT 1
  // check_out IS NULL = ยัง check-in ค้างเดียว (ยังไม่ได้ออกจากกิจกรรม)
  const attendance = await prisma.attendance.findFirst({
    where: { userId, eventId, checkOut: null }, // เงื่อนไข: user + event + ยังไม่ออก
    include: { location: true, event: true }, // LEFT JOIN locations + events
  });

  if (!attendance) throw new Error('ไม่พบการ check-in กิจกรรมนี้ที่ยังไม่ได้ check-out'); // ไม่เคย check-in หรือ check-out ไปแล้ว

  // ── ② ตรวจสอบ GPS (ถ้ามี location) ────────────────────────────────────────────────
  // Security: บังคับ GPS ถ้ากิจกรรมกำหนดสถานที่ (mode A หรือ mode B)
  if ((attendance.location || (attendance.event && attendance.event.venueLatitude != null && attendance.event.venueLongitude != null)) &&
      (latitude == null || longitude == null)) {
    throw new Error('กรุณาเปิด GPS และส่งพิกัดเพื่อใช้ในการเช็คอิน/เช็คเอาท์');
  }

  let distance: number | null = null;
  if (attendance.location && latitude != null && longitude != null) {
    // คำนวณระยะทางจากตำแหน่งปัจจุบันไปยังศูนย์กลางสถานที่
    distance = getDistance(
      { latitude, longitude },
      { latitude: attendance.location.latitude, longitude: attendance.location.longitude },
    );
    if (distance > attendance.location.radius) { // เกินรัศมี → หยุด
      throw new Error(
        `คุณอยู่นอกพื้นที่ (ห่าง ${distance.toFixed(0)} ม., อนุญาตสูงสุด ${attendance.location.radius} ม.)`
      );
    }
  }

  // ── ③ UPDATE attendance — เพิ่มข้อมูล check-out ──────────────────────────────────
  // [UPDATE] UPDATE attendance SET check_out=NOW(), check_out_photo=$1, check_out_lat=$2,
  //          check_out_lng=$3, check_out_address=$4, check_out_distance=$5 WHERE attendance_id=$6 RETURNING *
  const updatedAttendance = await prisma.attendance.update({
    where: { attendanceId: attendance.attendanceId }, // WHERE attendance_id = $1 (Primary Key)
    data: {
      checkOut: new Date(),              // เวลา check-out = ตอนนี้
      checkOutPhoto: photo ?? null,      // รูป selfie ตอน check-out
      checkOutLat: latitude ?? null,     // พิกัด lat ตอน check-out
      checkOutLng: longitude ?? null,    // พิกัด lng ตอน check-out
      checkOutAddress: address ?? null,  // ที่อยู่ตอน check-out
      checkOutDistance: distance ?? null,// ระยะห่างจากศูนย์กลาง (ม.)
    },
    include: {
      user:     { select: { userId: true, firstName: true, lastName: true, employeeId: true } },
      event:    { select: { eventId: true, eventName: true } },
      location: true,
    },
  });

  // ── ④ บันทึก Audit Log ─────────────────────────────────────────────────────
  // [CREATE] INSERT INTO audit_logs → เก็บประวัติการ check-out
  await createAuditLog({
    userId,
    action: AuditAction.EVENT_CHECK_OUT, // ประเภท = check-out กิจกรรม
    targetTable: 'attendance',
    targetId: updatedAttendance.attendanceId,
    newValues: { eventId },
  });

  return updatedAttendance; // ส่ง attendance ที่อัพเดตแล้วกลับไปให้ controller
}

/**
 * 📋 ดึงสถานะการเข้าร่วมกิจกรรมของ user
 */
async function getMyEventAttendance(userId: number, eventId: number) {
  // [READ] SELECT a.*, l.* FROM attendance a
  //        LEFT JOIN locations l ON a.location_id = l.location_id
  //        WHERE a.user_id = $1 AND a.event_id = $2 LIMIT 1
  // ค้นหาว่า user นี้เคย check-in กิจกรรมนี้หรือไม่ (ส่ง null ถ้าไม่เจอ)
  const attendance = await prisma.attendance.findFirst({
    where: { userId, eventId },
    include: { location: true }, // LEFT JOIN locations
  });

  // ไม่เจอ = ยังไม่เคย check-in กิจกรรมนี้เลย
  if (!attendance) {
    return { checkedIn: false, checkedOut: false, attendance: null };
  }

  // เจอ = เคย check-in แล้ว | check_out IS NOT NULL = check-out ไปแล้วด้วย
  return {
    checkedIn: true,                                      // เคย check-in แล้ว
    checkedOut: attendance.checkOut !== null,              // null = ยัง check-in, มีค่า = check-out แล้ว
    attendance: {
      attendanceId:   attendance.attendanceId,
      checkIn:        attendance.checkIn,         // เวลา check-in
      checkOut:       attendance.checkOut,        // เวลา check-out (null = ยังไม่ออก)
      checkInPhoto:   attendance.checkInPhoto,    // รูป check-in
      checkOutPhoto:  attendance.checkOutPhoto,   // รูป check-out
      status:         attendance.status,          // ON_TIME เสมอสำหรับกิจกรรม
    },
  };
}

// ========================================================================================
// EXPORTS - แยก exports เป็น 2 กลุ่มตามหน้าที่
// ========================================================================================

/**
 * User Actions - ใช้โดยผู้ใช้ทั่วไป
 */
export const EventUserActions = {
  getMyEvents,
  getAllEvents,
  getEventById,
  eventCheckIn,
  eventCheckOut,
  getMyEventAttendance,
};

/**
 * Admin Actions - ใช้โดยผู้จัดการ/แอดมิน
 */
export const EventAdminActions = {
  createEvent,
  updateEvent,
  deleteEvent,
  getEventStatistics,
};
