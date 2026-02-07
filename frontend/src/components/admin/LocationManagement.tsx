"use client";

import { useState, Suspense } from 'react';
import dynamic from 'next/dynamic';
import { useLocations } from '@/contexts/mock-contexts';
import { LocationData } from '@/types/event';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
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

export default function LocationManagement() {
  const { locations, addLocation, updateLocation, deleteLocation } = useLocations();

  const [isAddingLocation, setIsAddingLocation] = useState(false);
  const [editingLocationId, setEditingLocationId] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    locationName: '',
    department: '',
    radius: '',
    latitude: '',
    longitude: ''
  });

  const [editFormData, setEditFormData] = useState<Partial<LocationData>>({});

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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    if (editingLocationId) {
      setEditFormData(prev => ({ ...prev, [name]: value }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleMapClick = (latlng: { lat: number; lng: number }) => {
    if (editingLocationId) {
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

  const handleAddLocation = () => {
    if (!formData.locationName) {
      setAlertDialog({
        isOpen: true,
        type: 'error',
        title: 'ข้อมูลไม่ครบ',
        message: 'กรุณากรอกชื่อสถานที่'
      });
      return;
    }

    const newLocation: LocationData = {
      id: `location-${Date.now()}`,
      locationName: formData.locationName,
      department: formData.department,
      radius: formData.radius ? parseInt(formData.radius) : undefined,
      latitude: parseFloat(formData.latitude) || 13.7563,
      longitude: parseFloat(formData.longitude) || 100.5018,
      createdAt: new Date().toISOString()
    };

    addLocation(newLocation);

    setAlertDialog({
      isOpen: true,
      type: 'success',
      title: 'สำเร็จ!',
      message: 'เพิ่มพื้นที่เช็คอินใหม่เรียบร้อยแล้ว'
    });

    setFormData({
      locationName: '',
      department: '',
      radius: '',
      latitude: '',
      longitude: ''
    });
    setIsAddingLocation(false);
  };

  const handleEditLocation = (location: LocationData) => {
    setEditingLocationId(location.id);
    setEditFormData({ ...location });
  };

  const handleSaveEdit = () => {
    if (!editFormData.locationName) {
      setAlertDialog({
        isOpen: true,
        type: 'error',
        title: 'ข้อมูลไม่ครบ',
        message: 'กรุณากรอกชื่อสถานที่'
      });
      return;
    }

    updateLocation(editingLocationId!, editFormData as LocationData);

    setAlertDialog({
      isOpen: true,
      type: 'success',
      title: 'บันทึกสำเร็จ',
      message: 'แก้ไขข้อมูลพื้นที่เรียบร้อยแล้ว'
    });

    setEditingLocationId(null);
    setEditFormData({});
  };

  const handleCancelEdit = () => {
    setEditingLocationId(null);
    setEditFormData({});
  };

  const handleDeleteLocation = (location: LocationData) => {
    setConfirmDialog({
      isOpen: true,
      title: 'ยืนยันการลบ',
      message: `คุณแน่ใจหรือไม่ที่จะลบสถานที่ "${location.locationName}"? การดำเนินการนี้ไม่สามารถย้อนกลับได้`,
      onConfirm: () => {
        deleteLocation(location.id);
        setAlertDialog({
          isOpen: true,
          type: 'success',
          title: 'ลบสำเร็จ',
          message: 'ลบสถานที่เรียบร้อยแล้ว'
        });
        setConfirmDialog({ isOpen: false });
      },
      onCancel: () => setConfirmDialog({ isOpen: false })
    });
  };

  return (
    <div className="space-y-6">
      {/* Add Location Button */}
      <div className="flex justify-end">
        <Button
          onClick={() => setIsAddingLocation(!isAddingLocation)}
          className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
        >
          {isAddingLocation ? (
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
              เพิ่มพื้นที่เช็คอิน
            </>
          )}
        </Button>
      </div>

      {/* Add Location Form */}
      {isAddingLocation && (
        <Card className="p-6 border-2 border-green-300 bg-green-50/30">
          <h2 className="mb-4 text-xl font-bold text-gray-900">เพิ่มพื้นที่เช็คอินใหม่</h2>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <FormField
              label="ชื่อสถานที่"
              name="locationName"
              value={formData.locationName}
              onChange={handleInputChange}
              required
              placeholder="เช่น สำนักงานกรุงเทพ"
            />
            <FormField
              label="แผนก/ฝ่าย"
              name="department"
              value={formData.department}
              onChange={handleInputChange}
              placeholder="เช่น ฝ่ายขาย"
            />
            <FormField
              label="รัศมี (เมตร)"
              name="radius"
              type="number"
              value={formData.radius}
              onChange={handleInputChange}
              placeholder="เช่น 100"
            />
          </div>
          <div className="flex justify-end gap-3 mt-4">
            <Button variant="outline" onClick={() => setIsAddingLocation(false)}>
              ยกเลิก
            </Button>
            <Button onClick={handleAddLocation} className="bg-green-600 hover:bg-green-700">
              เพิ่มพื้นที่
            </Button>
          </div>
        </Card>
      )}

      {/* Map */}
      <Suspense fallback={<div className="h-[500px] bg-gray-100 rounded-2xl animate-pulse" />}>
        <EventMap 
          events={[]}
          locations={locations}
          onMapClick={isAddingLocation || editingLocationId ? handleMapClick : undefined}
          selectedPosition={
            editingLocationId && editFormData.latitude && editFormData.longitude
              ? { lat: editFormData.latitude, lng: editFormData.longitude }
              : isAddingLocation && formData.latitude && formData.longitude
              ? { lat: parseFloat(formData.latitude), lng: parseFloat(formData.longitude) }
              : undefined
          }
        />
      </Suspense>

      {/* Locations List */}
      <div>
        <h2 className="mb-4 text-xl font-bold text-gray-900">รายการพื้นที่เช็คอิน ({locations?.length ?? 0})</h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {(locations?.length ?? 0) === 0 ? (
            <div className="col-span-full">
              <Card className="p-12 text-center">
                <div className="flex flex-col items-center gap-3">
                  <svg className="w-16 h-16 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  <p className="text-gray-500">ยังไม่มีพื้นที่เช็คอินในระบบ</p>
                </div>
              </Card>
            </div>
          ) : (
            (locations || []).map((location) => (
              <LocationCard
                key={location.id}
                location={location}
                isEditing={editingLocationId === location.id}
                editFormData={editFormData}
                onEdit={() => handleEditLocation(location)}
                onSave={handleSaveEdit}
                onCancel={handleCancelEdit}
                onDelete={() => handleDeleteLocation(location)}
                onInputChange={handleInputChange}
              />
            ))
          )}
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
  location: LocationData;
  isEditing: boolean;
  editFormData: Partial<LocationData>;
  onEdit: () => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete: () => void;
  onInputChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}

function LocationCard({ 
  location, 
  isEditing, 
  editFormData, 
  onEdit, 
  onSave, 
  onCancel, 
  onDelete,
  onInputChange 
}: LocationCardProps) {
  if (isEditing) {
    return (
      <Card className="p-4 border-2 border-green-300">
        <div className="space-y-3">
          <FormField
            label="ชื่อสถานที่"
            name="locationName"
            value={editFormData.locationName || ''}
            onChange={onInputChange}
            required
          />
          <FormField
            label="แผนก/ฝ่าย"
            name="department"
            value={editFormData.department || ''}
            onChange={onInputChange}
          />
          <FormField
            label="รัศมี (เมตร)"
            name="radius"
            type="number"
            value={editFormData.radius?.toString() || ''}
            onChange={onInputChange}
          />
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={onCancel} className="flex-1">
              ยกเลิก
            </Button>
            <Button size="sm" onClick={onSave} className="flex-1 bg-green-600 hover:bg-green-700">
              บันทึก
            </Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 transition-shadow hover:shadow-md">
      <div className="mb-3">
        <h3 className="text-lg font-bold text-gray-900">{location.locationName}</h3>
        {location.department && (
          <p className="text-sm text-gray-600">{location.department}</p>
        )}
      </div>
      
      <div className="space-y-2 text-sm text-gray-600">
        <div className="flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>
            {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
          </span>
        </div>
        
        {location.radius && (
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
            </svg>
            <span>รัศมี: {location.radius} เมตร</span>
          </div>
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
