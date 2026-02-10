import { prisma } from '../lib/prisma.js';
import type { Role } from '@prisma/client';

/**
 * 📊 Dashboard Service
 * จัดการ Logic สำหรับ Dashboard Admin/SuperAdmin
 */

export interface User {
  userId: number;
  employeeId: string;
  role: Role;
  branchId?: number;
}

/**
 * 1️⃣ ดึง Attendance Summary (Donut Chart)
 * Admin: สาขาตัวเอง
 * SuperAdmin: ทั้งหมดหรือสาขาที่ระบุ
 */
export async function getAttendanceSummary(user: User, branchId?: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // ตรวจสอบ branch
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
 * 2️⃣ ดึงพนักงานวันนี้ พร้อม Status
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
 * 3️⃣ ดึง Branches สำหรับ Map (Pins)
 */
export async function getBranchesMap(user: User) {
  let branches;

  if (user.role === 'SUPERADMIN') {
    // SuperAdmin: เห็นทุกสาขา
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
 * 4️⃣ ดึง Location Events (Check-in Outside Locations)
 * แสดงพนักงานที่ check-in นอกพื้นที่
 */
export async function getLocationEvents(user: User, branchId?: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const queryBranchId = user.role === 'SUPERADMIN' ? branchId : user.branchId;

  // ดึง attendances ที่มี locationId แต่ checkInDistance > radius
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

  // Filter เฉพาะที่อยู่นอกพื้นที่
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
 * 5️⃣ ดึง Branch Statistics
 */
export async function getBranchStats(user: User, branchId?: number) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  const queryBranchId = user.role === 'SUPERADMIN' ? branchId : user.branchId;

  // ดึงข้อมูล branch
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
