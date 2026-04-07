import type { Request, Response } from 'express';
import type { LeaveType } from '@prisma/client';
import { asyncHandler } from '../utils/async-handler.js';
import { BadRequestError } from '../utils/custom-errors.js';
import { sendSuccess } from '../utils/response.js';
import { prisma } from '../lib/prisma.js';
import {
  getEffectiveLeaveRulesForTarget,
  listOverrides,
  listOverridesByScope,
  upsertOverride,
  deleteOverride,
  type LeaveQuotaScope,
} from '../services/leave-quota.service.js';
import { LEAVE_RULES } from '../services/leave-rules.js';

function parseScope(value: unknown): LeaveQuotaScope {
  const scope = String(value ?? '').toUpperCase();
  if (!scope) throw new BadRequestError('กรุณาระบุ scope');
  if (!['GLOBAL', 'BRANCH', 'DEPARTMENT', 'USER'].includes(scope)) {
    throw new BadRequestError('scope ไม่ถูกต้อง');
  }
  return scope as LeaveQuotaScope;
}

function parseLeaveType(value: unknown): LeaveType {
  const leaveType = String(value ?? '').toUpperCase();
  if (!leaveType) throw new BadRequestError('กรุณาระบุ leaveType');
  if (!(leaveType in LEAVE_RULES)) {
    throw new BadRequestError('leaveType ไม่ถูกต้อง');
  }
  return leaveType as LeaveType;
}

function buildTarget(scope: LeaveQuotaScope, source: Record<string, unknown>) {
  const target = {
    scope,
    branchCode: source.branchCode ? String(source.branchCode) : null,
    department: source.department ? String(source.department) : null,
    userId: source.userId ? Number(source.userId) : null,
  };

  if (scope === 'BRANCH' && !target.branchCode) {
    throw new BadRequestError('กรุณาระบุ branchCode');
  }
  if (scope === 'DEPARTMENT' && !target.department) {
    throw new BadRequestError('กรุณาระบุ department');
  }
  if (scope === 'USER' && !target.userId) {
    throw new BadRequestError('กรุณาระบุ userId');
  }

  return target;
}

async function applyAdminBranchScope(
  req: Request,
  scope: LeaveQuotaScope,
  source: Record<string, unknown>
): Promise<{ scope: LeaveQuotaScope; source: Record<string, unknown> }> {
  if (req.user?.role !== 'ADMIN') {
    return { scope, source };
  }

  if (scope !== 'GLOBAL' && scope !== 'BRANCH') {
    return { scope, source };
  }

  if (!req.user.branchId) {
    throw new BadRequestError('ไม่พบสาขาของผู้ดูแลระบบ');
  }

  const branch = await prisma.branch.findUnique({
    where: { branchId: req.user.branchId },
    select: { code: true },
  });

  if (!branch?.code) {
    throw new BadRequestError('ไม่พบข้อมูลสาขาของผู้ดูแลระบบ');
  }

  return {
    scope: 'BRANCH',
    source: { ...source, branchCode: branch.code },
  };
}

function mapRequireDocument(requireMedicalCert?: boolean | number | null) {
  if (!requireMedicalCert) {
    return { requireDocument: false, documentAfterDays: 0 };
  }
  if (typeof requireMedicalCert === 'number') {
    return { requireDocument: true, documentAfterDays: requireMedicalCert };
  }
  return { requireDocument: true, documentAfterDays: 0 };
}

export const getEffectiveQuota = asyncHandler(async (req: Request, res: Response) => {
  const parsedScope = parseScope(req.query.scope);
  const scoped = await applyAdminBranchScope(req, parsedScope, req.query as Record<string, unknown>);
  const target = buildTarget(scoped.scope, scoped.source);

  const rulesByType = await getEffectiveLeaveRulesForTarget(target, { includePaidOverride: true });
  const leaveTypes = Object.keys(rulesByType) as LeaveType[];

  const data = leaveTypes.map((leaveType) => {
    const rules = rulesByType[leaveType];
    const { requireDocument, documentAfterDays } = mapRequireDocument(rules.requireMedicalCert);

    return {
      leaveType,
      displayName: rules.displayName,
      displayNameEng: rules.displayNameEng,
      iconName: rules.iconName,
      rules: {
        maxDaysPerYear: rules.maxDaysPerYear ?? null,
        maxPaidDaysPerYear: rules.maxPaidDaysPerYear ?? null,
        maxDaysTotal: rules.maxDaysTotal ?? null,
        paid: rules.paid ?? false,
        requireDocument,
        documentAfterDays,
        genderRestriction: rules.genderRestriction ?? null,
      },
    };
  });

  sendSuccess(res, data, 'ดึงโควต้าที่มีผลใช้งานสำเร็จ');
});

export const getOverrides = asyncHandler(async (req: Request, res: Response) => {
  const parsedScope = parseScope(req.query.scope);
  const scoped = await applyAdminBranchScope(req, parsedScope, req.query as Record<string, unknown>);
  const target = buildTarget(scoped.scope, scoped.source);
  const overrides = await listOverrides(scoped.scope, target);
  sendSuccess(res, overrides, 'ดึงรายการโควต้าที่แก้ไขสำเร็จ');
});

export const getOverridesByScope = asyncHandler(async (req: Request, res: Response) => {
  const parsedScope = parseScope(req.query.scope);
  const scoped = await applyAdminBranchScope(req, parsedScope, req.query as Record<string, unknown>);
  const overrides = await listOverridesByScope(scoped.scope);
  sendSuccess(res, overrides, 'ดึงรายการโควต้าตาม scope สำเร็จ');
});

export const saveOverride = asyncHandler(async (req: Request, res: Response) => {
  const parsedScope = parseScope(req.body.scope);
  const scoped = await applyAdminBranchScope(req, parsedScope, req.body as Record<string, unknown>);
  const leaveType = parseLeaveType(req.body.leaveType);
  const target = buildTarget(scoped.scope, scoped.source);

  const maxPaidRaw = req.body.maxPaidDaysPerYear;
  const maxDaysPerYearRaw = req.body.maxDaysPerYear;
  const maxTotalRaw = req.body.maxDaysTotal;
  const docAfterRaw = req.body.documentAfterDays;
  const paidRaw = req.body.paid;
  const requireDocRaw = req.body.requireDocument;

  const maxPaidDaysPerYear = maxPaidRaw === null || maxPaidRaw === undefined || maxPaidRaw === ''
    ? null
    : Number(maxPaidRaw);
  const maxDaysPerYear = maxDaysPerYearRaw === null || maxDaysPerYearRaw === undefined || maxDaysPerYearRaw === ''
    ? null
    : Number(maxDaysPerYearRaw);
  const maxDaysTotal = maxTotalRaw === null || maxTotalRaw === undefined || maxTotalRaw === ''
    ? null
    : Number(maxTotalRaw);
  const documentAfterDays = docAfterRaw === null || docAfterRaw === undefined || docAfterRaw === ''
    ? null
    : Number(docAfterRaw);
  const paid = paidRaw === null || paidRaw === undefined ? null : Boolean(paidRaw);
  const requireDocument = requireDocRaw === null || requireDocRaw === undefined ? null : Boolean(requireDocRaw);

  const payload = {
    scope: scoped.scope,
    leaveType,
    branchCode: target.branchCode,
    department: target.department,
    userId: target.userId,
    maxPaidDaysPerYear,
    maxDaysPerYear,
    maxDaysTotal,
    paid,
    requireDocument,
    documentAfterDays,
  };

  const override = await upsertOverride(payload);
  sendSuccess(res, override, 'บันทึกโควต้าสำเร็จ');
});

export const removeOverride = asyncHandler(async (req: Request, res: Response) => {
  const parsedScope = parseScope(req.body.scope);
  const scoped = await applyAdminBranchScope(req, parsedScope, req.body as Record<string, unknown>);
  const leaveType = parseLeaveType(req.body.leaveType);
  const target = buildTarget(scoped.scope, scoped.source);

  await deleteOverride(scoped.scope, leaveType, target);
  sendSuccess(res, null, 'ลบโควต้าที่แก้ไขสำเร็จ');
});
