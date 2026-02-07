"use client";

import { useState, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useEvents, useLocations } from '@/contexts/mock-contexts';
import { EventData } from '@/types/event';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import AlertDialog from '@/components/common/AlertDialog';

const EventMap = dynamic(() => import('@/components/admin/EventMap'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center w-full h-[500px] bg-gray-100 rounded-2xl">
      <div className="text-center">
        <div className="w-12 h-12 mx-auto mb-4 border-b-2 border-orange-600 rounded-full animate-spin"></div>
        <p className="text-sm text-gray-500">กำลังโหลดแผนที่...</p>
      </div>
    </div>
  )
});

const hours = Array.from({ length: 24 }, (_, i) => i.toString().padStart(2, '0'));
const minutes = Array.from({ length: 60 }, (_, i) => i.toString().padStart(2, '0'));

export default function EventManagementTab() {
  const { events, addEvent, updateEvent, deleteEvent } = useEvents();
  const { locations } = useLocations();

  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: '',
    date: '',
    description: '',
    locationName: '',
    radius: '',
    latitude: '',
    longitude: '',
    startTime: '',
    endTime: '',
    teams: '',
    status: 'ongoing' as 'ongoing' | 'completed'
  });

  const [editFormData, setEditFormData] = useState<Partial<EventData>>({});
  const [showStartTimePicker, setShowStartTimePicker] = useState(false);
  const [showEndTimePicker, setShowEndTimePicker] = useState(false);

  const [alertDialog, setAlertDialog] = useState({
    isOpen: false,
    type: 'info' as 'info' | 'success' | 'error' | 'warning',
    title: '',
    message: ''
  });

  const [confirmDialog, setConfirmDialog] = useState<{
    isOpen: boolean;
    title?: string;
    message?: string;
    onConfirm?: () => void;
    onCancel?: () => void;
  }>({
    isOpen: false
  });

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (editingEventId) {
      setEditFormData(prev => ({ ...prev, [name]: value }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleTimeSelect = (hour: string, minute: string, isStart: boolean) => {
    const time = `${hour}:${minute}`;
    if (isStart) {
      setFormData(prev => ({ ...prev, startTime: time }));
      setShowStartTimePicker(false);
    } else {
      setFormData(prev => ({ ...prev, endTime: time }));
      setShowEndTimePicker(false);
    }
  };

  const handleMapClick = (latlng: { lat: number; lng: number }) => {
    if (editingEventId) {
      setEditFormData(prev => ({
        ...prev,
        latitude: latlng.lat,
        longitude: latlng.lng
      }));
    } else {
      setFormData(prev => ({
        ...prev,
        latitude: latlng.lat.toString(),
        longitude: latlng.lng.toString()
      }));
    }
  };

  const handleAddEvent = () => {
    if (!formData.name || !formData.date || !formData.locationName) {
      setAlertDialog({
        isOpen: true,
        type: 'error',
        title: 'ข้อมูลไม่ครบ',
        message: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน'
      });
      return;
    }

    const newEvent: EventData = {
      id: `event-${Date.now()}`,
      name: formData.name,
      date: formData.date,
      description: formData.description,
      locationName: formData.locationName,
      radius: formData.radius ? parseInt(formData.radius) : undefined,
      latitude: parseFloat(formData.latitude) || 13.7563,
      longitude: parseFloat(formData.longitude) || 100.5018,
      startTime: formData.startTime,
      endTime: formData.endTime,
      teams: formData.teams,
      status: formData.status,
      createdAt: new Date().toISOString()
    };

    addEvent(newEvent);

    setAlertDialog({
      isOpen: true,
      type: 'success',
      title: 'สำเร็จ!',
      message: 'เพิ่มกิจกรรมใหม่เรียบร้อยแล้ว'
    });

    setFormData({
      name: '',
      date: '',
      description: '',
      locationName: '',
      radius: '',
      latitude: '',
      longitude: '',
      startTime: '',
      endTime: '',
      teams: '',
      status: 'ongoing'
    });
    setIsAddingEvent(false);
  };

  const handleDeleteEvent = (event: EventData) => {
    setConfirmDialog({
      isOpen: true,
      title: 'ยืนยันการลบ',
      message: `คุณแน่ใจหรือไม่ที่จะลบกิจกรรม "${event.name}"?`,
      onConfirm: () => {
        deleteEvent(event.id);
        setAlertDialog({
          isOpen: true,
          type: 'success',
          title: 'ลบสำเร็จ',
          message: 'ลบกิจกรรมเรียบร้อยแล้ว'
        });
        setConfirmDialog({ isOpen: false });
      },
      onCancel: () => setConfirmDialog({ isOpen: false })
    });
  };

  const formatDateDisplay = (dateStr: string): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  const getStatusVariant = (status: string): "active" | "suspend" | "default" => {
    return status === 'ongoing' ? 'active' : 'suspend';
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <Button
          onClick={() => setIsAddingEvent(!isAddingEvent)}
          className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700"
        >
          {isAddingEvent ? (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
              ยกเลิก
            </>
          ) : (
            <>
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              เพิ่มกิจกรรมใหม่
            </>
          )}
        </Button>
      </div>

      {isAddingEvent && (
        <Card className="p-6 border-2 border-orange-300 bg-orange-50/30">
          <h2 className="mb-4 text-xl font-bold text-gray-900">เพิ่มกิจกรรมใหม่</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <input
              name="name"
              value={formData.name}
              onChange={handleInputChange}
              placeholder="ชื่อกิจกรรม *"
              className="px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-gray-900"
            />
            <input
              name="date"
              type="date"
              value={formData.date}
              onChange={handleInputChange}
              className="px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-gray-900"
            />
            <input
              name="locationName"
              value={formData.locationName}
              onChange={handleInputChange}
              placeholder="ชื่อสถานที่ *"
              className="px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-gray-900"
            />
            <input
              name="radius"
              type="number"
              value={formData.radius}
              onChange={handleInputChange}
              placeholder="รัศมี (เมตร)"
              className="px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-gray-900"
            />
            <div className="md:col-span-2">
              <textarea
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                placeholder="รายละเอียด"
                rows={3}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-gray-900"
              />
            </div>
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setIsAddingEvent(false)}>
              ยกเลิก
            </Button>
            <Button onClick={handleAddEvent} className="bg-orange-600 hover:bg-orange-700">
              เพิ่มกิจกรรม
            </Button>
          </div>
        </Card>
      )}

      <Suspense fallback={<div className="h-[500px] bg-gray-100 rounded-2xl animate-pulse" />}>
        <EventMap 
          events={events}
          locations={locations}
          onMapClick={isAddingEvent || editingEventId ? handleMapClick : undefined}
          selectedPosition={
            editingEventId && editFormData.latitude && editFormData.longitude
              ? { lat: editFormData.latitude, lng: editFormData.longitude }
              : isAddingEvent && formData.latitude && formData.longitude
              ? { lat: parseFloat(formData.latitude), lng: parseFloat(formData.longitude) }
              : undefined
          }
        />
      </Suspense>

      <div>
        <h2 className="mb-4 text-xl font-bold text-gray-900">รายการกิจกรรม ({events?.length ?? 0})</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(events || []).map((event) => (
            <Card key={event.id} className="p-4 transition-shadow hover:shadow-md">
              <div className="flex items-start justify-between mb-3">
                <h3 className="text-lg font-bold text-gray-900">{event.name}</h3>
                <Badge variant={getStatusVariant(event.status)}>
                  {event.status === 'ongoing' ? 'เริ่มงานแล้ว' : 'เสร็จสิ้น'}
                </Badge>
              </div>
              
              <div className="space-y-2 text-sm text-gray-600">
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span>{formatDateDisplay(event.date)}</span>
                </div>
                
                <div className="flex items-center gap-2">
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <span>{event.locationName}</span>
                </div>
              </div>

              <div className="mt-4">
                <Button 
                  size="sm" 
                  variant="destructive" 
                  onClick={() => handleDeleteEvent(event)}
                  className="w-full"
                >
                  ลบ
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>

      <AlertDialog
        isOpen={alertDialog.isOpen}
        onClose={() => setAlertDialog({ ...alertDialog, isOpen: false })}
        type={alertDialog.type}
        title={alertDialog.title}
        message={alertDialog.message}
        autoClose
      />

      {confirmDialog.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={confirmDialog.onCancel}></div>
          <Card className="relative z-10 w-full max-w-md p-6">
            <h3 className="mb-2 text-lg font-semibold">{confirmDialog.title}</h3>
            <p className="mb-6 text-sm text-gray-700">{confirmDialog.message}</p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={confirmDialog.onCancel}>
                ยกเลิก
              </Button>
              <Button variant="destructive" onClick={confirmDialog.onConfirm}>
                ยืนยัน
              </Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}
