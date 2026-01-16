// 📋 User Schema - โครงสร้างข้อมูลผู้ใช้ที่ชัดเจน เตรียมพร้อมสำหรับ Database
// 🎯 ลดความซ้ำซ้อน, ใช้ชื่อที่สื่อความหมาย, รองรับ NoSQL/SQL

/**
 * ❌ ปัญหาเดิมใน usersData.js:
 * - username = employeeId (ซ้ำกัน)
 * - nationalId = idCardNumber = socialSecurityNumber (ชื่อไม่ตรงกับความหมาย)
 * - มี certifications แต่ไม่ใช้
 * - ข้อมูลกระจัดกระจาย ไม่มีโครงสร้างชัดเจน
 * 
 * ✅ แก้ไขแล้ว:
 * - ลบฟิลด์ที่ซ้ำ
 * - รวมข้อมูลประกันสังคม/สวัสดิการใน benefits object
 * - แยก authentication ออกจาก personal info
 * - ใช้โครงสร้างที่เหมาะกับทั้ง MongoDB และ SQL
 */

export const UserSchema = {
  // ========================
  // 1. Authentication & Identity
  // ========================
  id: Number, // Primary Key (auto-increment)
  employeeId: String, // รหัสพนักงาน (BKK1010001) - ใช้เป็น username
  password: String, // Hash ด้วย bcrypt ในระบบจริง
  
  // 🔐 Admin Account (ถ้ามี)
  adminAccount: String, // เช่น ADMBKK1010001 (optional)
  adminPassword: String, // Hash ด้วย bcrypt (optional)
  
  // ========================
  // 2. Personal Information
  // ========================
  name: String, // ชื่อ-นามสกุล
  email: String, // Unique
  phone: String, // เบอร์โทร (10 หลัก)
  nationalId: String, // เลขบัตรประชาชน 13 หลัก (ไม่ซ้ำกับ idCardNumber แล้ว)
  birthDate: String, // YYYY-MM-DD format
  age: String, // คำนวณจาก birthDate
  bloodType: String, // A, B, AB, O
  address: String, // ที่อยู่เต็ม
  profileImage: String, // URL หรือ Base64
  
  // ========================
  // 3. Work Information
  // ========================
  role: String, // user, manager, admin, superadmin
  status: String, // active, suspended, leave, pending
  department: String, // HR, IT, Marketing, Finance, etc.
  position: String, // ตำแหน่งงาน
  provinceCode: String, // BKK, CNX, PKT, etc.
  branchCode: String, // 101, 201, 301, etc.
  salary: String, // เงินเดือน (เก็บเป็น String เพื่อรองรับ format)
  startDate: String, // YYYY-MM-DD
  workPeriod: String, // เช่น "5 ปี" (คำนวณจาก startDate)
  
  // ========================
  // 4. Emergency Contact
  // ========================
  emergencyContact: {
    name: String,
    phone: String,
    relation: String // บิดา, มารดา, สามี, ภรรยา, etc.
  },
  
  // ========================
  // 5. Work History & Education
  // ========================
  workHistory: [
    {
      period: String, // "2020 - ปัจจุบัน"
      position: String,
      company: String
    }
  ],
  
  education: [String], // Array of education strings
  skills: [String], // Array of skills
  
  // ========================
  // 6. Benefits & Social Security
  // ========================
  // ✅ รวมข้อมูลสวัสดิการไว้ใน object เดียว
  benefits: {
    socialSecurityNumber: String, // เลขประกันสังคม (X-XXXX-XXXXX-XX-X)
    providentFund: String, // กองทุนสำรองเลี้ยงชีพ
    healthInsurance: String // ประกันสุขภาพ
  },
  
  // ========================
  // 7. Attendance & Performance
  // ========================
  time: String, // เวลาเข้างานล่าสุด (HH:MM)
  attendanceStatus: String, // เข้าทำงานตรงเวลา, เข้าทำงานสาย
  
  timeSummary: {
    totalWorkDays: Number,
    onTime: Number,
    late: Number,
    absent: Number,
    leave: Number,
    totalHours: String, // "2,000 ชม."
    avgCheckIn: String, // "07:35"
    avgCheckOut: String // "17:30"
  },
  
  attendanceRecords: [
    {
      date: String, // "17 ต.ค. 2568"
      checkIn: {
        time: String,
        status: String,
        location: String,
        photo: String, // Base64 or URL
        gps: String, // "13.7563,100.5018"
        address: String, // ชื่อสถานที่ เช่น "ในพื้นที่อนุญาต", "บริษัท ABC"
        distance: String // ระยะทาง เช่น "50 ม.", "2.5 กม."
      },
      checkOut: {
        time: String,
        status: String,
        location: String,
        photo: String,
        gps: String,
        address: String,
        distance: String
      }
    }
  ],
  
  // ========================
  // 8. Activities Log (optional)
  // ========================
  activities: [
    {
      date: String,
      time: String,
      action: String,
      icon: String
    }
  ]
};

/**
 * 📊 Database Migration Strategy
 * 
 * **MongoDB (NoSQL):**
 * - ใช้โครงสร้างนี้ได้เลย (nested objects & arrays)
 * - Collection: users
 * - Index: employeeId (unique), email (unique), nationalId (unique)
 * 
 * **SQL (MySQL/PostgreSQL):**
 * - Table: users (main fields)
 * - Table: emergency_contacts (1:1 relationship)
 * - Table: work_history (1:N relationship)
 * - Table: education (1:N relationship)
 * - Table: skills (1:N relationship)
 * - Table: attendance_records (1:N relationship)
 * - Table: activities (1:N relationship)
 * 
 * **Migration Steps:**
 * 1. อ่านข้อมูลจาก localStorage ('usersData')
 * 2. แปลงเป็น Schema นี้ (ลบฟิลด์ซ้ำ, ย้าย socialSecurityNumber ไป benefits)
 * 3. Validate ข้อมูล (nationalId 13 หลัก, phone 10 หลัก, email format)
 * 4. บันทึกลง Database
 */

/**
 * ✅ ตัวอย่างข้อมูล User ตาม Schema นี้
 */
export const exampleUser = {
  id: 1,
  employeeId: 'BKK1010001',
  password: 'hashed_password_here', // bcrypt hash
  adminAccount: 'ADMBKK1010001',
  adminPassword: 'hashed_admin_password_here',
  
  name: 'นางสาวสุภาพร จันทร์เพ็ญ',
  email: 'supaporn.admin@ggs.co.th',
  phone: '0812345678',
  nationalId: '1209876543210',
  birthDate: '1988-05-15',
  age: '37',
  bloodType: 'A',
  address: '999/88 ถ.พระราม 4 แขวงคลองเตย เขตคลองเตย กรุงเทพฯ 10110',
  profileImage: 'https://i.pravatar.cc/200?u=admin1',
  
  role: 'admin',
  status: 'active',
  department: 'HR',
  position: 'HR Administrator',
  provinceCode: 'BKK',
  branchCode: '101',
  salary: '55000',
  startDate: '2020-01-01',
  workPeriod: '5 ปี',
  
  emergencyContact: {
    name: 'นายสมชาย จันทร์เพ็ญ',
    phone: '089-111-2222',
    relation: 'สามี'
  },
  
  workHistory: [
    {
      period: '2020 - ปัจจุบัน',
      position: 'HR Administrator',
      company: 'บริษัท GGS จำกัด'
    }
  ],
  
  education: [
    'ปริญญาตรี บริหารธุรกิจบัณฑิต (B.B.A)',
    'มหาวิทยาลัยธรรมศาสตร์',
    'สาขา การจัดการทรัพยากรมนุษย์',
    'เกรดเฉลี่ย 3.52'
  ],
  
  skills: ['HR Management', 'Recruitment', 'Employee Relations', 'HRIS'],
  
  benefits: {
    socialSecurityNumber: '1-2098-76543-21-0',
    providentFund: 'มี - 5% ของเงินเดือน',
    healthInsurance: 'มี - AIA Group Health Insurance'
  },
  
  time: '07:30',
  attendanceStatus: 'เข้าทำงานตรงเวลา',
  
  timeSummary: {
    totalWorkDays: 250,
    onTime: 240,
    late: 8,
    absent: 2,
    leave: 0,
    totalHours: '2,000 ชม.',
    avgCheckIn: '07:35',
    avgCheckOut: '17:30'
  },
  
  attendanceRecords: [],
  activities: []
};

/**
 * 🔄 Utility Function: แปลงข้อมูลเก่า → Schema ใหม่
 */
export const migrateOldUserToSchema = (oldUser) => {
  return {
    id: oldUser.id,
    employeeId: oldUser.employeeId || oldUser.username, // ใช้ employeeId เป็นหลัก
    password: oldUser.password,
    adminAccount: oldUser.adminAccount,
    adminPassword: oldUser.adminPassword,
    
    name: oldUser.name,
    email: oldUser.email,
    phone: oldUser.phone,
    nationalId: oldUser.nationalId || oldUser.idCardNumber, // เอา nationalId เป็นหลัก
    birthDate: oldUser.birthDate,
    age: oldUser.age,
    bloodType: oldUser.bloodType,
    address: oldUser.address,
    profileImage: oldUser.profileImage,
    
    role: oldUser.role,
    status: oldUser.status,
    department: oldUser.department,
    position: oldUser.position,
    provinceCode: oldUser.provinceCode,
    branchCode: oldUser.branchCode,
    salary: oldUser.salary,
    startDate: oldUser.startDate,
    workPeriod: oldUser.workPeriod,
    
    emergencyContact: oldUser.emergencyContact,
    workHistory: oldUser.workHistory || [],
    education: oldUser.education || [],
    skills: oldUser.skills || [],
    
    // ✅ ย้าย socialSecurityNumber ไปใน benefits
    benefits: {
      socialSecurityNumber: oldUser.socialSecurityNumber,
      providentFund: oldUser.providentFund || 'ไม่มีข้อมูล',
      healthInsurance: oldUser.healthInsurance || 'ไม่มีข้อมูล'
    },
    
    time: oldUser.time,
    attendanceStatus: oldUser.attendanceStatus,
    timeSummary: oldUser.timeSummary || {
      totalWorkDays: 0,
      onTime: 0,
      late: 0,
      absent: 0,
      leave: 0,
      totalHours: '0 ชม.',
      avgCheckIn: '08:00',
      avgCheckOut: '17:30'
    },
    
    attendanceRecords: oldUser.attendanceRecords || [],
    activities: oldUser.activities || []
  };
};

/**
 * 🔄 Utility Function: Validate User Data
 */
export const validateUser = (user) => {
  const errors = [];
  
  // ตรวจสอบฟิลด์จำเป็น
  if (!user.employeeId) errors.push('employeeId is required');
  if (!user.name) errors.push('name is required');
  if (!user.email) errors.push('email is required');
  
  // ตรวจสอบรูปแบบ
  if (user.nationalId && user.nationalId.replace(/\D/g, '').length !== 13) {
    errors.push('nationalId must be 13 digits');
  }
  
  if (user.phone && user.phone.replace(/\D/g, '').length !== 10) {
    errors.push('phone must be 10 digits');
  }
  
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (user.email && !emailRegex.test(user.email)) {
    errors.push('email format is invalid');
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
};

export default UserSchema;
