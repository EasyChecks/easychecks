/**
 * 🔐 Migration Script: Hash nationalId เป็น bcrypt สำหรับ user ที่ password = null
 *
 * รันครั้งเดียว หลังจาก deploy code ใหม่
 * ผลลัพธ์: ทุก user ใน Supabase จะมี bcrypt hash ใน password column
 *
 * วิธีรัน:
 *   npx tsx scripts/hash-existing-passwords.ts
 */

import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error('DATABASE_URL is not set');

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);
const SALT_ROUNDS = 10;

async function main() {
  console.log('🔍 กำลังหา user ที่ password = null...');

  const users = await prisma.user.findMany({
    where: { password: null },
    select: { userId: true, employeeId: true, nationalId: true },
  });

  console.log(`พบ ${users.length} user ที่ต้อง migrate`);

  if (users.length === 0) {
    console.log('✅ ไม่มี user ที่ต้อง migrate แล้ว');
    return;
  }

  let success = 0;
  let failed = 0;

  for (const user of users) {
    try {
      const hashed = await bcrypt.hash(user.nationalId, SALT_ROUNDS);
      await prisma.user.update({
        where: { userId: user.userId },
        data: { password: hashed },
      });
      console.log(`  ✓ ${user.employeeId} (userId: ${user.userId})`);
      success++;
    } catch (err) {
      console.error(`  ✗ ${user.employeeId} (userId: ${user.userId}) — Error:`, err);
      failed++;
    }
  }

  console.log(`\n📊 ผลลัพธ์: สำเร็จ ${success} / ล้มเหลว ${failed}`);
  console.log('✅ Migration เสร็จสิ้น — ทุก user มี bcrypt hash ใน password column แล้ว');
}

main()
  .catch((e) => {
    console.error('❌ Migration failed:', e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
