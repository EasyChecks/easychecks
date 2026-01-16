import React, { createContext, useState, useContext } from 'react'

// Create Context
const LocationContext = createContext()

// Initial locations data
const initialLocations = [
  // ========== กรุงเทพมหานคร (BKK - Branch 101) ==========
  {
    id: 1,
    name: 'Tea Time สาขาสยาม',
    description: 'ร้านชานมสาขาหลัก ย่านสยาม กรุงเทพฯ',
    radius: 150,
    latitude: 13.7245,
    longitude: 100.5316,
    status: 'active',
    createdBy: {
      userId: 1,
      username: 'BKK1010001',
      branch: '101'
    }
  },
  
  // ========== เชียงใหม่ (CNX - Branch 201) ==========
  {
    id: 2,
    name: 'Tea Time สาขาเซ็นทรัล เชียงใหม่',
    description: 'ร้านชานมสาขาเชียงใหม่ ห้างเซ็นทรัลเฟสติวัล',
    radius: 120,
    latitude: 18.7883,
    longitude: 98.9853,
    status: 'active',
    createdBy: {
      userId: 2,
      username: 'CNX2010001',
      branch: '201'
    }
  },
  
  // ========== ภูเก็ต (PKT - Branch 301) ==========
  {
    id: 3,
    name: 'Tea Time สาขาป่าตอง',
    description: 'ร้านชานมสาขาภูเก็ต ชายหาดป่าตอง',
    radius: 130,
    latitude: 7.8804,
    longitude: 98.3923,
    status: 'active',
    createdBy: {
      userId: 5,
      username: 'PKT3010001',
      branch: '301'
    }
  }
]

// Provider Component
export function LocationProvider({ children }) {
  // อ่านข้อมูลจาก localStorage หรือใช้ค่าเริ่มต้นถ้าไม่มี
  const [locations, setLocations] = useState(() => {
    try {
      const savedLocations = localStorage.getItem('locations')
      if (savedLocations) {
        const parsed = JSON.parse(savedLocations)
        // ลบข้อมูลที่ซ้ำกัน (ตาม id และ name)
        const uniqueLocations = []
        const seenIds = new Set()
        const seenNames = new Set()
        
        for (const loc of parsed) {
          const normalizedName = loc.name.toLowerCase().trim()
          if (!seenIds.has(loc.id) && !seenNames.has(normalizedName)) {
            seenIds.add(loc.id)
            seenNames.add(normalizedName)
            uniqueLocations.push(loc)
          }
        }
        
        // Merge: เพิ่ม locations ใหม่จาก initialLocations ที่ยังไม่มีใน localStorage
        const existingIds = new Set(uniqueLocations.map(loc => loc.id))
        const newLocations = initialLocations.filter(loc => !existingIds.has(loc.id))
        return [...uniqueLocations, ...newLocations]
      }
    } catch (error) {
      console.error('Error loading locations from localStorage:', error)
    }
    return initialLocations
  })

  // บันทึกลง localStorage ทุกครั้งที่มีการเปลี่ยนแปลง
  React.useEffect(() => {
    try {
      localStorage.setItem('locations', JSON.stringify(locations))
    } catch (error) {
      console.error('Error saving locations to localStorage:', error)
    }
  }, [locations])

  // Add new location
  const addLocation = (location) => {
    setLocations(prev => [...prev, location])
  }

  // Update location
  const updateLocation = (id, updatedLocation) => {
    setLocations(prev => 
      prev.map(loc => loc.id === id ? { ...loc, ...updatedLocation } : loc)
    )
  }

  // Delete location
  const deleteLocation = (id) => {
    setLocations(prev => prev.filter(loc => loc.id !== id))
  }

  // Delete multiple locations
  const deleteLocations = (ids) => {
    setLocations(prev => prev.filter(loc => !ids.includes(loc.id)))
  }

  // Get location by id
  const getLocation = (id) => {
    return locations.find(loc => loc.id === id)
  }

  // Get all locations (unfiltered) - for ID generation
  const getAllLocations = () => {
    return locations
  }

  // Get filtered locations based on user role and branch
  const getFilteredLocations = (user) => {
    if (!user) return []
    
    const userRole = user.role?.toLowerCase()
    
    // SuperAdmin เห็นทุกอย่าง
    if (userRole === 'superadmin' || userRole === 'super admin') {
      return locations
    }
    
    // Admin เห็นเฉพาะสาขาของตัวเอง
    if (userRole === 'admin') {
      return locations.filter(loc => {
        // ถ้ายังไม่มี branch (location เก่า) ให้แสดงทุกอัน
        if (!loc.createdBy?.branch) return true
        // ถ้ามี branch ให้แสดงเฉพาะที่ตรงกับสาขาของ admin
        return loc.createdBy.branch === user.branchCode
      })
    }
    
    // Role อื่นๆ ไม่เห็น
    return []
  }

  const value = {
    locations,
    setLocations,
    addLocation,
    updateLocation,
    deleteLocation,
    deleteLocations,
    getLocation,
    getAllLocations,
    getFilteredLocations
  }

  return (
    <LocationContext.Provider value={value}>
      {children}
    </LocationContext.Provider>
  )
}

// Custom hook to use Location Context
export function useLocations() {
  const context = useContext(LocationContext)
  if (!context) {
    throw new Error('useLocations must be used within LocationProvider')
  }
  return context
}

export default LocationContext
