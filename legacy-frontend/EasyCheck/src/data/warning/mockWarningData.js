// ===================================
// Mock Warning Data - ข้อมูลแจ้งเตือน/คำเตือน
// ===================================

export const mockWarningData = [
  {
    id: 1,
    name: 'นายอภิชาติ รัตนา',
    role: 'ตำแหน่ง : หัวหน้าทีม',
    department: 'แผนก : HR',
    branch: 'สาขา : กรุงเทพ',
    type: 'ประเภทข้อความ : ลาป่วย',
    file: 'ไฟล์แนบ : มี',
    avatar: 'https://i.pravatar.cc/300?u=15',
    attachments: [
      { id: 'a1', name: 'ใบรับรองแพทย์.jpg', url: 'https://picsum.photos/seed/doc1/800/600', type: 'image' }
    ],
    time: '1 day'
  },
  {
    id: 2,
    name: 'นายพชรกล เทรทเนอร์',
    role: 'ตำแหน่ง : ผู้จัดการ',
    department: 'แผนก : การเงิน',
    branch: 'สาขา : ชลบุรี',
    type: 'ประเภทข้อความ : ลากิจ',
    file: 'ไฟล์แนบ : ไม่มี',
    avatar: 'https://i.pravatar.cc/300?u=37',
    attachments: [
      { id: 'a2', name: 'รายละเอียด.pdf', url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', type: 'file' }
    ],
    time: '07.00 - 11.00'
  },
  {
    id: 3,
    name: 'นายณบิน หอมนเย็น',
    role: 'ตำแหน่ง : พนักงาน',
    department: 'แผนก : IT',
    branch: 'สาขา : กรุงเทพ',
    type: 'ประเภทข้อความ : ลากิจ',
    file: 'ไฟล์แนบ : มี',
    avatar: 'https://i.pravatar.cc/300?u=24',
    attachments: [
      { id: 'a3', name: 'รูปถ่าย1.jpg', url: 'https://picsum.photos/seed/photo1/800/600', type: 'image' },
      { id: 'a4', name: 'เอกสาร.pdf', url: 'https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf', type: 'file' }
    ],
    time: '1 day'
  }
];
