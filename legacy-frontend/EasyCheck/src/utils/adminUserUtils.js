/**
 * Admin User Management Utilities
 * ฟังก์ชันช่วยเหลือสำหรับการจัดการผู้ใช้ในระบบ Admin
 */

/**
 * Generate Employee ID based on province and branch code
 * รูปแบบ: [provinceCode 3 chars][branchCode 3 chars][sequential 4 digits]
 * ตัวอย่าง: BKK1010001, CNX2010015
 */
export const generateEmployeeId = (provinceCode, branchCode, users = []) => {
  // หา employee ที่มีรหัสจังหวัดและสาขาเดียวกัน
  const sameLocationEmployees = users.filter(u => 
    u.employeeId && 
    u.employeeId.startsWith(provinceCode + branchCode)
  );

  // หาเลขวิ่งล่าสุด
  let maxSequence = 0;
  sameLocationEmployees.forEach(emp => {
    if (emp.employeeId && emp.employeeId.length === 10) {
      const sequence = parseInt(emp.employeeId.slice(-4));
      if (!isNaN(sequence) && sequence > maxSequence) {
        maxSequence = sequence;
      }
    }
  });

  // สร้างเลขวิ่งใหม่ (เพิ่ม 1)
  const newSequence = String(maxSequence + 1).padStart(4, '0');
  
  return `${provinceCode}${branchCode}${newSequence}`;
};

/**
 * Validate duplicate user data
 * ตรวจสอบข้อมูลซ้ำ: email, nationalId, username
 */
export const validateUserData = (newUsers, existingUsers = []) => {
  const errors = [];
  
  // ตรวจสอบความซ้ำภายใน newUsers เอง
  const seenEmails = new Set();
  const seenNationalIds = new Set();
  const seenUsernames = new Set();
  
  newUsers.forEach((user, index) => {
    // Check duplicate email กับข้อมูลเดิม
    if (existingUsers.some(u => u.email === user.email)) {
      errors.push(`แถวที่ ${index + 1}: อีเมล ${user.email} ซ้ำกับข้อมูลที่มีอยู่`);
    }
    
    // Check duplicate email ภายใน CSV เอง
    if (seenEmails.has(user.email)) {
      errors.push(`แถวที่ ${index + 1}: อีเมล ${user.email} ซ้ำภายใน CSV`);
    }
    seenEmails.add(user.email);
    
    // Check duplicate nationalId กับข้อมูลเดิม
    if (user.nationalId && existingUsers.some(u => u.nationalId === user.nationalId)) {
      errors.push(`แถวที่ ${index + 1}: เลขบัตรประชาชน ${user.nationalId} ซ้ำกับข้อมูลที่มีอยู่`);
    }
    
    // Check duplicate nationalId ภายใน CSV เอง
    if (user.nationalId && seenNationalIds.has(user.nationalId)) {
      errors.push(`แถวที่ ${index + 1}: เลขบัตรประชาชน ${user.nationalId} ซ้ำภายใน CSV`);
    }
    if (user.nationalId) seenNationalIds.add(user.nationalId);
    
    // Check duplicate username กับข้อมูลเดิม
    if (existingUsers.some(u => u.username === user.username)) {
      errors.push(`แถวที่ ${index + 1}: Username ${user.username} ซ้ำกับข้อมูลที่มีอยู่`);
    }
    
    // Check duplicate username ภายใน CSV เอง
    if (seenUsernames.has(user.username)) {
      errors.push(`แถวที่ ${index + 1}: Username ${user.username} ซ้ำภายใน CSV`);
    }
    seenUsernames.add(user.username);
  });
  
  return errors;
};

/**
 * Parse CSV text to array of objects
 * แปลงข้อมูล CSV เป็น Array of Objects
 */
export const parseCsvData = (csvText) => {
  const lines = csvText.split('\n').filter(line => line.trim());
  if (lines.length === 0) return [];

  // ตรวจสอบว่าใช้ delimiter อะไร (comma หรือ tab)
  const delimiter = lines[0].includes('\t') ? '\t' : ',';
  
  // Parse header
  const headers = lines[0].split(delimiter).map(h => h.trim());
  
  // Parse data rows
  const data = [];
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(delimiter);
    if (values.length === headers.length) {
      const row = {};
      headers.forEach((header, index) => {
        // ลบ single quote ที่ใช้ป้องกัน Excel แปลงเป็น Scientific Notation
        let value = values[index]?.trim() || '';
        if (value.startsWith("'")) {
          value = value.substring(1);
        }
        row[header] = value;
      });
      data.push(row);
    }
  }
  
  return data;
};

/**
 * Process CSV data and create user objects
 * ประมวลผลข้อมูล CSV และสร้าง user objects
 */
export const processCsvUsers = (csvData, existingUsers = []) => {
  const processedUsers = [];
  let currentId = existingUsers.length > 0 
    ? Math.max(...existingUsers.map(u => u.id)) + 1 
    : 1;

  // Track location sequences to avoid duplicate employee IDs
  const locationSequenceMap = {};

  csvData.forEach((row, index) => {
    // สร้างรหัสพนักงาน
    const provinceCode = (row.provinceCode || 'BKK').toUpperCase().slice(0, 3);
    
    // แปลง branchCode: รองรับทั้งตัวเลข (101, 201) และตัวอักษร (BKK, CNX, PKT)
    let branchCode = String(row.branchCode || '').trim();
    
    // ถ้า branchCode เป็นชื่อจังหวัด (BKK, CNX, PKT) ให้แปลงเป็นเลข branch
    if (branchCode === 'BKK' || branchCode === 'Bangkok') {
      branchCode = '101';
    } else if (branchCode === 'CNX' || branchCode === 'ChiangMai') {
      branchCode = '201';
    } else if (branchCode === 'PKT' || branchCode === 'Phuket') {
      branchCode = '301';
    } else if (!branchCode) {
      // ถ้าไม่มี branchCode ให้ใช้ default ตาม provinceCode
      if (provinceCode === 'BKK') branchCode = '101';
      else if (provinceCode === 'CNX') branchCode = '201';
      else if (provinceCode === 'PKT') branchCode = '301';
      else branchCode = '101'; // default
    }
    
    // ถ้าเป็นตัวเลขอยู่แล้ว ให้ใช้เลย (รองรับ 101, 201, 301)
    // ตัด branchCode ให้เหลือ 3 หลัก และ pad ถ้าสั้นกว่า 3 หลัก
    branchCode = String(branchCode).slice(0, 3).padStart(3, '0');
    
    const locationKey = provinceCode + branchCode;
    
    // หาเลขวิ่งล่าสุดจาก users ที่มีอยู่แล้ว + users ที่กำลังจะสร้าง
    if (!locationSequenceMap[locationKey]) {
      const sameLocationEmployees = existingUsers.filter(u => 
        u.employeeId && 
        u.employeeId.startsWith(locationKey)
      );
      
      let maxSequence = 0;
      sameLocationEmployees.forEach(emp => {
        if (emp.employeeId && emp.employeeId.length === 10) {
          const sequence = parseInt(emp.employeeId.slice(-4));
          if (!isNaN(sequence) && sequence > maxSequence) {
            maxSequence = sequence;
          }
        }
      });
      
      locationSequenceMap[locationKey] = maxSequence;
    }
    
    // เพิ่มเลขวิ่งสำหรับ location นี้
    locationSequenceMap[locationKey]++;
    const newSequence = String(locationSequenceMap[locationKey]).padStart(4, '0');
    const employeeId = `${locationKey}${newSequence}`;
    
    // Password = nationalId (เลขบัตรประชาชน)
    const password = row.nationalId || row.password || '1234567890123';
    
    // สร้าง user ปกติ
    const normalUser = {
      id: currentId,
      name: row.name || '',
      titlePrefix: row.titlePrefix || '', // 🆕 เพิ่ม default titlePrefix
      email: row.email || '',
      username: employeeId,
      employeeId: employeeId,
      password: password,
      role: row.role || 'user',
      status: row.status || 'active',
      department: row.department || '',
      position: row.position || '',
      phone: row.phone || '',
      nationalId: row.nationalId || '',
      birthDate: row.birthDate || '',
      age: row.age || '',
      bloodType: row.bloodType || '',
      salary: row.salary || '',
      address: row.address || '',
      startDate: row.startDate || new Date().toISOString().split('T')[0], // 🆕 เพิ่ม startDate
      provinceCode: provinceCode,
      branchCode: branchCode,
      // 🆕 Benefits - เพิ่มข้อมูลสวัสดิการ
      socialSecurityNumber: row.socialSecurityNumber || '',
      socialSecurityRights: row.socialSecurityRights || 'มี', // 🆕 เพิ่ม socialSecurityRights
      providentFund: row.providentFund || '',
      groupHealthInsurance: row.groupHealthInsurance || '', // 🆕 เปลี่ยนจาก healthInsurance
      profileImage: row.profileImage || `https://i.pravatar.cc/300?img=${Math.floor(Math.random() * 70) + 1}`, // 🆕 random avatar
      skills: row.skills ? row.skills.split('|').map(s => s.trim()).filter(Boolean) : [], // 🆕 filter empty
      // Parse education entries: support both plain strings and 'institution;degree;year' structured entries
      education: (row.education || '').split('|').map(e => e.trim()).filter(Boolean).map(e => {
        const parts = e.split(';').map(p => p.trim());
        if (parts.length === 3) {
          return { institution: parts[0], degree: parts[1], year: parts[2] };
        }
        return e;
      }),
      certifications: row.certifications ? row.certifications.split('|').map(c => c.trim()).filter(Boolean) : [], // 🆕 เพิ่ม certifications
      workHistory: row.workHistory ? 
        row.workHistory.split('|').map(w => {
          const parts = w.trim().split(';');
          return parts.length === 3 ? {
            period: parts[0].trim(),
            position: parts[1].trim(),
            company: parts[2].trim()
          } : w.trim();
        }).filter(Boolean) : [], // 🆕 filter empty
      emergencyContact: row.emergencyContactName ? {
        name: row.emergencyContactName || '',
        phone: row.emergencyContactPhone || '',
        relation: row.emergencyContactRelation || ''
      } : {
        name: '',
        phone: '',
        relation: ''
      }, // 🆕 default empty object
      timeSummary: {
        totalWorkDays: 0,
        onTime: 0,
        late: 0,
        absent: 0,
        leave: 0,
        totalHours: '0 ชม.',
        avgCheckIn: '08:00',
        avgCheckOut: '17:00'
      }
    };

    // Compute age from birthDate if not provided (support YYYY-MM-DD and DD/MM/YYYY formats)
    if (!normalUser.age && normalUser.birthDate) {
      const parseBirthYear = (b) => {
        if (!b) return NaN;
        // ISO format 2020-01-01
        if (/^\d{4}-\d{2}-\d{2}$/.test(b)) return new Date(b).getFullYear();
        // Thai DD/MM/YYYY
        if (/^\d{2}\/\d{2}\/\d{4}$/.test(b)) {
          const parts = b.split('/');
          return parseInt(parts[2], 10);
        }
        const d = new Date(b);
        return isNaN(d.getTime()) ? NaN : d.getFullYear();
      };

      const birthYear = parseBirthYear(normalUser.birthDate);
      if (!isNaN(birthYear)) normalUser.age = String(new Date().getFullYear() - birthYear);
    }

    processedUsers.push(normalUser);
    currentId++;
  });

  return processedUsers;
};

/**
 * Export users to CSV format
 * ส่งออกข้อมูล users เป็น CSV
 */
export const exportToCSV = (users, filename = 'users.csv') => {
  const headers = [
    'name', 'email', 'employeeId', 'username', 'role', 'status',
    'department', 'position', 'phone', 'nationalId', 'birthDate',
    'age', 'bloodType', 'salary', 'address', 'provinceCode', 'branchCode'
  ];

  const csvContent = [
    headers.join(','),
    ...users.map(user => 
      headers.map(header => `"${user[header] || ''}"`).join(',')
    )
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  link.click();
};
