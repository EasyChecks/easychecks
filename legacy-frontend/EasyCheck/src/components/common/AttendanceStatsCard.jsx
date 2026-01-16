import React, { memo } from 'react';
import { useAuth } from '../../contexts/useAuth';


/**
 * AttendanceStatsCard - แสดงสถิติการลงเวลาแบบ real-time
 * ข้อมูล sync กับระบบการลงเวลาจริง
 * Optimized with React.memo to prevent unnecessary re-renders
 */
export const AttendanceStatsCard = memo(function AttendanceStatsCard({ className = '' }) {
  const { attendanceStats } = useAuth();

  return (
    <div className={`bg-white rounded-2xl p-5 border-2 border-gray-100 shadow-sm ${className}`}>
      <h4 className="font-bold text-gray-800 flex items-center gap-2 mb-4">
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          className="h-5 w-5 text-brand-primary" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" 
          />
        </svg>
        สรุปเวลาทำงาน
      </h4>
      <div className="grid grid-cols-4 gap-3">
        <div className="text-center p-3 bg-gray-50 rounded-lg">
          <div className="text-2xl font-bold text-gray-800">
            {attendanceStats.totalWorkDays}
          </div>
          <div className="text-xs text-gray-500 mt-1">วันทำงาน</div>
        </div>
        <div className="text-center p-3 bg-green-50 rounded-lg">
          <div className="text-2xl font-bold text-green-600">
            {attendanceStats.onTime}
          </div>
          <div className="text-xs text-gray-500 mt-1">ตรงเวลา</div>
        </div>
        <div className="text-center p-3 bg-orange-50 rounded-lg">
          <div className="text-2xl font-bold text-orange-600">
            {attendanceStats.late}
          </div>
          <div className="text-xs text-gray-500 mt-1">มาสาย</div>
        </div>
        <div className="text-center p-3 bg-red-50 rounded-lg">
          <div className="text-2xl font-bold text-red-600">
            {attendanceStats.absent}
          </div>
          <div className="text-xs text-gray-500 mt-1">ขาดงาน</div>
        </div>
      </div>
      
      {attendanceStats.averageCheckInTime && (
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="flex justify-between items-center text-sm">
            <span className="text-gray-600">เวลาเข้างานเฉลี่ย:</span>
            <span className="font-bold text-orange-600">
              {attendanceStats.averageCheckInTime} น.
            </span>
          </div>
          {attendanceStats.totalWorkHours > 0 && (
            <div className="flex justify-between items-center text-sm mt-2">
              <span className="text-gray-600">ชั่วโมงทำงานรวม:</span>
              <span className="font-bold text-orange-600">
                {attendanceStats.totalWorkHours.toFixed(1)} ชม.
              </span>
            </div>
          )}
          {attendanceStats.totalShifts > 0 && (
            <div className="flex justify-between items-center text-sm mt-2">
              <span className="text-gray-600 flex items-center gap-1">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                กะทั้งหมด:
              </span>
              <span className="font-bold text-blue-600">
                {attendanceStats.totalShifts} กะ
                {attendanceStats.averageShiftsPerDay && attendanceStats.averageShiftsPerDay > 1 && (
                  <span className="text-xs text-gray-500 ml-1">
                    (เฉลี่ย {attendanceStats.averageShiftsPerDay} กะ/วัน)
                  </span>
                )}
              </span>
            </div>
          )}
        </div>
      )}
    </div>
  );
});

/**
 * AttendanceStatsRow - แสดงสถิติแบบแถวเดียว (สำหรับ Dashboard)
 * Optimized with React.memo to prevent unnecessary re-renders
 */
export const AttendanceStatsRow = memo(function AttendanceStatsRow({ className = '' }) {
  const { attendanceStats } = useAuth();

  const stats = [
    {
      label: 'วันทำงาน',
      value: attendanceStats.totalWorkDays,
      bgColor: 'bg-gray-50',
      textColor: 'text-gray-800'
    },
    {
      label: 'ตรงเวลา',
      value: attendanceStats.onTime,
      bgColor: 'bg-green-50',
      textColor: 'text-green-600'
    },
    {
      label: 'มาสาย',
      value: attendanceStats.late,
      bgColor: 'bg-orange-50',
      textColor: 'text-orange-600'
    },
    {
      label: 'ขาดงาน',
      value: attendanceStats.absent,
      bgColor: 'bg-red-50',
      textColor: 'text-red-600'
    }
  ];

  return (
    <div className={` ${className}`}>
      <div className="flex items-center gap-2 text-gray-700 font-medium">
        <svg 
          xmlns="http://www.w3.org/2000/svg" 
          className="h-5 w-5 text-brand-primary" 
          fill="none" 
          viewBox="0 0 24 24" 
          stroke="currentColor"
        >
          <path 
            strokeLinecap="round" 
            strokeLinejoin="round" 
            strokeWidth={2} 
            d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" 
          />
        </svg>
        <span className="text-sm">สรุปเวลา:</span>
      </div>
      <div className="flex items-center gap-3">
        {stats.map((stat, index) => (
          <div 
            key={index}
            className={`px-3 py-1.5 ${stat.bgColor} rounded-lg flex items-center gap-2`}
          >
            <span className={`text-lg font-bold ${stat.textColor}`}>
              {stat.value}
            </span>
            <span className="text-xs text-gray-600">{stat.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
});

/**
 * AttendanceProgressBar - แสดงความคืบหน้าเป็น % (เช่น % มาตรงเวลา)
 * Optimized with React.memo to prevent unnecessary re-renders
 */
export const AttendanceProgressBar = memo(function AttendanceProgressBar({ className = '' }) {
  const { attendanceStats } = useAuth();
  
  const total = attendanceStats.totalWorkDays || 1;
  const onTimePercentage = Math.round((attendanceStats.onTime / total) * 100);
  const latePercentage = Math.round((attendanceStats.late / total) * 100);
  const absentPercentage = Math.round((attendanceStats.absent / total) * 100);

  return (
    <div className={`bg-white rounded-2xl p-5 border-2 border-gray-100 shadow-sm ${className}`}>
      <h4 className="font-bold text-gray-800 flex items-center justify-between mb-3">
        <span>ประสิทธิภาพการมาทำงาน</span>
        <span className="text-2xl font-bold text-green-600">{onTimePercentage}%</span>
      </h4>
      
      {/* Progress Bar */}
      <div className="w-full h-3 bg-gray-100 rounded-full overflow-hidden flex">
        {onTimePercentage > 0 && (
          <div 
            className="bg-green-500 h-full transition-all duration-500"
            style={{ width: `${onTimePercentage}%` }}
            title={`ตรงเวลา ${onTimePercentage}%`}
          />
        )}
        {latePercentage > 0 && (
          <div 
            className="bg-orange-500 h-full transition-all duration-500"
            style={{ width: `${latePercentage}%` }}
            title={`มาสาย ${latePercentage}%`}
          />
        )}
        {absentPercentage > 0 && (
          <div 
            className="bg-red-500 h-full transition-all duration-500"
            style={{ width: `${absentPercentage}%` }}
            title={`ขาดงาน ${absentPercentage}%`}
          />
        )}
      </div>
      
      {/* Legend */}
      <div className="flex items-center gap-4 mt-3 text-xs">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-green-500 rounded"></div>
          <span className="text-gray-600">ตรงเวลา {onTimePercentage}%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-orange-500 rounded"></div>
          <span className="text-gray-600">มาสาย {latePercentage}%</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 bg-red-500 rounded"></div>
          <span className="text-gray-600">ขาดงาน {absentPercentage}%</span>
        </div>
      </div>
    </div>
  );
});

export default AttendanceStatsCard;
