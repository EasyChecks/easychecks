import api from './api';
import type { LeaveQuotaSettings, LeaveType } from '@/types/leave';

export type LeaveQuotaScope = 'GLOBAL' | 'BRANCH' | 'DEPARTMENT' | 'USER';

export interface LeaveQuotaOverride {
  overrideId: number;
  scope: LeaveQuotaScope;
  leaveType: LeaveType;
  targetKey: string;
  branchCode?: string | null;
  department?: string | null;
  userId?: number | null;
  maxDaysPerYear: number | null;
  maxPaidDaysPerYear: number | null;
  maxDaysTotal: number | null;
  paid: boolean | null;
  requireDocument: boolean | null;
  documentAfterDays: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeaveQuotaEffectiveItem {
  leaveType: LeaveType;
  displayName: string;
  displayNameEng: string;
  iconName: string;
  rules: LeaveQuotaSettings & { genderRestriction?: string | null };
}

export interface LeaveQuotaTargetParams {
  scope: LeaveQuotaScope;
  branchCode?: string;
  department?: string;
  userId?: number;
}

export const leaveQuotaService = {
  async getEffectiveQuotas(params: LeaveQuotaTargetParams) {
    const res = await api.get('/leave-quotas/effective', { params });
    return res.data.data as LeaveQuotaEffectiveItem[];
  },

  async getOverrides(params: LeaveQuotaTargetParams) {
    const res = await api.get('/leave-quotas/overrides', { params });
    return res.data.data as LeaveQuotaOverride[];
  },

  async getOverridesByScope(scope: LeaveQuotaScope) {
    const res = await api.get('/leave-quotas/overrides/all', { params: { scope } });
    return res.data.data as LeaveQuotaOverride[];
  },

  async saveOverride(payload: LeaveQuotaTargetParams & { leaveType: LeaveType } & LeaveQuotaSettings) {
    const res = await api.put('/leave-quotas', payload);
    return res.data.data as LeaveQuotaOverride;
  },

  async deleteOverride(payload: LeaveQuotaTargetParams & { leaveType: LeaveType }) {
    const res = await api.delete('/leave-quotas', { data: payload });
    return res.data.data;
  },
};
