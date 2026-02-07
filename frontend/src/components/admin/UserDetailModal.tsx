"use client";

import { User, AttendanceRecord } from '@/types/user';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

interface UserDetailModalProps {
  user: User;
  showDetail: boolean;
  showAttendance: boolean;
  selectedDate: string;
  currentUser: User | null;
  onClose: () => void;
  onEdit: (user?: User) => void;
  onDownloadPDF: () => void;
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
  selectedDate,
  currentUser,
  onClose,
  onEdit,
  onDownloadPDF,
  onDelete,
  onToggleAttendance,
  getFilteredAttendanceRecords
}: UserDetailModalProps) {
  if (!showDetail) return null;

  const getStatusVariant = (status: string): "active" | "suspend" | "pending" | "leave" | "default" => {
    const statusLower = status.toLowerCase();
    if (statusLower === 'active') return 'active';
    if (statusLower === 'suspended') return 'suspend';
    if (statusLower === 'pending') return 'pending';
    if (statusLower === 'leave') return 'leave';
    return 'default';
  };

  const canEditOrDelete = currentUser?.role === 'superadmin' || 
    (currentUser?.role === 'admin' && user.role !== 'superadmin');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
      <div 
        className="absolute inset-0 bg-black/40 backdrop-blur-sm" 
        onClick={onClose}
      />
      <Card className="relative z-10 w-full max-w-4xl max-h-[90vh] overflow-y-auto bg-white rounded-2xl shadow-2xl">
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-6 border-b bg-white/95 backdrop-blur-sm">
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
            onClick={onClose}
            className="p-2 text-gray-400 transition-colors rounded-full hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
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
          {showAttendance && (
            <div>
              <h3 className="mb-3 text-sm font-semibold text-gray-900">บันทึกการเข้า-ออกงาน</h3>
              <div className="space-y-2">
                {getFilteredAttendanceRecords().length === 0 ? (
                  <p className="py-8 text-sm text-center text-gray-500">ไม่มีบันทึกการเข้า-ออกงาน</p>
                ) : (
                  getFilteredAttendanceRecords().map((record, index) => (
                    <Card key={index} className="p-4 bg-gray-50">
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
                        </div>
                        <div>
                          <p className="font-semibold text-red-600">ออกงาน</p>
                          <p className="text-gray-700">{record.checkOut?.time || '-'}</p>
                        </div>
                      </div>
                    </Card>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="sticky bottom-0 flex flex-wrap gap-3 p-6 border-t bg-gray-50">
          <Button
            onClick={onToggleAttendance}
            variant="outline"
            className="flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {showAttendance ? 'ซ่อนบันทึกเวลา' : 'แสดงบันทึกเวลา'}
          </Button>
          
          <Button
            onClick={onDownloadPDF}
            variant="outline"
            className="flex items-center gap-2"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
            </svg>
            ดาวน์โหลด PDF
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
