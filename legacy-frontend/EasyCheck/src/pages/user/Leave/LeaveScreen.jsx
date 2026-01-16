import React, { useState } from 'react';
import LeaveRequestModal from './LeaveRequestModal';
import Nav from '../../../components/user/nav/Nav';
import LeaveDashboard from '../../../components/user/Leave/LeaveDashboard';
import { useLeave } from '../../../contexts/LeaveContext';
import { useAuth } from '../../../contexts/AuthContext';

function LeaveScreen() {
  const [isModalOpen, setIsModalOpen] = useState(false); // เปิด/ปิด Modal ขอลา
  const { getLeaveSummary } = useLeave(); // ดึงฟังก์ชันสรุปสิทธิ์การลามาจาก Context
  const { user } = useAuth(); // ดึงข้อมูล user ปัจจุบัน
  
  // ดึงข้อมูลสิทธิ์การลาของ user คนนี้เท่านั้น (ส่ง user.id)
  const allLeaveData = getLeaveSummary(user?.id);
  
  // กรองข้อมูลลาคลอดออกสำหรับผู้ใช้ที่ไม่ใช่นาง/นางสาว - ทำให้ชายไม่เห็นรายการลาคลอด
  const userLeaveData = user?.titlePrefix === 'นาง' || user?.titlePrefix === 'นางสาว'
    ? allLeaveData  // ถ้าเป็นหญิง แสดงทั้งหมด
    : allLeaveData.filter(leave => leave.title !== 'ลาคลอด'); // ถ้าเป็นชาย ตัดลาคลอดออก

  return (
    <div className="flex flex-col gap-6">
      {/* ส่วนหัว - การ์ดลอยบนสุด */}
      <div className="bg-white rounded-2xl shadow-md p-6">
        <h1 className="text-2xl font-bold text-gray-800">การลา/มาสาย</h1>
        <p className="text-gray-600 mt-1">ดูสิทธิ์การลาและการมาสาย</p>
      </div>

      {/* เนื้อหาหลัก - แสดงรายการสิทธิ์การลา */}
      <main className="relative z-0">
        <LeaveDashboard leaveItems={userLeaveData} />
      </main>

      {/* ปุ่มลอยสำหรับขอลา - ติดอยู่ที่มุมล่างขวา */}
      <button
        onClick={() => setIsModalOpen(true)} // เปิด Modal เมื่อกด
        className="fixed flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 lg:px-5 py-2 sm:py-2.5 lg:py-3 bg-white rounded-full shadow-2xl bottom-24 sm:bottom-28 lg:bottom-32 right-4 sm:right-6 z-50 hover:scale-105 sm:hover:scale-110 hover:shadow-orange-200 transition-all duration-300 group"
      >
        {/* ไอคอน + สัญลักษณ์ */}
        <div className="flex items-center justify-center w-6 h-6 sm:w-7 sm:h-7 lg:w-8 lg:h-8 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full group-hover:rotate-90 transition-transform duration-300">
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-4 sm:w-4 lg:h-5 lg:w-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M12 4v16m8-8H4" />
          </svg>
        </div>
        <span className="text-xs sm:text-sm lg:text-base font-semibold text-brand-primary">ขอลา</span>
      </button>

      {/* Navigation Bar ด้านล่าง */}
      <Nav />
      
      {/* Modal ขอลา - แสดงเมื่อกดปุ่ม "ขอลา" */}
      {isModalOpen && <LeaveRequestModal closeModal={() => setIsModalOpen(false)} />}
    </div>
  );
}

export default LeaveScreen;