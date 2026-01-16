// หน้าจัดการพื้นที่ (Locations) และกิจกรรม (Events) บนแผนที่
// สำหรับ Admin สร้าง/แก้ไข/ลบ พื้นที่เช็คอินและกิจกรรมพิเศษ
// รองรับการกำหนดรัศมี ผู้รับผิดชอบ วันเวลา และค้นหาตำแหน่งบนแผนที่

import React, { useState, useRef, useEffect } from 'react'
import { MapContainer, TileLayer, Marker, Circle, useMap, Popup } from 'react-leaflet' // Components สำหรับแผนที่ Leaflet
import 'leaflet/dist/leaflet.css'
import L from 'leaflet' // Library แผนที่
import { useLocations } from '../../contexts/LocationContext' // Context จัดการพื้นที่เช็คอิน (สถานที่ถาวร)
import { useEvents } from '../../contexts/EventContext' // Context จัดการกิจกรรมพิเศษ (มีวันเวลาเริ่มต้น-สิ้นสุด)
import { useAuth } from '../../contexts/useAuth' // Context ข้อมูล user (role, branch)
import { usersData } from '../../data/usersData' // ข้อมูล user ทั้งหมด สำหรับกำหนดผู้รับผิดชอบ
import CustomDatePicker from '../../components/common/CustomDatePicker' // Custom Date Picker แบบไทย

// สร้าง CSS animation สำหรับ fade in และ scale in
const style = document.createElement('style')
style.textContent = `
  @keyframes fadeIn {
    from {
      opacity: 0;
    }
    to {
      opacity: 1;
    }
  }
  
  @keyframes scaleIn {
    from {
      opacity: 0;
      transform: scale(0.9);
    }
    to {
      opacity: 1;
      transform: scale(1);
    }
  }
`
document.head.appendChild(style)

// แก้ปัญหา marker icon เริ่มต้นของ Leaflet
delete L.Icon.Default.prototype._getIconUrl
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
})

// Icon สีเขียวสำหรับพื้นที่/สถานที่
const locationIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNSIgaGVpZ2h0PSI0MSIgdmlld0JveD0iMCAwIDI1IDQxIj48cGF0aCBmaWxsPSIjMjJjNTVlIiBkPSJNMTIuNSAwQzUuNiAwIDAgNS42IDAgMTIuNWMwIDkuNCAxMi41IDI4LjUgMTIuNSAyOC41UzI1IDIxLjkgMjUgMTIuNUMyNSA1LjYgMTkuNCAwIDEyLjUgMHptMCAxN2MtMi41IDAtNC41LTItNC41LTQuNXMyLTQuNSA0LjUtNC41IDQuNSAyIDQuNSA0LjUtMiA0LjUtNC41IDQuNXoiLz48L3N2Zz4=',
  iconRetinaUrl: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNSIgaGVpZ2h0PSI0MSIgdmlld0JveD0iMCAwIDI1IDQxIj48cGF0aCBmaWxsPSIjMjJjNTVlIiBkPSJNMTIuNSAwQzUuNiAwIDAgNS42IDAgMTIuNWMwIDkuNCAxMi41IDI4LjUgMTIuNSAyOC41UzI1IDIxLjkgMjUgMTIuNUMyNSA1LjYgMTkuNCAwIDEyLjUgMHptMCAxN2MtMi41IDAtNC41LTItNC41LTQuNXMyLTQuNSA0LjUtNC41IDQuNSAyIDQuNSA0LjUtMiA0LjUtNC41IDQuNXoiLz48L3N2Zz4=',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
})

// Icon สีส้มสำหรับกิจกรรม/Event
const eventIcon = new L.Icon({
  iconUrl: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNSIgaGVpZ2h0PSI0MSIgdmlld0JveD0iMCAwIDI1IDQxIj48cGF0aCBmaWxsPSIjZjk3MzE2IiBkPSJNMTIuNSAwQzUuNiAwIDAgNS42IDAgMTIuNWMwIDkuNCAxMi41IDI4LjUgMTIuNSAyOC41UzI1IDIxLjkgMjUgMTIuNUMyNSA1LjYgMTkuNCAwIDEyLjUgMHptMCAxN2MtMi41IDAtNC41LTItNC41LTQuNXMyLTQuNSA0LjUtNC41IDQuNSAyIDQuNSA0LjUtMiA0LjUtNC41IDQuNXoiLz48L3N2Zz4=',
  iconRetinaUrl: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNSIgaGVpZ2h0PSI0MSIgdmlld0JveD0iMCAwIDI1IDQxIj48cGF0aCBmaWxsPSIjZjk3MzE2IiBkPSJNMTIuNSAwQzUuNiAwIDAgNS42IDAgMTIuNWMwIDkuNCAxMi41IDI4LjUgMTIuNSAyOC41UzI1IDIxLjkgMjUgMTIuNUMyNSA1LjYgMTkuNCAwIDEyLjUgMHptMCAxN2MtMi41IDAtNC41LTItNC41LTQuNXMyLTQuNSA0LjUtNC41IDQuNSAyIDQuNSA0LjUtMiA0LjUtNC41IDQuNXoiLz48L3N2Zz4=',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
})

// Component ปรับมุมมองแผนที่ให้เห็นหมุดทั้งหมดตอนเปิดครั้งแรก - ทำงานครั้งเดียว
// ใช้ fitBounds เพื่อแสดงหมุดทั้งหมดใน viewport พอดี
// disabled = true จะปิดการทำงาน (เมื่อกำลัง fly ไปหมุดที่เลือก)
function FitBoundsToMarkers({ locations, disabled }) {
  const map = useMap()
  const hasInitialized = React.useRef(false) // เช็คว่าทำไปแล้วหรือยัง ป้องกันการทำซ้ำ

  React.useEffect(() => {
    // ทำครั้งเดียวตอนเปิดครั้งแรก - ไม่ทำซ้ำ
    if (!disabled && !hasInitialized.current && locations && locations.length > 0) {
      hasInitialized.current = true
      const bounds = L.latLngBounds(
        locations.map(loc => [loc.latitude, loc.longitude])
      )
      map.fitBounds(bounds, {
        padding: [50, 50],
        maxZoom: 16,
        animate: true,
        duration: 0.5
      })
    }
  }, [locations, map, disabled])

  return null
}

// Component บินไปยังจุดที่ต้องการ - มี animation ลื่นไหล
// เมื่อคลิกหมุดจากรายการด้านข้าง แผนที่จะ fly ไปที่ตำแหน่งนั้นแบบ smooth
// คำนวณ offset เพื่อให้หมุดอยู่ตรงกลางพื้นที่ที่เห็น (ไม่ถูกบังด้วย sidebar)
function FlyToLocation({ position, onFlyStart, onFlyEnd }) {
  const map = useMap()
  const previousPosition = React.useRef(null) // เก็บตำแหน่งก่อนหน้าเพื่อเช็คว่าเปลี่ยนหรือไม่ ป้องกัน animate ซ้ำ

  React.useEffect(() => {
    if (!position) {
      previousPosition.current = null
      return
    }

    // เช็คว่าตำแหน่งเปลี่ยนจริงหรือไม่ - ป้องกันการ animate ซ้ำซ้อน
    if (previousPosition.current && 
        previousPosition.current[0] === position[0] && 
        previousPosition.current[1] === position[1]) {
      return
    }

    previousPosition.current = position

    // Check if we need to fly or just open popup
    const currentCenter = map.getCenter()
    const distance = map.distance(currentCenter, position)
    
    // If we're already very close (less than 50 meters), just open popup without flying
    if (distance < 50) {
      // Just open the popup without animation
      setTimeout(() => {
        map.eachLayer((layer) => {
          if (layer instanceof L.Marker) {
            const latLng = layer.getLatLng()
            if (Math.abs(latLng.lat - position[0]) < 0.00001 && 
                Math.abs(latLng.lng - position[1]) < 0.00001) {
              layer.openPopup()
            }
          }
        })
        if (onFlyEnd) onFlyEnd()
      }, 100)
      return
    }

    // Notify that fly animation is starting
    if (onFlyStart) onFlyStart()

    // Get map container dimensions
    const container = map.getContainer()
    const containerWidth = container.offsetWidth
    const containerHeight = container.offsetHeight
    
    const rightPanelWidth = 100
    
    // คำนวณจุดกึ่งกลางของพื้นที่แผนที่ที่มองเห็น (ส่วนซ้าย)
    const visibleMapWidth = containerWidth - rightPanelWidth
    const visibleCenterX = visibleMapWidth / 2
    
    // จุดกึ่งกลางของ container ทั้งหมด
    const containerCenterX = containerWidth / 2
    
    // คำนวณระยะ offset (เป็นลบเพราะต้องเลื่อนไปทางซ้าย)
    const offsetPixelsX = visibleCenterX - containerCenterX
    
    // แปลง pixel offset เป็น lat/lng offset
    // ใช้ zoom level 18 (ปลายทาง) ในการคำนวณ
    const targetZoom = 18
    const markerPoint = map.project(position, targetZoom)
    const adjustedPoint = L.point(markerPoint.x - offsetPixelsX, markerPoint.y)
    const adjustedPosition = map.unproject(adjustedPoint, targetZoom)
    
    // Stop any ongoing animations first
    map.stop()
    
    // Fly to the adjusted position with smooth animation
    map.flyTo(adjustedPosition, targetZoom, {
      animate: true,
      duration: 1.5
    })
    
    // Open popup after animation
    const popupTimer = setTimeout(() => {
      map.eachLayer((layer) => {
        if (layer instanceof L.Marker) {
          const latLng = layer.getLatLng()
          if (Math.abs(latLng.lat - position[0]) < 0.00001 && 
              Math.abs(latLng.lng - position[1]) < 0.00001) {
            layer.openPopup()
          }
        }
      })
      if (onFlyEnd) onFlyEnd()
    }, 1600)

    return () => {
      clearTimeout(popupTimer)
    }
  }, [position, map, onFlyStart, onFlyEnd])

  return null
}

// Component สำหรับจัดการการคลิกบนแผนที่
// เมื่อคลิกบนแผนที่ จะสร้างหมุดชั่วคราวและเปิด Modal สร้างพื้นที่/กิจกรรม
function MapClickHandler({ onMapClick }) {
  const map = useMap()

  React.useEffect(() => {
    map.on('click', onMapClick)
    return () => {
      map.off('click', onMapClick)
    }
  }, [map, onMapClick])

  return null
}

// Component แสดงหมุดชั่วคราว (สีแดง) สำหรับผลการค้นหาหรือตำแหน่งที่คลิก
// จะแสดง popup พร้อมปุ่มสร้างพื้นที่/กิจกรรมที่ตำแหน่งนี้
function SearchMarker({ position, name, onClick }) {
  const markerRef = useRef(null)
  
  // Auto-open popup when marker is created or updated
  useEffect(() => {
    if (markerRef.current && position) {
      // Small delay to ensure marker is rendered
      setTimeout(() => {
        markerRef.current.openPopup()
      }, 100)
    }
  }, [position])
  
  if (!position) return null
  
  const searchIcon = new L.Icon({
    iconUrl: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNSIgaGVpZ2h0PSI0MSIgdmlld0JveD0iMCAwIDI1IDQxIj48cGF0aCBmaWxsPSIjZWY0NDQ0IiBkPSJNMTIuNSAwQzUuNiAwIDAgNS42IDAgMTIuNWMwIDkuNCAxMi41IDI4LjUgMTIuNSAyOC41UzI1IDIxLjkgMjUgMTIuNUMyNSA1LjYgMTkuNCAwIDEyLjUgMHptMCAxN2MtMi41IDAtNC41LTItNC41LTQuNXMyLTQuNSA0LjUtNC41IDQuNSAyIDQuNSA0LjUtMiA0LjUtNC41IDQuNXoiLz48L3N2Zz4=',
    iconRetinaUrl: 'data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNSIgaGVpZ2h0PSI0MSIgdmlld0JveD0iMCAwIDI1IDQxIj48cGF0aCBmaWxsPSIjZWY0NDQ0IiBkPSJNMTIuNSAwQzUuNiAwIDAgNS42IDAgMTIuNWMwIDkuNCAxMi41IDI4LjUgMTIuNSAyOC41UzI1IDIxLjkgMjUgMTIuNUMyNSA1LjYgMTkuNCAwIDEyLjUgMHptMCAxN2MtMi41IDAtNC41LTItNC41LTQuNXMyLTQuNSA0LjUtNC41IDQuNSAyIDQuNSA0LjUtMiA0LjUtNC41IDQuNXoiLz48L3N2Zz4=',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
  })

  return (
    <Marker 
      position={position} 
      icon={searchIcon}
      ref={markerRef}
    >
      <Popup autoClose={false} closeOnClick={false}>
        <div className="p-2">
          <div className="flex items-center gap-2 mb-2">
            <div className="w-3 h-3 rounded-full bg-gray-600"></div>
            <h3 className="font-bold text-gray-800">{name === 'ตำแหน่งใหม่' ? 'ตำแหน่งที่เลือก' : 'ผลการค้นหา'}</h3>
          </div>
          <p className="text-xs text-gray-600 mb-2">{name}</p>
          <div className="text-xs text-gray-500 mb-3 bg-gray-50 p-2 rounded">
            <div className="font-medium mb-1">พิกัด:</div>
            <div className="font-mono">{position[0].toFixed(6)}, {position[1].toFixed(6)}</div>
          </div>
          <button
            onClick={onClick}
            className="w-full bg-brand-primary hover:bg-gray-700 text-white px-3 py-2.5 rounded-lg text-xs font-medium transition-colors"
          >
            สร้างพื้นที่/กิจกรรมที่นี่
          </button>
        </div>
      </Popup>
    </Marker>
  )
}

// Component Multi-Select with Search - เลือกหลายรายการพร้อมค้นหา
// ใช้สำหรับเลือกผู้รับผิดชอบกิจกรรม (พนักงาน/แผนก/ตำแหน่ง)
// รองรับการค้นหา ลบรายการ และแสดงข้อมูลเพิ่มเติม (secondary)
function MultiSelect({ selected, onChange, options, placeholder, label }) {
  const [isOpen, setIsOpen] = useState(false) // เปิด/ปิด dropdown
  const [searchTerm, setSearchTerm] = useState('') // คำค้นหา
  const dropdownRef = useRef(null) // ใช้สำหรับปิด dropdown เมื่อคลิกข้างนอก

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filtered = options.filter(opt => 
    opt.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (opt.secondary && opt.secondary.toLowerCase().includes(searchTerm.toLowerCase()))
  )

  const toggleOption = (value) => {
    if (selected.includes(value)) {
      onChange(selected.filter(v => v !== value))
    } else {
      onChange([...selected, value])
    }
  }

  const selectedLabels = selected.map(val => {
    const opt = options.find(o => o.value === val)
    return opt ? opt.label : val
  })

  return (
    <div className="relative" ref={dropdownRef}>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        {label}
      </label>
      
      <div 
        className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus-within:border-brand-primary cursor-pointer min-h-[42px] flex flex-wrap gap-2 items-center"
        onClick={() => setIsOpen(!isOpen)}
      >
        {selected.length === 0 ? (
          <span className="text-gray-400 text-sm">{placeholder}</span>
        ) : (
          selectedLabels.map((label, idx) => (
            <span key={idx} className="bg-orange-100 text-orange-700 px-2 py-1 rounded text-xs font-medium flex items-center gap-1">
              {label}
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  const opt = options.find(o => o.label === label)
                  if (opt) toggleOption(opt.value)
                }}
                className="hover:bg-orange-200 rounded-full"
              >
                <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                </svg>
              </button>
            </span>
          ))
        )}
      </div>

      {isOpen && (
        <div className="absolute z-[2100] w-full mt-1 bg-white border-2 border-gray-200 rounded-lg shadow-sm max-h-64 overflow-hidden">
          <div className="p-2 border-b border-gray-200">
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="ค้นหา..."
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:border-brand-primary focus:outline-none"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="max-h-48 overflow-y-auto">
            {filtered.length === 0 ? (
              <div className="px-4 py-3 text-sm text-gray-500 text-center">ไม่พบข้อมูล</div>
            ) : (
              filtered.map(opt => (
                <div
                  key={opt.value}
                  className={`px-4 py-2 cursor-pointer hover:bg-orange-50 flex items-center gap-2 ${
                    selected.includes(opt.value) ? 'bg-orange-100' : ''
                  }`}
                  onClick={(e) => {
                    e.stopPropagation()
                    toggleOption(opt.value)
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selected.includes(opt.value)}
                    onChange={() => {}}
                    className="w-4 h-4 text-brand-primary"
                  />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-gray-900">{opt.label}</div>
                    {opt.secondary && (
                      <div className="text-xs text-gray-500">{opt.secondary}</div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// Custom Success Dialog - แสดงข้อความเมื่อดำเนินการสำเร็จ
// รองรับ Enter/Escape เพื่อปิด, แสดง icon เขียว
function SuccessDialog({ isOpen, message, onClose }) {
  useEffect(() => {
    if (isOpen) {
      const handleKeyDown = (e) => {
        if (e.key === 'Enter' || e.key === 'Escape') {
          onClose()
        }
      }
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-sm max-w-md w-full p-6 animate-scaleIn">
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" height="40px" viewBox="0 -960 960 960" width="40px" fill="#22C55E">
              <path d="M382-240 154-468l57-57 171 171 367-367 57 57-424 424Z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">สำเร็จ!</h3>
          <p className="text-gray-600 mb-6 whitespace-pre-line">{message}</p>
          <button
            onClick={onClose}
            className="w-full bg-gray-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-sm transition-all"
          >
            ตกลง
          </button>
        </div>
      </div>
    </div>
  )
}

// Custom Error Dialog - แสดงข้อความข้อผิดพลาด
// รองรับ Enter/Escape เพื่อปิด, แสดง icon ส้ม
function ErrorDialog({ isOpen, message, onClose }) {
  useEffect(() => {
    if (isOpen) {
      const handleKeyDown = (e) => {
        if (e.key === 'Enter' || e.key === 'Escape') {
          onClose()
        }
      }
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-sm max-w-md w-full p-6 animate-scaleIn">
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-orange-100 rounded-full flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" height="40px" viewBox="0 -960 960 960" width="40px" fill="#F97316">
              <path d="M480-280q17 0 28.5-11.5T520-320q0-17-11.5-28.5T480-360q-17 0-28.5 11.5T440-320q0 17 11.5 28.5T480-280Zm-40-160h80v-240h-80v240Zm40 360q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">ข้อผิดพลาด</h3>
          <p className="text-gray-600 mb-6 whitespace-pre-line">{message}</p>
          <button
            onClick={onClose}
            className="w-full bg-gray-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-sm transition-all"
          >
            ตกลง
          </button>
        </div>
      </div>
    </div>
  )
}

// Custom Confirm Dialog - ยืนยันการดำเนินการ (เช่น ลบพื้นที่/กิจกรรม)
// รองรับ Enter ยืนยัน, Escape ยกเลิก, แสดง icon แดง
function ConfirmDialog({ isOpen, title, message, onConfirm, onCancel }) {
  useEffect(() => {
    if (isOpen) {
      const handleKeyDown = (e) => {
        if (e.key === 'Enter') {
          onConfirm()
        } else if (e.key === 'Escape') {
          onCancel()
        }
      }
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isOpen, onConfirm, onCancel])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4 animate-fadeIn">
      <div className="bg-white rounded-2xl shadow-sm max-w-md w-full p-6 animate-scaleIn">
        <div className="flex flex-col items-center text-center">
          <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" height="40px" viewBox="0 -960 960 960" width="40px" fill="#EF4444">
              <path d="M480-280q17 0 28.5-11.5T520-320q0-17-11.5-28.5T480-360q-17 0-28.5 11.5T440-320q0 17 11.5 28.5T480-280Zm-40-160h80v-240h-80v240Zm40 360q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">{title}</h3>
          <p className="text-gray-600 mb-6 whitespace-pre-line">{message}</p>
          <div className="flex gap-3 w-full">
            <button
              onClick={onCancel}
              className="flex-1 bg-gray-200 text-gray-700 px-6 py-3 rounded-xl font-semibold hover:bg-gray-300 transition-all"
            >
              ยกเลิก
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 bg-gray-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-sm transition-all"
            >
              ยืนยัน
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Helper functions สำหรับแปลงรูปแบบวันที่
// localStorage เก็บแบบ dd/mm/yyyy แต่ CustomDatePicker ใช้ yyyy-mm-dd
// ต้องแปลงไปมาเมื่อ load/save ข้อมูล

// แปลงจาก dd/mm/yyyy (ไทย) เป็น yyyy-mm-dd (input date)
const convertDDMMYYYYtoYYYYMMDD = (ddmmyyyy) => {
  if (!ddmmyyyy || !ddmmyyyy.includes('/')) return ddmmyyyy
  const [d, m, y] = ddmmyyyy.split('/')
  return `${y}-${m}-${d}`
}

// แปลงจาก yyyy-mm-dd (input date) เป็น dd/mm/yyyy (ไทย)
const convertYYYYMMDDtoDDMMYYYY = (yyyymmdd) => {
  if (!yyyymmdd || !yyyymmdd.includes('-')) return yyyymmdd
  const [y, m, d] = yyyymmdd.split('-')
  return `${d}/${m}/${y}`
}

// Create Form Component - ฟอร์มสร้างพื้นที่/กิจกรรมใหม่
// type = 'location' (พื้นที่เช็คอิน) หรือ 'event' (กิจกรรมพิเศษ)
// position = [lat, lng] พิกัดที่เลือกบนแผนที่
// isSubmitting = ป้องกันการกด submit ซ้ำ
function CreateForm({ type, position, onSubmit, onCancel, user, onShowError, isSubmitting }) {
  // State สำหรับข้อมูลฟอร์ม
  const [formData, setFormData] = useState({
    name: '', // ชื่อพื้นที่/กิจกรรม (required)
    description: '', // คำอธิบายเพิ่มเติม
    radius: 100, // รัศมีเช็คอิน (เมตร) 50-1000
    branchCode: user?.branchCode || '', // สาขา (SuperAdmin เลือกได้, อื่นๆ ใช้ของตัวเอง)
    locationName: '', // ชื่อสถานที่ (event เท่านั้น)
    startDate: '', // วันที่เริ่ม (yyyy-mm-dd สำหรับ CustomDatePicker)
    endDate: '',   // วันที่สิ้นสุด (yyyy-mm-dd)
    startTime: '09:00', // เวลาเริ่ม
    endTime: '17:00', // เวลาสิ้นสุด
    assignedUsers: [], // พนักงานที่รับผิดชอบ (event เท่านั้น)
    assignedRoles: [], // Role ที่รับผิดชอบ (ไม่ได้ใช้งาน)
    assignedDepartments: [], // แผนกที่รับผิดชอบ (event เท่านั้น)
    assignedPositions: [] // ตำแหน่งที่รับผิดชอบ (event เท่านั้น)
  })

  // State สำหรับ Custom Time Picker
  const [showTimeStartPicker, setShowTimeStartPicker] = useState(false)
  const [showTimeEndPicker, setShowTimeEndPicker] = useState(false)
  const [tempStartTime, setTempStartTime] = useState({ hour: '09', minute: '00' })
  const [tempEndTime, setTempEndTime] = useState({ hour: '17', minute: '00' })
  
  const formRef = useRef(null)
  const timeStartPickerRef = useRef(null)
  const timeEndPickerRef = useRef(null)

  // ปิด time picker เมื่อคลิกข้างนอก
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (timeStartPickerRef.current && !timeStartPickerRef.current.contains(event.target)) {
        setShowTimeStartPicker(false)
      }
      if (timeEndPickerRef.current && !timeEndPickerRef.current.contains(event.target)) {
        setShowTimeEndPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Generate hours and minutes for time picker
  const hours24 = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'))
  const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'))

  // จัดการเลือกเวลา
  const handleTimeSelect = (hour, minute, isStart) => {
    if (isStart) {
      setTempStartTime({ hour, minute })
    } else {
      setTempEndTime({ hour, minute })
    }
  }

  // ยืนยันการเลือกเวลา
  const confirmTimeSelection = (isStart) => {
    if (isStart) {
      setFormData({ ...formData, startTime: `${tempStartTime.hour}:${tempStartTime.minute}` })
      setShowTimeStartPicker(false)
    } else {
      setFormData({ ...formData, endTime: `${tempEndTime.hour}:${tempEndTime.minute}` })
      setShowTimeEndPicker(false)
    }
  }

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Only handle keys when modal is open and this is the active form
      if (!formRef.current) return
      
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onCancel()
        return
      }
      
      // Handle Enter key for form submission
      if (e.key === 'Enter' && !e.shiftKey) {
        const target = e.target
        const isTextarea = target.tagName === 'TEXTAREA'
        const isSelect = target.tagName === 'SELECT'
        const isButton = target.tagName === 'BUTTON'
        
        // Don't submit on Enter in textarea, select, or button
        if (isTextarea || isSelect || isButton) return
        
        e.preventDefault()
        e.stopPropagation()
        
        if (formRef.current && typeof formRef.current.requestSubmit === 'function') {
          formRef.current.requestSubmit()
        } else if (formRef.current) {
          // Fallback for browsers that don't support requestSubmit
          formRef.current.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))
        }
      }
    }

    // Use capture phase to intercept before other handlers
    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [onCancel])

  const handleSubmit = (e) => {
    e.preventDefault()
    e.stopPropagation()
    
    // ป้องกันการ submit ซ้ำใน form level
    if (isSubmitting) {
      return
    }
    
    if (!formData.name.trim()) {
      onShowError('กรุณากรอกชื่อ')
      return
    }
    if (type === 'event' && (!formData.startDate || !formData.endDate)) {
      onShowError('กรุณาเลือกวันที่เริ่มและวันที่สิ้นสุด')
      return
    }
    
    // Validate dates if event type
    if (type === 'event') {
      // CustomDatePicker ส่งมาในรูปแบบ YYYY-MM-DD แล้ว
      const startDateObj = new Date(formData.startDate)
      const endDateObj = new Date(formData.endDate)
      
      if (startDateObj > endDateObj) {
        onShowError('วันที่เริ่มต้องไม่เกินวันที่สิ้นสุด')
        return
      }

      // Validate ผู้รับผิดชอบ - ต้องมีอย่างน้อย 1 เกณฑ์
      const hasAssignment = 
        formData.assignedUsers.length > 0 ||
        formData.assignedRoles.length > 0 ||
        formData.assignedDepartments.length > 0 ||
        formData.assignedPositions.length > 0

      if (!hasAssignment) {
        onShowError('กรุณากำหนดผู้รับผิดชอบอย่างน้อย 1 เกณฑ์\n(เลือกพนักงาน, Role, แผนก หรือตำแหน่ง)')
        return
      }
    }
    
    // แปลงวันที่จาก yyyy-mm-dd เป็น dd/mm/yyyy ก่อนส่ง
    const dataToSubmit = {
      ...formData,
      startDate: formData.startDate ? convertYYYYMMDDtoDDMMYYYY(formData.startDate) : '',
      endDate: formData.endDate ? convertYYYYMMDDtoDDMMYYYY(formData.endDate) : ''
    }
    
    onSubmit(dataToSubmit)
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
      {/* Position Info */}
      <div className="bg-gray-50 p-4 rounded-lg">
        <p className="text-xs text-gray-500 mb-2 font-medium">พิกัดที่เลือก</p>
        <div className="flex items-center gap-2 text-sm">
          <span className="font-mono text-gray-700">
            {position[0].toFixed(6)}, {position[1].toFixed(6)}
          </span>
        </div>
      </div>

      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          ชื่อ{type === 'location' ? 'พื้นที่' : 'กิจกรรม'} <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:border-brand-primary focus:outline-none transition-colors"
          placeholder={`ระบุชื่อ${type === 'location' ? 'พื้นที่' : 'กิจกรรม'}`}
          required
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          คำอธิบาย
        </label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:border-brand-primary focus:outline-none transition-colors resize-none"
          rows="3"
          placeholder="ระบุรายละเอียดเพิ่มเติม (ถ้ามี)"
        />
      </div>

      {/* 🆕 Branch Code - แสดงเฉพาะ SuperAdmin */}
      {user?.role === 'superadmin' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            สาขา <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.branchCode || user?.branchCode || ''}
            onChange={(e) => setFormData({ ...formData, branchCode: e.target.value })}
            className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:border-brand-primary focus:outline-none transition-colors cursor-pointer"
            required
          >
            <option value="">เลือกสาขา</option>
            <option value="101">BKK-101 (กรุงเทพมหานคร)</option>
            <option value="201">CNX-201 (เชียงใหม่)</option>
            <option value="301">PKT-301 (ภูเก็ต)</option>
          </select>
        </div>
      )}

      {/* Radius */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          รัศมี (เมตร) <span className="text-red-500">*</span>
        </label>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min="50"
            max="1000"
            step="10"
            value={formData.radius}
            onChange={(e) => setFormData({ ...formData, radius: parseInt(e.target.value) })}
            className="flex-1"
          />
          <input
            type="number"
            min="50"
            max="1000"
            value={formData.radius}
            onChange={(e) => setFormData({ ...formData, radius: parseInt(e.target.value) || 100 })}
            className="w-24 px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-brand-primary focus:outline-none text-center font-medium"
          />
        </div>
        <p className="text-xs text-gray-500 mt-1">ระยะทางที่อนุญาตให้เช็คอินได้จากจุดนี้</p>
      </div>

      {/* Event specific fields */}
      {type === 'event' && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ชื่อสถานที่
            </label>
            <input
              type="text"
              value={formData.locationName}
              onChange={(e) => setFormData({ ...formData, locationName: e.target.value })}
              className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:border-brand-primary focus:outline-none transition-colors"
              placeholder="เช่น โรงแรม ABC, งานเทศกาล XYZ"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <CustomDatePicker
              label="วันที่เริ่มกิจกรรม"
              value={formData.startDate}
              onChange={(value) => setFormData({ ...formData, startDate: value })}
              required={true}
            />
            
            <CustomDatePicker
              label="วันที่สิ้นสุด"
              value={formData.endDate}
              onChange={(value) => setFormData({ ...formData, endDate: value })}
              required={true}
            />
          </div>

          {/* Time Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                เวลาเริ่ม <span className="text-red-500">*</span>
              </label>
              <div className="relative" ref={timeStartPickerRef}>
                <input
                  type="text"
                  value={formData.startTime}
                  onFocus={() => {
                    setShowTimeStartPicker(true)
                    const [hour, minute] = formData.startTime.split(':')
                    setTempStartTime({ hour, minute })
                  }}
                  readOnly
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:border-brand-primary focus:outline-none transition-colors cursor-pointer"
                  placeholder="เช่น 09:00"
                />
                <button
                  type="button"
                  onClick={() => {
                    setShowTimeStartPicker(!showTimeStartPicker)
                    if (!showTimeStartPicker) {
                      const [hour, minute] = formData.startTime.split(':')
                      setTempStartTime({ hour, minute })
                    }
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-brand-primary transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <circle cx="12" cy="12" r="9" strokeWidth="1.5" />
                    <path d="M12 7v6l4 2" strokeWidth="1.5" />
                  </svg>
                </button>

                {showTimeStartPicker && (
                  <div className="absolute z-50 w-full mt-1 bg-white border-2 border-brand-primary rounded-lg shadow-2xl overflow-hidden">
                    <div className="flex">
                      <div className="flex-1 border-r border-gray-200">
                        <div className="bg-brand-primary text-white text-center py-2 text-sm font-semibold">
                          ชั่วโมง
                        </div>
                        <div className="overflow-y-auto max-h-48">
                          {hours24.map((hour) => (
                            <button
                              key={hour}
                              type="button"
                              onClick={() => handleTimeSelect(hour, tempStartTime.minute, true)}
                              className={`w-full px-3 py-2 text-sm text-center hover:bg-orange-50 transition-colors ${
                                tempStartTime.hour === hour ? 'bg-orange-100 font-semibold text-brand-primary' : ''
                              }`}
                            >
                              {hour}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="bg-brand-primary text-white text-center py-2 text-sm font-semibold">
                          นาที
                        </div>
                        <div className="overflow-y-auto max-h-48">
                          {minutes.map((minute) => (
                            <button
                              key={minute}
                              type="button"
                              onClick={() => handleTimeSelect(tempStartTime.hour, minute, true)}
                              className={`w-full px-3 py-2 text-sm text-center hover:bg-orange-50 transition-colors ${
                                tempStartTime.minute === minute ? 'bg-orange-100 font-semibold text-brand-primary' : ''
                              }`}
                            >
                              {minute}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="p-2 border-t border-gray-200 bg-gray-50">
                      <button
                        type="button"
                        onClick={() => confirmTimeSelection(true)}
                        className="w-full py-2 text-sm font-semibold text-white bg-brand-primary hover:bg-orange-600 rounded-lg transition-colors"
                      >
                        ตกลง
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                เวลาสิ้นสุด <span className="text-red-500">*</span>
              </label>
              <div className="relative" ref={timeEndPickerRef}>
                <input
                  type="text"
                  value={formData.endTime}
                  onFocus={() => {
                    setShowTimeEndPicker(true)
                    const [hour, minute] = formData.endTime.split(':')
                    setTempEndTime({ hour, minute })
                  }}
                  readOnly
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:border-brand-primary focus:outline-none transition-colors cursor-pointer"
                  placeholder="เช่น 17:00"
                />
                <button
                  type="button"
                  onClick={() => {
                    setShowTimeEndPicker(!showTimeEndPicker)
                    if (!showTimeEndPicker) {
                      const [hour, minute] = formData.endTime.split(':')
                      setTempEndTime({ hour, minute })
                    }
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-brand-primary transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <circle cx="12" cy="12" r="9" strokeWidth="1.5" />
                    <path d="M12 7v6l4 2" strokeWidth="1.5" />
                  </svg>
                </button>

                {showTimeEndPicker && (
                  <div className="absolute z-50 w-full mt-1 bg-white border-2 border-brand-primary rounded-lg shadow-2xl overflow-hidden">
                    <div className="flex">
                      <div className="flex-1 border-r border-gray-200">
                        <div className="bg-brand-primary text-white text-center py-2 text-sm font-semibold">
                          ชั่วโมง
                        </div>
                        <div className="overflow-y-auto max-h-48">
                          {hours24.map((hour) => (
                            <button
                              key={hour}
                              type="button"
                              onClick={() => handleTimeSelect(hour, tempEndTime.minute, false)}
                              className={`w-full px-3 py-2 text-sm text-center hover:bg-orange-50 transition-colors ${
                                tempEndTime.hour === hour ? 'bg-orange-100 font-semibold text-brand-primary' : ''
                              }`}
                            >
                              {hour}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="bg-brand-primary text-white text-center py-2 text-sm font-semibold">
                          นาที
                        </div>
                        <div className="overflow-y-auto max-h-48">
                          {minutes.map((minute) => (
                            <button
                              key={minute}
                              type="button"
                              onClick={() => handleTimeSelect(tempEndTime.hour, minute, false)}
                              className={`w-full px-3 py-2 text-sm text-center hover:bg-orange-50 transition-colors ${
                                tempEndTime.minute === minute ? 'bg-orange-100 font-semibold text-brand-primary' : ''
                              }`}
                            >
                              {minute}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="p-2 border-t border-gray-200 bg-gray-50">
                      <button
                        type="button"
                        onClick={() => confirmTimeSelection(false)}
                        className="w-full py-2 text-sm font-semibold text-white bg-brand-primary hover:bg-orange-600 rounded-lg transition-colors"
                      >
                        ตกลง
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Assignment Section */}
          <div className="space-y-4 pt-4 border-t-2 border-gray-200">
            <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">              
              กำหนดผู้รับผิดชอบ
            </h3>

            <MultiSelect
              label="เลือกพนักงานรายบุคคล"
              selected={formData.assignedUsers}
              onChange={(values) => setFormData({ ...formData, assignedUsers: values })}
              options={usersData.filter(u => u.role !== 'superadmin').map(u => ({
                value: u.id,
                label: u.name,
                secondary: `${u.department} - ${u.position}`
              }))}
              placeholder="เลือกพนักงาน..."
            />

            <MultiSelect
              label="เลือกตามแผนก"
              selected={formData.assignedDepartments}
              onChange={(values) => setFormData({ ...formData, assignedDepartments: values })}
              options={[...new Set(usersData.map(u => u.department))].filter(Boolean).map(dept => ({
                value: dept,
                label: dept
              }))}
              placeholder="เลือกแผนก..."
            />

            <MultiSelect
              label="เลือกตาม Position (ตำแหน่ง)"
              selected={formData.assignedPositions}
              onChange={(values) => setFormData({ ...formData, assignedPositions: values })}
              options={[...new Set(usersData.map(u => u.position))].filter(Boolean).map(pos => ({
                value: pos,
                label: pos
              }))}
              placeholder="เลือกตำแหน่ง..."
            />
          </div>
        </>
      )}

      {/* Action Buttons */}
      <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
        >
          ย้อนกลับ
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors text-white ${
            isSubmitting 
              ? 'bg-gray-400 cursor-not-allowed' 
              : type === 'location'
                ? 'bg-gray-600 hover:hover:bg-gray-700'
                : 'bg-brand-primary hover:bg-gray-700'
          }`}
        >
          {isSubmitting ? 'กำลังบันทึก...' : `สร้าง${type === 'location' ? 'พื้นที่' : 'กิจกรรม'}`}
        </button>
      </div>
    </form>
  )
}

// Edit Form Component - ฟอร์มแก้ไขพื้นที่/กิจกรรม
// item = ข้อมูลพื้นที่/กิจกรรมที่ต้องการแก้ไข
// โหลดข้อมูลเดิมมาแสดงในฟอร์ม แล้วส่งกลับเมื่อ submit
function EditForm({ type, item, onSubmit, onCancel, user, onShowError, isSubmitting }) {
  // โหลดข้อมูลเดิมมาแสดงในฟอร์ม
  const [formData, setFormData] = useState({
    name: item.name || '',
    description: item.description || '',
    radius: item.radius || 100,
    branchCode: item.branchCode || item.createdBy?.branch || user?.branchCode || '', // รองรับทั้ง branchCode และ createdBy.branch (backward compatible)
    locationName: item.locationName || '',
    startDate: item.startDate ? convertDDMMYYYYtoYYYYMMDD(item.startDate) : (item.date ? convertDDMMYYYYtoYYYYMMDD(item.date) : ''), // แปลงจาก dd/mm/yyyy
    endDate: item.endDate ? convertDDMMYYYYtoYYYYMMDD(item.endDate) : (item.date ? convertDDMMYYYYtoYYYYMMDD(item.date) : ''),
    startTime: item.startTime || '09:00',
    endTime: item.endTime || '17:00',
    status: item.status || 'ongoing', // ongoing = ดำเนินการ, completed = สิ้นสุด
    assignedUsers: item.assignedUsers || [],
    assignedRoles: item.assignedRoles || [],
    assignedDepartments: item.assignedDepartments || [],
    assignedPositions: item.assignedPositions || []
  })

  // State สำหรับ Custom Time Picker
  const [showTimeStartPicker, setShowTimeStartPicker] = useState(false)
  const [showTimeEndPicker, setShowTimeEndPicker] = useState(false)
  const [tempStartTime, setTempStartTime] = useState({ 
    hour: item.startTime?.split(':')[0] || '09', 
    minute: item.startTime?.split(':')[1] || '00' 
  })
  const [tempEndTime, setTempEndTime] = useState({ 
    hour: item.endTime?.split(':')[0] || '17', 
    minute: item.endTime?.split(':')[1] || '00' 
  })

  const formRef = useRef(null)
  const timeStartPickerRef = useRef(null)
  const timeEndPickerRef = useRef(null)

  // ปิด time picker เมื่อคลิกข้างนอก
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (timeStartPickerRef.current && !timeStartPickerRef.current.contains(event.target)) {
        setShowTimeStartPicker(false)
      }
      if (timeEndPickerRef.current && !timeEndPickerRef.current.contains(event.target)) {
        setShowTimeEndPicker(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Generate hours and minutes for time picker
  const hours24 = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'))
  const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'))

  // จัดการเลือกเวลา
  const handleTimeSelect = (hour, minute, isStart) => {
    if (isStart) {
      setTempStartTime({ hour, minute })
    } else {
      setTempEndTime({ hour, minute })
    }
  }

  // ยืนยันการเลือกเวลา
  const confirmTimeSelection = (isStart) => {
    if (isStart) {
      setFormData({ ...formData, startTime: `${tempStartTime.hour}:${tempStartTime.minute}` })
      setShowTimeStartPicker(false)
    } else {
      setFormData({ ...formData, endTime: `${tempEndTime.hour}:${tempEndTime.minute}` })
      setShowTimeEndPicker(false)
    }
  }

  useEffect(() => {
    const handleKeyDown = (e) => {
      // Only handle keys when modal is open and this is the active form
      if (!formRef.current) return
      
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onCancel()
        return
      }
      
      // Handle Enter key for form submission
      if (e.key === 'Enter' && !e.shiftKey) {
        const target = e.target
        const isTextarea = target.tagName === 'TEXTAREA'
        const isSelect = target.tagName === 'SELECT'
        const isButton = target.tagName === 'BUTTON'
        
        // Don't submit on Enter in textarea, select, or button
        if (isTextarea || isSelect || isButton) return
        
        e.preventDefault()
        e.stopPropagation()
        
        if (formRef.current && typeof formRef.current.requestSubmit === 'function') {
          formRef.current.requestSubmit()
        } else if (formRef.current) {
          // Fallback for browsers that don't support requestSubmit
          formRef.current.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }))
        }
      }
    }

    // Use capture phase to intercept before other handlers
    document.addEventListener('keydown', handleKeyDown, true)
    return () => {
      document.removeEventListener('keydown', handleKeyDown, true)
    }
  }, [onCancel])

  const handleSubmit = (e) => {
    e.preventDefault()
    e.stopPropagation()
    
    // ป้องกันการ submit ซ้ำใน form level
    if (isSubmitting) {
      return
    }
    
    if (!formData.name.trim()) {
      onShowError('กรุณากรอกชื่อ')
      return
    }
    if (type === 'event' && (!formData.startDate || !formData.endDate)) {
      onShowError('กรุณาเลือกวันที่เริ่มและวันที่สิ้นสุด')
      return
    }
    
    if (type === 'event') {
      // CustomDatePicker ส่งมาในรูปแบบ YYYY-MM-DD แล้ว
      const startDateObj = new Date(formData.startDate)
      const endDateObj = new Date(formData.endDate)
      
      if (startDateObj > endDateObj) {
        onShowError('วันที่เริ่มต้องไม่เกินวันที่สิ้นสุด')
        return
      }

      // Validate ผู้รับผิดชอบ - ต้องมีอย่างน้อย 1 เกณฑ์
      const hasAssignment = 
        formData.assignedUsers.length > 0 ||
        formData.assignedRoles.length > 0 ||
        formData.assignedDepartments.length > 0 ||
        formData.assignedPositions.length > 0

      if (!hasAssignment) {
        onShowError('กรุณากำหนดผู้รับผิดชอบอย่างน้อย 1 เกณฑ์\n(เลือกพนักงาน, Role, แผนก หรือตำแหน่ง)')
        return
      }
    }
    
    // แปลงวันที่จาก yyyy-mm-dd เป็น dd/mm/yyyy ก่อนส่ง
    const dataToSubmit = {
      ...formData,
      startDate: formData.startDate ? convertYYYYMMDDtoDDMMYYYY(formData.startDate) : '',
      endDate: formData.endDate ? convertYYYYMMDDtoDDMMYYYY(formData.endDate) : ''
    }
    
    onSubmit(dataToSubmit)
  }

  return (
    <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          ชื่อ{type === 'location' ? 'พื้นที่' : 'กิจกรรม'} <span className="text-red-500">*</span>
        </label>
        <input
          type="text"
          value={formData.name}
          onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:border-brand-primary focus:outline-none transition-colors"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          คำอธิบาย
        </label>
        <textarea
          value={formData.description}
          onChange={(e) => setFormData({ ...formData, description: e.target.value })}
          className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:border-brand-primary focus:outline-none transition-colors resize-none"
          rows="3"
        />
      </div>

      {/* 🆕 Branch Code - แสดงเฉพาะ SuperAdmin */}
      {user?.role === 'superadmin' && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            สาขา <span className="text-red-500">*</span>
          </label>
          <select
            value={formData.branchCode || ''}
            onChange={(e) => setFormData({ ...formData, branchCode: e.target.value })}
            className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:border-brand-primary focus:outline-none transition-colors cursor-pointer"
            required
          >
            <option value="">เลือกสาขา</option>
            <option value="101">BKK-101 (กรุงเทพมหานคร)</option>
            <option value="201">CNX-201 (เชียงใหม่)</option>
            <option value="301">PKT-301 (ภูเก็ต)</option>
          </select>
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          รัศมี (เมตร) <span className="text-red-500">*</span>
        </label>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min="50"
            max="1000"
            step="10"
            value={formData.radius}
            onChange={(e) => setFormData({ ...formData, radius: parseInt(e.target.value) })}
            className="flex-1"
          />
          <input
            type="number"
            min="50"
            max="1000"
            value={formData.radius}
            onChange={(e) => setFormData({ ...formData, radius: parseInt(e.target.value) || 100 })}
            className="w-24 px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-brand-primary focus:outline-none text-center font-medium"
          />
        </div>
      </div>

      {type === 'event' && (
        <>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              ชื่อสถานที่
            </label>
            <input
              type="text"
              value={formData.locationName}
              onChange={(e) => setFormData({ ...formData, locationName: e.target.value })}
              className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:border-brand-primary focus:outline-none transition-colors"
            />
          </div>

          <CustomDatePicker
            label="วันที่เริ่มกิจกรรม"
            value={formData.startDate}
            onChange={(value) => setFormData({ ...formData, startDate: value })}
            required={true}
          />

          <CustomDatePicker
            label="วันที่สิ้นสุดกิจกรรม"
            value={formData.endDate}
            onChange={(value) => setFormData({ ...formData, endDate: value })}
            minDate={formData.startDate}
            required={true}
          />

          {/* Time Selection */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                เวลาเริ่ม <span className="text-red-500">*</span>
              </label>
              <div className="relative" ref={timeStartPickerRef}>
                <input
                  type="text"
                  value={formData.startTime}
                  onFocus={() => {
                    setShowTimeStartPicker(true)
                    const [hour, minute] = formData.startTime.split(':')
                    setTempStartTime({ hour, minute })
                  }}
                  readOnly
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:border-brand-primary focus:outline-none transition-colors cursor-pointer"
                  placeholder="เช่น 09:00"
                />
                <button
                  type="button"
                  onClick={() => {
                    setShowTimeStartPicker(!showTimeStartPicker)
                    if (!showTimeStartPicker) {
                      const [hour, minute] = formData.startTime.split(':')
                      setTempStartTime({ hour, minute })
                    }
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-brand-primary transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <circle cx="12" cy="12" r="9" strokeWidth="1.5" />
                    <path d="M12 7v6l4 2" strokeWidth="1.5" />
                  </svg>
                </button>

                {showTimeStartPicker && (
                  <div className="absolute z-50 w-full mt-1 bg-white border-2 border-brand-primary rounded-lg shadow-2xl overflow-hidden">
                    <div className="flex">
                      <div className="flex-1 border-r border-gray-200">
                        <div className="bg-brand-primary text-white text-center py-2 text-sm font-semibold">
                          ชั่วโมง
                        </div>
                        <div className="overflow-y-auto max-h-48">
                          {hours24.map((hour) => (
                            <button
                              key={hour}
                              type="button"
                              onClick={() => handleTimeSelect(hour, tempStartTime.minute, true)}
                              className={`w-full px-3 py-2 text-sm text-center hover:bg-orange-50 transition-colors ${
                                tempStartTime.hour === hour ? 'bg-orange-100 font-semibold text-brand-primary' : ''
                              }`}
                            >
                              {hour}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="bg-brand-primary text-white text-center py-2 text-sm font-semibold">
                          นาที
                        </div>
                        <div className="overflow-y-auto max-h-48">
                          {minutes.map((minute) => (
                            <button
                              key={minute}
                              type="button"
                              onClick={() => handleTimeSelect(tempStartTime.hour, minute, true)}
                              className={`w-full px-3 py-2 text-sm text-center hover:bg-orange-50 transition-colors ${
                                tempStartTime.minute === minute ? 'bg-orange-100 font-semibold text-brand-primary' : ''
                              }`}
                            >
                              {minute}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="p-2 border-t border-gray-200 bg-gray-50">
                      <button
                        type="button"
                        onClick={() => confirmTimeSelection(true)}
                        className="w-full py-2 text-sm font-semibold text-white bg-brand-primary hover:bg-orange-600 rounded-lg transition-colors"
                      >
                        ตกลง
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
            
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                เวลาสิ้นสุด <span className="text-red-500">*</span>
              </label>
              <div className="relative" ref={timeEndPickerRef}>
                <input
                  type="text"
                  value={formData.endTime}
                  onFocus={() => {
                    setShowTimeEndPicker(true)
                    const [hour, minute] = formData.endTime.split(':')
                    setTempEndTime({ hour, minute })
                  }}
                  readOnly
                  className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:border-brand-primary focus:outline-none transition-colors cursor-pointer"
                  placeholder="เช่น 17:00"
                />
                <button
                  type="button"
                  onClick={() => {
                    setShowTimeEndPicker(!showTimeEndPicker)
                    if (!showTimeEndPicker) {
                      const [hour, minute] = formData.endTime.split(':')
                      setTempEndTime({ hour, minute })
                    }
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-brand-primary transition-colors"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor">
                    <circle cx="12" cy="12" r="9" strokeWidth="1.5" />
                    <path d="M12 7v6l4 2" strokeWidth="1.5" />
                  </svg>
                </button>

                {showTimeEndPicker && (
                  <div className="absolute z-50 w-full mt-1 bg-white border-2 border-brand-primary rounded-lg shadow-2xl overflow-hidden">
                    <div className="flex">
                      <div className="flex-1 border-r border-gray-200">
                        <div className="bg-brand-primary text-white text-center py-2 text-sm font-semibold">
                          ชั่วโมง
                        </div>
                        <div className="overflow-y-auto max-h-48">
                          {hours24.map((hour) => (
                            <button
                              key={hour}
                              type="button"
                              onClick={() => handleTimeSelect(hour, tempEndTime.minute, false)}
                              className={`w-full px-3 py-2 text-sm text-center hover:bg-orange-50 transition-colors ${
                                tempEndTime.hour === hour ? 'bg-orange-100 font-semibold text-brand-primary' : ''
                              }`}
                            >
                              {hour}
                            </button>
                          ))}
                        </div>
                      </div>
                      <div className="flex-1">
                        <div className="bg-brand-primary text-white text-center py-2 text-sm font-semibold">
                          นาที
                        </div>
                        <div className="overflow-y-auto max-h-48">
                          {minutes.map((minute) => (
                            <button
                              key={minute}
                              type="button"
                              onClick={() => handleTimeSelect(tempEndTime.hour, minute, false)}
                              className={`w-full px-3 py-2 text-sm text-center hover:bg-orange-50 transition-colors ${
                                tempEndTime.minute === minute ? 'bg-orange-100 font-semibold text-brand-primary' : ''
                              }`}
                            >
                              {minute}
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                    <div className="p-2 border-t border-gray-200 bg-gray-50">
                      <button
                        type="button"
                        onClick={() => confirmTimeSelection(false)}
                        className="w-full py-2 text-sm font-semibold text-white bg-brand-primary hover:bg-orange-600 rounded-lg transition-colors"
                      >
                        ตกลง
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Status Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              สถานะกิจกรรม <span className="text-red-500">*</span>
            </label>
            <select
              value={formData.status}
              onChange={(e) => setFormData({ ...formData, status: e.target.value })}
              className="w-full px-4 py-2.5 border-2 border-gray-200 rounded-lg focus:border-brand-primary focus:outline-none transition-colors"
              required
            >
              <option value="ongoing">● ดำเนินการ</option>
              <option value="completed">○ สิ้นสุด</option>
            </select>
          </div>

          {/* Assignment Section - Edit Mode */}
          <div className="space-y-4 pt-4 border-t-2 border-gray-200">
            <h3 className="text-base font-bold text-gray-800 flex items-center gap-2">
              กำหนดผู้รับผิดชอบ
            </h3>

            <MultiSelect
              label="เลือกพนักงาน"
              selected={formData.assignedUsers}
              onChange={(values) => setFormData({ ...formData, assignedUsers: values })}
              options={usersData.filter(u => u.role !== 'superadmin').map(u => ({
                value: u.id,
                label: u.name,
                secondary: `${u.department} - ${u.position}`
              }))}
              placeholder="เลือกพนักงาน..."
            />

            <MultiSelect
              label="เลือกตามแผนก"
              selected={formData.assignedDepartments}
              onChange={(values) => setFormData({ ...formData, assignedDepartments: values })}
              options={[...new Set(usersData.map(u => u.department))].filter(Boolean).map(dept => ({
                value: dept,
                label: dept
              }))}
              placeholder="เลือกแผนก..."
            />

            <MultiSelect
              label="เลือกตามตำแหน่ง"
              selected={formData.assignedPositions}
              onChange={(values) => setFormData({ ...formData, assignedPositions: values })}
              options={[...new Set(usersData.map(u => u.position))].filter(Boolean).map(pos => ({
                value: pos,
                label: pos
              }))}
              placeholder="เลือกตำแหน่ง..."
            />          
          </div>
        </>
      )}

      <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
        >
          ยกเลิก
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className={`flex-1 px-4 py-2.5 rounded-lg font-medium transition-colors text-white ${
            isSubmitting 
              ? 'bg-gray-400 cursor-not-allowed' 
              : type === 'location'
                ? 'bg-gray-600 hover:hover:bg-gray-700'
                : 'bg-brand-primary hover:bg-gray-700'
          }`}
        >
          {isSubmitting ? 'กำลังบันทึก...' : 'บันทึก'}
        </button>
      </div>
    </form>
  )
}

// Main Component - หน้าจัดการพื้นที่และกิจกรรม
function MappingAndEvents() {
  // ดึงข้อมูล user และ functions จาก Context
  const { user } = useAuth() // ข้อมูล user (role, branchCode)
  const { getFilteredLocations, getAllLocations, deleteLocation, addLocation, updateLocation } = useLocations()
  const { getFilteredEvents, getAllEvents, deleteEvent, addEvent, updateEvent } = useEvents()
  
  // ✅ ใช้ฟังก์ชันกรองตาม branch สำหรับแสดงผล
  // SuperAdmin เห็นทั้งหมด, Admin/Manager เห็นเฉพาะสาขาของตัวเอง
  const locations = getFilteredLocations(user)
  const events = getFilteredEvents(user)
  
  // ✅ ใช้ข้อมูลทั้งหมด (unfiltered) สำหรับคำนวณ ID ใหม่
  // เพื่อป้องกัน ID ซ้ำข้ามสาขา
  const allLocations = getAllLocations()
  const allEvents = getAllEvents()
  
  // === State สำหรับ UI ===
  const [activeTab, setActiveTab] = useState('all') // แท็บที่เลือก: 'all', 'locations', 'events'
  const [mapType, setMapType] = useState('default') // ประเภทแผนที่: 'default' (road), 'satellite'
  const [searchQuery, setSearchQuery] = useState('') // คำค้นหาในรายการด้านข้าง
  const [mapSearchQuery, setMapSearchQuery] = useState('') // คำค้นหาตำแหน่งบนแผนที่
  const [mapSearchResults, setMapSearchResults] = useState([]) // ผลการค้นหาตำแหน่ง
  const [isSearchingMap, setIsSearchingMap] = useState(false) // สถานะกำลังค้นหา
  const [searchMarkerPosition, setSearchMarkerPosition] = useState(null) // ตำแหน่งหมุดชั่วคราว (สีแดง)
  const [searchMarkerName, setSearchMarkerName] = useState('') // ชื่อตำแหน่งที่ค้นหา
  const [openIds, setOpenIds] = useState([]) // ID ของรายการที่เปิดรายละเอียด
  const [showCreateModal, setShowCreateModal] = useState(false) // แสดง Modal สร้างพื้นที่/กิจกรรม
  const [createType, setCreateType] = useState(null) // ประเภทที่จะสร้าง: 'location' หรือ 'event'
  const [newMarkerPosition, setNewMarkerPosition] = useState(null) // ตำแหน่งสำหรับสร้างพื้นที่/กิจกรรมใหม่
  const [isFlying, setIsFlying] = useState(false) // สถานะแผนที่กำลังบิน (ป้องกันการ fitBounds ขณะบิน)
  
  // === Refs สำหรับ Animation และ DOM ===
  const wrapperRefs = useRef({}) // ref ของ wrapper สำหรับ expand/collapse animation
  const innerRefs = useRef({}) // ref ของ inner content
  const endListenersRef = useRef({}) // listeners สำหรับ transitionend event
  const mapSearchTimeoutRef = useRef(null) // timeout สำหรับ debounce การค้นหาแผนที่
  const markerRefs = useRef({}) // ref ของ marker แต่ละตัวบนแผนที่
  
  // === State สำหรับ Modal ===
  const [showEditModal, setShowEditModal] = useState(false) // แสดง Modal แก้ไข
  const [editItem, setEditItem] = useState(null) // ข้อมูลรายการที่จะแก้ไข
  const [showHelpModal, setShowHelpModal] = useState(false) // แสดง Modal วิธีใช้
  const [showDetailModal, setShowDetailModal] = useState(false) // แสดง Modal รายละเอียด
  const [detailItem, setDetailItem] = useState(null) // ข้อมูลรายการที่จะแสดงรายละเอียด
  
  // === State สำหรับการ Fly ไปยังตำแหน่ง ===
  const [flyToPosition, setFlyToPosition] = useState(null) // ตำแหน่งที่จะบินไป
  const [selectedMarkerId, setSelectedMarkerId] = useState(null) // ID ของ marker ที่เลือก (เพื่อเปิด popup)

  // === Dialog States ===
  const [successDialog, setSuccessDialog] = useState({ isOpen: false, message: '' }) // Dialog แสดงความสำเร็จ
  const [errorDialog, setErrorDialog] = useState({ isOpen: false, message: '' }) // Dialog แสดงข้อผิดพลาด
  const [confirmDialog, setConfirmDialog] = useState({ // Dialog ยืนยันการดำเนินการ
    isOpen: false,
    title: '',
    message: '',
    onConfirm: () => { }
  })
  
  // === State ป้องกันการ Submit ซ้ำ ===
  const [isSubmitting, setIsSubmitting] = useState(false) // ป้องกันกดปุ่มสร้าง/แก้ไข ซ้ำก่อนเสร็จ

  const defaultCenter = [13.7606, 100.5034]

  // Auto-open popup when selectedMarkerId changes
  useEffect(() => {
    if (selectedMarkerId && markerRefs.current[selectedMarkerId]) {
      markerRefs.current[selectedMarkerId].openPopup();
      // Reset selection after opening
      const timer = setTimeout(() => setSelectedMarkerId(null), 500);
      return () => clearTimeout(timer);
    }
  }, [selectedMarkerId]);

  // Initialize refs for animations
  useEffect(() => {
    Object.values(wrapperRefs.current).forEach(w => {
      if (!w) return
      w.style.overflow = 'hidden'
      w.style.maxHeight = '0px'
      w.style.opacity = '0'
      w.style.transition = 'max-height 280ms cubic-bezier(.2,.8,.2,1), opacity 200ms ease'
      w.style.willChange = 'max-height, opacity'
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

  // Filter items based on search query
  const filteredLocations = locations.filter(location =>
    location.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    location.description?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const filteredEvents = events.filter(event =>
    event.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    event.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    event.locationName?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  // Combined items for display
  const getFilteredItems = () => {
    if (activeTab === 'locations') return filteredLocations.map(loc => ({ ...loc, type: 'location' }))
    if (activeTab === 'events') return filteredEvents.map(evt => ({ ...evt, type: 'event' }))
    return [
      ...filteredLocations.map(loc => ({ ...loc, type: 'location' })),
      ...filteredEvents.map(evt => ({ ...evt, type: 'event' }))
    ]
  }

  const filteredItems = getFilteredItems()

  // Filter markers for map display based on activeTab
  const getMapLocations = () => {
    if (activeTab === 'events') return [] // Hide location markers when viewing events only
    return filteredLocations
  }

  const getMapEvents = () => {
    if (activeTab === 'locations') return [] // Hide event markers when viewing locations only
    return filteredEvents
  }

  const mapLocations = getMapLocations()
  const mapEvents = getMapEvents()

  // Helper function to translate location display name to Thai-friendly format
  const formatLocationName = (result) => {
    const parts = result.display_name.split(',').map(s => s.trim())
    
    // Try to extract meaningful parts
    const addressParts = []
    
    // Get the main location name (usually first part)
    if (parts[0]) addressParts.push(parts[0])
    
    // Look for district/subdistrict (usually contains ตำบล, อำเภอ, เขต)
    const districtPart = parts.find(p => 
      p.includes('ตำบล') || p.includes('อำเภอ') || p.includes('เขต') || 
      p.includes('District') || p.includes('Sub-district')
    )
    if (districtPart) addressParts.push(districtPart)
    
    // Look for province (usually contains จังหวัด or ends with Province)
    const provincePart = parts.find(p => 
      p.includes('จังหวัด') || p.includes('Province') || p.includes('Bangkok')
    )
    if (provincePart && !addressParts.includes(provincePart)) {
      addressParts.push(provincePart)
    }
    
    // If we have less than 2 parts, add the second part from original
    if (addressParts.length < 2 && parts.length > 1 && !addressParts.includes(parts[1])) {
      addressParts.push(parts[1])
    }
    
    return addressParts.join(', ')
  }

  // Search map locations using Nominatim API + existing markers
  const searchMapLocation = async (query) => {
    if (!query.trim()) {
      setMapSearchResults([])
      return
    }

    setIsSearchingMap(true)
    try {
      // Search existing markers (locations and events)
      const queryLower = query.toLowerCase()
      const existingMarkers = []
      
      // Search locations
      locations.forEach(loc => {
        if (loc.name.toLowerCase().includes(queryLower) || 
            loc.description?.toLowerCase().includes(queryLower)) {
          existingMarkers.push({
            type: 'existing',
            markerType: 'location',
            id: loc.id,
            name: loc.name,
            description: loc.description,
            lat: loc.latitude,
            lon: loc.longitude,
            radius: loc.radius
          })
        }
      })
      
      // Search events
      events.forEach(evt => {
        if (evt.name.toLowerCase().includes(queryLower) || 
            evt.description?.toLowerCase().includes(queryLower) ||
            evt.locationName?.toLowerCase().includes(queryLower)) {
          existingMarkers.push({
            type: 'existing',
            markerType: 'event',
            id: evt.id,
            name: evt.name,
            description: evt.description,
            locationName: evt.locationName,
            lat: evt.latitude,
            lon: evt.longitude,
            radius: evt.radius,
            date: evt.date || evt.startDate,
            time: evt.time || evt.startTime
          })
        }
      })
      
      // Search new locations from Nominatim API
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=5&countrycodes=th&accept-language=th`
      )
      const data = await response.json()
      
      // Combine results: existing markers first, then new locations
      const apiResults = data.map(result => ({
        ...result,
        type: 'new',
        formatted_name: formatLocationName(result)
      }))
      
      setMapSearchResults([...existingMarkers, ...apiResults])
    } catch (error) {
      console.error('Error searching map:', error)
      setMapSearchResults([])
    } finally {
      setIsSearchingMap(false)
    }
  }

  // Debounced map search
  useEffect(() => {
    if (mapSearchTimeoutRef.current) {
      clearTimeout(mapSearchTimeoutRef.current)
    }

    mapSearchTimeoutRef.current = setTimeout(() => {
      searchMapLocation(mapSearchQuery)
    }, 500)

    return () => {
      if (mapSearchTimeoutRef.current) {
        clearTimeout(mapSearchTimeoutRef.current)
      }
    }
  }, [mapSearchQuery])

  // Get tile layer URL based on map type
  const getTileLayerUrl = () => {
    if (mapType === 'satellite') {
      return 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
    }
    return 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png'
  }

  const getTileLayerAttribution = () => {
    if (mapType === 'satellite') {
      return '&copy; <a href="https://www.esri.com/">Esri</a>'
    }
    return '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
  }

  // Toggle details animation
  const toggleDetails = (id) => {
    const wrapper = wrapperRefs.current[id]
    const inner = innerRefs.current[id]
    const isOpen = openIds.includes(id)

    if (!wrapper || !inner) {
      if (!isOpen) {
        setOpenIds([id])
      } else {
        setOpenIds([])
      }
      return
    }

    if (!isOpen) {
      // Close all other open items
      openIds.forEach(openId => {
        if (openId !== id) {
          const otherWrapper = wrapperRefs.current[openId]
          const otherInner = innerRefs.current[openId]
          
          if (otherWrapper && otherInner) {
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
        endListenersRef.current[id] = onEnd
        wrapper.addEventListener('transitionend', onEnd)
      })
    } else {
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

  // Handle delete
  const handleDelete = async (id, type) => {
    setConfirmDialog({
      isOpen: true,
      title: 'ยืนยันการลบ',
      message: `คุณต้องการลบ${type === 'location' ? 'พื้นที่' : 'กิจกรรม'}นี้ใช่หรือไม่?`,
      onConfirm: async () => {
        try {
          if (type === 'location') {
            await deleteLocation(id)
          } else {
            await deleteEvent(id)
          }
          // Close the detail if it was open
          setOpenIds(prev => prev.filter(openId => openId !== id))
          setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => {} })
          setSuccessDialog({
            isOpen: true,
            message: `ลบ${type === 'location' ? 'พื้นที่' : 'กิจกรรม'}สำเร็จ!`
          })
        } catch (error) {
          console.error('Error deleting:', error)
          setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => {} })
          setErrorDialog({
            isOpen: true,
            message: 'เกิดข้อผิดพลาดในการลบ กรุณาลองใหม่อีกครั้ง'
          })
        }
      },
      onCancel: () => {
        setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => {} })
      }
    })
  }

  // Handle map click to create new marker
  const handleMapClick = (e) => {
    const { lat, lng } = e.latlng
    setNewMarkerPosition([lat, lng])
    setSearchMarkerPosition([lat, lng])
    setSearchMarkerName('ตำแหน่งใหม่')
    // Don't open modal immediately, wait for user to click the create button in popup
    // The FlyToLocation component will handle opening the popup automatically
  }

  // Handle search marker click to open create modal
  const handleSearchMarkerClick = () => {
    if (searchMarkerPosition) {
      setNewMarkerPosition(searchMarkerPosition)
      setShowCreateModal(true)
      setCreateType(null) // Reset to show type selection
    }
  }

  // Handle create location/event
  const handleCreate = async (formData) => {
    // ป้องกันการ submit ซ้ำ
    if (isSubmitting) {
      return
    }
    
    setIsSubmitting(true)
    
    try {
      if (createType === 'location') {
        // Check duplicate name for locations - ใช้ allLocations เพื่อเช็คชื่อซ้ำกับข้อมูลทั้งหมด
        const isDuplicate = allLocations.some(loc => 
          loc.name.toLowerCase().trim() === formData.name.toLowerCase().trim()
        )
        if (isDuplicate) {
          setErrorDialog({
            isOpen: true,
            message: 'มีพื้นที่ชื่อนี้อยู่แล้ว กรุณาใช้ชื่ออื่น'
          })
          setIsSubmitting(false) // Reset flag เมื่อเจอ error
          return
        }

        // ใช้ allLocations เพื่อคำนวณ ID ที่ไม่ซ้ำ (ไม่ใช่ filtered locations)
        const newId = allLocations.length > 0 ? Math.max(...allLocations.map(l => l.id)) + 1 : 1
        
        addLocation({
          id: newId,
          ...formData,
          latitude: newMarkerPosition[0],
          longitude: newMarkerPosition[1],
          status: 'active',
          branchCode: formData.branchCode || user.branchCode, // 🆕 เพิ่ม branchCode
          // ✅ เพิ่มข้อมูลผู้สร้างและสาขา
          createdBy: {
            userId: user.id,
            username: user.username,
            branch: formData.branchCode || user.branchCode
          }
        })
      } else if (createType === 'event') {
        // Check duplicate name for events - ใช้ allEvents เพื่อเช็คชื่อซ้ำกับข้อมูลทั้งหมด
        const isDuplicate = allEvents.some(evt => 
          evt.name.toLowerCase().trim() === formData.name.toLowerCase().trim()
        )
        if (isDuplicate) {
          setErrorDialog({
            isOpen: true,
            message: 'มีกิจกรรมชื่อนี้อยู่แล้ว กรุณาใช้ชื่ออื่น'
          })
          setIsSubmitting(false) // Reset flag เมื่อเจอ error
          return
        }

        // ใช้ allEvents เพื่อคำนวณ ID ที่ไม่ซ้ำ (ไม่ใช่ filtered events)
        const newId = allEvents.length > 0 ? Math.max(...allEvents.map(e => e.id)) + 1 : 1

        let formattedStartDate = formData.startDate
        let formattedEndDate = formData.endDate
        
        if (!formData.startDate.includes('/')) {
          // แปลงจาก YYYY-MM-DD เป็น DD/MM/YYYY
          const [y1, m1, d1] = formData.startDate.split('-')
          formattedStartDate = `${d1}/${m1}/${y1}`
        }
        
        if (!formData.endDate.includes('/')) {
          // แปลงจาก YYYY-MM-DD เป็น DD/MM/YYYY
          const [y2, m2, d2] = formData.endDate.split('-')
          formattedEndDate = `${d2}/${m2}/${y2}`
        }
        
        // Auto-check status based on current date
        const autoStatus = checkEventStatus(formattedStartDate, formattedEndDate, formData.startTime, formData.endTime)
        
        addEvent({
          id: newId,
          ...formData,
          startDate: formattedStartDate,
          endDate: formattedEndDate,
          date: formattedStartDate, // Keep for compatibility
          latitude: newMarkerPosition[0],
          longitude: newMarkerPosition[1],
          status: autoStatus,
          teams: [],
          assignedUsers: formData.assignedUsers || [],
          assignedRoles: formData.assignedRoles || [],
          assignedDepartments: formData.assignedDepartments || [],
          assignedPositions: formData.assignedPositions || [],
          branchCode: formData.branchCode || user.branchCode, // 🆕 เพิ่ม branchCode
          // ✅ เพิ่มข้อมูลผู้สร้างและสาขา
          createdBy: {
            userId: user.id,
            username: user.username,
            branch: formData.branchCode || user.branchCode
          }
        })
      }
      setShowCreateModal(false)
      setCreateType(null)
      setNewMarkerPosition(null)
      setSearchMarkerPosition(null)
      setSearchMarkerName('')
      setSuccessDialog({
        isOpen: true,
        message: `สร้าง${createType === 'location' ? 'พื้นที่' : 'กิจกรรม'}สำเร็จ!`
      })
    } catch (error) {
      console.error('Error creating:', error)
      setErrorDialog({
        isOpen: true,
        message: 'เกิดข้อผิดพลาดในการสร้าง กรุณาลองใหม่อีกครั้ง'
      })
    } finally {
      // Reset flag หลังจากทำเสร็จ (ไม่ว่าจะสำเร็จหรือไม่)
      setTimeout(() => setIsSubmitting(false), 500)
    }
  }

  // Helper function to check event status based on date/time
  const checkEventStatus = (startDateStr, endDateStr, startTime, endTime) => {
    try {
      const now = new Date()
      
      // Parse DD/MM/YYYY format
      const [startDay, startMonth, startYear] = startDateStr.split('/')
      const [endDay, endMonth, endYear] = endDateStr.split('/')
      
      // Create date objects with times
      const startDateTime = new Date(`${startYear}-${startMonth}-${startDay}T${startTime}:00`)
      const endDateTime = new Date(`${endYear}-${endMonth}-${endDay}T${endTime}:00`)
      
      if (now < startDateTime) {
        return 'upcoming' // ยังไม่เริ่ม
      } else if (now > endDateTime) {
        return 'completed' // สิ้นสุดแล้ว
      } else {
        return 'ongoing' // กำลังดำเนินการ
      }
    } catch (error) {
      console.error('Error checking event status:', error)
      return 'ongoing' // default
    }
  }

  // Handle edit location/event
  const handleEdit = async (formData) => {
    // ป้องกันการ submit ซ้ำ
    if (isSubmitting) {
      return
    }
    
    setIsSubmitting(true)
    
    try {
      if (editItem.type === 'location') {
        // Check duplicate name for locations (exclude current item) - ใช้ allLocations
        const isDuplicate = allLocations.some(loc => 
          loc.id !== editItem.id && 
          loc.name.toLowerCase().trim() === formData.name.toLowerCase().trim()
        )
        if (isDuplicate) {
          setErrorDialog({
            isOpen: true,
            message: 'มีพื้นท้ี่ชื่อนี้อยู่แล้ว กรุณาใช้ชื่ออื่น'
          })
          setIsSubmitting(false) // Reset flag
          return
        }

        updateLocation(editItem.id, {
          ...editItem,
          ...formData,
          createdBy: {
            ...editItem.createdBy,
            branch: formData.branchCode || editItem.createdBy?.branch
          }
        })
      } else if (editItem.type === 'event') {
        // Check duplicate name for events (exclude current item) - ใช้ allEvents
        const isDuplicate = allEvents.some(evt => 
          evt.id !== editItem.id && 
          evt.name.toLowerCase().trim() === formData.name.toLowerCase().trim()
        )
        if (isDuplicate) {
          setErrorDialog({
            isOpen: true,
            message: 'มีกิจกรรมชื่อนี้อยู่แล้ว กรุณาใช้ชื่ออื่น'
          })
          setIsSubmitting(false) // Reset flag
          return
        }

        // Validate ผู้รับผิดชอบ - ต้องมีอย่างน้อย 1 เกณฑ์
        const hasAssignment = 
          formData.assignedUsers.length > 0 ||
          formData.assignedRoles.length > 0 ||
          formData.assignedDepartments.length > 0 ||
          formData.assignedPositions.length > 0

        if (!hasAssignment) {
          setErrorDialog({
            isOpen: true,
            message: 'กรุณากำหนดผู้รับผิดชอบอย่างน้อย 1 เกณฑ์\n(เลือกพนักงาน, Role, แผนก หรือตำแหน่ง)'
          })
          return
        }

        let formattedStartDate = formData.startDate
        let formattedEndDate = formData.endDate
        
        if (!formData.startDate.includes('/')) {
          const [y1, m1, d1] = formData.startDate.split('-')
          formattedStartDate = `${d1}/${m1}/${y1}`
        }
        
        if (!formData.endDate.includes('/')) {
          const [y2, m2, d2] = formData.endDate.split('-')
          formattedEndDate = `${d2}/${m2}/${y2}`
        }
        
        updateEvent(editItem.id, {
          ...editItem,
          ...formData,
          status: formData.status,
          assignedUsers: formData.assignedUsers || [],
          assignedRoles: formData.assignedRoles || [],
          assignedDepartments: formData.assignedDepartments || [],
          assignedPositions: formData.assignedPositions || [],
          startDate: formattedStartDate,
          endDate: formattedEndDate,
          date: formattedStartDate,
          createdBy: {
            ...editItem.createdBy,
            branch: formData.branchCode || editItem.createdBy?.branch
          }
        })
      }
      setShowEditModal(false)
      setEditItem(null)
      setSuccessDialog({
        isOpen: true,
        message: `แก้ไข${editItem.type === 'location' ? 'พื้นที่' : 'กิจกรรม'}สำเร็จ!`
      })
    } catch (error) {
      console.error('Error updating:', error)
      setErrorDialog({
        isOpen: true,
        message: 'เกิดข้อผิดพลาดในการแก้ไข กรุณาลองใหม่อีกครั้ง'
      })
    } finally {
      // Reset flag หลังจากทำเสร็จ
      setTimeout(() => setIsSubmitting(false), 500)
    }
  }

  return (
    <div className="min-h-screen bg-[#FAFBFC]">
      {/* Detail Modal */}
      {showDetailModal && detailItem && (
        <div className="fixed inset-0 bg-black/50 z-[2000] flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-sm max-w-3xl w-full my-8">
            <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                {detailItem.type === 'location' ? (
                  <>
                    <div className="w-3 h-3 rounded-full bg-gray-600"></div>
                    รายละเอียดพื้นที่อนุญาต
                  </>
                ) : (
                  <>
                    <div className="w-3 h-3 rounded-full bg-brand-primary"></div>
                    รายละเอียดกิจกรรม
                  </>
                )}
              </h2>
              <button
                onClick={() => {
                  setShowDetailModal(false)
                  setDetailItem(null)
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-6 max-h-[calc(90vh-80px)] overflow-y-auto">
              {/* Basic Info */}
              <div className="bg-gray-50 rounded-xl p-5 border-2 border-gray-100">
                <h3 className="font-bold text-lg text-gray-800 mb-4 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  ข้อมูลพื้นฐาน
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">ชื่อ{detailItem.type === 'location' ? 'พื้นที่' : 'กิจกรรม'}</p>
                    <p className="font-semibold text-gray-800">{detailItem.name}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">สถานะ</p>
                    <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${
                      detailItem.status === 'active' || detailItem.status === 'ongoing'
                        ? detailItem.type === 'location'
                          ? 'bg-green-100 text-green-700'
                          : 'bg-orange-100 text-orange-700'
                        : detailItem.status === 'upcoming'
                        ? 'bg-orange-50 text-orange-700'
                        : 'bg-red-100 text-red-700'
                    }`}>
                      {detailItem.type === 'location' 
                        ? (detailItem.status === 'active' ? '✓ ใช้งาน' : '✕ ปิด')
                        : detailItem.status === 'ongoing' 
                        ? '● ดำเนินการ' 
                        : detailItem.status === 'upcoming'
                        ? '◷ ยังไม่เริ่ม'
                        : '○ สิ้นสุด'
                      }
                    </span>
                  </div>
                  <div className="col-span-2">
                    <p className="text-sm text-gray-500 mb-1">คำอธิบาย</p>
                    <p className="text-gray-700">{detailItem.description || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">รัศมี</p>
                    <p className="font-semibold text-gray-800">{detailItem.radius} เมตร</p>
                  </div>
                  {detailItem.type === 'event' && detailItem.locationName && (
                    <div>
                      <p className="text-sm text-gray-500 mb-1">ชื่อสถานที่</p>
                      <p className="font-semibold text-gray-800">{detailItem.locationName}</p>
                    </div>
                  )}
                </div>
              </div>

              {/* Date & Time Info (Events only) */}
              {detailItem.type === 'event' && (
                <div className="bg-orange-50 rounded-xl p-5 border-2 border-orange-100">
                  <h3 className="font-bold text-lg text-gray-800 mb-4 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    วันที่และเวลา
                  </h3>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500 mb-1">วันที่เริ่ม</p>
                      <p className="font-semibold text-gray-800">{detailItem.startDate || detailItem.date || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 mb-1">วันที่สิ้นสุด</p>
                      <p className="font-semibold text-gray-800">{detailItem.endDate || detailItem.date || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 mb-1">เวลาเริ่ม</p>
                      <p className="font-semibold text-gray-800">{detailItem.startTime || '-'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500 mb-1">เวลาสิ้นสุด</p>
                      <p className="font-semibold text-gray-800">{detailItem.endTime || '-'}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Location Info */}
              <div className="bg-green-50 rounded-xl p-5 border-2 border-green-100">
                <h3 className="font-bold text-lg text-gray-800 mb-4 flex items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-green-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  พิกัดที่ตั้ง
                </h3>
                <div className="space-y-2">
                  <div>
                    <p className="text-sm text-gray-500 mb-1">ละติจูด (Latitude)</p>
                    <p className="font-mono font-semibold text-gray-800">{detailItem.latitude?.toFixed(6) || '-'}</p>
                  </div>
                  <div>
                    <p className="text-sm text-gray-500 mb-1">ลองจิจูด (Longitude)</p>
                    <p className="font-mono font-semibold text-gray-800">{detailItem.longitude?.toFixed(6) || '-'}</p>
                  </div>
                </div>
              </div>

              {/* Assignment Info (Events only) */}
              {detailItem.type === 'event' && (
                <div className="bg-orange-50 rounded-xl p-5 border-2 border-orange-100">
                  <h3 className="font-bold text-lg text-gray-800 mb-4 flex items-center gap-2">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                    </svg>
                    ผู้รับผิดชอบ
                  </h3>
                  <div className="space-y-3">
                    {detailItem.assignedUsers && detailItem.assignedUsers.length > 0 && (
                      <div>
                        <p className="text-sm text-gray-500 mb-2">พนักงานที่ถูกมอบหมาย</p>
                        <div className="flex flex-wrap gap-2">
                          {detailItem.assignedUsers.map(userId => {
                            const user = usersData.find(u => u.id === userId)
                            return user ? (
                              <span key={userId} className="bg-orange-50 text-orange-700 px-3 py-1 rounded-full text-sm font-medium">
                                {user.name}
                              </span>
                            ) : null
                          })}
                        </div>
                      </div>
                    )}
                    {detailItem.assignedRoles && detailItem.assignedRoles.length > 0 && (
                      <div>
                        <p className="text-sm text-gray-500 mb-2">บทบาทที่ถูกมอบหมาย</p>
                        <div className="flex flex-wrap gap-2">
                          {detailItem.assignedRoles.map(role => (
                            <span key={role} className="bg-orange-100 text-orange-700 px-3 py-1 rounded-full text-sm font-medium">
                              {role === 'user' ? 'User' : role === 'manager' ? 'Manager' : role}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {detailItem.assignedDepartments && detailItem.assignedDepartments.length > 0 && (
                      <div>
                        <p className="text-sm text-gray-500 mb-2">แผนกที่ถูกมอบหมาย</p>
                        <div className="flex flex-wrap gap-2">
                          {detailItem.assignedDepartments.map(dept => (
                            <span key={dept} className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-sm font-medium">
                              {dept}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {detailItem.assignedPositions && detailItem.assignedPositions.length > 0 && (
                      <div>
                        <p className="text-sm text-gray-500 mb-2">ตำแหน่งที่ถูกมอบหมาย</p>
                        <div className="flex flex-wrap gap-2">
                          {detailItem.assignedPositions.map(pos => (
                            <span key={pos} className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full text-sm font-medium">
                              {pos}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                    {(!detailItem.assignedUsers || detailItem.assignedUsers.length === 0) &&
                     (!detailItem.assignedRoles || detailItem.assignedRoles.length === 0) &&
                     (!detailItem.assignedDepartments || detailItem.assignedDepartments.length === 0) &&
                     (!detailItem.assignedPositions || detailItem.assignedPositions.length === 0) && (
                      <p className="text-gray-500 text-sm italic">ไม่มีการกำหนดผู้รับผิดชอบ (เปิดให้ทุกคนเข้าถึงได้)</p>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex items-center gap-3 pt-4 border-t border-gray-200">
                <button
                  onClick={() => {
                    setShowDetailModal(false)
                    setDetailItem(null)
                  }}
                  className="flex-1 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition-colors"
                >
                  ปิด
                </button>
                <button
                  onClick={() => {
                    setShowDetailModal(false)
                    setEditItem(detailItem)
                    setShowEditModal(true)
                  }}
                  className="flex-1 px-4 py-2.5 bg-gray-600 hover:hover:bg-gray-700 text-white rounded-lg font-medium transition-colors"
                >
                  แก้ไข
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Help Modal */}
      {showHelpModal && (
        <div className="fixed inset-0 bg-black/50 z-[2000] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-sm max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white rounded-t-2xl border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-800 flex items-center gap-2">
                <svg className="w-5 h-5 fill-gray-700" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path d="M18 2H6c-1.1 0-2 .9-2 2v16c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zM6 4h5v8l-2.5-1.5L6 12V4z"/>
                </svg>
                คู่มือการใช้งาน
              </h2>
              <button
                onClick={() => setShowHelpModal(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
                <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 bg-brand-primary text-white rounded-full flex items-center justify-center text-sm">1</span>
                  การสร้างพื้นที่/กิจกรรมใหม่
                </h3>
                <ul className="space-y-2 text-sm text-gray-700 ml-8">
                  <li className="flex items-start gap-2">
                    <svg className="w-2 h-2 mt-1.5 fill-brand-primary flex-shrink-0" viewBox="0 0 8 8">
                      <circle cx="4" cy="4" r="4"/>
                    </svg>
                    <span><strong>คลิกที่แผนที่</strong> เพื่อปักหมุดและสร้างพื้นที่/กิจกรรมใหม่</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-2 h-2 mt-1.5 fill-brand-primary flex-shrink-0" viewBox="0 0 8 8">
                      <circle cx="4" cy="4" r="4"/>
                    </svg>
                    <span><strong>ค้นหาสถานที่</strong> ด้วยช่องค้นหาบนแผนที่ แล้วคลิกผลลัพธ์</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-2 h-2 mt-1.5 fill-brand-primary flex-shrink-0" viewBox="0 0 8 8">
                      <circle cx="4" cy="4" r="4"/>
                    </svg>
                    <span>คลิกปุ่ม <strong>"สร้างพื้นที่/กิจกรรมที่นี่"</strong> ใน popup ที่ปรากฏ</span>
                  </li>
                </ul>
              </div>

              <div className="bg-green-50 rounded-xl p-4 border border-green-200">
                <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 bg-gray-600 text-white rounded-full flex items-center justify-center text-sm">2</span>
                  การจัดการรายการ
                </h3>
                <ul className="space-y-2 text-sm text-gray-700 ml-8">
                  <li className="flex items-start gap-2">
                    <svg className="w-2 h-2 mt-1.5 fill-green-500 flex-shrink-0" viewBox="0 0 8 8">
                      <circle cx="4" cy="4" r="4"/>
                    </svg>
                    <span><strong>คลิกที่หมุด</strong> บนแผนที่จะพาไปยังรายการนั้นในลิสต์</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-2 h-2 mt-1.5 fill-green-500 flex-shrink-0" viewBox="0 0 8 8">
                      <circle cx="4" cy="4" r="4"/>
                    </svg>
                    <span><strong>ปุ่มแก้ไข</strong> สำหรับแก้ไขข้อมูลพื้นที่หรือกิจกรรม</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-2 h-2 mt-1.5 fill-green-500 flex-shrink-0" viewBox="0 0 8 8">
                      <circle cx="4" cy="4" r="4"/>
                    </svg>
                    <span><strong>ปุ่มลบ</strong> สำหรับลบรายการที่ไม่ต้องการ</span>
                  </li>
                </ul>
              </div>

              <div className="bg-orange-50 rounded-xl p-4 border border-orange-200">
                <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <span className="w-6 h-6 bg-orange-500 text-white rounded-full flex items-center justify-center text-sm">3</span>
                  สัญลักษณ์บนแผนที่
                </h3>
                <div className="space-y-2 text-sm text-gray-700 ml-8">
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                    <span><strong>หมุดสีเขียว</strong> = พื้นที่อนุญาตให้เข้างาน/ออกงาน</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                    <span><strong>หมุดสีส้ม</strong> = กิจกรรมพิเศษที่จัดขึ้นภายในหรือภายนอกบริษัท</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
                    <span><strong>หมุดสีแดง</strong> = ตำแหน่งที่กำลังเลือก</span>
                  </div>
                </div>
              </div>

              <div className="bg-amber-50 rounded-xl p-4 border border-amber-200">
                <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <svg className="w-6 h-6 fill-brand-primary" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z"/>
                  </svg>
                  เคล็ดลับ
                </h3>
                <ul className="space-y-2 text-sm text-gray-700 ml-8">
                  <li className="flex items-start gap-2">
                    <svg className="w-2 h-2 mt-1.5 fill-amber-500 flex-shrink-0" viewBox="0 0 8 8">
                      <circle cx="4" cy="4" r="4"/>
                    </svg>
                    <span>ใช้ <strong>แท็บกรอง</strong> เพื่อแสดงเฉพาะพื้นที่หรือกิจกรรม</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-2 h-2 mt-1.5 fill-amber-500 flex-shrink-0" viewBox="0 0 8 8">
                      <circle cx="4" cy="4" r="4"/>
                    </svg>
                    <span>สลับ <strong>มุมมองแผนที่/ดาวเทียม</strong> ได้ที่มุมบนขวา</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <svg className="w-2 h-2 mt-1.5 fill-amber-500 flex-shrink-0" viewBox="0 0 8 8">
                      <circle cx="4" cy="4" r="4"/>
                    </svg>
                    <span>คลิก <strong>"ลบหมุดค้นหา"</strong> เพื่อลบหมุดชั่วคราว</span>
                  </li>
                </ul>
              </div>

              <div className="bg-slate-50 rounded-xl p-4 border border-gray-300">
                <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <svg className="w-5 h-5 fill-gray-600" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path d="M20 5H4c-1.1 0-1.99.9-1.99 2L2 17c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V7c0-1.1-.9-2-2-2zm-9 3h2v2h-2V8zm0 3h2v2h-2v-2zM8 8h2v2H8V8zm0 3h2v2H8v-2zm-1 2H5v-2h2v2zm0-3H5V8h2v2zm9 7H8v-2h8v2zm0-4h-2v-2h2v2zm0-3h-2V8h2v2zm3 3h-2v-2h2v2zm0-3h-2V8h2v2z"/>
                  </svg>
                  คีย์ลัด (Keyboard Shortcuts)
                </h3>
                <div className="space-y-2 text-sm text-gray-700 ml-8">
                  <div className="flex items-center gap-3">
                    <kbd className="px-2 py-1 bg-white border-2 border-gray-300 rounded text-xs font-mono shadow-sm">ESC</kbd>
                    <span>ยกเลิกการแก้ไข/สร้าง</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <kbd className="px-2 py-1 bg-white border-2 border-gray-300 rounded text-xs font-mono shadow-sm">Enter</kbd>
                    <span>บันทึกการแก้ไข/สร้าง</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Edit Modal */}
      {showEditModal && editItem && (
        <div 
          className="fixed inset-0 bg-black/50 z-[2000] flex items-center justify-center p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowEditModal(false)
              setEditItem(null)
            }
          }}
        >
          <div className="bg-white rounded-2xl shadow-sm max-w-2xl w-full my-8">
            <div className="sticky top-0 bg-white rounded-t-2xl border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-xl font-bold text-gray-800">
                แก้ไข{editItem.type === 'location' ? 'พื้นที่อนุญาต' : 'กิจกรรม'}
              </h2>
              <button
                onClick={() => {
                  setShowEditModal(false)
                  setEditItem(null)
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <div className="p-6 max-h-[calc(90vh-80px)] overflow-y-auto">
              <EditForm
                type={editItem.type}
                item={editItem}
                user={user}
                onSubmit={handleEdit}
                onCancel={() => {
                  setShowEditModal(false)
                  setEditItem(null)
                }}
                onShowError={(message) => {
                  setErrorDialog({ isOpen: true, message })
                }}
                isSubmitting={isSubmitting}
              />
            </div>
          </div>
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div 
          className="fixed inset-0 bg-black/50 z-[2000] flex items-center justify-center p-4 overflow-y-auto"
          onClick={(e) => {
            if (e.target === e.currentTarget) {
              setShowCreateModal(false)
              setCreateType(null)
              setNewMarkerPosition(null)
              setSearchMarkerPosition(null)
              setSearchMarkerName('')
            }
          }}
        >
          <div className="bg-white rounded-2xl shadow-sm max-w-2xl w-full my-8">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white rounded-t-2xl border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
              <h2 className="text-xl font-bold text-gray-800">
                {createType ? (createType === 'location' ? 'สร้างพื้นที่อนุญาตใหม่' : 'สร้างกิจกรรมใหม่') : 'เลือกประเภท'}
              </h2>
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  setCreateType(null)
                  setNewMarkerPosition(null)
                  setSearchMarkerPosition(null)
                  setSearchMarkerName('')
                }}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 max-h-[calc(90vh-80px)] overflow-y-auto">
              {!createType ? (
                // Type Selection
                <div className="space-y-4">
                  <p className="text-gray-600 mb-6">เลือกประเภทที่ต้องการสร้างสำหรับตำแหน่งนี้:</p>
                  <div className="text-xs text-gray-500 bg-gray-50 p-3 rounded-lg mb-6">
                    <div className="font-medium mb-1">พิกัด:</div>
                    <div className="font-mono">{newMarkerPosition ? `${newMarkerPosition[0].toFixed(6)}, ${newMarkerPosition[1].toFixed(6)}` : 'N/A'}</div>
                  </div>
                  <button
                    onClick={() => setCreateType('location')}
                    className="w-full bg-gray-600  hover: text-white px-6 py-4 rounded-xl font-medium transition-all shadow-sm hover:shadow-sm"
                  >
                    <div className="text-center">
                      <div className="font-bold text-lg mb-1">พื้นที่อนุญาต</div>
                      <div className="text-sm opacity-90">กำหนดพื้นที่ที่พนักงานสามารถเช็คอินได้</div>
                    </div>
                  </button>
                  <button
                    onClick={() => setCreateType('event')}
                    className="w-full bg-brand-primary  hover: text-white px-6 py-4 rounded-xl font-medium transition-all shadow-sm hover:shadow-sm"
                  >
                    <div className="text-center">
                      <div className="font-bold text-lg mb-1">กิจกรรม</div>
                      <div className="text-sm opacity-90">สร้างกิจกรรมพิเศษที่มีวันที่กำหนด</div>
                    </div>
                  </button>
                </div>
              ) : (
                // Form
                <CreateForm
                  type={createType}
                  position={newMarkerPosition}
                  user={user}
                  onSubmit={handleCreate}
                  onCancel={() => {
                    setCreateType(null)
                  }}
                  onShowError={(message) => {
                    setErrorDialog({ isOpen: true, message })
                  }}
                  isSubmitting={isSubmitting}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-5">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">ตั้งค่าพื้นที่และกิจกรรม</h1>
            <p className="text-sm text-gray-600 mt-1">
              กำหนดพื้นที่อนุญาตและกิจกรรมต่างๆที่พนักงานต้องเช็คเข้างาน
            </p>
          </div>
          <button
            onClick={() => setShowHelpModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-orange-50 hover:bg-orange-100 text-brand-primary rounded-lg transition-colors font-medium text-sm border border-orange-200"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            วิธีใช้งาน
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="px-6 py-6 max-w-full mx-auto">
        <div className="flex gap-6 h-[calc(100vh-180px)]">
          {/* Left Side - Map */}
          <div className="flex-1 bg-white rounded-2xl shadow-sm overflow-hidden relative">
            {/* Clear Search Marker Button - Top Left (if marker exists) */}
            {searchMarkerPosition && (
              <div className="absolute top-20 left-14 z-[1001] flex flex-col gap-2">
                <button
                  onClick={() => {
                    setSearchMarkerPosition(null)
                    setSearchMarkerName('')
                  }}
                  className="bg-gray-600 hover:bg-gray-700 text-white px-3 py-2 rounded-lg shadow-sm font-medium text-xs transition-all flex items-center gap-2 border border-red-600"
                  title="ลบหมุดค้นหา"
                >
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                  </svg>
                  ลบหมุดค้นหา
                </button>
                {searchMarkerName && (
                  <div className="bg-white rounded-lg shadow-sm px-3 py-2 border border-gray-200 max-w-[160px]">
                    <p className="text-xs text-gray-500 mb-1 font-medium">ตำแหน่งปัจจุบัน</p>
                    <p className="text-xs text-gray-800 font-medium line-clamp-2">{searchMarkerName.split(',')[0]}</p>
                  </div>
                )}
              </div>
            )}

            {/* Map Search Box - Top Left */}
            <div className="absolute top-4 left-14 z-[1000] w-60">
              <div className="relative">
                <input
                  type="text"
                  value={mapSearchQuery}
                  onChange={(e) => setMapSearchQuery(e.target.value)}
                  placeholder="ค้นหาสถานที่บนแผนที่..."
                  className="w-full pl-10 pr-10 py-2.5 bg-white border-2 border-gray-200 rounded-xl shadow-sm focus:border-brand-primary focus:outline-none transition-colors text-sm"
                />
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {isSearchingMap && (
                  <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                    <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-brand-primary"></div>
                  </div>
                )}
                {mapSearchQuery && !isSearchingMap && (
                  <button
                    onClick={() => {
                      setMapSearchQuery('')
                      setMapSearchResults([])
                    }}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Search Results Dropdown */}
              {mapSearchResults.length > 0 && (
                <div className="mt-2 bg-white rounded-lg shadow-sm border border-gray-200 max-h-64 overflow-y-auto">
                  {mapSearchResults.map((result, index) => {
                    // Check if this is an existing marker or new location
                    const isExisting = result.type === 'existing'
                    
                    return (
                      <button
                        key={index}
                        onClick={() => {
                          if (isExisting) {
                            // Fly to existing marker and open popup
                            const markerId = `${result.markerType}-${result.id}`
                            setFlyToPosition([result.lat, result.lon])
                            setTimeout(() => {
                              setSelectedMarkerId(markerId)
                              setFlyToPosition(null)
                            }, 1500)
                          } else {
                            // Set search marker for new location
                            const lat = parseFloat(result.lat)
                            const lon = parseFloat(result.lon)
                            setSearchMarkerPosition([lat, lon])
                            setSearchMarkerName(result.formatted_name || result.display_name)
                          }
                          
                          // Clear search
                          setMapSearchQuery('')
                          setMapSearchResults([])
                        }}
                        className={`w-full text-left px-4 py-3 transition-colors border-b border-gray-100 last:border-b-0 ${
                          isExisting 
                            ? (result.markerType === 'location' 
                                ? 'hover:bg-green-50' 
                                : 'hover:bg-orange-50')
                            : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-start gap-2">
                          {/* Icon indicator */}
                          <div className={`w-2 h-2 rounded-full mt-1.5 flex-shrink-0 ${
                            isExisting 
                              ? (result.markerType === 'location' ? 'bg-green-500' : 'bg-orange-500')
                              : 'bg-gray-400'
                          }`}></div>
                          
                          <div className="flex-1 min-w-0">
                            {/* Title with type badge */}
                            <div className="flex items-center gap-2 mb-1">
                              <div className="font-medium text-sm text-gray-800 truncate">
                                {isExisting ? result.name : (result.formatted_name || result.display_name)}
                              </div>
                              {isExisting && (
                                <span className={`text-xs px-2 py-0.5 rounded-full font-medium flex-shrink-0 ${
                                  result.markerType === 'location'
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-orange-100 text-orange-700'
                                }`}>
                                  {result.markerType === 'location' ? 'พื้นที่' : 'กิจกรรม'}
                                </span>
                              )}
                            </div>
                            
                            {/* Description/Details */}
                            {isExisting ? (
                              <div className="text-xs text-gray-600 space-y-0.5">
                                {result.description && (
                                  <div className="truncate">{result.description}</div>
                                )}
                                {result.locationName && (
                                  <div className="truncate">📍 {result.locationName}</div>
                                )}
                                {result.date && (
                                  <div>📅 {result.date} {result.time && `⏰ ${result.time}`}</div>
                                )}
                                <div className="text-gray-400">
                                  รัศมี: {result.radius}ม. • พิกัด: {result.lat.toFixed(6)}, {result.lon.toFixed(6)}
                                </div>
                              </div>
                            ) : (
                              <div className="text-xs text-gray-500">
                                <div className="text-gray-400 mb-0.5">สถานที่ใหม่จาก OpenStreetMap</div>
                                พิกัด: {parseFloat(result.lat).toFixed(6)}, {parseFloat(result.lon).toFixed(6)}
                              </div>
                            )}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                </div>
              )}
            </div>

            {/* Map Type Toggle Button - Top Right */}
            <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
              <button
                onClick={() => setMapType(mapType === 'default' ? 'satellite' : 'default')}
                className="bg-white hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg shadow-sm font-medium text-sm transition-all flex items-center gap-2 border border-gray-200"
                title={mapType === 'default' ? 'สลับเป็นมุมมองดาวเทียม' : 'สลับเป็นมุมมองแผนที่'}
              >
                {mapType === 'default' ? (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                      <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                    </svg>
                    <span>ดาวเทียม</span>
                  </>
                ) : (
                  <>
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M12 1.586l-4 4v12.828l4-4V1.586zM3.707 3.293A1 1 0 002 4v10a1 1 0 00.293.707L6 18.414V5.586L3.707 3.293zM17.707 5.293L14 1.586v12.828l2.293 2.293A1 1 0 0018 16V6a1 1 0 00-.293-.707z" clipRule="evenodd" />
                    </svg>
                    <span>แผนที่</span>
                  </>
                )}
              </button>

              {/* Stats Badge */}
              <div className="bg-white rounded-lg shadow-sm p-3 border border-gray-200 min-w-[150px]">
                <div className="text-xs text-gray-500 mb-2 font-medium">หมุดทั้งหมด</div>
                <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2 bg-green-50 px-2 py-1.5 rounded-md">
                    <span className="w-2.5 h-2.5 bg-green-500 rounded-full flex-shrink-0"></span>
                    <div className="flex flex-col">
                      <span className="text-xs text-green-600 font-medium">พื้นที่อนุญาต</span>
                      <span className="text-lg font-bold text-green-700">{locations.length}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 bg-orange-50 px-2 py-1.5 rounded-md">
                    <span className="w-2.5 h-2.5 bg-brand-primary rounded-full flex-shrink-0"></span>
                    <div className="flex flex-col">
                      <span className="text-xs text-brand-primary font-medium">กิจกรรม</span>
                      <span className="text-lg font-bold text-orange-700">{events.length}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <MapContainer
              center={defaultCenter}
              zoom={13}
              style={{ height: '100%', width: '100%' }}
              scrollWheelZoom={true}
            >
              <TileLayer
                attribution={getTileLayerAttribution()}
                url={getTileLayerUrl()}
              />

              {/* Auto-fit bounds to show all markers (disabled when flying to search marker) */}
              <FitBoundsToMarkers 
                locations={[...mapLocations, ...mapEvents]} 
                disabled={isFlying || searchMarkerPosition !== null}
              />

              {/* Map click handler */}
              <MapClickHandler onMapClick={handleMapClick} />

              {/* Fly to search location when marker position changes */}
              <FlyToLocation 
                position={searchMarkerPosition || flyToPosition}
                onFlyStart={() => setIsFlying(true)}
                onFlyEnd={() => setIsFlying(false)}
              />

              {/* Temporary Search Marker (Red) */}
              {searchMarkerPosition && (
                <SearchMarker 
                  position={searchMarkerPosition} 
                  name={searchMarkerName}
                  onClick={handleSearchMarkerClick}
                />
              )}

              {/* Location Markers (Green) */}
              {mapLocations.map((location) => {
                const markerId = `location-${location.id}`;
                
                return (
                  <React.Fragment key={markerId}>
                    <Marker
                      position={[location.latitude, location.longitude]}
                      icon={locationIcon}
                      ref={(ref) => {
                        if (ref) markerRefs.current[markerId] = ref;
                      }}
                      eventHandlers={{
                        click: () => {
                          // Scroll to the item in the list and highlight it
                          const itemElement = document.querySelector(`[data-item-id="${markerId}"]`)
                          if (itemElement) {
                            itemElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
                            // Add highlight effect
                            itemElement.classList.add('ring-4', 'ring-green-400', 'ring-opacity-50')
                            setTimeout(() => {
                              itemElement.classList.remove('ring-4', 'ring-green-400', 'ring-opacity-50')
                            }, 2000)
                          }
                        }
                      }}
                    >
                    <Popup>
                      <div className="p-2 min-w-[200px]">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-3 h-3 rounded-full bg-green-600"></div>
                          <h3 className="font-bold text-gray-800">{location.name}</h3>
                        </div>
                        {location.description && (
                          <p className="text-xs text-gray-600 mb-2">{location.description}</p>
                        )}
                        <div className="text-xs text-gray-500 space-y-1">
                          <div className="flex items-center gap-1">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                            </svg>
                            <span>รัศมี: {location.radius}ม.</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              location.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'
                            }`}>
                              {location.status === 'active' ? '✓ ใช้งาน' : '✕ ปิด'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                  <Circle
                    center={[location.latitude, location.longitude]}
                    radius={location.radius}
                    pathOptions={{
                      color: '#22c55e',
                      fillColor: '#22c55e',
                      fillOpacity: 0.25,
                      weight: 2
                    }}
                  />
                </React.Fragment>
              );
              })}

              {/* Event Markers (Orange) */}
              {mapEvents.map((event) => {
                const markerId = `event-${event.id}`;
                
                return (
                  <React.Fragment key={markerId}>
                    <Marker
                      position={[event.latitude, event.longitude]}
                      icon={eventIcon}
                      ref={(ref) => {
                        if (ref) markerRefs.current[markerId] = ref;
                      }}
                      eventHandlers={{
                        click: () => {
                          // Scroll to the item in the list and highlight it
                          const itemElement = document.querySelector(`[data-item-id="${markerId}"]`)
                          if (itemElement) {
                            itemElement.scrollIntoView({ behavior: 'smooth', block: 'center' })
                            // Add highlight effect
                            itemElement.classList.add('ring-4', 'ring-orange-400', 'ring-opacity-50')
                            setTimeout(() => {
                              itemElement.classList.remove('ring-4', 'ring-orange-400', 'ring-opacity-50')
                            }, 2000)
                          }
                        }
                      }}
                    >
                    <Popup>
                      <div className="p-2 min-w-[200px]">
                        <div className="flex items-center gap-2 mb-2">
                          <div className="w-3 h-3 rounded-full bg-orange-600"></div>
                          <h3 className="font-bold text-gray-800">{event.name}</h3>
                        </div>
                        {event.description && (
                          <p className="text-xs text-gray-600 mb-2">{event.description}</p>
                        )}
                        <div className="text-xs text-gray-500 space-y-1">
                          {event.locationName && (
                            <div className="flex items-center gap-1">
                              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                              </svg>
                              <span>{event.locationName}</span>
                            </div>
                          )}
                          <div className="flex items-center gap-1">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M6 2a1 1 0 00-1 1v1H4a2 2 0 00-2 2v10a2 2 0 002 2h12a2 2 0 002-2V6a2 2 0 00-2-2h-1V3a1 1 0 10-2 0v1H7V3a1 1 0 00-1-1zm0 5a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
                            </svg>
                            <span>{event.startDate || event.date}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                            </svg>
                            <span>{event.startTime} - {event.endTime}</span>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                              event.status === 'ongoing' 
                                ? 'bg-orange-100 text-orange-700' 
                                : event.status === 'upcoming'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-gray-100 text-gray-700'
                            }`}>
                              {event.status === 'ongoing' ? '● ดำเนินการ' : event.status === 'upcoming' ? '◷ ยังไม่เริ่ม' : '○ สิ้นสุด'}
                            </span>
                          </div>
                        </div>
                      </div>
                    </Popup>
                  </Marker>
                  <Circle
                    center={[event.latitude, event.longitude]}
                    radius={event.radius}
                    pathOptions={{
                      color: '#f97316',
                      fillColor: '#f97316',
                      fillOpacity: 0.25,
                      weight: 2
                    }}
                  />
                </React.Fragment>
              );
              })}
            </MapContainer>
          </div>

          {/* Right Panel - List View */}
          <div className="w-[480px] bg-white rounded-2xl shadow-sm flex flex-col overflow-hidden border border-gray-200">
            {/* Header with Search and Tabs */}
            <div className="p-4 border-b border-gray-200 space-y-3">
              {/* Search Box */}
              <div className="relative">
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="ค้นหาพื้นที่หรือกิจกรรม..."
                  className="w-full pl-10 pr-10 py-2.5 border-2 border-gray-200 rounded-xl focus:border-brand-primary focus:outline-none transition-colors text-sm"
                />
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery('')}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                    </svg>
                  </button>
                )}
              </div>

              {/* Tab Filters */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setActiveTab('all')}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === 'all'
                      ? 'bg-brand-primary text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  ทั้งหมด ({locations.length + events.length})
                </button>
                <button
                  onClick={() => setActiveTab('locations')}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === 'locations'
                      ? 'bg-gray-600 text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  พื้นที่ ({locations.length})
                </button>
                <button
                  onClick={() => setActiveTab('events')}
                  className={`flex-1 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                    activeTab === 'events'
                      ? 'bg-brand-primary text-white'
                      : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  กิจกรรม ({events.length})
                </button>
              </div>
            </div>

            {/* Items List */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {filteredItems.length === 0 && (
                <div className="text-center text-gray-500 py-8">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 mx-auto mb-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <p className="text-sm">ไม่พบข้อมูล</p>
                </div>
              )}

              {filteredItems.map((item) => {
                const isOpen = openIds.includes(item.id)
                const isLocation = item.type === 'location'
                
                return (
                  <div
                    key={`${item.type}-${item.id}`}
                    data-item-id={`${item.type}-${item.id}`}
                    onClick={() => {
                      const markerId = `${item.type}-${item.id}`;
                      setFlyToPosition([item.latitude, item.longitude]);
                      // Set selected marker to open popup after flying
                      setTimeout(() => {
                        setSelectedMarkerId(markerId);
                        setFlyToPosition(null);
                      }, 1500); // Wait for fly animation to complete
                    }}
                    className={`relative rounded-xl p-4 border-2 shadow-sm transition-all duration-200 cursor-pointer ${
                      isLocation 
                        ? 'border-green-100 bg-green-50/50 hover:bg-green-100/70 hover:border-green-300 hover:shadow-md' 
                        : 'border-orange-100 bg-orange-50/50 hover:bg-orange-100/70 hover:border-orange-300 hover:shadow-md'
                    }`}
                    title="คลิกเพื่อบินไปที่หมุดบนแผนที่"
                  >
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1 min-w-0 pr-2">
                        <div className={`inline-flex items-center gap-1.5 px-2 py-1 rounded-full text-xs font-semibold mb-2 ${
                          isLocation 
                            ? 'bg-green-100 text-green-700' 
                            : 'bg-orange-100 text-orange-700'
                        }`}>
                          {isLocation ? 'พื้นที่อนุญาต' : 'กิจกรรม'}
                        </div>
                        <h3 className="font-bold text-lg text-gray-800 mb-1">{item.name}</h3>
                        <p className="text-xs text-gray-600 line-clamp-2">{item.description}</p>
                      </div>
                      
                      {/* Status Badge - Only for Events */}
                      {!isLocation && (
                        <span className={`flex-shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${
                          item.status === 'active' 
                            ? 'bg-green-100 text-green-700' 
                            : item.status === 'inactive'
                            ? 'bg-gray-100 text-gray-600'
                            : item.status === 'ongoing'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-red-100 text-red-700'
                        }`}>
                          {item.status === 'active' && (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              ใช้งาน
                            </>
                          )}
                          {item.status === 'inactive' && (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                              </svg>
                              ปิด
                            </>
                          )}
                          {item.status === 'ongoing' && (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                              </svg>
                              ดำเนินการ
                            </>
                          )}
                          {item.status === 'completed' && (
                            <>
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                              </svg>
                              สิ้นสุด
                            </>
                          )}
                        </span>
                      )}
                    </div>

                    {/* Quick Info */}
                    <div className="flex items-center gap-4 text-xs text-gray-600 mb-3 flex-wrap">
                      <div className="flex items-center gap-1">
                        <span className="font-medium">รัศมี:</span>
                        <span>{item.radius}ม.</span>
                      </div>
                      {!isLocation && item.locationName && (
                        <div className="flex items-center gap-1">
                          <span className="font-medium">สถานที่:</span>
                          <span className="truncate">{item.locationName}</span>
                        </div>
                      )}
                      {!isLocation && item.date && (
                        <div className="flex items-center gap-1">
                          <span className="font-medium">วันที่เริ่ม:</span>
                          <span>{item.date}</span>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div className="grid grid-cols-3 gap-2">
                      <button
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setDetailItem(item);
                          setShowDetailModal(true);
                        }}
                        className="px-3 py-2 bg-brand-primary hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                        title="ดูรายละเอียด"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M10 12a2 2 0 100-4 2 2 0 000 4z" />
                          <path fillRule="evenodd" d="M.458 10C1.732 5.943 5.522 3 10 3s8.268 2.943 9.542 7c-1.274 4.057-5.064 7-9.542 7S1.732 14.057.458 10zM14 10a4 4 0 11-8 0 4 4 0 018 0z" clipRule="evenodd" />
                        </svg>
                        ดู
                      </button>
                      <button
                        onClick={(e) => { 
                          e.stopPropagation(); 
                          setEditItem(item);
                          setShowEditModal(true);
                        }}
                        className="px-3 py-2 bg-gray-600 hover:hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2"
                        title="แก้ไข"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
                        </svg>
                        แก้ไข
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); handleDelete(item.id, item.type); }}
                        className="px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors flex items-center justify-center"
                        title="ลบ"
                      >
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                        </svg>
                      </button>
                    </div>

                    {/* Details Section (Collapsible) */}
                    <div
                      ref={el => {
                        if (el && !el.dataset.attInit) {
                          el.style.overflow = 'hidden'
                          el.style.maxHeight = '0px'
                          el.style.opacity = '0'
                          el.style.transition = 'max-height 320ms cubic-bezier(.4,0,.2,1), opacity 220ms ease'
                          el.dataset.attInit = '1'
                        }
                        wrapperRefs.current[item.id] = el
                      }}
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
                        className="bg-white rounded-lg p-3 border border-gray-200 space-y-3"
                      >
                        {/* Coordinates/Location Info */}
                        <div className="bg-gray-50 rounded-lg p-3">
                          <p className="text-xs text-gray-500 mb-2 font-medium">
                            {isLocation ? 'พิกัดที่ตั้ง' : 'ข้อมูลเพิ่มเติม'}
                          </p>
                          {isLocation ? (
                            <div className="text-sm space-y-1">
                              <div className="flex items-center gap-2">
                                <span className="text-gray-500 text-xs">Lat:</span>
                                <span className="text-gray-700 font-mono text-xs">{item.latitude}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-gray-500 text-xs">Lng:</span>
                                <span className="text-gray-700 font-mono text-xs">{item.longitude}</span>
                              </div>
                            </div>
                          ) : (
                            <div className="space-y-2 text-sm">
                              <div className="flex items-center gap-2">
                                <span className="text-gray-500 text-xs">สถานที่:</span>
                                <span className="text-gray-700 text-xs">{item.locationName}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-gray-500 text-xs">วันที่:</span>
                                <span className="text-gray-700 text-xs">{item.date}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className="text-gray-500 text-xs">พิกัด:</span>
                                <span className="text-gray-700 font-mono text-xs">{item.latitude}, {item.longitude}</span>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* View on Map Button */}
                        <button
                          onClick={() => {
                            const mapElement = document.querySelector('.leaflet-container')
                            if (mapElement && mapElement._leaflet_map) {
                              const map = mapElement._leaflet_map
                              const position = [item.latitude, item.longitude]
                              
                              // Get map container dimensions
                              const container = map.getContainer()
                              const containerWidth = container.offsetWidth
                              
                              // Calculate the visible map area (excluding right panel)
                              const rightPanelWidth = 504 // 480px panel + 24px gap
                              const visibleMapWidth = containerWidth - rightPanelWidth
                              const visibleCenterX = visibleMapWidth / 2
                              const containerCenterX = containerWidth / 2
                              const offsetPixelsX = visibleCenterX - containerCenterX
                              
                              // Convert pixel offset to lat/lng offset at zoom 16
                              const targetZoom = 16
                              const markerPoint = map.project(position, targetZoom)
                              const adjustedPoint = L.point(markerPoint.x - offsetPixelsX, markerPoint.y)
                              const adjustedPosition = map.unproject(adjustedPoint, targetZoom)
                              
                              // Fly to adjusted position
                              map.flyTo(adjustedPosition, targetZoom, { animate: true, duration: 1.0 })
                            }
                          }}
                          className={`w-full px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
                            isLocation
                              ? 'bg-green-100 hover:bg-green-200 text-green-700'
                              : 'bg-orange-100 hover:bg-orange-200 text-orange-700'
                          }`}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M5.05 4.05a7 7 0 119.9 9.9L10 18.9l-4.95-4.95a7 7 0 010-9.9zM10 11a2 2 0 100-4 2 2 0 000 4z" clipRule="evenodd" />
                          </svg>
                          ดูบนแผนที่
                        </button>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Dialog Components */}
      <SuccessDialog
        isOpen={successDialog.isOpen}
        message={successDialog.message}
        onClose={() => setSuccessDialog({ isOpen: false, message: '' })}
      />

      <ErrorDialog
        isOpen={errorDialog.isOpen}
        message={errorDialog.message}
        onClose={() => setErrorDialog({ isOpen: false, message: '' })}
      />

      <ConfirmDialog
        isOpen={confirmDialog.isOpen}
        title={confirmDialog.title}
        message={confirmDialog.message}
        onConfirm={confirmDialog.onConfirm}
        onCancel={() => setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: () => {} })}
      />
    </div>
  )
}

export default MappingAndEvents
