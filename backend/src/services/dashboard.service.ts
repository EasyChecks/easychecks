import { prisma } from '../lib/prisma.js';
import type { Role } from '@prisma/client';

/**
 * 📊 DashboardService - บริหารข้อมูลสำหรับหน้า Admin Dashboard
 * 
 * ทำไมมีไฟล์นี้?
 * - เพื่อรวบรวมข้อมูลหลากหลาย (attendance, employees, branches, events) ไว้ที่เดียว
 * - เพื่อตรวจสอบสิทธิ์ ADMIN/SUPERADMIN ก่อนแสดง
 * - เพื่อจัดรูปแบบข้อมูลให้สามารถ render ตัวแผนภูมิได้
 */

export interface User {
  userId: number;
  employeeId: string;
  role: Role;
  branchId?: number;
}

/**
 * ดึง Attendance Summary (สำหรับแสดง Donut Chart)
 * 
 * ทำไมต้องแยก function นี้?
 * - Graph ต้องการเพียง 4 ตัวเลข (On-Time, Late, Absent, Total) ไม่ต้องข้อมูลรายละเอียด
 * - การจัด query ที่กำหนดเป้าหมายทำให้ db ทำงานเร็วกว่า
 * 
 * SQL ที่ใช้:
 * SELECT 
 *   status,
 *   COUNT(*) as count
 * FROM attendance
 * WHERE branchId = ? AND DATE(checkIn) = TODAY()
 * GROUP BY status;
 */
export async function getAttendanceSummary(user: User, branchId?: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // เลือก branch ตามสิทธิ์ (SUPERADMIN สามารถเลือก branch อื่นได้)
  const queryBranchId = user.role === 'SUPERADMIN' ? branchId : user.branchId;

  const attendances = await prisma.attendance.findMany({
    where: {
      user: {
        branchId: queryBranchId,
      },
      checkIn: {
        gte: today,
        lt: tomorrow,
      },
    },
    include: {
      user: {
        select: {
          branchId: true,
        },
      },
    },
  });

  // นับจำนวนตามสถานะ (เพื่อให้ Donut chart มี component แต่ละส่วน)
  const summary = {
    onTime: 0,
    late: 0,
    absent: 0,
    total: attendances.length,
  };

  attendances.forEach((att) => {
    if (att.status === 'ON_TIME') summary.onTime++;
    else if (att.status === 'LATE') summary.late++;
    else if (att.status === 'ABSENT') summary.absent++;
  });

  return summary;
}

/**
 * ดึงข้อมูลพนักงานวันนี้ (พร้อมสถานะ Check-in/Check-out)
 * 
 * ทำไมต้องแยก function นี้?
 * - Admin ต้องเห็นรายชื่อพนักงานและสถานะ (มาแล้วไหม, มาสาย, ขาด) แบบรายบุคคล
 * - ต้องดึงข้อมูลที่นำเสนอง่ายต่อการอ่าน (ชื่อ, เวลาเข้า-ออก, สถานะ)
 * 
 * SQL ที่ใช้:
 * SELECT 
 *   employeeId, firstName, lastName, branchName, 
 *   status, checkIn, checkOut, lateMinutes
 * FROM attendance a
 * JOIN user u ON a.userId = u.userId
 * JOIN branch b ON u.branchId = b.branchId
 * WHERE u.branchId = ? AND DATE(a.checkIn) = TODAY()
 * ORDER BY a.checkIn DESC;
 */
export async function getEmployeesToday(user: User, branchId?: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const queryBranchId = user.role === 'SUPERADMIN' ? branchId : user.branchId;

  const attendances = await prisma.attendance.findMany({
    where: {
      user: {
        branchId: queryBranchId,
      },
      checkIn: {
        gte: today,
        lt: tomorrow,
      },
    },
    include: {
      user: {
        select: {
          userId: true,
          employeeId: true,
          firstName: true,
          lastName: true,
          branch: {
            select: {
              branchId: true,
              name: true,
            },
          },
        },
      },
    },
    orderBy: {
      checkIn: 'desc',
    },
  });

  return attendances.map((att) => ({
    employeeId: att.user.employeeId,
    name: `${att.user.firstName} ${att.user.lastName}`,
    branch: att.user.branch?.name || 'N/A',
    status: att.status,
    checkIn: att.checkIn.toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }),
    checkOut: att.checkOut
      ? att.checkOut.toLocaleTimeString('th-TH', {
          hour: '2-digit',
          minute: '2-digit',
          hour12: false,
        })
      : null,
    lateMinutes: att.lateMinutes || 0,
  }));
}

/**
 * ดึงข้อมูลสาขาสำหรับแสดง Map Pins
 * 
 * ทำไมต้องแยก function นี้?
 * - Admin ต้องเห็นเฉพาะสาขาตัวเอง (ความเป็นส่วนตัว)
 * - SuperAdmin ต้องเห็นทุกสาขาของบริษัท
 * - ต้องนับจำนวนพนักงานในแต่ละสาขา (แสดงในแผนที่ว่ามีคนกี่คน)
 * 
 * SQL ที่ใช้ (SUPERADMIN):
 * SELECT b.branchId, b.name, b.latitude, b.longitude, COUNT(u.userId) as totalEmployees
 * FROM branch b
 * LEFT JOIN user u ON b.branchId = u.branchId
 * GROUP BY b.branchId;
 * 
 * SQL ที่ใช้ (ADMIN):
 * SELECT ... WHERE b.branchId = ?;
 */
export async function getBranchesMap(user: User) {
  let branches;

  if (user.role === 'SUPERADMIN') {
    // SuperAdmin เห็นทุกสาขา
    branches = await prisma.branch.findMany({
      include: {
        _count: {
          select: { users: true },
        },
      },
    });
  } else {
    // Admin: เห็นเฉพาะสาขาตัวเอง
    branches = await prisma.branch.findMany({
      where: {
        branchId: user.branchId,
      },
      include: {
        _count: {
          select: { users: true },
        },
      },
    });
  }

  return branches.map((branch) => ({
    branchId: branch.branchId,
    name: branch.name,
    latitude: branch.latitude,
    longitude: branch.longitude,
    totalEmployees: branch._count.users,
    address: branch.address || '',
  }));
}

/**
 * ดึงเหตุการณ์ที่ Check-in นอกพื้นที่ (Location Events)
 * 
 * ทำไมต้องแยก function นี้?
 * - Admin ต้องเห็นพนักงานที่ check-in นอกพื้นที่ (ตรวจสอบความผิดปกติ/ความปลอดภัย)
 * - ต้องและนวนอพนักงานที่มี locationId และระยะห่างจากพื้นที่กำหนด
 * 
 * SQL ที่ใช้:
 * SELECT 
 *   a.attendanceId, u.firstName, u.lastName, a.checkIn, 
 *   l.locationName, a.checkInDistance, l.radius
 * FROM attendance a
 * WHERE a.locationId IS NOT NULL 
 *   AND a.checkInDistance > l.radius 
 *   AND u.branchId = ?
 *   AND DATE(a.checkIn) = TODAY();
 */
export async function getLocationEvents(user: User, branchId?: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const queryBranchId = user.role === 'SUPERADMIN' ? branchId : user.branchId;

  // ดึง attendance ที่มี location assigned และนำมา filter check distance
  const attendances = await prisma.attendance.findMany({
    where: {
      user: {
        branchId: queryBranchId,
      },
      checkIn: {
        gte: today,
        lt: tomorrow,
      },
      location: {
        isNot: null,
      },
    },
    include: {
      user: {
        select: {
          employeeId: true,
          firstName: true,
          lastName: true,
        },
      },
      location: true,
    },
  });

  // กรอง เหลือเพียงพนักงานที่ check-in นอកพื้นที่ (ระยะห่าง > radius)
  const outsideEvents = attendances
    .filter((att) => att.checkInDistance! > (att.location?.radius || 0))
    .map((att) => ({
      eventId: att.attendanceId,
      employeeName: `${att.user.firstName} ${att.user.lastName}`,
      checkInTime: att.checkIn.toLocaleTimeString('th-TH', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
      }),
      expectedLocation: att.location?.name || 'Unknown',
      actualDistance: Math.round(att.checkInDistance || 0),
      allowedRadius: att.location?.radius || 0,
      timestamp: att.checkIn,
    }));

  return outsideEvents;
}

/**
 * ดึงสถิติสาขา (Branch Statistics)
 * 
 * ทำไมต้องแยก function นี้?
 * - Admin ต้องเห็นอัตราการมาของพนักงาน (Overall) ในสาขาตัวเอง
 * - ต้อง focus ที่จำนวนคนมาแล้ว vs ทั้งหมด (เป็น percentage)
 * 
 * SQL ที่ใช้:
 * SELECT 
 *   b.branchId, b.name, 
 *   COUNT(DISTINCT u.userId) as totalEmployees,
 *   SUM(CASE WHEN a.status = 'ON_TIME' THEN 1 ELSE 0 END) as presentToday,
 *   SUM(CASE WHEN a.status = 'LATE' THEN 1 ELSE 0 END) as lateToday,
 *   SUM(CASE WHEN a.status = 'ABSENT' THEN 1 ELSE 0 END) as absentToday,
 *   (presentToday / totalEmployees * 100) as attendanceRate
 * FROM branch b
 * LEFT JOIN user u ON b.branchId = u.branchId
 * LEFT JOIN attendance a ON u.userId = a.userId AND DATE(a.checkIn) = TODAY()
 * WHERE b.branchId = ?
 * GROUP BY b.branchId;
 */
export async function getBranchStats(user: User, branchId?: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const queryBranchId = user.role === 'SUPERADMIN' ? branchId : user.branchId;

  // ดึงข้อมูลเฉพาะของ branch (ชื่อ, ที่อยู่, จำนวนพนักงาน)
  const branch = await prisma.branch.findUnique({
    where: { branchId: queryBranchId },
    include: {
      _count: {
        select: { users: true },
      },
    },
  });

  if (!branch) {
    throw new Error('Branch not found');
  }

  // ดึง attendance วันนี้
  const attendances = await prisma.attendance.findMany({
    where: {
      user: {
        branchId: queryBranchId,
      },
      checkIn: {
        gte: today,
        lt: tomorrow,
      },
    },
  });

  const stats = {
    branchId: branch.branchId,
    name: branch.name,
    totalEmployees: branch._count.users,
    presentToday: attendances.filter((a) => a.status === 'ON_TIME').length,
    lateToday: attendances.filter((a) => a.status === 'LATE').length,
    absentToday: attendances.filter((a) => a.status === 'ABSENT').length,
    attendanceRate:
      branch._count.users > 0
        ? Math.round(
            ((attendances.length / branch._count.users) * 100 * 100) / 100
          )
        : 0,
  };

  return stats;
}

export const dashboardService = {
  getAttendanceSummary,
  getEmployeesToday,
  getBranchesMap,
  getLocationEvents,
  getBranchStats,
};

export default dashboardService;
