import React, { useMemo, useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useLocations } from '../../../contexts/LocationContext';
import { MapContainer, TileLayer, Marker, Circle, LayersControl } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icon issue in Leaflet with webpack
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

export default function ScheduleDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { locations } = useLocations();
  const [refreshKey, setRefreshKey] = useState(0);

  // โหลดตารางงานจาก localStorage
  const schedule = useMemo(() => {
    const savedSchedules = localStorage.getItem('attendanceSchedules');
    if (savedSchedules) {
      try {
        const schedules = JSON.parse(savedSchedules);
        return schedules.find((s) => s.id === parseInt(id));
      } catch (error) {
        console.error('Error loading schedule:', error);
        return null;
      }
    }
    return null;
  }, [id, refreshKey]);

  // 🔥 Real-time schedule updates (เหมือนการเข้า-ออกงาน)
  useEffect(() => {
    // 1. ฟัง CustomEvent สำหรับ same tab (ทำงานทันที)
    const handleScheduleUpdate = (event) => {
      console.log('📢 [Same Tab Details] Schedule updated:', event.detail?.action);
      // อัพเดททุกครั้งเพราะอาจเป็นการลบหรือแก้ไข
      setRefreshKey(prev => prev + 1);
    };

    // 2. ฟัง storage event สำหรับ cross-tab
    const handleStorageChange = (e) => {
      if (e.key === 'scheduleUpdateTrigger' && e.newValue) {
        try {
          const update = JSON.parse(e.newValue);
          console.log('📢 [Cross Tab Details] Schedule update:', update.action);
          setRefreshKey(prev => prev + 1);
        } catch (error) {
          console.error('Error parsing schedule update:', error);
        }
      } else if (e.key === 'attendanceSchedules') {
        // 🔥 ฟังการเปลี่ยนแปลงของ attendanceSchedules โดยตรง (ตอนลบ/แก้ไข)
        console.log('📢 [Cross Tab Details] attendanceSchedules changed');
        setRefreshKey(prev => prev + 1);
      }
    };

    // ฟัง CustomEvent (same tab)
    window.addEventListener('scheduleUpdated', handleScheduleUpdate);
    // ฟัง storage event (cross-tab)
    window.addEventListener('storage', handleStorageChange);

    return () => {
      window.removeEventListener('scheduleUpdated', handleScheduleUpdate);
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [id]);

  if (!schedule) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">ไม่พบตารางงาน</h2>
          <p className="text-gray-600 mb-4">ตารางงานที่คุณค้นหาไม่มีในระบบ</p>
          <button
            onClick={() => navigate('/user/dashboard')}
            className="px-6 py-2 bg-brand-primary text-white rounded-lg hover:bg-orange-600 transition-colors"
          >
            กลับหน้าหลัก
          </button>
        </div>
      </div>
    );
  }

  const locationData = locations.find(loc => loc.name === schedule.location);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Back Button */}
      <div className="p-4">
        <button
          onClick={() => navigate(-1)}
          className="flex items-center space-x-2 text-gray-700 hover:text-brand-primary transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span className="font-medium">กลับ</span>
        </button>
      </div>

      {/* Schedule Header */}
      <div className="bg-gradient-to-r from-brand-primary to-orange-600 text-white px-6 py-8 rounded-3xl shadow-lg">
        <div className="flex items-start space-x-3">
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold mb-2">{schedule.team}</h1>
            <p className="text-orange-100 text-sm mb-1">{schedule.date}</p>
            <p className="text-orange-100 text-sm">เวลา: {schedule.time || `${schedule.startTime} - ${schedule.endTime}`}</p>
          </div>
        </div>
      </div>

      {/* Schedule Details Card */}
      <div className="mt-6">
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Basic Info Section */}
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-4">ข้อมูลทั่วไป</h3>
            <div className="space-y-4">
              <div className="flex items-start space-x-3">
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-500 mb-1">สถานที่</p>
                  <p className="text-gray-800 font-medium">{schedule.location}</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-500 mb-1">สมาชิกในทีม</p>
                  <p className="text-gray-800 font-medium">{schedule.members}</p>
                </div>
              </div>

              <div className="flex items-start space-x-3">
                <div className="w-10 h-10 bg-orange-50 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-500 mb-1">ประเภทงาน</p>
                  <p className="text-gray-800 font-medium">{schedule.type}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Tasks Section */}
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">ภารกิจหลัก</h3>
                <ul className="space-y-2">
                  {schedule.tasks?.map((task, idx) => (
                    <li key={idx} className="text-gray-800 leading-relaxed">• {task}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Preparations Section */}
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">สิ่งที่ต้องเตรียม</h3>
                <ul className="space-y-2">
                  {schedule.preparations?.map((prep, idx) => (
                    <li key={idx} className="text-gray-800 leading-relaxed">• {prep}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Goals Section */}
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">เป้าหมาย</h3>
                <ul className="space-y-2">
                  {schedule.goals?.map((goal, idx) => (
                    <li key={idx} className="text-gray-800 leading-relaxed">• {goal}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>

          {/* Map Section */}
          {locationData && (
            <div className="p-6">
              <h3 className="text-sm font-semibold text-gray-500 uppercase mb-4">แผนที่สถานที่</h3>
              <div className="relative h-[400px] rounded-xl overflow-hidden border-2 border-gray-200 z-10">
              <MapContainer
                center={[locationData.latitude, locationData.longitude]}
                zoom={16}
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
            <p className="text-xs text-gray-500 mt-3 text-center">
              วงกลมสีเขียวแสดงพื้นที่ที่สามารถเช็คอินได้
            </p>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
