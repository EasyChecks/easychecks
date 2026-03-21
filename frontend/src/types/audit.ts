export interface AuditUser {
  userId: number;
  firstName: string;
  lastName: string;
  employeeId?: string;
}

export interface AuditLog {
  logId: number;
  userId?: number;
  action: string;
  targetTable: string;
  targetId: number;
  oldValues?: Record<string, unknown>;
  newValues?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
  createdAt: string;
  user?: AuditUser;
}

export interface AuditListParams {
  userId?: number;
  action?: string;
  targetTable?: string;
  targetId?: number;
  startDate?: string;
  endDate?: string;
  limit?: number;
}
