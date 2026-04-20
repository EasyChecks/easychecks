import { prisma } from '../lib/prisma.js';
import { createAuditLog, AuditAction } from './audit.service.js';
import { sendBulkAnnouncementEmails } from './email.service.js';

// แยก business logic ออกจาก controller เพื่อให้ test ได้โดยไม่ต้องมี HTTP context
// Flow: ADMIN สร้าง DRAFT → คัดผู้รับ → กด Send → SENT (immutable)

// DTO แยก shape ของ input เพื่อให้ controller ส่งข้อมูลมาเป็น typed object แทน raw req.body

export interface CreateAnnouncementDTO {
  title: string;
  content: string;
  targetRoles?: string[];
  targetBranchIds?: number[];
  targetUserIds?: number[];
  createdByUserId: number;
}

export interface UpdateAnnouncementDTO {
  title?: string;
  content?: string;
  targetRoles?: string[];
  targetBranchIds?: number[];
  targetUserIds?: number[];
}

// ============================================
// Functions
// ============================================

// สร้างประกาศใหม่ — เริ่มต้นเป็น DRAFT เสมอเพื่อให้ Admin ตรวจทานก่อนส่งจริง ถ้า Insert แล้วส่งเลยจะย้อนกลับไม่ได้
// SQL: INSERT INTO announcements (title, content, target_roles, target_branch_ids, status, created_by_user_id)
//      VALUES ($1, $2, $3, $4, 'DRAFT', $5)
//      RETURNING *, (SELECT first_name, last_name FROM users WHERE user_id = created_by_user_id)
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

// ดึงรายการประกาศทั้งหมด — filter เป็น optional เพราะ ADMIN/SUPERADMIN ใช้ร่วมกัน
// SQL: SELECT a.*, u.first_name, u.last_name FROM announcements a
//      LEFT JOIN users u ON a.created_by_user_id = u.user_id
//      [WHERE a.status = $1] [AND a.created_by_user_id = $2]
//      ORDER BY a.announcement_id DESC
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

// ดึงประกาศรายชิ้นพร้อม recipients — JOIN ทีเดียวเพราะหน้า detail ต้องแสดงทั้งคู่ ถ้าแยก query จะเพิ่ม round-trip โดยไม่จำเป็น
// SQL: SELECT a.*, u_creator.*, ar.*, u_recip.*
//      FROM announcements a
//      LEFT JOIN users u_creator ON a.created_by_user_id = u_creator.user_id
//      LEFT JOIN announcement_recipients ar ON a.announcement_id = ar.announcement_id
//      LEFT JOIN users u_recip ON ar.user_id = u_recip.user_id
//      WHERE a.announcement_id = $1
export const getAnnouncementById = async (announcementId: number) => {
  const announcement = await prisma.announcement.findFirst({
    where: {
      announcementId,
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

// แก้ไขประกาศได้เฉพาะ DRAFT — ถ้า SENT แล้วข้อมูลต้อง immutable เพราะคนรับไปแล้ว
// ต้อง fetch existing ก่อนเพื่อ (1) เช็ค SENT guard (2) เก็บ oldValues สำหรับ audit trail
// SQL: SELECT status FROM announcements WHERE announcement_id = $1;
//      UPDATE announcements SET title = COALESCE($2, title), content = COALESCE($3, content), ...
//      WHERE announcement_id = $1 RETURNING *
export const updateAnnouncement = async (
  announcementId: number,
  data: UpdateAnnouncementDTO,
  updatedByUserId: number,
  updatedByUserRole?: string,
  _updatedByUserBranchId?: number
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

  // ADMIN สามารถแก้ไขได้เฉพาะประกาศที่ตัวเองสร้าง
  // SUPERADMIN แก้ไขได้ทุกประกาศ
  if (updatedByUserRole === 'ADMIN' && existing.createdByUserId !== updatedByUserId) {
    throw new Error('ไม่สามารถแก้ไขประกาศที่สร้างโดยผู้ใช้อื่น');
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



// ส่งประกาศ — หัวใจของระบบ
// ใช้ $transaction ป้องกัน race condition: กดส่ง 2 ครั้งพร้อมกัน request ที่ 2 เจอ status ≠ DRAFT แล้ว fail
// ADMIN ส่งข้ามสาขาไม่ได้เพราะป้องกัน data leakage / ส่งให้ SUPERADMIN ไม่ได้เพราะ privilege สูงกว่า
// SQL (ADMIN): SELECT user_id, email FROM users WHERE status='ACTIVE' AND branch_id=$1 AND role!='SUPERADMIN' [AND role IN ($roles)]
// SQL (SUPERADMIN): SELECT user_id, email FROM users WHERE status='ACTIVE' [AND role IN ($roles)] [AND branch_id IN ($branches)]
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

    // ─── Permission check ───────────────────────────────────────
    // ADMIN  → ส่งได้เฉพาะคนในสาขาตัวเอง ยกเว้น SUPERADMIN
    // SUPERADMIN → ส่งได้ทุกคน ทุกสาขา
    if (sentByUserRole === 'ADMIN' && !sentByUserBranchId) {
      throw new Error('Admin ต้องมี branchId เพื่อส่งประกาศ');
    }
    if (sentByUserRole !== 'ADMIN' && sentByUserRole !== 'SUPERADMIN') {
      throw new Error('เฉพาะ Admin และ Super Admin เท่านั้นที่สามารถส่งประกาศได้');
    }

    let users;
    if (announcement.targetUserIds && announcement.targetUserIds.length > 0) {
      // ─── ระบุ targetUserIds เฉพาะ ─────────────────────────────
      const userQuery: any = {
        userId: { in: announcement.targetUserIds },
        status: 'ACTIVE',
      };
      // ADMIN → บังคับเฉพาะสาขาตัวเอง + ห้ามส่งให้ SUPERADMIN
      if (sentByUserRole === 'ADMIN') {
        userQuery.branchId = sentByUserBranchId;
        userQuery.role = { not: 'SUPERADMIN' };
      }
      users = await tx.user.findMany({
        where: userQuery,
        select: { userId: true, email: true, firstName: true, lastName: true },
      });
    } else {
      // ─── ใช้ role/branch filter ─────────────────────────────────
      let recipientQuery: any = { status: 'ACTIVE' };

      if (announcement.targetRoles && announcement.targetRoles.length > 0) {
        recipientQuery.role = { in: (announcement.targetRoles || []) as any };
      }

      if (announcement.targetBranchIds && announcement.targetBranchIds.length > 0) {
        recipientQuery.branchId = { in: announcement.targetBranchIds };
      }

      if (sentByUserRole === 'ADMIN') {
        // บังคับเฉพาะสาขาตัวเอง
        recipientQuery.branchId = sentByUserBranchId;
        // กรอง SUPERADMIN ออก
        if (recipientQuery.role?.in) {
          recipientQuery.role = {
            in: (recipientQuery.role.in as string[]).filter((r: string) => r !== 'SUPERADMIN'),
          };
        } else {
          recipientQuery.role = { not: 'SUPERADMIN' };
        }
      }
      // SUPERADMIN → ไม่มีข้อจำกัด ใช้ filter ตามที่ตั้งไว้ได้เลย

      users = await tx.user.findMany({
        where: recipientQuery,
        select: { userId: true, email: true, firstName: true, lastName: true },
      });
    }
    const recipientIds = users.map((u) => u.userId);

    // INSERT recipients ลง announcement_recipients
    // ต้องทำภายใน transaction เดียวกัน เพื่อให้ rollback ได้ถ้า update status ล้มเหลว
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
        sentAt: new Date(),
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

// ลบประกาศ hard delete — ดึง existing ก่อนเพื่อเก็บ oldValues ใน audit log
// SQL: DELETE FROM announcements WHERE announcement_id = $1
export const deleteAnnouncement = async (
  announcementId: number,
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

  await createAuditLog({
    userId: deletedByUserId,
    action: AuditAction.DELETE_ANNOUNCEMENT,
    targetTable: 'announcements',
    targetId: announcementId,
    oldValues: existing,
  });

  return deleted;
};

// ลบผู้รับ 1 คน — ใช้ revoke การรับรู้ เช่นส่งผิดคน / hard delete เพราะ junction table ไม่มี business logic
// ต้องตรวจ announcementId ตรงกันเพราะป้องกันลบ recipient ข้ามประกาศ
// SQL: DELETE FROM announcement_recipients WHERE recipient_id = $1
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

// ล้าง recipients ทั้งหมด — ใช้ก่อน re-send ใหม่ให้กลุ่มใหม่ ป้องกัน duplicate records
// ต้อง verify ว่า announcement มีอยู่ก่อน เพราะ deleteMany ไม่ throw ถ้า 0 rows
// SQL: SELECT 1 FROM announcements WHERE announcement_id = $1;
//      DELETE FROM announcement_recipients WHERE announcement_id = $1;
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
