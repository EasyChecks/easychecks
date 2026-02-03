import { PrismaClient, Gender } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { faker } from '@faker-js/faker';
import 'dotenv/config';

/**
 * 🔄 Script สำหรับอัปเดต users ที่มี birthDate = null และ gender
 * - ใช้ faker.js สร้าง birthDate ให้พนักงานที่ไม่มี
 * - อายุจะอยู่ในช่วง 22-55 ปี
 */

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter } as any);

async function updateUsersBirthDateAndGender() {
  console.log('🔄 Starting update users birthDate and gender...\n');

  // ดึง users ทั้งหมด
  const users = await prisma.user.findMany({
    select: {
      userId: true,
      firstName: true,
      lastName: true,
      birthDate: true,
      gender: true,
    },
  });

  console.log(`📊 Found ${users.length} users total\n`);

  let updatedCount = 0;
  let skippedCount = 0;

  for (const user of users) {
    const updates: any = {};
    let needsUpdate = false;

    // อัปเดต birthDate ถ้าเป็น null
    if (!user.birthDate) {
      // สร้าง birthDate ที่ทำให้อายุอยู่ในช่วง 22-55 ปี
      const minAge = 22;
      const maxAge = 55;
      const today = new Date();
      const minDate = new Date(today.getFullYear() - maxAge, 0, 1); // 55 ปีก่อน
      const maxDate = new Date(today.getFullYear() - minAge, 11, 31); // 22 ปีก่อน
      
      updates.birthDate = faker.date.between({ from: minDate, to: maxDate });
      needsUpdate = true;
    }

    // ถ้ามีการอัปเดต
    if (needsUpdate) {
      await prisma.user.update({
        where: { userId: user.userId },
        data: updates,
      });

      console.log(`✅ Updated user ${user.userId}: ${user.firstName} ${user.lastName}`);
      if (updates.birthDate) {
        const age = Math.floor((new Date().getTime() - new Date(updates.birthDate).getTime()) / (365.25 * 24 * 60 * 60 * 1000));
        console.log(`   📅 BirthDate: ${updates.birthDate.toISOString().split('T')[0]} (อายุ ${age} ปี)`);
      }
      updatedCount++;
    } else {
      skippedCount++;
    }
  }

  console.log('\n' + '='.repeat(50));
  console.log(`✅ Updated: ${updatedCount} users`);
  console.log(`⏭️  Skipped: ${skippedCount} users (already have birthDate)`);
  console.log('='.repeat(50));
}

async function main() {
  try {
    await updateUsersBirthDateAndGender();
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main();
