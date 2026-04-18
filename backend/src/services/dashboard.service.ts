import { prisma } from '../lib/prisma.js';
import type { Role } from '@prisma/client';

/**
 * คำนวณ start/end ของวันใน timezone Asia/Bangkok
 * - date = "YYYY-MM-DD" ในเวลาไทย
 * - ไม่ระบุ date → ใช้วันปัจจุบันในไทย
 */
function getBangkokDayRange(date?: string): { start: Date; end: Date } {
  const dateStr = date ?? new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Bangkok' }).format(new Date());
  const start = new Date(`${dateStr}T00:00:00+07:00`);
  const end = new Date(start.getTime() + 24 * 60 * 60 * 1000);
  return { start, end };
}

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
export async function getAttendanceSummary(user: User, branchId?: number, date?: string) {
  const { start: today, end: tomorrow } = getBangkokDayRange(date);

  // เลือก branch ตามสิทธิ์ (SUPERADMIN สามารถเลือก branch อื่นได้)
  const queryBranchId = user.role === 'SUPERADMIN' ? branchId : user.branchId;

  // ดึง attendance records วันนี้
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

  // ดึงจำนวนพนักงานที่ลาอนุมัติแล้ววันนี้ (จาก LeaveRequest table)
  const leaveCount = await prisma.leaveRequest.count({
    where: {
      status: 'APPROVED',
      startDate: { lte: today },
      endDate: { gte: today },
      user: {
        branchId: queryBranchId,
      },
    },
  });

  // นับจำนวนตามสถานะ (เพื่อให้ Donut chart มี component แต่ละส่วน)
  const summary = {
    onTime: 0,
    late: 0,
    absent: 0,
    leave: leaveCount,
    total: attendances.length + leaveCount,
  };

  attendances.forEach((att) => {
    if (att.status === 'ON_TIME' || att.status === 'LEAVE_APPROVED') summary.onTime++;
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
export async function getEmployeesToday(user: User, branchId?: number, date?: string) {
  const { start: today, end: tomorrow } = getBangkokDayRange(date);

  const queryBranchId = user.role === 'SUPERADMIN' ? branchId : user.branchId;

  // ดึง attendance records วันนี้
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

  // ดึงพนักงานที่ลาอนุมัติแล้ววันนี้ (จาก LeaveRequest table)
  const approvedLeaves = await prisma.leaveRequest.findMany({
    where: {
      status: 'APPROVED',
      startDate: { lte: today },
      endDate: { gte: today },
      user: {
        branchId: queryBranchId,
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
  });

  // รวมข้อมูล attendance + leave
  const attendanceRows = attendances.map((att) => ({
    employeeId: att.user.employeeId,
    name: `${att.user.firstName} ${att.user.lastName}`,
    branch: att.user.branch?.name || 'N/A',
    status: att.status,
    checkIn: att.checkIn.toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone: 'Asia/Bangkok',
    }),
    checkOut: att.checkOut
      ? att.checkOut.toLocaleTimeString('th-TH', {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
        timeZone: 'Asia/Bangkok',
      })
      : null,
    lateMinutes: att.lateMinutes || 0,
    eventId: att.eventId ?? null,
  }));

  // เอา userId ที่มี attendance แล้วไม่ต้องซ้ำ
  const attendedUserIds = new Set(attendances.map(a => a.user.userId));

  const leaveRows = approvedLeaves
    .filter(lr => !attendedUserIds.has(lr.user.userId))
    .map((lr) => ({
      employeeId: lr.user.employeeId,
      name: `${lr.user.firstName} ${lr.user.lastName}`,
      branch: lr.user.branch?.name || 'N/A',
      status: 'LEAVE' as const,
      checkIn: null,
      checkOut: null,
      lateMinutes: 0,
    }));

  return [...attendanceRows, ...leaveRows];
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
export async function getLocationEvents(user: User, branchId?: number, date?: string) {
  const { start: today, end: tomorrow } = getBangkokDayRange(date);

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
        timeZone: 'Asia/Bangkok',
      }),
      expectedLocation: att.location?.locationName || 'Unknown',
      actualDistance: Math.round(att.checkInDistance || 0),
      allowedRadius: att.location?.radius || 0,
      timestamp: att.checkIn,
    }));

  return outsideEvents;
}

/**
 * GET /api/dashboard/event-stats/:eventId
 * ดึงสถิติการเข้าร่วมกิจกรรม per-event
 * - participantType = ALL  → แสดงแค่คนที่เข้าร่วมแล้ว (isOpenEvent = true)
 * - participantType != ALL → มี participant list ให้เปรียบเทียบ (isOpenEvent = false)
 */
export async function getEventStats(user: User, eventId: number) {
  const event = await prisma.event.findUnique({
    where: { eventId },
    include: {
      event_participants: {
        include: {
          users: {
            select: { userId: true, employeeId: true, firstName: true, lastName: true },
          },
          branches: {
            include: {
              users: {
                select: { userId: true, employeeId: true, firstName: true, lastName: true },
              },
            },
          },
        },
      },
      attendance: {
        include: {
          user: {
            select: {
              userId: true,
              employeeId: true,
              firstName: true,
              lastName: true,
              branchId: true,
              branch: { select: { name: true } },
            },
          },
        },
      },
    },
  });

  if (!event) throw new Error('ไม่พบกิจกรรม');

  // ADMIN เห็นแค่ branch ตัวเอง (กรอง attendance)
  const filteredAttendance = user.role === 'ADMIN'
    ? event.attendance.filter((att) => att.user.branchId === user.branchId)
    : event.attendance;

  const joined = filteredAttendance.map((att) => ({
    userId: att.user.userId,
    employeeId: att.user.employeeId,
    name: `${att.user.firstName} ${att.user.lastName}`,
    branch: att.user.branch?.name || 'N/A',
    checkIn: att.checkIn.toLocaleTimeString('th-TH', {
      hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Asia/Bangkok',
    }),
    status: att.status,
  }));

  const isOpenEvent = event.participantType === 'ALL';

  if (isOpenEvent) {
    return {
      eventId: event.eventId,
      eventName: event.eventName,
      participantType: event.participantType,
      isOpenEvent: true,
      joined,
      notJoined: [] as typeof joined,
      joinedCount: joined.length,
      notJoinedCount: 0,
    };
  }

  // สร้าง participant map จาก EventParticipant (user หรือ branch)
  const participantMap = new Map<number, { userId: number; employeeId: string; name: string; branch: string }>();

  for (const p of event.event_participants) {
    if (p.users) {
      participantMap.set(p.users.userId, {
        userId: p.users.userId,
        employeeId: p.users.employeeId,
        name: `${p.users.firstName} ${p.users.lastName}`,
        branch: '',
      });
    }
    if (p.branches) {
      for (const u of p.branches.users) {
        participantMap.set(u.userId, {
          userId: u.userId,
          employeeId: u.employeeId,
          name: `${u.firstName} ${u.lastName}`,
          branch: p.branches.name ?? '',
        });
      }
    }
  }

  const joinedUserIds = new Set(joined.map((j) => j.userId));
  const notJoined = Array.from(participantMap.values()).filter((p) => !joinedUserIds.has(p.userId));

  return {
    eventId: event.eventId,
    eventName: event.eventName,
    participantType: event.participantType,
    isOpenEvent: false,
    joined,
    notJoined,
    joinedCount: joined.length,
    notJoinedCount: notJoined.length,
  };
}

export const dashboardService = {
  getAttendanceSummary,
  getEmployeesToday,
  getBranchesMap,
  getLocationEvents,
  getEventStats,
};

export default dashboardService;
