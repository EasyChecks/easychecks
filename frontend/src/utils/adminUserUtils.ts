import { User, CsvUserData } from '@/types/user';

/**
 * Generate a unique employee ID based on province and branch codes
 */
export function generateEmployeeId(
  provinceCode: string, 
  branchCode: string, 
  existingUsers: User[]
): string {
  const prefix = `${provinceCode}${branchCode}`;
  
  // Find existing IDs with the same prefix
  const existingIds = existingUsers
    .filter(u => u.employeeId?.startsWith(prefix))
    .map(u => {
      const match = u.employeeId?.match(/\d+$/);
      return match ? parseInt(match[0], 10) : 0;
    });
  
  const maxId = existingIds.length > 0 ? Math.max(...existingIds) : 0;
  const nextId = (maxId + 1).toString().padStart(4, '0');
  
  return `${prefix}${nextId}`;
}

/**
 * Validate user data for duplicates
 */
export function validateUserData(newUsers: User[], existingUsers: User[]): string[] {
  const errors: string[] = [];
  
  newUsers.forEach((newUser, index) => {
    // Check for duplicate national ID
    const duplicateNationalId = existingUsers.find(
      u => u.nationalId === newUser.nationalId
    );
    if (duplicateNationalId) {
      errors.push(`แถว ${index + 1}: เลขบัตรประชาชน ${newUser.nationalId} ซ้ำกับ ${duplicateNationalId.name}`);
    }
    
    // Check for duplicate email
    const duplicateEmail = existingUsers.find(
      u => u.email.toLowerCase() === newUser.email.toLowerCase()
    );
    if (duplicateEmail) {
      errors.push(`แถว ${index + 1}: อีเมล ${newUser.email} ซ้ำกับ ${duplicateEmail.name}`);
    }
  });
  
  return errors;
}

/**
 * Parse CSV text into array of objects
 */
export function parseCsvData(csvText: string): CsvUserData[] {
  const lines = csvText.trim().split('\n');
  if (lines.length < 2) return [];
  
  const headers = lines[0].split(',').map(h => h.trim());
  const data: CsvUserData[] = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i].split(',').map(v => v.trim());
    const row: CsvUserData = {} as CsvUserData;
    
    headers.forEach((header, index) => {
      row[header] = values[index] || '';
    });
    
    data.push(row);
  }
  
  return data;
}

/**
 * Process CSV data into User objects
 */
export function processCsvUsers(csvData: CsvUserData[], existingUsers: User[]): User[] {
  return csvData.map((row) => {
    const employeeId = generateEmployeeId(row.provinceCode || '', row.branchCode || '', existingUsers);
    const password = row.nationalId?.substring(row.nationalId.length - 4) || '1234';
    
    const user: User = {
      id: `user-${Date.now()}-${Math.random()}`,
      name: row.name || '',
      email: row.email || '',
      phone: row.phone || '',
      department: row.department || '',
      position: row.position || '',
      role: (row.role as 'user' | 'manager' | 'admin' | 'superadmin') || 'user',
      employeeId,
      username: employeeId,
      password,
      status: 'active',
      provinceCode: row.provinceCode || '',
      branchCode: row.branchCode || '',
      branch: row.provinceCode || '',
      nationalId: row.nationalId || '',
      birthDate: row.birthDate || '',
      address: row.address || '',
      attendanceRecords: []
    };
    
    return user;
  });
}

/**
 * Generate user PDF (mock implementation)
 */
export async function generateUserPDF(user: User): Promise<void> {
  // Mock PDF generation - would use jsPDF or similar in production
  console.log('Generating PDF for:', user.name);
  
  // Simulate async operation
  await new Promise(resolve => setTimeout(resolve, 1000));
  
  // Create a simple text representation
  const content = `
Employee Information
====================
Name: ${user.name}
Employee ID: ${user.employeeId}
Email: ${user.email}
Phone: ${user.phone}
Department: ${user.department}
Position: ${user.position}
Role: ${user.role}
Status: ${user.status}
Branch: ${user.branch || user.provinceCode || 'N/A'}
  `.trim();
  
  // Create and download a text file (in production, would be PDF)
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${user.employeeId}_${user.name}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
