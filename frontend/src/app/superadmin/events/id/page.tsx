'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import eventService, { EventItem, EventAttendanceStatus } from '@/services/eventService';

// Dynamic import for Leaflet map components (client-side only)
const MapContainer = dynamic(() => import('react-leaflet').then(m => m.MapContainer), { ssr: false });
const TileLayer = dynamic(() => import('react-leaflet').then(m => m.TileLayer), { ssr: false });
const Marker = dynamic(() => import('react-leaflet').then(m => m.Marker), { ssr: false });
const Circle = dynamic(() => import('react-leaflet').then(m => m.Circle), { ssr: false });
const Popup = dynamic(() => import('react-leaflet').then(m => m.Popup), { ssr: false });

if (typeof window !== 'undefined') {
  import('leaflet').then((L) => {
    delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
      iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
      shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    });
  });
}

export default function ManagerEventDetailPage() {
  const params = useParams();
  const router = useRouter();
  useAuth();
  const eventId = Number(params.id);

  const [event, setEvent] = useState<EventItem | null>(null);
  const [attendance, setAttendance] = useState<EventAttendanceStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [gpsStatus, setGpsStatus] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      setLoading(true);
      const [eventData, attendanceData] = await Promise.all([
        eventService.getById(eventId),
        eventService.getMyAttendance(eventId),
      ]);
      setEvent(eventData);
      setAttendance(attendanceData);
    } catch (err) {
      console.error('Failed to fetch event:', err);
      setError('ไม่สามารถโหลดข้อมูลกิจกรรมได้');
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => {
    if (eventId) fetchData();
  }, [eventId, fetchData]);

  const getEventStatus = (ev: EventItem) => {
    const now = new Date();
    const start = new Date(ev.startDateTime);
    const end = new Date(ev.endDateTime);
    if (now < start) return 'upcoming';
    if (now > end) return 'completed';
    return 'ongoing';
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ongoing':
        return <Badge variant="active">กำลังดำเนินการ</Badge>;
      case 'upcoming':
        return <Badge variant="pending">กำลังจะมาถึง</Badge>;
      case 'completed':
        return <Badge variant="suspend">สิ้นสุดแล้ว</Badge>;
      default:
        return null;
    }
  };

  const getAttendanceBadge = () => {
    if (!attendance) return null;
    if (!attendance.checkedIn) {
      return <Badge variant="pending">ยังไม่เข้าร่วม</Badge>;
    }
    if (attendance.checkedIn && !attendance.checkedOut) {
      return <Badge variant="active">เข้าร่วมแล้ว</Badge>;
    }
    return <Badge variant="suspend">เสร็จสิ้น</Badge>;
  };

  const getCurrentPosition = (): Promise<GeolocationPosition> => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error('เบราว์เซอร์ไม่รองรับ GPS'));
        return;
      }
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      });
    });
  };

  const handleCheckIn = async () => {
    try {
      setActionLoading(true);
      setError(null);
      setGpsStatus('กำลังค้นหาตำแหน่ง GPS...');

      const position = await getCurrentPosition();
      const { latitude, longitude } = position.coords;
      setGpsStatus(null);

      await eventService.checkIn(eventId, { latitude, longitude });
      await fetchData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message :
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'เกิดข้อผิดพลาด';
      setError(message);
      setGpsStatus(null);
    } finally {
      setActionLoading(false);
    }
  };

  const handleCheckOut = async () => {
    try {
      setActionLoading(true);
      setError(null);
      setGpsStatus('กำลังค้นหาตำแหน่ง GPS...');

      const position = await getCurrentPosition();
      const { latitude, longitude } = position.coords;
      setGpsStatus(null);

      await eventService.checkOut(eventId, { latitude, longitude });
      await fetchData();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message :
        (err as { response?: { data?: { error?: string } } })?.response?.data?.error || 'เกิดข้อผิดพลาด';
      setError(message);
      setGpsStatus(null);
    } finally {
      setActionLoading(false);
    }
  };

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const formatTime = (dateString: string) => {
    return new Date(dateString).toLocaleTimeString('th-TH', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  if (loading) {
    return (
      <div className="p-4 pb-20 bg-gray-50 min-h-screen flex justify-center items-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500" />
      </div>
    );
  }

  if (!event) {
    return (
      <div className="p-4 pb-20 bg-gray-50 min-h-screen">
        <Card className="p-8 text-center">
          <h3 className="text-lg font-medium text-gray-900">ไม่พบกิจกรรม</h3>
          <Button className="mt-4" onClick={() => router.push('/manager/events')}>
            กลับหน้ารายการ
          </Button>
        </Card>
      </div>
    );
  }

  const status = getEventStatus(event);
  const locationName = event.location?.locationName || event.venueName || '-';
  const locationAddress = event.location?.address || '-';

  return (
    <div className="p-4 pb-20 bg-gray-50 min-h-screen">
      {/* Header */}
      <div className="mb-4">
        <button
          onClick={() => router.push('/manager/events')}
          className="flex items-center text-sm text-gray-600 hover:text-gray-800 mb-3"
        >
          <svg className="h-4 w-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          กลับหน้ารายการ
        </button>
      </div>

      {/* Event Info Card */}
      <Card className="p-5 mb-4">
        <div className="flex items-start justify-between mb-3">
          <h1 className="text-xl font-bold text-gray-800">{event.eventName}</h1>
          <div className="flex flex-col items-end gap-1">
            {getStatusBadge(status)}
            {getAttendanceBadge()}
          </div>
        </div>

        {event.description && (
          <p className="text-sm text-gray-600 mb-4">{event.description}</p>
        )}

        <div className="space-y-3">
          {/* สถานที่ */}
          <div className="flex items-start text-sm">
            <svg className="h-5 w-5 mr-2 text-gray-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <div>
              <p className="font-medium text-gray-800">{locationName}</p>
              {locationAddress !== '-' && (
                <p className="text-gray-500">{locationAddress}</p>
              )}
              {event.location?.radius && (
                <p className="text-gray-400 text-xs">รัศมี {event.location.radius} เมตร</p>
              )}
            </div>
          </div>

          {/* วันเวลา */}
          <div className="flex items-start text-sm">
            <svg className="h-5 w-5 mr-2 text-gray-400 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
            <div>
              <p className="text-gray-800">{formatDateTime(event.startDateTime)}</p>
              <p className="text-gray-500">ถึง {formatDateTime(event.endDateTime)}</p>
            </div>
          </div>

          {/* ผู้จัด */}
          {event.creator && (
            <div className="flex items-center text-sm">
              <svg className="h-5 w-5 mr-2 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <span className="text-gray-600">
                จัดโดย {event.creator.firstName} {event.creator.lastName}
              </span>
            </div>
          )}
        </div>
      </Card>

      {/* Event Location Map */}
      {(() => {
        const lat = event.location?.latitude ?? event.venueLatitude;
        const lng = event.location?.longitude ?? event.venueLongitude;
        const radius = event.location?.radius;
        if (lat && lng) {
          return (
            <Card className="p-4 mb-4 overflow-hidden">
              <h2 className="text-lg font-semibold text-gray-800 mb-3">
                <svg className="inline h-5 w-5 mr-1.5 text-gray-500 -mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                </svg>
                แผนที่สถานที่จัดกิจกรรม
              </h2>
              <div className="rounded-lg overflow-hidden border border-gray-200" style={{ height: 280 }}>
                <MapContainer
                  center={[lat, lng]}
                  zoom={16}
                  style={{ height: '100%', width: '100%' }}
                  scrollWheelZoom={false}
                  dragging={true}
                  zoomControl={true}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <Marker position={[lat, lng]}>
                    <Popup>{locationName}</Popup>
                  </Marker>
                  {radius && (
                    <Circle
                      center={[lat, lng]}
                      radius={radius}
                      pathOptions={{ color: '#f97316', fillColor: '#f97316', fillOpacity: 0.15, weight: 2 }}
                    />
                  )}
                </MapContainer>
              </div>
              {radius && (
                <p className="text-xs text-gray-400 mt-2 text-center">
                  วงกลมแสดงรัศมีการ Check-in ({radius} เมตร)
                </p>
              )}
            </Card>
          );
        }
        return null;
      })()}

      {/* Attendance Info Card */}
      {attendance?.checkedIn && attendance.attendance && (
        <Card className="p-5 mb-4">
          <h2 className="text-lg font-semibold text-gray-800 mb-3">ประวัติการเข้าร่วม</h2>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-500">เวลา Check-in</span>
              <span className="text-gray-800 font-medium">
                {formatTime(attendance.attendance.checkIn)}
              </span>
            </div>
            {attendance.attendance.checkOut && (
              <div className="flex justify-between text-sm">
                <span className="text-gray-500">เวลา Check-out</span>
                <span className="text-gray-800 font-medium">
                  {formatTime(attendance.attendance.checkOut)}
                </span>
              </div>
            )}
          </div>
        </Card>
      )}

      {/* Error Message */}
      {error && (
        <Card className="p-4 mb-4 border-red-200 bg-red-50">
          <p className="text-sm text-red-600">{error}</p>
        </Card>
      )}

      {/* GPS Status */}
      {gpsStatus && (
        <Card className="p-4 mb-4 border-blue-200 bg-blue-50">
          <div className="flex items-center text-sm text-blue-600">
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-blue-500 mr-2" />
            {gpsStatus}
          </div>
        </Card>
      )}

      {/* Action Buttons */}
      {status === 'ongoing' && (
        <div className="space-y-3">
          {!attendance?.checkedIn && (
            <Button
              className="w-full h-14 text-lg font-semibold bg-green-600 hover:bg-green-700"
              onClick={handleCheckIn}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                  กำลังดำเนินการ...
                </div>
              ) : (
                <>
                  <svg className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Check-in เข้าร่วมกิจกรรม
                </>
              )}
            </Button>
          )}

          {attendance?.checkedIn && !attendance?.checkedOut && (
            <Button
              className="w-full h-14 text-lg font-semibold bg-orange-600 hover:bg-orange-700"
              onClick={handleCheckOut}
              disabled={actionLoading}
            >
              {actionLoading ? (
                <div className="flex items-center">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white mr-2" />
                  กำลังดำเนินการ...
                </div>
              ) : (
                <>
                  <svg className="h-6 w-6 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                      d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Check-out ออกจากกิจกรรม
                </>
              )}
            </Button>
          )}

          {attendance?.checkedIn && attendance?.checkedOut && (
            <Card className="p-4 text-center border-green-200 bg-green-50">
              <svg className="mx-auto h-12 w-12 text-green-500 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="text-green-700 font-medium">เข้าร่วมกิจกรรมเสร็จสิ้นแล้ว</p>
            </Card>
          )}
        </div>
      )}

      {status === 'upcoming' && (
        <Card className="p-4 text-center border-blue-200 bg-blue-50">
          <p className="text-blue-700 text-sm">กิจกรรมยังไม่เริ่ม — จะสามารถ Check-in ได้เมื่อถึงเวลาที่กำหนด</p>
        </Card>
      )}

      {status === 'completed' && !attendance?.checkedIn && (
        <Card className="p-4 text-center border-gray-200 bg-gray-50">
          <p className="text-gray-500 text-sm">กิจกรรมสิ้นสุดแล้ว — คุณไม่ได้เข้าร่วม</p>
        </Card>
      )}
    </div>
  );
}