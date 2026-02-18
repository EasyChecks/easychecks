import { prisma } from '../lib/prisma.js';
import type { Event, EventParticipantType, Role } from '@prisma/client';

/**
 * Event Service - จัดการกิจกรรม/อีเวนต์
 */

export interface CreateEventDTO {
  userId: number; // ผู้สร้าง (Admin/SuperAdmin)
  eventName: string;
  description?: string;
  locationId: number;
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
  // 🔍 ตรวจสอบว่าสถานที่มีอยู่จริงและยังไม่ถูกลบ
  // เพราะต้องการป้องกันการสร้างกิจกรรมในสถานที่ที่ไม่มีหรือถูกลบแล้ว
  // SQL: SELECT * FROM Location WHERE locationId = ? AND deletedAt IS NULL
  const location = await prisma.location.findUnique({
    where: { locationId: data.locationId },
  });

  if (!location) {
    throw new Error('ไม่พบสถานที่');
  }

  // 🚫 ตรวจสอบว่าสถานที่ยังใช้งานได้อยู่ (ไม่ถูก soft delete)
  // เพราะถ้าสถานที่ถูกลบแล้ว จะทำให้กิจกรรมไม่สามารถใช้งานได้
  if (location.deletedAt) {
    throw new Error('ไม่สามารถสร้างกิจกรรมในสถานที่ที่ถูกลบแล้ว');
  }

  // ⏰ ตรวจสอบความถูกต้องของวันเวลา
  // เพื่อป้องกันการสร้างกิจกรรมที่มีช่วงเวลาไม่สมเหตุสมผล
  const startDateTime = new Date(data.startDateTime);
  const endDateTime = new Date(data.endDateTime);

  if (startDateTime >= endDateTime) {
    throw new Error('วันเวลาเริ่มต้องน้อยกว่าวันเวลาสิ้นสุด');
  }

  // 📝 สร้างกิจกรรมพร้อม JOIN กับ location และ creator
  // include location และ creator เพื่อให้ client ไม่ต้อง query แยกอีกครั้ง (ลด round trip)
  // SQL: 
  // INSERT INTO Event (eventName, description, locationId, startDateTime, endDateTime, participantType, createdByUserId)
  // VALUES (?, ?, ?, ?, ?, ?, ?)
  // RETURNING * 
  // JOIN Location ON Event.locationId = Location.locationId
  // JOIN User creator ON Event.createdByUserId = creator.userId
  const event = await prisma.event.create({
    data: {
      eventName: data.eventName,
      description: data.description,
      locationId: data.locationId,
      startDateTime,
      endDateTime,
      participantType: data.participantType,
      createdByUserId: data.userId,
    },
    include: {
      location: true,
      creator: {
        select: {
          userId: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  // 👥 เพิ่มรายชื่อผู้เข้าร่วมหลังจากสร้างกิจกรรมแล้ว
  // แยกออกมาเพราะต้องใช้ eventId ที่ได้จากการสร้างกิจกรรม
  // และการเพิ่มผู้เข้าร่วมมีโลจิกที่ซับซ้อนขึ้นอยู่กับ participantType
  if (data.participantType !== 'ALL' && data.participants) {
    await addEventParticipants(event.eventId, data.participantType, data.participants);
  }

  return event;
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
  const participantsToCreate: any[] = [];

  if (participantType === 'INDIVIDUAL' && participants.userIds) {
    // 🔍 ตรวจสอบว่า users ทั้งหมดมีอยู่จริงในระบบเพื่อป้องกัน invalid data
    // SQL: SELECT * FROM User WHERE userId IN (?, ?, ...)
    const users = await prisma.user.findMany({
      where: { userId: { in: participants.userIds } },
    });

    // ⚠️ ต้องตรวจว่าจำนวน user ที่หามาตรงกับที่ส่งมาหรือไม่
    // เพราะถ้าไม่ตรงแปลว่ามี userId บางตัวไม่มีในระบบ
    if (users.length !== participants.userIds.length) {
      throw new Error('พบผู้ใช้บางคนไม่อยู่ในระบบ');
    }

    participantsToCreate.push(
      ...participants.userIds.map((userId) => ({
        eventId,
        userId,
      }))
    );
  }

  if (participantType === 'BRANCH' && participants.branchIds) {
    // 🔍 ตรวจสอบว่า branches ทั้งหมดมีอยู่จริงในระบบ
    // SQL: SELECT * FROM Branch WHERE branchId IN (?, ?, ...)
    const branches = await prisma.branch.findMany({
      where: { branchId: { in: participants.branchIds } },
    });

    // ⚠️ ต้องตรวจว่าจำนวน branch ที่หามาตรงกับที่ส่งมาหรือไม่
    if (branches.length !== participants.branchIds.length) {
      throw new Error('พบสาขาบางแห่งไม่อยู่ในระบบ');
    }

    participantsToCreate.push(
      ...participants.branchIds.map((branchId) => ({
        eventId,
        branchId,
      }))
    );
  }

  if (participantType === 'ROLE' && participants.roles) {
    participantsToCreate.push(
      ...participants.roles.map((role) => ({
        eventId,
        role,
      }))
    );
  }

  // 📝 สร้างรายชื่อผู้เข้าร่วมทั้งหมดในครั้งเดียว (bulk insert)
  // ใช้ createMany เพื่อเพิ่มประสิทธิภาพแทนที่จะ loop create ทีละรายการ
  // SQL: INSERT INTO EventParticipant (eventId, userId/branchId/role) VALUES (?, ?), (?, ?), ...
  if (participantsToCreate.length > 0) {
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
  const where: any = {
    deletedAt: null, // 🚫 กรองเฉพาะที่ยังไม่ถูก soft delete (deletedAt IS NULL)
  };

  // 🔍 เพิ่มเงื่อนไขค้นหาแบบ OR เพื่อค้นหาจากหลายฟิลด์
  // ใช้ mode: 'insensitive' เพื่อให้ไม่สนใจตัวพิมพ์เล็ก-ใหญ่
  // SQL: WHERE (eventName ILIKE '%search%' OR description ILIKE '%search%')
  if (params.search) {
    where.OR = [
      { eventName: { contains: params.search, mode: 'insensitive' } },
      { description: { contains: params.search, mode: 'insensitive' } },
    ];
  }

  if (params.participantType) {
    where.participantType = params.participantType;
  }

  if (params.isActive !== undefined) {
    where.isActive = params.isActive;
  }

  if (params.startDate || params.endDate) {
    where.AND = [];
    if (params.startDate) {
      where.AND.push({ startDateTime: { gte: params.startDate } });
    }
    if (params.endDate) {
      where.AND.push({ endDateTime: { lte: params.endDate } });
    }
  }

  // ⚡ ใช้ Promise.all เพื่อ query ข้อมูลและนับสถิติแบบ parallel
  // ทำพร้อมกันเพื่อลดเวลารอ (ถ้าทำทีละอันจะช้ากว่า)
  // SQL: ทำ 4 queries พร้อมกัน:
  //   1. SELECT * FROM Event ... (main query with pagination and joins)
  //   2. SELECT COUNT(*) FROM Event ... (total count)
  //   3. SELECT COUNT(*) FROM Event WHERE isActive = true (active count)
  //   4. SELECT COUNT(*) FROM Event WHERE isActive = false (inactive count)
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
          },
        },
        updatedBy: {
          select: {
            userId: true,
            firstName: true,
            lastName: true,
          },
        },
        _count: {
          select: {
            event_participants: true,
            attendance: true,
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
      updatedBy: {
        select: {
          userId: true,
          firstName: true,
          lastName: true,
        },
      },
      deletedBy: {
        select: {
          userId: true,
          firstName: true,
          lastName: true,
        },
      },
      participants: {
        include: {
          user: {
            select: {
              userId: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
          branch: {
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
          attendances: true,
        },
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
  const event = await prisma.event.findUnique({
    where: { eventId },
  });

  if (!event) {
    throw new Error('ไม่พบกิจกรรม');
  }

  if (event.deletedAt) {
    throw new Error('ไม่สามารถแก้ไขกิจกรรมที่ถูกลบแล้ว');
  }

  // Validate วันที่ ถ้ามีการเปลี่ยน
  if (data.startDateTime || data.endDateTime) {
    const startDateTime = data.startDateTime
      ? new Date(data.startDateTime)
      : event.startDateTime;
    const endDateTime = data.endDateTime
      ? new Date(data.endDateTime)
      : event.endDateTime;

    if (startDateTime >= endDateTime) {
      throw new Error('วันเวลาเริ่มต้องน้อยกว่าวันเวลาสิ้นสุด');
    }
  }

  // อัพเดตผู้เข้าร่วม ถ้ามีการเปลี่ยน participantType หรือ participants
  if (data.participantType || data.participants) {
    const newParticipantType = data.participantType || event.participantType;

    // ลบผู้เข้าร่วมเดิม
    await prisma.eventParticipant.deleteMany({
      where: { eventId },
    });

    // เพิ่มผู้เข้าร่วมใหม่
    if (newParticipantType !== 'ALL' && data.participants) {
      await addEventParticipants(eventId, newParticipantType, data.participants);
    }
  }

  return prisma.event.update({
    where: { eventId },
    data: {
      eventName: data.eventName,
      description: data.description,
      startDateTime: data.startDateTime,
      endDateTime: data.endDateTime,
      participantType: data.participantType,
      isActive: data.isActive,
      updatedByUserId: data.updatedByUserId,
      updatedAt: new Date(),
    },
    include: {
      location: true,
      creator: {
        select: {
          userId: true,
          firstName: true,
          lastName: true,
        },
      },
      updatedBy: {
        select: {
          userId: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });
}

/**
 * ลบกิจกรรม (Soft Delete)
 */
async function deleteEvent(
  eventId: number,
  data: DeleteEventDTO
): Promise<Event> {
  const event = await prisma.event.findUnique({
    where: { eventId },
  });

  if (!event) {
    throw new Error('ไม่พบกิจกรรม');
  }

  if (event.deletedAt) {
    throw new Error('กิจกรรมนี้ถูกลบไปแล้ว');
  }

  // ตรวจสอบว่ากิจกรรมเริ่มแล้วหรือยัง
  const now = new Date();
  if (event.startDateTime <= now && event.endDateTime >= now) {
    throw new Error('ไม่สามารถลบกิจกรรมที่กำลังดำเนินการอยู่');
  }

  return prisma.event.update({
    where: { eventId },
    data: {
      deletedAt: new Date(),
      deletedByUserId: data.deletedByUserId,
      deleteReason: data.deleteReason,
      isActive: false, // ปิดการใช้งานทันที
    },
    include: {
      location: true,
      creator: {
        select: {
          userId: true,
          firstName: true,
          lastName: true,
        },
      },
      deletedBy: {
        select: {
          userId: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });
}

/**
 * กู้คืนกิจกรรมที่ถูกลบ
 */
async function restoreEvent(eventId: number): Promise<Event> {
  const event = await prisma.event.findUnique({
    where: { eventId },
  });

  if (!event) {
    throw new Error('ไม่พบกิจกรรม');
  }

  if (!event.deletedAt) {
    throw new Error('กิจกรรมนี้ยังไม่ถูกลบ');
  }

  return prisma.event.update({
    where: { eventId },
    data: {
      deletedAt: null,
      deletedByUserId: null,
      deleteReason: null,
    },
    include: {
      location: true,
      creator: {
        select: {
          userId: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });
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
  // 🔎 ดึงข้อมูล branch และ role ของผู้ใช้ก่อนเพื่อสร้าง where condition
  // จำเป็นเพราะใช้ในการกรอง participantType BRANCH และ ROLE
  // SQL: SELECT branchId, role FROM User WHERE userId = ?
  const user = await prisma.user.findUnique({
    where: { userId },
    select: { branchId: true, role: true },
  });

  if (!user) {
    throw new Error('ไม่พบผู้ใช้');
  }

  const now = new Date();

  // 🔍 Query กิจกรรมที่ผู้ใช้เข้าร่วมได้ด้วย OR condition 4 แบบ:
  // 🎯 สาเหตุที่ต้องครอบคลุมทั้ง 4 รูปแบบ:
  //    1. participantType = ALL: ทุกคนเข้าร่วมได้
  //    2. participantType = INDIVIDUAL: ตรวจว่ามี userId ใน EventParticipant
  //    3. participantType = BRANCH: ตรวจว่ามี branchId ตรงกัน
  //    4. participantType = ROLE: ตรวจว่ามี role ตรงกัน
  // SQL: 
  // SELECT e.* FROM Event e
  // WHERE e.deletedAt IS NULL AND e.isActive = true AND e.endDateTime >= NOW()
  // AND (
  //   e.participantType = 'ALL'
  //   OR (e.participantType = 'INDIVIDUAL' AND EXISTS (SELECT 1 FROM EventParticipant WHERE eventId = e.eventId AND userId = ?))
  //   OR (e.participantType = 'BRANCH' AND EXISTS (SELECT 1 FROM EventParticipant WHERE eventId = e.eventId AND branchId = ?))
  //   OR (e.participantType = 'ROLE' AND EXISTS (SELECT 1 FROM EventParticipant WHERE eventId = e.eventId AND role = ?))
  // )
  const events = await prisma.event.findMany({
    where: {
      deletedAt: null,
      isActive: true,
      endDateTime: { gte: now }, // แสดงเฉพาะกิจกรรมที่ยังไม่จบ
      OR: [
        { participantType: 'ALL' }, // กิจกรรมสำหรับทุกคน
        {
          // กิจกรรมที่ระบุรายบุคคล
          participantType: 'INDIVIDUAL',
          participants: {
            some: { userId },
          },
        },
        {
          // กิจกรรมที่ระบุตามสาขา
          participantType: 'BRANCH',
          participants: {
            some: { branchId: user.branchId },
          },
        },
        {
          // กิจกรรมที่ระบุตามบทบาท
          participantType: 'ROLE',
          participants: {
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
          attendances: true,
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

  // ⚡ Query สถิติแบบ parallel เพื่อลดเวลาresponse
  // SQL: ทำ 7 queries พร้อมกัน:
  //   1. SELECT COUNT(*) FROM Event WHERE deletedAt IS NULL
  //   2. SELECT COUNT(*) FROM Event WHERE deletedAt IS NULL AND isActive = true
  //   3. SELECT COUNT(*) FROM Event WHERE ... AND startDateTime > NOW() (กิจกรรมที่ยังไม่เริ่ม)
  //   4. SELECT COUNT(*) FROM Event WHERE ... AND startDateTime <= NOW() AND endDateTime >= NOW() (กำลังดำเนินการ)
  //   5. SELECT COUNT(*) FROM Event WHERE ... AND endDateTime < NOW() (ผ่านไปแล้ว)
  //   6. SELECT COUNT(*) FROM Event WHERE deletedAt IS NOT NULL (ถูกลบ)
  //   7. SELECT participantType, COUNT(*) FROM Event WHERE deletedAt IS NULL GROUP BY participantType
  const [
    totalEvents,
    activeEvents,
    upcomingEvents,
    ongoingEvents,
    pastEvents,
    deletedEvents,
    byTypeRaw,
  ] = await Promise.all([
    prisma.event.count({ where: { deletedAt: null } }),
    prisma.event.count({ where: { deletedAt: null, isActive: true } }),
    prisma.event.count({
      where: { deletedAt: null, isActive: true, startDateTime: { gt: now } },
    }),
    prisma.event.count({
      where: {
        deletedAt: null,
        isActive: true,
        startDateTime: { lte: now },
        endDateTime: { gte: now },
      },
    }),
    prisma.event.count({
      where: { deletedAt: null, endDateTime: { lt: now } },
    }),
    prisma.event.count({ where: { deletedAt: { not: null } } }),
    prisma.event.groupBy({
      by: ['participantType'],
      where: { deletedAt: null },
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
// EXPORTS - แยก exports เป็น 2 กลุ่มตามหน้าที่
// ========================================================================================

/**
 * User Actions - ใช้โดยผู้ใช้ทั่วไป
 */
export const EventUserActions = {
  getMyEvents, // ดูกิจกรรมที่ตัวเองเข้าร่วมได้
  getAllEvents, // ดูรายการกิจกรรมทั้งหมด
  getEventById, // ดูรายละเอียดกิจกรรม
};

/**
 * Admin Actions - ใช้โดยผู้จัดการ/แอดมิน
 */
export const EventAdminActions = {
  createEvent,
  updateEvent,
  deleteEvent,
  restoreEvent,
  getEventStatistics,
};
