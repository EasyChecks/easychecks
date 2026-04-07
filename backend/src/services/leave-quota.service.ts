import type { LeaveType, Gender } from '@prisma/client';
import { prisma } from '../lib/prisma.js';
import { BadRequestError } from '../utils/custom-errors.js';
import { LEAVE_RULES } from './leave-rules.js';

export interface EffectiveLeaveRules {
  displayName: string;
  displayNameEng: string;
  iconName: string;
  maxDaysPerYear: number | null;
  maxPaidDaysPerYear: number | null;
  maxDaysTotal?: number | null;
  requireMedicalCert?: boolean | number | null;
  paid: boolean;
  genderRestriction?: Gender | null;
  carryOver?: boolean;
  carryOverMaxDays?: number | null;
}

export type LeaveQuotaScope = 'GLOBAL' | 'BRANCH' | 'DEPARTMENT' | 'USER';

export interface LeaveQuotaOverride {
  overrideId: number;
  scope: LeaveQuotaScope;
  leaveType: LeaveType;
  targetKey: string;
  branchCode: string | null;
  department: string | null;
  userId: number | null;
  maxPaidDaysPerYear: number | null;
  maxDaysPerYear: number | null;
  maxDaysTotal: number | null;
  paid: boolean | null;
  requireDocument: boolean | null;
  documentAfterDays: number | null;
  createdAt: Date;
  updatedAt: Date;
}

export interface LeaveQuotaOverrideInput {
  scope: LeaveQuotaScope;
  leaveType: LeaveType;
  branchCode?: string | null;
  department?: string | null;
  userId?: number | null;
  maxPaidDaysPerYear?: number | null;
  maxDaysPerYear?: number | null;
  maxDaysTotal?: number | null;
  paid?: boolean | null;
  requireDocument?: boolean | null;
  documentAfterDays?: number | null;
}

export interface LeaveQuotaTarget {
  scope: LeaveQuotaScope;
  branchCode?: string | null;
  department?: string | null;
  userId?: number | null;
}

function buildTargetKey(scope: LeaveQuotaScope, target: LeaveQuotaTarget): string {
  switch (scope) {
  case 'GLOBAL':
    return 'GLOBAL';
  case 'BRANCH':
    if (!target.branchCode) throw new BadRequestError('กรุณาระบุ branchCode');
    return `BRANCH:${target.branchCode}`;
  case 'DEPARTMENT':
    if (!target.department) throw new BadRequestError('กรุณาระบุ department');
    return `DEPARTMENT:${target.department}`;
  case 'USER':
    if (!target.userId) throw new BadRequestError('กรุณาระบุ userId');
    return `USER:${target.userId}`;
  default:
    throw new BadRequestError('scope ไม่ถูกต้อง');
  }
}

function mapRequireMedicalCert(override: LeaveQuotaOverride): boolean | number | null {
  if (override.requireDocument === null || override.requireDocument === undefined) {
    return null;
  }
  if (!override.requireDocument) {
    return false;
  }

  const afterDays = override.documentAfterDays ?? 0;
  if (afterDays <= 0) return true;
  return afterDays;
}

function applyOverrideToRules(
  base: EffectiveLeaveRules,
  override: LeaveQuotaOverride,
  includePaidOverride: boolean
): EffectiveLeaveRules {
  const requireMedicalCert = mapRequireMedicalCert(override);

  return {
    ...base,
    maxPaidDaysPerYear: override.maxPaidDaysPerYear ?? base.maxPaidDaysPerYear,
    maxDaysPerYear: override.maxDaysPerYear ?? base.maxDaysPerYear,
    maxDaysTotal: override.maxDaysTotal ?? base.maxDaysTotal,
    requireMedicalCert: requireMedicalCert ?? base.requireMedicalCert,
    paid: includePaidOverride ? (override.paid ?? base.paid) : base.paid,
  };
}

async function getUserContext(userId: number): Promise<{ branchCode: string | null; department: string | null }> {
  const user = await prisma.user.findUnique({
    where: { userId },
    select: {
      department: true,
      branch: { select: { code: true } },
    },
  });

  if (!user) {
    throw new BadRequestError('ไม่พบผู้ใช้');
  }

  return {
    branchCode: user.branch?.code ?? null,
    department: user.department ?? null,
  };
}

async function getOverrideByScope(leaveType: LeaveType, target: LeaveQuotaTarget): Promise<LeaveQuotaOverride | null> {
  const targetKey = buildTargetKey(target.scope, target);
  return prisma.leaveQuotaOverride.findUnique({
    where: {
      scope_leaveType_targetKey: {
        scope: target.scope,
        leaveType,
        targetKey,
      },
    },
  });
}

export async function listOverrides(scope: LeaveQuotaScope, target?: LeaveQuotaTarget): Promise<LeaveQuotaOverride[]> {
  const where: Record<string, unknown> = { scope };
  if (scope === 'BRANCH' && target?.branchCode) where.branchCode = target.branchCode;
  if (scope === 'DEPARTMENT' && target?.department) where.department = target.department;
  if (scope === 'USER' && target?.userId) where.userId = target.userId;

  return prisma.leaveQuotaOverride.findMany({
    where,
    orderBy: [{ leaveType: 'asc' }, { overrideId: 'asc' }],
  });
}

export async function listOverridesByScope(scope: LeaveQuotaScope): Promise<LeaveQuotaOverride[]> {
  return prisma.leaveQuotaOverride.findMany({
    where: { scope },
    orderBy: [{ targetKey: 'asc' }, { leaveType: 'asc' }],
  });
}

export async function upsertOverride(input: LeaveQuotaOverrideInput): Promise<LeaveQuotaOverride> {
  const targetKey = buildTargetKey(input.scope, input);

  return prisma.leaveQuotaOverride.upsert({
    where: {
      scope_leaveType_targetKey: {
        scope: input.scope,
        leaveType: input.leaveType,
        targetKey,
      },
    },
    create: {
      scope: input.scope,
      leaveType: input.leaveType,
      targetKey,
      branchCode: input.branchCode ?? null,
      department: input.department ?? null,
      userId: input.userId ?? null,
      maxPaidDaysPerYear: input.maxPaidDaysPerYear ?? null,
      maxDaysPerYear: input.maxDaysPerYear ?? null,
      maxDaysTotal: input.maxDaysTotal ?? null,
      paid: input.paid ?? null,
      requireDocument: input.requireDocument ?? null,
      documentAfterDays: input.documentAfterDays ?? null,
    },
    update: {
      maxPaidDaysPerYear: input.maxPaidDaysPerYear ?? null,
      maxDaysPerYear: input.maxDaysPerYear ?? null,
      maxDaysTotal: input.maxDaysTotal ?? null,
      paid: input.paid ?? null,
      requireDocument: input.requireDocument ?? null,
      documentAfterDays: input.documentAfterDays ?? null,
      branchCode: input.branchCode ?? null,
      department: input.department ?? null,
      userId: input.userId ?? null,
    },
  });
}

export async function deleteOverride(scope: LeaveQuotaScope, leaveType: LeaveType, target: LeaveQuotaTarget): Promise<void> {
  const targetKey = buildTargetKey(scope, target);
  await prisma.leaveQuotaOverride.delete({
    where: {
      scope_leaveType_targetKey: {
        scope,
        leaveType,
        targetKey,
      },
    },
  });
}

export async function getEffectiveLeaveRulesForUser(
  userId: number,
  options?: { includePaidOverride?: boolean }
): Promise<Record<LeaveType, EffectiveLeaveRules>> {
  const { branchCode, department } = await getUserContext(userId);
  const includePaidOverride = options?.includePaidOverride ?? false;
  const entries = Object.keys(LEAVE_RULES) as LeaveType[];

  const overrides = await prisma.leaveQuotaOverride.findMany({
    where: {
      scope: { in: ['GLOBAL', 'BRANCH', 'DEPARTMENT', 'USER'] },
    },
  });

  const byKey = new Map<string, LeaveQuotaOverride>();
  overrides.forEach((override) => {
    byKey.set(`${override.scope}:${override.leaveType}:${override.targetKey}`, override);
  });

  const rulesByType: Record<LeaveType, EffectiveLeaveRules> = {} as Record<LeaveType, EffectiveLeaveRules>;

  entries.forEach((leaveType) => {
    let effective: EffectiveLeaveRules = { ...LEAVE_RULES[leaveType] } as EffectiveLeaveRules;

    const globalOverride = byKey.get(`GLOBAL:${leaveType}:GLOBAL`);
    if (globalOverride) {
      effective = applyOverrideToRules(effective, globalOverride, includePaidOverride);
    }

    if (branchCode) {
      const branchKey = `BRANCH:${leaveType}:BRANCH:${branchCode}`;
      const branchOverride = byKey.get(branchKey);
      if (branchOverride) {
        effective = applyOverrideToRules(effective, branchOverride, includePaidOverride);
      }
    }

    if (department) {
      const deptKey = `DEPARTMENT:${leaveType}:DEPARTMENT:${department}`;
      const deptOverride = byKey.get(deptKey);
      if (deptOverride) {
        effective = applyOverrideToRules(effective, deptOverride, includePaidOverride);
      }
    }

    const userKey = `USER:${leaveType}:USER:${userId}`;
    const userOverride = byKey.get(userKey);
    if (userOverride) {
      effective = applyOverrideToRules(effective, userOverride, includePaidOverride);
    }

    rulesByType[leaveType] = effective;
  });

  return rulesByType;
}

export async function getEffectiveLeaveRulesForTarget(
  target: LeaveQuotaTarget,
  options?: { includePaidOverride?: boolean }
): Promise<Record<LeaveType, EffectiveLeaveRules>> {
  if (target.scope === 'USER' && target.userId) {
    return getEffectiveLeaveRulesForUser(target.userId, options);
  }

  const includePaidOverride = options?.includePaidOverride ?? false;
  const entries = Object.keys(LEAVE_RULES) as LeaveType[];

  const overrides = await prisma.leaveQuotaOverride.findMany({
    where: {
      scope: { in: ['GLOBAL', 'BRANCH', 'DEPARTMENT', 'USER'] },
    },
  });

  const byKey = new Map<string, LeaveQuotaOverride>();
  overrides.forEach((override) => {
    byKey.set(`${override.scope}:${override.leaveType}:${override.targetKey}`, override);
  });

  const rulesByType: Record<LeaveType, EffectiveLeaveRules> = {} as Record<LeaveType, EffectiveLeaveRules>;

  entries.forEach((leaveType) => {
    let effective: EffectiveLeaveRules = { ...LEAVE_RULES[leaveType] } as EffectiveLeaveRules;

    const globalOverride = byKey.get(`GLOBAL:${leaveType}:GLOBAL`);
    if (globalOverride) {
      effective = applyOverrideToRules(effective, globalOverride, includePaidOverride);
    }

    if (target.scope === 'BRANCH' && target.branchCode) {
      const branchKey = `BRANCH:${leaveType}:BRANCH:${target.branchCode}`;
      const branchOverride = byKey.get(branchKey);
      if (branchOverride) {
        effective = applyOverrideToRules(effective, branchOverride, includePaidOverride);
      }
    }

    if (target.scope === 'DEPARTMENT' && target.department) {
      const deptKey = `DEPARTMENT:${leaveType}:DEPARTMENT:${target.department}`;
      const deptOverride = byKey.get(deptKey);
      if (deptOverride) {
        effective = applyOverrideToRules(effective, deptOverride, includePaidOverride);
      }
    }

    if (target.scope === 'USER' && target.userId) {
      const userKey = `USER:${leaveType}:USER:${target.userId}`;
      const userOverride = byKey.get(userKey);
      if (userOverride) {
        effective = applyOverrideToRules(effective, userOverride, includePaidOverride);
      }
    }

    rulesByType[leaveType] = effective;
  });

  return rulesByType;
}

export async function getOverrideForScope(leaveType: LeaveType, target: LeaveQuotaTarget): Promise<LeaveQuotaOverride | null> {
  return getOverrideByScope(leaveType, target);
}
