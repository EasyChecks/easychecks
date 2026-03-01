// ─── Announcement Types ─────────────────────────────────────────

export type AnnouncementStatus = 'DRAFT' | 'SENT';

export type AnnouncementRole = 'SUPERADMIN' | 'ADMIN' | 'MANAGER' | 'USER';

export interface AnnouncementCreator {
  userId: number;
  firstName: string;
  lastName: string;
}

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
  targetRoles: AnnouncementRole[];     // [] = เป้าหมายทุกคน
  targetBranchIds: number[];           // [] = ทุกสาขา
  status: AnnouncementStatus;
  createdByUserId: number;
  createdAt: string;
  updatedByUserId: number | null;
  updatedAt: string;
  sentAt: string | null;
  sentByUserId: number | null;
  deletedAt: string | null;
  deleteReason: string | null;
  creator: AnnouncementCreator;
  recipients?: AnnouncementRecipient[];
}

export interface CreateAnnouncementDTO {
  title: string;
  content: string;
  targetRoles?: AnnouncementRole[];
  targetBranchIds?: number[];
}

export interface UpdateAnnouncementDTO {
  title?: string;
  content?: string;
  targetRoles?: AnnouncementRole[];
  targetBranchIds?: number[];
}

export interface AnnouncementFilters {
  status?: AnnouncementStatus;
  createdByUserId?: number;
}

export interface SendAnnouncementResult {
  announcement: Announcement;
  recipientCount: number;
}
