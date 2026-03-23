"use client";

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import eventService, { EventItem } from '@/services/eventService';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import AlertDialog from '@/components/common/AlertDialog';

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const eventId = params.id as string;

  const [event, setEvent] = useState<EventItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [alertDialog, setAlertDialog] = useState({
    isOpen: false,
    type: 'info' as 'info' | 'success' | 'error' | 'warning',
    title: '',
    message: ''
  });

  useEffect(() => {
    const fetchEvent = async () => {
      try {
        const data = await eventService.getById(parseInt(eventId));
        setEvent(data);
      } catch (err) {
        console.error('[EventDetail] fetch error:', err);
        setAlertDialog({
          isOpen: true,
          type: 'error',
          title: 'ไม่พบข้อมูล',
          message: 'ไม่สามารถโหลดข้อมูลกิจกรรมได้'
        });
      } finally {
        setIsLoading(false);
      }
    };

    if (eventId) {
      fetchEvent();
    }
  }, [eventId]);

  const formatDateTime = (dateStr: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getStatusBadge = () => {
    if (!event) return null;
    const now = new Date();
    const start = new Date(event.startDateTime);
    const end = new Date(event.endDateTime);

    if (end < now) {
      return <Badge variant="suspend">เสร็จสิ้นแล้ว</Badge>;
    } else if (start <= now && now <= end) {
      return <Badge variant="active">กำลังดำเนินการ</Badge>;
    } else {
      return <Badge variant="default">กำลังจะมาถึง</Badge>;
    }
  };

  const getParticipantTypeLabel = (type: string) => {
    switch (type) {
      case 'ALL': return 'ทุกคน';
      case 'BRANCH': return 'ตามสาขา';
      case 'ROLE': return 'ตามบทบาท';
      case 'INDIVIDUAL': return 'ระบุคน';
      default: return type;
    }
  };

  const getRoleLabel = (role: string) => {
    switch (role) {
      case 'USER': return 'พนักงานทั่วไป';
      case 'MANAGER': return 'ผู้จัดการ';
      case 'ADMIN': return 'ผู้ดูแลระบบ';
      case 'SUPERADMIN': return 'ผู้ดูแลระบบสูงสุด';
      default: return role;
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 border-b-2 border-orange-600 rounded-full animate-spin" />
          <p className="text-gray-500">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  if (!event) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Card className="p-8 text-center max-w-md">
          <svg className="w-16 h-16 mx-auto mb-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-xl font-bold text-gray-900 mb-2">ไม่พบกิจกรรม</h2>
          <p className="text-gray-500 mb-4">กิจกรรมที่คุณค้นหาอาจถูกลบหรือไม่มีอยู่ในระบบ</p>
          <Button onClick={() => router.push('/superadmin/event-management')}>
            กลับไปหน้ารายการ
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 py-8">
      <div className="container mx-auto px-4 max-w-5xl">
        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Button
            variant="outline"
            onClick={() => router.push('/superadmin/event-management')}
            className="flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            กลับ
          </Button>
          <h1 className="text-2xl font-bold text-gray-900">รายละเอียดกิจกรรม</h1>
        </div>

        {/* Main Info Card */}
        <Card className="p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">{event.eventName}</h2>
              <div className="flex items-center gap-3">
                {getStatusBadge()}
                {event.isActive ? (
                  <Badge variant="active">ใช้งาน</Badge>
                ) : (
                  <Badge variant="suspend">ไม่ใช้งาน</Badge>
                )}
                <Badge variant="default">{getParticipantTypeLabel(event.participantType)}</Badge>
              </div>
            </div>
          </div>

          {event.description && (
            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <h3 className="text-sm font-medium text-gray-700 mb-2">รายละเอียด</h3>
              <p className="text-gray-600 whitespace-pre-wrap">{event.description}</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Date & Time */}
            <div>
              <h3 className="text-sm font-medium text-gray-700 mb-3">วันและเวลา</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-gray-600">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-sm">เริ่ม: {formatDateTime(event.startDateTime)}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-600">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-sm">สิ้นสุด: {formatDateTime(event.endDateTime)}</span>
                </div>
              </div>
            </div>

            {/* Location */}
            {event.location && (
              <div>
                <h3 className="text-sm font-medium text-gray-700 mb-3">สถานที่</h3>
                <div className="space-y-2">
                  <div className="flex items-center gap-2 text-gray-600">
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    <span className="text-sm font-medium">{event.location.locationName}</span>
                  </div>
                  {event.location.address && (
                    <p className="text-sm text-gray-500 ml-7">{event.location.address}</p>
                  )}
                  <div className="text-sm text-gray-500 ml-7">
                    รัศมี: {event.location.radius} เมตร
                  </div>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Participants Card */}
        <Card className="p-6 mb-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">ผู้เข้าร่วม</h3>
          
          {event.participantType === 'ALL' && (
            <div className="text-center py-8">
              <svg className="w-16 h-16 mx-auto mb-3 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p className="text-gray-600">กิจกรรมนี้เปิดให้ทุกคนเข้าร่วมได้</p>
            </div>
          )}

          {event.participantType === 'BRANCH' && event.participants && event.participants.length > 0 && (
            <div>
              <p className="text-sm text-gray-600 mb-3">สาขาที่เข้าร่วม:</p>
              <div className="flex flex-wrap gap-2">
                {event.participants
                  .filter(p => p.branch)
                  .map((p, idx) => (
                    <Badge key={idx} variant="default">{p.branch?.name}</Badge>
                  ))}
              </div>
            </div>
          )}

          {event.participantType === 'ROLE' && event.participants && event.participants.length > 0 && (
            <div>
              <p className="text-sm text-gray-600 mb-3">บทบาทที่เข้าร่วม:</p>
              <div className="flex flex-wrap gap-2">
                {Array.from(new Set(event.participants.map(p => p.user?.role).filter(Boolean))).map((role, idx) => (
                  <Badge key={idx} variant="default">{getRoleLabel(role!)}</Badge>
                ))}
              </div>
            </div>
          )}

          {event.participantType === 'INDIVIDUAL' && event.participants && event.participants.length > 0 && (
            <div>
              <p className="text-sm text-gray-600 mb-3">รายชื่อผู้เข้าร่วม ({event.participants.length} คน):</p>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {event.participants.map((p, idx) => (
                  <div key={idx} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                    <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                      <span className="text-orange-600 font-medium">
                        {p.user?.firstName?.charAt(0)}{p.user?.lastName?.charAt(0)}
                      </span>
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">
                        {p.user?.firstName} {p.user?.lastName}
                      </p>
                      {p.user?.email && (
                        <p className="text-sm text-gray-500">{p.user.email}</p>
                      )}
                    </div>
                    {p.user?.role && (
                      <Badge variant="default">{getRoleLabel(p.user.role)}</Badge>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Attendance Count */}
          {event._count && (
            <div className="mt-6 pt-4 border-t">
              <div className="flex items-center gap-6 text-sm">
                {event._count.event_participants !== undefined && (
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
                    </svg>
                    <span className="text-gray-600">ผู้เข้าร่วม: <strong>{event._count.event_participants}</strong> คน</span>
                  </div>
                )}
                {(event._count.attendance !== undefined || event._count.attendances !== undefined) && (
                  <div className="flex items-center gap-2">
                    <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-gray-600">เข้าร่วมแล้ว: <strong>{event._count.attendance ?? event._count.attendances ?? 0}</strong> คน</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </Card>

        {/* Creator & Meta Info */}
        <Card className="p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4">ข้อมูลเพิ่มเติม</h3>
          <div className="space-y-3 text-sm">
            {event.creator && (
              <div className="flex items-center gap-2">
                <span className="text-gray-600">สร้างโดย:</span>
                <span className="font-medium text-gray-900">
                  {event.creator.firstName} {event.creator.lastName}
                  {event.creator.email && ` (${event.creator.email})`}
                </span>
              </div>
            )}
            {event.createdAt && (
              <div className="flex items-center gap-2">
                <span className="text-gray-600">วันที่สร้าง:</span>
                <span className="text-gray-900">{formatDateTime(event.createdAt)}</span>
              </div>
            )}
            {event.updatedAt && (
              <div className="flex items-center gap-2">
                <span className="text-gray-600">แก้ไขล่าสุด:</span>
                <span className="text-gray-900">{formatDateTime(event.updatedAt)}</span>
                {event.updatedBy && (
                  <span className="text-gray-600">
                    โดย {event.updatedBy.firstName} {event.updatedBy.lastName}
                  </span>
                )}
              </div>
            )}
            {event.deletedAt && (
              <div className="flex items-center gap-2 text-red-600">
                <span>ถูกลบเมื่อ:</span>
                <span>{formatDateTime(event.deletedAt)}</span>
                {event.deleteReason && <span>({event.deleteReason})</span>}
              </div>
            )}
          </div>
        </Card>
      </div>

      {/* Alert Dialog */}
      <AlertDialog
        isOpen={alertDialog.isOpen}
        onClose={() => setAlertDialog({ ...alertDialog, isOpen: false })}
        type={alertDialog.type}
        title={alertDialog.title}
        message={alertDialog.message}
      />
    </div>
  );
}
