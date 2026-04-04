"use client";


import { useState, useEffect, useCallback, Suspense, useMemo, useRef } from 'react';
import { eventService, EventItem, ParticipantType } from '@/services/eventService';
import { locationService, LocationItem, LOCATION_TYPE_LABELS } from '@/services/locationService';
import { dashboardService } from '@/services/dashboardService';
import { userService } from '@/services/user';
import type { AuthUser } from '@/types/auth';
import type { EventData, LocationData } from '@/types/event';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import AlertDialog from '@/components/common/AlertDialog';

import EventMap from '@/components/admin/DynamicEventMap';
import { DateTimePicker } from '@/components/ui/DateTimePicker';

const PARTICIPANT_TYPE_LABELS: Record<ParticipantType, string> = {
  ALL: 'ทุกคน',
  INDIVIDUAL: 'รายบุคคล',
  BRANCH: 'ตามสาขา',
  ROLE: 'ตามตำแหน่ง',
};

/** แปลง EventItem (API) → EventData (แผนที่) */
function toMapEvent(evt: EventItem): EventData | null {
  // Support both checkin-linked and custom-venue events
  const lat = evt.location?.latitude ?? evt.venueLatitude ?? null;
  const lng = evt.location?.longitude ?? evt.venueLongitude ?? null;
  if (!lat || !lng) return null;
  return {
    id: String(evt.eventId),
    name: evt.eventName,
    date: evt.startDateTime.split('T')[0],
    description: evt.description,
    locationName: evt.location?.locationName ?? evt.venueName ?? '—',
    radius: evt.location?.radius ?? 0,
    latitude: lat,
    longitude: lng,
    startTime: evt.startDateTime.split('T')[1]?.slice(0, 5),
    endTime: evt.endDateTime.split('T')[1]?.slice(0, 5),
    status: new Date(evt.endDateTime) > new Date() ? 'ongoing' : 'completed',
  };
}

/** แปลง LocationItem (API) → LocationData (แผนที่) */
function toMapLocation(loc: LocationItem): LocationData {
  return {
    id: String(loc.locationId),
    locationName: loc.locationName,
    latitude: loc.latitude,
    longitude: loc.longitude,
    radius: loc.radius,
  };
}

interface EventFormData {
  eventName: string;
  description: string;
  /** Mode A = pick existing check-in location; Mode B = type custom name + click map */
  venueMode: 'checkin' | 'custom';
  locationId: string;       // Mode A
  customVenueName: string;  // Mode B
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  participantType: ParticipantType;
  isActive: boolean;
  latitude: number;
  longitude: number;
}

const EMPTY_FORM: EventFormData = {
  eventName: '',
  description: '',
  venueMode: 'checkin',
  locationId: '',
  customVenueName: '',
  startDate: '',
  startTime: '08:00',
  endDate: '',
  endTime: '17:00',
  participantType: 'ALL',
  isActive: true,
  latitude: 0,
  longitude: 0,
};

function combineDatetime(date: string, time: string): string {
  // Append local timezone offset so the backend (running in UTC) stores the
  // correct absolute time. Without this, "08:00" is stored as 08:00 UTC which
  // displays as 15:00 in Bangkok (UTC+7).
  const d = new Date(`${date}T${time}:00`);
  const offset = -d.getTimezoneOffset(); // minutes ahead of UTC
  const sign = offset >= 0 ? '+' : '-';
  const abs = Math.abs(offset);
  const hh = String(Math.floor(abs / 60)).padStart(2, '0');
  const mm = String(abs % 60).padStart(2, '0');
  return `${date}T${time}:00${sign}${hh}:${mm}`;
}

/** Return a date in YYYY-MM-DD using the **local** calendar (not UTC). */
function toLocalYYYYMMDD(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** คำนวณจำนวนวันระหว่าง 2 วัน */
function calcDurationDays(start: string, end: string) {
  if (!start || !end) return null;
  const diff = new Date(end).getTime() - new Date(start).getTime();
  if (diff <= 0) return null;
  const days = Math.ceil(diff / (1000 * 60 * 60 * 24));
  return days === 1 ? '1 วัน' : `${days} วัน`;
}

/** แสดงวันเวลาแบบไทยแบบย่อ */
function formatDateDisplay(dateStr: string) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

const EVT_PER_PAGE = 9;

interface EventManagementTabProps {
  locationsKey?: number;
}

export default function EventManagementTab({ locationsKey }: EventManagementTabProps) {
  const [events, setEvents] = useState<EventItem[]>([]);
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingEvent, setIsAddingEvent] = useState(false);
  const [editingEventId, setEditingEventId] = useState<number | null>(null);
  const [evtPage, setEvtPage] = useState(1);
  const [mapFlyTo, setMapFlyTo] = useState<{ lat: number; lng: number; zoom?: number; seq: number } | undefined>();
  const mapFlySeq = useRef(0);
  const [pendingPosition, setPendingPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [formData, setFormData] = useState<EventFormData>({ ...EMPTY_FORM });
  const [editFormData, setEditFormData] = useState<Partial<EventFormData>>({});
  const [submitting, setSubmitting] = useState(false);

  // ── Participant data (lazy-loaded) ──
  const [allUsers, setAllUsers] = useState<{ userId: number; firstName: string; lastName: string; employeeId: string }[]>([]);
  const [allBranches, setAllBranches] = useState<{ branchId: number; name: string }[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  // Add-form participant selections
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [selectedBranchIds, setSelectedBranchIds] = useState<number[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  // Edit-form participant selections
  const [editSelectedUserIds, setEditSelectedUserIds] = useState<number[]>([]);
  const [editSelectedBranchIds, setEditSelectedBranchIds] = useState<number[]>([]);
  const [editSelectedRoles, setEditSelectedRoles] = useState<string[]>([]);

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
  }>({ isOpen: false });

  const fetchAll = useCallback(async () => {
    try {
      setLoading(true);
      const [evtRes, locRes] = await Promise.all([
        eventService.getAll({ take: 100 }),
        locationService.getAll({ isActive: undefined }),
      ]);
      const evtData = Array.isArray(evtRes) ? evtRes : (evtRes?.data ?? []);
      const locData = Array.isArray(locRes) ? locRes : (locRes?.data ?? []);
      setEvents(evtData);
      setLocations(locData);
    } catch {
      setAlertDialog({ isOpen: true, type: 'error', title: 'ผิดพลาด', message: 'ไม่สามารถดึงข้อมูลได้' });
    } finally {
      setLoading(false);
    }
  }, []);

  // Background sync — never touches loading state so UI stays stable
  const silentRefresh = useCallback(async () => {
    try {
      const [evtRes, locRes] = await Promise.all([
        eventService.getAll({ take: 100 }),
        locationService.getAll({ isActive: undefined }),
      ]);
      setEvents(Array.isArray(evtRes) ? evtRes : (evtRes?.data ?? []));
      setLocations(Array.isArray(locRes) ? locRes : (locRes?.data ?? []));
    } catch { /* ignore */ }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Re-fetch locations when the parent signals a change (e.g., a location was added/edited/deleted in the other tab)
  useEffect(() => {
    if (locationsKey !== undefined && locationsKey > 0) {
      silentRefresh();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locationsKey]);

  // Lazy-fetch users or branches when participantType needs them
  const fetchParticipantData = useCallback(async (type: ParticipantType) => {
    if (type === 'INDIVIDUAL' && allUsers.length === 0) {
      try {
        setLoadingParticipants(true);
        const res = await userService.getManageUsers({} as AuthUser, { limit: 500 });
        setAllUsers(res.users.map(u => ({
          userId: Number(u.id),
          firstName: u.name.split(' ')[0] || '',
          lastName: u.name.split(' ').slice(1).join(' ') || '',
          employeeId: u.employeeId,
        })));
      } catch { /* ignore */ } finally { setLoadingParticipants(false); }
    }
    if (type === 'BRANCH' && allBranches.length === 0) {
      try {
        setLoadingParticipants(true);
        const res = await dashboardService.getBranchesMap();
        setAllBranches((res.data ?? []).map((b: { branchId: number; name: string }) => ({ branchId: b.branchId, name: b.name })));
      } catch { /* ignore */ } finally { setLoadingParticipants(false); }
    }
  }, [allUsers.length, allBranches.length]);

  // When add-form participantType changes, pre-fetch data
  useEffect(() => {
    if (isAddingEvent) fetchParticipantData(formData.participantType);
  }, [formData.participantType, isAddingEvent, fetchParticipantData]);

  // When edit-form participantType changes (user switches type in the edit card), fetch data too
  useEffect(() => {
    if (editingEventId !== null && editFormData.participantType) {
      fetchParticipantData(editFormData.participantType);
    }
  }, [editFormData.participantType, editingEventId, fetchParticipantData]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    // isActive must be stored as boolean
    const coerced: string | boolean = name === 'isActive' ? value === 'true' : value;
    if (editingEventId !== null) {
      setEditFormData(prev => {
        const updated = { ...prev, [name]: coerced };
        // Auto-fill lat/lng when location selected in Mode A
        if (name === 'locationId' && prev.venueMode !== 'custom') {
          const loc = locations.find(l => l.locationId === Number(value));
          if (loc) {
            updated.latitude = loc.latitude;
            updated.longitude = loc.longitude;
            setMapFlyTo({ lat: loc.latitude, lng: loc.longitude, zoom: 15, seq: ++mapFlySeq.current });
          }
        }
        return updated;
      });
    } else {
      setFormData(prev => {
        const updated = { ...prev, [name]: coerced };
        if (name === 'locationId' && prev.venueMode !== 'custom') {
          const loc = locations.find(l => l.locationId === Number(value));
          if (loc) {
            updated.latitude = loc.latitude;
            updated.longitude = loc.longitude;
            setMapFlyTo({ lat: loc.latitude, lng: loc.longitude, zoom: 15, seq: ++mapFlySeq.current });
          }
        }
        return updated;
      });
    }
  };

  const findNearestLocationId = useCallback((lat: number, lng: number): string => {
    const active = locations.filter(l => l.isActive);
    if (active.length === 0) return '';
    let best = active[0], bestDist = Infinity;
    for (const loc of active) {
      const d = Math.hypot(loc.latitude - lat, loc.longitude - lng);
      if (d < bestDist) { bestDist = d; best = loc; }
    }
    // Auto-select only when click is within ~0.05° (~5 km) of a known location
    return bestDist < 0.05 ? String(best.locationId) : '';
  }, [locations]);

  const handleMapClick = useCallback((latlng: { lat: number; lng: number }) => {
    if (editingEventId !== null) {
      setEditFormData(prev => {
        const isCustom = prev.venueMode === 'custom';
        const nearestId = isCustom ? '' : findNearestLocationId(latlng.lat, latlng.lng);
        return {
          ...prev,
          latitude: latlng.lat,
          longitude: latlng.lng,
          ...(nearestId ? { locationId: nearestId } : {}),
        };
      });
    } else if (isAddingEvent) {
      setFormData(prev => {
        const isCustom = prev.venueMode === 'custom';
        const nearestId = isCustom ? '' : findNearestLocationId(latlng.lat, latlng.lng);
        return {
          ...prev,
          latitude: latlng.lat,
          longitude: latlng.lng,
          ...(nearestId ? { locationId: nearestId } : {}),
        };
      });
    } else {
      setPendingPosition(latlng);
    }
  }, [editingEventId, isAddingEvent, findNearestLocationId]);

  const handlePendingMarkerClick = useCallback(() => {
    if (!pendingPosition) return;
    const nearestId = findNearestLocationId(pendingPosition.lat, pendingPosition.lng);
    setFormData(prev => ({
      ...prev,
      latitude: pendingPosition.lat,
      longitude: pendingPosition.lng,
      ...(nearestId ? { locationId: nearestId } : {}),
    }));
    setIsAddingEvent(true);
  }, [pendingPosition, findNearestLocationId]);

  const handleAddEvent = async () => {
    // Validate venue based on venueMode
    const venueOk = formData.venueMode === 'checkin'
      ? !!formData.locationId
      : (!!formData.customVenueName && (formData.latitude !== 0 || formData.longitude !== 0));

    if (!formData.eventName || !venueOk || !formData.startDate || !formData.endDate) {
      const msg = !formData.eventName
        ? 'กรุณากรอกชื่อกิจกรรม'
        : !venueOk
          ? formData.venueMode === 'checkin' ? 'กรุณาเลือกสถานที่เช็คอิน' : 'กรุณากรอกชื่อสถานที่และระบุตำแหน่งบนแผนที่'
          : 'กรุณากรอกวันที่เริ่มต้นและสิ้นสุด';
      setAlertDialog({ isOpen: true, type: 'error', title: 'ข้อมูลไม่ครบ', message: msg });
      return;
    }

    if (formData.participantType === 'INDIVIDUAL' && selectedUserIds.length === 0) {
      setAlertDialog({ isOpen: true, type: 'error', title: 'ข้อมูลไม่ครบ', message: 'กรุณาเลือกพนักงานอย่างน้อย 1 คน' });
      return;
    }
    if (formData.participantType === 'BRANCH' && selectedBranchIds.length === 0) {
      setAlertDialog({ isOpen: true, type: 'error', title: 'ข้อมูลไม่ครบ', message: 'กรุณาเลือกสาขาอย่างน้อย 1 สาขา' });
      return;
    }
    if (formData.participantType === 'ROLE' && selectedRoles.length === 0) {
      setAlertDialog({ isOpen: true, type: 'error', title: 'ข้อมูลไม่ครบ', message: 'กรุณาเลือกตำแหน่งอย่างน้อย 1 ตำแหน่ง' });
      return;
    }

    const startDT = combineDatetime(formData.startDate, formData.startTime);
    const endDT = combineDatetime(formData.endDate, formData.endTime);

    if (new Date(startDT) >= new Date(endDT)) {
      setAlertDialog({ isOpen: true, type: 'error', title: 'วันที่ไม่ถูกต้อง', message: 'วันเวลาสิ้นสุดต้องหลังจากวันเวลาเริ่มต้น' });
      return;
    }

    const venuePayload = formData.venueMode === 'checkin'
      ? { locationId: Number(formData.locationId) }
      : { venueName: formData.customVenueName, venueLatitude: formData.latitude, venueLongitude: formData.longitude };

    const participantsPayload = formData.participantType === 'ALL' ? undefined
      : formData.participantType === 'INDIVIDUAL' ? { userIds: selectedUserIds }
      : formData.participantType === 'BRANCH' ? { branchIds: selectedBranchIds }
      : formData.participantType === 'ROLE' ? { roles: selectedRoles }
      : undefined;

    try {
      setSubmitting(true);
      await eventService.create({
        eventName: formData.eventName,
        description: formData.description || undefined,
        ...venuePayload,
        startDateTime: startDT,
        endDateTime: endDT,
        participantType: formData.participantType,
        participants: participantsPayload,
      });
      const loc = formData.venueMode === 'checkin'
        ? locations.find(l => l.locationId === Number(formData.locationId)) ?? null
        : null;
      const optimisticEvent: EventItem = {
        eventId: -Date.now(),
        eventName: formData.eventName,
        description: formData.description || '',
        locationId: formData.venueMode === 'checkin' ? Number(formData.locationId) : null,
        venueName: formData.venueMode === 'custom' ? formData.customVenueName : null,
        venueLatitude: formData.venueMode === 'custom' ? formData.latitude : null,
        venueLongitude: formData.venueMode === 'custom' ? formData.longitude : null,
        location: loc,
        startDateTime: startDT,
        endDateTime: endDT,
        participantType: formData.participantType,
        isActive: true,
        _count: { event_participants: participantsPayload ? (selectedUserIds.length || selectedBranchIds.length || selectedRoles.length) : 0 },
      } as unknown as EventItem;
      setEvents(prev => [optimisticEvent, ...prev]);
      setAlertDialog({ isOpen: true, type: 'success', title: 'สำเร็จ!', message: 'เพิ่มกิจกรรมใหม่เรียบร้อยแล้ว' });
      setFormData({ ...EMPTY_FORM });
      setSelectedUserIds([]);
      setSelectedBranchIds([]);
      setSelectedRoles([]);
      setIsAddingEvent(false);
      setPendingPosition(null);
      silentRefresh();
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const msg = (err as any)?.response?.data?.error || 'เกิดข้อผิดพลาด กรุณาลองใหม่';
      setAlertDialog({ isOpen: true, type: 'error', title: 'ผิดพลาด', message: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditEvent = async (event: EventItem) => {
    setEditingEventId(event.eventId);
    const startDT = new Date(event.startDateTime);
    const endDT = new Date(event.endDateTime);
    const isCustom = !event.locationId && !!event.venueName;
    setEditFormData({
      eventName: event.eventName,
      description: event.description || '',
      venueMode: isCustom ? 'custom' : 'checkin',
      locationId: event.locationId ? String(event.locationId) : '',
      customVenueName: event.venueName || '',
      startDate: toLocalYYYYMMDD(startDT),
      startTime: startDT.toTimeString().slice(0, 5),
      endDate: toLocalYYYYMMDD(endDT),
      endTime: endDT.toTimeString().slice(0, 5),
      participantType: event.participantType,
      isActive: event.isActive,
      latitude: isCustom ? (event.venueLatitude ?? 0) : (event.location?.latitude ?? 0),
      longitude: isCustom ? (event.venueLongitude ?? 0) : (event.location?.longitude ?? 0),
    });
    // Reset first; then fetch full detail to get participant list
    // (getAll doesn't include participants — need getById for full data)
    setEditSelectedUserIds([]);
    setEditSelectedBranchIds([]);
    setEditSelectedRoles([]);
    try {
      const detail = await eventService.getById(event.eventId);
      // Backend returns event_participants with .users / .branches (Prisma relation names)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const eps: any[] = (detail as any).event_participants ?? [];
      if (eps.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setEditSelectedUserIds(eps.filter((p: any) => p.users?.userId).map((p: any) => p.users.userId as number));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setEditSelectedBranchIds(eps.filter((p: any) => p.branches?.branchId).map((p: any) => p.branches.branchId as number));
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        setEditSelectedRoles(eps.filter((p: any) => p.role).map((p: any) => p.role as string));
      }
    } catch { /* participants stay empty; user can re-select */ }
    fetchParticipantData(event.participantType);
  };

  const handleSaveEdit = async () => {
    const venueOk = editFormData.venueMode === 'checkin'
      ? !!editFormData.locationId
      : (!!editFormData.customVenueName && (editFormData.latitude !== 0 || editFormData.longitude !== 0));

    if (!editFormData.eventName || !venueOk || !editFormData.startDate || !editFormData.endDate) {
      setAlertDialog({ isOpen: true, type: 'error', title: 'ข้อมูลไม่ครบ', message: 'กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน' });
      return;
    }

    const startDT = combineDatetime(editFormData.startDate!, editFormData.startTime || '00:00');
    const endDT = combineDatetime(editFormData.endDate!, editFormData.endTime || '23:59');

    // Build venue payload
    const venuePayload = editFormData.venueMode === 'checkin'
      ? { locationId: editFormData.locationId ? Number(editFormData.locationId) : undefined, venueName: undefined, venueLatitude: undefined, venueLongitude: undefined }
      : { locationId: null, venueName: editFormData.customVenueName, venueLatitude: Number(editFormData.latitude), venueLongitude: Number(editFormData.longitude) };

    try {
      setSubmitting(true);
      const editParticipantsPayload = editFormData.participantType === 'ALL' ? undefined
        : editFormData.participantType === 'INDIVIDUAL' ? { userIds: editSelectedUserIds }
        : editFormData.participantType === 'BRANCH' ? { branchIds: editSelectedBranchIds }
        : editFormData.participantType === 'ROLE' ? { roles: editSelectedRoles }
        : undefined;

      await eventService.update(editingEventId!, {
        eventName: editFormData.eventName,
        description: editFormData.description || undefined,
        ...venuePayload,
        startDateTime: startDT,
        endDateTime: endDT,
        participantType: editFormData.participantType,
        isActive: editFormData.isActive,
        participants: editParticipantsPayload,
      });
      // Optimistic: update in-place
      setEvents(prev => prev.map(e =>
        e.eventId === editingEventId
          ? {
              ...e,
              eventName: editFormData.eventName ?? e.eventName,
              description: editFormData.description ?? e.description,
              locationId: venuePayload.locationId !== undefined ? venuePayload.locationId : e.locationId,
              location: editFormData.venueMode === 'checkin'
                ? (editFormData.locationId ? (locations.find(l => l.locationId === Number(editFormData.locationId)) ?? e.location) : e.location)
                : undefined,
              venueName: editFormData.venueMode === 'custom' ? editFormData.customVenueName : null,
              venueLatitude: editFormData.venueMode === 'custom' ? Number(editFormData.latitude) : null,
              venueLongitude: editFormData.venueMode === 'custom' ? Number(editFormData.longitude) : null,
              startDateTime: startDT,
              endDateTime: endDT,
              participantType: editFormData.participantType ?? e.participantType,
              isActive: editFormData.isActive ?? e.isActive,
            }
          : e
      ));
      setAlertDialog({ isOpen: true, type: 'success', title: 'บันทึกสำเร็จ', message: 'แก้ไขกิจกรรมเรียบร้อยแล้ว' });
      setEditingEventId(null);
      setEditFormData({});
      silentRefresh();
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const msg = (err as any)?.response?.data?.error || 'เกิดข้อผิดพลาด กรุณาลองใหม่';
      setAlertDialog({ isOpen: true, type: 'error', title: 'ผิดพลาด', message: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteEvent = (event: EventItem) => {
    setConfirmDialog({
      isOpen: true,
      title: 'ยืนยันการลบ',
      message: `คุณแน่ใจหรือไม่ที่จะลบกิจกรรม "${event.eventName}"? การกระทำนี้ไม่สามารถย้อนกลับได้`,
      onConfirm: async () => {
        setEvents(prev => prev.filter(e => e.eventId !== event.eventId));
        setConfirmDialog({ isOpen: false });
        try {
          await eventService.delete(event.eventId);
          setAlertDialog({ isOpen: true, type: 'success', title: 'ลบสำเร็จ', message: 'ลบกิจกรรมเรียบร้อยแล้ว' });
          silentRefresh();
        } catch (err) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const msg = (err as any)?.response?.data?.error || 'ลบไม่สำเร็จ';
          silentRefresh(); // rollback
          setAlertDialog({ isOpen: true, type: 'error', title: 'ผิดพลาด', message: msg });
        }
      },
      onCancel: () => setConfirmDialog({ isOpen: false })
    });
  };

  const mapEvents = useMemo(
    () => events.map(toMapEvent).filter((e): e is EventData => e !== null),
    [events]
  );
  const mapLocations = useMemo(
    () => locations.filter(l => l.isActive).map(toMapLocation),
    [locations]
  );

  // Sort: ongoing (0) → upcoming (1) → ended (2), then by startDateTime ascending within each phase
  const sortedEvents = useMemo(() => {
    const phaseOrder: Record<EventPhase, number> = { ongoing: 0, upcoming: 1, ended: 2 };
    return [...events].sort((a, b) => {
      const phaseDiff = phaseOrder[getEventPhase(a)] - phaseOrder[getEventPhase(b)];
      if (phaseDiff !== 0) return phaseDiff;
      return new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime();
    });
  }, [events]);
  const evtTotalPages = Math.max(1, Math.ceil(sortedEvents.length / EVT_PER_PAGE));
  const safeEvtPage = Math.min(evtPage, evtTotalPages);

  return (
    <div className="space-y-6">
      {/* Map + Add-form overlay */}
      <div className="relative">
        <Suspense fallback={<div className="h-125 bg-gray-100 rounded-2xl animate-pulse" />}>
          <EventMap
            events={mapEvents}
            locations={mapLocations}
            flyTo={mapFlyTo}
            onMapClick={handleMapClick}
            flyOnClick
            pendingPosition={!isAddingEvent && editingEventId === null && pendingPosition ? pendingPosition : undefined}
            onPendingMarkerClick={handlePendingMarkerClick}
            selectedPosition={
              editingEventId !== null && editFormData.latitude && editFormData.longitude
                ? { lat: Number(editFormData.latitude), lng: Number(editFormData.longitude) }
                : isAddingEvent && formData.latitude && formData.longitude
                ? { lat: formData.latitude, lng: formData.longitude }
                : undefined
            }
          />
        </Suspense>

        {/* ── Add Event Form Overlay ── */}
        {isAddingEvent && (
          <div
            className="absolute top-3 right-3 z-1001 w-80 rounded-xl overflow-hidden shadow-2xl ring-1 ring-black/10"
            onMouseDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pl-3.5 pr-2.5 py-2.5 bg-orange-600">
              <div className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-white/80 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span className="text-xs font-semibold text-white tracking-wide">เพิ่มกิจกรรมใหม่</span>
              </div>
              <button
                onClick={() => { setIsAddingEvent(false); setFormData({ ...EMPTY_FORM }); setPendingPosition(null); }}
                className="flex items-center justify-center w-6 h-6 rounded-md text-white/70 hover:text-white hover:bg-white/20 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Scrollable body */}
            <div className="bg-white/97 backdrop-blur-sm overflow-y-auto max-h-106 p-3.5 space-y-3">

              {/* ชื่อกิจกรรม */}
              <div>
                <label className="block mb-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                  ชื่อกิจกรรม <span className="text-red-500 normal-case tracking-normal">*</span>
                </label>
                <input name="eventName" value={formData.eventName} onChange={handleInputChange} placeholder="เช่น งานสัมมนาประจำปี 2568" className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-100 focus:outline-none transition-all placeholder:text-gray-300" />
              </div>

              {/* ช่วงเวลา */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                    ช่วงเวลากิจกรรม <span className="text-red-500 normal-case tracking-normal">*</span>
                  </label>
                  {calcDurationDays(formData.startDate, formData.endDate) && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-orange-50 text-orange-600 font-medium border border-orange-200">
                      ระยะเวลา {calcDurationDays(formData.startDate, formData.endDate)}
                    </span>
                  )}
                </div>

                <div className="space-y-1.5">
                  <p className="text-[10px] text-gray-400 font-medium pl-0.5">เริ่มต้น</p>
                  <DateTimePicker
                    dateValue={formData.startDate}
                    timeValue={formData.startTime}
                    onDateChange={v => setFormData(prev => ({ ...prev, startDate: v }))}
                    onTimeChange={v => setFormData(prev => ({ ...prev, startTime: v }))}
                    accent="orange"
                    placeholder="เลือกวันที่เริ่มต้น"
                  />
                </div>

                <div className="space-y-1.5">
                  <p className="text-[10px] text-gray-400 font-medium pl-0.5">สิ้นสุด</p>
                  <DateTimePicker
                    dateValue={formData.endDate}
                    timeValue={formData.endTime}
                    onDateChange={v => setFormData(prev => ({ ...prev, endDate: v }))}
                    onTimeChange={v => setFormData(prev => ({ ...prev, endTime: v }))}
                    accent="orange"
                    placeholder="เลือกวันที่สิ้นสุด"
                  />
                </div>
              </div>

              {/* สถานที่จัดงาน — dual mode */}
              <div>
                <label className="block mb-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                  สถานที่จัดงาน <span className="text-red-500 normal-case tracking-normal">*</span>
                </label>
                {/* Mode toggle */}
                <div className="flex rounded-lg border border-gray-200 overflow-hidden mb-2 text-[11px]">
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, venueMode: 'checkin' }))}
                    className={`flex-1 py-1.5 font-medium transition-all flex items-center justify-center gap-1 ${formData.venueMode === 'checkin' ? 'bg-orange-500 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                  >
                    <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                    <span>สถานที่เช็คอิน</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData(prev => ({ ...prev, venueMode: 'custom' }))}
                    className={`flex-1 py-1.5 font-medium transition-all border-l border-gray-200 flex items-center justify-center gap-1 ${formData.venueMode === 'custom' ? 'bg-orange-500 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
                  >
                    <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                    <span>กำหนดเอง</span>
                  </button>
                </div>
                {/* Mode A — pick existing check-in location */}
                {formData.venueMode === 'checkin' && (
                  <div className="relative">
                    <select name="locationId" value={formData.locationId} onChange={handleInputChange} className="w-full px-2.5 pr-7 py-2 border border-gray-200 rounded-lg text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-100 focus:outline-none transition-all bg-white appearance-none">
                      <option value="">-- เลือกพื้นที่เช็คอิน --</option>
                      {locations.filter(l => l.isActive).map(loc => (
                        <option key={loc.locationId} value={String(loc.locationId)}>{loc.locationName} ({LOCATION_TYPE_LABELS[loc.locationType]})</option>
                      ))}
                    </select>
                    <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                  </div>
                )}
                {/* Mode B — custom venue: type name + pick on map */}
                {formData.venueMode === 'custom' && (
                  <div className="space-y-2">
                    <input
                      type="text"
                      name="customVenueName"
                      value={formData.customVenueName}
                      onChange={handleInputChange}
                      placeholder="ชื่อสถานที่ เช่น ห้องประชุมชั้น 3 อาคาร A"
                      className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-100 focus:outline-none transition-all placeholder:text-gray-300"
                    />
                    {/* Map position indicator for custom mode */}
                    {(formData.latitude !== 0 || formData.longitude !== 0) ? (
                      <div className="flex items-center gap-2 px-2.5 py-2 bg-orange-50 border border-orange-200 rounded-lg">
                        <svg className="w-3.5 h-3.5 text-orange-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                        </svg>
                        <span className="text-[11px] font-mono text-orange-700 flex-1 truncate">{Number(formData.latitude).toFixed(5)}, {Number(formData.longitude).toFixed(5)}</span>
                        <button
                          onClick={() => setFormData(prev => ({ ...prev, latitude: 0, longitude: 0 }))}
                          className="text-[11px] text-orange-600 hover:text-orange-800 font-medium hover:underline underline-offset-2 shrink-0"
                        >
                          รีเซ็ต
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 px-2.5 py-2 bg-amber-50 border border-amber-200 rounded-lg">
                        <svg className="w-3.5 h-3.5 text-amber-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                        <span className="text-[11px] text-amber-700">คลิกบนแผนที่เพื่อระบุตำแหน่ง *</span>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* ผู้เข้าร่วม */}
              <div>
                <label className="block mb-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                  กลุ่มผู้เข้าร่วม <span className="text-red-500 normal-case tracking-normal">*</span>
                </label>
                <div className="relative">
                  <select name="participantType" value={formData.participantType} onChange={handleInputChange} className="w-full px-2.5 pr-7 py-2 border border-gray-200 rounded-lg text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-100 focus:outline-none transition-all bg-white appearance-none">
                    {(Object.entries(PARTICIPANT_TYPE_LABELS) as [ParticipantType, string][]).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                  <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
                {/* Sub-selector for INDIVIDUAL / BRANCH / ROLE */}
                {formData.participantType !== 'ALL' && (
                  <ParticipantSubSelector
                    participantType={formData.participantType}
                    allUsers={allUsers}
                    allBranches={allBranches}
                    loading={loadingParticipants}
                    selectedUserIds={selectedUserIds}
                    selectedBranchIds={selectedBranchIds}
                    selectedRoles={selectedRoles}
                    onUserToggle={id => setSelectedUserIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
                    onBranchToggle={id => setSelectedBranchIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
                    onRoleToggle={role => setSelectedRoles(prev => prev.includes(role) ? prev.filter(x => x !== role) : [...prev, role])}
                    compact
                  />
                )}
              </div>

              {/* รายละเอียด */}
              <div>
                <label className="block mb-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                  รายละเอียดกิจกรรม <span className="text-gray-400 normal-case font-normal tracking-normal">(ไม่บังคับ)</span>
                </label>
                <textarea name="description" value={formData.description} onChange={handleInputChange} placeholder="อธิบายรายละเอียดกิจกรรม วัตถุประสงค์ หรือข้อควรทราบ..." rows={2} className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:border-orange-500 focus:ring-2 focus:ring-orange-100 focus:outline-none transition-all resize-none placeholder:text-gray-300" />
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-2 pt-1 border-t border-gray-100">
                <Button variant="outline" size="sm" onClick={() => { setIsAddingEvent(false); setFormData({ ...EMPTY_FORM }); setPendingPosition(null); }} className="h-8 px-3 text-xs">ยกเลิก</Button>
                <Button size="sm" onClick={handleAddEvent} disabled={submitting} className="h-8 px-4 text-xs bg-orange-600 hover:bg-orange-700 gap-1">
                  {submitting ? (
                    <>
                      <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth={4} />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      กำลังบันทึก...
                    </>
                  ) : (
                    <>
                      <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                      </svg>
                      เพิ่มกิจกรรม
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Events List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">
            รายการกิจกรรม
            <span className="ml-2 text-sm font-normal text-gray-400">({events.length} รายการ)</span>
          </h2>
          <div className="flex items-center gap-3">
            <Button
              onClick={() => { setIsAddingEvent(!isAddingEvent); setEditingEventId(null); setPendingPosition(null); }}
              className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700"
            >
              {isAddingEvent ? (
                <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>ยกเลิก</>
              ) : (
                <><svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>เพิ่มกิจกรรมใหม่</>
              )}
            </Button>
          </div>
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-b-2 border-orange-600 rounded-full animate-spin"></div>
          </div>
        ) : events.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="flex flex-col items-center gap-3">
              <svg className="w-16 h-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-gray-500">ยังไม่มีกิจกรรมในระบบ</p>
            </div>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {sortedEvents.slice((safeEvtPage - 1) * EVT_PER_PAGE, safeEvtPage * EVT_PER_PAGE).map((event) => (
                <EventCard
                  key={event.eventId}
                  event={event}
                  locations={locations}
                  isEditing={editingEventId === event.eventId}
                  editFormData={editFormData}
                  eventPhase={getEventPhase(event)}
                  onEdit={() => handleEditEvent(event)}
                  onSave={handleSaveEdit}
                  onCancel={() => { setEditingEventId(null); setEditFormData({}); setEditSelectedUserIds([]); setEditSelectedBranchIds([]); setEditSelectedRoles([]); }}
                  onDelete={() => handleDeleteEvent(event)}
                  onLocate={() => {
                    const lat = event.location?.latitude ?? event.venueLatitude ?? null;
                    const lng = event.location?.longitude ?? event.venueLongitude ?? null;
                    if (lat && lng) {
                      setMapFlyTo({ lat, lng, zoom: 16, seq: ++mapFlySeq.current });
                      // The layout uses <main> with overflow-y-auto, so scroll that element
                      (document.querySelector('main') ?? document.documentElement).scrollTo({ top: 0, behavior: 'smooth' });
                    }
                  }}
                  onInputChange={handleInputChange}
                  onDateTimeChange={(name, val) => setEditFormData(prev => ({ ...prev, [name]: val }))}
                  onVenueModeChange={(mode) => setEditFormData(prev => ({ ...prev, venueMode: mode }))}
                  submitting={submitting}
                  allUsers={allUsers}
                  allBranches={allBranches}
                  loadingParticipants={loadingParticipants}
                  editSelectedUserIds={editSelectedUserIds}
                  editSelectedBranchIds={editSelectedBranchIds}
                  editSelectedRoles={editSelectedRoles}
                  onEditUserToggle={id => setEditSelectedUserIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
                  onEditBranchToggle={id => setEditSelectedBranchIds(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])}
                  onEditRoleToggle={role => setEditSelectedRoles(prev => prev.includes(role) ? prev.filter(x => x !== role) : [...prev, role])}
                />
              ))}
            </div>
            {evtTotalPages > 1 && (
              <div className="flex items-center justify-center gap-3 mt-4">
                <button
                  onClick={() => setEvtPage(p => Math.max(1, p - 1))}
                  disabled={safeEvtPage <= 1}
                  className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  ← ก่อนหน้า
                </button>
                <span className="text-sm text-gray-500">หน้า {safeEvtPage} / {evtTotalPages}</span>
                <button
                  onClick={() => setEvtPage(p => Math.min(evtTotalPages, p + 1))}
                  disabled={safeEvtPage >= evtTotalPages}
                  className="px-3 py-1.5 rounded-lg border border-gray-300 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                >
                  ถัดไป →
                </button>
              </div>
            )}
          </>
        )}
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
        <div className="fixed inset-0 z-2000 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40" onClick={confirmDialog.onCancel}></div>
          <Card className="relative z-10 w-full max-w-md p-6">
            <h3 className="mb-2 text-lg font-semibold">{confirmDialog.title}</h3>
            <p className="mb-6 text-sm text-gray-700">{confirmDialog.message}</p>
            <div className="flex justify-end gap-3">
              <Button variant="outline" onClick={confirmDialog.onCancel}>ยกเลิก</Button>
              <Button variant="destructive" onClick={confirmDialog.onConfirm}>ยืนยัน</Button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// ── ParticipantSubSelector ──────────────────────────────────────────────────────────
const ALL_ROLES = [
  { value: 'USER', label: 'พนักงาน' },
  { value: 'MANAGER', label: 'ผู้จัดการ' },
  { value: 'ADMIN', label: 'แอดมิน' },
  { value: 'SUPERADMIN', label: 'ซุปเปอร์แอดมิน' },
];

interface ParticipantSubSelectorProps {
  participantType: ParticipantType;
  allUsers: { userId: number; firstName: string; lastName: string; employeeId: string }[];
  allBranches: { branchId: number; name: string }[];
  loading: boolean;
  selectedUserIds: number[];
  selectedBranchIds: number[];
  selectedRoles: string[];
  onUserToggle: (id: number) => void;
  onBranchToggle: (id: number) => void;
  onRoleToggle: (role: string) => void;
  compact?: boolean;
}

function ParticipantSubSelector({
  participantType, allUsers, allBranches, loading,
  selectedUserIds, selectedBranchIds, selectedRoles,
  onUserToggle, onBranchToggle, onRoleToggle, compact,
}: ParticipantSubSelectorProps) {
  const [search, setSearch] = useState('');
  const labelClass = `block mt-2 mb-1 ${compact ? 'text-[10px]' : 'text-xs'} font-semibold text-gray-500 uppercase tracking-wider`;
  const listClass = 'max-h-40 overflow-y-auto border border-gray-200 rounded-lg divide-y divide-gray-100 mt-1';

  if (participantType === 'INDIVIDUAL') {
    const filtered = allUsers.filter(u =>
      !search ||
      `${u.firstName} ${u.lastName}`.toLowerCase().includes(search.toLowerCase()) ||
      u.employeeId.toLowerCase().includes(search.toLowerCase())
    );
    return (
      <div>
        <label className={labelClass}>เลือกพนักงาน ({selectedUserIds.length} คนที่เลือก)</label>
        <input
          type="text"
          placeholder="ค้นหาชื่อหรือรหัสพนักงาน..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className="w-full px-2.5 py-1.5 border border-gray-200 rounded-lg text-xs focus:border-orange-500 focus:ring-1 focus:ring-orange-100 focus:outline-none"
        />
        {loading ? (
          <div className="py-3 text-center text-xs text-gray-400">กำลังโหลด...</div>
        ) : (
          <div className={listClass}>
            {filtered.length === 0
              ? <div className="py-3 text-center text-xs text-gray-400">ไม่พบข้อมูล</div>
              : filtered.map(u => (
                <label key={u.userId} className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-orange-50 cursor-pointer">
                  <input type="checkbox" checked={selectedUserIds.includes(u.userId)} onChange={() => onUserToggle(u.userId)} className="accent-orange-500 shrink-0" />
                  <span className="text-xs text-gray-700 truncate flex-1">{u.firstName} {u.lastName}</span>
                  <span className="text-[10px] text-gray-400 shrink-0">{u.employeeId}</span>
                </label>
              ))
            }
          </div>
        )}
      </div>
    );
  }

  if (participantType === 'BRANCH') {
    return (
      <div>
        <label className={labelClass}>เลือกสาขา ({selectedBranchIds.length} สาขาที่เลือก)</label>
        {loading ? (
          <div className="py-3 text-center text-xs text-gray-400">กำลังโหลด...</div>
        ) : (
          <div className={listClass}>
            {allBranches.length === 0
              ? <div className="py-3 text-center text-xs text-gray-400">ไม่พบข้อมูลสาขา</div>
              : allBranches.map(b => (
                <label key={b.branchId} className="flex items-center gap-2 px-2.5 py-1.5 hover:bg-orange-50 cursor-pointer">
                  <input type="checkbox" checked={selectedBranchIds.includes(b.branchId)} onChange={() => onBranchToggle(b.branchId)} className="accent-orange-500 shrink-0" />
                  <span className="text-xs text-gray-700 truncate">{b.name}</span>
                </label>
              ))
            }
          </div>
        )}
      </div>
    );
  }

  if (participantType === 'ROLE') {
    return (
      <div>
        <label className={labelClass}>เลือกตำแหน่ง ({selectedRoles.length} ตำแหน่งที่เลือก)</label>
        <div className={listClass}>
          {ALL_ROLES.map(r => (
            <label key={r.value} className="flex items-center gap-2 px-2.5 py-2 hover:bg-orange-50 cursor-pointer">
              <input type="checkbox" checked={selectedRoles.includes(r.value)} onChange={() => onRoleToggle(r.value)} className="accent-orange-500 shrink-0" />
              <span className="text-xs text-gray-700">{r.label}</span>
            </label>
          ))}
        </div>
      </div>
    );
  }
  return null;
}

// ── EventCard ──

/** Computed event phase — derived purely from datetime, not from isActive flag.
 *  ongoing  : now is within [startDateTime, endDateTime]
 *  upcoming : event has not started yet
 *  ended    : endDateTime has passed
 */
type EventPhase = 'ongoing' | 'upcoming' | 'ended';

function getEventPhase(evt: EventItem): EventPhase {
  const now = new Date();
  const start = new Date(evt.startDateTime);
  const end = new Date(evt.endDateTime);
  if (now >= start && now <= end) return 'ongoing';
  if (now < start) return 'upcoming';
  return 'ended';
}

interface EventCardProps {
  event: EventItem;
  locations: LocationItem[];
  isEditing: boolean;
  editFormData: Partial<EventFormData>;
  eventPhase: EventPhase;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onLocate: () => void;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  onDateTimeChange: (name: string, val: string) => void;
  onVenueModeChange: (mode: 'checkin' | 'custom') => void;
  submitting: boolean;
  // participant sub-selector props (for edit form)
  allUsers: { userId: number; firstName: string; lastName: string; employeeId: string }[];
  allBranches: { branchId: number; name: string }[];
  loadingParticipants: boolean;
  editSelectedUserIds: number[];
  editSelectedBranchIds: number[];
  editSelectedRoles: string[];
  onEditUserToggle: (id: number) => void;
  onEditBranchToggle: (id: number) => void;
  onEditRoleToggle: (role: string) => void;
}

function EventCard({ event, locations, isEditing, editFormData, eventPhase, onEdit, onSave, onCancel, onDelete, onLocate, onInputChange, onDateTimeChange, onVenueModeChange, submitting, allUsers, allBranches, loadingParticipants, editSelectedUserIds, editSelectedBranchIds, editSelectedRoles, onEditUserToggle, onEditBranchToggle, onEditRoleToggle }: EventCardProps) {
  if (isEditing) {
    return (
      <Card className="p-4 border-2 border-orange-300 md:col-span-2 lg:col-span-3">
        <h3 className="mb-3 font-semibold text-gray-800">แก้ไขกิจกรรม</h3>
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <div className="md:col-span-2">
            <label className="block mb-1 text-xs font-semibold text-gray-600">ชื่อกิจกรรม *</label>
            <input type="text" name="eventName" value={editFormData.eventName || ''} onChange={onInputChange} className="w-full px-3 py-2 text-sm border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none" />
          </div>

          {/* วันที่เริ่ม */}
          <div>
            <label className="block mb-1 text-xs font-semibold text-gray-600">วันที่เริ่มต้น</label>
            <DateTimePicker
              dateValue={editFormData.startDate || ''}
              timeValue={editFormData.startTime || '08:00'}
              onDateChange={v => onDateTimeChange('startDate', v)}
              onTimeChange={v => onDateTimeChange('startTime', v)}
              accent="orange"
              placeholder="เลือกวันที่เริ่มต้น"
            />
          </div>

          {/* วันที่สิ้นสุด */}
          <div>
            <label className="block mb-1 text-xs font-semibold text-gray-600">
              วันที่สิ้นสุด
              {calcDurationDays(editFormData.startDate || '', editFormData.endDate || '') && (
                <span className="ml-2 px-1.5 py-0.5 bg-orange-50 rounded-full text-[10px] font-normal text-orange-600 border border-orange-200">
                  {calcDurationDays(editFormData.startDate || '', editFormData.endDate || '')}
                </span>
              )}
            </label>
            <DateTimePicker
              dateValue={editFormData.endDate || ''}
              timeValue={editFormData.endTime || '17:00'}
              onDateChange={v => onDateTimeChange('endDate', v)}
              onTimeChange={v => onDateTimeChange('endTime', v)}
              accent="orange"
              placeholder="เลือกวันที่สิ้นสุด"
            />
          </div>

          {/* สถานที่จัดงาน — dual mode */}
          <div>
            <label className="block mb-1 text-xs font-semibold text-gray-600">สถานที่จัดงาน *</label>
            {/* Mode toggle */}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden mb-2 text-[11px]">
              <button
                type="button"
                onClick={() => onVenueModeChange('checkin')}
                className={`flex-1 py-1.5 font-medium transition-all flex items-center justify-center gap-1 ${editFormData.venueMode !== 'custom' ? 'bg-orange-500 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
              >
                <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
                <span>สถานที่เช็คอิน</span>
              </button>
              <button
                type="button"
                onClick={() => onVenueModeChange('custom')}
                className={`flex-1 py-1.5 font-medium transition-all border-l border-gray-200 flex items-center justify-center gap-1 ${editFormData.venueMode === 'custom' ? 'bg-orange-500 text-white' : 'bg-white text-gray-500 hover:bg-gray-50'}`}
              >
                <svg className="w-3 h-3 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" /></svg>
                <span>กำหนดเอง</span>
              </button>
            </div>
            {/* Mode A */}
            {editFormData.venueMode !== 'custom' && (
              <select name="locationId" value={editFormData.locationId || ''} onChange={onInputChange} className="w-full px-3 py-2 text-sm border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none bg-white">
                <option value="">-- เลือกพื้นที่เช็คอิน --</option>
                {locations.filter(l => l.isActive).map(loc => (
                  <option key={loc.locationId} value={String(loc.locationId)}>{loc.locationName}</option>
                ))}
              </select>
            )}
            {/* Mode B */}
            {editFormData.venueMode === 'custom' && (
              <div className="space-y-2">
                <input
                  type="text"
                  name="customVenueName"
                  value={editFormData.customVenueName || ''}
                  onChange={onInputChange}
                  placeholder="ชื่อสถานที่ เช่น ห้องประชุมชั้น 3 อาคาร A"
                  className="w-full px-3 py-2 text-sm border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none"
                />
                {(editFormData.latitude && editFormData.longitude) ? (
                  <div className="flex items-center gap-2 px-2.5 py-2 bg-green-50 border border-green-200 rounded-lg text-xs">
                    <svg className="w-3.5 h-3.5 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="font-mono text-green-700 flex-1 truncate">{Number(editFormData.latitude).toFixed(5)}, {Number(editFormData.longitude).toFixed(5)}</span>
                  </div>
                ) : (
                  <div className="px-2.5 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">คลิกบนแผนที่เพื่อระบุตำแหน่ง *</div>
                )}
              </div>
            )}
          </div>
          <div>
            <label className="block mb-1 text-xs font-semibold text-gray-600">กลุ่มผู้เข้าร่วม</label>
            <select name="participantType" value={editFormData.participantType || 'ALL'} onChange={onInputChange} className="w-full px-3 py-2 text-sm border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none bg-white">
              {(Object.entries(PARTICIPANT_TYPE_LABELS) as [ParticipantType, string][]).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
            {/* Sub-selector for edit form */}
            {(editFormData.participantType && editFormData.participantType !== 'ALL') && (
              <ParticipantSubSelector
                participantType={editFormData.participantType}
                allUsers={allUsers}
                allBranches={allBranches}
                loading={loadingParticipants}
                selectedUserIds={editSelectedUserIds}
                selectedBranchIds={editSelectedBranchIds}
                selectedRoles={editSelectedRoles}
                onUserToggle={id => onEditUserToggle(id)}
                onBranchToggle={id => onEditBranchToggle(id)}
                onRoleToggle={role => onEditRoleToggle(role)}
              />
            )}
          </div>
          <div>
            <label className="block mb-1 text-xs font-semibold text-gray-600">สถานะ</label>
            <select name="isActive" value={editFormData.isActive ? 'true' : 'false'} onChange={(e) => onInputChange({ ...e, target: { ...e.target, name: 'isActive', value: e.target.value } } as unknown as React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>)} className="w-full px-3 py-2 text-sm border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none bg-white">
              <option value="true">ใช้งาน</option>
              <option value="false">ปิดใช้</option>
            </select>
          </div>
          <div className="md:col-span-2 flex gap-2 mt-1">
            <Button size="sm" variant="outline" onClick={onCancel} disabled={submitting} className="flex-1">ยกเลิก</Button>
            <Button size="sm" onClick={onSave} disabled={submitting} className="flex-1 bg-orange-600 hover:bg-orange-700">
              {submitting ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card
      className={`p-4 cursor-pointer group transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(234,88,12,0.18)] hover:border-orange-300 ${(!event.isActive || eventPhase === 'ended') ? 'opacity-60 bg-gray-50' : ''}`}
      onClick={onLocate}
    >
      <div className="flex items-start justify-between mb-3 gap-2">
        <h3 className="text-base font-bold text-gray-900 leading-tight line-clamp-2 group-hover:text-orange-700 transition-colors">{event.eventName}</h3>
        <Badge
          variant={eventPhase === 'ongoing' ? 'active' : eventPhase === 'upcoming' ? 'pending' : 'default'}
          className="shrink-0 text-xs"
        >
          {eventPhase === 'ongoing' ? 'กำลังดำเนินการ' : eventPhase === 'upcoming' ? 'กำลังจะมาถึง' : 'สิ้นสุดแล้ว'}
        </Badge>
      </div>

      <div className="space-y-1.5 text-sm text-gray-600 mb-3">
{(event.location || event.venueName) && (
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
            <span className="truncate">{event.location ? event.location.locationName : event.venueName}</span>
          </div>
        )}
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span className="text-xs">{formatDateDisplay(event.startDateTime)}</span>
        </div>
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          <span className="text-xs">{formatDateDisplay(event.endDateTime)}</span>
        </div>
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-xs">{PARTICIPANT_TYPE_LABELS[event.participantType]}</span>
          {event._count?.event_participants !== undefined && (
            <span className="text-xs text-gray-400">({event._count.event_participants} คน)</span>
          )}
        </div>
        {event.description && (
          <p className="text-xs text-gray-500 line-clamp-2 mt-1">{event.description}</p>
        )}
      </div>

      <div className="flex gap-2" onClick={e => e.stopPropagation()}>
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
