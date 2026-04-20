import type { Request, Response } from 'express';
import type { AttendanceStatus } from '@prisma/client';
import * as attendanceService from '../services/attendance.service.js';
import { broadcastAttendanceUpdate } from '../websocket/attendance.websocket.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { prisma } from '../lib/prisma.js';
import { getDistance } from 'geolib';

/** normalize query/params ให้เหลือ string เดียวเพื่อกัน parse เพี้ยนจาก array input */
function qs(v: unknown): string | undefined {
  if (typeof v === 'string') return v;
  if (Array.isArray(v) && typeof v[0] === 'string') return v[0] as string;
  return undefined;
}

/**
 * แปลง error message จาก service → HTTP status code ที่เหมาะสม
 *
 * ทำไมต้องมีฟังก์ชันนี้?
 * Service layer โยน Error เป็นภาษาไทยพร้อม message อธิบายปัญหา
 * แต่ไม่ได้ระบุ HTTP status → Controller ต้อง map เอง
 * ถ้าไม่ map จะกลายเป็น 500 ทุกกรณี ซึ่งทำให้ frontend แยกไม่ออก
 * ว่าเป็น "ข้อมูลไม่ถูกต้อง" หรือ "server พัง"
 */
function deriveHttpStatus(message: string): number {
  if (message.includes('ไปแล้ว')) return 409;
  if (message.includes('ไม่พบ')) return 404;
  if (message.includes('ไม่ใช่ของคุณ') || message.includes('ปิดใช้งาน') || message.includes('ใบลาอนุมัติ') || message.includes('เฉพาะ admin')) return 403;
  if (message.includes('นอกพื้นที่') || message.includes('GPS') || message.includes('พิกัด')) return 422;
  if (message.includes('กรุณา') || message.includes('ต้อง')) return 400;
  return 500;
}

/**
 * POST /api/attendance/check-gps
 * ตรวจสอบว่าพิกัด GPS ของพนักงานอยู่ในรัศมีกะงานหรือไม่
 *
 * อยู่ใน attendance controller เพราะ endpoint นี้ใช้ตัดสินใจก่อนลงเวลาโดยตรง.
 */
export const checkGps = async (req: Request, res: Response) => {
  try {
    const { latitude, longitude, locationId, shiftId } = req.body as {
      latitude?: number;
      longitude?: number;
      locationId?: number;
      shiftId?: number;
    };

    if (latitude === undefined || longitude === undefined) {
      return sendError(res, 'กรุณาระบุ latitude และ longitude', 400);
    }
    if (latitude === 0 && longitude === 0) {
      return sendError(res, 'พิกัด GPS ไม่ถูกต้อง (0,0)', 422);
    }

    // SQL เทียบเท่า:
    // SELECT * FROM "Location" WHERE "locationId"=$1 LIMIT 1;
    // SELECT l.* FROM "Shift" s LEFT JOIN "Location" l ON s."locationId"=l."locationId" WHERE s."shiftId"=$2 LIMIT 1;
    let location: { locationId: number; locationName: string; latitude: number; longitude: number; radius: number; address: string | null } | null = null;

    if (locationId !== undefined) {
      location = await prisma.location.findUnique({ where: { locationId: Number(locationId) } });
    } else if (shiftId !== undefined) {
      const shift = await prisma.shift.findUnique({
        where: { shiftId: Number(shiftId) },
        include: { location: true },
      });
      if (shift?.location) location = shift.location;
    }

    if (!location) {
      return sendSuccess(res, {
        withinRadius: true,
        distance: null,
        location: null,
        radius: null,
        message: 'ไม่มีสถานที่ที่กำหนด — อนุญาตให้เช็คอินได้ทุกที่',
      }, 'ตรวจสอบพิกัดสำเร็จ');
    }

    const distance = getDistance(
      { latitude, longitude },
      { latitude: location.latitude, longitude: location.longitude },
    );
    const withinRadius = distance <= location.radius;

    sendSuccess(res, {
      withinRadius,
      distance,
      radius: location.radius,
      location: {
        locationId: location.locationId,
        locationName: location.locationName,
        latitude: location.latitude,
        longitude: location.longitude,
        address: location.address,
      },
      message: withinRadius
        ? `คุณอยู่ในพื้นที่อนุญาต (ห่าง ${distance} ม.)`
        : `คุณอยู่นอกพื้นที่ (ห่าง ${distance} ม., อนุญาตสูงสุด ${location.radius} ม.)`,
    }, 'ตรวจสอบพิกัดสำเร็จ');
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการตรวจสอบพิกัด';
    sendError(res, msg, deriveHttpStatus(msg));
  }
};

/** check-in endpoint: controller รับผิดชอบ auth/boundary แล้วส่งต่อ service */
export const checkIn = async (req: Request, res: Response) => {
  try {
    // อ่าน userId จาก token เท่านั้นเพื่อตัดช่อง spoof identity จาก request body
    const userId = req.user?.userId;

    if (userId === undefined) return sendError(res, 'ไม่พบข้อมูลผู้ใช้ กรุณา login ใหม่', 401);

    const { shiftId, locationId, eventId, photo, latitude, longitude, address } = req.body as {
      shiftId?: number;
      locationId?: number;
      eventId?: number;
      photo?: string;
      latitude?: number;
      longitude?: number;
      address?: string;
    };

    const attendance = await attendanceService.checkIn({
      userId,
      shiftId: shiftId !== undefined ? Number(shiftId) : undefined,
      locationId: locationId !== undefined ? Number(locationId) : undefined,
      eventId: eventId !== undefined ? Number(eventId) : undefined,
      photo,
      latitude: latitude !== undefined ? Number(latitude) : undefined,
      longitude: longitude !== undefined ? Number(longitude) : undefined,
      address,
    });

    // broadcast แค่หลัง write สำเร็จเพื่อกัน state กระโดดใน dashboard
    broadcastAttendanceUpdate('CHECK_IN', attendance);

    sendSuccess(res, attendance, 'เข้างานเรียบร้อยแล้ว', 201);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการเข้างาน';
    sendError(res, msg, deriveHttpStatus(msg));
  }
};

/** check-out endpoint: ส่ง boundary data ให้ service ตัดสินกฎเวลาและ geofence */
export const checkOut = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    if (userId === undefined) return sendError(res, 'ไม่พบข้อมูลผู้ใช้ กรุณา login ใหม่', 401);

    const { attendanceId, shiftId, photo, latitude, longitude, address } = req.body as {
      attendanceId?: number;
      shiftId?: number;
      photo?: string;
      latitude?: number;
      longitude?: number;
      address?: string;
    };

    const attendance = await attendanceService.checkOut({
      userId,
      attendanceId: attendanceId !== undefined ? Number(attendanceId) : undefined,
      shiftId: shiftId !== undefined ? Number(shiftId) : undefined,
      photo,
      latitude: latitude !== undefined ? Number(latitude) : undefined,
      longitude: longitude !== undefined ? Number(longitude) : undefined,
      address,
    });

    broadcastAttendanceUpdate('CHECK_OUT', attendance);

    sendSuccess(res, attendance, 'ออกงานเรียบร้อยแล้ว');
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการออกงาน';
    sendError(res, msg, deriveHttpStatus(msg));
  }
};

/**
 * 📋 ดึงประวัติการเข้างานของ user คนเดียว
 * GET /api/attendance/history/:userId
 *
 * รับ userId จาก params เพื่อรองรับ admin ดูข้อมูลพนักงานรายคน.
 */
export const getHistory = async (req: Request, res: Response) => {
  try {
    const userId = parseInt(qs(req.params['userId']) ?? '');
    if (isNaN(userId)) return sendError(res, 'กรุณาระบุ userId ที่ถูกต้อง', 400);

    const startDate = qs(req.query['startDate']);
    const endDate = qs(req.query['endDate']);
    const status = qs(req.query['status']) as AttendanceStatus | undefined;

    type HistoryFilters = Parameters<typeof attendanceService.getAttendanceHistory>[1];
    const filters: HistoryFilters = {};
    if (startDate !== undefined) filters.startDate = new Date(startDate);
    if (endDate !== undefined) filters.endDate = new Date(endDate);
    if (status !== undefined) filters.status = status;

    const attendances = await attendanceService.getAttendanceHistory(userId, filters);
    sendSuccess(res, attendances);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการดึงประวัติการเข้างาน';
    sendError(res, msg, deriveHttpStatus(msg));
  }
};

/**
 * 📋 ดึงประวัติการเข้างานทั้งหมด (Admin only)
 * GET /api/attendance
 */
export const getAllAttendances = async (req: Request, res: Response) => {
  try {
    const userId = qs(req.query['userId']);
    const startDate = qs(req.query['startDate']);
    const endDate = qs(req.query['endDate']);
    const status = qs(req.query['status']) as AttendanceStatus | undefined;

    type AllFilters = Parameters<typeof attendanceService.getAllAttendances>[0];
    const filters: AllFilters = {};
    if (userId !== undefined) filters.userId = parseInt(userId);
    if (startDate !== undefined) filters.startDate = new Date(startDate);
    if (endDate !== undefined) filters.endDate = new Date(endDate);
    if (status !== undefined) filters.status = status;

    const attendances = await attendanceService.getAllAttendances(filters);
    sendSuccess(res, attendances);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการดึงข้อมูลการเข้างาน';
    sendError(res, msg, deriveHttpStatus(msg));
  }
};

/**
 * 📋 ดึงข้อมูลการเข้างานวันนี้ของ user
 * GET /api/attendance/today/:userId
 */
export const getTodayAttendance = async (req: Request, res: Response) => {
  try {
    const userId = parseInt(qs(req.params['userId']) ?? '');
    if (isNaN(userId)) return sendError(res, 'กรุณาระบุ userId ที่ถูกต้อง', 400);

    const attendance = await attendanceService.getTodayAttendance(userId);
    sendSuccess(res, attendance);
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการดึงข้อมูลการเข้างานวันนี้';
    sendError(res, msg, deriveHttpStatus(msg));
  }
};

/**
 * 🔄 อัปเดตการเข้างาน (Admin only)
 * PUT /api/attendance/:id
 *
 * Body: { status?, note?, checkIn?, checkOut? }
 */
export const updateAttendance = async (req: Request, res: Response) => {
  try {
    const attendanceId = parseInt(qs(req.params['id']) ?? '');
    if (isNaN(attendanceId)) return sendError(res, 'กรุณาระบุ attendanceId ที่ถูกต้อง', 400);

    // ห้ามรับ updatedBy จาก body เพื่อตัดการปลอมผู้แก้ไข
    const updatedByUserId = req.user?.userId;
    const updaterRole = req.user?.role;

    const { status, note, checkIn, checkOut } = req.body as {
      status?: string;
      note?: string;
      checkIn?: string;
      checkOut?: string;
      editReason?: string;
    };

    const editReason = (req.body as { editReason?: string }).editReason;

    if (note !== undefined && updaterRole !== 'ADMIN' && updaterRole !== 'SUPERADMIN') {
      return sendError(res, 'สามารถแก้ note ได้เฉพาะ admin/superadmin เท่านั้น', 403);
    }

    if ((checkIn !== undefined || checkOut !== undefined) && (!editReason || editReason.trim().length === 0)) {
      return sendError(res, 'การแก้เวลาเข้างาน/ออกงานต้องระบุเหตุผล (editReason)', 400);
    }

    type UpdateData = Parameters<typeof attendanceService.updateAttendance>[1];
    const data: UpdateData = {};
    if (status !== undefined) data.status = status as UpdateData['status'];
    if (note !== undefined) data.note = note;
    if (checkIn !== undefined) data.checkIn = new Date(checkIn);
    if (checkOut !== undefined) data.checkOut = new Date(checkOut);
    if (editReason !== undefined) data.editReason = editReason;

    const updatedAtt = await attendanceService.updateAttendance(attendanceId, data, updatedByUserId);

    broadcastAttendanceUpdate('UPDATE', updatedAtt);
    sendSuccess(res, updatedAtt, 'อัปเดตการเข้างานเรียบร้อยแล้ว');
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการอัปเดตการเข้างาน';
    sendError(res, msg, deriveHttpStatus(msg));
  }
};

/**
 * 🗑️ ลบการเข้างาน (Admin only — Soft Delete)
 * DELETE /api/attendance/:id
 *
 * Body: { deleteReason: string }
 */
export const deleteAttendance = async (req: Request, res: Response) => {
  try {
    const attendanceId = parseInt(qs(req.params['id']) ?? '');
    if (isNaN(attendanceId)) return sendError(res, 'กรุณาระบุ attendanceId ที่ถูกต้อง', 400);

    const deletedByUserId = req.user?.userId;
    const { deleteReason } = req.body as { deleteReason?: string };

    if (!deleteReason || deleteReason.trim() === '') {
      return sendError(res, 'กรุณาระบุเหตุผลในการลบ (deleteReason)', 400);
    }

    await attendanceService.deleteAttendance(attendanceId, deletedByUserId, deleteReason);

    broadcastAttendanceUpdate('DELETE', { attendanceId });
    sendSuccess(res, null, 'ลบการเข้างานเรียบร้อยแล้ว (Soft Delete)');
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : 'เกิดข้อผิดพลาดในการลบการเข้างาน';
    sendError(res, msg, deriveHttpStatus(msg));
  }
};

export default {
  checkIn,
  checkOut,
  getHistory,
  getAllAttendances,
  getTodayAttendance,
  updateAttendance,
  deleteAttendance,
};
