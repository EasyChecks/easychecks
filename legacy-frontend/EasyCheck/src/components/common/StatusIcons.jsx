/**
 * Status Icons - SVG icons สำหรับแสดงสถานะต่างๆ
 * แทนที่ emoji เพื่อความสม่ำเสมอและรองรับทุกระบบ
 */

import React from 'react';
import { STATUS_COLORS } from './statusConstants';

// ✅ Check Icon (สำหรับสถานะสำเร็จ)
export const CheckIcon = ({ className = 'w-5 h-5', color = 'currentColor' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 6L9 17l-5-5" />
  </svg>
);

// ❌ Cross Icon (สำหรับสถานะผิดพลาด)
export const CrossIcon = ({ className = 'w-5 h-5', color = 'currentColor' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="18" y1="6" x2="6" y2="18" />
    <line x1="6" y1="6" x2="18" y2="18" />
  </svg>
);

// ⏰ Clock Icon (สำหรับเวลา)
export const ClockIcon = ({ className = 'w-5 h-5', color = 'currentColor' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

// ⚠️ Warning Icon (สำหรับคำเตือน)
export const WarningIcon = ({ className = 'w-5 h-5', color = 'currentColor' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

// ℹ️ Info Icon (สำหรับข้อมูล)
export const InfoIcon = ({ className = 'w-5 h-5', color = 'currentColor' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10" />
    <line x1="12" y1="16" x2="12" y2="12" />
    <line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

// 📍 Location Icon
export const LocationIcon = ({ className = 'w-5 h-5', color = 'currentColor' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
    <circle cx="12" cy="10" r="3" />
  </svg>
);

// 👤 User Icon
export const UserIcon = ({ className = 'w-5 h-5', color = 'currentColor' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

// 📊 Chart Icon
export const ChartIcon = ({ className = 'w-5 h-5', color = 'currentColor' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="18" y1="20" x2="18" y2="10" />
    <line x1="12" y1="20" x2="12" y2="4" />
    <line x1="6" y1="20" x2="6" y2="14" />
  </svg>
);

// 📷 Camera Icon
export const CameraIcon = ({ className = 'w-5 h-5', color = 'currentColor' }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke={color}
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
    <circle cx="12" cy="13" r="4" />
  </svg>
);

// Status Badge Component
export const StatusBadge = ({ 
  type = 'success', // success, warning, error, info, neutral
  children,
  icon: Icon,
  className = ''
}) => {
  const colors = STATUS_COLORS[type] || STATUS_COLORS.neutral;

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-sm font-medium ${colors.bg} ${colors.text} ${colors.border} border ${className}`}
    >
      {Icon && <Icon className="w-4 h-4" />}
      {children}
    </span>
  );
};

// Attendance Status Icon (สำหรับสถานะการเข้างาน)
export const AttendanceStatusIcon = ({ status, className = 'w-5 h-5' }) => {
  const statusConfig = {
    'ตรงเวลา': { Icon: CheckIcon, color: '#10B981' },
    'มาสาย': { Icon: ClockIcon, color: '#F59E0B' },
    'ขาดงาน': { Icon: CrossIcon, color: '#EF4444' },
    'ลางาน': { Icon: InfoIcon, color: '#3B82F6' },
  };

  const config = statusConfig[status] || { Icon: InfoIcon, color: '#6B7280' };
  const { Icon, color } = config;

  return <Icon className={className} color={color} />;
};

// Status Text with Icon Component
export const StatusText = ({ status, className = '' }) => {
  const statusConfig = {
    // Attendance Status
    'ตรงเวลา': { text: 'ตรงเวลา', type: 'success', Icon: CheckIcon },
    'มาสาย': { text: 'มาสาย', type: 'warning', Icon: ClockIcon },
    'ขาดงาน': { text: 'ขาดงาน', type: 'error', Icon: CrossIcon },
    'ลางาน': { text: 'ลางาน', type: 'info', Icon: InfoIcon },
    
    // GPS Location Status
    'อยู่ในพื้นที่': { text: 'อยู่ในพื้นที่', type: 'success', Icon: LocationIcon },
    'อยู่นอกพื้นที่': { text: 'อยู่นอกพื้นที่', type: 'warning', Icon: WarningIcon },
    
    // Employee Work Status
    'ทำงานอยู่': { text: 'ทำงานอยู่', type: 'success', Icon: CheckIcon },
    'ออกจากงาน': { text: 'ออกจากงาน', type: 'neutral', Icon: CrossIcon },
    
    // Photo Status
    'มี': { text: 'มี', type: 'success', Icon: CameraIcon },
    'ไม่มี': { text: 'ไม่มี', type: 'neutral', Icon: CrossIcon },
  };

  const config = statusConfig[status] || { text: status, type: 'neutral', Icon: InfoIcon };

  return (
    <StatusBadge type={config.type} icon={config.Icon} className={className}>
      {config.text}
    </StatusBadge>
  );
};

export default {
  CheckIcon,
  CrossIcon,
  ClockIcon,
  WarningIcon,
  InfoIcon,
  LocationIcon,
  UserIcon,
  ChartIcon,
  CameraIcon,
  StatusBadge,
  AttendanceStatusIcon,
  StatusText,
  STATUS_COLORS,
};
