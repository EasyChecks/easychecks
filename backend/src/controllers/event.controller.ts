import type { Request, Response } from 'express';
import { EventUserActions, EventAdminActions } from '../services/event.service.js';
import type { EventParticipantType } from '@prisma/client';
import { sendSuccess } from '../utils/response.js';
import { asyncHandler } from '../utils/async-handler.js';
import { UnauthorizedError, BadRequestError, NotFoundError } from '../utils/custom-errors.js';

/**
 * Event Controller - จัดการ API กิจกรรม/อีเวนต์
 */

/**
 * POST /api/events - สร้างกิจกรรมใหม่
 * 
 * สิทธิ์: Admin/SuperAdmin เท่านั้น
 * 
 * เหตุผลการตรวจสอบ:
 *    - userId: ตรวจสอบจาก JWT token เพื่อระบุว่าใครเป็นผู้สร้างกิจกรรม
 *    - participantType: ตรวจสอบความถูกต้องของประเภทเพื่อกำหนดโครงสร้าง EventParticipant
 *    - ฟิลด์ที่จำเป็น: เพื่อป้องกัน missing data ก่อนบันทึกลง DB
 */
export const createEvent = asyncHandler(async (req: Request, res: Response) => {
  // ดึง userId จาก JWT token ที่ middleware แนบมาใน req.user
  // จำเป็นเพราะได้ผ่าน middleware authentication แล้ว
  const userId = req.user?.userId;

  if (!userId) {
    throw new UnauthorizedError('ไม่พบข้อมูลผู้ใช้');
  }

  const {
    eventName,
    description,
    locationId,
    venueName,
    venueLatitude,
    venueLongitude,
    startDateTime,
    endDateTime,
    participantType,
    participants,
  } = req.body;

  // ต้องการ locationId (Mode A) หรือ venueName + พิกัด (Mode B) อย่างใดอย่างหนึ่ง
  const hasCheckinVenue = !!locationId;
  const hasCustomVenue = !!venueName && venueLatitude != null && venueLongitude != null;

  if (
    !eventName ||
    (!hasCheckinVenue && !hasCustomVenue) ||
    !startDateTime ||
    !endDateTime ||
    !participantType
  ) {
    throw new BadRequestError(
      'กรุณาระบุ eventName, startDateTime, endDateTime, participantType และ locationId (หรือ venueName + venueLatitude + venueLongitude)'
    );
  }

  const validParticipantTypes = ['ALL', 'INDIVIDUAL', 'BRANCH', 'ROLE'];
  if (!validParticipantTypes.includes(participantType)) {
    throw new BadRequestError(
      `participantType ต้องเป็น ${validParticipantTypes.join(', ')}`
    );
  }

  const event = await EventAdminActions.createEvent({
    userId,
    eventName,
    description,
    locationId: locationId ? parseInt(locationId) : undefined,
    venueName,
    venueLatitude: venueLatitude != null ? parseFloat(venueLatitude) : undefined,
    venueLongitude: venueLongitude != null ? parseFloat(venueLongitude) : undefined,
    startDateTime: new Date(startDateTime),
    endDateTime: new Date(endDateTime),
    participantType,
    participants,
  });

  sendSuccess(res, event, 'สร้างกิจกรรมเรียบร้อยแล้ว', 201);
});

/**
 * GET /api/events
 * ดึงรายการกิจกรรมทั้งหมด
 */
export const getAllEvents = asyncHandler(async (req: Request, res: Response) => {
  const search = req.query.search as string | undefined;
  const participantType = req.query.participantType as EventParticipantType | undefined;
  const isActive =
    req.query.isActive !== undefined
      ? req.query.isActive === 'true'
      : undefined;
  const startDate = req.query.startDate
    ? new Date(req.query.startDate as string)
    : undefined;
  const endDate = req.query.endDate
    ? new Date(req.query.endDate as string)
    : undefined;
  const skip = req.query.skip ? parseInt(req.query.skip as string) : 0;
  const take = req.query.take ? parseInt(req.query.take as string) : 20;

  const result = await EventUserActions.getAllEvents({
    search,
    participantType,
    isActive,
    startDate,
    endDate,
    skip,
    take,
  });

  sendSuccess(res, result, 'ดึงรายการกิจกรรมสำเร็จ');
});

/**
 * GET /api/events/my
 * ดึงกิจกรรมที่ผู้ใช้เข้าร่วม
 */
export const getMyEvents = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    throw new UnauthorizedError('ไม่พบข้อมูลผู้ใช้');
  }

  const events = await EventUserActions.getMyEvents(userId);

  sendSuccess(res, events, 'ดึงกิจกรรมที่เข้าร่วมสำเร็จ');
});

/**
 * GET /api/events/statistics
 * ดึงสถิติกิจกรรม (Admin only)
 */
export const getEventStatistics = asyncHandler(async (req: Request, res: Response) => {
  const statistics = await EventAdminActions.getEventStatistics();

  sendSuccess(res, statistics, 'ดึงสถิติกิจกรรมสำเร็จ');
});

/**
 * GET /api/events/:id
 * ดึงกิจกรรมด้วย ID
 */
export const getEventById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const eventId = parseInt(Array.isArray(id) ? id[0] : id);

  if (!eventId) {
    throw new BadRequestError('ID กิจกรรมไม่ถูกต้อง');
  }

  const event = await EventUserActions.getEventById(eventId);

  if (!event) {
    throw new NotFoundError('ไม่พบกิจกรรม');
  }

  sendSuccess(res, event);
});

/**
 * PATCH /api/events/:id
 * แก้ไขกิจกรรม (Admin only)
 */
export const updateEvent = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const { id } = req.params;
  const eventId = parseInt(Array.isArray(id) ? id[0] : id);

  if (!userId) {
    throw new UnauthorizedError('ไม่พบข้อมูลผู้ใช้');
  }

  if (!eventId) {
    throw new BadRequestError('ID กิจกรรมไม่ถูกต้อง');
  }

  const event = await EventUserActions.getEventById(eventId);

  if (!event) {
    throw new NotFoundError('ไม่พบกิจกรรม');
  }

  const {
    eventName,
    description,
    locationId,
    venueName,
    venueLatitude,
    venueLongitude,
    startDateTime,
    endDateTime,
    participantType,
    isActive,
    participants,
  } = req.body;

  const updatedEvent = await EventAdminActions.updateEvent(eventId, {
    eventName,
    description,
    locationId: locationId !== undefined ? (locationId === null ? null : parseInt(locationId)) : undefined,
    venueName,
    venueLatitude: venueLatitude != null ? parseFloat(venueLatitude) : venueLatitude,
    venueLongitude: venueLongitude != null ? parseFloat(venueLongitude) : venueLongitude,
    startDateTime: startDateTime ? new Date(startDateTime) : undefined,
    endDateTime: endDateTime ? new Date(endDateTime) : undefined,
    participantType,
    isActive,
    updatedByUserId: userId,
    participants,
  });

  sendSuccess(res, updatedEvent, 'แก้ไขกิจกรรมเรียบร้อยแล้ว');
});

/**
 * DELETE /api/events/:id
 * ลบกิจกรรม (Admin only - Soft Delete)
 */
export const deleteEvent = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const { id } = req.params;
  const eventId = parseInt(Array.isArray(id) ? id[0] : id);
  const { deleteReason } = req.body;

  if (!userId) {
    throw new UnauthorizedError('ไม่พบข้อมูลผู้ใช้');
  }

  if (!eventId) {
    throw new BadRequestError('ID กิจกรรมไม่ถูกต้อง');
  }

  const event = await EventUserActions.getEventById(eventId);

  if (!event) {
    throw new NotFoundError('ไม่พบกิจกรรม');
  }

  const deletedEvent = await EventAdminActions.deleteEvent(eventId, {
    deletedByUserId: userId,
    deleteReason,
  });

  sendSuccess(res, deletedEvent, 'ลบกิจกรรมเรียบร้อยแล้ว');
});

/**
 * POST /api/events/:id/restore
 * กู้คืนกิจกรรมที่ถูกลบ (Admin only)
 */
export const restoreEvent = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const { id } = req.params;
  const eventId = parseInt(Array.isArray(id) ? id[0] : id);

  if (!eventId) {
    throw new BadRequestError('ID กิจกรรมไม่ถูกต้อง');
  }

  const event = await EventUserActions.getEventById(eventId);

  if (!event) {
    throw new NotFoundError('ไม่พบกิจกรรม');
  }

  const restoredEvent = await EventAdminActions.restoreEvent(eventId, userId);

  sendSuccess(res, restoredEvent, 'กู้คืนกิจกรรมเรียบร้อยแล้ว');
});
