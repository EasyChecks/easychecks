import { prisma } from '../lib/prisma.js';
import { createAuditLog, AuditAction } from './audit.service.js';
import { sendBulkAnnouncementEmails } from './email.service.js';

/**
 * ─────────────────────────────────────────────────────────────
 * 📢 Announcement Service
 * ─────────────────────────────────────────────────────────────
 * รับผิดชอบ business logic ทั้งหมดของระบบประกาศ
 *
 * แยก logic ออกจาก controller เพื่อให้ test ได้ง่าย
 * และเพื่อให้ controller บางๆ ไม่มี if/else ซ้ำซ้อน
 *
 * Flow หลัก:
 *   1. ADMIN สร้างประกาศ → status = DRAFT
 *   2. ADMIN/SUPERADMIN กด Send → คัดผู้รับ → บันทึก recipients → ส่งอีเมล
 *   3. ถ้า SENT แล้ว แก้ไขไม่ได้ (immutable)
 * ─────────────────────────────────────────────────────────────
 */

// ============================================
// 📦 DTOs — กำหนด shape ของ input
// แยก DTO ออกมาเพื่อให้ validate ที่ controller
// แล้วส่งมาเป็น typed object แทน req.body raw
// ============================================

export interface CreateAnnouncementDTO {
  title: string;            // หัวข้อประกาศ (required เสมอ)
  content: string;          // เนื้อหาประกาศ (required เสมอ)
  targetRoles?: string[];   // ถ้าไม่ระบุ = ส่งหาทุก role
  targetBranchIds?: number[]; // ถ้าไม่ระบุ = ส่งหาทุกสาขา
  targetUserIds?: number[];   // ระบุ userId เฉพาะ — ถ้ามี จะส่งเฉพาะคนเหล่านี้
  createdByUserId: number;  // ต้องรู้ว่าใครสร้าง เพื่อ audit trail
}

export interface UpdateAnnouncementDTO {
  title?: string;
  content?: string;
  targetRoles?: string[];
  targetBranchIds?: number[];
  targetUserIds?: number[];
}

// ============================================
// 📋 Functions
// ============================================

/**
 * ➕ สร้างประกาศใหม่ (status เริ่มต้นเป็น DRAFT เสมอ)
 *
 * ทำไมต้อง DRAFT ก่อน?
 * → เพื่อให้ Admin ตรวจทานก่อนส่งจริง
 *   ถ้า Insert แล้วส่งเลย จะย้อนกลับไม่ได้
 *
 * SQL เทียบเท่า:
 *   INSERT INTO announcements
 *     (title, content, target_roles, target_branch_ids, status, created_by_user_id)
 *   VALUES
 *     ($1, $2, $3, $4, 'DRAFT', $5)
 *   RETURNING
 *     announcements.*,
 *     users.user_id, users.first_name, users.last_name  -- (JOIN creator)
 */
export const createAnnouncement = async (data: CreateAnnouncementDTO) => {
  if (!data.title || !data.content) {
    throw new Error('ต้องระบุ title และ content');
  }

  const announcement = await prisma.announcement.create({
    data: {
      title: data.title,
      content: data.content,
      targetRoles: data.targetRoles || [],
      targetBranchIds: data.targetBranchIds || [],
      targetUserIds: data.targetUserIds || [],
      // กำหนด DRAFT เสมอ — ป้องกันการส่งผ่าน API โดยตรงโดยไม่ผ่าน send endpoint
      status: 'DRAFT',
      createdByUserId: data.createdByUserId,
    },
    include: {
      // JOIN creator เพราะ frontend ต้องแสดงชื่อคนสร้างทันที ไม่ต้อง query ซ้ำ
      creator: {
        select: {
          userId: true,
          firstName: true,
          lastName: true,
        },
      },
    },
  });

  // บันทึก audit log ทันหลัง insert
  // เพื่อให้ทราบว่าใครสร้างอะไร เมื่อไหร่ ในกรณีที่มีปัญหาทีหลัง
  await createAuditLog({
    userId: data.createdByUserId,
    action: AuditAction.CREATE_ANNOUNCEMENT,
    targetTable: 'announcements',
    targetId: announcement.announcementId,
    newValues: announcement,
  });

  return announcement;
};

/**
 * 📋 ดึงรายการประกาศทั้งหมด (รองรับ filter)
 *
 * ทำไมต้องกรอง deletedAt = null ?
 * → ระบบใช้ Soft Delete คือไม่ลบแถวออกจาก DB
 *   แต่ set deletedAt มีค่า → ต้องกรองออกทุกครั้งที่ query
 *   มิฉะนั้น user จะเห็นประกาศที่ "ลบแล้ว" ใน list
 *
 * SQL เทียบเท่า:
 *   SELECT
 *     a.*,
 *     u.user_id, u.first_name, u.last_name  -- JOIN creator
 *   FROM announcements a
 *   LEFT JOIN users u ON a.created_by_user_id = u.user_id
 *   WHERE a.deleted_at IS NULL
 *     [AND a.status = $1]              -- optional filter
 *     [AND a.created_by_user_id = $2]  -- optional filter
 *   ORDER BY a.created_at DESC
 */
export const getAnnouncements = async (
  filters?: {
    status?: string;
    createdByUserId?: number;
  }
) => {
  const whereClause: any = {};

  if (filters?.status) {
    whereClause.status = filters.status;
  }
  if (filters?.createdByUserId) {
    whereClause.createdByUserId = filters.createdByUserId;
  }

  // Soft Delete guard — ต้องใส่ทุกครั้งที่ query announcement
  // ไม่ filter ตรงนี้ = ประกาศที่ถูกลบโผล่ขึ้น UI
  whereClause.deleteReason = null;

  const announcements = await prisma.announcement.findMany({
    where: whereClause,
    include: {
      // JOIN creator เพื่อไม่ต้อง round-trip query user แยกทีหลัง
      creator: {
        select: {
          userId: true,
          firstName: true,
          lastName: true,
        },
      },
    },
    orderBy: {
      announcementId: 'desc',
    },
  });

  return announcements;
};

/**
 * 🔍 ดึงประกาศรายชิ้นพร้อมรายชื่อผู้รับ
 *
 * ทำไมต้อง include recipients ?
 * → หน้า detail ต้องแสดงว่าส่งให้ใครบ้างแล้ว
 *   ถ้าไม่ JOIN ตรงนี้ จะต้อง query แยกอีก 1 ครั้ง
 *
 * ทำไมต้องกรอง deletedAt = null ?
 * → ถ้า findUnique ไม่กรอง จะดึงประกาศที่ถูก soft-delete มาก็ได้
 *   แล้วยัง return ให้ client ซึ่งไม่ควรเห็น
 *
 * SQL เทียบเท่า:
 *   SELECT
 *     a.*,
 *     u_creator.first_name, u_creator.last_name,
 *     ar.recipient_id, ar.sent_at,
 *     u_recip.user_id, u_recip.first_name, u_recip.last_name, u_recip.email
 *   FROM announcements a
 *   LEFT JOIN users u_creator ON a.created_by_user_id = u_creator.user_id
 *   LEFT JOIN announcement_recipients ar ON a.announcement_id = ar.announcement_id
 *   LEFT JOIN users u_recip ON ar.user_id = u_recip.user_id
 *   WHERE a.announcement_id = $1
 *     AND a.deleted_at IS NULL
 */
export const getAnnouncementById = async (announcementId: number) => {
  const announcement = await prisma.announcement.findFirst({
    where: {
      announcementId,
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
      // JOIN recipients เพราะหน้า detail ต้องแสดง list คนรับ
      recipients: {
        include: {
          user: {
            select: {
              userId: true,
              firstName: true,
              lastName: true,
              email: true,
            },
          },
        },
      },
    },
  });

  if (!announcement) {
    throw new Error('ไม่พบประกาศที่ระบุ');
  }

  return announcement;
};

/**
 * ✏️ แก้ไขประกาศ (เฉพาะ DRAFT เท่านั้น)
 *
 * ทำไมต้อง fetch existing ก่อน UPDATE?
 * → เพื่อเช็ค status ว่าเป็น DRAFT หรือ SENT
 *   ถ้า SENT แล้วแก้ไขไม่ได้ — ข้อมูลที่ส่งไปแล้วต้อง immutable
 *   และต้องการ oldValues ของเดิมเพื่อ audit trail (before/after)
 *
 * SQL เทียบเท่า:
 *   -- 1. ตรวจสอบก่อน
 *   SELECT status FROM announcements WHERE announcement_id = $1;
 *
 *   -- 2. ถ้า status = 'DRAFT' ถึงจะ update
 *   UPDATE announcements
 *   SET
 *     title             = COALESCE($2, title),
 *     content           = COALESCE($3, content),
 *     target_roles      = COALESCE($4, target_roles),
 *     target_branch_ids = COALESCE($5, target_branch_ids),
 *     updated_by_user_id = $6
 *   WHERE announcement_id = $1
 *   RETURNING *, (SELECT first_name, last_name FROM users WHERE user_id = created_by_user_id);
 */
export const updateAnnouncement = async (
  announcementId: number,
  data: UpdateAnnouncementDTO,
  updatedByUserId: number
) => {
  // ดึงข้อมูลเดิมก่อน เพื่อ (1) เช็ค SENT guard (2) เก็บ oldValues ให้ audit log
  const existing = await prisma.announcement.findUnique({
    where: { announcementId },
  });

  if (!existing) {
    throw new Error('ไม่พบประกาศที่ระบุ');
  }

  // ป้องกันการแก้ไขหลัง SENT
  // เพราะมีคน receive ไปแล้ว การแก้ไขจะทำให้ข้อมูลใน DB ไม่ตรงกับที่รับไปจริงๆ
  if (existing.status === 'SENT') {
    throw new Error('ไม่สามารถแก้ไขประกาศที่ส่งไปแล้ว');
  }

  const updated = await prisma.announcement.update({
    where: { announcementId },
    data: {
      // ใช้ spread + conditional เพื่อ partial update
      // ถ้า field ไม่ได้ส่งมา (undefined) จะไม่ overwrite
      // ใช้ !== undefined แทน truthy เพื่อให้ส่ง [] (ล้างค่า) หรือ "" ได้
      ...(data.title !== undefined && { title: data.title }),
      ...(data.content !== undefined && { content: data.content }),
      ...(data.targetRoles !== undefined && { targetRoles: data.targetRoles }),
      ...(data.targetBranchIds !== undefined && { targetBranchIds: data.targetBranchIds }),
      ...(data.targetUserIds !== undefined && { targetUserIds: data.targetUserIds }),
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

  // บันทึก old+new values เพื่อให้ admin ย้อนดูได้ว่าแก้อะไรไป
  await createAuditLog({
    userId: updatedByUserId,
    action: AuditAction.UPDATE_ANNOUNCEMENT,
    targetTable: 'announcements',
    targetId: announcementId,
    oldValues: existing,
    newValues: updated,
  });

  return updated;
};



/**
 * 📤 ส่งประกาศ — หัวใจของระบบนี้
 *
 * Flow:
 *   1. ตรวจสอบว่าประกาศมีอยู่ และยังเป็น DRAFT
 *   2. คัดผู้รับตาม targetRoles / targetBranchIds ที่ตั้งไว้
 *   3. Apply permission rules ตาม role ผู้ส่ง
 *   4. INSERT recipients ลง announcement_recipients
 *   5. UPDATE status → SENT
 *   6. ส่งอีเมลแบบ fire-and-forget (ไม่บล็อก response)
 *
 * ทำไม ADMIN ถึงส่งข้ามสาขาไม่ได้?
 * → เพื่อป้องกัน data leakage ระหว่างสาขา
 *   ADMIN ควรเห็นแค่คนใน branch ตัวเอง
 *
 * ทำไม ADMIN ส่งให้ SUPERADMIN ไม่ได้?
 * → SUPERADMIN มี privilege สูงกว่า
 *   ไม่ควรให้ ADMIN notify SUPERADMIN ได้เพื่อ security
 *
 * SQL เทียบเท่าส่วน query ผู้รับ (กรณี ADMIN):
 *   SELECT user_id, email, first_name, last_name
 *   FROM users
 *   WHERE status = 'ACTIVE'
 *     AND branch_id = $sentByUserBranchId       -- จำกัดสาขา
 *     AND role != 'SUPERADMIN'                  -- ห้ามส่งให้ SUPERADMIN
 *     [AND role IN ($targetRoles)]              -- ถ้าระบุ role ไว้
 *
 * SQL เทียบเท่าส่วน query ผู้รับ (กรณี SUPERADMIN):
 *   SELECT user_id, email, first_name, last_name
 *   FROM users
 *   WHERE status = 'ACTIVE'
 *     [AND role IN ($targetRoles)]              -- ถ้าระบุ role ไว้
 *     [AND branch_id IN ($targetBranchIds)]     -- ถ้าระบุสาขาไว้
 */
export const sendAnnouncement = async (
  announcementId: number,
  sentByUserId: number,
  sentByUserRole: string,
  sentByUserBranchId?: number
) => {
  // ใช้ $transaction เพื่อป้องกัน race condition
  // ถ้ากดส่ง 2 ครั้งพร้อมกัน request ที่ 2 จะเจอ status ≠ DRAFT แล้ว fail
  const { updated, recipientIds, users, announcement } = await prisma.$transaction(async (tx) => {
    const announcement = await tx.announcement.findUnique({
      where: { announcementId },
    });

    if (!announcement) {
      throw new Error('ไม่พบประกาศที่ระบุ');
    }

    // ป้องกันการส่งซ้ำ — ถ้า SENT แล้วจะสร้าง duplicate recipients
    if (announcement.status !== 'DRAFT') {
      throw new Error('ประกาศต้องอยู่ในสถานะ DRAFT เพื่อส่งได้');
    }

    // ─── ถ้าระบุ targetUserIds = ส่งเฉพาะคนที่เลือก ─────────────
    // ข้าม role/branch filter ทั้งหมด แต่ยังตรวจ ACTIVE status
    let users;
    if (announcement.targetUserIds && announcement.targetUserIds.length > 0) {
      users = await tx.user.findMany({
        where: {
          userId: { in: announcement.targetUserIds },
          status: 'ACTIVE',
        },
        select: { userId: true, email: true, firstName: true, lastName: true },
      });
    } else {
      // ─── ไม่ได้ระบุ userId เฉพาะ → ใช้ role/branch filter ตามเดิม ──
      // สร้าง query object แบบ dynamic เพราะเงื่อนไขผู้รับมีหลาย combination
      // BASE: ดึงเฉพาะ user ที่ active — inactive/resigned ไม่ควรได้รับประกาศ
      let recipientQuery: any = { status: 'ACTIVE' };

      // ถ้าประกาศนี้ระบุ targetRoles ไว้ = ส่งเฉพาะ role นั้นๆ
      // ถ้าไม่ระบุ (array ว่าง) = ส่งหาทุก role (ไม่ใส่ WHERE role)
      if (announcement.targetRoles && announcement.targetRoles.length > 0) {
        recipientQuery.role = { in: (announcement.targetRoles || []) as any };
      }

      // ถ้าประกาศนี้ระบุ targetBranchIds ไว้ = ส่งเฉพาะสาขานั้นๆ
      if (announcement.targetBranchIds && announcement.targetBranchIds.length > 0) {
        recipientQuery.branchId = { in: announcement.targetBranchIds };
      }

      // ─── Permission Rules ───────────────────────────────────────
      if (sentByUserRole === 'ADMIN') {
        if (!sentByUserBranchId) {
          throw new Error('Admin ต้องมี branchId เพื่อส่งประกาศ');
        }
        recipientQuery.branchId = sentByUserBranchId;

        if (recipientQuery.role?.in) {
          recipientQuery.role = {
            in: (recipientQuery.role.in as string[]).filter((r: string) => r !== 'SUPERADMIN'),
          };
        } else {
          recipientQuery.role = { not: 'SUPERADMIN' };
        }
      } else if (sentByUserRole === 'SUPERADMIN') {
        // SUPERADMIN ไม่มีข้อจำกัด
      } else {
        throw new Error('เฉพาะ Admin และ Super Admin เท่านั้นที่สามารถส่งประกาศได้');
      }

      users = await tx.user.findMany({
        where: recipientQuery,
        select: { userId: true, email: true, firstName: true, lastName: true },
      });
    }
    const recipientIds = users.map((u) => u.userId);

    if (recipientIds.length > 0) {
      await tx.announcementRecipient.createMany({
        data: recipientIds.map((userId) => ({
          announcementId,
          userId,
        })),
      });
    }

    // อัปเดต status ให้เป็น SENT ภายใน transaction เดียวกัน
    // ถ้า request อื่นเข้ามาพร้อมกัน จะเจอ status ≠ DRAFT แล้ว throw ออกไป
    const updated = await tx.announcement.update({
      where: { announcementId },
      data: {
        status: 'SENT',
        sentByUserId,
      },
    });

    return { updated, recipientIds, users, announcement };
  });

  // บันทึก audit พร้อม recipientCount เพื่อให้ทราบว่าส่งไปกี่คน
  await createAuditLog({
    userId: sentByUserId,
    action: AuditAction.SEND_ANNOUNCEMENT,
    targetTable: 'announcements',
    targetId: announcementId,
    newValues: { status: 'SENT', recipientCount: recipientIds.length },
  });

  // ส่งอีเมล fire-and-forget — ไม่ await เพราะไม่อยากให้ email delay
  // ทำให้ API response กลับเร็ว และอีเมลส่งอยู่เบื้องหลัง
  // ถ้า email fail ก็ไม่ rollback ประกาศ เพราะ DB บันทึกไปแล้ว
  const emailRecipients = users
    .filter((u) => u.email)   // กรองคนที่ไม่มี email ออก (ป้องกัน Resend error)
    .map((u) => ({ email: u.email!, firstName: u.firstName, lastName: u.lastName }));

  if (emailRecipients.length > 0) {
    const sentAt = new Date();
    sendBulkAnnouncementEmails(
      emailRecipients,
      announcement.title,
      announcement.content,
      sentAt
    ).then(({ success, failed }) => {
      console.log(`[EmailService] ส่งอีเมลประกาศ "${announcement.title}": สำเร็จ=${success}, ล้มเหลว=${failed}`);
    }).catch((err) => {
      console.error('[EmailService] ข้อผิดพลาดในการส่งอีเมล:', err);
    });
  }

  return {
    announcement: updated,
    recipientCount: recipientIds.length,
  };
};

/**
 * 🗑️ ลบประกาศแบบ Soft Delete
 *
 * ทำไมใช้ Soft Delete แทน DELETE จริงๆ?
 * → เพื่อรักษา audit trail — ถ้า hard delete แล้วจะไม่มีหลักฐานว่าเคยมีประกาศนั้น
 *   นอกจากนี้ยังป้องกัน orphan records ใน announcement_recipients
 *
 * SQL เทียบเท่า:
 *   -- ไม่ใช่ DELETE FROM announcements WHERE ...
 *   -- แต่เป็น UPDATE:
 *   UPDATE announcements
 *   SET deleted_at = NOW(), delete_reason = $1
 *   WHERE announcement_id = $2
 */
export const deleteAnnouncement = async (
  announcementId: number,
  deleteReason: string,
  deletedByUserId: number
) => {
  // ดึงข้อมูลเดิมก่อน เพื่อเก็บ oldValues ใน audit log
  const existing = await prisma.announcement.findUnique({
    where: { announcementId },
  });

  if (!existing) {
    throw new Error('ไม่พบประกาศที่ระบุ');
  }

  const deleted = await prisma.announcement.delete({
    where: { announcementId },
  });

  // บันทึก deleteReason ใน audit เพื่อให้ทราบว่าลบเพราะอะไร
  await createAuditLog({
    userId: deletedByUserId,
    action: AuditAction.DELETE_ANNOUNCEMENT,
    targetTable: 'announcements',
    targetId: announcementId,
    oldValues: existing,
    newValues: { deleted: true, deleteReason },
  });

  return deleted;
};

/**
 * 🗑️ ลบผู้รับออก 1 คน จาก announcement_recipients
 *
 * ทำไมต้องมี function นี้?
 * → กรณีส่งประกาศไปแล้ว แต่ต้องการ revoke การรับรู้ของคนๆ นั้น
 *   เช่น ส่งผิดคน หรือ user นั้นไม่ควรเห็น
 *
 * ทำไม Hard Delete ตรงนี้แทนที่จะ Soft Delete?
 * → recipients เป็น junction table — ไม่มี business logic ซ้อนอยู่
 *   Hard delete ทำให้ logic ง่ายกว่า อีกทั้งถ้าจะ re-send ก็ insert ใหม่ได้
 *
 * SQL เทียบเท่า:
 *   DELETE FROM announcement_recipients
 *   WHERE recipient_id = $1
 */
export const deleteRecipient = async (
  announcementId: number,
  recipientId: number,
  deletedByUserId: number
) => {
  // ดึงข้อมูลเดิมก่อนลบ เพื่อเก็บ oldValues ใน audit log
  const recipient = await prisma.announcementRecipient.findUnique({
    where: { recipientId },
  });

  if (!recipient) {
    throw new Error('ไม่พบรายการที่ส่ง');
  }

  // ตรวจสอบว่า recipient นี้เป็นของ announcement ที่ระบุจริง
  // ป้องกันการลบ recipient ข้ามประกาศ
  if (recipient.announcementId !== announcementId) {
    throw new Error('ผู้รับประกาศนี้ไม่ได้อยู่ในประกาศที่ระบุ');
  }

  const deleted = await prisma.announcementRecipient.delete({
    where: { recipientId },
  });

  await createAuditLog({
    userId: deletedByUserId,
    action: AuditAction.DELETE_ANNOUNCEMENT,
    targetTable: 'announcement_recipients',
    targetId: recipientId,
    oldValues: recipient,
  });

  return deleted;
};

/**
 * 🗑️ ล้างผู้รับประกาศทั้งหมดในประกาศที่ระบุ
 *
 * ทำไมต้องมี function นี้แยกจาก deleteRecipient?
 * → กรณีต้องการ re-send ประกาศใหม่ให้กลุ่มใหม่
 *   ต้องล้าง recipients เดิมออกก่อน แล้วค่อย call sendAnnouncement อีกครั้ง
 *   ถ้าไม่ล้าง → จะมี duplicate records ใน announcement_recipients
 *
 * ทำไมต้อง verify ว่า announcement มีอยู่ก่อน deleteMany?
 * → deleteMany ของ Prisma ไม่ throw error ถ้าไม่มีแถวที่ match
 *   ถ้าไม่ check ก่อน จะไม่รู้ว่า announcementId นั้น invalid หรือแค่ไม่มี recipients
 *
 * SQL เทียบเท่า:
 *   -- 1. เช็คว่ามี announcement
 *   SELECT 1 FROM announcements WHERE announcement_id = $1;
 *
 *   -- 2. ลบ recipients ทั้งหมดของ announcement นั้น
 *   DELETE FROM announcement_recipients
 *   WHERE announcement_id = $1;
 */
export const clearAllRecipients = async (
  announcementId: number,
  clearedByUserId: number
) => {
  // ตรวจสอบก่อนว่า announcement มีอยู่จริง
  // เพราะ deleteMany ไม่ throw ถ้า 0 rows ถูกลบ
  const announcement = await prisma.announcement.findUnique({
    where: { announcementId },
  });

  if (!announcement) {
    throw new Error('ไม่พบประกาศที่ระบุ');
  }

  // SQL: DELETE FROM announcement_recipients WHERE announcement_id = $announcementId
  // ต้องระบุ announcementId ให้ชัดเจน — ถ้าลืมใส่จะลบ recipients ของทุก announcement!
  // (Bug เดิมที่เคยแก้ไขแล้ว)
  const result = await prisma.announcementRecipient.deleteMany({
    where: { announcementId },
  });

  // บันทึก count ที่ลบไปด้วย เพื่อให้รู้ว่าล้างคนออกไปกี่คน
  await createAuditLog({
    userId: clearedByUserId,
    action: AuditAction.DELETE_ANNOUNCEMENT,
    targetTable: 'announcement_recipients',
    targetId: announcementId,
    newValues: { action: 'CLEAR_ALL', count: result.count },
  });

  return {
    clearedCount: result.count,
  };
};

// ============================================
// 📤 Export
// ============================================

export const announcementService = {
  createAnnouncement,
  getAnnouncements,
  getAnnouncementById,
  updateAnnouncement,
  sendAnnouncement,
  deleteAnnouncement,
  deleteRecipient,
  clearAllRecipients,
};

export default announcementService;
