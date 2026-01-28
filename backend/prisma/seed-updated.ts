import 'dotenv/config';
import { PrismaClient, Role, UserStatus, AttendanceStatus, LeaveType, LeaveStatus, ShiftType, DayOfWeek } from '@prisma/client';
import { faker } from '@faker-js/faker/locale/th';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import { uploadAvatarToSupabase, ensureBucketExists } from '../src/utils/supabase-storage.js';

// ใช้ direct connection สำหรับ seeding
const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DIRECT_URL or DATABASE_URL environment variable is not set');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

// ชื่อไทยสำหรับสุ่ม
const thaiFirstNames = [
  'สมชาย', 'สมหญิง', 'วิชัย', 'วิภา', 'ประเสริฐ', 'ประภา',
  'นิรันดร์', 'นิภา', 'สุรชัย', 'สุภา', 'ธนพล', 'ธัญญา',
  'อนุชา', 'อรุณี', 'พิชัย', 'พิมพ์', 'ชัยวัฒน์', 'ชนิดา',
  'ไพบูลย์', 'ไพลิน', 'เกียรติ', 'กมลทิพย์', 'ราชัน', 'รัชนี'
];

const thaiLastNames = [
  'ใจดี', 'มีสุข', 'รักษ์ดี', 'พัฒนา', 'เจริญสุข', 'สุขใจ',
  'วงศ์ดี', 'ศรีสุข', 'มั่นคง', 'สมบูรณ์', 'เพชรรัตน์', 'ทองคำ',
  'แสงจันทร์', 'ดวงใจ', 'สว่างวงศ์', 'บุญมี', 'ชัยชนะ', 'วิชัยยุทธ'
];

const thaiNicknames = [
  'เอ', 'บี', 'ซี', 'ดี', 'เอ็ม', 'เจ', 'เค', 'แอล',
  'นิว', 'ปอนด์', 'พลอย', 'มิ้นต์', 'เฟิร์น', 'เจมส์',
  'โอม', 'ปุ๋ย', 'อ้อม', 'บิว', 'บอล', 'แบงค์'
];

const relations = ['บิดา', 'มารดา', 'สามี', 'ภรรยา', 'พี่ชาย', 'พี่สาว', 'น้องชาย', 'น้องสาว'];

// สร้างเลขบัตรประชาชนแบบสุ่ม 13 หลัก
function generateNationalId(): string {
  return Array.from({ length: 13 }, () => faker.number.int({ min: 0, max: 9 })).join('');
}

// สร้างเบอร์โทรไทย
function generateThaiPhone(): string {
  return `0${faker.number.int({ min: 800000000, max: 999999999 })}`;
}

function getThaiName() {
  return {
    firstName: faker.helpers.arrayElement(thaiFirstNames),
    lastName: faker.helpers.arrayElement(thaiLastNames),
    nickname: faker.helpers.arrayElement(thaiNicknames),
  };
}

// รูปโปรไฟล์จาก RandomUser API (ไม่อัปโหลด Supabase เพื่อความเร็ว)
async function getAvatarUrl(employeeId: string, index: number): Promise<string> {
  // ใช้ RandomUser API โดยตรง (รูปคนจริง) ไม่ต้องอัปโหลดขึ้น Supabase
  const gender = index % 2 === 0 ? 'men' : 'women';
  const imageNumber = (index % 100); // 0-99
  return `https://randomuser.me/api/portraits/${gender}/${imageNumber}.jpg`;
}

async function main() {
  console.log('🌱 เริ่ม seeding ข้อมูลทดสอบ (Updated Schema)...\n');

  // ข้ามการตรวจสอบ Supabase bucket เพราะไม่ใช้แล้ว
  // console.log('📦 ตรวจสอบ Supabase Storage Bucket...');
  // await ensureBucketExists();
  // console.log('');

  // ลบข้อมูลเก่าทั้งหมด
  console.log('🗑️  ลบข้อมูลเก่า...');
  await prisma.location.deleteMany();
  await prisma.downloadLog.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.leaveRequest.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.user.deleteMany();
  await prisma.branch.deleteMany();
  
  // Reset sequences สำหรับทุก table (ใช้ชื่อ table ที่ map แล้วจาก @@map)
  await prisma.$executeRawUnsafe(`ALTER SEQUENCE branches_branch_id_seq RESTART WITH 1`);
  await prisma.$executeRawUnsafe(`ALTER SEQUENCE users_user_id_seq RESTART WITH 1`);
  await prisma.$executeRawUnsafe(`ALTER SEQUENCE locations_location_id_seq RESTART WITH 1`);
  await prisma.$executeRawUnsafe(`ALTER SEQUENCE shifts_shift_id_seq RESTART WITH 1`);
  await prisma.$executeRawUnsafe(`ALTER SEQUENCE attendance_attendance_id_seq RESTART WITH 1`);
  await prisma.$executeRawUnsafe(`ALTER SEQUENCE leave_requests_leave_id_seq RESTART WITH 1`);
  await prisma.$executeRawUnsafe(`ALTER SEQUENCE notifications_notification_id_seq RESTART WITH 1`);
  await prisma.$executeRawUnsafe(`ALTER SEQUENCE audit_logs_log_id_seq RESTART WITH 1`);
  await prisma.$executeRawUnsafe(`ALTER SEQUENCE download_logs_log_id_seq RESTART WITH 1`);
  
  console.log('✅ ลบข้อมูลเก่าและ reset sequences เสร็จแล้ว\n');

  // 1. สร้างสาขา (เริ่มจาก 1)
  console.log('🏢 สร้างสาขา...');
  const branches = await Promise.all([
    prisma.branch.create({
      data: {
        name: 'สำนักงานใหญ่',
        code: 'BKK',
        address: '123 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ 10110',
      },
    }),
    prisma.branch.create({
      data: {
        name: 'สาขาเชียงใหม่',
        code: 'CNX',
        address: '456 ถนนห้วยแก้ว ตำบลสุเทพ อำเภอเมือง เชียงใหม่ 50200',
      },
    }),
    prisma.branch.create({
      data: {
        name: 'สาขาภูเก็ต',
        code: 'HKT',
        address: '789 ถนนภูเก็ต ตำบลตลาดใหญ่ อำเภอเมือง ภูเก็ต 83000',
      },
    }),
  ]);
  console.log(`✅ สร้าง ${branches.length} สาขาแล้ว (branchId: ${branches.map(b => b.branchId).join(', ')})\n`);

  // 2. สร้าง Superadmin (ไม่มีสาขา)
  console.log('👥 สร้างผู้ใช้...');
  const superadminNationalId = generateNationalId();
  const superadmin = await prisma.user.create({
    data: {
      employeeId: 'SA001',
      firstName: 'ผู้จัดการ',
      lastName: 'ระบบ',
      nickname: 'Admin',
      nationalId: superadminNationalId,
      emergent_name: 'บริษัท GGS',
      emergent_tel: generateThaiPhone(),
      emergent_relation: 'ติดต่อฉุกเฉิน',
      phone: generateThaiPhone(),
      email: 'superadmin@easycheck.com',
      password: superadminNationalId, // ใช้เลขบัตรประชาชนเป็น password
      avatarUrl: await getAvatarUrl('SA001', 0),
      branchId: null, // Superadmin ไม่มีสาขา
      role: Role.SUPERADMIN,
      status: UserStatus.ACTIVE,
    },
  });
  console.log(`✅ สร้าง SUPERADMIN: ${superadmin.firstName} ${superadmin.lastName} (userId: ${superadmin.userId})`);

  // 3. สร้าง Admins แต่ละสาขา (แต่ละสาขา 1 คน)
  const admins = [];
  let employeeCounter = { BKK: 1, CNX: 1, HKT: 1 };
  
  for (const branch of branches) {
    const name = getThaiName();
    const nationalId = generateNationalId();
    const admin = await prisma.user.create({
      data: {
        employeeId: `${branch.code}${String(employeeCounter[branch.code]++).padStart(4, '0')}`,
        firstName: name.firstName,
        lastName: name.lastName,
        nickname: name.nickname,
        nationalId,
        emergent_name: faker.helpers.arrayElement(thaiFirstNames) + ' ' + faker.helpers.arrayElement(thaiLastNames),
        emergent_tel: generateThaiPhone(),
        emergent_relation: faker.helpers.arrayElement(relations),
        phone: generateThaiPhone(),
        email: `admin.${branch.code.toLowerCase()}@easycheck.com`,
        password: nationalId,
        avatarUrl: await getAvatarUrl(`${branch.code}${String(employeeCounter[branch.code] - 1).padStart(4, '0')}`, admins.length + 1),
        branchId: branch.branchId,
        role: Role.ADMIN,
        status: UserStatus.ACTIVE,
      },
    });
    admins.push(admin);
    console.log(`✅ สร้าง ADMIN (${branch.code}): ${admin.firstName} ${admin.lastName} (${admin.employeeId})`);
  }

  // 4. สร้าง Managers (แต่ละสาขา 2 คน)
  const managers = [];
  for (const branch of branches) {
    for (let i = 0; i < 2; i++) {
      const name = getThaiName();
      const nationalId = generateNationalId();
      const employeeId = `${branch.code}${String(employeeCounter[branch.code]++).padStart(4, '0')}`;
      const manager = await prisma.user.create({
        data: {
          employeeId,
          firstName: name.firstName,
          lastName: name.lastName,
          nickname: name.nickname,
          nationalId,
          emergent_name: faker.helpers.arrayElement(thaiFirstNames) + ' ' + faker.helpers.arrayElement(thaiLastNames),
          emergent_tel: generateThaiPhone(),
          emergent_relation: faker.helpers.arrayElement(relations),
          phone: generateThaiPhone(),
          email: `${name.firstName.toLowerCase()}.${branch.code.toLowerCase()}${i}@easycheck.com`,
          password: nationalId,
          avatarUrl: await getAvatarUrl(employeeId, managers.length + admins.length + 2),
          branchId: branch.branchId,
          role: Role.MANAGER,
          status: UserStatus.ACTIVE,
        },
      });
      managers.push(manager);
    }
  }
  console.log(`✅ สร้าง ${managers.length} MANAGER แล้ว\n`);

  // 5. สร้าง Users (แต่ละสาขา 10 คน)
  const users = [];
  for (const branch of branches) {
    for (let i = 0; i < 10; i++) {
      const name = getThaiName();
      const nationalId = generateNationalId();
      const employeeId = `${branch.code}${String(employeeCounter[branch.code]++).padStart(4, '0')}`;
      const user = await prisma.user.create({
        data: {
          employeeId,
          firstName: name.firstName,
          lastName: name.lastName,
          nickname: name.nickname,
          nationalId,
          emergent_name: faker.helpers.arrayElement(thaiFirstNames) + ' ' + faker.helpers.arrayElement(thaiLastNames),
          emergent_tel: generateThaiPhone(),
          emergent_relation: faker.helpers.arrayElement(relations),
          phone: generateThaiPhone(),
          email: `${employeeId.toLowerCase()}@easycheck.com`,
          password: nationalId,
          avatarUrl: await getAvatarUrl(employeeId, users.length + managers.length + admins.length + 3),
          branchId: branch.branchId,
          role: Role.USER,
          status: faker.helpers.arrayElement([
            UserStatus.ACTIVE,
            UserStatus.ACTIVE,
            UserStatus.ACTIVE,
            UserStatus.ACTIVE,
            UserStatus.SUSPENDED,
          ]),
        },
      });
      users.push(user);
    }
  }
  console.log(`✅ สร้าง ${users.length} USER แล้ว\n`);

  // 6. สร้าง Locations
  console.log('📍 สร้าง Locations...');
  const locationData = [
    { name: 'สำนักงานใหญ่ กรุงเทพ', lat: 13.7563, lng: 100.5018, radius: 100 },
    { name: 'สาขาเชียงใหม่', lat: 18.7883, lng: 98.9853, radius: 150 },
    { name: 'สาขาภูเก็ต', lat: 7.8804, lng: 98.3923, radius: 120 },
  ];

  const locations = [];
  for (let i = 0; i < 3; i++) {
    const admin = admins[i % admins.length];
    const location = await prisma.location.create({
      data: {
        locationName: locationData[i].name,
        latitude: locationData[i].lat,
        longitude: locationData[i].lng,
        radius: locationData[i].radius,
        userId: admin.userId,
        role: admin.role,
      },
    });
    locations.push(location);
  }
  console.log(`✅ สร้าง 3 locations แล้ว\n`);

  // 7. สร้าง Shifts (ตารางงาน)
  console.log('⏰ สร้าง Shifts...');
  const shiftTemplates = [
    { name: 'กะเช้า', type: 'REGULAR', start: '08:00', end: '17:00', grace: 15, late: 30 },
    { name: 'กะบ่าย', type: 'REGULAR', start: '13:00', end: '22:00', grace: 15, late: 30 },
    { name: 'กะดึก', type: 'REGULAR', start: '22:00', end: '06:00', grace: 15, late: 30 },
  ];

  let shiftCount = 0;
  // สร้างกะให้พนักงาน 20 คนแรก (superadmin, admins, managers, และ users บางคน)
  const usersWithShifts = [superadmin, ...admins, ...managers, ...users.slice(0, 10)];
  
  for (const user of usersWithShifts) {
    // แต่ละคนได้ 1-2 กะ
    const numShifts = faker.number.int({ min: 1, max: 2 });
    const selectedTemplates = faker.helpers.shuffle(shiftTemplates).slice(0, numShifts);
    
    for (const template of selectedTemplates) {
      // เลือก location ที่สุ่ม
      const location = faker.helpers.arrayElement(locations);
      
      await prisma.shift.create({
        data: {
          name: template.name,
          shiftType: template.type as ShiftType,
          startTime: template.start,
          endTime: template.end,
          gracePeriodMinutes: template.grace,
          lateThresholdMinutes: template.late,
          specificDays: template.type === 'SPECIFIC_DAY' ? ['MONDAY', 'WEDNESDAY', 'FRIDAY'] as DayOfWeek[] : [],
          locationId: location.locationId,
          userId: user.userId,
        },
      });
      shiftCount++;
    }
  }
  console.log(`✅ สร้าง ${shiftCount} shifts แล้ว\n`);

  // 8. สร้างข้อมูลการเข้างาน
  console.log('📋 สร้างข้อมูลการเข้างาน...');
  const allUsers = [superadmin, ...admins, ...managers, ...users];
  const activeUsers = allUsers.filter(u => u.status === UserStatus.ACTIVE);
  const attendanceCount = 100;
  
  const attendanceData = Array.from({ length: attendanceCount }, () => {
    const user = faker.helpers.arrayElement(activeUsers);
    const date = faker.date.recent({ days: 30 });
    const checkIn = new Date(date);
    checkIn.setHours(faker.number.int({ min: 7, max: 10 }), faker.number.int({ min: 0, max: 59 }));
    
    const hasCheckOut = faker.datatype.boolean({ probability: 0.8 });
    const checkOut = hasCheckOut
      ? new Date(checkIn.getTime() + faker.number.int({ min: 7, max: 10 }) * 60 * 60 * 1000)
      : null;

    return {
      userId: user.userId,
      checkIn,
      checkOut,
      status: faker.helpers.arrayElement([
        AttendanceStatus.ON_TIME,
        AttendanceStatus.ON_TIME,
        AttendanceStatus.ON_TIME,
        AttendanceStatus.LATE,
        AttendanceStatus.ABSENT,
      ]),
      note: faker.datatype.boolean({ probability: 0.2 })
        ? faker.helpers.arrayElement([
            'ติดธุระส่วนตัว',
            'รถติด',
            'ลืมบันทึกเวลา',
            'ทำงานนอกสถานที่',
          ])
        : null,
    };
  });
  
  await prisma.attendance.createMany({ data: attendanceData });
  console.log(`✅ สร้าง ${attendanceCount} รายการเข้างานแล้ว\n`);

  // 8-12. สร้างข้อมูลอื่นๆ (ลดลงเหลือสรุป)
  const allStaff = [...admins, ...managers, ...users].filter(u => u.status === UserStatus.ACTIVE);
  
  // Leaves
  const leaveCount = 30;
  const leaveData = Array.from({ length: leaveCount }, () => {
    const user = faker.helpers.arrayElement(allStaff);
    const startDate = faker.date.future({ years: 0.1 });
    const endDate = new Date(startDate);
    endDate.setDate(startDate.getDate() + faker.number.int({ min: 1, max: 5 }));
    const status = faker.helpers.arrayElement([LeaveStatus.PENDING, LeaveStatus.APPROVED, LeaveStatus.APPROVED, LeaveStatus.REJECTED]);

    return {
      userId: user.userId,
      leaveType: faker.helpers.arrayElement([LeaveType.SICK, LeaveType.PERSONAL, LeaveType.VACATION]),
      startDate,
      endDate,
      reason: faker.helpers.arrayElement(['ติดธุระส่วนตัว', 'ไม่สบาย', 'ไปพบแพทย์', 'กิจส่วนตัว']),
      status,
      approvedByUserId: status !== LeaveStatus.PENDING ? faker.helpers.arrayElement([...admins, ...managers, superadmin]).userId : null,
      adminComment: status === LeaveStatus.REJECTED ? 'ช่วงนี้มีคนลาเยอะ' : null,
    };
  });
  
  await prisma.leaveRequest.createMany({ data: leaveData });
  console.log(`✅ สร้าง ${leaveCount} คำขอลา\n`);

  // Notifications, Audit Logs, Download Logs (simplified)
  console.log('🔔 สร้างข้อมูลอื่นๆ...');
  
  const notificationData = Array.from({ length: 50 }, () => ({
    userId: faker.helpers.arrayElement(allStaff).userId,
    message: faker.helpers.arrayElement(['คำขอลาได้รับการอนุมัติ', 'อย่าลืมบันทึกเวลาออกงาน']),
    isRead: faker.datatype.boolean({ probability: 0.6 }),
  }));
  await prisma.notification.createMany({ data: notificationData });

  const auditLogData = Array.from({ length: 30 }, () => ({
    userId: faker.helpers.arrayElement([...admins, superadmin]).userId,
    action: faker.helpers.arrayElement(['CREATE_USER', 'APPROVE_LEAVE', 'UPDATE_ATTENDANCE']),
    targetTable: 'users',
    targetId: faker.number.int({ min: 1, max: 100 }),
    newValues: { status: 'APPROVED' },
    ipAddress: faker.internet.ipv4(),
    userAgent: faker.internet.userAgent(),
  }));
  await prisma.auditLog.createMany({ data: auditLogData });

  const downloadLogData = Array.from({ length: 20 }, () => ({
    userId: faker.helpers.arrayElement([...admins, superadmin]).userId,
    fileName: `report_${faker.date.recent({ days: 30 }).toISOString().split('T')[0]}.pdf`,
    reportType: 'attendance_report',
  }));
  await prisma.downloadLog.createMany({ data: downloadLogData });

  // สรุป
  console.log('\n═══════════════════════════════════════');
  console.log('📊 สรุปข้อมูลที่สร้าง:');
  console.log('═══════════════════════════════════════');
  console.log(`🏢 สาขา: ${branches.length} สาขา (ID: ${branches.map(b => b.branchId).join(', ')})`);
  console.log(`👤 ผู้ใช้ทั้งหมด: ${allUsers.length} คน`);
  console.log(`   - Superadmin: 1 คน (userId: ${superadmin.userId})`);
  console.log(`   - Admin: ${admins.length} คน`);
  console.log(`   - Manager: ${managers.length} คน`);
  console.log(`   - User: ${users.length} คน`);
  console.log(`📍 Locations: ${locations.length} สถานที่`);
  console.log(`⏰ Shifts: ${shiftCount} กะงาน`);
  console.log(`📋 การเข้างาน: ${attendanceCount} รายการ`);
  console.log(`📝 คำขอลา: ${leaveCount} คำขอ`);
  console.log('═══════════════════════════════════════\n');

  console.log('🔑 ตัวอย่าง Login Credentials (login ด้วย employeeId, password = รหัสบัตรประชาชน):');
  console.log('═══════════════════════════════════════');
  console.log(`Superadmin: SA001 / ${superadminNationalId}`);
  console.log(`Admin BKK: ${admins[0].employeeId} / ${admins[0].password}`);
  console.log(`User: ${users[0].employeeId} / ${users[0].password}`);
  console.log('═══════════════════════════════════════\n');
  
  console.log('✨ Seeding เสร็จสมบูรณ์!\n');
}

main()
  .catch((e) => {
    console.error('❌ เกิดข้อผิดพลาดระหว่าง seeding:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
