import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// Component การ์ดแสดงสิทธิ์การลาแต่ละประเภท - แสดงจำนวนวันที่ใช้/วันที่เหลือ พร้อม progress bar
const LeaveCard = ({ title, description, daysUsed, totalDays, onClick, leaveRules }) => {
  const [isExpanded, setIsExpanded] = useState(false); // ควบคุมการขยาย/ยุบส่วนเงื่อนไข
  const navigate = useNavigate();

  // ไปหน้าดูประวัติการลาแยกตามประเภท
  const handleViewHistory = (e) => {
    e.preventDefault();
    e.stopPropagation();
    navigate('/user/leave/list', { state: { leaveType: title } });
  };

  // สลับเปิด/ปิดส่วนเงื่อนไขการลา
  const toggleExpand = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsExpanded(!isExpanded);
  };

  // คำนวณเปอร์เซ็นต์การใช้วันลา
  const percentage = totalDays > 0 ? (daysUsed / totalDays) * 100 : 0;

  // กำหนดสี progress bar ตามการใช้งาน - เขียวถ้าใช้น้อย, เหลืองถ้าใช้ปานกลาง, แดงถ้าใช้เกือบหมด
  const getProgressColor = () => {
    if (percentage >= 80) return 'bg-red-500';
    if (percentage >= 50) return 'bg-yellow-500';
    return 'bg-green-500';
  };

  return (
    <div 
      className="p-4 sm:p-5 lg:p-6 mb-3 sm:mb-4 bg-white/95 backdrop-blur-sm rounded-xl sm:rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 relative z-10 border border-white/50"
    >
      <div className="flex items-start justify-between mb-1.5 sm:mb-2">
        <h3 className="font-bold text-gray-800 text-base sm:text-lg lg:text-xl">{title}</h3>
        <button
          onClick={handleViewHistory}
          className="flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 bg-gradient-to-r from-brand-primary to-orange-600 text-white text-xs sm:text-sm rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all duration-200 shadow-sm hover:shadow-md"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 sm:h-4 sm:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
          </svg>
          <span>ดูประวัติ</span>
        </button>
      </div>
      
      <p className="text-xs sm:text-sm lg:text-base text-gray-600 leading-relaxed mb-3 sm:mb-4 line-clamp-2">{description}</p>
      
      {/* วันที่ใช้/วันที่เหลือ */}
      <p className="text-xs sm:text-sm text-gray-500 mb-1.5 sm:mb-2">
        ใช้ไป {daysUsed} วัน จาก {totalDays} วัน
      </p>

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 rounded-full h-1.5 sm:h-2 overflow-hidden mb-3">
        <div 
          className={`${getProgressColor()} h-full rounded-full transition-all duration-500 ease-out`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {/* ส่วนเงื่อนไข */}
      {leaveRules && (
        <div className="border-t border-gray-200 pt-3">
          <button
            onClick={toggleExpand}
            className="flex items-center justify-between w-full text-left text-xs sm:text-sm font-medium text-brand-primary hover:text-orange-700 transition-colors"
          >
            <span>ดูเงื่อนไขและรายละเอียดการลา</span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className={`h-4 w-4 sm:h-5 sm:w-5 transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          {/* ส่วนเงื่อนไข */}
          <div
            className={`overflow-hidden transition-all duration-300 ease-in-out ${
              isExpanded ? 'max-h-[500px] opacity-100 mt-3' : 'max-h-0 opacity-0'
            }`}
          >
            <div className="bg-gradient-to-br from-orange-50 to-amber-50 rounded-lg p-3 sm:p-4 space-y-2">
              {leaveRules.map((rule, index) => (
                <div key={index} className="flex items-start gap-2">
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    className="h-4 w-4 text-brand-primary mt-0.5 flex-shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-xs sm:text-sm text-gray-700 leading-relaxed">{rule}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Component หลักที่แสดงรายการสิทธิ์การลาทั้งหมด + การ์ดขอเข้างานสาย
function LeaveDashboard({ leaveItems }) {
  const navigate = useNavigate();

  // ไปหน้ารายการลาตามประเภท
  const handleLeaveClick = (leave) => {
    navigate('/user/leave/list', { state: { leaveType: leave.title } });
  };

  // ไปหน้ารายการขอเข้างานสาย
  const handleLateArrivalClick = () => {
    navigate('/user/leave/list', { state: { viewType: 'lateArrival' } });
  };

  return (
    <>
      {/* การ์ดขอเข้างานสาย */}
      <div className="p-4 sm:p-5 lg:p-6 mb-3 sm:mb-4 bg-white/95 backdrop-blur-sm rounded-xl sm:rounded-2xl shadow-md hover:shadow-xl transition-all duration-300 relative z-10 border border-white/50">
        <div className="flex items-start justify-between mb-1.5 sm:mb-2">
          <h3 className="font-bold text-gray-800 text-base sm:text-lg lg:text-xl flex items-center gap-2">
            <span>ขอเข้างานสาย</span>
          </h3>
          <button
            onClick={handleLateArrivalClick}
            className="flex items-center gap-1 px-2 sm:px-3 py-1 sm:py-1.5 bg-gradient-to-r from-brand-primary to-orange-600 text-white text-xs sm:text-sm rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all duration-200 shadow-sm hover:shadow-md"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3.5 w-3.5 sm:h-4 sm:w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
            </svg>
            <span>ดูประวัติ</span>
          </button>
        </div>
        
        <p className="text-xs sm:text-sm lg:text-base text-gray-600 leading-relaxed mb-3 sm:mb-4">
          ขอเข้างานสายเฉพาะกรณีเจอเหตุสุดวิสัย เช่น รถเสีย อุบัติเหตุ หรือเหตุฉุกเฉินในระหว่างทาง
        </p>

        <div className="border-t border-gray-200 pt-3">
          <p className="text-xs sm:text-sm font-semibold text-brand-primary mb-3 flex items-center gap-2">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>ข้อกำหนดสำคัญ:</span>
          </p>
          <ul className="pl-3 sm:pl-4 space-y-2 sm:space-y-2.5 text-xs sm:text-sm text-gray-700">
            <li className="flex items-center gap-2.5">
              <span className="inline-block w-1.5 h-1.5 sm:w-2 sm:h-2 bg-brand-primary rounded-full flex-shrink-0"></span>
              <span className="flex-1 leading-relaxed">ต้องเป็นเหตุสุดวิสัยที่เกิดขึ้นในระหว่างเดินทางมาทำงาน</span>
            </li>
            <li className="flex items-center gap-2.5">
              <span className="inline-block w-1.5 h-1.5 sm:w-2 sm:h-2 bg-brand-primary rounded-full flex-shrink-0"></span>
              <span className="flex-1 leading-relaxed">ระบุเหตุผลที่ชัดเจนและสมเหตุสมผล</span>
            </li>
            <li className="flex items-center gap-2.5">
              <span className="inline-block w-1.5 h-1.5 sm:w-2 sm:h-2 bg-brand-primary rounded-full flex-shrink-0"></span>
              <span className="flex-1 leading-relaxed">แนบหลักฐานประกอบ (แนะนำ)</span>
            </li>
          </ul>
        </div>
      </div>

      {/* แสดงรายการการลา */}
      {leaveItems.map((leave, index) => (
        <LeaveCard
          key={index}
          title={leave.title}
          description={leave.description}
          daysUsed={leave.daysUsed}
          totalDays={leave.totalDays}
          leaveRules={leave.rules}
          onClick={() => handleLeaveClick(leave)}
        />
      ))}
    </>
  );
}

export default LeaveDashboard;