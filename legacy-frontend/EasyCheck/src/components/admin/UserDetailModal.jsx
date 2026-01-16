import React, { useEffect, useState } from 'react';
import { calculateAttendanceStats } from '../../utils/attendanceCalculator';

// ✅ ฟังก์ชันแปลงวันที่ ISO (YYYY-MM-DD) เป็นรูปแบบไทย (DD/MM/YYYY พ.ศ.)
const formatThaiDate = (isoDate) => {
  if (!isoDate) return 'ไม่ระบุ';
  
  try {
    const date = new Date(isoDate);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const yearBE = date.getFullYear() + 543; // แปลง ค.ศ. เป็น พ.ศ.
    
    return `${day}/${month}/${yearBE}`;
  } catch {
    return isoDate; // ถ้าแปลงไม่ได้ ให้แสดงค่าเดิม
  }
};

const UserDetailModal = React.memo(function UserDetailModal({ 
  user, 
  showDetail,
  currentUser,
  onClose, 
  onEdit, 
  onDownloadPDF,
  onDelete,
  getStatusBadge
}) {
  // 🔥 State สำหรับ sync timeSummary แบบ real-time
  const [currentTimeSummary, setCurrentTimeSummary] = useState(user?.timeSummary);

  // 🆕 คำนวณ stats จาก attendanceRecords + historical baseline
  useEffect(() => {
    if (user) {
      try {
        const storedUsers = localStorage.getItem('usersData');
        if (storedUsers) {
          const users = JSON.parse(storedUsers);
          const currentUser = users.find(u => u.id === user.id);
          
          if (currentUser) {
            // 🔥 โหลด historical baseline จาก timeSummary
            const historicalStats = currentUser.timeSummary || {
              totalWorkDays: 0,
              onTime: 0,
              late: 0,
              absent: 0,
              leave: 0
            };
            
            // 🔥 คำนวณ current stats จาก attendanceRecords
            const currentStats = calculateAttendanceStats(
              currentUser.attendanceRecords || [],
              currentUser.schedule?.time
            );
            
            // 🔥 รวม historical + current
            const combinedStats = {
              totalWorkDays: (historicalStats.totalWorkDays || 0) + (currentStats.totalWorkDays || 0),
              onTime: (historicalStats.onTime || 0) + (currentStats.onTime || 0),
              late: (historicalStats.late || 0) + (currentStats.late || 0),
              absent: (historicalStats.absent || 0) + (currentStats.absent || 0),
              leave: (historicalStats.leave || 0) + (currentStats.leave || 0),
              totalHours: currentUser.timeSummary?.totalHours || `${Math.round(currentStats.totalWorkHours || 0)} ชม.`,
              avgCheckIn: currentStats.averageCheckInTime || currentUser.timeSummary?.avgCheckIn || '08:00',
              avgCheckOut: currentUser.timeSummary?.avgCheckOut || '17:30'
            };
            
            setCurrentTimeSummary(combinedStats);
          }
        }
      } catch (error) {
        console.warn('Failed to calculate timeSummary:', error);
        setCurrentTimeSummary(user?.timeSummary);
      }
    }
  }, [user]);
  
  // ป้องกันการ scroll พื้นหลังเมื่อ modal เปิด
  useEffect(() => {
    if (showDetail) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = 'unset';
    }
    
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, [showDetail]);

  if (!showDetail || !user) return null;

  return (
    <div 
      className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4"
    >
      <div 
        className="bg-white rounded-2xl shadow-sm w-full max-w-6xl max-h-[90vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="relative px-6 py-8 bg-primary">
          <div className="absolute top-0 right-0 w-64 h-64 -mt-32 -mr-32 rounded-full bg-white/10"></div>
          <div className="absolute bottom-0 left-0 w-48 h-48 -mb-24 -ml-24 rounded-full bg-white/10"></div>
          
          <div className="relative flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-12 h-12 bg-white/20 backdrop-blur-md rounded-xl">
                <svg xmlns="http://www.w3.org/2000/svg" className="text-white h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-white drop-shadow-md">ข้อมูลผู้ใช้</h2>
                <p className="text-sm text-white/80">ข้อมูลส่วนตัวและประวัติการทำงาน</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button 
                onClick={() => {
                  onEdit(user);
                  onClose();  // ปิด detail modal เพื่อเปิดหน้าแก้ไข
                }}
                className="flex items-center gap-2 px-4 py-2 font-medium text-white transition-colors transform shadow-lg bg-amber-500 hover:bg-amber-600 rounded-xl hover:scale-105"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                แก้ไขข้อมูล
              </button>
              {onDelete && (
                <button 
                  onClick={() => onDelete(user)}
                  disabled={currentUser?.role === 'admin' && user?.role === 'superadmin'}
                  className={`px-4 py-2 rounded-xl transition-colors transform flex items-center gap-2 font-medium shadow-sm ${
                    currentUser?.role === 'admin' && user?.role === 'superadmin'
                      ? 'bg-brand-accent text-secondary cursor-not-allowed'
                      : 'bg-red-500 hover:bg-red-600 text-white hover:scale-105'
                  }`}
                  title={currentUser?.role === 'admin' && user?.role === 'superadmin' ? 'ไม่สามารถลบ Super Admin ได้' : 'ลบผู้ใช้'}
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                ลบ
                </button>
              )}
              <button 
                onClick={() => {
                  onDownloadPDF();
                  onClose(); // ปิด modal หลังดาวน์โหลด
                }} 
                className="flex items-center gap-2 px-4 py-2 font-medium text-white transition-colors transform shadow-lg bg-white/20 hover:bg-brand-accent/30 backdrop-blur-md rounded-xl hover:scale-105"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                PDF
              </button>
              <button 
                onClick={onClose} 
                className="px-4 py-2 font-medium text-white transition-colors transform shadow-lg bg-white/20 hover:bg-brand-accent/30 backdrop-blur-md rounded-xl hover:scale-105"
              >
                ปิด
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 p-6 overflow-y-auto">
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
            
            {/* Left Column - Profile */}
            <div className="space-y-5 lg:col-span-1">
              {/* Profile Card */}
              <div className="p-6 border-2 border-gray-200 shadow-lg bg-brand-accent rounded-2xl">
                <div className="flex flex-col items-center">
                  <div className="w-32 h-32 overflow-hidden shadow-sm rounded-2xl ">
                    <img src={user.profileImage || `https://i.pravatar.cc/300?u=${user.id}`} alt="avatar" className="object-cover w-full h-full" />
                  </div>
                  
                  <div className="w-full mt-4 text-center">
                    <h3 className="text-xl font-bold text-gray-800">
                      {user.name}
                    </h3>
                    <p className="mt-1 text-sm text-gray-500">{user.position || 'ไม่ระบุตำแหน่ง'}</p>
                    <div className="mt-3 space-y-2">
                      <span className={`inline-block px-4 py-1.5 rounded-full text-sm font-semibold ${getStatusBadge(user.status)}`}>
                        {user.status}
                      </span>
                      <div className="text-xs text-gray-600">รหัสพนักงาน: {user.employeeId}</div>
                    </div>
                  </div>
                </div>
              </div>

              {/* ข้อมูลส่วนตัว */}
              <div className="p-5 bg-white border-2 border-gray-100 shadow-sm rounded-2xl">
                <h4 className="flex items-center gap-2 mb-4 font-bold text-gray-800">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  ข้อมูลส่วนตัว
                </h4>
                
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">วันเกิด</span>
                    <span className="font-medium text-gray-800">{formatThaiDate(user.birthDate)}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">อายุ</span>
                    <span className="font-medium text-gray-800">{user.age} ปี</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">เลขบัตรประชาชน</span>
                    <span className="font-medium text-gray-800">{user.nationalId || 'ไม่ระบุ'}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">หมู่เลือด</span>
                    <span className="font-medium text-gray-800">{user.bloodType || 'ไม่ระบุ'}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">อีเมล</span>
                    <span className="text-xs font-medium text-gray-800">{user.email}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-gray-600">เบอร์โทร</span>
                    <span className="font-medium text-gray-800">{user.phone}</span>
                  </div>
                </div>
              </div>

              {/* ข้อมูลบัญชี */}
              <div className="p-5 bg-white border-2 border-gray-100 shadow-sm rounded-2xl">
                <h4 className="flex items-center gap-2 mb-4 font-bold text-gray-800">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
                  </svg>
                  ข้อมูลบัญชี
                </h4>
                
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">Username (User)</span>
                    <span className="font-medium text-gray-800">{user.username}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">Password</span>
                    <span className="font-medium text-gray-800">{user.password || '••••••••'}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">บทบาท</span>
                    <span className="font-medium text-gray-800 capitalize">{user.role}</span>
                  </div>
                  
                  {/* Show Admin Account if user is admin or superadmin */}
                  {(user.role === 'admin' || user.role === 'superadmin') && (
                    <>
                      <div className="pt-3 border-t-2 border-gray-200">
                        <div className="p-3 mb-3 rounded-lg bg-brand-accent">
                          <p className="flex items-center gap-1 mb-1 text-xs font-semibold text-primary">
                            <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                            </svg>
                            บัญชี {user.role === 'superadmin' ? 'Super Admin' : 'Admin'}
                          </p>
                        </div>
                      </div>
                      <div className="flex justify-between py-2 border-b border-gray-100">
                        <span className="text-gray-600">Username (Admin)</span>
                        <span className="font-medium text-primary">
                          {user.adminAccount || `ADM${user.employeeId}`}
                        </span>
                      </div>
                      <div className="flex justify-between py-2">
                        <span className="text-gray-600">Password (Admin)</span>
                        <span className="font-medium text-primary">
                          {user.adminPassword || `Admin@GGS${new Date().getFullYear()}!`}
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Right Column - Details */}
            <div className="space-y-5 lg:col-span-2">
              {/* ข้อมูลการทำงาน */}
              <div className="p-5 bg-white border-2 border-gray-100 shadow-sm rounded-2xl">
                <h4 className="flex items-center gap-2 mb-4 font-bold text-gray-800">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 01-2 2z" />
                  </svg>
                  ข้อมูลการทำงาน
                </h4>
                
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div className="py-2">
                    <div className="mb-1 text-xs text-gray-500">ตำแหน่ง</div>
                    <div className="font-medium text-gray-800">{user.position || 'ไม่ระบุ'}</div>
                  </div>
                  <div className="py-2">
                    <div className="mb-1 text-xs text-gray-500">แผนก</div>
                    <div className="font-medium text-gray-800">{user.department}</div>
                  </div>
                  <div className="py-2">
                    <div className="mb-1 text-xs text-gray-500">รหัสพนักงาน</div>
                    <div className="font-medium text-gray-800">{user.employeeId}</div>
                  </div>
                  <div className="py-2">
                    <div className="mb-1 text-xs text-gray-500">วันที่เริ่มงาน</div>
                    <div className="font-medium text-gray-800">{user.startDate || 'ไม่ระบุ'}</div>
                  </div>
                  <div className="py-2">
                    <div className="mb-1 text-xs text-gray-500">ระยะเวลางาน</div>
                    <div className="font-medium text-gray-800">{user.workPeriod || 'ไม่ระบุ'}</div>
                  </div>
                  <div className="py-2">
                    <div className="mb-1 text-xs text-gray-500">เงินเดือน</div>
                    <div className="font-medium text-gray-800">{user.salary ? `${Number(user.salary).toLocaleString()} บาท` : 'ไม่ระบุ'}</div>
                  </div>
                </div>
              </div>

              {/* ข้อมูลผู้ติดต่อฉุกเฉิน */}
              {user.emergencyContact && (
                <div className="p-5 bg-white border-2 border-gray-100 shadow-sm rounded-2xl">
                  <h4 className="flex items-center gap-2 mb-4 font-bold text-gray-800">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    ผู้ติดต่อฉุกเฉิน
                  </h4>
                  
                  <div className="grid grid-cols-3 gap-4 text-sm">
                    <div className="py-2">
                      <div className="mb-1 text-xs text-gray-500">ชื่อ</div>
                      <div className="font-medium text-gray-800">{user.emergencyContact.name}</div>
                    </div>
                    <div className="py-2">
                      <div className="mb-1 text-xs text-gray-500">เบอร์โทร</div>
                      <div className="font-medium text-gray-800">{user.emergencyContact.phone}</div>
                    </div>
                    <div className="py-2">
                      <div className="mb-1 text-xs text-gray-500">ความสัมพันธ์</div>
                      <div className="font-medium text-gray-800">{user.emergencyContact.relation}</div>
                    </div>
                  </div>
                </div>
              )}

              {/* ที่อยู่ */}
              {user.address && (
                <div className="p-5 bg-white border-2 border-gray-100 shadow-sm rounded-2xl">
                  <h4 className="flex items-center gap-2 mb-4 font-bold text-gray-800">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    ที่อยู่
                  </h4>
                  <p className="text-sm text-gray-700">{user.address}</p>
                </div>
              )}

              {/* สรุปเวลาทำงาน */}
              {currentTimeSummary && (
                <div className="p-5 bg-white border-2 border-gray-100 shadow-sm rounded-2xl">
                  <h4 className="flex items-center gap-2 mb-4 font-bold text-gray-800">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    สรุปเวลาทำงาน
                    <span className="px-2 py-1 ml-auto text-xs text-green-700 bg-green-100 rounded-full">Real-time</span>
                  </h4>
                  <div className="grid grid-cols-4 gap-3">
                    <div className="p-3 text-center rounded-lg bg-gray-50">
                      <div className="text-2xl font-bold text-gray-800">{currentTimeSummary.totalWorkDays || 0}</div>
                      <div className="mt-1 text-xs text-gray-500">วันทำงาน</div>
                    </div>
                    <div className="p-3 text-center rounded-lg bg-green-50">
                      <div className="text-2xl font-bold text-green-600">{currentTimeSummary.onTime || 0}</div>
                      <div className="mt-1 text-xs text-gray-500">ตรงเวลา</div>
                    </div>
                    <div className="p-3 text-center rounded-lg bg-orange-50">
                      <div className="text-2xl font-bold text-orange-600">{currentTimeSummary.late || 0}</div>
                      <div className="mt-1 text-xs text-gray-500">มาสาย</div>
                    </div>
                    <div className="p-3 text-center rounded-lg bg-red-50">
                      <div className="text-2xl font-bold text-red-600">{currentTimeSummary.absent || 0}</div>
                      <div className="mt-1 text-xs text-gray-500">ขาดงาน</div>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4 pt-4 mt-4 text-sm border-t border-gray-200">
                    <div className="flex justify-between">
                      <span className="text-gray-600">เวลาเข้างานเฉลี่ย:</span>
                      <span className="font-bold text-primary">{currentTimeSummary.avgCheckIn || '08:00'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">ชั่วโมงทำงานรวม:</span>
                      <span className="font-bold text-primary">{currentTimeSummary.totalHours || '0 ชม.'}</span>
                    </div>
                  </div>
                </div>
              )}

              {/* 🔥 สถิติการลา */}
              {(() => {
                const leaveList = JSON.parse(localStorage.getItem('leaveList') || '[]');
                const userLeaves = leaveList.filter(leave => leave.userId === user.id || !leave.userId);
                
                // คำนวณสถิติ
                const totalLeaves = userLeaves.length;
                const approvedLeaves = userLeaves.filter(l => l.status === 'อนุมัติ').length;
                const pendingLeaves = userLeaves.filter(l => l.status === 'รออนุมัติ').length;
                const rejectedLeaves = userLeaves.filter(l => l.status === 'ไม่อนุมัติ').length;
                
                // นับวันลาที่ใช้ไปแล้ว (เฉพาะที่อนุมัติ)
                const leaveDaysUsed = {
                  'ลาป่วย': 0,
                  'ลากิจ': 0,
                  'ลาพักร้อน': 0,
                  'ลาคลอด': 0
                };
                
                userLeaves
                  .filter(l => l.status === 'อนุมัติ')
                  .forEach(leave => {
                    const days = parseInt(leave.days) || 0;
                    if (Object.prototype.hasOwnProperty.call(leaveDaysUsed, leave.leaveType)) {
                      leaveDaysUsed[leave.leaveType] += days;
                    }
                  });
                
                return (
                  <div className="p-5 bg-white border-2 border-gray-100 shadow-sm rounded-2xl">
                    <h4 className="flex items-center gap-2 mb-4 font-bold text-gray-800">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="#f26623">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                      </svg>
                      สถิติการลา
                    </h4>
                    
                    <div className="grid grid-cols-2 gap-3 mb-4 md:grid-cols-4">
                      <div className="p-3 text-center rounded-lg bg-blue-50">
                        <div className="text-2xl font-bold text-blue-600">{totalLeaves}</div>
                        <div className="mt-1 text-xs text-gray-600">ทั้งหมด</div>
                      </div>
                      <div className="p-3 text-center rounded-lg bg-green-50">
                        <div className="text-2xl font-bold text-green-600">{approvedLeaves}</div>
                        <div className="mt-1 text-xs text-gray-600">อนุมัติ</div>
                      </div>
                      <div className="p-3 text-center rounded-lg bg-yellow-50">
                        <div className="text-2xl font-bold text-yellow-600">{pendingLeaves}</div>
                        <div className="mt-1 text-xs text-gray-600">รออนุมัติ</div>
                      </div>
                      <div className="p-3 text-center rounded-lg bg-red-50">
                        <div className="text-2xl font-bold text-red-600">{rejectedLeaves}</div>
                        <div className="mt-1 text-xs text-gray-600">ไม่อนุมัติ</div>
                      </div>
                    </div>
                    
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between py-2 border-b border-gray-100">
                        <span className="text-gray-600">ลาป่วย (ใช้ไป/ทั้งหมด)</span>
                        <span className="font-medium text-gray-800">{leaveDaysUsed['ลาป่วย']} / 60 วัน</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-gray-100">
                        <span className="text-gray-600">ลากิจ (ใช้ไป/ทั้งหมด)</span>
                        <span className="font-medium text-gray-800">{leaveDaysUsed['ลากิจ']} / 45 วัน</span>
                      </div>
                      <div className="flex justify-between py-2 border-b border-gray-100">
                        <span className="text-gray-600">ลาพักร้อน (ใช้ไป/ทั้งหมด)</span>
                        <span className="font-medium text-gray-800">{leaveDaysUsed['ลาพักร้อน']} / 10 วัน</span>
                      </div>
                      <div className="flex justify-between py-2">
                        <span className="text-gray-600">ลาคลอด (ใช้ไป/ทั้งหมด)</span>
                        <span className="font-medium text-gray-800">{leaveDaysUsed['ลาคลอด']} / 90 วัน</span>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* 🔥 สถิติการเข้าร่วมกิจกรรม */}
              {(() => {
                const eventsData = JSON.parse(localStorage.getItem('events') || '[]');
                const userEvents = eventsData.filter(event => {
                  // เช็คว่า user อยู่ใน teams ของกิจกรรม
                  if (event.teams && user.department) {
                    return event.teams.includes(user.department);
                  }
                  return false;
                });
                
                const totalEvents = userEvents.length;
                const ongoingEvents = userEvents.filter(e => e.status === 'ongoing').length;
                const completedEvents = userEvents.filter(e => e.status === 'completed').length;
                const upcomingEvents = userEvents.filter(e => e.status === 'upcoming').length;
                
                return (
                  <div className="p-5 bg-white border-2 border-gray-100 shadow-sm rounded-2xl">
                    <h4 className="flex items-center gap-2 mb-4 font-bold text-gray-800">
                      <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="#f26623">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                      </svg>
                      สถิติการเข้าร่วมกิจกรรม
                    </h4>
                    
                    <div className="grid grid-cols-2 gap-3 mb-4 md:grid-cols-4">
                      <div className="p-3 text-center rounded-lg bg-indigo-50">
                        <div className="text-2xl font-bold text-indigo-600">{totalEvents}</div>
                        <div className="mt-1 text-xs text-gray-600">ทั้งหมด</div>
                      </div>
                      <div className="p-3 text-center rounded-lg bg-blue-50">
                        <div className="text-2xl font-bold text-blue-600">{ongoingEvents}</div>
                        <div className="mt-1 text-xs text-gray-600">กำลังดำเนินการ</div>
                      </div>
                      <div className="p-3 text-center rounded-lg bg-green-50">
                        <div className="text-2xl font-bold text-green-600">{completedEvents}</div>
                        <div className="mt-1 text-xs text-gray-600">เสร็จสิ้น</div>
                      </div>
                      <div className="p-3 text-center rounded-lg bg-amber-50">
                        <div className="text-2xl font-bold text-amber-600">{upcomingEvents}</div>
                        <div className="mt-1 text-xs text-gray-600">กำลังจะมาถึง</div>
                      </div>
                    </div>
                    
                    {totalEvents > 0 ? (
                      <div className="space-y-2">
                        <div className="mb-2 text-xs font-semibold text-gray-600">กิจกรรมล่าสุด:</div>
                        {userEvents.slice(0, 3).map((event, index) => (
                          <div key={index} className="flex gap-3 p-2 text-sm rounded-lg bg-gray-50">
                            <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                              event.status === 'ongoing' ? 'bg-blue-500' :
                              event.status === 'completed' ? 'bg-green-500' :
                              'bg-amber-500'
                            }`}></div>
                            <div className="flex-1">
                              <div className="font-medium text-gray-800">{event.name}</div>
                              <div className="text-xs text-gray-600">{event.date} | {event.locationName}</div>
                              <div className="text-xs text-gray-500 mt-0.5">
                                {event.status === 'ongoing' ? '🔵 กำลังดำเนินการ' :
                                 event.status === 'completed' ? '✅ เสร็จสิ้น' :
                                 '🟡 กำลังจะมาถึง'}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <div className="py-2 text-sm text-center text-gray-500">
                        ยังไม่มีกิจกรรมที่เข้าร่วม
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* ประวัติการทำงาน */}
              {user.workHistory && user.workHistory.length > 0 && (
                <div className="p-5 bg-white border-2 border-gray-100 shadow-sm rounded-2xl">
                  <h4 className="flex items-center gap-2 mb-4 font-bold text-gray-800">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    ประวัติการทำงาน
                  </h4>
                  <div className="space-y-3">
                    {user.workHistory.map((work, index) => (
                      <div key={index} className="flex gap-3 text-sm">
                        <div className="flex-shrink-0 w-2 h-2 mt-2 bg-gray-400 rounded-full"></div>
                        <div>
                          <div className="font-medium text-gray-800">{work.position}</div>
                          <div className="text-gray-600">{work.company}</div>
                          <div className="text-xs text-gray-500">{work.period}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* การศึกษา */}
              {user.education && user.education.length > 0 && (
                <div className="p-5 bg-white border-2 border-gray-100 shadow-sm rounded-2xl">
                  <h4 className="flex items-center gap-2 mb-4 font-bold text-gray-800">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path d="M12 14l9-5-9-5-9 5 9 5z" />
                      <path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14zm-4 6v-7.5l4-2.222" />
                    </svg>
                    การศึกษา
                  </h4>
                  <div className="space-y-2">
                    {user.education.map((edu, index) => {
                      const formatted = typeof edu === 'string'
                        ? edu
                        : `${edu.degree || ''}${edu.institution ? ' - ' + edu.institution : ''}${edu.year ? ' (' + edu.year + ')' : ''}`;
                      return (
                        <div key={index} className="flex items-center gap-2 text-sm">
                          <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                          <span className="text-gray-700">{formatted}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Skills */}
              {user.skills && user.skills.length > 0 && (
                <div className="p-5 bg-white border-2 border-gray-100 shadow-sm rounded-2xl">
                  <h4 className="flex items-center gap-2 mb-4 font-bold text-gray-800">
                    <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                    </svg>
                    ทักษะ
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {user.skills.map((skill, index) => {
                      const formatted = typeof skill === 'string'
                        ? skill
                        : `${skill.name || ''}${skill.level ? ' - ' + skill.level : ''}${skill.years ? ' (' + skill.years + ' ปี)' : ''}`;
                      return (
                        <span key={index} className="px-3 py-1 text-xs font-medium rounded-full bg-brand-accent text-primary">
                          {formatted}
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* ข้อมูลสวัสดิการ */}
              <div className="p-5 bg-white border-2 border-gray-100 shadow-sm rounded-2xl">
                <h4 className="flex items-center gap-2 mb-4 font-bold text-gray-800">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  ข้อมูลสวัสดิการ
                </h4>
                <div className="space-y-3 text-sm">
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">เลขประกันสังคม</span>
                    <span className="font-medium text-gray-800">{user.socialSecurityNumber || 'ไม่ระบุ'}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">สิทธิประกันสังคม</span>
                    <span className="font-medium text-gray-800">{user.socialSecurityNumber ? 'มี' : 'ไม่มี'}</span>
                  </div>
                  <div className="flex justify-between py-2 border-b border-gray-100">
                    <span className="text-gray-600">กองทุนสำรองเลี้ยงชีพ</span>
                    <span className="font-medium text-gray-800">{user.salary && Number(user.salary) >= 30000 ? 'มี' : 'ไม่มี'}</span>
                  </div>
                  <div className="flex justify-between py-2">
                    <span className="text-gray-600">ประกันสุขภาพกลุ่ม</span>
                    <span className="font-medium text-gray-800">{user.salary && Number(user.salary) >= 40000 ? 'มี' : 'ไม่มี'}</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

export default UserDetailModal;
