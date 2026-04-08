import { prisma } from '../lib/prisma.js'; // Prisma client กลางสำหรับ query ฐานข้อมูล
import type { Location, LocationType, Prisma } from '@prisma/client'; // ชนิดข้อมูลจาก Prisma
import { createAuditLog, AuditAction } from './audit.service.js'; // บันทึก audit log ของการเปลี่ยนแปลง

/**
 * Location Service - จัดการสถานที่/แผนที่
 */

export interface CreateLocationDTO { // โครงสร้างข้อมูลสำหรับการสร้างสถานที่
  userId: number; // รหัสผู้ใช้เจ้าของสถานที่
  locationName: string; // ชื่อสถานที่
  address?: string; // ที่อยู่ (ถ้ามี)
  locationType: LocationType; // ประเภทสถานที่
  latitude: number; // ละติจูด
  longitude: number; // ลองจิจูด
  radius?: number; // รัศมีเช็คอิน (เมตร)
  description?: string; // คำอธิบายเพิ่มเติม
  isActive?: boolean; // สถานะใช้งาน (ถ้ามี)
} // จบ CreateLocationDTO

export interface UpdateLocationDTO { // โครงสร้างข้อมูลสำหรับการแก้ไขสถานที่
  locationName?: string; // ชื่อสถานที่ใหม่ (ถ้ามี)
  address?: string; // ที่อยู่ใหม่ (ถ้ามี)
  locationType?: LocationType; // ประเภทใหม่ (ถ้ามี)
  latitude?: number; // ละติจูดใหม่ (ถ้ามี)
  longitude?: number; // ลองจิจูดใหม่ (ถ้ามี)
  radius?: number; // รัศมีใหม่ (ถ้ามี)
  description?: string; // คำอธิบายใหม่ (ถ้ามี)
  isActive?: boolean; // สถานะใช้งานใหม่ (ถ้ามี)
  updatedByUserId: number; // ผู้ใช้ที่ทำการแก้ไข
} // จบ UpdateLocationDTO

export interface DeleteLocationDTO { // โครงสร้างข้อมูลสำหรับการลบสถานที่
  deletedByUserId: number; // ผู้ใช้ที่ทำการลบ
  deleteReason?: string; // เหตุผลการลบ (ถ้ามี)
} // จบ DeleteLocationDTO

export interface SearchLocationParams { // โครงสร้างข้อมูลสำหรับการค้นหา/ดึงรายการ
  search?: string; // คำค้นหา
  locationType?: LocationType; // กรองตามประเภท
  isActive?: boolean; // กรองตามสถานะใช้งาน
  skip?: number; // ข้ามกี่รายการ
  take?: number; // ดึงกี่รายการ
  onlyDeleted?: boolean; // แสดงเฉพาะที่ถูกลบ (soft delete)
} // จบ SearchLocationParams

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
async function createLocation(data: CreateLocationDTO): Promise<Location> { // สร้างสถานที่ใหม่ตามข้อมูลที่ส่งมา
  // 🔍 ตรวจสอบว่า user มีอยู่จริงเพื่อป้องกัน invalid userId
  // SQL: SELECT * FROM User WHERE userId = ?
  const user = await prisma.user.findUnique({ // ค้นหาผู้ใช้จาก userId
    where: { userId: data.userId }, // เงื่อนไขค้นหาเฉพาะ userId นี้
  }); // จบการค้นหา user

  if (!user) { // ถ้าไม่พบผู้ใช้
    throw new Error('ไม่พบผู้ใช้'); // ป้องกันการสร้างสถานที่ให้ผู้ใช้ที่ไม่มีจริง
  } // จบ if !user

  // ✅ Validate ละติจูด (-90 ถึง 90 องศา)
  // เพื่อป้องกันค่าที่อยู่นอกขอบเขตที่ถูกต้อง
  if (data.latitude < -90 || data.latitude > 90) { // ตรวจช่วงละติจูด
    throw new Error('ละติจูดต้องอยู่ระหว่าง -90 ถึง 90'); // แจ้งข้อผิดพลาดถ้าเกินช่วง
  } // จบ if latitude range

  if (data.longitude < -180 || data.longitude > 180) { // ตรวจช่วงลองจิจูด
    throw new Error('ลองจิจูดต้องอยู่ระหว่าง -180 ถึง 180'); // แจ้งข้อผิดพลาดถ้าเกินช่วง
  } // จบ if longitude range

  // ✅ Validate รัศมี (ต้อง > 0 เมตร)
  // เพื่อให้การตรวจสอบ GPS check-in/out ทำงานได้ถูกต้อง
  if (data.radius && data.radius <= 0) { // ตรวจค่า radius เฉพาะตอนมีการส่งมา
    throw new Error('รัศมีต้องมากกว่า 0 เมตร'); // แจ้งข้อผิดพลาดเมื่อ <= 0
  } // จบ if radius <= 0

  const createdLocation = await prisma.location.create({ // เรียก Prisma เพื่อเพิ่มข้อมูล Location ใหม่
    data: { // payload สำหรับ insert
      userId: data.userId, // ผู้ใช้เจ้าของ location
      locationName: data.locationName, // ชื่อสถานที่
      address: data.address, // ที่อยู่
      locationType: data.locationType, // ประเภทของสถานที่
      latitude: data.latitude, // พิกัดละติจูด
      longitude: data.longitude, // พิกัดลองจิจูด
      radius: data.radius || 100, // ใช้ค่าเริ่มต้น 100 ถ้าไม่ส่งมา
      description: data.description, // คำอธิบายเพิ่มเติม
      isActive: data.isActive !== undefined ? data.isActive : true, // ตั้งค่า default เป็น true
    }, // จบ payload
    include: { // แนบข้อมูลผู้สร้างกลับไปด้วย
      creator: { // ความสัมพันธ์ผู้สร้าง
        select: { // เลือกเฉพาะฟิลด์ที่ต้องการ
          userId: true, // รหัสผู้ใช้
          firstName: true, // ชื่อ
          lastName: true, // นามสกุล
          email: true, // อีเมล
        }, // จบ select
      }, // จบ creator
    }, // จบ include
  }); // execute insert และคืนค่า record ที่สร้างแล้ว

  await createAuditLog({ // บันทึก audit log การสร้างสถานที่
    userId: data.userId, // ผู้ใช้ที่เป็นเจ้าของสถานที่
    action: AuditAction.CREATE_LOCATION, // ประเภท action สำหรับการสร้าง
    targetTable: 'locations', // ตารางเป้าหมาย
    targetId: createdLocation.locationId, // id ของ record ที่สร้าง
    newValues: { locationName: createdLocation.locationName, locationType: createdLocation.locationType, latitude: createdLocation.latitude, longitude: createdLocation.longitude, radius: createdLocation.radius }, // ค่าใหม่ที่ถูกบันทึก
  }); // จบการบันทึก audit log

  return createdLocation; // ส่งข้อมูลสถานที่ที่สร้างแล้วกลับไป
} // จบ createLocation

/**
 * ดึงสถานที่ทั้งหมด (รวมที่ถูกลบแล้ว)
 */
async function getAllLocations(params: SearchLocationParams): Promise<{ // ดึงรายการสถานที่พร้อมสถิติ
  data: Location[]; // รายการสถานที่ตามเงื่อนไข
  total: number; // จำนวนรวมทั้งหมด
  active: number; // จำนวนที่ใช้งานอยู่
  inactive: number; // จำนวนที่ไม่ใช้งาน
}> { // จบรูปแบบผลลัพธ์
  const where: Prisma.LocationWhereInput = params.onlyDeleted // สร้างเงื่อนไขหลักของการดึงข้อมูล
    ? { deleteReason: { not: null } } // แสดงเฉพาะที่ถูก soft delete
    : { deleteReason: null };         // ไม่แสดงที่ถูกลบ (default)

  if (params.search) { // มีคำค้นหา
    where.OR = [ // เพิ่มเงื่อนไขค้นหลายคอลัมน์
      { locationName: { contains: params.search, mode: 'insensitive' } }, // ค้นจากชื่อสถานที่
      { address: { contains: params.search, mode: 'insensitive' } }, // ค้นจากที่อยู่
      { description: { contains: params.search, mode: 'insensitive' } }, // ค้นจากคำอธิบาย
    ]; // จบ OR
  } // จบ if search

  if (params.locationType) { // มีการกรองตามประเภท
    where.locationType = params.locationType; // กรองตาม locationType
  } // จบ if locationType

  if (params.isActive !== undefined) { // มีการกรองตามสถานะ
    where.isActive = params.isActive; // กรองตาม isActive
  } // จบ if isActive

  const [data, total, active, inactive] = await Promise.all([ // ดึงข้อมูลและสถิติพร้อมกัน
    prisma.location.findMany({ // ดึงรายการสถานที่ตามเงื่อนไข
      where, // เงื่อนไข filter
      skip: params.skip || 0, // pagination offset
      take: params.take || 20, // pagination limit
      orderBy: [ // การเรียงลำดับผลลัพธ์
        { isActive: 'desc' }, // ให้ active ขึ้นก่อน
        { locationId: 'desc' } // ให้รายการล่าสุดอยู่บน
      ], // จบ orderBy
      include: { // แนบข้อมูลผู้สร้าง
        creator: { // ความสัมพันธ์ผู้สร้าง
          select: { // เลือกเฉพาะฟิลด์ที่จำเป็น
            userId: true, // รหัสผู้ใช้
            firstName: true, // ชื่อ
            lastName: true, // นามสกุล
            email: true, // อีเมล
          }, // จบ select
        }, // จบ creator
      }, // จบ include
    }), // จบ findMany
    prisma.location.count({ where }), // จำนวนรวมตามเงื่อนไข
    prisma.location.count({ where: { ...where, isActive: true } }), // จำนวน active
    prisma.location.count({ where: { ...where, isActive: false } }), // จำนวน inactive
  ]); // จบ Promise.all

  return { data, total, active, inactive }; // ส่งผลลัพธ์รวมกลับไป
} // จบ getAllLocations

/**
 * ดึงสถานที่ด้วย ID
 */
async function getLocationById(locationId: number): Promise<Location | null> { // ดึงสถานที่ตาม id
  return prisma.location.findUnique({ // ค้นหา record เดียวด้วย unique key
    where: { locationId }, // เงื่อนไขค้นหา locationId
    include: { // แนบข้อมูลผู้สร้างกลับไปด้วย
      creator: { // ความสัมพันธ์ผู้สร้าง
        select: { // เลือกเฉพาะฟิลด์ที่ต้องการ
          userId: true, // รหัสผู้ใช้
          firstName: true, // ชื่อ
          lastName: true, // นามสกุล
          email: true, // อีเมล
          role: true, // บทบาทผู้ใช้
        }, // จบ select
      }, // จบ creator
    }, // จบ include
  }); // ส่งผลลัพธ์ที่ค้นเจอ (หรือ null)
} // จบ getLocationById

/**
 * ค้นหาสถานที่ใกล้เคียง (ตาม GPS)
 */
async function getNearbyLocations( // ค้นหาสถานที่ใกล้เคียงจากพิกัด
  latitude: number, // ละติจูดจุดอ้างอิง
  longitude: number, // ลองจิจูดจุดอ้างอิง
  radiusKm: number = 5 // รัศมีค้นหา (กิโลเมตร)
): Promise<Location[]> { // คืนรายการสถานที่ใกล้เคียง
  // Haversine formula approximation
  // 1 degree ≈ 111 km
  const latRange = radiusKm / 111; // ช่วงละติจูดโดยประมาณจากรัศมี
  const lngRange = radiusKm / (111 * Math.cos(latitude * Math.PI / 180)); // ช่วงลองจิจูดโดยประมาณจากรัศมี

  const locations = await prisma.location.findMany({ // ดึงรายการสถานที่ที่อยู่ในกรอบโดยประมาณ
    where: { // เงื่อนไขค้นหาเบื้องต้น
      deleteReason: null, // เฉพาะที่ยังไม่ถูกลบ
      isActive: true, // เฉพาะที่ใช้งานอยู่
      latitude: { // ช่วงละติจูดที่ยอมรับได้
        gte: latitude - latRange, // ค่าต่ำสุดของละติจูด
        lte: latitude + latRange, // ค่าสูงสุดของละติจูด
      }, // จบช่วงละติจูด
      longitude: { // ช่วงลองจิจูดที่ยอมรับได้
        gte: longitude - lngRange, // ค่าต่ำสุดของลองจิจูด
        lte: longitude + lngRange, // ค่าสูงสุดของลองจิจูด
      }, // จบช่วงลองจิจูด
    }, // จบ where
    include: { // แนบข้อมูลผู้สร้าง
      creator: { // ความสัมพันธ์ผู้สร้าง
        select: { // เลือกเฉพาะฟิลด์ที่ต้องการ
          userId: true, // รหัสผู้ใช้
          firstName: true, // ชื่อ
          lastName: true, // นามสกุล
        }, // จบ select
      }, // จบ creator
    }, // จบ include
  }); // จบ findMany

  // คำนวณระยะทางจริงและเรียงตามระยะ
  const locationsWithDistance = locations.map((loc) => { // คำนวณระยะจริงให้แต่ละ location
    const distance = calculateDistance( // คำนวณระยะด้วย Haversine
      latitude, // ละติจูดจุดอ้างอิง
      longitude, // ลองจิจูดจุดอ้างอิง
      loc.latitude, // ละติจูดของสถานที่
      loc.longitude // ลองจิจูดของสถานที่
    ); // จบการคำนวณระยะ
    return { ...loc, distance }; // คืนข้อมูลพร้อมระยะทาง
  }); // จบ map

  return locationsWithDistance // เริ่มจากรายการที่มีระยะแล้ว
    .filter((loc) => (loc.distance as number) <= radiusKm) // คัดเฉพาะในรัศมีจริง
    .sort((a, b) => (a.distance as number) - (b.distance as number)); // เรียงจากใกล้ไปไกล
} // จบ getNearbyLocations

/**
 * คำนวณระยะทางระหว่าง 2 จุด (Haversine formula)
 */
function calculateDistance( // คำนวณระยะทางระหว่างสองพิกัด
  lat1: number, // ละติจูดจุดที่ 1
  lng1: number, // ลองจิจูดจุดที่ 1
  lat2: number, // ละติจูดจุดที่ 2
  lng2: number // ลองจิจูดจุดที่ 2
): number { // คืนค่าระยะทางเป็นกิโลเมตร
  const R = 6371; // รัศมีโลก (km)
  const dLat = ((lat2 - lat1) * Math.PI) / 180; // ส่วนต่างละติจูด (เรเดียน)
  const dLng = ((lng2 - lng1) * Math.PI) / 180; // ส่วนต่างลองจิจูด (เรเดียน)

  const a = // ตัวแปรกลางของสูตร Haversine
    Math.sin(dLat / 2) * Math.sin(dLat / 2) + // องค์ประกอบจากละติจูด
    Math.cos((lat1 * Math.PI) / 180) * // แปลงละติจูดจุดที่ 1 เป็นเรเดียน
      Math.cos((lat2 * Math.PI) / 180) * // แปลงละติจูดจุดที่ 2 เป็นเรเดียน
      Math.sin(dLng / 2) * // องค์ประกอบจากลองจิจูด
      Math.sin(dLng / 2); // องค์ประกอบจากลองจิจูด (ซ้ำตามสูตร)

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)); // คำนวณมุมกลางของส่วนโค้ง
  return R * c; // คืนระยะทางจริง (กิโลเมตร)
} // จบ calculateDistance

// ========================================================================================
// ADMIN ACTIONS - การดำเนินการของผู้จัดการ/แอดมิน
// ========================================================================================

/**
 * แก้ไขสถานที่
 */
async function updateLocation( // แก้ไขสถานที่ตาม id
  locationId: number, // รหัสสถานที่ที่ต้องการแก้ไข
  data: UpdateLocationDTO // ข้อมูลใหม่ที่จะอัปเดต
): Promise<Location> { // คืนข้อมูลสถานที่ล่าสุด
  const location = await prisma.location.findUnique({ // ตรวจว่ามีสถานที่นี้จริง
    where: { locationId }, // เงื่อนไขค้นหา
  }); // จบการค้นหา location

  if (!location) { // ไม่พบสถานที่ตาม id
    throw new Error('ไม่พบสถานที่'); // แจ้งข้อผิดพลาด
  } // จบ if !location

  if (location.deleteReason) { // ถ้าสถานที่ถูกลบแล้ว
    throw new Error('ไม่สามารถแก้ไขสถานที่ที่ถูกลบแล้ว'); // ห้ามแก้ไขสถานที่ที่ถูกลบ
  } // จบ if location deleted

  // Validate ละติจูด/ลองจิจูด ถ้ามีการเปลี่ยน
  if (data.latitude !== undefined) { // มีการเปลี่ยนละติจูด
    if (data.latitude < -90 || data.latitude > 90) { // ตรวจช่วงละติจูด
      throw new Error('ละติจูดต้องอยู่ระหว่าง -90 ถึง 90'); // แจ้งข้อผิดพลาดถ้าเกินช่วง
    } // จบ if latitude range
  } // จบ if latitude changed

  if (data.longitude !== undefined) { // มีการเปลี่ยนลองจิจูด
    if (data.longitude < -180 || data.longitude > 180) { // ตรวจช่วงลองจิจูด
      throw new Error('ลองจิจูดต้องอยู่ระหว่าง -180 ถึง 180'); // แจ้งข้อผิดพลาดถ้าเกินช่วง
    } // จบ if longitude range
  } // จบ if longitude changed

  // Validate รัศมี
  if (data.radius !== undefined && data.radius <= 0) { // มีการเปลี่ยนรัศมีและค่าไม่ถูกต้อง
    throw new Error('รัศมีต้องมากกว่า 0 เมตร'); // แจ้งข้อผิดพลาดเมื่อ <= 0
  } // จบ if radius <= 0

  const updatedLocation = await prisma.location.update({ // เรียก Prisma เพื่อแก้ไขข้อมูล Location
    where: { locationId }, // ระบุ record เป้าหมายด้วย locationId
    data: { // ฟิลด์ที่ต้องการอัปเดต
      locationName: data.locationName, // ชื่อสถานที่ใหม่
      address: data.address, // ที่อยู่ใหม่
      locationType: data.locationType, // ประเภทใหม่
      latitude: data.latitude, // ละติจูดใหม่
      longitude: data.longitude, // ลองจิจูดใหม่
      radius: data.radius, // รัศมีใหม่
      description: data.description, // คำอธิบายใหม่
      isActive: data.isActive, // สถานะการใช้งานใหม่
    }, // จบชุดข้อมูลอัปเดต
    include: { // แนบข้อมูลผู้สร้างกลับไปด้วย
      creator: { // ความสัมพันธ์ผู้สร้าง
        select: { // เลือกเฉพาะฟิลด์ที่ต้องการ
          userId: true, // รหัสผู้ใช้
          firstName: true, // ชื่อ
          lastName: true, // นามสกุล
        }, // จบ select
      }, // จบ creator
    }, // จบ include
  }); // execute update และคืนค่า record ล่าสุด

  await createAuditLog({ // บันทึก audit log การแก้ไขสถานที่
    userId: data.updatedByUserId, // ผู้ใช้ที่ทำการแก้ไข
    action: AuditAction.UPDATE_LOCATION, // ประเภท action สำหรับการแก้ไข
    targetTable: 'locations', // ตารางเป้าหมาย
    targetId: locationId, // id ของ record ที่ถูกแก้ไข
    oldValues: { locationName: location.locationName, isActive: location.isActive, latitude: location.latitude, longitude: location.longitude, radius: location.radius }, // ค่าเดิมก่อนแก้ไข
    newValues: { locationName: updatedLocation.locationName, isActive: updatedLocation.isActive, latitude: updatedLocation.latitude, longitude: updatedLocation.longitude, radius: updatedLocation.radius }, // ค่าใหม่หลังแก้ไข
  }); // จบการบันทึก audit log

  return updatedLocation; // ส่งข้อมูลสถานที่ที่แก้ไขแล้วกลับไป
} // จบ updateLocation

/**
 * ลบสถานที่ (Soft Delete)
 */
async function deleteLocation( // ลบสถานที่แบบ soft delete
  locationId: number, // รหัสสถานที่ที่ต้องการลบ
  data: DeleteLocationDTO // ข้อมูลการลบ (ผู้ลบ/เหตุผล)
): Promise<Location> { // คืนข้อมูลสถานที่หลังลบเชิงตรรกะ
  const location = await prisma.location.findUnique({ // ตรวจว่ามีสถานที่นี้จริง
    where: { locationId }, // เงื่อนไขค้นหา
  }); // จบการค้นหา location

  if (!location) { // ไม่พบสถานที่ตาม id
    throw new Error('ไม่พบสถานที่'); // แจ้งข้อผิดพลาด
  } // จบ if !location

  if (location.deleteReason) { // ถ้ามีเหตุผลการลบแล้ว
    throw new Error('สถานที่นี้ถูกลบไปแล้ว'); // ป้องกันการลบซ้ำ
  } // จบ if location deleted

  // ตรวจสอบว่ามีการใช้งานอยู่หรือไม่
  const activeAttendances = await prisma.attendance.count({ // นับจำนวนคนที่ยังใช้งานอยู่
    where: { // เงื่อนไขค้นหา
      locationId, // เฉพาะสถานที่นี้
      checkOut: null, // ยังไม่ checkout
    }, // จบ where
  }); // จบการนับ attendance

  if (activeAttendances > 0) { // มีคนกำลังใช้งานสถานที่อยู่
    throw new Error( // แจ้งข้อผิดพลาดเชิงธุรกิจ
      `ไม่สามารถลบได้ เนื่องจากมี ${activeAttendances} คนกำลังเข้างานอยู่ในสถานที่นี้` // รายงานจำนวนผู้ใช้งานที่ยังไม่ checkout
    ); // จบการ throw
  } // จบ if activeAttendances > 0

  const deletedLocation = await prisma.location.update({ // ใช้ update เพื่อทำ soft delete
    where: { locationId }, // ระบุ record ที่ต้องการลบด้วย locationId
    data: { // ค่าที่เปลี่ยนเพื่อทำ soft delete
      deleteReason: data.deleteReason, // บันทึกเหตุผลการลบ
      isActive: false, // ปิดการใช้งานทันที
    }, // จบข้อมูลที่ใช้ soft delete
    include: { // แนบข้อมูลผู้สร้างกลับไปด้วย
      creator: { // ความสัมพันธ์ผู้สร้าง
        select: { // เลือกเฉพาะฟิลด์ที่ต้องการ
          userId: true, // รหัสผู้ใช้
          firstName: true, // ชื่อ
          lastName: true, // นามสกุล
        }, // จบ select
      }, // จบ creator
    }, // จบ include
  }); // execute update และคืนค่า record หลังลบเชิงตรรกะ

  await createAuditLog({ // บันทึก audit log การลบสถานที่
    userId: data.deletedByUserId, // ผู้ใช้ที่ทำการลบ
    action: AuditAction.DELETE_LOCATION, // ประเภท action สำหรับการลบ
    targetTable: 'locations', // ตารางเป้าหมาย
    targetId: locationId, // id ของ record ที่ถูกลบ
    oldValues: { locationName: location.locationName, isActive: location.isActive }, // ค่าเดิมก่อนลบ
    newValues: { deleted: true, deleteReason: data.deleteReason }, // ค่าใหม่หลังลบ
  }); // จบการบันทึก audit log

  return deletedLocation; // ส่งข้อมูลสถานที่หลังลบกลับไป
} // จบ deleteLocation

/**
 * กู้คืนสถานที่ที่ถูกลบ
 */
async function restoreLocation(locationId: number, restoredByUserId?: number): Promise<Location> { // กู้คืนสถานที่ที่ถูกลบ
  const location = await prisma.location.findUnique({ // ตรวจว่ามีสถานที่นี้จริง
    where: { locationId }, // เงื่อนไขค้นหา
  }); // จบการค้นหา location

  if (!location) { // ไม่พบสถานที่ตาม id
    throw new Error('ไม่พบสถานที่'); // แจ้งข้อผิดพลาด
  } // จบ if !location

  if (!location.deleteReason) { // ไม่มีเหตุผลการลบแปลว่ายังไม่ถูกลบ
    throw new Error('สถานที่นี้ยังไม่ถูกลบ'); // ป้องกันการกู้คืนซ้ำ
  } // จบ if not deleted

  const restoredLocation = await prisma.location.update({ // อัปเดตเพื่อล้างสถานะการลบ
    where: { locationId }, // ระบุ record เป้าหมาย
    data: { // ค่าที่ใช้กู้คืน
      deleteReason: null, // ล้างเหตุผลการลบ
      isActive: true, // เปิดใช้งานอีกครั้ง
    }, // จบข้อมูลกู้คืน
    include: { // แนบข้อมูลผู้สร้างกลับไปด้วย
      creator: { // ความสัมพันธ์ผู้สร้าง
        select: { // เลือกเฉพาะฟิลด์ที่ต้องการ
          userId: true, // รหัสผู้ใช้
          firstName: true, // ชื่อ
          lastName: true, // นามสกุล
        }, // จบ select
      }, // จบ creator
    }, // จบ include
  }); // จบ update กู้คืน

  await createAuditLog({ // บันทึก audit log การกู้คืนสถานที่
    userId: restoredByUserId, // ผู้ใช้ที่ทำการกู้คืน (ถ้ามี)
    action: AuditAction.RESTORE_LOCATION, // ประเภท action สำหรับการกู้คืน
    targetTable: 'locations', // ตารางเป้าหมาย
    targetId: locationId, // id ของ record ที่ถูกกู้คืน
    oldValues: { deleteReason: location.deleteReason, isActive: location.isActive }, // ค่าเดิมก่อนกู้คืน
    newValues: { deleteReason: null, isActive: true }, // ค่าใหม่หลังกู้คืน
  }); // จบการบันทึก audit log

  return restoredLocation; // ส่งข้อมูลสถานที่หลังการกู้คืนกลับไป
} // จบ restoreLocation

/**
 * สถิติการใช้งานสถานที่
 */
async function getLocationStatistics(): Promise<{ // ดึงสถิติการใช้งานสถานที่
  totalLocations: number; // จำนวนสถานที่ทั้งหมด (ไม่ถูกลบ)
  activeLocations: number; // จำนวนสถานที่ที่ใช้งานอยู่
  inactiveLocations: number; // จำนวนสถานที่ที่ไม่ใช้งาน
  deletedLocations: number; // จำนวนสถานที่ที่ถูกลบ
  byType: { type: string; count: number }[]; // สรุปจำนวนตามประเภท
}> { // จบรูปแบบผลลัพธ์
  const [ // ดึงสถิติหลายตัวพร้อมกัน
    totalLocations, // จำนวนทั้งหมด
    activeLocations, // จำนวนที่ใช้งานอยู่
    inactiveLocations, // จำนวนที่ไม่ใช้งาน
    deletedLocations, // จำนวนที่ถูกลบ
    byTypeRaw, // ข้อมูลรวมตามประเภทแบบดิบ
  ] = await Promise.all([ // เรียกหลาย query พร้อมกัน
    prisma.location.count({ where: { deleteReason: null } }), // นับเฉพาะที่ยังไม่ถูกลบ
    prisma.location.count({ where: { deleteReason: null, isActive: true } }), // นับเฉพาะที่ active
    prisma.location.count({ where: { deleteReason: null, isActive: false } }), // นับเฉพาะที่ inactive
    prisma.location.count({ where: { deleteReason: { not: null } } }), // นับเฉพาะที่ถูกลบ
    prisma.location.groupBy({ // รวมกลุ่มตามประเภทสถานที่
      by: ['locationType'], // key สำหรับ group
      where: { deleteReason: null }, // เฉพาะที่ยังไม่ถูกลบ
      _count: true, // ให้คืนจำนวนในแต่ละกลุ่ม
    }), // จบ groupBy
  ]); // จบ Promise.all

  const byType = byTypeRaw.map((item) => ({ // แปลงผลลัพธ์ให้เป็นรูปแบบที่อ่านง่าย
    type: item.locationType, // ประเภทสถานที่
    count: item._count, // จำนวนในประเภทนั้น
  })); // จบการ map

  return { // ส่งผลลัพธ์สถิติรวม
    totalLocations, // จำนวนทั้งหมด
    activeLocations, // จำนวน active
    inactiveLocations, // จำนวน inactive
    deletedLocations, // จำนวนที่ถูกลบ
    byType, // จำนวนตามประเภท
  }; // จบผลลัพธ์
} // จบ getLocationStatistics

// ========================================================================================
// EXPORTS - แยก exports เป็น 2 กลุ่มตามหน้าที่
// ========================================================================================

/**
 * User Actions - ใช้โดยผู้ใช้ทั่วไป
 */
export const LocationUserActions = { // รวมฟังก์ชันสำหรับผู้ใช้ทั่วไป
  createLocation, // สร้างสถานที่
  getAllLocations, // ดึงรายการสถานที่
  getLocationById, // ดึงสถานที่ตาม id
  getNearbyLocations, // ค้นหาสถานที่ใกล้เคียง
}; // จบกลุ่ม LocationUserActions

/**
 * Admin Actions - ใช้โดยผู้จัดการ/แอดมิน
 */
export const LocationAdminActions = { // รวมฟังก์ชันสำหรับผู้จัดการ/แอดมิน
  updateLocation, // แก้ไขสถานที่
  deleteLocation, // ลบสถานที่แบบ soft delete
  restoreLocation, // กู้คืนสถานที่
  getLocationStatistics, // สถิติการใช้งานสถานที่
}; // จบกลุ่ม LocationAdminActions
