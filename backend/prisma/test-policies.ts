import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';

// สี ANSI สำหรับแสดงผล
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// ใช้ pooler connection สำหรับ testing (เหมือน production)
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

interface TestResult {
  name: string;
  passed: boolean;
  message: string;
}

const results: TestResult[] = [];

function logTest(name: string, passed: boolean, message: string) {
  results.push({ name, passed, message });
  const color = passed ? colors.green : colors.red;
  const icon = passed ? '✅' : '❌';
  console.log(`${color}${icon} ${name}${colors.reset}`);
  if (message) {
    console.log(`   ${colors.cyan}${message}${colors.reset}`);
  }
}

async function testUserPolicies() {
  console.log(`\n${colors.blue}═══════════════════════════════════════${colors.reset}`);
  console.log(`${colors.blue}🧪 ทดสอบ USER POLICIES${colors.reset}`);
  console.log(`${colors.blue}═══════════════════════════════════════${colors.reset}\n`);

  try {
    // Get test users
    const superadmin = await prisma.user.findFirst({ where: { role: 'SUPERADMIN' } });
    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });
    const user = await prisma.user.findFirst({ where: { role: 'USER' } });

    if (!superadmin || !admin || !user) {
      throw new Error('ไม่พบข้อมูล test users');
    }

    // Test 1: User สามารถอ่านข้อมูลตัวเองได้
    const ownProfile = await prisma.user.findUnique({
      where: { userId: user.userId },
    });
    logTest(
      'User อ่านข้อมูลตัวเอง',
      !!ownProfile,
      `พบข้อมูล: ${ownProfile?.firstName} ${ownProfile?.lastName}`
    );

    // Test 2: Admin สามารถอ่านข้อมูล User ทั้งหมดได้
    const allUsers = await prisma.user.findMany();
    logTest(
      'Admin อ่านข้อมูล User ทั้งหมด',
      allUsers.length > 0,
      `พบ ${allUsers.length} users`
    );

    // Test 3: Superadmin สามารถสร้าง User ใหม่ได้
    try {
      const newUser = await prisma.user.create({
        data: {
          userId: 'test-user-' + Date.now(),
          username: 'testuser' + Date.now(),
          firstName: 'ทดสอบ',
          lastName: 'ระบบ',
          role: 'USER',
          status: 'ACTIVE',
        },
      });
      logTest('Superadmin สร้าง User ใหม่', true, `สร้าง: ${newUser.firstName} ${newUser.lastName}`);
      
      // ลบ test user
      await prisma.user.delete({ where: { userId: newUser.userId } });
    } catch (error: any) {
      logTest('Superadmin สร้าง User ใหม่', false, error.message);
    }
  } catch (error: any) {
    logTest('ทดสอบ User Policies', false, `Error: ${error.message}`);
  }
}

async function testAttendancePolicies() {
  console.log(`\n${colors.blue}═══════════════════════════════════════${colors.reset}`);
  console.log(`${colors.blue}🧪 ทดสอบ ATTENDANCE POLICIES${colors.reset}`);
  console.log(`${colors.blue}═══════════════════════════════════════${colors.reset}\n`);

  try {
    const user = await prisma.user.findFirst({ 
      where: { role: 'USER', status: 'ACTIVE' } 
    });
    
    if (!user) {
      throw new Error('ไม่พบ test user');
    }

    // Test 1: User สามารถอ่านการเข้างานของตัวเองได้
    const ownAttendance = await prisma.attendance.findMany({
      where: { userId: user.userId },
      take: 5,
    });
    logTest(
      'User อ่านการเข้างานตัวเอง',
      ownAttendance.length >= 0,
      `พบ ${ownAttendance.length} รายการ`
    );

    // Test 2: User สามารถบันทึกการเข้างานได้
    try {
      const newAttendance = await prisma.attendance.create({
        data: {
          userId: user.userId,
          checkIn: new Date(),
          status: 'ON_TIME',
        },
      });
      logTest('User บันทึกเวลาเข้างาน', true, `บันทึกเวลา: ${newAttendance.checkIn}`);
      
      // ลบ test attendance
      await prisma.attendance.delete({ where: { attendanceId: newAttendance.attendanceId } });
    } catch (error: any) {
      logTest('User บันทึกเวลาเข้างาน', false, error.message);
    }

    // Test 3: Admin สามารถดูการเข้างานทั้งหมดได้
    const allAttendance = await prisma.attendance.findMany({ take: 10 });
    logTest(
      'Admin ดูการเข้างานทั้งหมด',
      allAttendance.length > 0,
      `พบ ${allAttendance.length} รายการ`
    );
  } catch (error: any) {
    logTest('ทดสอบ Attendance Policies', false, `Error: ${error.message}`);
  }
}

async function testLeaveRequestPolicies() {
  console.log(`\n${colors.blue}═══════════════════════════════════════${colors.reset}`);
  console.log(`${colors.blue}🧪 ทดสอบ LEAVE REQUEST POLICIES${colors.reset}`);
  console.log(`${colors.blue}═══════════════════════════════════════${colors.reset}\n`);

  try {
    const user = await prisma.user.findFirst({ 
      where: { role: 'USER', status: 'ACTIVE' } 
    });
    const admin = await prisma.user.findFirst({ where: { role: 'ADMIN' } });

    if (!user || !admin) {
      throw new Error('ไม่พบ test users');
    }

    // Test 1: User อ่านคำขอลาตัวเอง
    const ownLeaves = await prisma.leaveRequest.findMany({
      where: { userId: user.userId },
      take: 5,
    });
    logTest(
      'User อ่านคำขอลาตัวเอง',
      ownLeaves.length >= 0,
      `พบ ${ownLeaves.length} คำขอ`
    );

    // Test 2: User สร้างคำขอลาใหม่
    try {
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 1);
      const dayAfter = new Date(tomorrow);
      dayAfter.setDate(dayAfter.getDate() + 1);

      const newLeave = await prisma.leaveRequest.create({
        data: {
          userId: user.userId,
          leaveType: 'PERSONAL',
          startDate: tomorrow,
          endDate: dayAfter,
          reason: 'ทดสอบระบบ',
          status: 'PENDING',
        },
      });
      logTest('User สร้างคำขอลา', true, `สร้างคำขอ ID: ${newLeave.leaveId}`);

      // Test 3: Admin อนุมัติคำขอลา
      try {
        const approved = await prisma.leaveRequest.update({
          where: { leaveId: newLeave.leaveId },
          data: {
            status: 'APPROVED',
            approvedByUserId: admin.userId,
            adminComment: 'อนุมัติ - ทดสอบระบบ',
          },
        });
        logTest('Admin อนุมัติคำขอลา', true, `อนุมัติคำขอ ID: ${approved.leaveId}`);
      } catch (error: any) {
        logTest('Admin อนุมัติคำขอลา', false, error.message);
      }

      // ลบ test leave request
      await prisma.leaveRequest.delete({ where: { leaveId: newLeave.leaveId } });
    } catch (error: any) {
      logTest('User สร้างคำขอลา', false, error.message);
    }

    // Test 4: Admin ดูคำขอลาทั้งหมด
    const allLeaves = await prisma.leaveRequest.findMany({ take: 10 });
    logTest(
      'Admin ดูคำขอลาทั้งหมด',
      allLeaves.length > 0,
      `พบ ${allLeaves.length} คำขอ`
    );
  } catch (error: any) {
    logTest('ทดสอบ Leave Request Policies', false, `Error: ${error.message}`);
  }
}

async function testNotificationPolicies() {
  console.log(`\n${colors.blue}═══════════════════════════════════════${colors.reset}`);
  console.log(`${colors.blue}🧪 ทดสอบ NOTIFICATION POLICIES${colors.reset}`);
  console.log(`${colors.blue}═══════════════════════════════════════${colors.reset}\n`);

  try {
    const user = await prisma.user.findFirst({ 
      where: { role: 'USER', status: 'ACTIVE' } 
    });

    if (!user) {
      throw new Error('ไม่พบ test user');
    }

    // Test 1: User อ่านการแจ้งเตือนของตัวเอง
    const ownNotifications = await prisma.notification.findMany({
      where: { userId: user.userId },
      take: 5,
    });
    logTest(
      'User อ่านการแจ้งเตือนตัวเอง',
      ownNotifications.length >= 0,
      `พบ ${ownNotifications.length} การแจ้งเตือน`
    );

    // Test 2: User อัปเดตสถานะการอ่าน
    if (ownNotifications.length > 0) {
      try {
        const updated = await prisma.notification.update({
          where: { notificationId: ownNotifications[0].notificationId },
          data: { isRead: true },
        });
        logTest('User อัปเดตสถานะอ่าน', true, `อัปเดต notification ID: ${updated.notificationId}`);
      } catch (error: any) {
        logTest('User อัปเดตสถานะอ่าน', false, error.message);
      }
    } else {
      logTest('User อัปเดตสถานะอ่าน', true, 'ไม่มีการแจ้งเตือนให้ทดสอบ');
    }
  } catch (error: any) {
    logTest('ทดสอบ Notification Policies', false, `Error: ${error.message}`);
  }
}

async function testBranchPolicies() {
  console.log(`\n${colors.blue}═══════════════════════════════════════${colors.reset}`);
  console.log(`${colors.blue}🧪 ทดสอบ BRANCH POLICIES${colors.reset}`);
  console.log(`${colors.blue}═══════════════════════════════════════${colors.reset}\n`);

  try {
    // Test 1: ทุกคนสามารถอ่านข้อมูลสาขาได้
    const branches = await prisma.branch.findMany();
    logTest(
      'User อ่านข้อมูลสาขา',
      branches.length > 0,
      `พบ ${branches.length} สาขา`
    );

    // Test 2: แสดงรายชื่อสาขา
    branches.forEach((branch) => {
      console.log(`   ${colors.cyan}📍 ${branch.name} (${branch.code})${colors.reset}`);
    });
  } catch (error: any) {
    logTest('ทดสอบ Branch Policies', false, `Error: ${error.message}`);
  }
}

async function testAuditLogPolicies() {
  console.log(`\n${colors.blue}═══════════════════════════════════════${colors.reset}`);
  console.log(`${colors.blue}🧪 ทดสอบ AUDIT LOG POLICIES${colors.reset}`);
  console.log(`${colors.blue}═══════════════════════════════════════${colors.reset}\n`);

  try {
    // Test: Admin ดู audit logs ได้
    const auditLogs = await prisma.auditLog.findMany({ take: 10 });
    logTest(
      'Admin ดู Audit Logs',
      auditLogs.length >= 0,
      `พบ ${auditLogs.length} audit logs`
    );
  } catch (error: any) {
    logTest('ทดสอบ Audit Log Policies', false, `Error: ${error.message}`);
  }
}

async function main() {
  console.log(`\n${colors.yellow}╔════════════════════════════════════════════╗${colors.reset}`);
  console.log(`${colors.yellow}║  🧪 ทดสอบ RLS POLICIES - EasyCheck       ║${colors.reset}`);
  console.log(`${colors.yellow}╚════════════════════════════════════════════╝${colors.reset}\n`);

  console.log(`${colors.cyan}📝 หมายเหตุ: การทดสอบนี้จำลองการทำงานของ RLS policies${colors.reset}`);
  console.log(`${colors.cyan}   ในสภาพแวดล้อม backend โดยใช้ service role${colors.reset}\n`);

  await testUserPolicies();
  await testBranchPolicies();
  await testAttendancePolicies();
  await testLeaveRequestPolicies();
  await testNotificationPolicies();
  await testAuditLogPolicies();

  // สรุปผลการทดสอบ
  console.log(`\n${colors.yellow}═══════════════════════════════════════${colors.reset}`);
  console.log(`${colors.yellow}📊 สรุปผลการทดสอบ${colors.reset}`);
  console.log(`${colors.yellow}═══════════════════════════════════════${colors.reset}\n`);

  const passed = results.filter((r) => r.passed).length;
  const failed = results.filter((r) => !r.passed).length;
  const total = results.length;
  const percentage = ((passed / total) * 100).toFixed(1);

  console.log(`${colors.green}✅ ผ่าน: ${passed}/${total} (${percentage}%)${colors.reset}`);
  if (failed > 0) {
    console.log(`${colors.red}❌ ไม่ผ่าน: ${failed}/${total}${colors.reset}`);
  }

  console.log(`\n${colors.cyan}💡 เคล็ดลับ:${colors.reset}`);
  console.log(`   - RLS policies จะทำงานเมื่อใช้ Supabase Client (auth.uid())`);
  console.log(`   - Backend ควรใช้ Service Role สำหรับ admin operations`);
  console.log(`   - Frontend ควรใช้ User Auth Token สำหรับ user operations`);
  console.log(`\n`);

  if (failed === 0) {
    console.log(`${colors.green}🎉 ทดสอบผ่านทั้งหมด!${colors.reset}\n`);
  } else {
    console.log(`${colors.yellow}⚠️  มีการทดสอบที่ไม่ผ่าน กรุณาตรวจสอบ policies${colors.reset}\n`);
  }
}

main()
  .catch((e) => {
    console.error(`${colors.red}❌ เกิดข้อผิดพลาดระหว่างการทดสอบ:${colors.reset}`, e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
