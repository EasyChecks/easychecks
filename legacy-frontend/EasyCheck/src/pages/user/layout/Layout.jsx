import React, { useState, useEffect, useMemo } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import Nav from '../../../components/user/nav/Nav'
import { useAuth } from '../../../contexts/useAuth'
import { useLeave } from '../../../contexts/LeaveContext'
import { useEvents } from '../../../contexts/EventContext'
import { getLegacyUserData } from '../../../data/usersData' // Updated: merged from userData.js

function Layout() {
  const navigate = useNavigate()
  const { logout, user, attendance } = useAuth() // เพิ่ม attendance
  const { leaveList, leaveQuota, getUsedDays } = useLeave()
  const { getEventsForUser } = useEvents()
  const [showProfileMenu, setShowProfileMenu] = useState(false)
  const [showNotifications, setShowNotifications] = useState(false)
  const [readNotifications, setReadNotifications] = useState(() => {
    const saved = localStorage.getItem(`readNotifications_${user?.id}`)
    return saved ? JSON.parse(saved) : []
  })
  const [profileData, setProfileData] = useState(() => {
    const saved = localStorage.getItem('userProfileData')
    return saved ? JSON.parse(saved) : getLegacyUserData()
  })

  // ✅ อัพเดตรูป Profile ทันทีเมื่อ user เปลี่ยน (Login คนใหม่)
  useEffect(() => {
    if (user) {
      setProfileData(prev => ({
        ...prev,
        name: user.name || prev.name,
        position: user.position || prev.position,
        department: user.department || prev.department,
        profilePic: user.profileImage || prev.profilePic,
        workInfo: {
          ...prev.workInfo,
          employeeId: user.employeeId || user.username || prev.workInfo?.employeeId
        }
      }))
    }
  }, [user]) // dependency: user เพื่อรู้ว่า user เปลี่ยน

  // อัพเดตข้อมูลเมื่อ localStorage เปลี่ยน
  useEffect(() => {
    const handleStorageChange = (e) => {
      // ฟังการเปลี่ยนแปลง userProfileData (จาก ProfileScreen)
      if (e.key === 'userProfileData' && e.newValue) {
        setProfileData(JSON.parse(e.newValue))
      }

      // ✅ ข้อ 3: ฟังการเปลี่ยนแปลง usersData (Admin แก้ไข → User เห็นทันที)
      if (e.key === 'usersData' && e.newValue && user) {
        try {
          const updatedUsers = JSON.parse(e.newValue)
          const updatedUser = updatedUsers.find(u => u.id === user.id)

          if (updatedUser) {
            // อัปเดต profileData ให้ตรงกับข้อมูลที่ Admin แก้ไข
            setProfileData(prev => ({
              ...prev,
              name: updatedUser.name || prev.name,
              position: updatedUser.position || prev.position,
              department: updatedUser.department || prev.department,
              profilePic: updatedUser.profileImage || prev.profilePic,
              workInfo: {
                ...prev.workInfo,
                employeeId: updatedUser.employeeId || updatedUser.username || prev.workInfo?.employeeId
              }
            }))
          }
        } catch (e) {
          console.warn('Failed to sync layout data:', e)
        }
      }
    }

    // ฟังการเปลี่ยนแปลงของ localStorage
    window.addEventListener('storage', handleStorageChange)

    // ตรวจสอบทุก 500ms (สำหรับการเปลี่ยนแปลงใน tab เดียวกัน)
    const interval = setInterval(() => {
      const saved = localStorage.getItem('userProfileData')
      if (saved) {
        const newData = JSON.parse(saved)
        setProfileData(prevData => {
          // เปรียบเทียบว่ามีการเปลี่ยนแปลงหรือไม่
          if (JSON.stringify(prevData) !== JSON.stringify(newData)) {
            return newData
          }
          return prevData
        })
      }
    }, 500)

    return () => {
      window.removeEventListener('storage', handleStorageChange)
      clearInterval(interval)
    }
  }, [user]) // dependency: user เพื่อรู้ว่า user คนไหน login อยู่

  // 🔥 Real-time notification updates
  useEffect(() => {
    // ฟังการเปลี่ยนแปลงของ leaveList
    const handleLeaveUpdate = () => {
      // Force re-render เพื่อให้ notification อัพเดต
      setReadNotifications(prev => [...prev]);
    };
    
    const handleLeaveRequestCreated = (e) => {
      console.log('Leave request created:', e.detail);
      handleLeaveUpdate();
    };
    
    const handleLeaveStatusUpdated = (e) => {
      console.log('Leave status updated:', e.detail);
      handleLeaveUpdate();
    };
    
    window.addEventListener('leaveRequestCreated', handleLeaveRequestCreated);
    window.addEventListener('leaveStatusUpdated', handleLeaveStatusUpdated);
    
    return () => {
      window.removeEventListener('leaveRequestCreated', handleLeaveRequestCreated);
      window.removeEventListener('leaveStatusUpdated', handleLeaveStatusUpdated);
    };
  }, []);

  // สร้างการแจ้งเตือนจากหลายแหล่ง - 🔥 แยกตาม user ID
  const userNotifications = useMemo(() => {
    if (!user?.id) return [];
    
    const notifs = []

    // 1. การแจ้งเตือนเกี่ยวกับการลา - 🔥 เฉพาะของ user คนนี้เท่านั้น
    const recentLeaves = leaveList
      .filter(leave => leave.userId === user.id || !leave.userId) // ถ้าไม่มี userId ถือว่าเป็นของ user คนนี้ (backward compatible)
      .filter(leave => leave.id)
      .sort((a, b) => b.id - a.id)
      .slice(0, 5) // 🔥 เพิ่มจาก 3 เป็น 5

    recentLeaves.forEach(leave => {
      if (leave.status === 'อนุมัติ') {
        notifs.push({
          id: `leave-approved-${leave.id}`,
          title: 'การลาได้รับการอนุมัติ',
          description: `${leave.leaveType} - ${leave.period}`,
          date: new Date(leave.id).toLocaleDateString('th-TH'),
          type: 'success',
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
            </svg>
          )
        })
      } else if (leave.status === 'ไม่อนุมัติ') {
        notifs.push({
          id: `leave-rejected-${leave.id}`,
          title: 'การลาไม่ได้รับการอนุมัติ',
          description: `${leave.leaveType} - ${leave.period}`,
          date: new Date(leave.id).toLocaleDateString('th-TH'),
          type: 'error',
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12 19 6.41z" />
            </svg>
          )
        })
      } else if (leave.status === 'รออนุมัติ') {
        notifs.push({
          id: `leave-pending-${leave.id}`,
          title: 'การลากำลังรออนุมัติ',
          description: `${leave.leaveType} - ${leave.period}`,
          date: new Date(leave.id).toLocaleDateString('th-TH'),
          type: 'warning',
          icon: (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
              <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
            </svg>
          )
        })
      }
    })

    // 2. การแจ้งเตือนกิจกรรมใหม่
    const userEvents = getEventsForUser(user?.department, user?.position)
      .filter(event => event.status === 'ongoing')
      .sort((a, b) => {
        const dateA = a.date.split('/').reverse().join('')
        const dateB = b.date.split('/').reverse().join('')
        return dateA.localeCompare(dateB)
      })
      .slice(0, 5) // 🔥 เพิ่มจาก 2 เป็น 5

    userEvents.forEach(event => {
      notifs.push({
        id: `event-${event.id}`,
        title: 'กิจกรรมใหม่',
        description: `${event.name} - ${event.date}`,
        date: event.date,
        type: 'info',
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z" />
          </svg>
        )
      })
    })

    // 3. เตือนวันลาใกล้หมด
    const vacationRemaining = leaveQuota['ลาพักร้อน'].totalDays - getUsedDays('ลาพักร้อน', user?.id)
    if (vacationRemaining <= 3 && vacationRemaining > 0) {
      notifs.push({
        id: 'leave-warning-vacation',
        title: 'วันลาพักร้อนเหลือน้อย',
        description: `เหลือเพียง ${vacationRemaining} วัน`,
        date: new Date().toLocaleDateString('th-TH'),
        type: 'warning',
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M1 21h22L12 2 1 21zm12-3h-2v-2h2v2zm0-4h-2v-4h2v4z" />
          </svg>
        )
      })
    }

    // 4. เตือนการเข้างานสาย
    if (attendance.status === 'late') {
      notifs.push({
        id: 'attendance-late-warning',
        title: 'คุณเข้างานสายวันนี้',
        description: 'กรุณาตรวจสอบเวลาการเข้างาน',
        date: new Date().toLocaleDateString('th-TH'),
        type: 'error',
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M11.99 2C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm.5-13H11v6l5.25 3.15.75-1.23-4.5-2.67z" />
          </svg>
        )
      })
    }

    // 5. เตือนเข้างานสำเร็จ
    if (attendance.status === 'checked_in' && attendance.checkInTime) {
      notifs.push({
        id: 'attendance-checkin-success',
        title: 'เข้างานสำเร็จ',
        description: `เวลา ${attendance.checkInTime}`,
        date: new Date().toLocaleDateString('th-TH'),
        type: 'success',
        icon: (
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
          </svg>
        )
      })
    }

    // 6. Mock - ประกาศเรื่องสำคัญ
    // notifs.push({
    //   id: 'announcement-1',
    //   title: 'ประกาศ: ปรับปรุงระบบลงเวลา',
    //   description: 'ระบบจะมีการปรับปรุงในวันที่ 5 พฤศจิกายน 2568',
    //   date: '1/11/2568',
    //   type: 'info',
    //   icon: (
    //     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
    //       <path d="M11 15h2v2h-2zm0-8h2v6h-2zm.99-5C6.47 2 2 6.48 2 12s4.47 10 9.99 10C17.52 22 22 17.52 22 12S17.52 2 11.99 2zM12 20c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8z" />
    //     </svg>
    //   )
    // })

    // // 7. Mock - เตือนอัปเดตข้อมูลส่วนตัว
    // notifs.push({
    //   id: 'profile-update-reminder',
    //   title: 'เตือน: อัปเดตข้อมูลส่วนตัว',
    //   description: 'กรุณาตรวจสอบและอัปเดตข้อมูลส่วนตัวของคุณ',
    //   date: '31/10/2568',
    //   type: 'warning',
    //   icon: (
    //     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
    //       <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
    //     </svg>
    //   )
    // })

    // // 8. Mock - ข้อมูลการประชุม
    // notifs.push({
    //   id: 'meeting-reminder',
    //   title: 'การประชุมประจำเดือน',
    //   description: 'วันที่ 10 พฤศจิกายน 2568 เวลา 14:00 น.',
    //   date: '30/10/2568',
    //   type: 'info',
    //   icon: (
    //     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
    //       <path d="M20 6h-2.18c.11-.31.18-.65.18-1 0-1.66-1.34-3-3-3-1.05 0-1.96.54-2.5 1.35l-.5.67-.5-.68C10.96 2.54 10.05 2 9 2 7.34 2 6 3.34 6 5c0 .35.07.69.18 1H4c-1.11 0-1.99.89-1.99 2L2 19c0 1.11.89 2 2 2h16c1.11 0 2-.89 2-2V8c0-1.11-.89-2-2-2zm-5-2c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zM9 4c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm11 15H4v-2h16v2zm0-5H4V8h5.08L7 10.83 8.62 12 11 8.76l1-1.36 1 1.36L15.38 12 17 10.83 14.92 8H20v6z" />
    //     </svg>
    //   )
    // })

    // // 9. Mock - สรุปการทำงานเดือนที่แล้ว
    // notifs.push({
    //   id: 'monthly-summary',
    //   title: 'สรุปการทำงานประจำเดือน',
    //   description: 'ตุลาคม 2568: เข้างานตรงเวลา 20 วัน',
    //   date: '29/10/2568',
    //   type: 'success',
    //   icon: (
    //     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
    //       <path d="M19 3h-4.18C14.4 1.84 13.3 1 12 1c-1.3 0-2.4.84-2.82 2H5c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm-7 0c.55 0 1 .45 1 1s-.45 1-1 1-1-.45-1-1 .45-1 1-1zm-2 14l-4-4 1.41-1.41L10 14.17l6.59-6.59L18 9l-8 8z" />
    //     </svg>
    //   )
    // })

    // // 10. Mock - วันหยุดที่จะถึง
    // notifs.push({
    //   id: 'holiday-reminder',
    //   title: 'วันหยุดพิเศษ',
    //   description: 'วันลอยกระทง 15 พฤศจิกายน 2568',
    //   date: '28/10/2568',
    //   type: 'info',
    //   icon: (
    //     <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
    //       <path d="M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z" />
    //     </svg>
    //   )
    // })

    // เพิ่ม isRead property ให้กับ notifications
    return notifs.map(notif => ({
      ...notif,
      isRead: readNotifications.includes(notif.id)
    }))
  }, [leaveList, getEventsForUser, user, leaveQuota, getUsedDays, attendance, readNotifications]) // 🔥 เพิ่ม user.id dependency

  // นับจำนวนการแจ้งเตือนที่ยังไม่อ่าน
  const unreadCount = userNotifications.filter(n => !n.isRead).length

  // ฟังก์ชันทำเครื่องหมายว่าอ่านแล้ว
  const markAsRead = (notifId) => {
    if (!readNotifications.includes(notifId)) {
      const updated = [...readNotifications, notifId]
      setReadNotifications(updated)
      localStorage.setItem(`readNotifications_${user?.id}`, JSON.stringify(updated))
    }
  }

  // ใช้ข้อมูลจาก profileData ที่อัพเดตจาก localStorage
  const mockUser = {
    name: profileData.name,
    position: profileData.position,
    department: profileData.department,
    employeeId: profileData.workInfo?.employeeId || profileData.workInfo.employeeId,
    profileImage: profileData.profilePic
  }

  const handleLogout = () => {
    if (logout) {
      logout()
    }
    navigate('/auth')
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-gray-100 pb-20 font-prompt">
      {/* Header */}
      <div className="bg-gradient-to-r from-brand-primary to-orange-600 text-white shadow-lg sticky w-full top-0 z-30">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            {/* Logo and Title */}
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-white rounded-lg flex items-center justify-center shadow-md">
                <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="#F26623">
                  <path d="M480-480q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47ZM160-160v-112q0-34 17.5-62.5T224-378q62-31 126-46.5T480-440q66 0 130 15.5T736-378q29 15 46.5 43.5T800-272v112H160Z" />
                </svg>
              </div>
              <div>
                <h1 className="text-xl font-bold">EASYCHECK</h1>
                <p className="text-xs text-orange-100">ระบบบันทึกเวลาเข้า-ออกเวลา</p>
              </div>
            </div>

            {/* User Profile */}
            <div className="flex items-center space-x-3">
              {/* Notification Bell */}
              <div className="hidden relative">
                <button
                  onClick={() => setShowNotifications(!showNotifications)}
                  className="relative p-2 hover:bg-white/10 rounded-lg transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  {unreadCount > 0 && (
                    <span className="absolute top-1 right-1 flex h-4 w-4">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-4 w-4 bg-red-500 text-white text-[10px] items-center justify-center font-bold">
                        {unreadCount}
                      </span>
                    </span>
                  )}
                </button>
                {/* Notification Dropdown is now outside the header */}
              </div>

              {/* User Profile Button */}
              <div className="relative z-[60]">
                <button
                  onClick={() => setShowProfileMenu(!showProfileMenu)}
                  className="flex items-center space-x-2 hover:bg-white/10 rounded-lg px-3 py-2 transition-colors"
                >
                  <div className="text-right hidden sm:block">
                    <p className="text-sm font-semibold">{mockUser.name}</p>
                    <p className="text-xs text-orange-100">{mockUser.position}</p>
                  </div>
                  <div className="w-10 h-10 bg-white rounded-full flex items-center justify-center text-brand-primary font-bold shadow-md">
                    {mockUser.profileImage ? (
                      <img src={mockUser.profileImage} alt="Profile" className="w-full h-full rounded-full object-cover" />
                    ) : (
                      <span>{mockUser.name?.charAt(0) || 'U'}</span>
                    )}
                  </div>
                </button>
                {/* Profile Dropdown Menu is now outside the header */}
              </div>                            </div>
          </div>
        </div>
      </div>
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 py-6">
        <Outlet />
      </main>
      {/* Bottom Navigation */}
      <Nav />
      {/* Notification Dropdown */}
      {showNotifications && (
        <>
          <div
            className="fixed inset-0 z-[9998]"
            onClick={() => setShowNotifications(false)}
          />
          <div className="fixed top-16 right-4 w-80 bg-white rounded-lg shadow-2xl z-[9999]">
            <div className="bg-gradient-to-r from-brand-primary to-orange-600 p-4 text-white rounded-t-lg">
              <div className="flex items-center justify-between">
                <h3 className="font-semibold">การแจ้งเตือน</h3>
                <span className="text-xs bg-white/20 px-2 py-1 rounded-full">{unreadCount} รายการ</span>
              </div>
            </div>
            <div style={{ maxHeight: '400px', overflowY: 'auto' }} className="divide-y divide-gray-100">
              {userNotifications.length > 0 ? (
                userNotifications.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => markAsRead(notif.id)}
                    className={`p-4 hover:bg-gray-50 transition-colors cursor-pointer relative ${
                      !notif.isRead ? 'bg-orange-50/30' : ''
                    } ${
                      notif.type === 'success' ? 'border-l-4 border-green-500' :
                      notif.type === 'error' ? 'border-l-4 border-red-500' :
                      notif.type === 'warning' ? 'border-l-4 border-gray-200' :
                      'border-l-4 border-blue-500'
                    }`}
                  >
                    {!notif.isRead && (
                      <div className="absolute top-2 right-2 w-2 h-2 bg-brand-primary rounded-full"></div>
                    )}
                    <div className="flex items-start space-x-3">
                      <div className={`flex-shrink-0 rounded-full p-2 ${
                        notif.type === 'success' ? 'bg-green-100 text-green-600' :
                        notif.type === 'error' ? 'bg-red-100 text-red-600' :
                            notif.type === 'warning' ? 'bg-orange-100 text-orange-600' :
                              'bg-blue-100 text-blue-600'
                        }`}>
                        {notif.icon}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-gray-900">{notif.title}</p>
                        <p className="text-sm text-gray-600 mt-1">{notif.description}</p>
                        <p className="text-xs text-gray-400 mt-1">{notif.date}</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-gray-500">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-12 w-12 mx-auto mb-3 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
                  </svg>
                  <p className="text-sm">ไม่มีการแจ้งเตือน</p>
                </div>
              )}
            </div>
          </div>
        </>
      )}
      {/* Profile Dropdown Menu */}
      {showProfileMenu && (
        <>
          <div
            className="fixed inset-0 z-[9998]"
            onClick={() => setShowProfileMenu(false)}
          />
          <div className="fixed top-16 right-4 w-64 bg-white rounded-lg shadow-xl z-[9999]">
            <div className="bg-gradient-to-r from-brand-primary to-orange-600 p-4 text-white">
              <p className="font-semibold">{mockUser.name}</p>
              <p className="text-sm text-orange-100">{mockUser.position}</p>
              <p className="text-xs text-orange-100 mt-1">รหัส: {mockUser.employeeId}</p>
            </div>
            <div className="py-2">
              <button
                onClick={() => {
                  navigate('/user/profile')
                  setShowProfileMenu(false)
                }}
                className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#F26623">
                  <path d="M480-480q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47ZM160-160v-112q0-34 17.5-62.5T224-378q62-31 126-46.5T480-440q66 0 130 15.5T736-378q29 15 46.5 43.5T800-272v112H160Z" />
                </svg>
                <span>โปรไฟล์</span>
              </button>
              <button
                onClick={() => {
                  navigate('/user/settings')
                  setShowProfileMenu(false)
                }}
                className="w-full px-4 py-2 text-left text-gray-700 hover:bg-gray-100 flex items-center space-x-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#F26623">
                  <path d="m370-80-16-128q-13-5-24.5-12T307-235l-119 50L78-375l103-78q-1-7-1-13.5v-27q0-6.5 1-13.5L78-585l110-190 119 50q11-8 23-15t24-12l16-128h220l16 128q13 5 24.5 12t22.5 15l119-50 110 190-103 78q1 7 1 13.5v27q0 6.5-2 13.5l103 78-110 190-118-50q-11 8-23 15t-24 12L590-80H370Z" />
                </svg>
                <span>ตั้งค่า</span>
              </button>
              <hr className="my-2" />
              <button
                onClick={handleLogout}
                className="w-full px-4 py-2 text-left text-red-600 hover:bg-red-50 flex items-center space-x-2"
              >
                <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="#DC2626">
                  <path d="M200-120q-33 0-56.5-23.5T120-200v-560q0-33 23.5-56.5T200-840h280v80H200v560h280v80H200Zm440-160-55-58 102-102H360v-80h327L585-622l55-58 200 200-200 200Z" />
                </svg>
                <span>ออกจากระบบ</span>
              </button>
            </div>
          </div>
        </>
      )}
    </div>)
}

export default Layout
