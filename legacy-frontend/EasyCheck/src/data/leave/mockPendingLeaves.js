// ===================================
// Mock Pending Leaves - ข้อมูลการลารออนุมัติ
// ===================================

export const mockPendingLeaves = [
  {
    id: 1,
    employeeId: 2,
    employeeName: 'สมหญิง รักงาน',
    leaveType: 'ลาป่วย',
    startDate: '15/10/2568',
    endDate: '16/10/2568',
    totalDays: 2,
    reason: 'ไข้หวัด ปวดศีรษะ',
    status: 'pending',
    submittedDate: '14/10/2568',
    documents: []
  },
  {
    id: 2,
    employeeId: 4,
    employeeName: 'อรทัย สวยงาม',
    leaveType: 'ลากิจ',
    startDate: '18/10/2568',
    endDate: '18/10/2568',
    totalDays: 1,
    reason: 'ติดธุระส่วนตัว',
    status: 'pending',
    submittedDate: '15/10/2568',
    documents: []
  },
  {
    id: 3,
    employeeId: 1,
    employeeName: 'สมชาย ใจดี',
    leaveType: 'ลาพักร้อน',
    startDate: '20/10/2568',
    endDate: '22/10/2568',
    totalDays: 3,
    reason: 'เที่ยวกับครอบครัว',
    status: 'pending',
    submittedDate: '13/10/2568',
    documents: []
  }
];
