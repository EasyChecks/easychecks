import React, { useMemo } from 'react'
import { NavLink } from 'react-router-dom'
import { useAuth } from '../../../contexts/useAuth'

function Nav() {
  const { user } = useAuth() // ใช้ user ที่ login ตอนนี้
  
  // ตรวจสอบว่าเป็น manager หรือไม่
  const isManager = useMemo(() => user?.role === 'manager', [user?.role])

  // รวมเมนูตามสิทธิ์
  const items = useMemo(() => {
    // เมนูพื้นฐานสำหรับทุกคน
    const basicItems = [
      { 
        id: 1, 
        path: '/user/dashboard', 
        icon: <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="var(--primary-hex, #F26623)"><path d="M240-200h120v-240h240v240h120v-360L480-740 240-560v360Zm-80 80v-480l320-240 320 240v480H520v-240h-80v240H160Zm320-350Z"/></svg>,
        text: 'หลัก'
      }
    ]

    // เมนูเพิ่มเติมสำหรับ manager (อนุมัติ)
    const managerItems = [
      {
        id: 2,
        path: '/user/leave-approval',
        icon: <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="var(--primary-hex, #F26623)"><path d="m424-296 282-282-56-56-226 226-114-114-56 56 170 170Zm56 216q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z"/></svg>,
        text: 'อนุมัติ'
      }
    ]

    // เมนูที่เหลือสำหรับทุกคน (วันลา, กิจกรรม)
    const commonItems = [
      { 
        id: 3, 
        path: '/user/leave',
        icon: <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="var(--primary-hex, #F26623)"><path d="M200-80q-33 0-56.5-23.5T120-160v-560q0-33 23.5-56.5T200-800h40v-80h80v80h320v-80h80v80h40q33 0 56.5 23.5T840-720v560q0 33-23.5 56.5T760-80H200Z"/></svg>,
        text: 'วันลา'
      },
      { 
        id: 4, 
        path: '/user/event',
        icon: <svg xmlns="http://www.w3.org/2000/svg" height="24px" viewBox="0 -960 960 960" width="24px" fill="var(--primary-hex, #F26623)"><path d="M480-120 200-272v-240L40-600l440-240 440 240v320h-80v-276l-80 44v240L480-120Zm0-332 274-148-274-148-274 148 274 148Zm0 241 200-108v-151L480-360 280-470v151l200 108Zm0-241Zm0 90Zm0 0Z"/></svg>,
        text: 'กิจกรรม'
      }
    ]

    // รวมเมนูตามสิทธิ์: หลัก → (อนุมัติ ถ้าเป็น manager) → วันลา → กิจกรรม
    return isManager 
      ? [...basicItems, ...managerItems, ...commonItems] 
      : [...basicItems, ...commonItems]
  }, [isManager])
  
  return (
    <>
      <div 
          className='fixed bottom-0 left-0 right-0 bg-white p-3 border-t border-gray-200
          font-prompt shadow-lg z-20 max-w-7xl mx-auto'>
        <div className='flex justify-around items-center'>
          {items.map(item => (
            <NavLink
              key={item.id}
              to={item.path}
              className={({isActive}) => `
                px-4 py-2 rounded-xl flex flex-col items-center cursor-pointer 
                transition-all duration-300 ease-in-out min-w-[70px]
                hover:bg-orange-50
                ${isActive ? 'text-brand-primary bg-orange-50 scale-105' : 'text-[#9CA3AF]'}
              ` }
            >
              {({isActive}) => (
                <>
                  <div className='transition-all duration-300 ease-in-out'>
                    {React.cloneElement(item.icon, {
                      fill: isActive ? '#F26623' : '#9CA3AF',
                      className: 'transition-all duration-300 ease-in-out'
                    })}
                  </div>
                  <div className="text-center text-xs mt-1 transition-all duration-300 ease-in-out font-medium">
                    {item.text}
                  </div>
                </>
              )}
            </NavLink>
          ))}
        </div>
      </div>
    </>
  )
}

export default Nav