"use client";

import { useState, useEffect, Suspense, useCallback, useMemo, useRef } from 'react';
import { locationService, LocationItem, LocationType, LOCATION_TYPE_LABELS, CreateLocationRequest } from '@/services/locationService';
import type { LocationData } from '@/types/event';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import AlertDialog from '@/components/common/AlertDialog';
import EventMap from '@/components/admin/DynamicEventMap';

// Stable empty array — prevents FitBounds from seeing a new events reference every render
const EMPTY_EVENTS: never[] = [];

/** แปลง LocationItem (API) → LocationData (แผนที่) */
function toMapLocation(loc: LocationItem): LocationData {
  return {
    id: String(loc.locationId),
    locationName: loc.locationName,
    latitude: loc.latitude,
    longitude: loc.longitude,
    radius: loc.radius,
    department: loc.address,
  };
}

const EMPTY_FORM: CreateLocationRequest & { locationType: LocationType } = {
  locationName: '',
  address: '',
  locationType: 'OFFICE',
  latitude: 0,
  longitude: 0,
  radius: 100,
  description: '',
  isActive: true,
};

interface LocationManagementProps {
  onLocationsChanged?: () => void;
}

export default function LocationManagement({ onLocationsChanged }: LocationManagementProps) {
  const [locations, setLocations] = useState<LocationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddingLocation, setIsAddingLocation] = useState(false);
  const [editingLocationId, setEditingLocationId] = useState<number | null>(null);
  const [pendingPosition, setPendingPosition] = useState<{ lat: number; lng: number } | null>(null);
  const [showAllLocations, setShowAllLocations] = useState(false);
  const [mapFlyTo, setMapFlyTo] = useState<{ lat: number; lng: number; zoom?: number; seq: number } | undefined>();
  const mapFlySeq = useRef(0);

  const [formData, setFormData] = useState({ ...EMPTY_FORM });
  const [editFormData, setEditFormData] = useState<Partial<CreateLocationRequest & { locationType: LocationType }>>({});
  const [submitting, setSubmitting] = useState(false);

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

  const fetchLocations = useCallback(async () => {
    try {
      setLoading(true);
      const res = await locationService.getAll({ isActive: undefined });
      setLocations(Array.isArray(res.data) ? res.data : (res as unknown as LocationItem[]));
    } catch {
      setAlertDialog({ isOpen: true, type: 'error', title: 'ผิดพลาด', message: 'ไม่สามารถดึงรายการสถานที่ได้' });
    } finally {
      setLoading(false);
    }
  }, []);

  // Background sync after mutations — never touches loading state so UI stays stable
  const silentRefresh = useCallback(async () => {
    try {
      const res = await locationService.getAll({ isActive: undefined });
      setLocations(Array.isArray(res.data) ? res.data : (res as unknown as LocationItem[]));
    } catch { /* ignore background sync errors */ }
  }, []);

  useEffect(() => { fetchLocations(); }, [fetchLocations]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    if (editingLocationId !== null) {
      setEditFormData(prev => ({ ...prev, [name]: value }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleMapClick = useCallback((latlng: { lat: number; lng: number }) => {
    if (editingLocationId !== null) {
      setEditFormData(prev => ({ ...prev, latitude: latlng.lat, longitude: latlng.lng }));
    } else if (isAddingLocation) {
      setFormData(prev => ({ ...prev, latitude: latlng.lat, longitude: latlng.lng }));
    } else {
      // Not in any form mode — place pending marker so user can click it to open form
      setPendingPosition(latlng);
    }
  }, [editingLocationId, isAddingLocation]);

  // Called when user clicks the green pending marker → open add form pre-filled with coords
  const handlePendingMarkerClick = useCallback(() => {
    if (!pendingPosition) return;
    setFormData(prev => ({ ...prev, latitude: pendingPosition.lat, longitude: pendingPosition.lng }));
    setIsAddingLocation(true);
  }, [pendingPosition]);

  const handleAddLocation = async () => {
    if (!formData.locationName) {
      setAlertDialog({ isOpen: true, type: 'error', title: 'ข้อมูลไม่ครบ', message: 'กรุณากรอกชื่อสถานที่' });
      return;
    }
    if (!formData.latitude || !formData.longitude) {
      setAlertDialog({ isOpen: true, type: 'error', title: 'ไม่ได้เลือกตำแหน่ง', message: 'กรุณาคลิกบนแผนที่เพื่อเลือกตำแหน่ง' });
      return;
    }

    try {
      setSubmitting(true);
      await locationService.create({
        locationName: formData.locationName,
        address: formData.address,
        locationType: formData.locationType,
        latitude: Number(formData.latitude),
        longitude: Number(formData.longitude),
        radius: formData.radius ? Number(formData.radius) : undefined,
        description: formData.description,
        isActive: true,
      });
      // Optimistic: prepend a placeholder so the list updates instantly
      const optimisticItem: LocationItem = {
        locationId: -Date.now(), // temp ID, replaced by silentRefresh
        locationName: formData.locationName,
        address: formData.address || '',
        locationType: formData.locationType,
        latitude: Number(formData.latitude),
        longitude: Number(formData.longitude),
        radius: formData.radius ? Number(formData.radius) : 100,
        description: formData.description || '',
        isActive: true,
      };
      setLocations(prev => [optimisticItem, ...prev]);
      setAlertDialog({ isOpen: true, type: 'success', title: 'สำเร็จ!', message: 'เพิ่มพื้นที่เช็คอินใหม่เรียบร้อยแล้ว' });
      setFormData({ ...EMPTY_FORM });
      setIsAddingLocation(false);
      setPendingPosition(null);
      silentRefresh(); // replace temp item with real server data in background
      onLocationsChanged?.();
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const msg = (err as any)?.response?.data?.error || 'เกิดข้อผิดพลาด กรุณาลองใหม่';
      setAlertDialog({ isOpen: true, type: 'error', title: 'ผิดพลาด', message: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditLocation = (location: LocationItem) => {
    setEditingLocationId(location.locationId);
    setEditFormData({
      locationName: location.locationName,
      address: location.address,
      locationType: location.locationType,
      latitude: location.latitude,
      longitude: location.longitude,
      radius: location.radius,
      description: location.description,
      isActive: location.isActive,
    });
  };

  const handleSaveEdit = async () => {
    if (!editFormData.locationName) {
      setAlertDialog({ isOpen: true, type: 'error', title: 'ข้อมูลไม่ครบ', message: 'กรุณากรอกชื่อสถานที่' });
      return;
    }

    try {
      setSubmitting(true);
      await locationService.update(editingLocationId!, {
        locationName: editFormData.locationName,
        address: editFormData.address,
        locationType: editFormData.locationType,
        latitude: editFormData.latitude !== undefined ? Number(editFormData.latitude) : undefined,
        longitude: editFormData.longitude !== undefined ? Number(editFormData.longitude) : undefined,
        radius: editFormData.radius !== undefined ? Number(editFormData.radius) : undefined,
        description: editFormData.description,
        isActive: editFormData.isActive,
      });
      // Optimistic: update the card in-place immediately
      setLocations(prev => prev.map(l =>
        l.locationId === editingLocationId
          ? {
              ...l,
              locationName: editFormData.locationName ?? l.locationName,
              address: editFormData.address ?? l.address,
              locationType: editFormData.locationType ?? l.locationType,
              latitude: editFormData.latitude !== undefined ? Number(editFormData.latitude) : l.latitude,
              longitude: editFormData.longitude !== undefined ? Number(editFormData.longitude) : l.longitude,
              radius: editFormData.radius !== undefined ? Number(editFormData.radius) : l.radius,
              description: editFormData.description ?? l.description,
              isActive: editFormData.isActive ?? l.isActive,
            }
          : l
      ));
      setAlertDialog({ isOpen: true, type: 'success', title: 'บันทึกสำเร็จ', message: 'แก้ไขข้อมูลพื้นที่เรียบร้อยแล้ว' });
      setEditingLocationId(null);
      setEditFormData({});
      silentRefresh(); // confirm sync in background
      onLocationsChanged?.();
    } catch (err) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const msg = (err as any)?.response?.data?.error || 'เกิดข้อผิดพลาด กรุณาลองใหม่';
      setAlertDialog({ isOpen: true, type: 'error', title: 'ผิดพลาด', message: msg });
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancelEdit = () => {
    setEditingLocationId(null);
    setEditFormData({});
  };

  const handleDeleteLocation = (location: LocationItem) => {
    setConfirmDialog({
      isOpen: true,
      title: 'ยืนยันการลบ',
      message: `คุณแน่ใจหรือไม่ที่จะลบสถานที่ "${location.locationName}"?`,
      onConfirm: async () => {
        // Optimistic: remove from list immediately before the API responds
        setLocations(prev => prev.filter(l => l.locationId !== location.locationId));
        setConfirmDialog({ isOpen: false });
        try {
          await locationService.delete(location.locationId);
          setAlertDialog({ isOpen: true, type: 'success', title: 'ลบสำเร็จ', message: 'ลบสถานที่เรียบร้อยแล้ว' });
          silentRefresh(); // confirm sync in background
          onLocationsChanged?.();
        } catch (err) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const msg = (err as any)?.response?.data?.error || 'ลบไม่สำเร็จ';
          // Rollback: restore deleted item by re-fetching
          silentRefresh();
          setAlertDialog({ isOpen: true, type: 'error', title: 'ผิดพลาด', message: msg });
        }
      },
      onCancel: () => setConfirmDialog({ isOpen: false })
    });
  };

  const mapLocations = useMemo(
    () => locations.filter(l => l.isActive).map(toMapLocation),
    [locations]
  );
  return (
    <div className="space-y-6">
      {/* Map + Add-form overlay */}
      <div className="relative">
        <Suspense fallback={<div className="h-125 bg-gray-100 rounded-2xl animate-pulse" />}>
          <EventMap
            events={EMPTY_EVENTS}
            locations={mapLocations}
            onMapClick={handleMapClick}
            flyOnClick
            pendingPosition={!isAddingLocation && !editingLocationId && pendingPosition ? pendingPosition : undefined}
            onPendingMarkerClick={handlePendingMarkerClick}
            flyTo={mapFlyTo}
            selectedPosition={
              editingLocationId !== null && editFormData.latitude && editFormData.longitude
                ? { lat: Number(editFormData.latitude), lng: Number(editFormData.longitude) }
                : isAddingLocation && formData.latitude && formData.longitude
                ? { lat: formData.latitude, lng: formData.longitude }
                : undefined
            }
          />
        </Suspense>

        {/* ── Add Location Form Overlay ── */}
        {isAddingLocation && (
          <div
            className="absolute top-3 right-3 z-1001 w-72 rounded-xl overflow-hidden shadow-2xl ring-1 ring-black/10"
            onMouseDown={e => e.stopPropagation()}
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between pl-3.5 pr-2.5 py-2.5 bg-green-600">
              <div className="flex items-center gap-2">
                <svg className="w-3.5 h-3.5 text-white/80 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
                <span className="text-xs font-semibold text-white tracking-wide">เพิ่มพื้นที่เช็คอินใหม่</span>
              </div>
              <button
                onClick={() => { setIsAddingLocation(false); setFormData({ ...EMPTY_FORM }); setPendingPosition(null); }}
                className="flex items-center justify-center w-6 h-6 rounded-md text-white/70 hover:text-white hover:bg-white/20 transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Scrollable body */}
            <div className="bg-white/97 backdrop-blur-sm overflow-y-auto max-h-106 p-3.5 space-y-3">

              {/* ชื่อสถานที่ */}
              <div>
                <label className="block mb-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                  ชื่อสถานที่ <span className="text-red-500 normal-case tracking-normal">*</span>
                </label>
                <input
                  type="text"
                  name="locationName"
                  value={formData.locationName}
                  onChange={handleInputChange}
                  placeholder="เช่น สำนักงานกรุงเทพ"
                  className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:border-green-500 focus:ring-2 focus:ring-green-100 focus:outline-none transition-all placeholder:text-gray-300"
                />
              </div>

              {/* ประเภท */}
              <div>
                <label className="block mb-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                  ประเภทสถานที่ <span className="text-red-500 normal-case tracking-normal">*</span>
                </label>
                <div className="relative">
                  <select
                    name="locationType"
                    value={formData.locationType}
                    onChange={handleInputChange}
                    className="w-full px-2.5 pr-7 py-2 border border-gray-200 rounded-lg text-sm focus:border-green-500 focus:ring-2 focus:ring-green-100 focus:outline-none transition-all bg-white appearance-none"
                  >
                    {(Object.entries(LOCATION_TYPE_LABELS) as [LocationType, string][]).map(([val, label]) => (
                      <option key={val} value={val}>{label}</option>
                    ))}
                  </select>
                  <svg className="absolute right-2 top-1/2 -translate-y-1/2 w-3 h-3 text-gray-400 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </div>
              </div>

              {/* ที่อยู่ */}
              <div>
                <label className="block mb-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">ที่อยู่</label>
                <input
                  type="text"
                  name="address"
                  value={formData.address || ''}
                  onChange={handleInputChange}
                  placeholder="เช่น 123 ถนนสุขุมวิท แขวงคลองเตย"
                  className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:border-green-500 focus:ring-2 focus:ring-green-100 focus:outline-none transition-all placeholder:text-gray-300"
                />
              </div>

              {/* รัศมีเช็คอิน */}
              <div>
                <label className="block mb-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">รัศมีเช็คอิน</label>
                <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden focus-within:border-green-500 focus-within:ring-2 focus-within:ring-green-100 transition-all">
                  <input
                    type="number"
                    name="radius"
                    value={formData.radius?.toString() || ''}
                    onChange={handleInputChange}
                    placeholder="100"
                    min={10}
                    max={5000}
                    className="flex-1 min-w-0 px-2.5 py-2 text-sm focus:outline-none bg-transparent"
                  />
                  <span className="px-2.5 py-2 text-[11px] font-medium text-gray-400 bg-gray-50 border-l border-gray-200 shrink-0">เมตร</span>
                </div>
              </div>

              {/* ตำแหน่งที่ตั้ง */}
              <div>
                <label className="block mb-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">ตำแหน่งที่ตั้ง</label>
                {formData.latitude && formData.longitude ? (
                  <div className="flex items-center gap-2 px-2.5 py-2 bg-green-50 border border-green-200 rounded-lg">
                    <svg className="w-3.5 h-3.5 text-green-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-[11px] font-mono text-green-700 flex-1 truncate">{Number(formData.latitude).toFixed(5)}, {Number(formData.longitude).toFixed(5)}</span>
                    <button
                      onClick={() => setFormData(prev => ({ ...prev, latitude: 0, longitude: 0 }))}
                      className="text-[11px] text-green-600 hover:text-green-800 font-medium hover:underline underline-offset-2 shrink-0"
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
                    <span className="text-[11px] text-amber-700">คลิกบนแผนที่เพื่อเลือกตำแหน่ง <span className="text-red-500">*</span></span>
                  </div>
                )}
              </div>

              {/* หมายเหตุ */}
              <div>
                <label className="block mb-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                  หมายเหตุ <span className="text-gray-400 normal-case font-normal tracking-normal">(ไม่บังคับ)</span>
                </label>
                <textarea
                  name="description"
                  value={formData.description || ''}
                  onChange={handleInputChange}
                  placeholder="รายละเอียดเพิ่มเติม เช่น ชั้นที่ตั้ง เวลาทำการ..."
                  rows={2}
                  className="w-full px-2.5 py-2 border border-gray-200 rounded-lg text-sm focus:border-green-500 focus:ring-2 focus:ring-green-100 focus:outline-none transition-all resize-none placeholder:text-gray-300"
                />
              </div>

              {/* Footer buttons */}
              <div className="flex items-center justify-end gap-2 pt-1 border-t border-gray-100">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setIsAddingLocation(false); setFormData({ ...EMPTY_FORM }); setPendingPosition(null); }}
                  className="h-8 px-3 text-xs"
                >
                  ยกเลิก
                </Button>
                <Button
                  size="sm"
                  onClick={handleAddLocation}
                  disabled={submitting}
                  className="h-8 px-4 text-xs bg-green-600 hover:bg-green-700 gap-1"
                >
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
                      เพิ่มพื้นที่
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Locations List */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-900">
            รายการพื้นที่เช็คอิน
            <span className="ml-2 text-sm font-normal text-gray-400">({locations.length} รายการ)</span>
          </h2>
          {locations.length > 3 && (
            <button
              onClick={() => setShowAllLocations(v => !v)}
              className="flex items-center gap-1.5 text-sm text-orange-600 hover:text-orange-700 font-medium transition-colors"
            >
              {showAllLocations ? (
                <>
                  ยุบรายการ
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                  </svg>
                </>
              ) : (
                <>
                  แสดงทั้งหมด {locations.length} รายการ
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </>
              )}
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex justify-center py-12">
            <div className="w-8 h-8 border-b-2 border-orange-600 rounded-full animate-spin"></div>
          </div>
        ) : locations.length === 0 ? (
          <Card className="p-12 text-center">
            <div className="flex flex-col items-center gap-3">
              <svg className="w-16 h-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              <p className="text-gray-500">ยังไม่มีพื้นที่เช็คอินในระบบ</p>
            </div>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
              {(showAllLocations ? locations : locations.slice(0, 3)).map((location) => (
                <LocationCard
                  key={location.locationId}
                  location={location}
                  isEditing={editingLocationId === location.locationId}
                  editFormData={editFormData}
                  onEdit={() => handleEditLocation(location)}
                  onSave={handleSaveEdit}
                  onCancel={handleCancelEdit}
                  onDelete={() => handleDeleteLocation(location)}
                  onInputChange={handleInputChange}
                  onLocate={() => {
                    setMapFlyTo({ lat: location.latitude, lng: location.longitude, zoom: 16, seq: ++mapFlySeq.current });
                    // The layout uses <main> with overflow-y-auto, so scroll that element
                    (document.querySelector('main') ?? document.documentElement).scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  submitting={submitting}
                />
              ))}
            </div>
            {!showAllLocations && locations.length > 3 && (
              <button
                onClick={() => setShowAllLocations(true)}
                className="mt-4 w-full py-2.5 rounded-xl border border-dashed border-gray-300 text-sm text-gray-500 hover:border-orange-400 hover:text-orange-600 hover:bg-orange-50/50 transition-all flex items-center justify-center gap-1.5"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
                ซ่อนอยู่อีก {locations.length - 3} รายการ — คลิกเพื่อแสดงทั้งหมด
              </button>
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

// ── Sub-components ──

interface FormFieldProps {
  label: string;
  name: string;
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  type?: string;
  required?: boolean;
  placeholder?: string;
}

function FormField({ label, name, value, onChange, type = 'text', required, placeholder }: FormFieldProps) {
  return (
    <div>
      <label className="block mb-2 text-sm font-semibold text-gray-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <input
        type={type}
        name={name}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="w-full px-4 py-3 border-2 border-gray-300 rounded-xl focus:border-gray-900 focus:outline-none transition-all"
      />
    </div>
  );
}

interface LocationCardProps {
  location: LocationItem;
  isEditing: boolean;
  editFormData: Partial<CreateLocationRequest & { locationType: LocationType }>;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onLocate: () => void;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => void;
  submitting: boolean;
}

function LocationCard({ location, isEditing, editFormData, onEdit, onSave, onCancel, onDelete, onLocate, onInputChange, submitting }: LocationCardProps) {
  if (isEditing) {
    return (
      <Card className="p-4 border-2 border-green-300">
        <div className="space-y-3">
          <div>
            <label className="block mb-1 text-xs font-semibold text-gray-600">ชื่อสถานที่ *</label>
            <input type="text" name="locationName" value={editFormData.locationName || ''} onChange={onInputChange} className="w-full px-3 py-2 text-sm border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none" />
          </div>
          <div>
            <label className="block mb-1 text-xs font-semibold text-gray-600">ประเภท</label>
            <select name="locationType" value={editFormData.locationType || 'OFFICE'} onChange={onInputChange} className="w-full px-3 py-2 text-sm border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none bg-white">
              {(Object.entries(LOCATION_TYPE_LABELS) as [LocationType, string][]).map(([val, label]) => (
                <option key={val} value={val}>{label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block mb-1 text-xs font-semibold text-gray-600">ที่อยู่</label>
            <input type="text" name="address" value={editFormData.address || ''} onChange={onInputChange} className="w-full px-3 py-2 text-sm border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none" />
          </div>
          <div>
            <label className="block mb-1 text-xs font-semibold text-gray-600">รัศมี (เมตร)</label>
            <input type="number" name="radius" value={editFormData.radius?.toString() || ''} onChange={onInputChange} className="w-full px-3 py-2 text-sm border-2 border-gray-300 rounded-lg focus:border-green-500 focus:outline-none" />
          </div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onCancel} className="flex-1" disabled={submitting}>ยกเลิก</Button>
            <Button size="sm" onClick={onSave} className="flex-1 bg-green-600 hover:bg-green-700" disabled={submitting}>
              {submitting ? 'กำลังบันทึก...' : 'บันทึก'}
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card
      className={`p-4 cursor-pointer group transition-all duration-200 hover:-translate-y-1 hover:shadow-[0_8px_30px_rgba(37,99,235,0.18)] hover:border-blue-300 ${!location.isActive ? 'opacity-60 bg-gray-50' : ''}`}
      onClick={onLocate}
    >
      <div className="mb-3">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-base font-bold text-gray-900 leading-tight group-hover:text-blue-700 transition-colors">{location.locationName}</h3>
          <span className={`text-xs px-2 py-0.5 rounded-full shrink-0 ${location.isActive ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
            {location.isActive ? 'ใช้งาน' : 'ปิดใช้'}
          </span>
        </div>
        <span className="inline-block mt-1 text-xs px-2 py-0.5 bg-blue-50 text-blue-600 rounded-full">
          {LOCATION_TYPE_LABELS[location.locationType] || location.locationType}
        </span>
        {location.address && <p className="mt-1 text-sm text-gray-500 truncate">{location.address}</p>}
      </div>

      <div className="space-y-1 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span className="text-xs font-mono">{location.latitude.toFixed(5)}, {location.longitude.toFixed(5)}</span>
        </div>
        {location.radius > 0 && (
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <circle cx="12" cy="12" r="9" strokeWidth={2} />
            </svg>
            <span className="text-xs">รัศมี: {location.radius} เมตร</span>
          </div>
        )}
      </div>

      <div className="flex gap-2 mt-4" onClick={e => e.stopPropagation()}>
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
