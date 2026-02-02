import type { Request, Response } from 'express';
import { EventUserActions, EventAdminActions } from '../services/event.service.js';
import { sendSuccess, sendError } from '../utils/response.js';

/**
 * Event Controller - จัดการ API กิจกรรม/อีเวนต์
 */

/**
 * POST /api/events
 * สร้างกิจกรรมใหม่ (Admin/SuperAdmin only)
 */
export const createEvent = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return sendError(res, 'ไม่พบข้อมูลผู้ใช้', 401);
    }

    const {
      eventName,
      description,
      locationId,
      startDateTime,
      endDateTime,
      participantType,
      participants,
    } = req.body;

    if (
      !eventName ||
      !locationId ||
      !startDateTime ||
      !endDateTime ||
      !participantType
    ) {
      return sendError(
        res,
        'กรุณาระบุ eventName, locationId, startDateTime, endDateTime, participantType',
        400
      );
    }

    const validParticipantTypes = ['ALL', 'INDIVIDUAL', 'BRANCH', 'ROLE'];
    if (!validParticipantTypes.includes(participantType)) {
      return sendError(
        res,
        `participantType ต้องเป็น ${validParticipantTypes.join(', ')}`,
        400
      );
    }

    const event = await EventAdminActions.createEvent({
      userId,
      eventName,
      description,
      locationId: parseInt(locationId),
      startDateTime: new Date(startDateTime),
      endDateTime: new Date(endDateTime),
      participantType,
      participants,
    });

    sendSuccess(res, event, 'สร้างกิจกรรมเรียบร้อยแล้ว', 201);
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการสร้างกิจกรรม');
  }
};

/**
 * GET /api/events
 * ดึงรายการกิจกรรมทั้งหมด
 */
export const getAllEvents = async (req: Request, res: Response) => {
  try {
    const search = req.query.search as string | undefined;
    const participantType = req.query.participantType as any;
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
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการดึงรายการกิจกรรม');
  }
};

/**
 * GET /api/events/my
 * ดึงกิจกรรมที่ผู้ใช้เข้าร่วม
 */
export const getMyEvents = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return sendError(res, 'ไม่พบข้อมูลผู้ใช้', 401);
    }

    const events = await EventUserActions.getMyEvents(userId);

    sendSuccess(res, events, 'ดึงกิจกรรมที่เข้าร่วมสำเร็จ');
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการดึงกิจกรรม');
  }
};

/**
 * GET /api/events/statistics
 * ดึงสถิติกิจกรรม (Admin only)
 */
export const getEventStatistics = async (req: Request, res: Response) => {
  try {
    const statistics = await EventAdminActions.getEventStatistics();

    sendSuccess(res, statistics, 'ดึงสถิติกิจกรรมสำเร็จ');
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการดึงสถิติ');
  }
};

/**
 * GET /api/events/:id
 * ดึงกิจกรรมด้วย ID
 */
export const getEventById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const eventId = parseInt(id);

    if (!eventId) {
      return sendError(res, 'ID กิจกรรมไม่ถูกต้อง', 400);
    }

    const event = await EventUserActions.getEventById(eventId);

    if (!event) {
      return sendError(res, 'ไม่พบกิจกรรม', 404);
    }

    sendSuccess(res, event);
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการดึงกิจกรรม');
  }
};

/**
 * PATCH /api/events/:id
 * แก้ไขกิจกรรม (Admin only)
 */
export const updateEvent = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    const eventId = parseInt(id);

    if (!userId) {
      return sendError(res, 'ไม่พบข้อมูลผู้ใช้', 401);
    }

    if (!eventId) {
      return sendError(res, 'ID กิจกรรมไม่ถูกต้อง', 400);
    }

    const event = await EventUserActions.getEventById(eventId);

    if (!event) {
      return sendError(res, 'ไม่พบกิจกรรม', 404);
    }

    const {
      eventName,
      description,
      startDateTime,
      endDateTime,
      participantType,
      isActive,
      participants,
    } = req.body;

    const updatedEvent = await EventAdminActions.updateEvent(eventId, {
      eventName,
      description,
      startDateTime: startDateTime ? new Date(startDateTime) : undefined,
      endDateTime: endDateTime ? new Date(endDateTime) : undefined,
      participantType,
      isActive,
      updatedByUserId: userId,
      participants,
    });

    sendSuccess(res, updatedEvent, 'แก้ไขกิจกรรมเรียบร้อยแล้ว');
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการแก้ไขกิจกรรม');
  }
};

/**
 * DELETE /api/events/:id
 * ลบกิจกรรม (Admin only - Soft Delete)
 */
export const deleteEvent = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    const eventId = parseInt(id);
    const { deleteReason } = req.body;

    if (!userId) {
      return sendError(res, 'ไม่พบข้อมูลผู้ใช้', 401);
    }

    if (!eventId) {
      return sendError(res, 'ID กิจกรรมไม่ถูกต้อง', 400);
    }

    const event = await EventUserActions.getEventById(eventId);

    if (!event) {
      return sendError(res, 'ไม่พบกิจกรรม', 404);
    }

    const deletedEvent = await EventAdminActions.deleteEvent(eventId, {
      deletedByUserId: userId,
      deleteReason,
    });

    sendSuccess(res, deletedEvent, 'ลบกิจกรรมเรียบร้อยแล้ว');
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการลบกิจกรรม');
  }
};

/**
 * POST /api/events/:id/restore
 * กู้คืนกิจกรรมที่ถูกลบ (Admin only)
 */
export const restoreEvent = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const eventId = parseInt(id);

    if (!eventId) {
      return sendError(res, 'ID กิจกรรมไม่ถูกต้อง', 400);
    }

    const event = await EventUserActions.getEventById(eventId);

    if (!event) {
      return sendError(res, 'ไม่พบกิจกรรม', 404);
    }

    const restoredEvent = await EventAdminActions.restoreEvent(eventId);

    sendSuccess(res, restoredEvent, 'กู้คืนกิจกรรมเรียบร้อยแล้ว');
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการกู้คืนกิจกรรม');
  }
};
