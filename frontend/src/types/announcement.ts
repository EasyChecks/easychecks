// ─────────────────────────────────────────────────────────────
// 📢 Announcement Types — ประเภทข้อมูลทั้งหมดของระบบประกาศ
// ─────────────────────────────────────────────────────────────
// ใช้ร่วมกันทั้ง frontend (component, service, hook)
// เพื่อให้ type-safe ตลอด flow ตั้งแต่ API call จนถึง UI render

/** สถานะประกาศ: DRAFT = ฉบับร่าง (แก้ไขได้), SENT = ส่งแล้ว (แก้ไขไม่ได้) */
export type AnnouncementStatus = 'DRAFT' | 'SENT';

/** บทบาทที่สามารถเป็นเป้าหมายของประกาศได้ */
export type AnnouncementRole = 'SUPERADMIN' | 'ADMIN' | 'MANAGER' | 'USER';

/** ข้อมูลคนสร้างประกาศ (JOIN มาจาก users table) */
export interface AnnouncementCreator {
  userId: number;
  firstName: string;
  lastName: string;
}

/** ข้อมูลผู้รับประกาศ 1 คน (จาก announcement_recipients table) */
export interface AnnouncementRecipient {
  recipientId: number;       // PK ของ announcement_recipients
  announcementId: number;    // FK → announcements
  userId: number;            // FK → users (คนที่ได้รับประกาศ)
  sentAt: string | null;     // วันเวลาที่ส่ง (null = ยังไม่ส่ง)
  createdAt: string;         // วันเวลาที่ INSERT record
  user: {                    // ข้อมูล user ที่ JOIN มา
    userId: number;
    firstName: string;
    lastName: string;
    email: string;
  };
}

/** ข้อมูลประกาศฉบับเต็ม — ใช้แสดงในหน้า list และ detail */
export interface Announcement {
  announcementId: number;                // PK ของประกาศ
  title: string;                         // หัวข้อประกาศ
  content: string;                       // เนื้อหาประกาศ
  targetRoles: AnnouncementRole[];       // [] = ส่งหาทุก role
  targetBranchIds: number[];             // [] = ส่งหาทุกสาขา
  targetUserIds: number[];               // [] = ใช้ role/branch filter แทน
  status: AnnouncementStatus;            // DRAFT | SENT
  createdByUserId: number;               // ใครสร้าง
  createdAt: string;                     // สร้างเมื่อไหร่
  updatedByUserId: number | null;        // ใครแก้ไขล่าสุด (null = ยังไม่เคยแก้)
  updatedAt: string;                     // แก้ไขล่าสุดเมื่อไหร่
  sentAt: string | null;                 // ส่งเมื่อไหร่ (null = ยังไม่ส่ง)
  sentByUserId: number | null;           // ใครเป็นคนกดส่ง
  creator: AnnouncementCreator;          // ข้อมูลคนสร้าง (JOIN มา)
  recipients?: AnnouncementRecipient[];  // รายชื่อผู้รับ (มีเฉพาะหน้า detail)
}

/** DTO สำหรับสร้างประกาศใหม่ — field ที่ไม่ระบุจะส่งหาทุกคน */
export interface CreateAnnouncementDTO {
  title: string;                         // หัวข้อ (จำเป็น)
  content: string;                       // เนื้อหา (จำเป็น)
  targetRoles?: AnnouncementRole[];      // เลือก role ที่จะส่ง (ไม่ระบุ = ทุก role)
  targetBranchIds?: number[];            // เลือกสาขา (ไม่ระบุ = ทุกสาขา)
  targetUserIds?: number[];              // เลือกคนเฉพาะ (ถ้าระบุจะข้าม role/branch filter)
}

/** DTO สำหรับแก้ไขประกาศ — ส่งเฉพาะ field ที่ต้องการแก้ */
export interface UpdateAnnouncementDTO {
  title?: string;
  content?: string;
  targetRoles?: AnnouncementRole[];
  targetBranchIds?: number[];
  targetUserIds?: number[];
}

/** ตัวกรองสำหรับดึงรายการประกาศ */
export interface AnnouncementFilters {
  status?: AnnouncementStatus;           // กรองตามสถานะ DRAFT | SENT
  createdByUserId?: number;              // กรองตามคนสร้าง
}

/** ผลลัพธ์หลังส่งประกาศสำเร็จ */
export interface SendAnnouncementResult {
  announcement: Announcement;            // ประกาศที่อัปเดตเป็น SENT แล้ว
  recipientCount: number;                // จำนวนคนที่ได้รับ
}
