import React, { useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useLeave } from '../../../contexts/LeaveContext'

// หน้าแสดงรายการลาทั้งหมดหรือแยกตามประเภท - เป็นหน้ารายการประวัติ
function LeaveHistory() {
    const navigate = useNavigate()
    const location = useLocation()
    const { leaveList: allLeaveList, lateArrivalList } = useLeave() // ดึงข้อมูลจาก Context
    
    // รับค่าจากการ navigate มา - บอกว่าจะแสดงประเภทไหน
    const selectedLeaveType = location.state?.leaveType || null
    const viewType = location.state?.viewType || 'leave' // 'leave' หรือ 'lateArrival'

    // กรองและเรียงลำดัปข้อมูล - ใช้ useMemo เพื่อประสิทธิภาพ
    const leaveList = useMemo(() => {
        let filteredList;
        
        if (viewType === 'lateArrival') {
            // แสดงเฉพาะขอเข้างานสาย
            filteredList = lateArrivalList;
        } else {
            // แสดงลาปกติ - ถ้าเลือกประเภทก็กรองตามประเภท
            filteredList = selectedLeaveType 
                ? allLeaveList.filter(leave => leave.leaveType === selectedLeaveType)
                : allLeaveList;
        }
        
        // เรียงจากใหม่ไปเก่าก่อน (รายการล่าสุดอยู่บนสุด)
        return filteredList.sort((a, b) => {
            const dateA = a.startDate.split('/').reverse().join('');
            const dateB = b.startDate.split('/').reverse().join('');
            return dateB.localeCompare(dateA);
        });
    }, [allLeaveList, lateArrivalList, selectedLeaveType, viewType])

    // กำหนดสีสถานะตาม status - เหลือง=รอ, เขียว=อนุมัติ, แดง=ไม่อนุมัติ
    const getStatusColor = (color) => {
        switch(color) {
            case 'yellow':
                return 'bg-gradient-to-r from-yellow-100 to-amber-100 text-yellow-700 border border-yellow-200'
            case 'green':
                return 'bg-gradient-to-r from-green-100 to-emerald-100 text-green-700 border border-green-200'
            case 'red':
                return 'bg-gradient-to-r from-orange-50 to-orange-100 text-red-700 border border-red-200'
            default:
                return 'bg-gradient-to-r from-gray-100 to-slate-100 text-gray-700 border border-gray-200'
        }
    }

    // ไปหน้ารายละเอียดของการลา
    const handleLeaveClick = (leave) => {
        navigate(`/user/leave/detail/${leave.id}`, { state: { leaveData: leave } })
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-orange-50 via-orange-50 to-orange-100 font-prompt pb-20">
            {/* Header */}
            <div className="bg-gradient-to-r from-brand-primary to-orange-600 px-4 sm:px-5 lg:px-6 py-4 sm:py-5 shadow-lg sticky top-0 z-10">
                <div className="flex items-center justify-between max-w-7xl mx-auto">
                    <button 
                        onClick={() => navigate(-1)}
                        className="text-white hover:bg-white/20 p-1.5 sm:p-2 rounded-full transition-all duration-200"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 sm:h-6 sm:w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                        </svg>
                    </button>
                    <h1 className="text-white text-base sm:text-lg lg:text-xl font-bold drop-shadow-md truncate px-2">
                        {selectedLeaveType ? `รายการ${selectedLeaveType}` : 'รายการการลา'}
                    </h1>
                    <div className="w-5 sm:w-6"></div>
                </div>
            </div>

            {/* Leave List */}
            <div className="px-3 sm:px-4 lg:px-6 py-4 sm:py-5 space-y-3 sm:space-y-4 max-w-7xl mx-auto">
                {leaveList.length === 0 ? (
                    <div className="text-center py-20">
                        <div className="bg-white/50 backdrop-blur-sm rounded-2xl p-8 mx-auto max-w-sm">
                            <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                            </svg>
                            <p className="text-gray-400 text-lg">
                                ไม่มีรายการการลา
                            </p>
                        </div>
                    </div>
                ) : (
                    leaveList.map((leave) => (
                        <div 
                            key={leave.id}
                            onClick={() => handleLeaveClick(leave)}
                            className="bg-white/90 backdrop-blur-sm rounded-xl sm:rounded-2xl p-4 sm:p-5 lg:p-6 shadow-lg hover:shadow-2xl hover:scale-[1.01] sm:hover:scale-[1.02] transition-all duration-300 cursor-pointer border border-white/50 hover:border-orange-200"
                        >
                            {/* Header with type and status */}
                            <div className="flex justify-between items-start mb-3 sm:mb-4">
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1.5 sm:mb-2">
                                        <div className="w-1 h-6 sm:h-8 bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex-shrink-0"></div>
                                        <h3 className="text-gray-800 font-bold text-base sm:text-lg lg:text-xl truncate">
                                            {leave.leaveType}
                                        </h3>
                                    </div>
                                    <p className="text-orange-500 font-semibold text-xs sm:text-sm ml-3">
                                        {leave.days}
                                    </p>
                                </div>
                                <span className={`${getStatusColor(leave.statusColor)} px-2.5 sm:px-3 lg:px-4 py-1 sm:py-1.5 rounded-full text-xs sm:text-sm font-bold shadow-sm flex-shrink-0 ml-2`}>
                                    {leave.status}
                                </span>
                            </div>

                            {/* Date range */}
                            <div className="flex items-center text-gray-600 text-xs sm:text-sm mb-2 sm:mb-3 bg-gray-50 rounded-lg p-2 sm:p-3">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5 mr-1.5 sm:mr-2 text-orange-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                <span className="font-medium truncate">{leave.period}</span>
                            </div>

                            {/* พรีวิวเหตุผล */}
                            <div className="flex items-start gap-1.5 sm:gap-2 mb-2 sm:mb-3">
                                <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5 text-gray-400 flex-shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                                </svg>
                                <p className="text-gray-600 text-xs sm:text-sm line-clamp-2 flex-1">
                                    {leave.reason}
                                </p>
                            </div>

                            {/* ลูกศร */}
                            <div className="flex justify-end mt-2 sm:mt-3 pt-2 sm:pt-3 border-t border-gray-100">
                                <div className="flex items-center text-brand-primary text-xs sm:text-sm font-medium">
                                    <span className="mr-1">ดูรายละเอียด</span>
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 sm:h-5 sm:w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                                    </svg>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    )
}

export default LeaveHistory;