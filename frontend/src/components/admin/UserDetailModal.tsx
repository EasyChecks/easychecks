"use client";

import { useState, useEffect } from 'react';
import { User, AttendanceRecord } from '@/types/user';
import type { AuthUser } from '@/types/auth';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface UserDetailModalProps {
  user: User;
  showDetail: boolean;
  showAttendance: boolean;
  loadingAttendance?: boolean;
  selectedDate: string;
  currentUser: User | AuthUser | null;
  onClose: () => void;
  onEdit: (user?: User) => void;
  onDownloadPDF?: () => void;
  onDelete: (user: User) => void;
  onToggleAttendance: () => void;
  getStatusBadge: (status: string) => string;
  getFilteredAttendanceRecords: () => AttendanceRecord[];
  onSetSelectedDate: (date: string) => void;
}

export default function UserDetailModal({
  user,
  showDetail,
  showAttendance,
  loadingAttendance,
  selectedDate,
  currentUser,
  onClose,
  onEdit,
  onDelete,
  onToggleAttendance,
  getFilteredAttendanceRecords
}: UserDetailModalProps) {
  const [photoPopup, setPhotoPopup] = useState<{ url: string; label: string } | null>(null);
  const [visible, setVisible] = useState(false);
  const [photoLoaded, setPhotoLoaded] = useState(false);

  useEffect(() => {
    if (showDetail) {
      requestAnimationFrame(() => setVisible(true));
    }
    return () => setVisible(false);
  }, [showDetail]);

  if (!showDetail) return null;

  const handleClose = () => {
    setVisible(false);
    setTimeout(onClose, 200);
  };

  const getStatusVariant = (status: string): "active" | "suspend" | "pending" | "leave" | "default" => {
    const statusLower = status.toLowerCase();
    if (statusLower === 'active') return 'active';
    if (statusLower === 'suspended') return 'suspend';
    if (statusLower === 'pending') return 'pending';
    if (statusLower === 'leave') return 'leave';
    return 'default';
  };

  const canEditOrDelete = (currentUser && currentUser.role && currentUser.role.toLowerCase() === 'superadmin') || 
    (currentUser && currentUser.role && currentUser.role.toLowerCase() === 'admin' && 
     user.role && user.role.toLowerCase() !== 'superadmin');

  const records = getFilteredAttendanceRecords();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div 
        className={`absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${visible ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleClose}
      />
      <Card className={`relative z-10 flex flex-col w-full max-w-4xl max-h-[90vh] bg-white rounded-2xl shadow-2xl transition-all duration-200 ${visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'}`}>
        {/* Header */}
        <div className="flex-shrink-0 flex items-center justify-between p-6 border-b bg-white rounded-t-2xl">
          <div className="flex items-center gap-4">
            {user.profileImage ? (
              <img 
                src={user.profileImage} 
                alt={user.name}
                className="w-16 h-16 border-4 border-white rounded-full shadow-lg"
              />
            ) : (
              <div className="flex items-center justify-center w-16 h-16 text-2xl font-bold text-white border-4 border-white rounded-full shadow-lg bg-gradient-to-br from-orange-400 to-orange-600">
                {user.name.charAt(0).toUpperCase()}
              </div>
            )}
            <div>
              <h2 className="text-2xl font-bold text-gray-900">{user.name}</h2>
              <p className="text-sm text-gray-500">{user.position} • {user.department}</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-2 text-gray-400 transition-colors rounded-full hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* Status and Role */}
          <div className="flex items-center gap-3">
            <Badge variant={getStatusVariant(user.status)}>
              {user.status}
            </Badge>
            <span className="px-3 py-1 text-sm font-semibold text-gray-700 capitalize bg-gray-100 rounded-lg">
              {user.role}
            </span>
          </div>

          {/* Basic Information */}
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            <InfoField label="รหัสพนักงาน" value={user.employeeId} />
            <InfoField label="อีเมล" value={user.email} />
            <InfoField label="เบอร์โทร" value={user.phone} />
            <InfoField label="สาขา" value={user.branch || user.provinceCode || user.employeeId?.substring(0, 3) || 'N/A'} />
            <InfoField label="วันเกิด" value={user.birthDate || '-'} />
            <InfoField label="อายุ" value={user.age ? `${user.age} ปี` : '-'} />
            <InfoField label="หมู่เลือด" value={user.bloodType || '-'} />
            <InfoField label="เลขบัตรประชาชน" value={user.nationalId || '-'} />
          </div>

          {/* Address */}
          {user.address && (
            <div>
              <h3 className="mb-2 text-sm font-semibold text-gray-700">ที่อยู่</h3>
              <p className="text-sm text-gray-600">{user.address}</p>
            </div>
          )}

          {/* Emergency Contact */}
          {user.emergencyContact && (
            <div>
              <h3 className="mb-3 text-sm font-semibold text-gray-900">ผู้ติดต่อฉุกเฉิน</h3>
              <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
                <InfoField label="ชื่อ" value={user.emergencyContact.name} />
                <InfoField label="เบอร์โทร" value={user.emergencyContact.phone} />
                <InfoField label="ความสัมพันธ์" value={user.emergencyContact.relation} />
              </div>
            </div>
          )}

          {/* Work History */}
          {user.workHistory && user.workHistory.length > 0 && (
            <div>
              <h3 className="mb-3 text-sm font-semibold text-gray-900">ประวัติการทำงาน</h3>
              <div className="space-y-3">
                {user.workHistory.map((work, index) => (
                  <Card key={index} className="p-4 bg-gray-50">
                    <p className="font-semibold text-gray-900">{work.position}</p>
                    <p className="text-sm text-gray-600">{work.company}</p>
                    <p className="text-xs text-gray-500">{work.startDate} - {work.endDate}</p>
                    {work.description && (
                      <p className="mt-2 text-sm text-gray-600">{work.description}</p>
                    )}
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Attendance Section */}
          <div className={`transition-all duration-300 ease-in-out overflow-hidden ${showAttendance ? 'max-h-[2000px] opacity-100' : 'max-h-0 opacity-0'}`}>
            <div className="pt-1">
              <h3 className="mb-3 text-sm font-semibold text-gray-900">บันทึกการเข้า-ออกงาน</h3>
              {loadingAttendance ? (
                <div className="flex items-center justify-center gap-2 py-8">
                  <svg className="w-5 h-5 animate-spin text-orange-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  <span className="text-sm text-gray-500">กำลังโหลดบันทึกเวลา...</span>
                </div>
              ) : (
                <div className="space-y-2">
                  {records.length === 0 ? (
                    <p className="py-8 text-sm text-center text-gray-500">ไม่มีบันทึกการเข้า-ออกงาน</p>
                  ) : (
                    records.map((record, index) => (
                      <Card key={index} className="p-4 bg-gray-50 animate-in fade-in duration-200" style={{ animationDelay: `${index * 50}ms` }}>
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-semibold text-gray-900">{record.date}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-sm">
                          <div>
                            <p className="font-semibold text-green-600">เข้างาน</p>
                            <p className="text-gray-700">{record.checkIn?.time || '-'}</p>
                            {record.checkIn?.status && (
                              <Badge variant={record.checkIn.status === 'onTime' ? 'active' : 'pending'} className="mt-1">
                                {record.checkIn.status === 'onTime' ? 'ตรงเวลา' : 'สาย'}
                              </Badge>
                            )}
                            {record.checkIn?.photo && (
                              <button
                                onClick={() => { setPhotoLoaded(false); setPhotoPopup({ url: record.checkIn!.photo!, label: `เข้างาน ${record.date}` }); }}
                                className="flex items-center gap-1 mt-2 text-xs text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                ดูรูปเข้างาน
                              </button>
                            )}
                          </div>
                          <div>
                            <p className="font-semibold text-red-600">ออกงาน</p>
                            <p className="text-gray-700">{record.checkOut?.time || '-'}</p>
                            {record.checkOut?.photo && (
                              <button
                                onClick={() => { setPhotoLoaded(false); setPhotoPopup({ url: record.checkOut!.photo!, label: `ออกงาน ${record.date}` }); }}
                                className="flex items-center gap-1 mt-2 text-xs text-blue-600 hover:text-blue-800 hover:underline transition-colors"
                              >
                                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                                </svg>
                                ดูรูปออกงาน
                              </button>
                            )}
                          </div>
                        </div>
                      </Card>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="flex-shrink-0 flex flex-wrap gap-3 p-6 border-t bg-gray-50 rounded-b-2xl">
          <Button
            onClick={onToggleAttendance}
            variant="outline"
            className="flex items-center gap-2"
            disabled={loadingAttendance}
          >
            {loadingAttendance ? (
              <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            )}
            {loadingAttendance ? 'กำลังโหลด...' : showAttendance ? 'ซ่อนบันทึกเวลา' : 'แสดงบันทึกเวลา'}
          </Button>

          {canEditOrDelete && (
            <>
              <Button
                onClick={() => onEdit()}
                className="flex items-center gap-2 bg-orange-600 hover:bg-orange-700"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                แก้ไข
              </Button>

              <Button
                onClick={() => onDelete(user)}
                variant="destructive"
                className="flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                ลบผู้ใช้
              </Button>
            </>
          )}
        </div>
      </Card>

      {/* Photo Popup */}
      {photoPopup && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/60 animate-in fade-in duration-150"
            onClick={() => setPhotoPopup(null)}
          />
          <div className="relative z-10 max-w-lg w-full bg-white rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-200">
            <div className="flex items-center justify-between p-4 border-b">
              <h3 className="text-sm font-semibold text-gray-900">{photoPopup.label}</h3>
              <button
                onClick={() => setPhotoPopup(null)}
                className="p-1.5 text-gray-400 transition-colors rounded-full hover:bg-gray-100 hover:text-gray-600"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-4">
              {!photoLoaded && (
                <div className="flex items-center justify-center py-16">
                  <svg className="w-8 h-8 animate-spin text-orange-500" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                </div>
              )}
              <img
                src={photoPopup.url}
                alt={photoPopup.label}
                className={`w-full h-auto rounded-lg object-contain max-h-[60vh] transition-opacity duration-200 ${photoLoaded ? 'opacity-100' : 'opacity-0 h-0'}`}
                onLoad={() => setPhotoLoaded(true)}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function InfoField({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-500">{label}</p>
      <p className="text-sm text-gray-900">{value}</p>
    </div>
  );
}
