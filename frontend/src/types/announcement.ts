// type รวมทั้งหมดของระบบประกาศ — ใช้ร่วมทั้ง component / service / hook
// เพื่อให้ type-safe ตลอด flow ตั้งแต่ API call จนถึง UI render

export type AnnouncementStatus = 'DRAFT' | 'SENT';
export type AnnouncementRole = 'SUPERADMIN' | 'ADMIN' | 'MANAGER' | 'USER';

// JOIN จาก users table
export interface AnnouncementCreator {
  userId: number;
  firstName: string;
  lastName: string;
}

// จาก announcement_recipients table + JOIN user
export interface AnnouncementRecipient {
  recipientId: number;
  announcementId: number;
  userId: number;
  sentAt: string | null;
  createdAt: string;
  user: {
    userId: number;
    firstName: string;
    lastName: string;
    email: string;
  };
}

export interface Announcement {
  announcementId: number;
  title: string;
  content: string;
  targetRoles: AnnouncementRole[];       // [] = ส่งทุก role
  targetBranchIds: number[];             // [] = ส่งทุกสาขา
  targetUserIds: number[];               // [] = ใช้ role/branch filter แทน
  status: AnnouncementStatus;
  createdByUserId: number;
  createdAt: string;
  updatedByUserId: number | null;
  updatedAt: string;
  sentAt: string | null;
  sentByUserId: number | null;
  creator: AnnouncementCreator;
  recipients?: AnnouncementRecipient[];  // มีเฉพาะหน้า detail เพื่อประหยัด bandwidth หน้า list
}

// ส่งเฉพาะ field ที่ต้องการแก้ เพื่อ partial update
export interface CreateAnnouncementDTO {
  title: string;
  content: string;
  targetRoles?: AnnouncementRole[];
  targetBranchIds?: number[];
  targetUserIds?: number[];              // ถ้าระบุจะข้าม role/branch filter
}

export interface UpdateAnnouncementDTO {
  title?: string;
  content?: string;
  targetRoles?: AnnouncementRole[];
  targetBranchIds?: number[];
  targetUserIds?: number[];
}

export interface AnnouncementFilters {
  status?: AnnouncementStatus;
  createdByUserId?: number;
}

export interface SendAnnouncementResult {
  announcement: Announcement;
  recipientCount: number;
}
