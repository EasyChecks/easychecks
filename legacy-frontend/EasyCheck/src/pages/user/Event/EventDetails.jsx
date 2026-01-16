import React, { useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useEvents } from "../../../contexts/EventContext";
import { useAuth } from '../../../contexts/useAuth';
import { MapContainer, TileLayer, Marker, Circle } from 'react-leaflet';
import SuccessDialog from '../../../components/common/SuccessDialog';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Fix for default marker icon issue in Leaflet with webpack
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

export default function EventDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getFilteredEvents, canJoinEvent, getTimeRemainingToJoin } = useEvents();
  const { checkIn, attendance, user } = useAuth()
  
  // กรองกิจกรรมตาม user ก่อน
  const filteredEvents = getFilteredEvents(user);
  const event = filteredEvents.find((e) => e.id === parseInt(id));
  const [timeRemaining, setTimeRemaining] = React.useState(null);
  const [userLocation, setUserLocation] = React.useState(null);
  const [isWithinRadius, setIsWithinRadius] = React.useState(false);
  const [checkingLocation, setCheckingLocation] = React.useState(false);
  const [showSuccessPopup, setShowSuccessPopup] = React.useState(false);

  // ตรวจสอบว่าผู้ใช้เช็คอินกิจกรรมนี้แล้วหรือยัง (แยกตาม user)
  const getEventCheckInStatus = (eventId, userId) => {
    try {
      const eventCheckIns = JSON.parse(localStorage.getItem('eventCheckIns') || '{}');
      // เก็บข้อมูลแยกตาม userId และ eventId
      return eventCheckIns[`${userId}_${eventId}`] || false;
    } catch (error) {
      console.error('Error getting event check-in status:', error);
      return false;
    }
  };

  // บันทึกสถานะการเช็คอินของกิจกรรม (แยกตาม user)
  const setEventCheckInStatus = (eventId, userId, status) => {
    try {
      const eventCheckIns = JSON.parse(localStorage.getItem('eventCheckIns') || '{}');
      // เก็บข้อมูลแยกตาม userId และ eventId
      eventCheckIns[`${userId}_${eventId}`] = status;
      localStorage.setItem('eventCheckIns', JSON.stringify(eventCheckIns));
    } catch (error) {
      console.error('Error setting event check-in status:', error);
    }
  };

  const isJoined = user ? getEventCheckInStatus(parseInt(id), user.id) : false;

  // Calculate distance between two points
  const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371e3; // Earth radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
      Math.cos(φ1) * Math.cos(φ2) *
      Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distance in meters
  };

  // Check user location
  useEffect(() => {
    if (!event) return;
    
    setCheckingLocation(true);
    
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const userLat = position.coords.latitude;
          const userLon = position.coords.longitude;
          setUserLocation({ lat: userLat, lon: userLon });
          
          const distance = calculateDistance(
            userLat,
            userLon,
            event.latitude,
            event.longitude
          );
          
          setIsWithinRadius(distance <= event.radius);
          setCheckingLocation(false);
        },
        (error) => {
          console.error('Error getting location:', error);
          setCheckingLocation(false);
        }
      );
    }
  }, [event]);

  // Update time remaining every minute (only if event exists)
  useEffect(() => {
    if (!event) return
    const updateTimeRemaining = () => {
      const remaining = getTimeRemainingToJoin(event);
      setTimeRemaining(remaining);
    }
    updateTimeRemaining()
    const interval = setInterval(updateTimeRemaining, 60000)
    return () => clearInterval(interval)
  }, [event, getTimeRemainingToJoin])

  // Helper function to format time display
  const formatTimeRemaining = (timeObj) => {
    if (!timeObj) return null;
    
    if (timeObj.hours === 0 && timeObj.minutes === 0) {
      return "หมดเวลาแล้ว";
    }
    
    if (timeObj.hours === 0) {
      return `${timeObj.minutes} นาที`;
    }
    
    return `${timeObj.hours} ชั่วโมง ${timeObj.minutes} นาที`;
  };

  const handleJoinEvent = async () => {
    if (canJoinEvent(event) && isWithinRadius && user) {
      await checkIn();
      setEventCheckInStatus(parseInt(id), user.id, true); // บันทึกสถานะการเช็คอินของกิจกรรมนี้ สำหรับ user นี้
      setShowSuccessPopup(true);
    }
  };

  const canUserJoin = event ? canJoinEvent(event) && isWithinRadius : false;

  if (!event) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-orange-50 to-orange-50 flex items-center justify-center p-6">
        <div className="bg-white rounded-2xl shadow-lg p-8 text-center max-w-md">
          <div className="w-20 h-20 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-10 h-10 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-800 mb-2">ไม่พบข้อมูลอีเว้นท์</h3>
          <p className="text-gray-600 mb-6">ไม่สามารถค้นหากิจกรรมที่คุณต้องการได้</p>
          <button
            onClick={() => navigate("/user/event")}
            className="bg-gradient-to-r from-brand-primary to-orange-600 text-white px-6 py-3 rounded-xl font-semibold hover:shadow-lg transform hover:scale-105 transition-all duration-200 flex items-center justify-center space-x-2 mx-auto"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>กลับไปหน้าอีเว้นท์</span>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen ">
      {/* Back Button */}
      <div className="p-4">
        <button
          onClick={() => navigate("/user/event")}
          className="flex items-center space-x-2 text-gray-700 hover:text-brand-primary transition-colors"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
          </svg>
          <span className="font-medium">กลับ</span>
        </button>
      </div>

      {/* Event Header */}
      <div className="bg-gradient-to-r from-brand-primary to-orange-600 text-white px-6 py-8 rounded-3xl shadow-lg mx-4">
        <div className="flex items-start space-x-3">
          <div className="w-12 h-12 bg-white/20 rounded-full flex items-center justify-center flex-shrink-0">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="flex-1">
            <h1 className="text-2xl font-bold mb-2">{event.name}</h1>
            <p className="text-orange-100 text-sm mb-2">{event.date}</p>
            {/* status badge removed as per UX request */}
          </div>
        </div>
      </div>

      {/* Event Details Card */}
      <div className="px-4 mt-6">
        <div className="bg-white rounded-2xl shadow-lg overflow-hidden">
          {/* Description Section */}
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-brand-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">รายละเอียด</h3>
                <p className="text-gray-800 leading-relaxed">{event.description}</p>
              </div>
            </div>
          </div>

          {/* Location Section */}
          <div className="p-6 border-b border-gray-100">
            <div className="flex items-start space-x-3">
              <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </div>
              <div className="flex-1">
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">สถานที่</h3>
                <p className="text-gray-800 font-medium mb-2">{event.locationName}</p>
                <p className="text-sm text-gray-600">
                  พิกัด: {event.latitude.toFixed(6)}, {event.longitude.toFixed(6)}
                </p>
                <p className="text-sm text-gray-600">
                  รัศมี: {event.radius} เมตร
                </p>
              </div>
            </div>
          </div>

          {/* Map Section */}
          <div className="p-6 border-b border-gray-100">
            <h3 className="text-sm font-semibold text-gray-500 uppercase mb-4">แผนที่สถานที่</h3>
            <div className="relative h-[400px] rounded-xl overflow-hidden border-2 border-gray-200 z-10">
              <MapContainer
                center={[event.latitude, event.longitude]}
                zoom={16}
                style={{ height: '100%', width: '100%' }}
                scrollWheelZoom={false}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                <Marker position={[event.latitude, event.longitude]} />
                <Circle
                  center={[event.latitude, event.longitude]}
                  radius={event.radius}
                  pathOptions={{ 
                    color: event.status === 'ongoing' ? '#22C55E' : '#9CA3AF',
                    fillColor: event.status === 'ongoing' ? '#22C55E' : '#9CA3AF',
                    fillOpacity: 0.2 
                  }}
                />
              </MapContainer>
            </div>
          </div>

          {/* Time Section */}
          {event.startTime && event.endTime && (
            <div className="p-6 border-b border-gray-100">
              <div className="flex items-start space-x-3">
                <div className="w-10 h-10 bg-orange-50 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase mb-2">เวลา</h3>
                  <p className="text-gray-800 font-medium">{event.startTime} - {event.endTime} น.</p>
                </div>
              </div>
            </div>
          )}

          {/* Teams Section */}
          {event.teams && event.teams.length > 0 && (
            <div className="p-6">
              <div className="flex items-start space-x-3">
                <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-orange-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-sm font-semibold text-gray-500 uppercase mb-3">ทีมที่เข้าร่วม</h3>
                  <div className="flex flex-wrap gap-2">
                    {event.teams.map((team, idx) => (
                      <span key={idx} className="bg-orange-100 text-orange-700 px-4 py-2 rounded-full text-sm font-medium">
                        {team}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="p-6">
          {checkingLocation ? (
            <div className="text-center py-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-primary mx-auto mb-2"></div>
              <p className="text-sm text-gray-600">กำลังตรวจสอบตำแหน่ง...</p>
            </div>
          ) : !isWithinRadius ? (
            <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-center">
              <p className="text-red-700 font-medium mb-2">⚠️ คุณอยู่นอกพื้นที่กิจกรรม</p>
              <p className="text-sm text-red-600">กรุณาเข้าใกล้สถานที่จัดกิจกรรมเพื่อเช็คอิน</p>
            </div>
          ) : isJoined ? (
            <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
              <p className="text-green-700 font-medium flex items-center justify-center gap-2">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                คุณเช็คอินแล้ว
              </p>
            </div>
          ) : canUserJoin ? (
            <button
              onClick={handleJoinEvent}
              className="w-full bg-gradient-to-r from-green-500 to-green-600 text-white py-4 rounded-xl font-bold text-lg hover:shadow-xl transition-all hover:scale-[1.02]"
            >
              เข้าร่วมกิจกรรม
            </button>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 text-center">
              <p className="text-gray-700 font-medium">⏰ หมดเวลาเข้าร่วม</p>
            </div>
          )}
        </div>
      </div>

      {/* Time Remaining Banner */}
      {timeRemaining && (
        <div className="mx-4 mt-6 bg-orange-50 border border-orange-400 rounded-xl p-4">
          <p className="text-sm text-orange-800 text-center">
            <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 inline-block mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="font-medium">เวลาเหลือในการเข้าร่วม</span>
          </p>
          <p className="text-center mt-2">
            <span className="text-2xl font-bold text-orange-900">
              คุณไม่สามารถเข้าร่วมได้อีก {formatTimeRemaining(timeRemaining)}
            </span>
          </p>
        </div>
      )}

      {/* Success Popup */}
      <SuccessDialog
        isOpen={showSuccessPopup}
        onClose={() => setShowSuccessPopup(false)}
        title="เข้าร่วมกิจกรรมสำเร็จ!"
        message="คุณได้เข้าร่วมกิจกรรมเรียบร้อยแล้ว"
        autoClose={true}
        autoCloseDelay={3000}
      />

      {/* Info Banner */}
      <div className="mx-4 mt-6 bg-orange-50 border border-orange-200 rounded-xl p-4">
        <p className="text-sm text-orange-800 flex items-center gap-2">
          <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 flex-shrink-0 text-yellow-500" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/></svg>
          <span><span className="font-medium">เคล็ดลับ:</span> อย่าลืมเช็คอินเมื่อถึงสถานที่จัดกิจกรรม</span>
        </p>
      </div>
    </div>
  );
}