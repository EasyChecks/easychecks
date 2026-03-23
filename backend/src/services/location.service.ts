import { prisma } from '../lib/prisma.js';
import type { Location, LocationType, Prisma } from '@prisma/client';
import { createAuditLog, AuditAction } from './audit.service.js';

/**
 * Location Service - จัดการสถานที่/แผนที่
 */

export interface CreateLocationDTO {
  userId: number;
  locationName: string;
  address?: string;
  locationType: LocationType;
  latitude: number;
  longitude: number;
  radius?: number;
  description?: string;
  isActive?: boolean;
}

export interface UpdateLocationDTO {
  locationName?: string;
  address?: string;
  locationType?: LocationType;
  latitude?: number;
  longitude?: number;
  radius?: number;
  description?: string;
  isActive?: boolean;
  updatedByUserId: number;
}

export interface DeleteLocationDTO {
  deletedByUserId: number;
  deleteReason?: string;
}

export interface SearchLocationParams {
  search?: string;
  locationType?: LocationType;
  isActive?: boolean;
  skip?: number;
  take?: number;
  onlyDeleted?: boolean; // แสดงเฉพาะที่ถูกลบ (soft delete)
}

// ========================================================================================
// USER ACTIONS - การดำเนินการของผู้ใช้ทั่วไป
// ========================================================================================

/**
 * ✨ ฟังก์ชันสร้างสถานที่ใหม่
 * 
 * 🎯 เป้าหมาย: สร้างสถานที่พร้อมพิกัด GPS และรัศมี
 * 
 * 💡 เหตุผล: ตรวจสอบความถูกต้องของ latitude/longitude และ radius ก่อนบันทึก
 *            เพื่อป้องกันข้อมูลที่ไม่ถูกต้องในการตรวจสอบตำแหน่ง GPS
 *            ตั้ง radius default = 100 เมตร ถ้าไม่ระบุ
 *            ตั้ง isActive default = true เพื่อให้สถานที่พร้อมใช้งานทันที
 *
 * SQL: INSERT INTO Location (...) VALUES (...) RETURNING *
 */
async function createLocation(data: CreateLocationDTO): Promise<Location> {
  // 🔍 ตรวจสอบว่า user มีอยู่จริงเพื่อป้องกัน invalid userId
  // SQL: SELECT * FROM User WHERE userId = ?
  const user = await prisma.user.findUnique({
    where: { userId: data.userId },
  });

  if (!user) {
    throw new Error('ไม่พบผู้ใช้');
  }

  // ✅ Validate ละติจูด (-90 ถึง 90 องศา)
  // เพื่อป้องกันค่าที่อยู่นอกขอบเขตที่ถูกต้อง
  if (data.latitude < -90 || data.latitude > 90) {
    throw new Error('ละติจูดต้องอยู่ระหว่าง -90 ถึง 90');
  }

  if (data.longitude < -180 || data.longitude > 180) {
    throw new Error('ลองจิจูดต้องอยู่ระหว่าง -180 ถึง 180');
  }

  // ✅ Validate รัศมี (ต้อง > 0 เมตร)
  // เพื่อให้การตรวจสอบ GPS check-in/out ทำงานได้ถูกต้อง
  if (data.radius && data.radius <= 0) {
    throw new Error('รัศมีต้องมากกว่า 0 เมตร');
  }

  const createdLocation = await prisma.location.create({
    data: {
      userId: data.userId,
      locationName: data.locationName,
      address: data.address,
      locationType: data.locationType,
      latitude: data.latitude,
      longitude: data.longitude,
      radius: data.radius || 100,
      description: data.description,
      isActive: data.isActive !== undefined ? data.isActive : true,
    },
    include: {
      creator: {
        select: {
          userId: true,
          firstName: true,
          lastName: true,
          email: true,
        },
      },
    },
  });

  await createAuditLog({
    userId: data.userId,
    action: AuditAction.CREATE_LOCATION,
    targetTable: 'locations',
    targetId: createdLocation.locationId,
    newValues: { locationName: createdLocation.locationName, locationType: createdLocation.locationType, latitude: createdLocation.latitude, longitude: createdLocation.longitude, radius: createdLocation.radius },
  });

  return createdLocation;
}

/**
 * ดึงสถานที่ทั้งหมด (รวมที่ถูกลบแล้ว)
 */
async function getAllLocations(params: SearchLocationParams): Promise<{ 
  data: Location[]; 
  total: number;
  active: number;
  inactive: number;
}> {
  const where: Prisma.LocationWhereInput = params.onlyDeleted
    ? { deleteReason: { not: null } } // แสดงเฉพาะที่ถูก soft delete
    : { deleteReason: null };         // ไม่แสดงที่ถูกลบ (default)

  if (params.search) {
    where.OR = [
      { locationName: { contains: params.search, mode: 'insensitive' } },
      { address: { contains: params.search, mode: 'insensitive' } },
      { description: { contains: params.search, mode: 'insensitive' } },
    ];
  }

  if (params.locationType) {
    where.locationType = params.locationType;
  }

  if (params.isActive !== undefined) {
    where.isActive = params.isActive;
  }

  const [data, total, active, inactive] = await Promise.all([
    prisma.location.findMany({
      where,
      skip: params.skip || 0,
      take: params.take || 20,
      orderBy: [
        { isActive: 'desc' },
        { locationId: 'desc' }
      ],
      include: {
        creator: {
          select: {
            userId: true,
            firstName: true,
            lastName: true,
            email: true,
          },
        },
      },
    }),
    prisma.location.count({ where }),
    prisma.location.count({ where: { ...where, isActive: true } }),
    prisma.location.count({ where: { ...where, isActive: false } }),
  ]);

  return { data, total, active, inactive };
}

/**
 * ดึงสถานที่ด้วย ID
 */
async function getLocationById(locationId: number): Promise<Location | null> {
  return prisma.location.findUnique({
    where: { locationId },
    include: {
      creator: {
        select: {
          userId: true,
          firstName: true,
          lastName: true,
          email: true,
          role: true,
        },
      },
    },
  });
}

/**
 * ค้นหาสถานที่ใกล้เคียง (ตาม GPS)
 */
async function getNearbyLocations(
  latitude: number,
  longitude: number,
  radiusKm: number = 5
): Promise<Location[]> {
  // Haversine formula approximation
  // 1 degree ≈ 111 km
  const latRange = radiusKm / 111;
  const lngRange = radiusKm / (111 * Math.cos(latitude * Math.PI / 180));

  const locations = await prisma.location.findMany({
    where: {
      deleteReason: null,
      isActive: true,
      latitude: {
        gte: latitude - latRange,
        lte: latitude + latRange,
      },
      longitude: {
        gte: longitude - lngRange,
        lte: longitude + lngRange,
      },
    },
    include: {
      creator: {
        select: {
          userId: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  // คำนวณระยะทางจริงและเรียงตามระยะ
  const locationsWithDistance = locations.map((loc) => {
    const distance = calculateDistance(
      latitude,
      longitude,
      loc.latitude,
      loc.longitude
    );
    return { ...loc, distance };
  });

  return locationsWithDistance
    .filter((loc) => (loc.distance as number) <= radiusKm)
    .sort((a, b) => (a.distance as number) - (b.distance as number));
}

/**
 * คำนวณระยะทางระหว่าง 2 จุด (Haversine formula)
 */
function calculateDistance(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number
): number {
  const R = 6371; // รัศมีโลก (km)
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// ========================================================================================
// ADMIN ACTIONS - การดำเนินการของผู้จัดการ/แอดมิน
// ========================================================================================

/**
 * แก้ไขสถานที่
 */
async function updateLocation(
  locationId: number,
  data: UpdateLocationDTO
): Promise<Location> {
  const location = await prisma.location.findUnique({
    where: { locationId },
  });

  if (!location) {
    throw new Error('ไม่พบสถานที่');
  }

  if (location.deleteReason) {
    throw new Error('ไม่สามารถแก้ไขสถานที่ที่ถูกลบแล้ว');
  }

  // Validate ละติจูด/ลองจิจูด ถ้ามีการเปลี่ยน
  if (data.latitude !== undefined) {
    if (data.latitude < -90 || data.latitude > 90) {
      throw new Error('ละติจูดต้องอยู่ระหว่าง -90 ถึง 90');
    }
  }

  if (data.longitude !== undefined) {
    if (data.longitude < -180 || data.longitude > 180) {
      throw new Error('ลองจิจูดต้องอยู่ระหว่าง -180 ถึง 180');
    }
  }

  // Validate รัศมี
  if (data.radius !== undefined && data.radius <= 0) {
    throw new Error('รัศมีต้องมากกว่า 0 เมตร');
  }

  const updatedLocation = await prisma.location.update({
    where: { locationId },
    data: {
      locationName: data.locationName,
      address: data.address,
      locationType: data.locationType,
      latitude: data.latitude,
      longitude: data.longitude,
      radius: data.radius,
      description: data.description,
      isActive: data.isActive,
    },
    include: {
      creator: {
        select: {
          userId: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  await createAuditLog({
    userId: data.updatedByUserId,
    action: AuditAction.UPDATE_LOCATION,
    targetTable: 'locations',
    targetId: locationId,
    oldValues: { locationName: location.locationName, isActive: location.isActive, latitude: location.latitude, longitude: location.longitude, radius: location.radius },
    newValues: { locationName: updatedLocation.locationName, isActive: updatedLocation.isActive, latitude: updatedLocation.latitude, longitude: updatedLocation.longitude, radius: updatedLocation.radius },
  });

  return updatedLocation;
}

/**
 * ลบสถานที่ (Soft Delete)
 */
async function deleteLocation(
  locationId: number,
  data: DeleteLocationDTO
): Promise<Location> {
  const location = await prisma.location.findUnique({
    where: { locationId },
  });

  if (!location) {
    throw new Error('ไม่พบสถานที่');
  }

  if (location.deleteReason) {
    throw new Error('สถานที่นี้ถูกลบไปแล้ว');
  }

  // ตรวจสอบว่ามีการใช้งานอยู่หรือไม่
  const activeAttendances = await prisma.attendance.count({
    where: {
      locationId,
      checkOut: null, // ยังไม่ checkout
    },
  });

  if (activeAttendances > 0) {
    throw new Error(
      `ไม่สามารถลบได้ เนื่องจากมี ${activeAttendances} คนกำลังเข้างานอยู่ในสถานที่นี้`
    );
  }

  const deletedLocation = await prisma.location.update({
    where: { locationId },
    data: {
      deleteReason: data.deleteReason,
      isActive: false, // ปิดการใช้งานทันที
    },
    include: {
      creator: {
        select: {
          userId: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  await createAuditLog({
    userId: data.deletedByUserId,
    action: AuditAction.DELETE_LOCATION,
    targetTable: 'locations',
    targetId: locationId,
    oldValues: { locationName: location.locationName, isActive: location.isActive },
    newValues: { deleted: true, deleteReason: data.deleteReason },
  });

  return deletedLocation;
}

/**
 * กู้คืนสถานที่ที่ถูกลบ
 */
async function restoreLocation(locationId: number, restoredByUserId?: number): Promise<Location> {
  const location = await prisma.location.findUnique({
    where: { locationId },
  });

  if (!location) {
    throw new Error('ไม่พบสถานที่');
  }

  if (!location.deleteReason) {
    throw new Error('สถานที่นี้ยังไม่ถูกลบ');
  }

  const restoredLocation = await prisma.location.update({
    where: { locationId },
    data: {
      deleteReason: null,
      isActive: true,
    },
    include: {
      creator: {
        select: {
          userId: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  await createAuditLog({
    userId: restoredByUserId,
    action: AuditAction.RESTORE_LOCATION,
    targetTable: 'locations',
    targetId: locationId,
    oldValues: { deleteReason: location.deleteReason, isActive: location.isActive },
    newValues: { deleteReason: null, isActive: true },
  });

  return restoredLocation;
}

/**
 * สถิติการใช้งานสถานที่
 */
async function getLocationStatistics(): Promise<{
  totalLocations: number;
  activeLocations: number;
  inactiveLocations: number;
  deletedLocations: number;
  byType: { type: string; count: number }[];
}> {
  const [
    totalLocations,
    activeLocations,
    inactiveLocations,
    deletedLocations,
    byTypeRaw,
  ] = await Promise.all([
    prisma.location.count({ where: { deleteReason: null } }),
    prisma.location.count({ where: { deleteReason: null, isActive: true } }),
    prisma.location.count({ where: { deleteReason: null, isActive: false } }),
    prisma.location.count({ where: { deleteReason: { not: null } } }),
    prisma.location.groupBy({
      by: ['locationType'],
      where: { deleteReason: null },
      _count: true,
    }),
  ]);

  const byType = byTypeRaw.map((item) => ({
    type: item.locationType,
    count: item._count,
  }));

  return {
    totalLocations,
    activeLocations,
    inactiveLocations,
    deletedLocations,
    byType,
  };
}

// ========================================================================================
// EXPORTS - แยก exports เป็น 2 กลุ่มตามหน้าที่
// ========================================================================================

/**
 * User Actions - ใช้โดยผู้ใช้ทั่วไป
 */
export const LocationUserActions = {
  createLocation,
  getAllLocations,
  getLocationById,
  getNearbyLocations,
};

/**
 * Admin Actions - ใช้โดยผู้จัดการ/แอดมิน
 */
export const LocationAdminActions = {
  updateLocation,
  deleteLocation,
  restoreLocation,
  getLocationStatistics,
};
