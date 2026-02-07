import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is required');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('🌱 Restoring Supabase data...\n');

  try {
    // Hash password
    const hashedPassword = await bcrypt.hash('password123', 10);

    // 1️⃣ สร้างสาขา
    console.log('🏢 Creating branches...');
    await prisma.branch.deleteMany();
    
    const branches = await Promise.all([
      prisma.branch.create({
        data: {
          code: 'BKK',
          name: 'Bangkok Branch',
          address: '123 Silom, Bangkok',
        },
      }),
      prisma.branch.create({
        data: {
          code: 'CNX',
          name: 'Chiang Mai Branch',
          address: '456 Nimmanhaemin, Chiang Mai',
        },
      }),
    ]);
    console.log(`✅ Created ${branches.length} branches\n`);

    // 2️⃣ สร้างผู้ใช้
    console.log('👥 Creating users...');
    await prisma.user.deleteMany();

    const testUsers = [
      {
        employeeId: 'EMP001',
        firstName: 'Test',
        lastName: 'Admin',
        email: 'admin@test.com',
        phone: '0812345678',
        nationalId: '1234567890123',
        emergent_name: 'Emergency Contact',
        emergent_tel: '0987654321',
        emergent_relation: 'Friend',
        role: 'ADMIN',
      },
      {
        employeeId: 'EMP002',
        firstName: 'John',
        lastName: 'User',
        email: 'user@test.com',
        phone: '0898765432',
        nationalId: '9876543210123',
        emergent_name: 'Emergency Contact',
        emergent_tel: '0912345678',
        emergent_relation: 'Family',
        role: 'USER',
      },
      {
        employeeId: 'EMP003',
        firstName: 'Jane',
        lastName: 'Manager',
        email: 'manager@test.com',
        phone: '0865432109',
        nationalId: '5555555555555',
        emergent_name: 'Emergency Contact',
        emergent_tel: '0956789012',
        emergent_relation: 'Spouse',
        role: 'MANAGER',
      },
    ];

    const createdUsers = await Promise.all(
      testUsers.map((user) =>
        prisma.user.create({
          data: {
            ...user,
            password: hashedPassword,
            branchId: branches[0].branchId,
          },
        })
      )
    );
    console.log(`✅ Created ${createdUsers.length} users\n`);

    // 3️⃣ สร้าง Shifts
    console.log('⏰ Creating shifts...');
    await prisma.shift.deleteMany();

    const shifts = await Promise.all([
      prisma.shift.create({
        data: {
          name: 'Morning Shift',
          startTime: '09:00',
          endTime: '18:00',
          shiftType: 'REGULAR',
          userId: createdUsers[0].userId, // Assign to admin
        },
      }),
      prisma.shift.create({
        data: {
          name: 'Evening Shift',
          startTime: '18:00',
          endTime: '02:00',
          shiftType: 'REGULAR',
          userId: createdUsers[0].userId,
        },
      }),
    ]);
    console.log(`✅ Created ${shifts.length} shifts\n`);

    // 4️⃣ สร้าง Locations
    console.log('📍 Creating locations...');
    await prisma.location.deleteMany();

    const locations = await Promise.all([
      prisma.location.create({
        data: {
          locationName: 'Head Office Bangkok',
          latitude: 13.7563,
          longitude: 100.5018,
          radius: 100,
          address: 'Bangkok, Thailand',
          userId: createdUsers[0].userId, // Assign to admin
        },
      }),
      prisma.location.create({
        data: {
          locationName: 'Chiang Mai Office',
          latitude: 18.7883,
          longitude: 98.9853,
          radius: 100,
          address: 'Chiang Mai, Thailand',
          userId: createdUsers[0].userId,
        },
      }),
    ]);
    console.log(`✅ Created ${locations.length} locations\n`);

    console.log('✨ ✨ ✨ Database restored successfully! ✨ ✨ ✨\n');
    console.log('📊 Summary:');
    console.log(`   - Branches: ${branches.length}`);
    console.log(`   - Users: ${createdUsers.length}`);
    console.log(`   - Shifts: ${shifts.length}`);
    console.log(`   - Locations: ${locations.length}`);
    console.log('\n🔑 Test Login:');
    console.log('   employeeId: EMP001');
    console.log('   password: password123\n');
  } catch (error) {
    console.error('❌ Seeding error:', error);
    throw error;
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
