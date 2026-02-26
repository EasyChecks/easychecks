"use client";

import { useState, useMemo, useCallback, useEffect, Suspense } from 'react';
import dynamic from 'next/dynamic';
import eventService, { EventItem as ApiEventItem } from '@/services/eventService';
import locationService, { LocationItem } from '@/services/locationService';
import { EventData, LocationData, DialogState } from '@/types/event';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import AlertDialog from '@/components/common/AlertDialog';

// Dynamic import for Leaflet components (client-side only)
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

// ── Helpers: map API types → UI types ──
const apiEventToEventData = (e: ApiEventItem): EventData => ({
  id: String(e.eventId),
  name: e.eventName,
  date: e.startDateTime ? e.startDateTime.split('T')[0] : '',
  description: e.description,
  locationName: e.location?.locationName || '',
  radius: e.location?.radius,
  latitude: e.location?.latitude ?? 13.7563,
  longitude: e.location?.longitude ?? 100.5018,
  startTime: e.startDateTime
    ? new Date(e.startDateTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false })
    : '',
  endTime: e.endDateTime
    ? new Date(e.endDateTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', hour12: false })
    : '',
  teams: '',
  status: new Date(e.endDateTime) < new Date() ? 'completed' : 'ongoing',
  createdAt: e.createdAt,
});

const apiLocationToLocationData = (loc: LocationItem): LocationData => ({
  id: String(loc.locationId),
  locationName: loc.locationName,
  latitude: loc.latitude,
  longitude: loc.longitude,
  radius: loc.radius,
  createdAt: loc.createdAt,
});

// Build ISO datetime string from date + time strings (local time)
const toISO = (date: string, time: string) => {
  if (!date) return new Date().toISOString();
  const [h = '08', m = '00'] = (time || '08:00').split(':');
  const d = new Date(`${date}T${h}:${m}:00`);
  return d.toISOString();
};

export default function EventManagement() {
  // ── API data state ──
  const [events, setEvents] = useState<EventData[]>([]);
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [isLoadingPage, setIsLoadingPage] = useState(true);

  // ── Fetch events + locations on mount ──
  useEffect(() => {
    const load = async () => {
      try {
        const [eventsResp, locsResp] = await Promise.all([
          eventService.getAll({ take: 100 }),
          locationService.getAll(),
        ]);
        setEvents(eventsResp.data.map(apiEventToEventData));
        setLocations(locsResp.map(apiLocationToLocationData));
      } catch (err) {
        console.error('[EventManagement] load error:', err);
      } finally {
        setIsLoadingPage(false);
      }
    };
    load();
  }, []);

  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [selectedEvent, setSelectedEvent] = useState<EventData | null>(null);

  // Form states
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

  // Time picker states - OPTIMIZED: 1 object instead of 4 states!
  const [timePickers, setTimePickers] = useState({
    start: false,
    end: false,
    editStart: false,
    editEnd: false
  });

  // Dialog states
  const [alertDialog, setAlertDialog] = useState({
    isOpen: false,
    type: 'info' as 'info' | 'success' | 'error' | 'warning',
    title: '',
    message: ''
  });

  const [confirmDialog, setConfirmDialog] = useState<DialogState>({
    isOpen: false
  });

  // Memoized computed value
  const selectedPosition = useMemo(() => {
    if (editingEventId && editFormData.latitude && editFormData.longitude) {
      return { lat: editFormData.latitude, lng: editFormData.longitude };
    }
    if (isAddingEvent && formData.latitude && formData.longitude) {
      return { lat: parseFloat(formData.latitude), lng: parseFloat(formData.longitude) };
    }
    return undefined;
  }, [editingEventId, editFormData.latitude, editFormData.longitude, isAddingEvent, formData.latitude, formData.longitude]);

  // OPTIMIZED: All handlers with useCallback
  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (editingEventId) {
      setEditFormData(prev => ({ ...prev, [name]: value }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  }, [editingEventId]);

  const handleTimeSelect = useCallback((hour: string, minute: string, isStart: boolean, isEdit: boolean = false) => {
    const time = `${hour}:${minute}`;
    if (isEdit) {
      setEditFormData(prev => ({ ...prev, [isStart ? 'startTime' : 'endTime']: time }));
      setTimePickers(prev => ({ ...prev, [isStart ? 'editStart' : 'editEnd']: false }));
    } else {
      setFormData(prev => ({ ...prev, [isStart ? 'startTime' : 'endTime']: time }));
      setTimePickers(prev => ({ ...prev, [isStart ? 'start' : 'end']: false }));
    }
  }, []);

  const handleMapClick = useCallback((latlng: { lat: number; lng: number }) => {
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
  }, [editingEventId]);

  const handleAddEvent = useCallback(async () => {
    if (!formData.name || !formData.date) {
      setAlertDialog({
        isOpen: true,
        type: 'error',
        title: 'ข้อมูลไม่ครบ',
        message: 'กรุณากรอกชื่อกิจกรรมและวันที่'
      });
      return;
    }

    try {
      // 1. Create location first
      const newLoc = await locationService.create({
        locationName: formData.locationName || 'ไม่ระบุสถานที่',
        address:      formData.locationName || '',
        latitude:     parseFloat(formData.latitude)  || 13.7563,
        longitude:    parseFloat(formData.longitude) || 100.5018,
        radius:       parseInt(formData.radius)      || 100,
      });

      // 2. Create event
      const created = await eventService.create({
        eventName:       formData.name,
        description:     formData.description || undefined,
        locationId:      newLoc.locationId,
        startDateTime:   toISO(formData.date, formData.startTime),
        endDateTime:     toISO(formData.date, formData.endTime),
        participantType: 'ALL',
      });

      setEvents(prev => [apiEventToEventData(created), ...prev]);
      setAlertDialog({ isOpen: true, type: 'success', title: 'สำเร็จ!', message: 'เพิ่มกิจกรรมใหม่เรียบร้อยแล้ว' });
      setFormData({ name:'', date:'', description:'', locationName:'', radius:'', latitude:'', longitude:'', startTime:'', endTime:'', teams:'', status:'ongoing' });
      setIsAddingEvent(false);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setAlertDialog({ isOpen: true, type: 'error', title: 'ผิดพลาด', message: e.response?.data?.error || 'เวลาสร้างกิจกรรมล้มเหลว' });
    }
  }, [formData]);

  const handleEditEvent = useCallback((event: EventData) => {
    setEditingEventId(event.id);
    setEditFormData({ ...event });
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editFormData.name || !editFormData.date) {
      setAlertDialog({ isOpen: true, type: 'error', title: 'ข้อมูลไม่ครบ', message: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน' });
      return;
    }
    try {
      const updated = await eventService.update(parseInt(editingEventId!), {
        eventName:     editFormData.name,
        description:   editFormData.description,
        startDateTime: toISO(editFormData.date!, editFormData.startTime || ''),
        endDateTime:   toISO(editFormData.date!, editFormData.endTime   || ''),
      });
      setEvents(prev => prev.map(e => e.id === editingEventId ? apiEventToEventData(updated) : e));
      setAlertDialog({ isOpen: true, type: 'success', title: 'บันทึกสำเร็จ', message: 'แก้ไขข้อมูลกิจกรรมเรียบร้อยแล้ว' });
      setEditingEventId(null);
      setEditFormData({});
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setAlertDialog({ isOpen: true, type: 'error', title: 'ผิดพลาด', message: e.response?.data?.error || 'เวลาแก้ไขล้มเหลว' });
    }
  }, [editFormData, editingEventId]);

  const handleCancelEdit = useCallback(() => {
    setEditingEventId(null);
    setEditFormData({});
  }, []);

  const handleDeleteEvent = useCallback((event: EventData) => {
    setConfirmDialog({
      isOpen: true,
      title: 'ยืนยันการลบ',
      message: `คุณแน่ใจหรือไม่ที่จะลบกิจกรรม "${event.name}"?`,
      onConfirm: async () => {
        try {
          await eventService.delete(parseInt(event.id), 'ลบโดยผู้ดูแลระบบ');
          setEvents(prev => prev.filter(e => e.id !== event.id));
          setAlertDialog({ isOpen: true, type: 'success', title: 'ลบสำเร็จ', message: 'ลบกิจกรรมเรียบร้อยแล้ว' });
        } catch (err: unknown) {
          const e = err as { response?: { data?: { error?: string } } };
          setAlertDialog({ isOpen: true, type: 'error', title: 'ผิดพลาด', message: e.response?.data?.error || 'ไม่สามารถลบกิจกรรมนี้ได้' });
        }
        setConfirmDialog({ isOpen: false });
      },
      onCancel: () => setConfirmDialog({ isOpen: false })
    });
  }, []);

  const formatDateDisplay = useCallback((dateStr: string): string => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('th-TH', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }, []);

  const getStatusVariant = useCallback((status: string): "active" | "suspend" | "default" => {
    return status === 'ongoing' ? 'active' : 'suspend';
  }, []);

  if (isLoadingPage) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 border-b-2 border-orange-600 rounded-full animate-spin" />
          <p className="text-gray-500">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 bg-slate-50 sm:p-6">
      <Card className="p-6 border border-orange-100 shadow-sm">
        {/* Header */}
        <div className="flex flex-col items-start justify-between gap-4 mb-6 sm:flex-row sm:items-center">
          <div>
            <h1 className="flex items-center gap-2 text-3xl font-bold text-gray-900">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              จัดการงานกิจกรรม
            </h1>
            <p className="mt-1 text-sm text-gray-500">สร้างและจัดการงานกิจกรรมต่างๆ</p>
          </div>
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

        {/* Add Event Form */}
        {isAddingEvent && (
          <Card className="p-6 mb-6 border-2 border-orange-300 bg-orange-50/30">
            <h2 className="mb-4 text-xl font-bold text-gray-900">เพิ่มกิจกรรมใหม่</h2>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <FormField
                label="ชื่อกิจกรรม"
                name="name"
                value={formData.name}
                onChange={handleInputChange}
                required
                placeholder="เช่น กิจกรรมเปิดตัวสินค้า"
              />
              <FormField
                label="วันที่"
                name="date"
                type="date"
                value={formData.date}
                onChange={handleInputChange}
                required
              />
              <FormField
                label="ชื่อสถานที่"
                name="locationName"
                value={formData.locationName}
                onChange={handleInputChange}
                required
                placeholder="เช่น Siam Square ชั้น 4"
              />
              <FormField
                label="รัศมี (เมตร)"
                name="radius"
                type="number"
                value={formData.radius}
                onChange={handleInputChange}
                placeholder="เช่น 100"
              />
              <TimePickerField
                label="เวลาเริ่มต้น"
                value={formData.startTime}
                showPicker={timePickers.start}
                onTogglePicker={() => setTimePickers(prev => ({ ...prev, start: !prev.start }))}
                onSelectTime={(hour, minute) => handleTimeSelect(hour, minute, true, false)}
              />
              <TimePickerField
                label="เวลาสิ้นสุด"
                value={formData.endTime}
                showPicker={timePickers.end}
                onTogglePicker={() => setTimePickers(prev => ({ ...prev, end: !prev.end }))}
                onSelectTime={(hour, minute) => handleTimeSelect(hour, minute, false, false)}
              />
              <div className="md:col-span-2">
                <FormField
                  label="รายละเอียด"
                  name="description"
                  value={formData.description || ''}
                  onChange={handleInputChange}
                  textarea
                  placeholder=" เช่น กิจกรรมเปิดตัวและติดตั้ง รับประทานอาหาร"
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

        {/* Map */}
        <div className="mb-6">
          <Suspense fallback={<div className="h-[500px] bg-gray-100 rounded-2xl animate-pulse" />}>
            <EventMap 
              events={events}
              locations={locations}
              onMapClick={isAddingEvent || editingEventId ? handleMapClick : undefined}
              selectedPosition={selectedPosition}
            />
          </Suspense>
        </div>

        {/* Events List */}
        <div>
          <h2 className="mb-4 text-xl font-bold text-gray-900">รายการกิจกรรม ({events?.length ?? 0})</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {(events?.length ?? 0) === 0 ? (
              <div className="col-span-full">
                <Card className="p-12 text-center">
                  <div className="flex flex-col items-center gap-3">
                    <svg className="w-16 h-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    <p className="text-gray-500">ยังไม่มีกิจกรรมในระบบ</p>
                  </div>
                </Card>
              </div>
            ) : (
              events.map((event) => (
                <EventCard
                  key={event.id}
                  event={event}
                  isEditing={editingEventId === event.id}
                  editFormData={editFormData}
                  onEdit={() => handleEditEvent(event)}
                  onSave={handleSaveEdit}
                  onCancel={handleCancelEdit}
                  onDelete={() => handleDeleteEvent(event)}
                  onInputChange={handleInputChange}
                  showEditStartTimePicker={timePickers.editStart}
                  showEditEndTimePicker={timePickers.editEnd}
                  onToggleEditStartTimePicker={() => setTimePickers(prev => ({ ...prev, editStart: !prev.editStart }))}
                  onToggleEditEndTimePicker={() => setTimePickers(prev => ({ ...prev, editEnd: !prev.editEnd }))}
                  onTimeSelect={handleTimeSelect}
                  formatDateDisplay={formatDateDisplay}
                  getStatusVariant={getStatusVariant}
                />
              ))
            )}
          </div>
        </div>
      </Card>

      {/* Alert Dialog */}
      <AlertDialog
        isOpen={alertDialog.isOpen}
        onClose={() => setAlertDialog({ ...alertDialog, isOpen: false })}
        type={alertDialog.type}
        title={alertDialog.title}
        message={alertDialog.message}
        autoClose
      />

      {/* Confirm Dialog */}
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

// Form Field Component
interface FormFieldProps {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
  textarea?: boolean;
}

function FormField({ label, name, value, onChange, type = 'text', required, placeholder, textarea }: FormFieldProps) {
  return (
    <div>
      <label className="block mb-2 text-sm font-semibold text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      {textarea ? (
        <textarea
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          rows={3}
          className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-gray-900 focus:outline-none transition-all"
        />
      ) : (
        <input
          type={type}
          name={name}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-gray-900 focus:outline-none transition-all"
        />
      )}
    </div>
  );
}

// Time Picker Field Component
interface TimePickerFieldProps {
  label: string;
  value: string;
  showPicker: boolean;
  onTogglePicker: () => void;
  onSelectTime: (hour: string, minute: string) => void;
}

function TimePickerField({ label, value, showPicker, onTogglePicker, onSelectTime }: TimePickerFieldProps) {
  const currentHour = value?.split(':')[0] || '00';
  const currentMinute = value?.split(':')[1] || '00';

  return (
    <div className="relative">
      <label className="block mb-2 text-sm font-semibold text-gray-700">{label}</label>
      <input
        type="text"
        value={value || ''}
        onClick={onTogglePicker}
        placeholder="เลือกเวลา"
        className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-gray-900 focus:outline-none transition-all cursor-pointer"
        readOnly
      />
      {showPicker && (
        <div className="absolute z-50 grid w-64 grid-cols-2 gap-0 mt-2 bg-white border-2 border-orange-300 rounded-xl shadow-lg">
          <div>
            <div className="py-2 text-sm font-semibold text-center text-white rounded-tl-xl bg-gray-900">
              ชั่วโมง
            </div>
            <div className="overflow-y-auto max-h-56">
              {hours.map((hour) => (
                <button
                  key={hour}
                  type="button"
                  onClick={() => onSelectTime(hour, currentMinute)}
                  className={`w-full px-3 py-2 text-center hover:bg-orange-50 transition-colors ${
                    hour === currentHour ? 'bg-orange-100 font-semibold text-orange-600' : ''
                  }`}
                >
                  {hour}
                </button>
              ))}
            </div>
          </div>
          <div>
            <div className="py-2 text-sm font-semibold text-center text-white rounded-tr-xl bg-gray-900">
              นาที
            </div>
            <div className="overflow-y-auto max-h-56">
              {minutes.map((minute) => (
                <button
                  key={minute}
                  type="button"
                  onClick={() => onSelectTime(currentHour, minute)}
                  className={`w-full px-3 py-2 text-center hover:bg-orange-50 transition-colors ${
                    minute === currentMinute ? 'bg-orange-100 font-semibold text-orange-600' : ''
                  }`}
                >
                  {minute}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// Event Card Component
interface EventCardProps {
  event: EventData;
  isEditing: boolean;
  editFormData: Partial<EventData>;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  showEditStartTimePicker: boolean;
  showEditEndTimePicker: boolean;
  onToggleEditStartTimePicker: () => void;
  onToggleEditEndTimePicker: () => void;
  onTimeSelect: (hour: string, minute: string, isStart: boolean, isEdit: boolean) => void;
  formatDateDisplay: (date: string) => string;
  getStatusVariant: (status: string) => "active" | "suspend" | "default";
}

function EventCard({ 
  event, 
  isEditing, 
  editFormData, 
  onEdit, 
  onSave, 
  onCancel, 
  onDelete,
  onInputChange,
  showEditStartTimePicker,
  showEditEndTimePicker,
  onToggleEditStartTimePicker,
  onToggleEditEndTimePicker,
  onTimeSelect,
  formatDateDisplay,
  getStatusVariant
}: EventCardProps) {
  if (isEditing) {
    return (
      <Card className="p-4 border-2 border-orange-300">
        <div className="space-y-3">
          <FormField
            label="ชื่อกิจกรรม"
            name="name"
            value={editFormData.name || ''}
            onChange={onInputChange}
            required
          />
          <FormField
            label="วันที่"
            name="date"
            type="date"
            value={editFormData.date || ''}
            onChange={onInputChange}
            required
          />
          <FormField
            label="ชื่อสถานที่"
            name="locationName"
            value={editFormData.locationName || ''}
            onChange={onInputChange}
            required
          />
          <TimePickerField
            label="เวลาเริ่มต้น"
            value={editFormData.startTime || ''}
            showPicker={showEditStartTimePicker}
            onTogglePicker={onToggleEditStartTimePicker}
            onSelectTime={(hour, minute) => onTimeSelect(hour, minute, true, true)}
          />
          <TimePickerField
            label="เวลาสิ้นสุด"
            value={editFormData.endTime || ''}
            showPicker={showEditEndTimePicker}
            onTogglePicker={onToggleEditEndTimePicker}
            onSelectTime={(hour, minute) => onTimeSelect(hour, minute, false, true)}
          />
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onCancel} className="flex-1">
              ยกเลิก
            </Button>
            <Button size="sm" onClick={onSave} className="flex-1 bg-orange-600 hover:bg-orange-700">
              บันทึก
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 transition-shadow hover:shadow-md">
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
        
        {event.startTime && (
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span>{event.startTime} - {event.endTime || '-'}</span>
          </div>
        )}
        
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>{event.locationName}</span>
        </div>
        
        {event.description && (
          <p className="pt-2 text-xs text-gray-500 border-t">{event.description}</p>
        )}
      </div>

      <div className="flex gap-2 mt-4">
        <Button size="sm" variant="outline" onClick={onEdit} className="flex-1">
          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          แก้ไข
        </Button>
        <Button size="sm" variant="destructive" onClick={onDelete} className="flex-1">
          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          ลบ
        </Button>
      </div>
    </Card>
  );
}
