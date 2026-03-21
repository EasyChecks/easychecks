import { prisma } from '../lib/prisma.js';

/**
 * 📋 Audit Service — บริการบันทึก Log ทุกการกระทำในระบบ
 *
 * ทำไมต้องมี Audit Log?
 * ─────────────────────────────────────────────────────────────────────
 * ระบบ HR มีข้อมูลที่อ่อนไหว (เงินเดือน, เวลาเข้างาน, การลา)
 * กฎหมาย PDPA และมาตรฐาน ISO 27001 กำหนดให้ต้องสามารถ trace ได้ว่า
 * "ใครทำอะไร กับข้อมูลอะไร เมื่อเวลาใด"
 *
 * ทำไม Audit Log ถึงเป็น Service แยกต่างหาก ไม่ฝังใน Controller?
 * ─────────────────────────────────────────────────────────────────────
 * เพราะทุก service (attendance, shift, user, …) ต้องเรียกใช้
 * ถ้าฝังใน controller จะ duplicate โค้ด ≥ 10 จุด
 * แยกเป็น service → แก้ที่เดียว ใช้ได้ทุกที่ (Single Responsibility)
 *
 * ทำไม Audit Log ถึงไม่มี API endpoint ของตัวเอง?
 * ─────────────────────────────────────────────────────────────────────
 * Audit log เป็น *internal concern* — เรียกใช้ผ่าน service อื่นโดยตรง
 * ไม่มี route สาธารณะ เพราะต้องการป้องกันไม่ให้ client เขียน/แก้ log เองได้
 * ถ้าอนาคตต้องการดู log ผ่าน API → สร้าง dashboard endpoint แยกต่างหาก
 */

// ============================================
// 📦 DTO — รูปแบบข้อมูลที่ createAuditLog รับเข้า
// ============================================

export interface CreateAuditLogDTO {
  userId?: number;      // ผู้กระทำ — optional เพราะ system action (auto-checkout) อาจไม่มี userId
  action: string;       // ชื่อ action เช่น "CHECK_IN" จาก AuditAction constants
  targetTable: string;  // ชื่อตารางที่ถูกกระทำ เช่น "attendance", "shifts"
  targetId: number;                     // primary key ของ record ที่ถูกกระทำ — ใช้ query กลับได้
  oldValues?: Record<string, unknown>;  // snapshot ก่อนเปลี่ยน (undefined สำหรับ CREATE)
  newValues?: Record<string, unknown>;  // snapshot หลังเปลี่ยน (undefined สำหรับ DELETE)
  ipAddress?: string;                   // IP ของ request — ใช้ trace ถ้ามีการโจมตี
  userAgent?: string;   // Browser/App ที่ใช้ — ช่วยแยก bot vs human
}

// ============================================
// 📋 Core Function — บันทึก Audit Log
// ============================================

/**
 * บันทึก Audit Log 1 รายการ
 *
 * ทำไม try-catch แบบ silent (ไม่ re-throw)?
 * ─────────────────────────────────────────────────────────────────────
 * Audit log เป็น "best-effort" — ถ้า log fail ไม่ควรทำให้ operation หลักล้มเหลว
 * เช่น พนักงาน check-in สำเร็จ แต่ audit write ล้มเหลวชั่วคราว (DB busy)
 * → ยังควรให้พนักงานได้รับ response สำเร็จ
 * ถ้า throw error จะทำให้ UX แย่โดยไม่จำเป็น
 *
 * ทำไม oldValues/newValues เป็น Record<string, unknown>?
 * ─────────────────────────────────────────────────────────────────────
 * แต่ละ table มี schema ต่างกัน — Attendance, Shift, User มีฟิลด์ไม่เหมือนกัน
 * ใช้ Json column เก็บ snapshot ไว้ค้นหาย้อนหลังได้โดยไม่ต้อง join หลาย table
 * Record<string, unknown> แทน any เพราะ type-safe กว่า ยังคง flexible แต่ไม่ allow ทุกอย่าง
 *
 * SQL เทียบเท่า:
 * INSERT INTO "audit_logs"
 *   ("userId","action","targetTable","targetId","oldValues","newValues","ipAddress","userAgent")
 * VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7, $8)
 */
export const createAuditLog = async (data: CreateAuditLogDTO) => {
  try {
    // สร้าง record ใน audit_logs ด้วย Prisma
    // ใช้ || null แทน undefined เพราะ Prisma ต้องการ null ใน nullable column
    const log = await prisma.auditLog.create({
      data: {
        userId: data.userId ?? null,        // null ถ้า system action ไม่มี user
        action: data.action,                // string ตาม AuditAction constants
        targetTable: data.targetTable,      // ชื่อตาราง เช่น "attendance"
        targetId: data.targetId,            // id ของ record ที่ถูกกระทำ
        oldValues: data.oldValues || null,  // null ถ้าเป็น CREATE (ไม่มีข้อมูลก่อนหน้า)
        newValues: data.newValues || null,  // null ถ้าเป็น DELETE ที่ hard-delete
        ipAddress: data.ipAddress || null,  // null ถ้า internal call ไม่มี HTTP context
        userAgent: data.userAgent || null,  // null ถ้า internal call
      },
    });
    return log; // คืน record ให้ caller ถ้าต้องการ (ส่วนใหญ่ไม่ใช้)
  } catch (error) {
    // log error ไว้ให้ DevOps monitor แต่ไม่ re-throw
    // เพราะไม่ต้องการให้ audit failure ทำให้ operation หลักล้มเหลว
    console.error('Failed to create audit log:', error);
  }
};

// ============================================
// 📋 Query Function — ดึง Audit Logs
// ============================================

/**
 * ดึง Audit Logs ตาม filters
 *
 * ทำไมต้องมี limit default = 100?
 * ─────────────────────────────────────────────────────────────────────
 * Audit log มี record เป็นล้านได้ในระยะยาว
 * ถ้าไม่จำกัด → query ดึงทั้งหมด → OOM / response ช้า
 * 100 คือค่า safe default สำหรับ paginated display
 *
 * SQL เทียบเท่า:
 * SELECT al.*, u."firstName", u."lastName" FROM "audit_logs" al
 *   LEFT JOIN "users" u ON al."userId" = u."userId"
 *   WHERE (conditions)
 *   ORDER BY al."createdAt" DESC
 *   LIMIT $limit
 */
export const getAuditLogs = async (filters?: {
  userId?: number;      // กรองเฉพาะ action ของ user คนนี้
  action?: string;      // กรองเฉพาะ action ประเภทนี้ เช่น "CHECK_IN"
  targetTable?: string; // กรองเฉพาะตารางนี้ เช่น "attendance"
  targetId?: number;    // กรองเฉพาะ record นี้ (timeline ของ record เดียว)
  startDate?: Date;     // ช่วงเวลาเริ่มต้น
  endDate?: Date;       // ช่วงเวลาสิ้นสุด
  limit?: number;       // จำนวนสูงสุดที่ดึง (default: 100)
}) => {
  const logs = await prisma.auditLog.findMany({
    where: {
      // spread เงื่อนไขเฉพาะตัวที่มีค่า (skip ถ้า undefined)
      ...(filters?.userId && { userId: filters.userId }),
      ...(filters?.action && { action: filters.action }),
      ...(filters?.targetTable && { targetTable: filters.targetTable }),
      ...(filters?.targetId && { targetId: filters.targetId }),
      // สร้าง createdAt range เฉพาะถ้ามี startDate หรือ endDate อย่างน้อยหนึ่งตัว
      ...((filters?.startDate || filters?.endDate) && {
        createdAt: {
          ...(filters?.startDate && { gte: filters.startDate }),
          ...(filters?.endDate && { lte: filters.endDate }),
        },
      }),
    },
    include: {
      user: {
        // select เฉพาะที่จำเป็น ไม่ include password หรือ nationalId
        select: {
          userId: true,
          firstName: true,
          lastName: true,
          employeeId: true,
        },
      },
    },
    orderBy: {
      createdAt: 'desc', // ล่าสุดขึ้นก่อน — เหมาะกับ activity feed
    },
    take: filters?.limit || 100, // จำกัด record เพื่อป้องกัน overload
  });

  return logs;
};

// ============================================
// 🏷️ Action Constants — ชื่อ action มาตรฐาน
// ============================================

/**
 * ทำไมต้องใช้ constants แทน string literal ตรง ๆ ?
 * ─────────────────────────────────────────────────────────────────────
 * ถ้าพิมพ์ "CHEK_IN" ผิดตัวตอน query → ไม่ match record ใด → debug ยาก
 * ใช้ AuditAction.CHECK_IN → TypeScript จะ type-check ให้ → error ตั้งแต่ compile แล้ว
 *
 * ทำไม "as const"?
 * ─────────────────────────────────────────────────────────────────────
 * ทำให้ TypeScript infer type เป็น string literal union แทน string กว้าง ๆ
 * เช่น type จะเป็น "CHECK_IN" ไม่ใช่ string → auto-complete ใน IDE ได้
 */
export const AuditAction = {
  // ─── Shift (ตารางงาน) ────────────────────────────────────────────
  // บันทึกทุกการเปลี่ยนแปลง policy เวลาเพราะส่งผล ON_TIME/LATE/ABSENT ของพนักงาน
  CREATE_SHIFT: 'CREATE_SHIFT',
  UPDATE_SHIFT: 'UPDATE_SHIFT',
  DELETE_SHIFT: 'DELETE_SHIFT',

  // ─── Attendance (การเข้า-ออกงาน) ──────────────────────────────────
  // เป็นข้อมูลหลักของระบบ ต้องมี audit ทุก state change
  CHECK_IN: 'CHECK_IN',
  CHECK_OUT: 'CHECK_OUT',
  AUTO_CHECK_OUT: 'AUTO_CHECK_OUT',
  UPDATE_ATTENDANCE: 'UPDATE_ATTENDANCE', // Admin แก้ record ที่ผิดพลาด
  DELETE_ATTENDANCE: 'DELETE_ATTENDANCE', // Soft delete — ยังคงข้อมูลไว้

  // ─── User (พนักงาน) ──────────────────────────────────────────────
  // เปลี่ยนแปลง user record กระทบ access control ทั้งระบบ
  CREATE_USER: 'CREATE_USER',
  UPDATE_USER: 'UPDATE_USER',
  DELETE_USER: 'DELETE_USER',

  // ─── Leave Request (ใบลา) ─────────────────────────────────────────
  // status ของใบลาส่งผลต่อ attendance status วันนั้น ๆ — ต้อง log ทุก transition
  CREATE_LEAVE: 'CREATE_LEAVE',
  APPROVE_LEAVE: 'APPROVE_LEAVE',
  REJECT_LEAVE: 'REJECT_LEAVE',
  CANCEL_LEAVE: 'CANCEL_LEAVE',
  UPDATE_LEAVE: 'UPDATE_LEAVE',
  DELETE_LEAVE: 'DELETE_LEAVE',

  // ─── Announcement (ประกาศ) ──────────────────────────────────────────
  CREATE_ANNOUNCEMENT: 'CREATE_ANNOUNCEMENT',
  UPDATE_ANNOUNCEMENT: 'UPDATE_ANNOUNCEMENT',
  APPROVE_ANNOUNCEMENT: 'APPROVE_ANNOUNCEMENT',
  REJECT_ANNOUNCEMENT: 'REJECT_ANNOUNCEMENT',
  SEND_ANNOUNCEMENT: 'SEND_ANNOUNCEMENT',    // ส่งให้พนักงาน — ต้อง log recipientCount
  DELETE_ANNOUNCEMENT: 'DELETE_ANNOUNCEMENT',

  // ─── Event (กิจกรรม) ─────────────────────────────────────────────
  CREATE_EVENT: 'CREATE_EVENT',
  UPDATE_EVENT: 'UPDATE_EVENT',
  DELETE_EVENT: 'DELETE_EVENT',
  RESTORE_EVENT: 'RESTORE_EVENT', // กู้คืน soft-deleted event
  EVENT_CHECK_IN: 'EVENT_CHECK_IN',   // พนักงาน check-in เข้าร่วมกิจกรรม
  EVENT_CHECK_OUT: 'EVENT_CHECK_OUT', // พนักงาน check-out ออกจากกิจกรรม

  // ─── Late Request (คำขอมาสาย) ──────────────────────────────────────
  CREATE_LATE_REQUEST: 'CREATE_LATE_REQUEST',
  UPDATE_LATE_REQUEST: 'UPDATE_LATE_REQUEST',
  DELETE_LATE_REQUEST: 'DELETE_LATE_REQUEST',
  APPROVE_LATE_REQUEST: 'APPROVE_LATE_REQUEST',
  REJECT_LATE_REQUEST: 'REJECT_LATE_REQUEST',

  // ─── Location (สถานที่) ──────────────────────────────────────────
  // เปลี่ยน radius/พิกัดส่งผลต่อ GPS check-in ของพนักงานที่ use location นั้น
  CREATE_LOCATION: 'CREATE_LOCATION',
  UPDATE_LOCATION: 'UPDATE_LOCATION',
  DELETE_LOCATION: 'DELETE_LOCATION',
  RESTORE_LOCATION: 'RESTORE_LOCATION',

  // ─── Auth (การยืนยันตัวตน) ────────────────────────────────────────
  // LOGIN/LOGOUT ช่วย detect ความผิดปกติ เช่น login หลายครั้งจาก IP ต่างกัน
  LOGIN: 'LOGIN',
  LOGOUT: 'LOGOUT',
  CHANGE_PASSWORD: 'CHANGE_PASSWORD', // บังคับ logout ทุก session หลัง change password
} as const;
