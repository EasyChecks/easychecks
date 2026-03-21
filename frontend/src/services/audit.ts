import api from './api';
import { AuditListParams, AuditLog } from '@/types/audit';

type RawAuditLog = Record<string, unknown> & {
  user?: Record<string, unknown>;
};

function mapAuditLog(raw: RawAuditLog): AuditLog {
  const userRaw = raw.user;

  return {
    logId: Number(raw.logId ?? raw.log_id ?? 0),
    userId: raw.userId != null ? Number(raw.userId) : (raw.user_id != null ? Number(raw.user_id) : undefined),
    action: String(raw.action ?? ''),
    targetTable: String(raw.targetTable ?? raw.target_table ?? ''),
    targetId: Number(raw.targetId ?? raw.target_id ?? 0),
    oldValues: (raw.oldValues ?? raw.old_values ?? undefined) as Record<string, unknown> | undefined,
    newValues: (raw.newValues ?? raw.new_values ?? undefined) as Record<string, unknown> | undefined,
    ipAddress: (raw.ipAddress ?? raw.ip_address ?? undefined) as string | undefined,
    userAgent: (raw.userAgent ?? raw.user_agent ?? undefined) as string | undefined,
    createdAt: String(raw.createdAt ?? raw.created_on ?? ''),
    user: userRaw
      ? {
          userId: Number(userRaw.userId ?? userRaw.user_id ?? 0),
          firstName: String(userRaw.firstName ?? ''),
          lastName: String(userRaw.lastName ?? ''),
          employeeId: userRaw.employeeId != null ? String(userRaw.employeeId) : undefined,
        }
      : undefined,
  };
}

export const auditService = {
  async getLogs(params?: AuditListParams): Promise<AuditLog[]> {
    const response = await api.get('/audit', { params });
    return (response.data.data ?? []).map((item: RawAuditLog) => mapAuditLog(item));
  },

  async getActions(): Promise<string[]> {
    const response = await api.get('/audit/actions');
    return Object.values(response.data.data ?? {});
  },
};

export default auditService;
