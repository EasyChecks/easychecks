import { prisma } from '../lib/prisma.js';
import { Prisma, type Role } from '@prisma/client';
import { generateExcel } from '../utils/excel.generator.js';
import { generatePDF } from '../utils/pdf.generator.js';
import { toThaiIso } from '../utils/timezone.js';

const statusMap: Record<string, string> = {
  'ON_TIME': 'ตรงเวลา',
  'LATE': 'สาย',
  'ABSENT': 'ขาดงาน',
  'LEAVE': 'ลา',
  'LEAVE_APPROVED': 'ลา (อนุมัติแล้ว)',
  'NOT_CHECKED_IN': 'ยังไม่เข้างาน',
};

const formatLateTime = (minutes: number | null | undefined): string => {
  if (!minutes) return '-';
  if (minutes < 60) return `${minutes} นาที`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours} ชม. ${mins} นาที` : `${hours} ชม.`;
};

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
  type: 'attendance';
  format: 'excel' | 'pdf';
  startDate?: Date;
  endDate?: Date;
  branchId?: number;
  filterType?: 'all' | 'shift' | 'event';
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

  ({ buffer, fileName } = await downloadAttendanceReport(
    user,
    format,
    startDate,
    endDate,
    branchId,
    query.filterType
  ));

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
  branchId?: number,
  filterType?: 'all' | 'shift' | 'event'
): Promise<{ buffer: Buffer; fileName: string }> {
  console.log('📊 Fetching attendance data...');
  
  try {
    // สร้าง where condition อย่างชัดเจน
    const whereCondition: Prisma.AttendanceWhereInput = {
      user: branchId
        ? { branchId }
        : user.role === 'ADMIN'
          ? { branchId: user.branchId }
          : {},
      checkIn: {
        gte: startDate || new Date(new Date().getFullYear(), 0, 1),
        lte: endDate || new Date(),
      },
    };

    // ดึงข้อมูล attendance จะรวมข้อมูล user (employeeId, firstName, lastName)
    const attendances = await prisma.attendance.findMany({
      where: whereCondition,
      include: {
        user: {
          select: {
            employeeId: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { checkIn: 'asc' },
    });

    console.log(`✓ Found ${attendances.length} attendance records`);

    // จัดรูปแบบข้อมูลให้เป็นตารางที่เม่าเอกสาร (Excel/PDF)
    const data: Record<string, unknown>[] = attendances.map((att) => ({
      'รหัสพนักงาน': att.user?.employeeId ?? '-',
      'ชื่อ-นามสกุล': att.user ? `${att.user.firstName} ${att.user.lastName}` : 'ไม่พบข้อมูลพนักงาน',
      'เวลาเข้างาน': toThaiIso(att.checkIn)?.slice(0, 19).replace('T', ' ') ?? '-',
      'เวลาออกงาน': att.checkOut ? (toThaiIso(att.checkOut)?.slice(0, 19).replace('T', ' ') ?? '-') : 'Not yet',
      'สาย (นาที/ชั่วโมง)': formatLateTime(att.lateMinutes),
      'สถานะ': statusMap[att.status] || att.status,
      'ประเภท': att.eventId ? 'Event (กิจกรรม)' : 'Shift (กะงาน)',
      'หมายเหตุ': att.note || '-',
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
          { header: 'รหัสพนักงาน', key: 'รหัสพนักงาน', width: 14 },
          { header: 'ชื่อ-นามสกุล', key: 'ชื่อ-นามสกุล', width: 22 },
          { header: 'เวลาเข้างาน', key: 'เวลาเข้างาน', width: 18 },
          { header: 'เวลาออกงาน', key: 'เวลาออกงาน', width: 18 },
          { header: 'สาย (นาที/ชั่วโมง)', key: 'สาย (นาที/ชั่วโมง)', width: 18 },
          { header: 'สถานะ', key: 'สถานะ', width: 16 },
          { header: 'ประเภท', key: 'ประเภท', width: 18 },
          { header: 'หมายเหตุ', key: 'หมายเหตุ', width: 30 },
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ] as any,
        data,
      });
    } else {
      buffer = await generatePDF({
        title: 'Attendance Report',
        fileName,
        columns: [
          'รหัสพนักงาน',
          'ชื่อ-นามสกุล',
          'เวลาเข้างาน',
          'เวลาออกงาน',
          'สาย (นาที/ชั่วโมง)',
          'สถานะ',
          'ประเภท',
          'หมายเหตุ',
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

// ── Preview Types ──────────────────────────────────────────────────────────

export interface PreviewResult {
  columns: string[];
  rows: Record<string, unknown>[];
  total: number;
}

export interface PreviewQuery {
  type: 'attendance';
  startDate?: Date;
  endDate?: Date;
  branchId?: number;
  filterType?: 'all' | 'shift' | 'event';
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
    // สร้าง where condition อย่างชัดเจน
    const previewWhere: Prisma.AttendanceWhereInput = {
      user: branchId ? { branchId } : {},
      checkIn: {
        gte: startDate || new Date(new Date().getFullYear(), 0, 1),
        lte: endDate || new Date(),
      },
    };

    const attendances = await prisma.attendance.findMany({
      where: previewWhere,
      include: {
        user: { select: { employeeId: true, firstName: true, lastName: true } },
      },
      orderBy: { checkIn: 'asc' },
      take: 20,
    });

    const rows = attendances.map((att) => ({
      'รหัสพนักงาน': att.user?.employeeId ?? '-',
      'ชื่อ-นามสกุล': att.user ? `${att.user.firstName} ${att.user.lastName}` : 'ไม่พบข้อมูลพนักงาน',
      'เวลาเข้างาน': toThaiIso(att.checkIn)?.slice(0, 19).replace('T', ' ') ?? '-',
      'เวลาออกงาน': att.checkOut ? (toThaiIso(att.checkOut)?.slice(0, 19).replace('T', ' ') ?? '-') : 'ยังไม่ออก',
      'สาย (นาที/ชั่วโมง)': formatLateTime(att.lateMinutes),
      'สถานะ': statusMap[att.status] || att.status,
      'ประเภท': att.eventId ? 'Event (กิจกรรม)' : 'Shift (กะงาน)',
      'หมายเหตุ': att.note || '-',
    }));

    return {
      columns: ['รหัสพนักงาน', 'ชื่อ-นามสกุล', 'เวลาเข้างาน', 'เวลาออกงาน', 'สาย (นาที/ชั่วโมง)', 'สถานะ', 'ประเภท', 'หมายเหตุ'],
      rows,
      total: rows.length,
    };
  }
}

