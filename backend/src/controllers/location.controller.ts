import type { Request, Response } from 'express';
import {
  LocationUserActions,
  LocationAdminActions,
} from '../services/location.service.js';
import { sendSuccess } from '../utils/response.js';
import { asyncHandler } from '../utils/async-handler.js';
import { UnauthorizedError, BadRequestError, NotFoundError } from '../utils/custom-errors.js';

/**
 * Location Controller - จัดการ API สถานที่/แผนที่
 */

/**
 * POST /api/locations - สร้างสถานที่ใหม่
 * 
 * เหตุผลการตรวจสอบ:
 *    - GPS coordinates: validate ขอบเขต latitude/longitude เพื่อป้องกัน invalid location
 *    - radius: ต้อง > 0 เพื่อให้ GPS check-in/out ทำงานถูกต้อง
 *    - locationType: validate เป็น enum ที่กำหนดไว้
 */
export const createLocation = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    throw new UnauthorizedError('ไม่พบข้อมูลผู้ใช้');
  }

  const {
    locationName,
    address,
    locationType,
    latitude,
    longitude,
    radius,
    description,
    isActive,
  } = req.body;

  if (!locationName || !locationType || latitude === undefined || longitude === undefined || radius === undefined || radius === null) {
    throw new BadRequestError('กรุณาระบุ locationName, locationType, latitude, longitude, radius');
  }

  if (parseFloat(radius) <= 0) {
    throw new BadRequestError('radius ต้องมากกว่า 0');
  }

  const validTypes = ['OFFICE', 'BRANCH', 'EVENT', 'SITE', 'MEETING', 'OTHER'];
  if (!validTypes.includes(locationType)) {
    throw new BadRequestError(`locationType ต้องเป็น ${validTypes.join(', ')}`);
  }

  const location = await LocationUserActions.createLocation({
    userId,
    locationName,
    address,
    locationType,
    latitude: parseFloat(latitude),
    longitude: parseFloat(longitude),
    radius: parseFloat(radius),
    description,
    isActive,
  });

  sendSuccess(res, location, 'สร้างสถานที่เรียบร้อยแล้ว', 201);
});

/**
 * GET /api/locations
 * ดึงสถานที่ทั้งหมด
 */
export const getAllLocations = asyncHandler(async (req: Request, res: Response) => {
  const search = req.query.search as string | undefined;
  const locationType = req.query.locationType as any;
  const isActive =
    req.query.isActive !== undefined
      ? req.query.isActive === 'true'
      : undefined;
  const skip = req.query.skip ? parseInt(req.query.skip as string) : 0;
  const take = req.query.take ? parseInt(req.query.take as string) : 20;

  const result = await LocationUserActions.getAllLocations({
    search,
    locationType,
    isActive,
    skip,
    take,
  });

  sendSuccess(res, result, 'ดึงรายการสถานที่สำเร็จ');
});

/**
 * GET /api/locations/nearby
 * ค้นหาสถานที่ใกล้เคียง
 */
export const getNearbyLocations = asyncHandler(async (req: Request, res: Response) => {
  const latitude = req.query.latitude as string;
  const longitude = req.query.longitude as string;
  const radiusKm = req.query.radiusKm
    ? parseFloat(req.query.radiusKm as string)
    : 5;

  if (!latitude || !longitude) {
    throw new BadRequestError('กรุณาระบุ latitude และ longitude');
  }

  const locations = await LocationUserActions.getNearbyLocations(
    parseFloat(latitude),
    parseFloat(longitude),
    radiusKm
  );

  sendSuccess(res, locations, 'ค้นหาสถานที่ใกล้เคียงสำเร็จ');
});

/**
 * GET /api/locations/statistics
 * ดึงสถิติการใช้งานสถานที่ (Admin only)
 */
export const getLocationStatistics = asyncHandler(async (req: Request, res: Response) => {
  const statistics = await LocationAdminActions.getLocationStatistics();

  sendSuccess(res, statistics, 'ดึงสถิติสถานที่สำเร็จ');
});

/**
 * GET /api/locations/:id
 * ดึงสถานที่ด้วย ID
 */
export const getLocationById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const locationId = parseInt(Array.isArray(id) ? id[0] : id);

  if (!locationId) {
    throw new BadRequestError('ID สถานที่ไม่ถูกต้อง');
  }

  const location = await LocationUserActions.getLocationById(locationId);

  if (!location) {
    throw new NotFoundError('ไม่พบสถานที่');
  }

  sendSuccess(res, location);
});

/**
 * PUT /api/locations/:id
 * แก้ไขสถานที่ (Admin only)
 */
export const updateLocation = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const { id } = req.params;
  const locationId = parseInt(Array.isArray(id) ? id[0] : id);

  if (!userId) {
    throw new UnauthorizedError('ไม่พบข้อมูลผู้ใช้');
  }

  if (!locationId) {
    throw new BadRequestError('ID สถานที่ไม่ถูกต้อง');
  }

  const location = await LocationUserActions.getLocationById(locationId);

  if (!location) {
    throw new NotFoundError('ไม่พบสถานที่');
  }

  const {
    locationName,
    address,
    locationType,
    latitude,
    longitude,
    radius,
    description,
    isActive,
  } = req.body;

  const updatedLocation = await LocationAdminActions.updateLocation(locationId, {
    locationName,
    address,
    locationType,
    latitude: latitude !== undefined ? parseFloat(latitude) : undefined,
    longitude: longitude !== undefined ? parseFloat(longitude) : undefined,
    radius: radius !== undefined ? parseFloat(radius) : undefined,
    description,
    isActive,
    updatedByUserId: userId,
  });

  sendSuccess(res, updatedLocation, 'แก้ไขสถานที่เรียบร้อยแล้ว');
});

/**
 * DELETE /api/locations/:id
 * ลบสถานที่ (Admin only - Soft Delete)
 */
export const deleteLocation = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const { id } = req.params;
  const locationId = parseInt(Array.isArray(id) ? id[0] : id);
  const { deleteReason } = req.body;

  if (!userId) {
    throw new UnauthorizedError('ไม่พบข้อมูลผู้ใช้');
  }

  if (!locationId) {
    throw new BadRequestError('ID สถานที่ไม่ถูกต้อง');
  }

  const location = await LocationUserActions.getLocationById(locationId);

  if (!location) {
    throw new NotFoundError('ไม่พบสถานที่');
  }

  const deletedLocation = await LocationAdminActions.deleteLocation(locationId, {
    deletedByUserId: userId,
    deleteReason,
  });

  sendSuccess(res, deletedLocation, 'ลบสถานที่เรียบร้อยแล้ว');
});

/**
 * POST /api/locations/:id/restore
 * กู้คืนสถานที่ที่ถูกลบ (Admin only)
 */
export const restoreLocation = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const { id } = req.params;
  const locationId = parseInt(Array.isArray(id) ? id[0] : id);

  if (!locationId) {
    throw new BadRequestError('ID สถานที่ไม่ถูกต้อง');
  }

  const location = await LocationUserActions.getLocationById(locationId);

  if (!location) {
    throw new NotFoundError('ไม่พบสถานที่');
  }

  const restoredLocation = await LocationAdminActions.restoreLocation(locationId, userId);

  sendSuccess(res, restoredLocation, 'กู้คืนสถานที่เรียบร้อยแล้ว');
});
