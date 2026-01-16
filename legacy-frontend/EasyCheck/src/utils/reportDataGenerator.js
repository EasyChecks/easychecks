/**
 * Report Data Generator - สร้างข้อมูลรายงานจาก usersData
 * รองรับการ filter ตาม branch, role, และ options
 * ✅ อัพเดทอัตโนมัติจาก localStorage (ข้อมูลจาก AdminManageUser)
 */

import { usersData as defaultUsersData, mockBranches } from '../data/usersData';

/**
 * ดึงข้อมูลผู้ใช้ล่าสุดจาก localStorage
 * ถ้าไม่มีใน localStorage ให้ใช้ข้อมูล default
 */
const getLatestUsersData = () => {
  try {
    const storedUsers = localStorage.getItem('usersData');
    if (storedUsers) {
      return JSON.parse(storedUsers);
    }
  } catch (error) {
    console.warn('Failed to load users from localStorage:', error);
  }
  return defaultUsersData;
};

/**
 * สร้างข้อมูลรายงานที่สมบูรณ์
 * @param {Object} options - ตัวเลือกการสร้างรายงาน
 * @param {Array} selectedBranches - สาขาที่เลือก (สำหรับ Super Admin)
 * @param {String} userBranchCode - รหัสสาขาของผู้ใช้ (สำหรับ Admin)
 * @param {Boolean} isSuperAdmin - เป็น Super Admin หรือไม่
 * @returns {Array} ข้อมูลที่พร้อมสำหรับรายงาน
 */
export const generateEnhancedReportData = (
  options,
  selectedBranches = [],
  userBranchCode = null,
  isSuperAdmin = false
) => {
  // ✅ ดึงข้อมูลล่าสุดจาก localStorage (อัพเดทตาม AdminManageUser)
  const usersData = getLatestUsersData();
  
  // Filter users based on role and branch
  let filteredUsers = usersData;

  // Super Admin: filter by selected branches
  if (isSuperAdmin && selectedBranches.length > 0) {
    filteredUsers = usersData.filter(user => {
      const userBranch = `${user.provinceCode}${user.branchCode}`;
      return selectedBranches.some(selectedBranch => {
        // Match by exact full branch ID only (BKK101, CNX201, PKT301)
        return selectedBranch === userBranch;
      });
    });
  }
  // Admin: show only own branch
  else if (!isSuperAdmin && userBranchCode) {
    filteredUsers = usersData.filter(user => user.branchCode === userBranchCode);
  }

  // Generate report data
  const reportData = filteredUsers.map((user, index) => {
    const record = {
      'ลำดับ': index + 1,
      'รหัสพนักงาน': user.employeeId || user.username,
      'ชื่อ-นามสกุล': user.name,
    };

    // Personal Data
    if (options.personalData) {
      record['แผนก'] = user.department || '-';
      record['ตำแหน่ง'] = user.position || '-';
      record['อีเมล'] = user.email || '-';
      record['เบอร์โทร'] = user.phone || '-';
      record['สถานะ'] = user.status === 'active' ? 'ทำงานอยู่' : 'ออกจากงาน';
    }

    // Attendance Data
    if (options.attendanceData && user.timeSummary) {
      record['วันทำงานทั้งหมด'] = user.timeSummary.totalWorkDays || 0;
      record['มาตรงเวลา'] = user.timeSummary.onTime || 0;
      record['มาสาย'] = user.timeSummary.late || 0;
      record['ขาดงาน'] = user.timeSummary.absent || 0;
      record['ลางาน'] = user.timeSummary.leave || 0;
      record['ชั่วโมงทำงาน'] = user.timeSummary.totalHours || '0 ชม.';
    }

    // Event Stats
    if (options.eventStats) {
      const participatedEvents = Math.floor(Math.random() * 15); // Mock
      const totalEvents = 20; // Mock
      record['กิจกรรมที่เข้าร่วม'] = participatedEvents;
      record['กิจกรรมทั้งหมด'] = totalEvents;
      record['เปอร์เซ็นต์การเข้าร่วม'] = `${Math.floor((participatedEvents / totalEvents) * 100)}%`;
    }

    // ไม่ต้องการ Photo Attendance และ GPS Tracking อีกต่อไป
    // ลบออกแล้วตามคำขอของผู้ใช้

    return record;
  });

  return reportData;
};

/**
 * แปลงข้อมูลเป็น CSV string
 * @param {Array} data - ข้อมูลที่ต้องการแปลง
 * @returns {String} CSV string พร้อม BOM สำหรับภาษาไทย
 */
export const convertToCSV = (data) => {
  if (!data || data.length === 0) {
    return '';
  }

  const headers = Object.keys(data[0]);
  const csvContent = [
    '\uFEFF' + headers.join(','), // Add BOM for Thai characters
    ...data.map(row =>
      headers
        .map(header => {
          const value = row[header] || '';
          const strValue = String(value);
          
          // ป้องกันการแปลงเป็นตัวเลขใน Excel
          // เช่น เบอร์โทร, รหัสพนักงาน, GPS coordinates
          if (header === 'เบอร์โทร' || header === 'รหัสพนักงาน' || 
              header.includes('GPS') || header === 'ลำดับ') {
            // ใช้ ="value" เพื่อบังคับให้เป็น text และชิดซ้าย
            return `"=""${strValue.replace(/"/g, '""')}"""`;
          }
          
          // Escape commas, quotes, and newlines
          return `"${strValue.replace(/"/g, '""')}"`;
        })
        .join(',')
    ),
  ].join('\n');

  return csvContent;
};

/**
 * สร้างชื่อไฟล์สำหรับการดาวน์โหลด
 * @param {String} reportType - ประเภทรายงาน
 * @param {String} format - รูปแบบไฟล์ (excel, pdf, csv)
 * @param {String} startDate - วันที่เริ่มต้น
 * @param {String} endDate - วันที่สิ้นสุด
 * @returns {String} ชื่อไฟล์
 */
export const generateFileName = (reportType, format, startDate, endDate) => {
  const date = new Date();
  const timestamp = date.toISOString().split('T')[0];
  const extensions = {
    excel: 'xlsx',
    pdf: 'pdf',
    csv: 'csv',
  };

  return `${reportType}_${startDate}_${endDate}_${timestamp}.${extensions[format] || 'xlsx'}`;
};

/**
 * ตรวจสอบความถูกต้องของการเลือกข้อมูล
 * @param {Object} options - ตัวเลือกที่เลือก
 * @param {Array} selectedBranches - สาขาที่เลือก
 * @param {Boolean} isSuperAdmin - เป็น Super Admin หรือไม่
 * @returns {Object} { isValid, message }
 */
export const validateSelection = (options, selectedBranches, isSuperAdmin) => {
  // Check if at least one option is selected
  const selectedCount = Object.values(options).filter(Boolean).length;
  if (selectedCount === 0) {
    return {
      isValid: false,
      message: 'กรุณาเลือกข้อมูลที่ต้องการดาวน์โหลดอย่างน้อย 1 รายการ',
    };
  }

  // Check if Super Admin has selected branches
  if (isSuperAdmin && selectedBranches.length === 0) {
    return {
      isValid: false,
      message: 'กรุณาเลือกออฟฟิศที่ต้องการดาวน์โหลดข้อมูลอย่างน้อย 1 แห่ง',
    };
  }

  return {
    isValid: true,
    message: 'OK',
  };
};

/**
 * คำนวณสถิติจากข้อมูลที่กรอง
 * @param {Array} data - ข้อมูลที่ต้องการคำนวณ
 * @returns {Object} สถิติต่างๆ
 */
export const calculateStatistics = (data) => {
  if (!data || data.length === 0) {
    return {
      totalEmployees: 0,
      totalDepartments: 0,
      totalBranches: 0,
      avgAttendanceRate: 0,
    };
  }

  const departments = new Set();
  let totalOnTime = 0;
  let totalWorkDays = 0;

  data.forEach(row => {
    if (row['แผนก']) departments.add(row['แผนก']);
    if (row['มาตรงเวลา']) totalOnTime += parseInt(row['มาตรงเวลา']) || 0;
    if (row['วันทำงานทั้งหมด']) totalWorkDays += parseInt(row['วันทำงานทั้งหมด']) || 0;
  });

  return {
    totalEmployees: data.length,
    totalDepartments: departments.size,
    avgAttendanceRate:
      totalWorkDays > 0 ? Math.round((totalOnTime / totalWorkDays) * 100) : 0,
  };
};
