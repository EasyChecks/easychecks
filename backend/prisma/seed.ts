import 'dotenv/config';
import {
  ApprovalStatus,
  AttendanceStatus,
  EventParticipantType,
  Gender,
  LeaveStatus,
  LeaveType,
  LocationType,
  PrismaClient,
  Role,
  ShiftType,
  Title,
  UserStatus,
} from '@prisma/client';
import { faker } from '@faker-js/faker/locale/th';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';

const ROWS_PER_TABLE = 30;

const connectionString = process.env.DIRECT_URL || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DIRECT_URL or DATABASE_URL environment variable is not set');
}

const pool = new Pool({
  connectionString,
  options: '-c timezone=Asia/Bangkok',
});
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

type BranchSeed = {
  code: string;
  name: string;
  address: string;
};

type UserSeed = {
  employeeId: string;
  firstName: string;
  lastName: string;
  nickname: string;
  nationalId: string;
  phone: string;
  email: string;
  role: Role;
  branchCode: string | null;
  adminPassword: string;
};

const thaiRelations = ['บิดา', 'มารดา', 'สามี', 'ภรรยา', 'พี่ชาย', 'พี่สาว', 'น้องชาย', 'น้องสาว'];
const departments = ['Operations', 'HR', 'Finance', 'IT', 'Sales', 'Support'];
const positions = ['Officer', 'Senior Officer', 'Supervisor', 'Manager', 'Specialist'];
const bloodTypes = ['A', 'B', 'AB', 'O'];

function generateNationalId(): string {
  return faker.string.numeric({ length: 13, allowLeadingZeros: false });
}

function generatePhone(index: number): string {
  return `08${String(10000000 + index).slice(-8)}`;
}

function buildBranches(): BranchSeed[] {
  const branches: BranchSeed[] = [
    { code: 'BKK', name: 'สำนักงานใหญ่', address: '123 ถนนสุขุมวิท แขวงคลองเตย เขตคลองเตย กรุงเทพฯ 10110' },
    { code: 'CNX', name: 'สาขาเชียงใหม่', address: '456 ถนนห้วยแก้ว ตำบลสุเทพ อำเภอเมืองเชียงใหม่ 50200' },
    { code: 'HKT', name: 'สาขาภูเก็ต', address: '789 ถนนภูเก็ต ตำบลตลาดใหญ่ อำเภอเมืองภูเก็ต 83000' },
  ];

  for (let i = 4; i <= ROWS_PER_TABLE; i += 1) {
    const code = `BR${String(i).padStart(3, '0')}`;
    branches.push({
      code,
      name: `สาขา ${code}`,
      address: faker.location.streetAddress({ useFullAddress: true }),
    });
  }

  return branches;
}

function buildUsers(branchCodes: string[]): UserSeed[] {
  const users: UserSeed[] = [
    {
      employeeId: 'SA001',
      firstName: 'Super',
      lastName: 'Admin',
      nickname: 'SA',
      nationalId: '8017231061031',
      phone: '0890000001',
      email: 'sa001@easycheck.local',
      role: Role.SUPERADMIN,
      branchCode: null,
      adminPassword: 'sup0012',
    },
    {
      employeeId: 'BKK0001',
      firstName: 'Admin',
      lastName: 'Bangkok',
      nickname: 'AdminBKK',
      nationalId: '4850495039640',
      phone: '0890000002',
      email: 'bkk0001@easycheck.local',
      role: Role.ADMIN,
      branchCode: 'BKK',
      adminPassword: 'adm0034',
    },
    {
      employeeId: 'BKK0002',
      firstName: 'Manager',
      lastName: 'Bangkok',
      nickname: 'MgrBKK',
      nationalId: '9198422755622',
      phone: '0890000003',
      email: 'bkk0002@easycheck.local',
      role: Role.MANAGER,
      branchCode: 'BKK',
      adminPassword: 'mng0002',
    },
    {
      employeeId: 'BKK0004',
      firstName: 'User',
      lastName: 'Bangkok',
      nickname: 'UserBKK',
      nationalId: '6819199987040',
      phone: '0890000004',
      email: 'bkk0004@easycheck.local',
      role: Role.USER,
      branchCode: 'BKK',
      adminPassword: 'usr0004',
    },
  ];

  const roleCycle: Role[] = [Role.ADMIN, Role.MANAGER, Role.USER, Role.USER, Role.USER];

  for (let i = users.length; i < ROWS_PER_TABLE; i += 1) {
    const branchCode = branchCodes[(i - 1) % branchCodes.length] ?? 'BKK';
    const empPrefix = branchCode;
    const employeeId = `${empPrefix}${String(i + 1).padStart(4, '0')}`;
    const firstName = faker.person.firstName();
    const lastName = faker.person.lastName();

    users.push({
      employeeId,
      firstName,
      lastName,
      nickname: faker.person.firstName(),
      nationalId: generateNationalId(),
      phone: generatePhone(i + 1),
      email: `${employeeId.toLowerCase()}@easycheck.local`,
      role: roleCycle[i % roleCycle.length] ?? Role.USER,
      branchCode,
      adminPassword: `pw${String(1000 + i)}`,
    });
  }

  return users;
}

async function seedBranches(branches: BranchSeed[]) {
  for (const b of branches) {
    await prisma.branch.upsert({
      where: { code: b.code },
      update: {
        name: b.name,
        address: b.address,
      },
      create: {
        code: b.code,
        name: b.name,
        address: b.address,
      },
    });
  }

  return prisma.branch.findMany({
    where: { code: { in: branches.map((b) => b.code) } },
    select: { branchId: true, code: true },
    orderBy: { branchId: 'asc' },
  });
}

async function seedUsers(users: UserSeed[], branchMap: Map<string, number>) {
  const seededUsers: Array<{ userId: number; employeeId: string; role: Role; branchId: number | null }> = [];

  for (const u of users) {
    const branchId = u.branchCode ? (branchMap.get(u.branchCode) ?? null) : null;
    const hashedPassword = await bcrypt.hash(u.nationalId, 10);

    const user = await prisma.user.upsert({
      where: { employeeId: u.employeeId },
      update: {
        title: faker.helpers.arrayElement([Title.MR, Title.MISS, Title.MRS]),
        firstName: u.firstName,
        lastName: u.lastName,
        nickname: u.nickname,
        gender: faker.helpers.arrayElement([Gender.MALE, Gender.FEMALE]),
        nationalId: u.nationalId,
        emergent_tel: generatePhone(faker.number.int({ min: 100, max: 999 })),
        emergent_first_name: faker.person.firstName(),
        emergent_last_name: faker.person.lastName(),
        emergent_relation: faker.helpers.arrayElement(thaiRelations),
        phone: u.phone,
        email: u.email,
        password: hashedPassword,
        adminPassword: u.adminPassword,
        avatarUrl: faker.image.avatar(),
        birthDate: faker.date.birthdate({ min: 22, max: 55, mode: 'age' }),
        department: faker.helpers.arrayElement(departments),
        position: faker.helpers.arrayElement(positions),
        bloodType: faker.helpers.arrayElement(bloodTypes),
        branchId,
        role: u.role,
        status: UserStatus.ACTIVE,
      },
      create: {
        employeeId: u.employeeId,
        title: faker.helpers.arrayElement([Title.MR, Title.MISS, Title.MRS]),
        firstName: u.firstName,
        lastName: u.lastName,
        nickname: u.nickname,
        gender: faker.helpers.arrayElement([Gender.MALE, Gender.FEMALE]),
        nationalId: u.nationalId,
        emergent_tel: generatePhone(faker.number.int({ min: 100, max: 999 })),
        emergent_first_name: faker.person.firstName(),
        emergent_last_name: faker.person.lastName(),
        emergent_relation: faker.helpers.arrayElement(thaiRelations),
        phone: u.phone,
        email: u.email,
        password: hashedPassword,
        adminPassword: u.adminPassword,
        avatarUrl: faker.image.avatar(),
        birthDate: faker.date.birthdate({ min: 22, max: 55, mode: 'age' }),
        department: faker.helpers.arrayElement(departments),
        position: faker.helpers.arrayElement(positions),
        bloodType: faker.helpers.arrayElement(bloodTypes),
        branchId,
        role: u.role,
        status: UserStatus.ACTIVE,
      },
      select: {
        userId: true,
        employeeId: true,
        role: true,
        branchId: true,
      },
    });

    seededUsers.push(user);
  }

  return seededUsers;
}

async function clearSeededTables() {
  await prisma.announcementRecipient.deleteMany();
  await prisma.approvalAction.deleteMany();
  await prisma.lateRequest.deleteMany();
  await prisma.leaveRequest.deleteMany();
  await prisma.attendance.deleteMany();
  await prisma.eventParticipant.deleteMany();
  await prisma.event.deleteMany();
  await prisma.shift.deleteMany();
  await prisma.notification.deleteMany();
  await prisma.session.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.announcement.deleteMany();
  await prisma.location.deleteMany();
  await prisma.user.deleteMany();
  await prisma.branch.deleteMany();
}

async function seedLocations(
  users: Array<{ userId: number; employeeId: string; role: Role; branchId: number | null }>,
) {
  const typeCycle: LocationType[] = [
    LocationType.OFFICE,
    LocationType.BRANCH,
    LocationType.SITE,
    LocationType.MEETING,
    LocationType.OTHER,
  ];

  const locations = await Promise.all(
    Array.from({ length: ROWS_PER_TABLE }, async (_, i) => {
      const creator = users[i % users.length] ?? users[0];
      return prisma.location.create({
        data: {
          locationName: `SEED30-LOCATION-${String(i + 1).padStart(2, '0')}`,
          latitude: Number((6.0 + ((i * 0.271) % 8.2)).toFixed(6)),
          longitude: Number((98.0 + ((i * 0.113) % 3.7)).toFixed(6)),
          radius: 100 + ((i % 5) * 20),
          userId: creator.userId,
          isActive: true,
          locationType: typeCycle[i % typeCycle.length] ?? LocationType.OTHER,
          address: faker.location.streetAddress({ useFullAddress: true }),
          description: `seed30-location-${i + 1}`,
          deleteReason: 'seed30',
        },
        select: {
          locationId: true,
        },
      });
    }),
  );

  return locations.map((location) => location.locationId);
}

async function main() {
  console.log('🌱 Start seed (30 rows/table)');

  await clearSeededTables();

  const branches = buildBranches();
  const savedBranches = await seedBranches(branches);
  const branchMap = new Map(savedBranches.map((b) => [b.code, b.branchId]));
  const branchIds = savedBranches.map((b) => b.branchId);

  const usersToSeed = buildUsers(branches.map((b) => b.code));
  const users = await seedUsers(usersToSeed, branchMap);

  const superadmin = users.find((u) => u.employeeId === 'SA001');
  if (!superadmin) throw new Error('SA001 not found after seeding users');

  const locationIds = await seedLocations(users);

  const shifts = await Promise.all(
    Array.from({ length: ROWS_PER_TABLE }, async (_, i) => {
      const owner = users[i % users.length] ?? users[0];
      return prisma.shift.create({
        data: {
          name: `SEED30-SHIFT-${String(i + 1).padStart(2, '0')}`,
          shiftType: ShiftType.REGULAR,
          startTime: faker.helpers.arrayElement(['08:00', '09:00', '10:00']),
          endTime: faker.helpers.arrayElement(['17:00', '18:00', '19:00']),
          gracePeriodMinutes: faker.number.int({ min: 5, max: 20 }),
          lateThresholdMinutes: faker.number.int({ min: 20, max: 60 }),
          specificDays: [],
          locationId: locationIds[i % locationIds.length],
          userId: owner.userId,
          isActive: true,
          isDeleted: false,
          deleteReason: 'seed30',
        },
      });
    }),
  );

  const events = await Promise.all(
    Array.from({ length: ROWS_PER_TABLE }, async (_, i) => {
      const creator = users[i % users.length] ?? users[0];
      const start = faker.date.soon({ days: 40 });
      const end = new Date(start.getTime() + faker.number.int({ min: 1, max: 8 }) * 60 * 60 * 1000);

      return prisma.event.create({
        data: {
          eventName: `SEED30-EVENT-${String(i + 1).padStart(2, '0')}`,
          description: faker.lorem.sentence(),
          locationId: locationIds[i % locationIds.length],
          venueName: faker.company.name(),
          venueLatitude: faker.location.latitude({ max: 14.5, min: 6.0, precision: 6 }),
          venueLongitude: faker.location.longitude({ max: 101.8, min: 98.0, precision: 6 }),
          startDateTime: start,
          endDateTime: end,
          participantType: faker.helpers.arrayElement([
            EventParticipantType.ALL,
            EventParticipantType.INDIVIDUAL,
            EventParticipantType.BRANCH,
            EventParticipantType.ROLE,
          ]),
          isActive: true,
          createdByUserId: creator.userId,
          deleteReason: 'seed30',
        },
      });
    }),
  );

  await Promise.all(
    Array.from({ length: ROWS_PER_TABLE }, async (_, i) => {
      const event = events[i % events.length] ?? events[0];
      const participant = users[(i + 3) % users.length] ?? users[0];
      return prisma.eventParticipant.create({
        data: {
          eventId: event.eventId,
          userId: participant.userId,
          branchId: participant.branchId ?? branchIds[0] ?? null,
          role: participant.role,
        },
      });
    }),
  );

  const attendances = await Promise.all(
    Array.from({ length: ROWS_PER_TABLE }, async (_, i) => {
      const user = users[i % users.length] ?? users[0];
      const shift = shifts[i % shifts.length] ?? shifts[0];
      const event = events[i % events.length] ?? events[0];
      const checkIn = faker.date.recent({ days: 20 });
      const checkOut = new Date(checkIn.getTime() + faker.number.int({ min: 6, max: 10 }) * 60 * 60 * 1000);
      const baseLat = faker.number.float({ min: 6.0, max: 14.5, fractionDigits: 6 });
      const baseLng = faker.number.float({ min: 98.0, max: 101.8, fractionDigits: 6 });

      return prisma.attendance.create({
        data: {
          userId: user.userId,
          shiftId: shift.shiftId,
          locationId: shift.locationId,
          checkIn,
          checkInPhoto: faker.image.url(),
          checkInLat: baseLat,
          checkInLng: baseLng,
          checkInAddress: faker.location.streetAddress({ useFullAddress: true }),
          checkInDistance: faker.number.float({ min: 3, max: 120, fractionDigits: 2 }),
          checkOut,
          checkOutPhoto: faker.image.url(),
          checkOutLat: faker.number.float({ min: 6.0, max: 14.5, fractionDigits: 6 }),
          checkOutLng: faker.number.float({ min: 98.0, max: 101.8, fractionDigits: 6 }),
          checkOutAddress: faker.location.streetAddress({ useFullAddress: true }),
          checkOutDistance: faker.number.float({ min: 3, max: 120, fractionDigits: 2 }),
          status: faker.helpers.weightedArrayElement([
            { weight: 7, value: AttendanceStatus.ON_TIME },
            { weight: 2, value: AttendanceStatus.LATE },
            { weight: 1, value: AttendanceStatus.ABSENT },
          ]),
          lateMinutes: faker.number.int({ min: 0, max: 60 }),
          note: `seed30-attendance-${i + 1}`,
          isAutoCheckout: false,
          eventId: event.eventId,
          deleteReason: 'seed30',
          isDeleted: false,
        },
      });
    }),
  );

  await Promise.all(
    Array.from({ length: ROWS_PER_TABLE }, async (_, i) => {
      const user = users[i % users.length] ?? users[0];
      const approver = users[(i + 1) % users.length] ?? users[0];
      const startDate = faker.date.soon({ days: 30 });
      const totalDays = faker.number.int({ min: 1, max: 5 });
      const endDate = new Date(startDate.getTime() + (totalDays - 1) * 24 * 60 * 60 * 1000);

      return prisma.$transaction(async (tx) => {
        const leaveRequest = await tx.leaveRequest.create({
          data: {
            userId: user.userId,
            leaveType: faker.helpers.arrayElement([
              LeaveType.SICK,
              LeaveType.PERSONAL,
              LeaveType.VACATION,
              LeaveType.TRAINING,
              LeaveType.ORDINATION,
            ]),
            startDate,
            endDate,
            reason: `seed30-leave-${faker.lorem.words({ min: 4, max: 8 })}`,
            status: LeaveStatus.APPROVED,
            attachmentUrl: faker.internet.url(),
            medicalCertificateUrl: faker.internet.url(),
            adminComment: 'approved by seed30',
            numberOfDays: totalDays,
            paidDays: Math.max(totalDays - 1, 1),
            rejectionReason: 'N/A',
          },
        });

        await tx.approvalAction.create({
          data: {
            leaveId: leaveRequest.leaveId,
            actorUserId: approver.userId,
            action: 'APPROVED',
            adminComment: 'approved by seed30',
          },
        });

        return leaveRequest;
      });
    }),
  );

  await Promise.all(
    Array.from({ length: ROWS_PER_TABLE }, async (_, i) => {
      const user = users[i % users.length] ?? users[0];
      const approver = users[(i + 2) % users.length] ?? users[0];
      const attendance = attendances[i % attendances.length] ?? attendances[0];
      const requestDate = faker.date.recent({ days: 20 });

      return prisma.$transaction(async (tx) => {
        const lateRequest = await tx.lateRequest.create({
          data: {
            userId: user.userId,
            attendanceId: attendance.attendanceId,
            requestDate,
            scheduledTime: '08:30',
            actualTime: `${String(faker.number.int({ min: 8, max: 10 })).padStart(2, '0')}:${String(faker.number.int({ min: 0, max: 59 })).padStart(2, '0')}`,
            lateMinutes: faker.number.int({ min: 5, max: 120 }),
            reason: `seed30-late-${faker.lorem.words({ min: 3, max: 7 })}`,
            status: ApprovalStatus.APPROVED,
            attachmentUrl: faker.internet.url(),
            adminComment: 'approved by seed30',
            rejectionReason: 'N/A',
          },
        });

        await tx.approvalAction.create({
          data: {
            lateRequestId: lateRequest.lateRequestId,
            actorUserId: approver.userId,
            action: 'APPROVED',
            adminComment: 'approved by seed30',
          },
        });

        return lateRequest;
      });
    }),
  );

  await prisma.notification.createMany({
    data: Array.from({ length: ROWS_PER_TABLE }, (_, i) => {
      const user = users[i % users.length] ?? users[0];
      return {
        userId: user.userId,
        message: `seed30-notification-${i + 1}`,
        isRead: faker.datatype.boolean({ probability: 0.35 }),
      };
    }),
  });

  await prisma.auditLog.createMany({
    data: Array.from({ length: ROWS_PER_TABLE }, (_, i) => {
      const user = users[i % users.length] ?? users[0];
      return {
        userId: user.userId,
        action: `SEED30_ACTION_${i + 1}`,
        targetTable: faker.helpers.arrayElement(['users', 'attendance', 'events', 'shifts', 'leave_requests']),
        targetId: i + 1,
        oldValues: { before: 'seed30', index: i },
        newValues: { after: 'seed30', index: i },
        ipAddress: faker.internet.ipv4(),
        userAgent: faker.internet.userAgent(),
      };
    }),
  });

  await prisma.session.createMany({
    data: Array.from({ length: ROWS_PER_TABLE }, (_, i) => {
      const user = users[i % users.length] ?? users[0];
      const now = new Date();
      return {
        userId: user.userId,
        token: `seed30-token-${randomUUID()}`,
        expiresAt: new Date(now.getTime() + 12 * 60 * 60 * 1000),
        refreshToken: `seed30-refresh-${randomUUID()}`,
        refreshTokenExpiresAt: new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000),
        ipAddress: faker.internet.ipv4(),
        userAgent: faker.internet.userAgent(),
      };
    }),
  });

  const announcements = await Promise.all(
    Array.from({ length: ROWS_PER_TABLE }, async (_, i) => {
      const creator = users[i % users.length] ?? users[0];
      const targetUser = users[(i + 5) % users.length] ?? users[0];
      return prisma.announcement.create({
        data: {
          title: `SEED30-ANNOUNCEMENT-${String(i + 1).padStart(2, '0')}`,
          content: faker.lorem.paragraph(),
          targetRoles: [targetUser.role],
          targetBranchIds: targetUser.branchId ? [targetUser.branchId] : branchIds.slice(0, 1),
          targetUserIds: [targetUser.userId],
          status: 'SENT',
          createdByUserId: creator.userId,
          sentByUserId: creator.userId,
          deleteReason: 'seed30',
        },
      });
    }),
  );

  await Promise.all(
    Array.from({ length: ROWS_PER_TABLE }, async (_, i) => {
      const announcement = announcements[i % announcements.length] ?? announcements[0];
      const user = users[(i + 7) % users.length] ?? users[0];
      return prisma.announcementRecipient.create({
        data: {
          announcementId: announcement.announcementId,
          userId: user.userId,
        },
      });
    }),
  );

  console.log('✅ Seed completed');
  console.log(` - Branches upserted: ${ROWS_PER_TABLE}`);
  console.log(` - Users upserted: ${ROWS_PER_TABLE}`);
  console.log(` - Locations created: ${ROWS_PER_TABLE}`);
  console.log(` - Shifts created: ${ROWS_PER_TABLE}`);
  console.log(` - Events created: ${ROWS_PER_TABLE}`);
  console.log(` - Event participants created: ${ROWS_PER_TABLE}`);
  console.log(` - Attendance created: ${ROWS_PER_TABLE}`);
  console.log(` - Leave requests created: ${ROWS_PER_TABLE}`);
  console.log(` - Late requests created: ${ROWS_PER_TABLE}`);
  console.log(` - Notifications created: ${ROWS_PER_TABLE}`);
  console.log(` - Audit logs created: ${ROWS_PER_TABLE}`);
  console.log(` - Sessions created: ${ROWS_PER_TABLE}`);
  console.log(` - Announcements created: ${ROWS_PER_TABLE}`);
  console.log(` - Announcement recipients created: ${ROWS_PER_TABLE}`);
  console.log(` - Location writes: ${ROWS_PER_TABLE}`);
  console.log('✅ Core credentials:');
  console.log(' - SA001 / 8017231061031 (admin panel: sup0012, branchId = null)');
  console.log(' - BKK0001 / 4850495039640 (admin panel: adm0034)');
  console.log(' - BKK0002 / 9198422755622');
  console.log(' - BKK0004 / 6819199987040');
}

main()
  .catch((error) => {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
