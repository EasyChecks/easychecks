import { prisma } from '../lib/prisma.js';

/**
 * ดึง policy ทั้งหมดที่ active
 */
export const getAllPolicies = async () => {
  return prisma.policy.findMany({
    where: { isActive: true },
    orderBy: { policyId: 'asc' },
  });
};

/**
 * ดึง policy ตาม key เช่น 'privacy', 'terms'
 */
export const getPolicyByKey = async (key: string) => {
  const policy = await prisma.policy.findUnique({
    where: { key },
  });

  if (!policy) {
    throw new Error('ไม่พบนโยบายที่ระบุ');
  }

  return policy;
};
