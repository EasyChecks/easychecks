import { prisma } from '../lib/prisma.js';
import type { Location, LocationType } from '@prisma/client';

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
}

// ========================================================================================
// USER ACTIONS - การดำเนินการของผู้ใช้ทั่วไป
// ========================================================================================

/**
 * สร้างสถานที่ใหม่
 */
async function createLocation(data: CreateLocationDTO): Promise<Location> {
  // ตรวจสอบว่า user มีอยู่จริง
  const user = await prisma.user.findUnique({
    where: { userId: data.userId },
  });

  if (!user) {
    throw new Error('ไม่พบผู้ใช้');
  }

  // Validate ละติจูด/ลองจิจูด
  if (data.latitude < -90 || data.latitude > 90) {
    throw new Error('ละติจูดต้องอยู่ระหว่าง -90 ถึง 90');
  }

  if (data.longitude < -180 || data.longitude > 180) {
    throw new Error('ลองจิจูดต้องอยู่ระหว่าง -180 ถึง 180');
  }

  // Validate รัศมี
  if (data.radius && data.radius <= 0) {
    throw new Error('รัศมีต้องมากกว่า 0 เมตร');
  }

  return prisma.location.create({
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
  const where: any = {
    deletedAt: null, // ไม่แสดงที่ถูกลบ
  };

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
        { createdAt: 'desc' }
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
        updatedBy: {
          select: {
            userId: true,
            firstName: true,
            lastName: true,
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
      deletedAt: null,
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
    .filter((loc) => (loc as any).distance <= radiusKm)
    .sort((a, b) => (a as any).distance - (b as any).distance);
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

  if (location.deletedAt) {
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

  return prisma.location.update({
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
      updatedByUserId: data.updatedByUserId,
      updatedAt: new Date(),
    },
    include: {
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

  if (location.deletedAt) {
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

  return prisma.location.update({
    where: { locationId },
    data: {
      deletedAt: new Date(),
      deletedByUserId: data.deletedByUserId,
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
 * กู้คืนสถานที่ที่ถูกลบ
 */
async function restoreLocation(locationId: number): Promise<Location> {
  const location = await prisma.location.findUnique({
    where: { locationId },
  });

  if (!location) {
    throw new Error('ไม่พบสถานที่');
  }

  if (!location.deletedAt) {
    throw new Error('สถานที่นี้ยังไม่ถูกลบ');
  }

  return prisma.location.update({
    where: { locationId },
    data: {
      deletedAt: null,
      deletedByUserId: null,
      deleteReason: null,
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
    prisma.location.count({ where: { deletedAt: null } }),
    prisma.location.count({ where: { deletedAt: null, isActive: true } }),
    prisma.location.count({ where: { deletedAt: null, isActive: false } }),
    prisma.location.count({ where: { deletedAt: { not: null } } }),
    prisma.location.groupBy({
      by: ['locationType'],
      where: { deletedAt: null },
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
