/**
 * 📝 Simple script to add test data with the new emergent_name structure
 * This directly adds users to test the updated schema
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';

// ใช้ direct connection สำหรับ seeding
const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DIRECT_URL or DATABASE_URL environment variable is not set');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function addTestUsers() {
  try {
    console.log('🌱 Adding test users with new emergent_name structure...\n');

    // Hash password
    const hashedPassword = await bcrypt.hash('password123', 10);

    // First, get or create a branch
    let branch = await prisma.branch.findFirst({
      where: { code: 'BKK' },
    });

    if (!branch) {
      console.log('🏢 Creating Bangkok branch...');
      branch = await prisma.branch.create({
        data: {
          name: 'Bangkok',
          code: 'BKK',
          address: '123 Sukhumvit Road, Bangkok 10110',
        },
      });
      console.log(`✅ Branch created: ${branch.name}\n`);
    } else {
      console.log(`✅ Using existing branch: ${branch.name}\n`);
    }

    // Check how many users exist
    const userCount = await prisma.user.count();
    console.log(`📊 Current user count: ${userCount}\n`);

    // Add test users with new structure
    const testUsers = [
      {
        employeeId: 'TEST001',
        firstName: 'สมชาย',
        lastName: 'ใจดี',
        email: 'somchai@test.com',
        nationalId: '1111111111111',
        phone: '0812345678',
        emergent_tel: '0887654321',
        emergent_first_name: 'สมหญิง',
        emergent_last_name: 'ใจดี',
        emergent_relation: 'ภรรยา',
      },
      {
        employeeId: 'TEST002',
        firstName: 'วิเชียร',
        lastName: 'สอบใจ',
        email: 'wichian@test.com',
        nationalId: '2222222222222',
        phone: '0898765432',
        emergent_tel: '0881234567',
        emergent_first_name: 'รัตนา',
        emergent_last_name: 'สอบใจ',
        emergent_relation: 'ลูกสาว',
      },
      {
        employeeId: 'TEST003',
        firstName: 'นลินี',
        lastName: 'ศรีทอง',
        email: 'nalini@test.com',
        nationalId: '3333333333333',
        phone: '0865432109',
        emergent_tel: '0889876543',
        emergent_first_name: 'สังวร',
        emergent_last_name: 'ศรีทอง',
        emergent_relation: 'พี่ชาย',
      },
    ];

    let created = 0;
    let skipped = 0;

    for (const userData of testUsers) {
      // Check if user already exists
      const existingUser = await prisma.user.findUnique({
        where: { email: userData.email },
      });

      if (existingUser) {
        console.log(`⏭️  Skipped: ${userData.firstName} ${userData.lastName} (email already exists)`);
        skipped++;
        continue;
      }

      const user = await prisma.user.create({
        data: {
          ...userData,
          password: hashedPassword,
          branchId: branch.branchId,
          role: 'USER',
          status: 'ACTIVE',
          gender: userData.emergent_first_name === 'สมหญิง' || userData.firstName === 'นลินี' ? 'FEMALE' : 'MALE',
          title: userData.firstName === 'นลินี' ? 'MISS' : 'MR',
          birthDate: new Date('1990-01-15'),
          avatarUrl: `https://ui-avatars.com/api/?name=${encodeURIComponent(userData.firstName + ' ' + userData.lastName)}&background=random&size=200`,
        },
      });

      console.log(`✅ Created: ${user.firstName} ${user.lastName}`);
      console.log(`   Emergency Contact: ${user.emergent_first_name} ${user.emergent_last_name} (${user.emergent_relation})\n`);
      created++;
    }

    console.log(`\n📈 Summary:`);
    console.log(`   ✅ Created: ${created} users`);
    console.log(`   ⏭️  Skipped: ${skipped} users`);
    console.log(`\n✨ Done! Test data added successfully.`);
  } catch (error) {
    console.error('❌ Error:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

addTestUsers();
