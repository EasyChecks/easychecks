/**
 * 🚨 AttendanceWarning - แสดงสถานะการเข้างานแบบ realtime
 * 
 * - Grace Period: แสดงแถบเหลืองเมื่ออยู่ในช่วง grace period
 * - Late Warning: แสดงแถบแดงเมื่อมาสาย
 * - Shift Timeline: แสดง timeline กะงาน
 */

import React, { useState, useEffect } from 'react'
import { calculateTimeDifference, timeToMinutes } from '../../utils/attendanceLogic'
import ATTENDANCE_CONFIG from '../../config/attendanceConfig'

export const AttendanceWarning = ({ schedules }) => {
  const [currentTime, setCurrentTime] = useState(new Date().toTimeString().slice(0, 5))
  const [warningInfo, setWarningInfo] = useState(null)

  // อัพเดทเวลาทุก 30 วินาที
  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentTime(new Date().toTimeString().slice(0, 5))
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  // คำนวณ warning status
  useEffect(() => {
    if (!schedules || schedules.length === 0) {
      setWarningInfo(null)
      return
    }

    const currentMinutes = timeToMinutes(currentTime)

    // หากะที่ใกล้ที่สุด
    const upcomingShift = schedules
      .map(schedule => ({
        ...schedule,
        startMinutes: timeToMinutes(schedule.startTime)
      }))
      .filter(schedule => currentMinutes <= schedule.startMinutes + 60) // ดูล่วงหน้า 60 นาที
      .sort((a, b) => a.startMinutes - b.startMinutes)[0]

    if (!upcomingShift) {
      setWarningInfo(null)
      return
    }

    const timeDiff = calculateTimeDifference(currentTime, upcomingShift.startTime)
    const { GRACE_PERIOD_MINUTES, LATE_THRESHOLD_MINUTES } = ATTENDANCE_CONFIG

    // ตรวจสอบสถานะ
    if (timeDiff < 0) {
      // ยังไม่ถึงเวลา
      const minutesLeft = Math.abs(timeDiff)
      if (minutesLeft <= 30) {
        setWarningInfo({
          type: 'upcoming',
          message: `กะงานเริ่มใน ${minutesLeft} นาที`,
          shift: upcomingShift,
          color: 'blue'
        })
      } else {
        setWarningInfo(null)
      }
    } else if (timeDiff >= 0 && timeDiff <= GRACE_PERIOD_MINUTES) {
      // Grace period
      setWarningInfo({
        type: 'grace',
        message: `อยู่ในช่วง Grace Period (เหลือ ${GRACE_PERIOD_MINUTES - timeDiff} นาที)`,
        shift: upcomingShift,
        color: 'yellow'
      })
    } else if (timeDiff > GRACE_PERIOD_MINUTES && timeDiff <= LATE_THRESHOLD_MINUTES) {
      // มาสาย
      setWarningInfo({
        type: 'late',
        message: `⚠️ มาสาย ${timeDiff} นาที`,
        shift: upcomingShift,
        color: 'orange'
      })
    } else if (timeDiff > LATE_THRESHOLD_MINUTES) {
      // ขาด
      setWarningInfo({
        type: 'absent',
        message: `🚨 สาย ${timeDiff} นาที - จะถูกนับเป็นขาด`,
        shift: upcomingShift,
        color: 'red'
      })
    }
  }, [schedules, currentTime])

  if (!warningInfo) return null

  const colorClasses = {
    blue: 'bg-blue-50 border-blue-200 text-blue-800',
    yellow: 'bg-yellow-50 border-yellow-200 text-yellow-800',
    orange: 'bg-orange-50 border-orange-200 text-orange-800',
    red: 'bg-red-50 border-red-200 text-red-800'
  }

  const iconClasses = {
    blue: 'text-blue-600',
    yellow: 'text-yellow-600',
    orange: 'text-orange-600',
    red: 'text-red-600'
  }

  return (
    <div className={`rounded-lg border-2 p-4 mb-4 ${colorClasses[warningInfo.color]}`}>
      <div className="flex items-start gap-3">
        <div className={`mt-0.5 ${iconClasses[warningInfo.color]}`}>
          {warningInfo.type === 'upcoming' && (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          {warningInfo.type === 'grace' && (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
          {(warningInfo.type === 'late' || warningInfo.type === 'absent') && (
            <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          )}
        </div>
        <div className="flex-1">
          <p className="font-semibold text-sm">{warningInfo.message}</p>
          <p className="text-xs mt-1 opacity-80">
            กะ: {warningInfo.shift.teamName} ({warningInfo.shift.startTime} - {warningInfo.shift.endTime})
          </p>
        </div>
      </div>
    </div>
  )
}

export const ShiftTimeline = ({ schedules }) => {
  if (!schedules || schedules.length === 0) return null

  const now = new Date()
  const currentMinutes = timeToMinutes(now.toTimeString().slice(0, 5))

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
      <h3 className="font-semibold text-sm text-gray-800 mb-3 flex items-center gap-2">
        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        ตารางกะวันนี้
      </h3>
      <div className="space-y-2">
        {schedules.map((schedule, index) => {
          const startMinutes = timeToMinutes(schedule.startTime)
          const endMinutes = timeToMinutes(schedule.endTime)
          const isActive = currentMinutes >= startMinutes && currentMinutes <= endMinutes
          const isPast = currentMinutes > endMinutes
          const isUpcoming = currentMinutes < startMinutes

          return (
            <div
              key={index}
              className={`flex items-center justify-between p-3 rounded-lg border ${
                isActive
                  ? 'bg-green-50 border-green-300'
                  : isPast
                  ? 'bg-gray-50 border-gray-200 opacity-60'
                  : 'bg-blue-50 border-blue-200'
              }`}
            >
              <div className="flex items-center gap-3">
                <div
                  className={`w-3 h-3 rounded-full ${
                    isActive ? 'bg-green-500 animate-pulse' : isPast ? 'bg-gray-400' : 'bg-blue-500'
                  }`}
                />
                <div>
                  <p className="font-medium text-sm">{schedule.teamName}</p>
                  <p className="text-xs text-gray-600">
                    {schedule.startTime} - {schedule.endTime}
                  </p>
                </div>
              </div>
              <div className="text-xs font-medium">
                {isActive && <span className="text-green-600">กำลังดำเนินการ</span>}
                {isPast && <span className="text-gray-500">เสร็จสิ้น</span>}
                {isUpcoming && <span className="text-blue-600">เตรียมพร้อม</span>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

export default AttendanceWarning
