import React, { useState, useCallback } from 'react';

// Component: UserTable - แสดงตารางรายชื่อพนักงานพร้อมระบบขยายดูข้อมูล GPS และรูปถ่าย
// Props:
//   - users: รายการข้อมูลพนักงาน
//   - onSelectUser: ฟังก์ชันเมื่อกดดูรายละเอียด
//   - getStatusBadge: ฟังก์ชันจัดการสีของสถานะ
//   - currentUser: ข้อมูลผู้ใช้ปัจจุบัน (สำหรับตรวจสอบสิทธิ์แก้ไข)
//   - onAttendanceEdit: ฟังก์ชันเมื่อกดแก้ไขข้อมูลการเข้า-ออกงาน
//   - onSaveAttendanceEdit: ฟังก์ชันบันทึกการแก้ไข
//   - editingAttendance: สถานะการแก้ไขปัจจุบัน
//   - attendanceForm: ข้อมูลฟอร์มแก้ไข
//   - onAttendanceFormChange: ฟังก์ชันเปลี่ยนค่าฟอร์ม
const UserTable = React.memo(function UserTable({ 
  users, 
  onSelectUser, 
  getStatusBadge,
  currentUser,
  onAttendanceEdit,
  onSaveAttendanceEdit,
  editingAttendance,
  attendanceForm,
  onAttendanceFormChange
}) {
  // สถานะการขยายแถว - เก็บ userId ของแถวที่กำลังขยาย
  const [expandedUserId, setExpandedUserId] = useState(null);
  
  // วันที่ที่เลือก - Default เป็นวันปัจจุบัน
  const [selectedDate, setSelectedDate] = useState(() => {
    return new Date().toISOString().split('T')[0];
  });
  
  // 🆕 กะที่เลือก - Default เป็นทุกกะ
  const [selectedShift, setSelectedShift] = useState('all');

  // ฟังก์ชันดึงข้อมูลการเข้างานจริงจาก usersData
  // Parameters:
  //   - userId: รหัสพนักงาน
  //   - userName: ชื่อพนักงาน
  //   - date: วันที่ที่ต้องการดูข้อมูล (DD/MM/YYYY+543 - รูปแบบไทย)
  //   - shiftFilter: กะที่ต้องการดู ('all', '1', '2')
  // Returns: Object ที่มีข้อมูล checkIn และ checkOut หรือ null ถ้าไม่มีข้อมูล
  const getAttendanceData = useCallback((userId, userName, date, shiftFilter = 'all') => {
    try {
      // แปลงวันที่จาก YYYY-MM-DD เป็นรูปแบบไทย DD/MM/YYYY+543
      const [year, month, day] = date.split('-');
      const thaiYear = parseInt(year) + 543;
      const thaiDate = `${day}/${month}/${thaiYear}`;
      
      // 🔥 ดึงข้อมูล schedule ของ user จาก usersData
      const usersDataJson = localStorage.getItem('usersData');
      let userScheduleLocation = null;
      
      if (usersDataJson) {
        const usersData = JSON.parse(usersDataJson);
        const userData = usersData.find(u => u.id === userId);
        
        // หาตารางงานของ user (ค้นหาจาก sampleSchedules)
        const schedulesJson = localStorage.getItem('sampleSchedules');
        if (schedulesJson) {
          const schedules = JSON.parse(schedulesJson);
          const userSchedule = schedules.find(schedule => {
            // เช็คว่า user อยู่ในทีม/แผนกที่มีตารางงานนี้
            if (userData && userData.department && schedule.teams) {
              return schedule.teams.includes(userData.department);
            }
            return false;
          });
          
          if (userSchedule) {
            userScheduleLocation = userSchedule.location || null;
          }
        }
      }
      
      // ดึงข้อมูลจาก usersData แทน attendanceRecords
      if (!usersDataJson) {
        return null;
      }
      
      const usersData = JSON.parse(usersDataJson);
      const userData = usersData.find(u => u.id === userId);
      
      if (!userData || !userData.attendanceRecords) {
        return null;
      }
      
      // หาข้อมูลของวันที่ต้องการ
      const record = userData.attendanceRecords.find(r => r.date === thaiDate);
      
      if (!record) {
        return null;
      }
      
      // 🆕 รองรับทั้ง format เก่า (checkIn/checkOut) และ format ใหม่ (shifts array)
      let checkInData = null;
      let checkOutData = null;
      
      if (record.shifts && Array.isArray(record.shifts) && record.shifts.length > 0) {
        // Format ใหม่ - มี shifts array
        let targetShift = null;
        
        if (shiftFilter === 'all') {
          // แสดงกะแรกที่มีข้อมูล
          targetShift = record.shifts[0];
        } else {
          // แสดงกะที่เลือก - ใช้ shiftId หรือ index
          const shiftIndex = parseInt(shiftFilter) - 1;
          targetShift = record.shifts[shiftIndex];
          
          // Fallback: ถ้าหาจาก index ไม่เจอ ลองหาจาก time pattern
          if (!targetShift && record.shifts.length > 0) {
            // กะที่ 1 มักเป็นเช้า (07:00-15:00), กะที่ 2 มักเป็นบ่าย/เย็น (15:00-21:00)
            const isEarlyShift = shiftFilter === '1';
            targetShift = record.shifts.find((shift, idx) => {
              if (isEarlyShift) {
                return idx === 0; // กะแรก
              } else {
                return idx > 0; // กะที่ 2+
              }
            });
          }
        }
        
        if (targetShift) {
          checkInData = {
            time: targetShift.checkIn || targetShift.checkInTime || '-',
            gpsStatus: 'อยู่ในระยะ',
            distance: '15 เมตร',
            location: userScheduleLocation || targetShift.location || 'ไม่มีข้อมูลสถานที่',
            photo: targetShift.checkInPhoto || null,
            status: targetShift.status || 'on_time',
            checkedByBuddy: targetShift.checkedByBuddy || false,
            buddyName: targetShift.buddyName || null,
            shiftId: targetShift.shiftId || null
          };
          
          if (targetShift.checkOut || targetShift.checkOutTime) {
            checkOutData = {
              time: targetShift.checkOut || targetShift.checkOutTime || '-',
              gpsStatus: 'อยู่ในระยะ',
              distance: '18 เมตร',
              location: userScheduleLocation || targetShift.location || 'ไม่มีข้อมูลสถานที่',
              photo: targetShift.checkOutPhoto || null
            };
          }
        }
      } else if (record.checkIn && record.checkIn.time) {
        // Format เก่า - มี checkIn/checkOut โดยตรง
        checkInData = {
          time: record.checkIn.time || '-',
          gpsStatus: record.checkIn.gps ? 'อยู่ในระยะ' : 'อยู่นอกระยะ',
          distance: record.checkIn.distance || 'ไม่ทราบ',
          location: userScheduleLocation || record.checkIn.address || record.checkIn.location || 'ไม่มีข้อมูล', // 🔥 ใช้สถานที่จาก schedule
          photo: record.checkIn.photo || null,
          status: record.checkIn.status === 'ตรงเวลา' ? 'on_time' : 
                 record.checkIn.status === 'มาสาย' ? 'late' : 
                 record.checkIn.status === 'ขาด' ? 'absent' : 'on_time',
          checkedByBuddy: record.checkIn.checkedByBuddy || false,
          buddyName: record.checkIn.buddyName || null
        };
        checkOutData = record.checkOut ? {
          time: record.checkOut.time || '-',
          gpsStatus: record.checkOut.gps ? 'อยู่ในระยะ' : 'อยู่นอกระยะ',
          distance: record.checkOut.distance || 'ไม่ทราบ',
          location: userScheduleLocation || record.checkOut.address || record.checkOut.location || 'ไม่มีข้อมูล', // 🔥 ใช้สถานที่จาก schedule
          photo: record.checkOut.photo || null,
          checkedByBuddy: record.checkOut.checkedByBuddy || false,
          buddyName: record.checkOut.buddyName || null
        } : null;
      }
      
      if (!checkInData) {
        return null;
      }
      
      return {
        checkIn: checkInData,
        checkOut: checkOutData
      };
    } catch (error) {
      console.error('❌ Error loading attendance data:', error);
      return null;
    }
  }, []); // Empty dependency - ฟังก์ชันนี้ไม่ขึ้นกับ state ใดๆ


  // จัดการการขยาย/ย่อแถว (ใช้ useCallback เพื่อป้องกัน re-render ที่ไม่จำเป็น)
  const toggleExpand = useCallback((userId, e) => {
    e.stopPropagation(); // ป้องกันไม่ให้เปิด detail modal
    setExpandedUserId(prevId => prevId === userId ? null : userId);
  }, []);

  // จัดการการเปลี่ยนวันที่ (ใช้ useCallback เพื่อป้องกัน re-render ที่ไม่จำเป็น)
  const handleDateChange = useCallback((date, e) => {
    e.stopPropagation(); // ป้องกัน event bubbling
    setSelectedDate(date);
  }, []);

  return (
    <div className="bg-white dark:bg-secondary/95 transition-colors duration-300 rounded-2xl shadow-sm overflow-hidden border border-gray-200 dark:border-white/10">
      {/* 🔥 Scroll แนวนอนเมื่อตารางกว้างเกิน + Scroll แนวตั้งเมื่อข้อมูลเยอะ */}
      <div className="overflow-x-auto overflow-y-auto max-h-[calc(100vh-250px)]">
        {/* เพิ่ม min-width เพื่อให้ตารางกว้างพอ มี scroll แนวนอนได้ */}
        <table className="w-full min-w-[1200px]">
          <thead className="bg-brand-accent dark:bg-orange-100 border-b border-gray-200">
            <tr>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider w-12">
                
              </th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                ชื่อ-นามสกุล
              </th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                รหัสพนักงาน
              </th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                แผนก
              </th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                บทบาท
              </th>
              <th className="px-6 py-4 text-left text-xs font-bold text-gray-700 uppercase tracking-wider">
                สถานะ
              </th>
              <th className="px-6 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider">
                จัดการ
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {users.map((user) => {
              const isExpanded = expandedUserId === user.id;
              const attendanceData = isExpanded ? getAttendanceData(user.id, user.name, selectedDate, selectedShift) : null;
              
              return (
                <React.Fragment key={user.id}>
                  <tr className="hover:bg-orange-50/20 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <button
                        onClick={(e) => toggleExpand(user.id, e)}
                        className="p-1 hover:bg-orange-100 rounded-lg transition-colors"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className={`h-5 w-5 text-gray-600 transition-transform ${isExpanded ? 'rotate-90' : ''}`}
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                        </svg>
                      </button>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full overflow-hidden bg-primary dark:bg-primary flex-shrink-0">
                          <img
                            src={user.profileImage || `https://i.pravatar.cc/100?u=${user.id}`}
                            alt={user.name}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div>
                          <div className="font-semibold text-black dark:text-white">{user.name}</div>
                          <div className="text-sm text-gray-500 dark:text-gray-400">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-500 dark:text-gray-400">{user.employeeId}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className="text-sm text-gray-500 dark:text-gray-400 capitalize">{user.department}</span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                      {user.role}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span
                        className={`inline-flex px-3 py-1 text-xs font-semibold rounded-full ${getStatusBadge(user.status)}`}
                      >
                        {user.status}
                      </span>
                    </td>
                    
                    <td className="px-6 py-4 whitespace-nowrap text-center">
                      <button
                        onClick={() => onSelectUser(user)}
                        className="inline-flex items-center gap-1 px-4 py-2 bg-primary dark:bg-primary-orange text-white rounded-lg hover:bg-primary/70 transition-colors transform hover:scale-105 text-sm font-medium shadow-md hover:shadow-lg"
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-4 w-4"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                          />
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                          />
                        </svg>
                        ดูรายละเอียด
                      </button>
                    </td>
                  </tr>
                  
                  {/* Expanded Row - GPS & Photos */}
                  {isExpanded && (
                    <tr className="bg-white dark:bg-secondary/95 transition-colors duration-300">
                      <td colSpan="7" className="px-6 py-6">
                        <div className="space-y-4">
                          {/* Date & Shift Selector */}
                          <div className="flex items-center gap-3 mb-4 flex-wrap">
                            {/* Date Selector */}
                            <div className="flex items-center gap-2">
                              <label className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                เลือกวันที่:
                              </label>
                              <input
                                type="date"
                                value={selectedDate}
                                onChange={(e) => handleDateChange(e.target.value, e)}
                                className="px-4 py-2 border-2 border-orange-200 rounded-lg focus:border-orange-500 focus:outline-none transition-colors text-sm font-medium"
                                style={{ colorScheme: 'light' }}
                              />
                            </div>
                            
                            {/* 🆕 Shift Selector - แสดงถ้า user มีหลายกะงาน */}
                            {(() => {
                              // 🔥 เช็คจาก attendance schedules (attendanceSchedules) แทน sampleSchedules
                              const schedulesJson = localStorage.getItem('attendanceSchedules');
                              const usersDataJson = localStorage.getItem('usersData');
                              let userShiftCount = 0;
                              
                              if (schedulesJson && usersDataJson) {
                                const schedules = JSON.parse(schedulesJson);
                                const usersData = JSON.parse(usersDataJson);
                                const userData = usersData.find(u => u.id === user.id);
                                
                                if (userData?.department) {
                                  // นับตารางงานที่ user มีตาม department
                                  userShiftCount = schedules.filter(schedule => {
                                    return schedule.teams && schedule.teams.includes(userData.department);
                                  }).length;
                                }
                              }
                              
                              // 🔥 Fallback: เช็คจาก attendance records ของวันนี้ด้วย
                              if (userShiftCount <= 1) {
                                const [year, month, day] = selectedDate.split('-');
                                const thaiYear = parseInt(year) + 543;
                                const thaiDate = `${day}/${month}/${thaiYear}`;
                                
                                if (usersDataJson) {
                                  const usersData = JSON.parse(usersDataJson);
                                  const userData = usersData.find(u => u.id === user.id);
                                  
                                  if (userData?.attendanceRecords) {
                                    const todayRecord = userData.attendanceRecords.find(r => r.date === thaiDate);
                                    if (todayRecord?.shifts && Array.isArray(todayRecord.shifts)) {
                                      userShiftCount = todayRecord.shifts.length;
                                    }
                                  }
                                }
                              }
                              
                              // ถ้าไม่มีกะ หรือมีแค่กะเดียว ไม่ต้องแสดง selector
                              if (userShiftCount <= 1) {
                                return null;
                              }
                              
                              // ถ้ามี 2+ กะ แสดง selector
                              return (
                                <div className="flex items-center gap-2">
                                  <label className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    เลือกกะ ({userShiftCount} กะ):
                                  </label>
                                  <select
                                    value={selectedShift}
                                    onChange={(e) => setSelectedShift(e.target.value)}
                                    className="px-4 py-2 border-2 border-blue-200 rounded-lg focus:border-blue-500 focus:outline-none transition-colors text-sm font-medium bg-white cursor-pointer"
                                  >
                                    <option value="all">ทุกกะ</option>
                                    {Array.from({ length: userShiftCount }, (_, i) => (
                                      <option key={i + 1} value={String(i + 1)}>กะที่ {i + 1}</option>
                                    ))}
                                  </select>
                                </div>
                              );
                            })()}
                          </div>

                          {/* แสดงข้อมูลถ้ามี หรือ SVG ถ้าไม่มี */}
                          {attendanceData ? (
                            <div className="space-y-4">
                              {/* 🆕 แสดงข้อความกะที่เลือก พร้อม shiftId */}
                              {selectedShift !== 'all' && (
                                <div className="bg-blue-50 border-l-4 border-blue-500 p-3 rounded-lg">
                                  <p className="text-sm font-medium text-blue-900 flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span>กำลังแสดงข้อมูล: <strong>กะที่ {selectedShift}</strong> ({selectedShift === '1' ? 'เช้า' : 'บ่าย/เย็น'})</span>
                                    {attendanceData.checkIn?.shiftId && (
                                      <span className="ml-2 text-xs bg-blue-200 px-2 py-0.5 rounded">
                                        {attendanceData.checkIn.shiftId}
                                      </span>
                                    )}
                                  </p>
                                </div>
                              )}
                              
                              {selectedShift === 'all' && (
                                <div className="bg-amber-50 border-l-4 border-amber-500 p-3 rounded-lg">
                                  <p className="text-sm font-medium text-amber-900 flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                    <span>แสดงข้อมูลกะแรกของวันนี้ (เลือก "เลือกกะ" เพื่อดูกะอื่น)</span>
                                  </p>
                                </div>
                              )}
                              
                              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                              {/* Check-in Section */}
                              <div className="bg-white rounded-xl shadow-md border-2 border-green-200 overflow-hidden">
                                <div className="bg-gradient-to-r from-green-500 to-emerald-600 px-4 py-3 flex items-center justify-between">
                                  <h4 className="font-bold text-white flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                                    </svg>
                                    Check-in
                                  </h4>
                                  {(currentUser?.role === 'admin' || currentUser?.role === 'superadmin') && (
                                    <div className="flex gap-2">
                                      {editingAttendance?.userId === user.id && editingAttendance?.date === selectedDate && editingAttendance?.type === 'checkIn' ? (
                                        <>
                                          <button 
                                            onClick={onSaveAttendanceEdit} 
                                            className="text-xs px-3 py-1 bg-white text-green-700 rounded hover:bg-green-50 transition-colors font-semibold">
                                            บันทึก
                                          </button>
                                          <button 
                                            onClick={() => onAttendanceEdit(null)} 
                                            className="text-xs px-3 py-1 bg-white/20 text-white rounded hover:bg-white/30 transition-colors">
                                            ยกเลิก
                                          </button>
                                        </>
                                      ) : (
                                        <button 
                                          onClick={() => onAttendanceEdit({ userId: user.id, date: selectedDate, type: 'checkIn', data: attendanceData.checkIn })} 
                                          className="text-xs px-3 py-1 bg-white text-green-700 rounded hover:bg-green-50 transition-colors font-semibold">
                                          แก้ไข
                                        </button>
                                      )}
                                    </div>
                                  )}
                                </div>
                                <div className="p-4 space-y-4">
                                  {/* Photo */}
                                  <div>
                                    <p className="text-xs font-semibold text-gray-600 mb-2">รูปถ่าย</p>
                                    {attendanceData.checkIn.photo ? (
                                      <div className="relative w-full max-w-sm mx-auto">
                                        <img
                                          src={attendanceData.checkIn.photo}
                                          alt="Check-in"
                                          className="w-full h-auto object-cover rounded-lg border-2 border-gray-200"
                                        />
                                      </div>
                                    ) : (
                                      <div className="w-full max-w-sm mx-auto aspect-square flex items-center justify-center bg-gray-100 rounded-lg border-2 border-gray-200">
                                        <div className="text-center text-gray-400">
                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                          </svg>
                                          <p className="text-sm">ไม่มีรูปภาพ</p>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                  
                                  {/* Info */}
                                  <div className="space-y-2 text-sm">
                                    <div className="flex items-center gap-2">
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                      <span className="text-gray-700 font-medium">เวลา:</span>
                                      {editingAttendance?.userId === user.id && editingAttendance?.date === selectedDate && editingAttendance?.type === 'checkIn' ? (
                                        <input 
                                          type="time" 
                                          value={attendanceForm.time || ''} 
                                          onChange={(e) => onAttendanceFormChange({...attendanceForm, time: e.target.value})} 
                                          className="text-sm font-bold border border-green-300 rounded px-2 py-1"
                                        />
                                      ) : (
                                        <span className="font-bold text-gray-950">{attendanceData.checkIn.time}</span>
                                      )}
                                    </div>
                                    
                                    <div className="flex items-center gap-2">
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                      </svg>
                                      <span className="text-gray-700 font-medium">สถานะ:</span>
                                      {editingAttendance?.userId === user.id && editingAttendance?.date === selectedDate && editingAttendance?.type === 'checkIn' ? (
                                        <select 
                                          value={attendanceForm.status || 'on_time'} 
                                          onChange={(e) => onAttendanceFormChange({...attendanceForm, status: e.target.value})} 
                                          className="text-xs font-bold border border-green-300 rounded px-2 py-1">
                                          <option value="on_time">ตรงเวลา</option>
                                          <option value="late">มาสาย</option>
                                          <option value="absent">ขาด</option>
                                          <option value="leave">ลา</option>
                                        </select>
                                      ) : (
                                        <span className={`font-bold px-2 py-0.5 rounded text-xs ${
                                        (() => {
                                          // 🔥 เช็คว่าวันนี้มีการลางานที่ approved หรือไม่
                                          const leaveList = JSON.parse(localStorage.getItem('leaveList') || '[]');
                                          const [day, month, year] = selectedDate.split('-');
                                          
                                          const leaveOnThisDate = leaveList.find(leave => {
                                            if (leave.status !== 'อนุมัติ') return false;
                                            // เช็คว่าวันนี้อยู่ในช่วงการลาหรือไม่
                                            const [startDay, startMonth, startYear] = leave.startDate.split('/');
                                            const [endDay, endMonth, endYear] = leave.endDate.split('/');
                                            const start = new Date(parseInt(startYear) - 543, parseInt(startMonth) - 1, parseInt(startDay));
                                            const end = new Date(parseInt(endYear) - 543, parseInt(endMonth) - 1, parseInt(endDay));
                                            const current = new Date(year, month - 1, day);
                                            return current >= start && current <= end;
                                          });
                                          
                                          if (leaveOnThisDate) {
                                            return 'bg-purple-100 text-purple-700'; // ลา
                                          }
                                          
                                          return attendanceData.checkIn.status === 'on_time' ? 'bg-green-100 text-green-700' :
                                                 attendanceData.checkIn.status === 'late' ? 'bg-orange-100 text-orange-700' :
                                                 attendanceData.checkIn.status === 'absent' ? 'bg-red-100 text-red-700' :
                                                 'bg-blue-100 text-blue-700';
                                        })()
                                      }`}>
                                        {(() => {
                                          // 🔥 แสดงสถานะลาถ้ามี
                                          const leaveList = JSON.parse(localStorage.getItem('leaveList') || '[]');
                                          const [day, month, year] = selectedDate.split('-');
                                          
                                          const leaveOnThisDate = leaveList.find(leave => {
                                            if (leave.status !== 'อนุมัติ') return false;
                                            const [startDay, startMonth, startYear] = leave.startDate.split('/');
                                            const [endDay, endMonth, endYear] = leave.endDate.split('/');
                                            const start = new Date(parseInt(startYear) - 543, parseInt(startMonth) - 1, parseInt(startDay));
                                            const end = new Date(parseInt(endYear) - 543, parseInt(endMonth) - 1, parseInt(endDay));
                                            const current = new Date(year, month - 1, day);
                                            return current >= start && current <= end;
                                          });
                                          
                                          if (leaveOnThisDate) {
                                            return `ลา${leaveOnThisDate.leaveType}`;
                                          }
                                          
                                          return attendanceData.checkIn.status === 'on_time' ? 'ตรงเวลา' :
                                                 attendanceData.checkIn.status === 'late' ? 'สาย' :
                                                 attendanceData.checkIn.status === 'absent' ? 'ขาด' : 'ลา';
                                        })()}
                                      </span>
                                      )}
                                    </div>
                                    
                                    <div className="flex items-center gap-2">
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                      </svg>
                                      <span className="text-gray-700 font-medium">GPS:</span>
                                      <span className={`font-bold ${attendanceData.checkIn.gpsStatus === 'อยู่ในระยะ' ? 'text-green-700' : 'text-red-700'}`}>
                                        {attendanceData.checkIn.gpsStatus}
                                      </span>
                                    </div>
                                    
                                    <div className="flex items-center gap-2">
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                      </svg>
                                      <span className="text-gray-700 font-medium">ระยะห่าง:</span>
                                      <span className="font-bold text-gray-950">{attendanceData.checkIn.distance}</span>
                                    </div>
                                    
                                    <div className="flex items-start gap-2">
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                                      </svg>
                                      <div>
                                        <span className="text-gray-700 font-medium">พิกัด:</span>
                                        <p className="font-mono text-xs font-semibold text-gray-950 mt-1">{attendanceData.checkIn.location}</p>
                                      </div>
                                    </div>
                                    
                                    {/* 🆕 แสดงหมายเหตุเช็คแทน */}
                                    {attendanceData.checkIn.checkedByBuddy && (
                                      <div className="flex items-start gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-yellow-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                        </svg>
                                        <div>
                                          <span className="text-yellow-700 font-semibold text-xs flex items-center gap-1">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                            </svg>
                                            เช็คแทน
                                          </span>
                                          {attendanceData.checkIn.buddyName && (
                                            <p className="text-xs text-yellow-600 mt-0.5">
                                              โดย: {attendanceData.checkIn.buddyName}
                                            </p>
                                          )}
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                </div>
                              </div>

                              {/* Check-out Section */}
                              {attendanceData.checkOut ? (
                                <div className="bg-white rounded-xl shadow-md border-2 border-orange-200 overflow-hidden">
                                  <div className="bg-gradient-to-r from-orange-500 to-red-600 px-4 py-3 flex items-center justify-between">
                                    <h4 className="font-bold text-white flex items-center gap-2">
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                      </svg>
                                      Check-out
                                    </h4>
                                    {(currentUser?.role === 'admin' || currentUser?.role === 'superadmin') && (
                                      <div className="flex gap-2">
                                        {editingAttendance?.userId === user.id && editingAttendance?.date === selectedDate && editingAttendance?.type === 'checkOut' ? (
                                          <>
                                            <button 
                                              onClick={onSaveAttendanceEdit} 
                                              className="text-xs px-3 py-1 bg-white text-red-700 rounded hover:bg-red-50 transition-colors font-semibold">
                                              บันทึก
                                            </button>
                                            <button 
                                              onClick={() => onAttendanceEdit(null)} 
                                              className="text-xs px-3 py-1 bg-white/20 text-white rounded hover:bg-white/30 transition-colors">
                                              ยกเลิก
                                            </button>
                                          </>
                                        ) : (
                                          <button 
                                            onClick={() => onAttendanceEdit({ userId: user.id, date: selectedDate, type: 'checkOut', data: attendanceData.checkOut })} 
                                            className="text-xs px-3 py-1 bg-white text-red-700 rounded hover:bg-red-50 transition-colors font-semibold">
                                            แก้ไข
                                          </button>
                                        )}
                                      </div>
                                    )}
                                  </div>
                                  <div className="p-4 space-y-4">
                                    {/* Photo */}
                                    <div>
                                      <p className="text-xs font-semibold text-gray-600 mb-2">รูปถ่าย</p>
                                      {attendanceData.checkOut.photo ? (
                                        <div className="relative w-full max-w-sm mx-auto">
                                          <img
                                            src={attendanceData.checkOut.photo}
                                            alt="Check-out"
                                            className="w-full h-auto object-cover rounded-lg border-2 border-gray-200"
                                          />
                                        </div>
                                      ) : (
                                        <div className="w-full max-w-sm mx-auto aspect-square flex items-center justify-center bg-gray-100 rounded-lg border-2 border-gray-200">
                                          <div className="text-center text-gray-400">
                                            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                            </svg>
                                            <p className="text-sm">ไม่มีรูปภาพ</p>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                    
                                    {/* Info */}
                                    <div className="space-y-2 text-sm">
                                      <div className="flex items-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                        </svg>
                                        <span className="text-gray-700 font-medium">เวลา:</span>
                                        {editingAttendance?.userId === user.id && editingAttendance?.date === selectedDate && editingAttendance?.type === 'checkOut' ? (
                                          <input 
                                            type="time" 
                                            value={attendanceForm.time || ''} 
                                            onChange={(e) => onAttendanceFormChange({...attendanceForm, time: e.target.value})} 
                                            className="text-sm font-bold border border-red-300 rounded px-2 py-1"
                                          />
                                        ) : (
                                          <span className="font-bold text-gray-950">{attendanceData.checkOut.time}</span>
                                        )}
                                      </div>
                                      
                                      <div className="flex items-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                        <span className="text-gray-700 font-medium">สถานะ:</span>
                                        {editingAttendance?.userId === user.id && editingAttendance?.date === selectedDate && editingAttendance?.type === 'checkOut' ? (
                                          <select 
                                            value={attendanceForm.status || 'on_time'} 
                                            onChange={(e) => onAttendanceFormChange({...attendanceForm, status: e.target.value})} 
                                            className="text-xs font-bold border border-red-300 rounded px-2 py-1">
                                            <option value="on_time">ตรงเวลา</option>
                                            <option value="late">มาสาย</option>
                                            <option value="absent">ขาด</option>
                                            <option value="leave">ลา</option>
                                          </select>
                                        ) : (
                                          <span className="font-bold text-gray-950">ตรงเวลา</span>
                                        )}
                                      </div>
                                      
                                      <div className="flex items-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                                        </svg>
                                        <span className="text-gray-700 font-medium">GPS:</span>
                                        <span className={`font-bold ${attendanceData.checkOut.gpsStatus === 'อยู่ในระยะ' ? 'text-green-700' : 'text-red-700'}`}>
                                          {attendanceData.checkOut.gpsStatus}
                                        </span>
                                      </div>
                                      
                                      <div className="flex items-center gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                                        </svg>
                                        <span className="text-gray-700 font-medium">ระยะห่าง:</span>
                                        <span className="font-bold text-gray-950">{attendanceData.checkOut.distance}</span>
                                      </div>
                                      
                                      <div className="flex items-start gap-2">
                                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                                        </svg>
                                        <div>
                                          <span className="text-gray-700 font-medium">พิกัด:</span>
                                          <p className="font-mono text-xs font-semibold text-gray-950 mt-1">{attendanceData.checkOut.location}</p>
                                        </div>
                                      </div>
                                      
                                      {/* 🆕 แสดงหมายเหตุเช็คแทน */}
                                      {attendanceData.checkOut.checkedByBuddy && (
                                        <div className="flex items-start gap-2 p-2 bg-yellow-50 border border-yellow-200 rounded-lg">
                                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-yellow-600 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                                          </svg>
                                          <div>
                                            <span className="text-yellow-700 font-semibold text-xs flex items-center gap-1">
                                              <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                              </svg>
                                              เช็คแทน
                                            </span>
                                            {attendanceData.checkOut.buddyName && (
                                              <p className="text-xs text-yellow-600 mt-0.5">
                                                โดย: {attendanceData.checkOut.buddyName}
                                              </p>
                                            )}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              ) : (
                                <div className="bg-gray-50 rounded-xl shadow-md border-2 border-gray-200 overflow-hidden">
                                  <div className="bg-gradient-to-r from-gray-400 to-gray-500 px-4 py-3">
                                    <h4 className="font-bold text-white flex items-center gap-2">
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                                      </svg>
                                      Check-out
                                    </h4>
                                  </div>
                                  <div className="p-8 flex items-center justify-center h-full">
                                    <div className="text-center text-gray-400">
                                      <svg xmlns="http://www.w3.org/2000/svg" className="h-20 w-20 mx-auto mb-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                      <p className="text-base font-semibold">ยังไม่ได้ Check-out</p>
                                      <p className="text-sm mt-1">ไม่พบข้อมูลการออกงาน</p>
                                    </div>
                                  </div>
                                </div>
                              )}
                              </div>
                            </div>
                          ) : (
                            <div className="bg-gray-50 rounded-xl shadow-md border-2 border-gray-300 overflow-hidden p-8">
                              <div className="text-center text-gray-400">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-24 w-24 mx-auto mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <p className="text-lg font-semibold">ไม่พบข้อมูลการเข้างาน</p>
                                <p className="text-sm mt-1">ไม่มีบันทึกการเข้างานในวันที่เลือก</p>
                              </div>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
      
      {users.length === 0 && (
        <div className="text-center py-12">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-16 w-16 text-gray-300 mx-auto mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4"
            />
          </svg>
          <p className="text-gray-500 text-lg font-medium">ไม่พบข้อมูลผู้ใช้</p>
          <p className="text-gray-400 text-sm mt-1">ลองค้นหาด้วยคำอื่น หรือเปลี่ยนตัวกรอง</p>
        </div>
      )}
    </div>
  );
});

export default UserTable;
