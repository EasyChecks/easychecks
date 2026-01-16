import React, { useState, useRef, useEffect, useMemo } from 'react'
import { sampleSchedules } from '../../../data/usersData'
import CreateAttendance from './CreateAttendance.jsx'
import { useLocations } from '../../../contexts/LocationContext'
import { useAuth } from '../../../contexts/useAuth'
import { MapContainer, TileLayer, Marker, Circle, Popup, LayersControl } from 'react-leaflet'
import 'leaflet/dist/leaflet.css'
import L from 'leaflet'

// Fix Leaflet default icon
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

function Attendance() {
  const { locations } = useLocations()
  const { user: currentUser } = useAuth()
  
  // Load schedules from localStorage or use sampleSchedules as default
  const [schedules, setSchedules] = useState(() => {
    const savedSchedules = localStorage.getItem('attendanceSchedules')
    if (savedSchedules) {
      try {
        return JSON.parse(savedSchedules)
      } catch (error) {
        console.error('Error parsing saved schedules:', error)
        // บันทึก sampleSchedules ลง localStorage ถ้า parse error
        localStorage.setItem('attendanceSchedules', JSON.stringify(sampleSchedules))
        return sampleSchedules
      }
    }
    // บันทึก sampleSchedules ลง localStorage ถ้ายังไม่มีข้อมูล
    localStorage.setItem('attendanceSchedules', JSON.stringify(sampleSchedules))
    return sampleSchedules
  })
  
  const [openIds, setOpenIds] = useState([])
  const [selectMode, setSelectMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])
  const [showCreate, setShowCreate] = useState(false)
  const [showEdit, setShowEdit] = useState(false)
  const [editingItem, setEditingItem] = useState(null)
  const [showDeleteAllConfirm, setShowDeleteAllConfirm] = useState(false)
  const [showDeleteSelectedConfirm, setShowDeleteSelectedConfirm] = useState(false)
  const [showSuccessPopup, setShowSuccessPopup] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [selectedBranchFilter, setSelectedBranchFilter] = useState('all') // กรองตามสาขา
  const [showBranchFilterDropdown, setShowBranchFilterDropdown] = useState(false)
  const wrapperRefs = useRef({})
  const innerRefs = useRef({})
  const endListenersRef = useRef({}) // เก็บ listener ปัจจุบันต่อรายการ
  const branchFilterDropdownRef = useRef(null)
  
  // รายการสาขาที่มี
  const availableBranches = [
    { code: 'BKK', name: 'กรุงเทพฯ (BKK)' },
    { code: 'CNX', name: 'เชียงใหม่ (CNX)' },
    { code: 'PKT', name: 'ภูเก็ต (PKT)' }
  ]

  // 🔐 กรองตารางตาม role ของผู้ดู
  const visibleSchedules = useMemo(() => {
    if (!currentUser) return schedules
    
    // Super Admin เห็นทุกอย่าง (รวมตารางตัวอย่างด้วย)
    if (currentUser.role === 'superadmin') {
      return schedules
    }
    
    // Admin เห็นเฉพาะตารางของสาขาตัวเอง
    if (currentUser.role === 'admin') {
      const adminBranch = currentUser.branch || currentUser.provinceCode || currentUser.employeeId?.substring(0, 3)
      
      return schedules.filter(s => {
        // ถ้าตารางไม่มี branch (ตารางเก่า) ให้แสดง
        if (!s.branch) return true
        
        // แสดงเฉพาะตารางของสาขาเดียวกัน
        return s.branch === adminBranch
      })
    }
    
    return schedules
  }, [schedules, currentUser])

  // 🏢 กรองตามสาขาเพิ่มเติม (สำหรับ Super Admin เท่านั้น)
  const filteredSchedules = useMemo(() => {
    if (currentUser?.role !== 'superadmin' || selectedBranchFilter === 'all') {
      return visibleSchedules
    }
    return visibleSchedules.filter(s => s.branch === selectedBranchFilter)
  }, [visibleSchedules, selectedBranchFilter, currentUser])

  // Save schedules to localStorage whenever it changes
  useEffect(() => {
    localStorage.setItem('attendanceSchedules', JSON.stringify(schedules))
  }, [schedules])

  // ปิด branch filter dropdown เมื่อคลิกข้างนอก
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (branchFilterDropdownRef.current && !branchFilterDropdownRef.current.contains(event.target)) {
        setShowBranchFilterDropdown(false)
      }
    }

    if (showBranchFilterDropdown) {
      document.addEventListener('mousedown', handleClickOutside)
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
    }
  }, [showBranchFilterDropdown])

  // 🔥 Real-time update listener (เหมือนการเข้า-ออกงาน)
  useEffect(() => {
    // 1. ฟัง CustomEvent สำหรับ same tab (ทำงานทันที)
    const handleScheduleUpdate = (event) => {
      console.log('📢 [Same Tab Admin] Schedule updated:', event.detail)
      // โหลดข้อมูลใหม่จาก localStorage
      const savedSchedules = localStorage.getItem('attendanceSchedules')
      if (savedSchedules) {
        try {
          setSchedules(JSON.parse(savedSchedules))
        } catch (error) {
          console.error('Error parsing schedules:', error)
        }
      }
    }

    // 2. ฟัง storage event สำหรับ cross-tab
    const handleStorageChange = (e) => {
      if (e.key === 'scheduleUpdateTrigger' && e.newValue) {
        try {
          const update = JSON.parse(e.newValue)
          console.log('📢 [Cross Tab Admin] Schedule update:', update.action)
          // โหลดข้อมูลใหม่จาก localStorage
          const savedSchedules = localStorage.getItem('attendanceSchedules')
          if (savedSchedules) {
            setSchedules(JSON.parse(savedSchedules))
          }
        } catch (error) {
          console.error('Error parsing schedule update:', error)
        }
      }
    }

    // ฟัง CustomEvent (same tab)
    window.addEventListener('scheduleUpdated', handleScheduleUpdate)
    // ฟัง storage event (cross-tab)
    window.addEventListener('storage', handleStorageChange)

    return () => {
      window.removeEventListener('scheduleUpdated', handleScheduleUpdate)
      window.removeEventListener('storage', handleStorageChange)
    }
  }, [])

  useEffect(() => {
    Object.values(wrapperRefs.current).forEach(w => {
      if (!w) return
      w.style.overflow = 'hidden'
      w.style.maxHeight = '0px'
      w.style.opacity = '0'
      w.style.transition = 'max-height 280ms cubic-bezier(.2,.8,.2,1), opacity 200ms ease'
      w.style.willChange = 'max-height, opacity'
      // give layout containment hint to reduce paint of siblings
      try { w.style.contain = 'layout'; } catch (e) {}
    })
    Object.values(innerRefs.current).forEach(i => {
      if (!i) return
      i.style.transform = 'translateY(-6px)'
      i.style.opacity = '0'
      i.style.transition = 'transform 240ms cubic-bezier(.2,.85,.2,1), opacity 200ms ease'
      i.style.willChange = 'transform, opacity'
      i.style.transformOrigin = 'top center'
    })
  }, [])

  const toggleDetails = (id) => {
    const wrapper = wrapperRefs.current[id]
    const inner = innerRefs.current[id]
    const isOpen = openIds.includes(id)

    if (!wrapper || !inner) {
      // ถ้าจะเปิด ให้ปิดอันอื่นก่อน
      if (!isOpen) {
        setOpenIds([id])
      } else {
        setOpenIds([])
      }
      return
    }

    if (!isOpen) {
      // ปิดทุกอันที่เปิดอยู่ก่อน
      openIds.forEach(openId => {
        if (openId !== id) {
          const otherWrapper = wrapperRefs.current[openId]
          const otherInner = innerRefs.current[openId]
          
          if (otherWrapper && otherInner) {
            // ลบ listener เก่าถ้ามี
            if (endListenersRef.current[openId]) {
              otherWrapper.removeEventListener('transitionend', endListenersRef.current[openId])
              delete endListenersRef.current[openId]
            }

            const currentMax = getComputedStyle(otherWrapper).maxHeight
            if (currentMax === 'none') otherWrapper.style.maxHeight = `${otherInner.scrollHeight}px`
            otherWrapper.style.opacity = '1'
            otherInner.style.transform = 'translateY(-8px)'
            otherInner.style.opacity = '0'
            void otherWrapper.offsetHeight

            requestAnimationFrame(() => {
              otherWrapper.style.transition = 'max-height 260ms cubic-bezier(.2,.85,.2,1), opacity 200ms ease'
              otherWrapper.style.maxHeight = '0px'
              otherWrapper.style.opacity = '0'
            })

            const onEndClose = (e) => {
              if (e.propertyName === 'max-height') {
                otherWrapper.removeEventListener('transitionend', onEndClose)
                if (endListenersRef.current[openId] === onEndClose) delete endListenersRef.current[openId]
              }
            }
            endListenersRef.current[openId] = onEndClose
            otherWrapper.addEventListener('transitionend', onEndClose)
          }
        }
      })

      // ถ้ามี listener เก่าให้ลบก่อน เพื่อไม่ให้ listener เก่ามากระทบหลังจาก reopen
      if (endListenersRef.current[id]) {
        wrapper.removeEventListener('transitionend', endListenersRef.current[id])
        delete endListenersRef.current[id]
      }

      wrapper.style.transition = 'none'
      wrapper.style.maxHeight = '0px'
      wrapper.style.opacity = '0'
      inner.style.transform = 'translateY(-8px)'
      inner.style.opacity = '0'
      void wrapper.offsetHeight

      // update openIds - เปิดเฉพาะอันนี้อันเดียว
      setOpenIds([id])

      requestAnimationFrame(() => {
        const h = inner.scrollHeight
        wrapper.style.transition = 'max-height 320ms cubic-bezier(.2,.8,.2,1), opacity 220ms ease'
        wrapper.style.maxHeight = `${h}px`
        wrapper.style.opacity = '1'
        inner.style.transform = 'translateY(0)'
        inner.style.opacity = '1'

        const onEnd = (e) => {
          if (e.propertyName === 'max-height') {
            wrapper.style.maxHeight = 'none'
            wrapper.removeEventListener('transitionend', onEnd)
            if (endListenersRef.current[id] === onEnd) delete endListenersRef.current[id]
          }
        }
        // เก็บ listener เพื่อให้ลบได้ถ้าผู้ใช้ toggle ใหม่ก่อนจบ transition
        endListenersRef.current[id] = onEnd
        wrapper.addEventListener('transitionend', onEnd)
      })
  } else {
      // ถ้ามี listener เก่า ให้ลบก่อน เพื่อไม่ให้ callback เก่าไป setOpenId หลังจาก reopen
      if (endListenersRef.current[id]) {
        wrapper.removeEventListener('transitionend', endListenersRef.current[id])
        delete endListenersRef.current[id]
      }

      const currentMax = getComputedStyle(wrapper).maxHeight
      if (currentMax === 'none') wrapper.style.maxHeight = `${inner.scrollHeight}px`
      wrapper.style.opacity = '1'
      inner.style.transform = 'translateY(-8px)'
      inner.style.opacity = '0'
      void wrapper.offsetHeight

      requestAnimationFrame(() => {
        wrapper.style.transition = 'max-height 260ms cubic-bezier(.2,.85,.2,1), opacity 200ms ease'
        wrapper.style.maxHeight = '0px'
        wrapper.style.opacity = '0'
      })

      const onEndClose = (e) => {
        if (e.propertyName === 'max-height') {
          wrapper.removeEventListener('transitionend', onEndClose)
          if (endListenersRef.current[id] === onEndClose) delete endListenersRef.current[id]
          setOpenIds([])
        }
      }
      endListenersRef.current[id] = onEndClose
      wrapper.addEventListener('transitionend', onEndClose)
    }
  }

  const toggleSelectMode = () => {
    if (selectMode) {
      setSelectedIds([])
      setSelectMode(false)
    } else {
      setSelectMode(true)
      setOpenIds([])
    }
  }

  const toggleSelect = (id) => {
    setSelectedIds(prev => {
      if (prev.includes(id)) return prev.filter(x => x !== id)
      return [...prev, id]
    })
  }

  const confirmDelete = () => {
    if (selectedIds.length === 0) return
    const updatedSchedules = schedules.filter(s => !selectedIds.includes(s.id))
    setSchedules(updatedSchedules)
    
    // 🔥 บันทึกลง localStorage ทันที
    localStorage.setItem('attendanceSchedules', JSON.stringify(updatedSchedules))
    
    // 🔥 ส่ง event 2 แบบเหมือน create/update
    // 1. CustomEvent สำหรับ same tab
    window.dispatchEvent(new CustomEvent('scheduleUpdated', { 
      detail: { action: 'delete', data: { deletedIds: selectedIds } } 
    }))
    
    // 2. localStorage trigger สำหรับ cross-tab
    localStorage.setItem('scheduleUpdateTrigger', JSON.stringify({
      action: 'delete',
      data: { deletedIds: selectedIds },
      timestamp: Date.now()
    }))
    
    setSelectedIds([])
    setSelectMode(false)
    setOpenIds([])
    setShowDeleteSelectedConfirm(false)
    
    // แสดง popup สำเร็จ
    setSuccessMessage(`ลบตารางงานที่เลือกเรียบร้อย!`)
    setShowSuccessPopup(true)
    
    // ปิด popup อัตโนมัติหลัง 3 วินาที
    setTimeout(() => {
      setShowSuccessPopup(false)
    }, 3000)
  }

  // ลบทั้งหมด (ทำงานจริงเมื่อผู้ใช้ยืนยันจาก modal)
  const deleteAll = () => {
    if (visibleSchedules.length === 0) return
    
    // 🔐 ลบเฉพาะตารางที่มองเห็น (ตามสิทธิ์)
    const visibleIds = visibleSchedules.map(s => s.id)
    const remainingSchedules = schedules.filter(s => !visibleIds.includes(s.id))
    setSchedules(remainingSchedules)
    
    // 🔥 บันทึกลง localStorage ทันที
    localStorage.setItem('attendanceSchedules', JSON.stringify(remainingSchedules))
    
    // 🔥 ส่ง event 2 แบบเหมือน create/update
    // 1. CustomEvent สำหรับ same tab
    window.dispatchEvent(new CustomEvent('scheduleUpdated', { 
      detail: { action: 'deleteAll' } 
    }))
    
    // 2. localStorage trigger สำหรับ cross-tab
    localStorage.setItem('scheduleUpdateTrigger', JSON.stringify({
      action: 'deleteAll',
      data: {},
      timestamp: Date.now()
    }))
    
    setSelectedIds([])
    setSelectMode(false)
    setOpenIds([])
    setShowDeleteAllConfirm(false)
    
    // แสดง popup สำเร็จ
    setSuccessMessage('ลบตารางงานทั้งหมดเรียบร้อย!')
    setShowSuccessPopup(true)
    
    // ปิด popup อัตโนมัติหลัง 3 วินาที
    setTimeout(() => {
      setShowSuccessPopup(false)
    }, 3000)
  }

  const handleCreate = (newItem) => {
    // 🔐 เพิ่มข้อมูลผู้สร้าง
    const itemWithCreator = {
      ...newItem,
      createdBy: currentUser?.role || 'admin'
    }
    
    const updatedSchedules = [...schedules, itemWithCreator]
    setSchedules(updatedSchedules)
    
    // 🔥 บันทึกลง localStorage ก่อน (สำคัญ!)
    localStorage.setItem('attendanceSchedules', JSON.stringify(updatedSchedules))
    
    setShowCreate(false)
    
    // แสดง popup สำเร็จ
    setSuccessMessage('สร้างตารางงานเรียบร้อย!')
    setShowSuccessPopup(true)
    
    // ปิด popup อัตโนมัติหลัง 3 วินาที
    setTimeout(() => {
      setShowSuccessPopup(false)
    }, 3000)
  }

  const handleUpdate = (updated) => {
    const updatedSchedules = schedules.map(s => s.id === updated.id ? updated : s)
    setSchedules(updatedSchedules)
    
    // 🔥 บันทึกลง localStorage ก่อน (สำคัญ!)
    localStorage.setItem('attendanceSchedules', JSON.stringify(updatedSchedules))
    
    setShowEdit(false)
    setEditingItem(null)
    
    // แสดง popup สำเร็จ
    setSuccessMessage('ปรับตารางงานเรียบร้อย!')
    setShowSuccessPopup(true)
    
    // ปิด popup อัตโนมัติหลัง 3 วินาที
    setTimeout(() => {
      setShowSuccessPopup(false)
    }, 3000)
  }

    return (
      <div className="w-full bg-gray-50 min-h-screen overflow-y-auto" 
      style={{ scrollbarGutter: 'stable' }}
      >
        <div className="w-full pl-3 pr-2 md:pl-4 md:pr-2 lg:pl-6 lg:pr-3 py-6">
          <div
            className="w-full mx-auto bg-white rounded-2xl p-6 shadow-sm border border-gray-200"
            style={{ boxShadow: '0 12px 28px rgba(11,43,87,0.08)' }}
          >
          <div className="flex items-start justify-between mb-6">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">ตารางงาน</h2>
              <p className="text-sm text-gray-600 mt-1">ตรวจสอบและปรับตารางให้เหมาะสมกับจำนวนพนักงานและพื้นที่</p>
            </div>

            <div className="flex items-center gap-3 flex-wrap">
              {/* 🏢 Branch filter dropdown (Super Admin only) - ย้ายมาก่อน */}
              {currentUser?.role === 'superadmin' && (
                <div className="relative" ref={branchFilterDropdownRef}>
                  <button
                    onClick={() => setShowBranchFilterDropdown(!showBranchFilterDropdown)}
                    className="inline-flex items-center justify-center gap-2 px-4 py-2.5 bg-white border-2 border-gray-300 hover:border-brand-primary text-gray-700 rounded-lg transition-all font-medium text-sm"
                  >
                    <span className="min-w-[80px] text-left font-semibold">
                      {selectedBranchFilter === 'all' 
                        ? 'สาขา ทั้งหมด' 
                        : `${selectedBranchFilter} (${availableBranches.find(b => b.code === selectedBranchFilter)?.name.split(' ')[0] || ''})`}
                    </span>
                    <svg className={`w-4 h-4 transition-transform ${showBranchFilterDropdown ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </button>

                  {/* Dropdown menu */}
                  {showBranchFilterDropdown && (
                    <div className="absolute top-full left-0 mt-2 w-64 bg-white border-2 border-gray-200 rounded-lg shadow-lg z-50 overflow-hidden">
                      {/* ตัวเลือก "สาขา ทั้งหมด" */}
                      <button
                        onClick={() => {
                          setSelectedBranchFilter('all')
                          setShowBranchFilterDropdown(false)
                        }}
                        className={`w-full px-4 py-3 text-left text-sm font-medium transition-colors ${
                          selectedBranchFilter === 'all'
                            ? 'bg-brand-primary text-white'
                            : 'text-gray-700 hover:bg-brand-accent'
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span>สาขา ทั้งหมด</span>
                        </div>
                      </button>

                      {/* แสดงรายการสาขา */}
                      {availableBranches.map((branch) => (
                        <button
                          key={branch.code}
                          onClick={() => {
                            setSelectedBranchFilter(branch.code)
                            setShowBranchFilterDropdown(false)
                          }}
                          className={`w-full px-4 py-3 text-left text-sm font-medium transition-colors ${
                            selectedBranchFilter === branch.code
                              ? 'bg-brand-primary text-white'
                              : 'text-gray-700 hover:bg-brand-accent'
                          }`}
                        >
                          {branch.code} ({branch.name})
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* ปุ่มสร้างตารางใหม่ */}
              <button 
                onClick={() => setShowCreate(true)} 
                className="inline-flex items-center justify-center text-base font-semibold bg-brand-primary hover:bg-gray-700 text-white min-w-[180px] h-10 px-5 leading-none rounded-xl shadow-sm transition-colors"
              >
                สร้างตารางการทำงานใหม่
              </button>

              {!selectMode ? (
                // ปกติ: แสดงปุ่มเข้าสู่โหมดลบ
                <button 
                  onClick={toggleSelectMode} 
                  className="inline-flex items-center justify-center px-5 py-2.5 bg-destructive hover:bg-destructive/90 text-white rounded-lg shadow-sm transition-colors font-medium text-sm"
                >
                  ลบตาราง
                </button>
              ) : (
                // ในโหมดเลือก: แสดงปุ่มลบทั้งหมด, ลบที่เลือก, ยกเลิก
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    onClick={() => setShowDeleteAllConfirm(true)}
                    disabled={filteredSchedules.length === 0}
                    className={`inline-flex items-center justify-center px-5 py-2.5 rounded-lg transition-colors font-medium text-sm ${
                      filteredSchedules.length === 0 
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                        : 'bg-destructive hover:bg-destructive/90 text-white shadow-sm'
                    }`}
                  >
                    ลบทั้งหมด
                  </button>

                  <button
                    onClick={() => setShowDeleteSelectedConfirm(true)}
                    disabled={selectedIds.length === 0}
                    className={`inline-flex items-center justify-center px-5 py-2.5 rounded-lg transition-colors font-medium text-sm ${
                      selectedIds.length === 0 
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                        : 'bg-destructive hover:bg-destructive/90 text-white shadow-sm'
                    }`}
                  >
                    ลบที่เลือก ({selectedIds.length})
                  </button>

                  <button 
                    onClick={toggleSelectMode} 
                    className="inline-flex items-center justify-center px-5 py-2.5 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-brand-accent hover:border-brand-primary transition-colors font-medium text-sm"
                  >
                    ยกเลิก
                  </button>
                </div>
              )}
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 items-start">
          {filteredSchedules.length === 0 && (
            <div className="col-span-full text-center text-gray-600 py-8">ไม่มีตารางงาน</div>
          )}

          {filteredSchedules.map(item => {
            const isOpen = openIds.includes(item.id)
            const checked = selectedIds.includes(item.id)

            return (
              <div
                key={item.id}
                onClick={() => selectMode && toggleSelect(item.id)}
                className={`relative rounded-xl p-4 text-gray-900 border-2 shadow-sm h-fit transition-colors ${
                  selectMode 
                    ? `cursor-pointer ${checked ? 'border-brand-primary bg-brand-accent-soft' : 'border-gray-200 hover:border-brand-primary hover:bg-brand-accent'}` 
                    : 'border-gray-200'
                }`}
              >
                {/* top-right: checkbox (in select mode) + time pill (always shown) */}
                <div className="absolute top-3 right-3 flex items-center space-x-2">
                  <div className="bg-brand-accent text-gray-900 px-2.5 py-1 rounded-full text-xs border border-gray-300 shadow-sm">
                    {item.time}
                  </div>
                  {selectMode && (
                    <div 
                      onClick={(e) => { e.stopPropagation(); toggleSelect(item.id); }}
                      className="flex items-center justify-center w-6 h-6 rounded border-2 border-gray-400 bg-white hover:border-brand-primary transition-colors cursor-pointer"
                    >
                      {checked && (
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-brand-primary" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                        </svg>
                      )}
                    </div>
                  )}
                </div>

                <div className="flex items-start">
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-xl pr-20">{item.team}</h3>
                    <div className="text-sm text-gray-600 mt-1 space-y-0.5">
                      <div className="leading-tight">วันที่: {item.date}</div>
                      <div className="leading-tight">สถานที่: {item.location}</div>
                      <div className="leading-tight">สมาชิก: {item.members}</div>
                      <div className="leading-tight">ประเภทงาน: {item.type}</div>
                    </div>

                    <div className="mt-4 mb-2 flex items-center gap-2 flex-wrap">
                      {/* Primary button - smaller size */}
                      {!selectMode && (
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditingItem(item); setShowEdit(true); }}
                          className="inline-flex items-center justify-center text-sm font-semibold bg-brand-primary hover:bg-gray-700 text-white min-w-[100px] h-8 px-4 leading-none rounded-lg shadow-sm transition-colors"
                        >
                          ปรับตาราง
                        </button>
                      )}

                      {/* Secondary toggle - smaller size */}
                      {!selectMode && (
                        <button
                          onClick={(e) => { e.stopPropagation(); toggleDetails(item.id); }}
                          aria-expanded={isOpen}
                          className="relative inline-flex items-center justify-center text-sm font-semibold rounded-lg shadow-sm transition-colors overflow-hidden bg-white text-gray-900 border-2 border-gray-300 min-w-[100px] h-8 px-4 leading-none hover:bg-brand-accent"
                        >
                        <span
                          aria-hidden={isOpen}
                          className={`absolute inset-0 flex items-center justify-center transition-opacity duration-[220ms] ease-in-out pointer-events-none ${isOpen ? 'opacity-0' : 'opacity-100'}`}
                        >
                          รายละเอียด
                        </span>

                        <span
                          aria-hidden={!isOpen}
                          className={`absolute inset-0 flex items-center justify-center transition-opacity duration-[220ms] ease-in-out pointer-events-none ${isOpen ? 'opacity-100' : 'opacity-0'}`}
                        >
                          ซ่อน
                        </span>

                        <span className="sr-only">{isOpen ? 'ซ่อนรายละเอียด' : 'รายละเอียด'}</span>
                      </button>
                      )}
                    </div>

                    <div
                      ref={el => {
                        if (el && !el.dataset.attInit) {
                          // initialize wrapper styles only once per DOM node
                          el.style.overflow = 'hidden'
                          el.style.maxHeight = '0px'
                          el.style.opacity = '0'
                          el.style.transition = 'max-height 320ms cubic-bezier(.4,0,.2,1), opacity 220ms ease'
                          el.dataset.attInit = '1'
                        }
                        wrapperRefs.current[item.id] = el
                      }}
                      aria-hidden={!isOpen}
                      className="mt-3"
                    >
                      <div
                        ref={el => {
                            if (el && !el.dataset.attInnerInit) {
                              el.style.transform = 'translateY(-6px)'
                              el.style.opacity = '0'
                              el.style.transition = 'transform 260ms cubic-bezier(.2,.8,.2,1), opacity 220ms ease'
                              el.dataset.attInnerInit = '1'
                            }
                            innerRefs.current[item.id] = el
                        }}
                        className="bg-white text-gray-800 rounded-lg p-3 border border-gray-200"
                      >
                        {/* Compact layout */}
                        {(() => {
                          const locationData = locations.find(loc => loc.name === item.location)
                          
                          return (
                            <div className="flex flex-col gap-4">
                              {/* Information - Compact */}
                              <div className="space-y-3">
                                <div>
                                  <h4 className="font-semibold mb-1.5 text-base">ภารกิจหลัก:</h4>
                                  <ul className="list-disc pl-5 text-sm space-y-0.5">
                                    {item.tasks?.map((t, idx) => <li key={idx}>{t}</li>)}
                                  </ul>
                                </div>

                                <div>
                                  <h4 className="font-semibold mb-1.5 text-base">สิ่งที่ต้องเตรียม:</h4>
                                  <ul className="list-disc pl-5 text-sm space-y-0.5">
                                    {item.preparations?.map((p, idx) => <li key={idx}>{p}</li>)}
                                  </ul>
                                </div>

                                <div>
                                  <h4 className="font-semibold mb-1.5 text-base">เป้าหมาย:</h4>
                                  <ul className="list-disc pl-5 text-sm space-y-0.5">
                                    {item.goals?.map((g, idx) => <li key={idx}>{g}</li>)}
                                  </ul>
                                </div>
                              </div>

                              {/* Map - Compact */}
                              {locationData && (
                                <div>
                                  <h4 className="font-semibold mb-2 text-base flex items-center gap-2">
                                    <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-green-500" viewBox="0 0 24 24" fill="currentColor">
                                      <path d="M20.5 3l-.16.03L15 5.1 9 3 3.36 4.9c-.21.07-.36.25-.36.48V20.5c0 .28.22.5.5.5l.16-.03L9 18.9l6 2.1 5.64-1.9c.21-.07.36-.25.36-.48V3.5c0-.28-.22-.5-.5-.5zM15 19l-6-2.11V5l6 2.11V19z"/>
                                    </svg>
                                    แผนที่ตำแหน่ง
                                  </h4>
                                  <div className="relative h-[250px] rounded-lg overflow-hidden border-2 border-gray-200 shadow-sm">
                                    <MapContainer
                                      center={[locationData.latitude, locationData.longitude]}
                                      zoom={15}
                                      style={{ height: '100%', width: '100%' }}
                                      scrollWheelZoom={true}
                                      zoomControl={true}
                                    >
                                      <LayersControl position="topright">
                                        <LayersControl.BaseLayer checked name="แผนที่ปกติ">
                                          <TileLayer
                                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                          />
                                        </LayersControl.BaseLayer>
                                        <LayersControl.BaseLayer name="แผนที่ดาวเทียม">
                                          <TileLayer
                                            attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
                                            url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                                          />
                                        </LayersControl.BaseLayer>
                                      </LayersControl>
                                      
                                      <Marker position={[locationData.latitude, locationData.longitude]} />
                                      <Circle
                                        center={[locationData.latitude, locationData.longitude]}
                                        radius={locationData.radius}
                                        pathOptions={{ 
                                          color: 'green',
                                          fillColor: 'green',
                                          fillOpacity: 0.2 
                                        }}
                                      />
                                    </MapContainer>
                                  </div>
                                  <p className="text-xs text-gray-500 mt-1.5 text-center">
                                    วงกลมสีเขียวแสดงพื้นที่ที่สามารถเช็คอินได้
                                  </p>
                                </div>
                              )}
                            </div>
                          )
                        })()}
                      </div>
                    </div>

                  </div>
                </div>
              </div>
            )
          })}
        </div>

        {/* show modal when creating */}
        {showCreate && (
          <CreateAttendance
            onClose={() => setShowCreate(false)}
            onCreate={handleCreate}
          />
        )}

        {/* Edit modal (reuse CreateAttendance in edit mode) */}
        {showEdit && editingItem && (
          <CreateAttendance
            onClose={() => { setShowEdit(false); setEditingItem(null) }}
            onUpdate={handleUpdate}
            initialData={editingItem}
          />
        )}

        {/* Success Popup */}
        {showSuccessPopup && (
          <div className="fixed inset-0 flex items-center justify-center z-[9999] pointer-events-none">
            <div className="bg-white rounded-2xl shadow-sm p-6 max-w-md mx-4 border-2 border-green-400 pointer-events-auto animate-bounce-in">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-7 w-7 text-green-500" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z"/>
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-800">{successMessage}</h3>
                  <p className="text-sm text-gray-600 mt-1">ระบบได้บันทึกข้อมูลเรียบร้อยแล้ว</p>
                </div>
                <button
                  onClick={() => setShowSuccessPopup(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete All Confirmation Modal */}
        {showDeleteAllConfirm && (
          <div className="fixed inset-0 flex items-center justify-center z-[9998]" role="dialog" aria-modal="true" style={{ willChange: 'opacity, transform' }}>
            {/* Backdrop with blur and dim */}
            <div
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9998]"
              onClick={() => setShowDeleteAllConfirm(false)}
              style={{ willChange: 'opacity, transform' }}
            />

            {/* Modal content card with border, ring and elevated shadow */}
            <div
              className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 border border-gray-200 shadow-sm z-[9999]"
              style={{ boxShadow: '0 10px 30px rgba(11,43,87,0.18)' }}
              role="document"
            >
              <h3 className="text-lg font-semibold text-gray-800">ยืนยันการลบทั้งหมด</h3>
              <p className="text-sm text-gray-600 mt-2">คุณแน่ใจหรือไม่ว่าต้องการลบตารางทั้งหมด ({schedules.length} รายการ)? การกระทำนี้ไม่สามารถย้อนกลับได้</p>

              <div className="mt-4 flex justify-end items-center gap-3">
                <button 
                  type="button" 
                  onClick={() => setShowDeleteAllConfirm(false)} 
                  className="inline-flex items-center justify-center px-5 py-2.5 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-brand-accent transition-colors font-medium text-sm"
                >
                  ยกเลิก
                </button>
                <button 
                  type="button" 
                  onClick={deleteAll} 
                  className="inline-flex items-center justify-center px-5 py-2.5 bg-destructive hover:bg-destructive/90 text-white rounded-lg shadow-sm transition-colors font-medium text-sm"
                >
                  ลบทั้งหมด
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Delete Selected Confirmation Modal */}
        {showDeleteSelectedConfirm && (
          <div className="fixed inset-0 flex items-center justify-center z-[9998]" role="dialog" aria-modal="true" style={{ willChange: 'opacity, transform' }}>
            {/* Backdrop with blur and dim */}
            <div
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9998]"
              onClick={() => setShowDeleteSelectedConfirm(false)}
              style={{ willChange: 'opacity, transform' }}
            />

            {/* Modal content card with border, ring and elevated shadow */}
            <div
              className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 border border-gray-200 shadow-sm z-[9999]"
              style={{ boxShadow: '0 10px 30px rgba(11,43,87,0.18)' }}
              role="document"
            >
              <h3 className="text-lg font-semibold text-gray-800">ยืนยันการลบที่เลือก</h3>
              <p className="text-sm text-gray-600 mt-2">คุณแน่ใจหรือไม่ว่าต้องการลบตารางที่เลือก ({selectedIds.length} รายการ)? การกระทำนี้ไม่สามารถย้อนกลับได้</p>

              <div className="mt-4 flex justify-end items-center gap-3">
                <button 
                  type="button" 
                  onClick={() => setShowDeleteSelectedConfirm(false)} 
                  className="inline-flex items-center justify-center px-5 py-2.5 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-brand-accent transition-colors font-medium text-sm"
                >
                  ยกเลิก
                </button>
                <button 
                  type="button" 
                  onClick={confirmDelete} 
                  className="inline-flex items-center justify-center px-5 py-2.5 bg-destructive hover:bg-destructive/90 text-white rounded-lg shadow-sm transition-colors font-medium text-sm"
                >
                  ลบที่เลือก
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  </div>
  )
}

export default Attendance