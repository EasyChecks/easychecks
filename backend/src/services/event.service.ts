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
 * สร้างกิจกรรมใหม่
 */
async function createEvent(data: CreateEventDTO): Promise<Event> {
  // ตรวจสอบว่า location มีอยู่จริง
  const location = await prisma.location.findUnique({
    where: { locationId: data.locationId },
  });

  if (!location) {
    throw new Error('ไม่พบสถานที่');
  }

  if (location.deletedAt) {
    throw new Error('ไม่สามารถสร้างกิจกรรมในสถานที่ที่ถูกลบแล้ว');
  }

  // Validate วันที่
  const startDateTime = new Date(data.startDateTime);
  const endDateTime = new Date(data.endDateTime);

  if (startDateTime >= endDateTime) {
    throw new Error('วันเวลาเริ่มต้องน้อยกว่าวันเวลาสิ้นสุด');
  }

  // สร้าง event
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

  // เพิ่มผู้เข้าร่วมตาม participantType
  if (data.participantType !== 'ALL' && data.participants) {
    await addEventParticipants(event.eventId, data.participantType, data.participants);
  }

  return event;
}

/**
 * เพิ่มผู้เข้าร่วมกิจกรรม
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
    // ตรวจสอบว่า users มีอยู่จริง
    const users = await prisma.user.findMany({
      where: { userId: { in: participants.userIds } },
    });

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
    // ตรวจสอบว่า branches มีอยู่จริง
    const branches = await prisma.branch.findMany({
      where: { branchId: { in: participants.branchIds } },
    });

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

  if (participantsToCreate.length > 0) {
    await prisma.eventParticipant.createMany({
      data: participantsToCreate,
    });
  }
}

/**
 * ดึงรายการกิจกรรมทั้งหมด
 */
async function getAllEvents(params: SearchEventParams): Promise<{
  data: Event[];
  total: number;
  active: number;
  inactive: number;
}> {
  const where: any = {
    deletedAt: null, // ไม่แสดงที่ถูกลบ
  };

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
            participants: true,
            attendances: true,
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
 * ดึงกิจกรรมที่ผู้ใช้เข้าร่วม (สำหรับ User ทั่วไป)
 */
async function getMyEvents(userId: number): Promise<Event[]> {
  const user = await prisma.user.findUnique({
    where: { userId },
    select: { branchId: true, role: true },
  });

  if (!user) {
    throw new Error('ไม่พบผู้ใช้');
  }

  const now = new Date();

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
 * สถิติกิจกรรม
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
