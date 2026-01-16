import React, { createContext, useState } from 'react';
import { mockTeamMembers } from '../data/usersData';

const TeamContext = createContext();

export const TeamProvider = ({ children }) => {
  // ใช้ Mock Data จาก usersData.js
  const [teamMembers] = useState(mockTeamMembers);

  // ไม่ใช้ Mock Data - อ่านจาก LeaveContext แทน
  const [pendingLeaves, setPendingLeaves] = useState([]);

  // สถิติทีม
  const getTeamStats = () => {
    const total = teamMembers.length;
    const checkedIn = teamMembers.filter(m => m.status === 'checked_in').length;
    const late = teamMembers.filter(m => m.isLate).length;
    const absent = teamMembers.filter(m => m.status === 'absent').length;
    const notCheckedIn = teamMembers.filter(m => m.status === 'not_checked_in').length;

    return {
      total,
      checkedIn,
      late,
      absent,
      notCheckedIn,
      onTime: checkedIn - late
    };
  };

  // อนุมัติใบลา
  const approveLeave = (leaveId) => {
    setPendingLeaves(prev => 
      prev.map(leave => 
        leave.id === leaveId 
          ? { ...leave, status: 'approved', approvedDate: new Date().toLocaleDateString('th-TH') }
          : leave
      )
    );
    return true;
  };

  // ไม่อนุมัติใบลา
  const rejectLeave = (leaveId, rejectReason) => {
    setPendingLeaves(prev => 
      prev.map(leave => 
        leave.id === leaveId 
          ? { ...leave, status: 'rejected', rejectReason, rejectedDate: new Date().toLocaleDateString('th-TH') }
          : leave
      )
    );
    return true;
  };

  // แจ้งเตือนที่ยังไม่อ่าน
  const getUnreadNotifications = () => {
    const lateMembers = teamMembers.filter(m => m.isLate);
    const pendingCount = pendingLeaves.filter(l => l.status === 'pending').length;
    
    return {
      lateCount: lateMembers.length,
      lateMembers,
      pendingLeaveCount: pendingCount,
      totalNotifications: lateMembers.length + pendingCount
    };
  };

  const value = {
    teamMembers,
    pendingLeaves,
    getTeamStats,
    approveLeave,
    rejectLeave,
    getUnreadNotifications
  };

  return (
    <TeamContext.Provider value={value}>
      {children}
    </TeamContext.Provider>
  );
};

export default TeamContext;
