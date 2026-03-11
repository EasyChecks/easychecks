'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import eventService, { EventItem, EventAttendanceStatus } from '@/services/eventService';

export default function ManagerEventsPage() {
  const { } = useAuth();
  const router = useRouter();
  const [events, setEvents] = useState<EventItem[]>([]);
  const [attendanceMap, setAttendanceMap] = useState<Record<number, EventAttendanceStatus>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchEvents();
  }, []);

  const fetchEvents = async () => {
    try {
      setLoading(true);
      const data = await eventService.getMy();
      setEvents(data);

      // ดึงสถานะ attendance ของแต่ละกิจกรรม
      const attendanceResults = await Promise.all(
        data.map(async (event) => {
          try {
            const att = await eventService.getMyAttendance(event.eventId);
            return { eventId: event.eventId, data: att };
          } catch {
            return { eventId: event.eventId, data: { checkedIn: false, checkedOut: false, attendance: null } };
          }
        })
      );

      const map: Record<number, EventAttendanceStatus> = {};
      for (const result of attendanceResults) {
        map[result.eventId] = result.data;
      }
      setAttendanceMap(map);
    } catch (error) {
      console.error('Failed to fetch events:', error);
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const getEventStatus = (event: EventItem) => {
    const now = new Date();
    const start = new Date(event.startDateTime);
    const end = new Date(event.endDateTime);
    if (now < start) return 'upcoming';
    if (now > end) return 'completed';
    return 'ongoing';
  };

  const getAttendanceBadge = (eventId: number) => {
    const att = attendanceMap[eventId];
    if (!att || !att.checkedIn) {
      return <Badge variant="pending">ยังไม่เข้าร่วม</Badge>;
    }
    if (att.checkedIn && !att.checkedOut) {
      return <Badge variant="active">เข้าร่วมแล้ว</Badge>;
    }
    return <Badge variant="suspend">เสร็จสิ้น</Badge>;
  };

  return (
    <div className="p-4 pb-20 bg-gray-50 min-h-screen">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">อีเวนท์</h1>
        <p className="text-sm text-gray-600 mt-1">
          อีเวนท์ทั้งหมดที่คุณได้รับมอบหมาย
        </p>
      </div>

      {loading ? (
        <div className="flex justify-center items-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-500"></div>
        </div>
      ) : events.length === 0 ? (
        <Card className="p-8 text-center">
          <svg
            className="mx-auto h-16 w-16 text-gray-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
            />
          </svg>
          <h3 className="mt-4 text-lg font-medium text-gray-900">
            ไม่มีอีเวนท์
          </h3>
          <p className="mt-2 text-sm text-gray-500">
            คุณยังไม่ได้รับมอบหมายอีเวนท์ใดๆ
          </p>
        </Card>
      ) : (
        <div className="space-y-4">
          {events.map((event) => {
            const status = getEventStatus(event);
            const isActive = status === 'ongoing';
            return (
              <Card
                key={event.eventId}
                className={`p-4 cursor-pointer transition-shadow hover:shadow-md ${isActive ? 'border-2 border-orange-500 bg-orange-50' : ''}`}
                onClick={() => router.push(`/manager/events/${event.eventId}`)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-semibold text-gray-800">
                        {event.eventName}
                      </h3>
                      {isActive && (
                        <Badge variant="active">กำลังดำเนินการ</Badge>
                      )}
                      {status === 'upcoming' && (
                        <Badge variant="pending">กำลังจะมาถึง</Badge>
                      )}
                      {getAttendanceBadge(event.eventId)}
                    </div>
                    {event.description && (
                      <p className="text-sm text-gray-600 mt-2">
                        {event.description}
                      </p>
                    )}
                    <div className="mt-3 space-y-1">
                      {event.location?.locationName && (
                        <div className="flex items-center text-sm text-gray-600">
                          <svg
                            className="h-4 w-4 mr-2 text-gray-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z"
                            />
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M15 11a3 3 0 11-6 0 3 3 0 016 0z"
                            />
                          </svg>
                          {event.location.locationName}
                        </div>
                      )}
                      <div className="flex items-center text-sm text-gray-600">
                        <svg
                          className="h-4 w-4 mr-2 text-gray-400"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                          />
                        </svg>
                        {formatDate(event.startDateTime)} - {formatDate(event.endDateTime)}
                      </div>
                      {event.location?.radius && (
                        <div className="flex items-center text-sm text-gray-600">
                          <svg
                            className="h-4 w-4 mr-2 text-gray-400"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7"
                            />
                          </svg>
                          รัศมี {event.location.radius} เมตร
                        </div>
                      )}
                    </div>
                  </div>
                  <svg className="h-5 w-5 text-gray-400 mt-1 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                  </svg>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
