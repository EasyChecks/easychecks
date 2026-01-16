// ===================================
// Mock Team Members - ข้อมูลสมาชิกในทีม
// ===================================

export const mockTeamMembers = [
  {
    id: 1,
    name: 'สมชาย ใจดี',
    position: 'Junior Developer',
    status: 'checked_in',
    checkInTime: '08:45',
    checkOutTime: null,
    isLate: false,
    profilePic: null
  },
  {
    id: 2,
    name: 'สมหญิง รักงาน',
    position: 'UI/UX Designer',
    status: 'checked_in',
    checkInTime: '09:15',
    checkOutTime: null,
    isLate: true, // สาย 15 นาที
    profilePic: null
  },
  {
    id: 3,
    name: 'วิชัย เก่งมาก',
    position: 'Frontend Developer',
    status: 'checked_in',
    checkInTime: '08:30',
    checkOutTime: null,
    isLate: false,
    profilePic: null
  },
  {
    id: 4,
    name: 'อรทัย สวยงาม',
    position: 'Backend Developer',
    status: 'absent',
    checkInTime: null,
    checkOutTime: null,
    isLate: false,
    profilePic: null
  },
  {
    id: 5,
    name: 'ประยุทธ์ ทำงานหนัก',
    position: 'QA Tester',
    status: 'not_checked_in',
    checkInTime: null,
    checkOutTime: null,
    isLate: false,
    profilePic: null
  }
];
