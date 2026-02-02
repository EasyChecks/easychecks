import { prisma } from '../lib/prisma.js';
import type { User as PrismaUser, Role } from '@prisma/client';
import { generateExcel } from '../utils/excel.generator.js';
import { generatePDF } from '../utils/pdf.generator.js';

/**
 * 📥 Download Service
 * จัดการ Logic ดาวน์โหลดเอกสาร
 */

export interface User {
  userId: number;
  employeeId: string;
  role: Role;
  branchId: number | undefined;
}

export interface DownloadQuery {
  type: 'attendance' | 'shift'; // ประเภทรายงาน
  format: 'excel' | 'pdf'; // รูปแบบไฟล์
  startDate?: Date;
  endDate?: Date;
  branchId?: number; // สำหรับ admin (filter by branch)
}

/**
 * ดาวน์โหลดรายงาน (พิจารณา Role)
 */
export async function downloadReport(
  user: User,
  query: any
): Promise<{
  buffer: Buffer;
  fileName: string;
  mimeType: string;
}> {
  const { type, format, startDate, endDate } = query;

  // ตรวจสอบสิทธิ์ตามบทบาท
  const branchId = user.role === 'SUPERADMIN' ? query.branchId : user.branchId;

  if (user.role === 'ADMIN' && query.branchId && query.branchId !== user.branchId) {
    throw new Error('Unauthorized: Admin can only download their own branch data');
  }

  let fileName = '';
  let buffer: Buffer;

  switch (type) {
    case 'attendance':
      ({ buffer, fileName } = await downloadAttendanceReport(
        user,
        format,
        startDate,
        endDate,
        branchId
      ));
      break;

    case 'shift':
      ({ buffer, fileName } = await downloadShiftReport(
        user,
        format,
        startDate,
        endDate,
        branchId
      ));
      break;

    default:
      throw new Error('Invalid report type');
  }

  // บันทึก log
  await logDownload(user.userId, fileName, type);

  return {
    buffer,
    fileName,
    mimeType:
      format === 'excel'
        ? 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        : 'application/pdf',
  };
}

/**
 * ดาวน์โหลดรายงาน Attendance
 */
async function downloadAttendanceReport(
  user: User,
  format: string,
  startDate?: Date,
  endDate?: Date,
  branchId?: number
): Promise<{ buffer: Buffer; fileName: string }> {
  console.log('📊 Fetching attendance data...');
  
  try {
    // Query data - simplified without unnecessary relations
    const attendances = await prisma.attendance.findMany({
      where: {
        user: branchId
          ? { branchId }
          : user.role === 'ADMIN'
          ? { branchId: user.branchId }
          : {},
        checkIn: {
          gte: startDate || new Date(new Date().getFullYear(), 0, 1),
          lte: endDate || new Date(),
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
      },
      orderBy: { checkIn: 'desc' },
      take: 100, // Reduce limit for faster query
    });

    console.log(`✓ Found ${attendances.length} attendance records`);

    // แปลงข้อมูลให้พร้อม export
    const data = attendances.map((att: any) => ({
      'Employee ID': att.user.employeeId,
      'Name': `${att.user.firstName} ${att.user.lastName}`,
      'Check In': new Date(att.checkIn).toLocaleString('th-TH'),
      'Check Out': att.checkOut ? new Date(att.checkOut).toLocaleString('th-TH') : 'Not yet',
      'Status': att.status,
      'Late Minutes': att.lateMinutes || '-',
    }));

    const fileName = `attendance_${new Date().getTime()}.${format === 'excel' ? 'xlsx' : 'pdf'}`;

    console.log(`📝 Generating ${format} file with ${data.length} rows...`);
    let buffer: Buffer;

    if (format === 'excel') {
      buffer = await generateExcel({
        fileName,
        sheetName: 'Attendance Report',
        title: 'Attendance Report',
        columns: [
          { header: 'Employee ID', key: 'Employee ID', width: 12 },
          { header: 'Name', key: 'Name', width: 20 },
          { header: 'Check In', key: 'Check In', width: 18 },
          { header: 'Check Out', key: 'Check Out', width: 18 },
          { header: 'Status', key: 'Status', width: 12 },
          { header: 'Late Minutes', key: 'Late Minutes', width: 12 },
        ] as any,
        data,
      });
    } else {
      buffer = await generatePDF({
        title: 'Attendance Report',
        fileName,
        columns: [
          'Employee ID',
          'Name',
          'Check In',
          'Check Out',
          'Status',
        ],
        data,
      });
    }

    console.log(`✅ File generated: ${fileName}`);
    return { buffer, fileName };
  } catch (error) {
    console.error('❌ Error in downloadAttendanceReport:', error);
    throw error;
  }
}

/**
 * ดาวน์โหลดรายงาน Shift
 */
async function downloadShiftReport(
  user: User,
  format: string,
  startDate?: Date,
  endDate?: Date,
  branchId?: number
): Promise<{ buffer: Buffer; fileName: string }> {
  console.log('📋 Fetching shift data...');
  
  try {
    // Query data - simplified
    const shifts = await prisma.shift.findMany({
      where: {
        user: branchId
          ? { branchId }
          : user.role === 'ADMIN'
          ? { branchId: user.branchId }
          : {},
        createdAt: {
          gte: startDate || new Date(new Date().getFullYear(), 0, 1),
          lte: endDate || new Date(),
        },
        deletedAt: null,
      },
      include: {
        user: {
          select: {
            employeeId: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 100, // Limit for faster query
    });

    console.log(`✓ Found ${shifts.length} shift records`);

    // แปลงข้อมูลให้พร้อม export
    const data = shifts.map((shift: any) => ({
      'Employee ID': shift.user.employeeId,
      'Name': `${shift.user.firstName} ${shift.user.lastName}`,
      'Shift Name': shift.name,
      'Shift Type': shift.shiftType,
      'Start Time': shift.startTime,
      'End Time': shift.endTime,
      'Active': shift.isActive ? 'Yes' : 'No',
    }));

    const fileName = `shift_${new Date().getTime()}.${format === 'excel' ? 'xlsx' : 'pdf'}`;

    console.log(`📝 Generating ${format} file with ${data.length} rows...`);
    let buffer: Buffer;

    if (format === 'excel') {
      buffer = await generateExcel({
        fileName,
        sheetName: 'Shift Report',
        title: 'Shift Report',
        columns: [
          { header: 'Employee ID', key: 'Employee ID', width: 12 },
          { header: 'Name', key: 'Name', width: 20 },
          { header: 'Shift Name', key: 'Shift Name', width: 15 },
          { header: 'Shift Type', key: 'Shift Type', width: 15 },
          { header: 'Start Time', key: 'Start Time', width: 12 },
          { header: 'End Time', key: 'End Time', width: 12 },
          { header: 'Active', key: 'Active', width: 10 },
        ] as any,
        data,
      });
    } else {
      buffer = await generatePDF({
        title: 'Shift Report',
        fileName,
        columns: [
          'Employee ID',
          'Name',
          'Shift Name',
          'Shift Type',
          'Start Time',
          'End Time',
        ],
        data,
      });
    }

    console.log(`✅ File generated: ${fileName}`);
    return { buffer, fileName };
  } catch (error) {
    console.error('❌ Error in downloadShiftReport:', error);
    throw error;
  }
}

/**
 * บันทึกการดาวน์โหลด
 */
async function logDownload(
  userId: number,
  fileName: string,
  reportType: string
): Promise<void> {
  await prisma.downloadLog.create({
    data: {
      userId,
      fileName,
      reportType,
      downloadAt: new Date(),
    },
  });
}
