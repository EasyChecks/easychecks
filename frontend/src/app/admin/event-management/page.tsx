"use client";

import { useState, useMemo, useCallback, useEffect, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import eventService, { EventItem as ApiEventItem, ParticipantType, EventStatistics, EventListParams, CreateEventRequest } from '@/services/eventService';
import locationService, { LocationItem } from '@/services/locationService';
import dashboardService, { BranchMapItem } from '@/services/dashboardService';
import { EventData, LocationData, DialogState } from '@/types/event';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import AlertDialog from '@/components/common/AlertDialog';
import { useEventWebSocket } from '@/hooks/useEventWebSocket';

// Dynamic import for Leaflet components (client-side only)
const EventMap = dynamic(() => import('@/components/admin/EventMap'), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center w-full h-125 bg-gray-100 rounded-2xl">
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
const apiEventToEventData = (e: ApiEventItem): EventData => {
  const now = new Date();
  const start = e.startDateTime ? new Date(e.startDateTime) : null;
  const end = e.endDateTime ? new Date(e.endDateTime) : null;
  
  let status: EventData['status'];
  if (!start || !end || isNaN(start.getTime()) || isNaN(end.getTime())) {
    status = 'upcoming'; // fallback
  } else if (end < now) {
    status = 'completed';
  } else if (start <= now && now <= end) {
    status = 'ongoing';
  } else {
    status = 'upcoming';
  }
  
  return {
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
    status,
    createdAt: e.createdAt,
  };
};

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
  const router = useRouter();
  const { user } = useAuth();
  
  // ── API data state ──
  const [events, setEvents] = useState<EventData[]>([]);
  const [eventStats, setEventStats] = useState<EventStatistics | null>(null);
  const [locations, setLocations] = useState<LocationData[]>([]);
  const [branches, setBranches] = useState<BranchMapItem[]>([]);
  const [isLoadingPage, setIsLoadingPage] = useState(true);
  const [isFiltering, setIsFiltering] = useState(false);
  const [activeTab, setActiveTab] = useState<'events' | 'stats'>('events');

  // ── Search & Filter states ──
  const [searchQuery, setSearchQuery] = useState('');
  const [filterParticipantType, setFilterParticipantType] = useState<ParticipantType | ''>('');
  const [filterStatus, setFilterStatus] = useState<'ongoing' | 'upcoming' | 'completed' | ''>('');
  const [filterStartDate, setFilterStartDate] = useState('');
  const [filterEndDate, setFilterEndDate] = useState('');

  // ── Pagination states ──
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize] = useState(12);
  const [totalEvents, setTotalEvents] = useState(0);

  // ── Fetch locations + branches once on mount ──
  useEffect(() => {
    const loadStatic = async () => {
      try {
        const [locsResp, branchesResp] = await Promise.all([
          locationService.getAll(),
          dashboardService.getBranchesMap(),
        ]);
        // Filter out deleted locations
        const nonDeletedLocations = locsResp.data.filter(loc => !loc.deletedAt);
        setLocations(nonDeletedLocations.map(apiLocationToLocationData));
        setBranches(branchesResp.data);
      } catch (err) {
        console.error('[EventManagement] load static error:', err);
      }
    };
    loadStatic();
  }, []);

  // ── Fetch events with filters ──
  const isFirstLoad = events.length === 0 && !searchQuery && !filterParticipantType && !filterStatus && !filterStartDate && !filterEndDate;
  const fetchEvents = useCallback(async () => {
    if (isFirstLoad) setIsLoadingPage(true);
    else setIsFiltering(true);
    try {
      const params: EventListParams = {
        skip: (currentPage - 1) * pageSize,
        take: pageSize,
      };
      if (searchQuery) params.search = searchQuery;
      if (filterParticipantType) params.participantType = filterParticipantType;
      if (filterStartDate) params.startDate = new Date(filterStartDate).toISOString();
      if (filterEndDate) params.endDate = new Date(filterEndDate).toISOString();

      const eventsResp = await eventService.getAll(params);
      
      const nonDeletedEvents = eventsResp.data;
      
      // Map to EventData format
      let filteredEvents = nonDeletedEvents.map(apiEventToEventData);
      
      // ADMIN can only see events created by users in their branch
      if (user?.role === 'admin' && user?.branchId) {
        filteredEvents = filteredEvents.filter(e => {
          // Get event from non-deleted data to check creator's branch
          const eventData = nonDeletedEvents.find(ev => String(ev.eventId) === e.id);
          if (!eventData || !eventData.creator) return false;
          
          return eventData.creator.branchId === user.branchId;
        });
      }
      
      // Filter by status (frontend filter since API doesn't support it)
      if (filterStatus) {
        filteredEvents = filteredEvents.filter(e => e.status === filterStatus);
      }
      
      // Sort: upcoming events first (nearest date), then ongoing, then completed
      const now = new Date();
      filteredEvents.sort((a, b) => {
        const dateA = a.date ? new Date(a.date).getTime() : 0;
        const dateB = b.date ? new Date(b.date).getTime() : 0;
        const nowTime = now.getTime();
        
        // Upcoming/ongoing events before completed
        const aIsFuture = dateA >= nowTime || a.status === 'ongoing' || a.status === 'upcoming';
        const bIsFuture = dateB >= nowTime || b.status === 'ongoing' || b.status === 'upcoming';
        
        if (aIsFuture && !bIsFuture) return -1;
        if (!aIsFuture && bIsFuture) return 1;
        
        // Among future events: nearest date first
        if (aIsFuture && bIsFuture) return dateA - dateB;
        
        // Among past events: most recent first
        return dateB - dateA;
      });
      
      setEvents(filteredEvents);
      setTotalEvents(filterStatus ? filteredEvents.length : eventsResp.total);
    } catch (err) {
      console.error('[EventManagement] fetch events error:', err);
    } finally {
      setIsLoadingPage(false);
      setIsFiltering(false);
    }
  }, [currentPage, pageSize, searchQuery, filterParticipantType, filterStatus, filterStartDate, filterEndDate, user, isFirstLoad]);

  // ── Refetch when filters change ──
  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  // ── Fetch event statistics ──
  const fetchStats = useCallback(async () => {
    try {
      const stats = await eventService.getStatistics();
      setEventStats(stats);
    } catch (err) {
      console.error('[EventManagement] fetch stats error:', err);
    }
  }, []);

  // Load stats when tab changes
  useEffect(() => {
    if (activeTab === 'stats') fetchStats();
  }, [activeTab, fetchStats]);

  // ── WebSocket real-time updates ──
  const { lastMessage } = useEventWebSocket();
  useEffect(() => {
    if (lastMessage?.type === 'event-update') {
      fetchEvents();
    }
  }, [lastMessage, fetchEvents]);

  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [editingEventId, setEditingEventId] = useState<string | null>(null);


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

  // Participant states
  const [participantType, setParticipantType] = useState<ParticipantType>('ALL');
  const [selectedBranchIds, setSelectedBranchIds] = useState<number[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);

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
  
  // Calculate default center for map (user's branch location)
  const defaultCenter = useMemo(() => {
    if (user?.branchId && branches.length > 0) {
      const userBranch = branches.find(b => b.branchId === user.branchId);
      if (userBranch && typeof userBranch.latitude === 'number' && typeof userBranch.longitude === 'number') {
        return { lat: userBranch.latitude, lng: userBranch.longitude };
      }
    }
    return { lat: 13.7563, lng: 100.5018 }; // Default: Bangkok
  }, [user?.branchId, branches]);

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
    
    if (!formData.locationName) {
      setAlertDialog({
        isOpen: true,
        type: 'error',
        title: 'ข้อมูลไม่ครบ',
        message: 'กรุณากรอกชื่อสถานที่'
      });
      return;
    }
    
    // Check if end time is after start time
    if (formData.startTime && formData.endTime) {
      const [startHour, startMin] = formData.startTime.split(':').map(Number);
      const [endHour, endMin] = formData.endTime.split(':').map(Number);
      const startMinutes = startHour * 60 + startMin;
      const endMinutes = endHour * 60 + endMin;
      
      if (endMinutes <= startMinutes) {
        setAlertDialog({ 
          isOpen: true, 
          type: 'error', 
          title: 'เวลาไม่ถูกต้อง', 
          message: 'เวลาสิ้นสุดต้องมากกว่าเวลาเริ่มต้น' 
        });
        return;
      }
    }

    try {
      // 1. Create location first
      const newLoc = await locationService.create({
        locationName: formData.locationName || 'ไม่ระบุสถานที่',
        address:      formData.locationName || '',
        locationType: 'EVENT',
        latitude:     parseFloat(formData.latitude)  || 13.7563,
        longitude:    parseFloat(formData.longitude) || 100.5018,
        radius:       parseInt(formData.radius)      || 100,
      });

      // 2. Create event
      const payload: CreateEventRequest = {
        eventName:       formData.name,
        description:     formData.description || undefined,
        locationId:      newLoc.locationId,
        startDateTime:   toISO(formData.date, formData.startTime),
        endDateTime:     toISO(formData.date, formData.endTime),
        participantType,
      };

      // Add participants if not ALL
      if (participantType !== 'ALL') {
        payload.participants = {};
        if (participantType === 'BRANCH' && selectedBranchIds.length > 0) {
          payload.participants.branchIds = selectedBranchIds;
        }
        if (participantType === 'ROLE' && selectedRoles.length > 0) {
          payload.participants.roles = selectedRoles;
        }
      }

      await eventService.create(payload);

      await fetchEvents(); // Refetch to update list
      setAlertDialog({ isOpen: true, type: 'success', title: 'สำเร็จ!', message: 'เพิ่มกิจกรรมใหม่เรียบร้อยแล้ว' });
      setFormData({ name:'', date:'', description:'', locationName:'', radius:'', latitude:'', longitude:'', startTime:'', endTime:'', teams:'', status:'ongoing' });
      setParticipantType('ALL');
      setSelectedBranchIds([]);
      setSelectedRoles([]);
      setIsAddingEvent(false);
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setAlertDialog({ isOpen: true, type: 'error', title: 'ผิดพลาด', message: e.response?.data?.error || 'เวลาสร้างกิจกรรมล้มเหลว' });
    }
  }, [formData, participantType, selectedBranchIds, selectedRoles, fetchEvents]);

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
      await eventService.update(parseInt(editingEventId!), {
        eventName:     editFormData.name,
        description:   editFormData.description,
        startDateTime: toISO(editFormData.date!, editFormData.startTime || ''),
        endDateTime:   toISO(editFormData.date!, editFormData.endTime   || ''),
      });
      await fetchEvents(); // Refetch to update list
      setAlertDialog({ isOpen: true, type: 'success', title: 'บันทึกสำเร็จ', message: 'แก้ไขข้อมูลกิจกรรมเรียบร้อยแล้ว' });
      setEditingEventId(null);
      setEditFormData({});
    } catch (err: unknown) {
      const e = err as { response?: { data?: { error?: string } } };
      setAlertDialog({ isOpen: true, type: 'error', title: 'ผิดพลาด', message: e.response?.data?.error || 'เวลาแก้ไขล้มเหลว' });
    }
  }, [editFormData, editingEventId, fetchEvents]);

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
          await eventService.delete(parseInt(event.id));
          await fetchEvents(); // Refetch to update list
          setAlertDialog({ isOpen: true, type: 'success', title: 'ลบสำเร็จ', message: 'ลบกิจกรรมเรียบร้อยแล้ว' });
        } catch (err: unknown) {
          const e = err as { response?: { data?: { error?: string } } };
          setAlertDialog({ isOpen: true, type: 'error', title: 'ผิดพลาด', message: e.response?.data?.error || 'ไม่สามารถลบกิจกรรมนี้ได้' });
        }
        setConfirmDialog({ isOpen: false });
      },
      onCancel: () => setConfirmDialog({ isOpen: false })
    });
  }, [fetchEvents]);

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
    if (status === 'ongoing') return 'active';      // กำลังดำเนินการ - สีเขียว
    if (status === 'upcoming') return 'default';    // กำลังจะมาถึง - สีเทา
    return 'suspend';                               // เสร็จสิ้นแล้ว - สีเหลืองอ่อน
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

        {/* Tabs */}
        <div className="flex gap-1 mb-6 border-b border-gray-200">
          {([
            { key: 'events' as const, label: 'กิจกรรมทั้งหมด' },
            { key: 'stats' as const, label: 'สถิติ' },
          ]).map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeTab === tab.key
                  ? 'border-orange-600 text-orange-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* ── Tab: Statistics ── */}
        {activeTab === 'stats' && (
          <div>
            <h2 className="text-xl font-bold text-gray-900 mb-4">สถิติกิจกรรม</h2>
            {!eventStats ? (
              <div className="flex justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-600" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6 mb-6">
                  {[
                    { label: 'ทั้งหมด', value: eventStats.totalEvents, bg: '#f3f4f6', text: '#374151', border: '#d1d5db' },
                    { label: 'ใช้งานอยู่', value: eventStats.activeEvents, bg: '#dcfce7', text: '#15803d', border: '#86efac' },
                    { label: 'กำลังจะมาถึง', value: eventStats.upcomingEvents, bg: '#dbeafe', text: '#1d4ed8', border: '#93c5fd' },
                    { label: 'กำลังดำเนินการ', value: eventStats.ongoingEvents, bg: '#ffedd5', text: '#c2410c', border: '#fdba74' },
                    { label: 'สิ้นสุดแล้ว', value: eventStats.pastEvents, bg: '#e5e7eb', text: '#374151', border: '#9ca3af' },
                  ].map(stat => (
                    <Card key={stat.label} className="p-4 text-center">
                      <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                      <span 
                        className="inline-block mt-1 px-2 py-0.5 rounded-full text-xs font-medium"
                        style={{ backgroundColor: stat.bg, color: stat.text, border: `1px solid ${stat.border}` }}
                      >
                        {stat.label}
                      </span>
                    </Card>
                  ))}
                </div>
                <Card className="p-4">
                  <h3 className="font-semibold text-gray-900 mb-3">ตามประเภทผู้เข้าร่วม</h3>
                  <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                    {eventStats.byParticipantType.map(pt => (
                      <div key={pt.type} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                        <span className="text-sm text-gray-600">
                          {pt.type === 'ALL' ? 'ทุกคน' : pt.type === 'BRANCH' ? 'ตามสาขา' : pt.type === 'ROLE' ? 'ตามบทบาท' : 'รายบุคคล'}
                        </span>
                        <span className="text-lg font-bold text-gray-900">{pt.count}</span>
                      </div>
                    ))}
                  </div>
                </Card>
              </>
            )}
          </div>
        )}

        {/* ── Tab: Events (main content) ── */}
        {activeTab === 'events' && (<>

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
                min={new Date().toISOString().split('T')[0]}
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

              {/* Participant Type Selector */}
              <div>
                <label className="block mb-2 text-sm font-medium text-gray-700">
                  ผู้เข้าร่วม <span className="text-red-500">*</span>
                </label>
                <select
                  value={participantType}
                  onChange={(e) => {
                    setParticipantType(e.target.value as ParticipantType);
                    setSelectedBranchIds([]);
                    setSelectedRoles([]);
                  }}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                >
                  <option value="ALL">ทุกคน</option>
                  <option value="BRANCH">ตามสาขา</option>
                  <option value="ROLE">ตามบทบาท</option>
                  <option value="INDIVIDUAL" disabled>ระบุคน (ยังไม่พร้อมใช้งาน)</option>
                </select>
              </div>

              {/* Branch Selector (when BRANCH selected) */}
              {participantType === 'BRANCH' && (
                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-700">
                    เลือกสาขา <span className="text-red-500">*</span>
                  </label>
                  <div className="space-y-2 p-3 border border-gray-300 rounded-lg max-h-40 overflow-y-auto">
                    {branches.length === 0 ? (
                      <p className="text-sm text-gray-500">กำลังโหลดสาขา...</p>
                    ) : (
                      branches.map((branch) => (
                        <label key={branch.branchId} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                          <input
                            type="checkbox"
                            checked={selectedBranchIds.includes(branch.branchId)}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setSelectedBranchIds(prev => [...prev, branch.branchId]);
                              } else {
                                setSelectedBranchIds(prev => prev.filter(id => id !== branch.branchId));
                              }
                            }}
                            className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                          />
                          <span className="text-sm text-gray-700">{branch.name}</span>
                        </label>
                      ))
                    )}
                  </div>
                  {selectedBranchIds.length > 0 && (
                    <p className="mt-1 text-xs text-gray-500">เลือกแล้ว {selectedBranchIds.length} สาขา</p>
                  )}
                </div>
              )}

              {/* Role Selector (when ROLE selected) */}
              {participantType === 'ROLE' && (
                <div>
                  <label className="block mb-2 text-sm font-medium text-gray-700">
                    เลือกบทบาท <span className="text-red-500">*</span>
                  </label>
                  <div className="space-y-2 p-3 border border-gray-300 rounded-lg">
                    {['USER', 'MANAGER', 'ADMIN', 'SUPERADMIN'].map((role) => (
                      <label key={role} className="flex items-center gap-2 cursor-pointer hover:bg-gray-50 p-2 rounded">
                        <input
                          type="checkbox"
                          checked={selectedRoles.includes(role)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedRoles(prev => [...prev, role]);
                            } else {
                              setSelectedRoles(prev => prev.filter(r => r !== role));
                            }
                          }}
                          className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                        />
                        <span className="text-sm text-gray-700">
                          {role === 'USER' ? 'พนักงานทั่วไป' : 
                           role === 'MANAGER' ? 'ผู้จัดการ' :
                           role === 'ADMIN' ? 'ผู้ดูแลระบบ' : 'ผู้ดูแลระบบสูงสุด'}
                        </span>
                      </label>
                    ))}
                  </div>
                  {selectedRoles.length > 0 && (
                    <p className="mt-1 text-xs text-gray-500">เลือกแล้ว {selectedRoles.length} บทบาท</p>
                  )}
                </div>
              )}

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
          <Suspense fallback={<div className="h-125 bg-gray-100 rounded-2xl animate-pulse" />}>
            <EventMap 
              events={events}
              locations={locations}
              onMapClick={isAddingEvent || editingEventId ? handleMapClick : undefined}
              selectedPosition={selectedPosition}
              defaultCenter={defaultCenter}
            />
          </Suspense>
        </div>

        {/* Search & Filter Bar */}
        <Card className="p-4 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {/* Search */}
            <div>
              <label className="block mb-2 text-sm font-medium text-gray-700">ค้นหา</label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1); // Reset to page 1 when search changes
                }}
                placeholder="ชื่อกิจกรรมหรือรายละเอียด..."
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              />
            </div>

            {/* Participant Type Filter */}
            <div>
              <label className="block mb-2 text-sm font-medium text-gray-700">ประเภทผู้เข้าร่วม</label>
              <select
                value={filterParticipantType}
                onChange={(e) => {
                  setFilterParticipantType(e.target.value as ParticipantType | '');
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="">ทั้งหมด</option>
                <option value="ALL">ทุกคน</option>
                <option value="BRANCH">ตามสาขา</option>
                <option value="ROLE">ตามบทบาท</option>
                <option value="INDIVIDUAL">ระบุคน</option>
              </select>
            </div>

            {/* Status Filter */}
            <div>
              <label className="block mb-2 text-sm font-medium text-gray-700">สถานะ</label>
              <select
                value={filterStatus}
                onChange={(e) => {
                  setFilterStatus(e.target.value as 'ongoing' | 'upcoming' | 'completed' | '');
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
              >
                <option value="">ทั้งหมด</option>
                <option value="ongoing">กำลังดำเนินการ</option>
                <option value="upcoming">กำลังจะมาถึง</option>
                <option value="completed">เสร็จสิ้นแล้ว</option>
              </select>
            </div>

            {/* Start Date Filter */}
            <div>
              <label className="block mb-2 text-sm font-medium text-gray-700">วันที่เริ่มต้น</label>
              <input
                type="date"
                value={filterStartDate}
                onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
                onChange={(e) => {
                  setFilterStartDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
              />
            </div>

            {/* End Date Filter */}
            <div>
              <label className="block mb-2 text-sm font-medium text-gray-700">วันที่สิ้นสุด</label>
              <input
                type="date"
                value={filterEndDate}
                onClick={(e) => (e.target as HTMLInputElement).showPicker?.()}
                onChange={(e) => {
                  setFilterEndDate(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 cursor-pointer"
              />
            </div>

            {/* Clear Filters Button */}
            <div className="flex items-end">
              <Button
                variant="outline"
                onClick={() => {
                  setSearchQuery('');
                  setFilterParticipantType('');
                  setFilterStatus('');
                  setFilterStartDate('');
                  setFilterEndDate('');
                  setCurrentPage(1);
                }}
                className="w-full"
              >
                ล้างตัวกรอง
              </Button>
            </div>
          </div>
        </Card>

        {/* Events List */}
        <div className="relative">
          {isFiltering && (
            <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/60 rounded-lg">
              <div className="w-8 h-8 border-b-2 border-orange-600 rounded-full animate-spin" />
            </div>
          )}
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-gray-900">
              รายการกิจกรรม ({totalEvents} รายการ)
            </h2>
            <p className="text-sm text-gray-500">
              แสดง {events.length === 0 ? 0 : ((currentPage - 1) * pageSize) + 1}-{Math.min(currentPage * pageSize, totalEvents)} จาก {totalEvents}
            </p>
          </div>
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
                  onViewDetail={() => router.push(`/admin/event-management/${event.id}`)}
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

          {/* Pagination */}
          {totalEvents > 0 && (
            <div className="flex items-center justify-between mt-6 pt-4 border-t">
              <div className="text-sm text-gray-600">
                หน้า {currentPage} จาก {Math.ceil(totalEvents / pageSize)}
              </div>
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  size="sm"
                >
                  ← ก่อนหน้า
                </Button>
                
                {/* Page Numbers */}
                <div className="flex gap-1">
                  {Array.from({ length: Math.min(5, Math.ceil(totalEvents / pageSize)) }, (_, i) => {
                    const totalPages = Math.ceil(totalEvents / pageSize);
                    let pageNum: number;
                    
                    if (totalPages <= 5) {
                      pageNum = i + 1;
                    } else if (currentPage <= 3) {
                      pageNum = i + 1;
                    } else if (currentPage >= totalPages - 2) {
                      pageNum = totalPages - 4 + i;
                    } else {
                      pageNum = currentPage - 2 + i;
                    }

                    return (
                      <Button
                        key={pageNum}
                        variant={currentPage === pageNum ? "default" : "outline"}
                        onClick={() => setCurrentPage(pageNum)}
                        size="sm"
                        className={currentPage === pageNum ? "bg-orange-600 hover:bg-orange-700" : ""}
                      >
                        {pageNum}
                      </Button>
                    );
                  })}
                </div>

                <Button
                  variant="outline"
                  onClick={() => setCurrentPage(prev => Math.min(Math.ceil(totalEvents / pageSize), prev + 1))}
                  disabled={currentPage >= Math.ceil(totalEvents / pageSize)}
                  size="sm"
                >
                  ถัดไป →
                </Button>
              </div>
            </div>
          )}
        </div>

        </>)}
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
  min?: string;
  max?: string;
}

function FormField({ label, name, value, onChange, type = 'text', required, placeholder, textarea, min, max }: FormFieldProps) {
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
          onClick={type === 'date' ? (e) => (e.target as HTMLInputElement).showPicker?.() : undefined}
          placeholder={placeholder}
          min={min}
          max={max}
          className={`w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-gray-900 focus:outline-none transition-all${type === 'date' ? ' cursor-pointer' : ''}`}
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
  onViewDetail: () => void;
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
  onViewDetail,
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
    <Card 
      className="p-4 transition-shadow hover:shadow-md"
      style={{ borderLeft: `4px solid ${
        event.status === 'ongoing' ? '#16a34a' :
        event.status === 'upcoming' ? '#2563eb' :
        '#9ca3af'
      }` }}
    >
      <div className="flex items-start justify-between mb-3">
        <h3 className="text-lg font-bold text-gray-900">{event.name}</h3>
        {event.status && (
          <Badge 
            variant={getStatusVariant(event.status)}
            style={
              event.status === 'ongoing' ? { backgroundColor: '#16a34a', color: '#fff', borderColor: '#16a34a' } :
              event.status === 'upcoming' ? { backgroundColor: '#2563eb', color: '#fff', borderColor: '#2563eb' } :
              { backgroundColor: '#6b7280', color: '#fff', borderColor: '#6b7280' }
            }
          >
            {event.status === 'ongoing' ? 'กำลังดำเนินการ' : event.status === 'upcoming' ? 'กำลังจะมาถึง' : 'เสร็จสิ้นแล้ว'}
          </Badge>
        )}
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
        <Button size="sm" variant="default" onClick={onViewDetail} className="flex-1 bg-orange-600 hover:bg-orange-700">
          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
          </svg>
          ดูรายละเอียด
        </Button>
        <Button size="sm" variant="outline" onClick={onEdit}>
          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
          </svg>
          แก้ไข
        </Button>
        <Button size="sm" variant="destructive" onClick={onDelete}>
          <svg className="w-4 h-4 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
          ลบ
        </Button>
      </div>
    </Card>
  );
}
