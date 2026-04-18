import { prisma } from '../lib/prisma.js';
import type { Role } from '@prisma/client';
import { generateExcel } from '../utils/excel.generator.js';
import { generatePDF } from '../utils/pdf.generator.js';
import { toThaiIso } from '../utils/timezone.js';

/**
 * 📥 DownloadService - บริหารจัดการดาวน์โหลดเอกสาร
 * 
 * ทำไมมีไฟล์นี้?
 * - เพื่อรวมลอจิกดาวน์โหลด (อาจดาวน์โหลด attendance หรือ shift)
 * - เพื่อตรวจสอบสิทธิ์ก่อนให้ดาวน์โหลด (ADMIN ดูแค่สาขาตัวเอง, SUPERADMIN ดูหมด)
 * - เพื่อบันทึก audit log ว่าใครดาวน์โหลดเมื่อไร
 */

export interface User {
  userId: number;
  employeeId: string;
  role: Role;
  branchId?: number;
}

export interface DownloadQuery {
  type: 'attendance' | 'shift';
  format: 'excel';
  startDate?: Date;
  endDate?: Date;
  branchId?: number;
}

/**
 * ดาวน์โหลดรายงาน (ตรวจสิทธิ์ตามบทบาท)
 * 
 * ทำไมต้องตรวจสิทธิ์?
 * - Admin ต้องดูแค่สาขาตัวเอง (ความเป็นส่วนตัว/ความปลอดภัย)
 * - SuperAdmin ดูได้ทั้งองค์กร
 * 
 * SQL ที่ใช้:
 * - SELECT * FROM attendance WHERE branchId = ? AND checkIn >= ? AND checkIn <= ?
 * - SELECT * FROM shift WHERE branchId = ? AND ...
 */
export async function downloadReport(
  user: User,
  query: DownloadQuery
): Promise<{
  buffer: Buffer;
  fileName: string;
  mimeType: string;
}> {
  const { type, format, startDate, endDate } = query;

  // เลือก branchId ตามสิทธิ์ (SuperAdmin สามารถเลือก branch อื่นได้)
  const branchId = user.role === 'SUPERADMIN' ? query.branchId : user.branchId;

  // ป้องกันไม่ให้ Admin ลองเข้าถึง branch อื่น
  if (user.role === 'ADMIN' && query.branchId && query.branchId !== user.branchId) {
    throw new Error('Unauthorized: You can only download your own branch data');
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
 * ดาวน์โหลดรายงาน Attendance (ประวัติเข้า-ออกงาน)
 * 
 * ทำไมต้องมีฟังก์ชันนี้?
 * - เนื่องจากข้อมูล attendance อาจมีหลากหลายสถานะ (ON_TIME, LATE, ABSENT)
 * - ต้องจัดรูปแบบข้อมูลให้อ่านง่ายสำหรับ Excel/PDF
 * - ต้องตรวจสอบบทบาทก่อนดึงข้อมูล
 * 
 * SQL ที่ใช้ (Prisma.findMany):
 * SELECT a.*, u.employeeId, u.firstName, u.lastName
 * FROM attendance a
 * JOIN user u ON a.userId = u.userId
 * WHERE u.branchId = ? AND a.checkIn >= ? AND a.checkIn <= ?
 * ORDER BY a.checkIn DESC
 * LIMIT 100;
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
    // ดึงข้อมูล attendance จะรวมข้อมูล user (employeeId, firstName, lastName)
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
      take: 100, // จำกัดเพื่อป้องกันข้อมูลจำนวนมากทำให้ระบบช้า
    });

    console.log(`✓ Found ${attendances.length} attendance records`);

    // จัดรูปแบบข้อมูลให้เป็นตารางที่เม่าเอกสาร (Excel/PDF)
    const data: Record<string, unknown>[] = attendances.map((att) => ({
      'Employee ID': att.user.employeeId,
      'Name': `${att.user.firstName} ${att.user.lastName}`,
      'Check In': toThaiIso(att.checkIn)?.slice(0, 19).replace('T', ' ') ?? '-',
      'Check Out': att.checkOut ? (toThaiIso(att.checkOut)?.slice(0, 19).replace('T', ' ') ?? '-') : 'Not yet',
      'Status': att.status,
      'Late Minutes': att.lateMinutes || '-',
      'Type': att.eventId ? 'Event (กิจกรรม)' : 'Shift (กะงาน)',
      'Note': att.note || '-',
    }));

    const fileName = `attendance_${new Date().getTime()}.${format === 'excel' ? 'xlsx' : 'pdf'}`;

    console.log(`📝 Generating ${format} file with ${data.length} rows...`);
    let buffer: Buffer;

    if (format === 'excel') {
      buffer = await generateExcel({
        fileName,
        sheetName: 'Attendance Report',
        title: 'Attendance Report',
        columns:  [
          { header: 'Employee ID', key: 'Employee ID', width: 12 },
          { header: 'Name', key: 'Name', width: 20 },
          { header: 'Check In', key: 'Check In', width: 18 },
          { header: 'Check Out', key: 'Check Out', width: 18 },
          { header: 'Status', key: 'Status', width: 12 },
          { header: 'Late Minutes', key: 'Late Minutes', width: 12 },
          { header: 'Type', key: 'Type', width: 15 },
          { header: 'Note', key: 'Note', width: 30 },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
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
          'Type',
          'Note',
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
        isDeleted: false,
        OR: [
          { customDate: null },
          {
            customDate: {
              gte: startDate || new Date(new Date().getFullYear(), 0, 1),
              lte: endDate || new Date(),
            },
          },
        ],
      }, // Limit for faster query
    });

    console.log(`✓ Found ${shifts.length} shift records`);

    // แปลงข้อมูลให้พร้อม export
    const data: Record<string, unknown>[] = shifts.map((shift) => ({
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

// ── Preview Types ──────────────────────────────────────────────────────────

export interface PreviewResult {
  columns: string[];
  rows: Record<string, unknown>[];
  total: number;
}

export interface PreviewQuery {
  type: 'attendance' | 'shift';
  startDate?: Date;
  endDate?: Date;
  branchId?: number;
}

/**
 * ดึงข้อมูลตัวอย่างก่อนดาวน์โหลด (ไม่สร้างไฟล์)
 */
export async function previewReport(
  user: User,
  query: PreviewQuery
): Promise<PreviewResult> {
  const { type, startDate, endDate } = query;
  const branchId = user.role === 'SUPERADMIN' ? query.branchId : user.branchId;

  if (user.role === 'ADMIN' && query.branchId && query.branchId !== user.branchId) {
    throw new Error('Unauthorized: You can only preview your own branch data');
  }

  if (type === 'attendance') {
    const attendances = await prisma.attendance.findMany({
      where: {
        user: branchId ? { branchId } : {},
        checkIn: {
          gte: startDate || new Date(new Date().getFullYear(), 0, 1),
          lte: endDate || new Date(),
        },
      },
      include: {
        user: { select: { employeeId: true, firstName: true, lastName: true } },
      },
      orderBy: { checkIn: 'desc' },
      take: 20,
    });

    const rows = attendances.map((att) => ({
      'Employee ID': att.user.employeeId,
      'Name': `${att.user.firstName} ${att.user.lastName}`,
      'Check In': toThaiIso(att.checkIn)?.slice(0, 19).replace('T', ' ') ?? '-',
      'Check Out': att.checkOut ? (toThaiIso(att.checkOut)?.slice(0, 19).replace('T', ' ') ?? '-') : 'ยังไม่ออก',
      'Status': att.status,
      'Late Minutes': att.lateMinutes ?? '-',
      'Type': att.eventId ? 'Event (กิจกรรม)' : 'Shift (กะงาน)',
      'Note': att.note || '-',
    }));

    return {
      columns: ['Employee ID', 'Name', 'Check In', 'Check Out', 'Status', 'Late Minutes', 'Type', 'Note'],
      rows,
      total: rows.length,
    };
  }

  // shift
  const shifts = await prisma.shift.findMany({
    where: {
      user: branchId ? { branchId } : {},
      isDeleted: false,
      OR: [
        { customDate: null },
        {
          customDate: {
            gte: startDate || new Date(new Date().getFullYear(), 0, 1),
            lte: endDate || new Date(),
          },
        },
      ],
    },
    include: {
      user: { select: { employeeId: true, firstName: true, lastName: true } },
    },
    orderBy: { shiftId: 'desc' },
    take: 20,
  });

  const rows = shifts.map((shift) => ({
    'Employee ID': shift.user.employeeId,
    'Name': `${shift.user.firstName} ${shift.user.lastName}`,
    'Shift Name': shift.name,
    'Shift Type': shift.shiftType,
    'Start Time': shift.startTime,
    'End Time': shift.endTime,
    'Active': shift.isActive ? 'Yes' : 'No',
  }));

  return {
    columns: ['Employee ID', 'Name', 'Shift Name', 'Shift Type', 'Start Time', 'End Time', 'Active'],
    rows,
    total: rows.length,
  };
}

