'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DatePicker } from '@/components/ui/DateTimePicker';
import { Clock, Trash2, Pencil, CheckCircle, XCircle } from 'lucide-react';
import { lateRequestService, LateRequest } from '@/services/lateRequestService';
import { useAuth } from '@/contexts/AuthContext';

function StatusBadge({ status }: { status: string }) {
  if (status === 'APPROVED') return <Badge variant="active">อนุมัติ</Badge>;
  if (status === 'REJECTED') return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">ไม่อนุมัติ</Badge>;
  return <Badge variant="pending">รอพิจารณา</Badge>;
}

// ─────────────────────────────── MY LATE REQUESTS TAB ────────────────────────────────
function MyLateRequestsTab() {
  const { user: authUser } = useAuth();
  const [requests, setRequests] = useState<LateRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<LateRequest | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const [requestDate, setRequestDate] = useState('');
  const [scheduledTime, setScheduledTime] = useState('');
  const [actualTime, setActualTime] = useState('');
  const [reason, setReason] = useState('');
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string | null>(null);

  // Edit state
  const [isEditing, setIsEditing] = useState(false);
  const [editScheduledHour, setEditScheduledHour] = useState('');
  const [editScheduledMin, setEditScheduledMin] = useState('');
  const [editActualHour, setEditActualHour] = useState('');
  const [editActualMin, setEditActualMin] = useState('');
  const [editReason, setEditReason] = useState('');
  const [editAttachmentFile, setEditAttachmentFile] = useState<File | null>(null);
  const [editAttachmentPreview, setEditAttachmentPreview] = useState<string | null>(null);
  const [editImagePreviewUrl, setEditImagePreviewUrl] = useState<string | null>(null);
  const [showEditDeleteConfirm, setShowEditDeleteConfirm] = useState(false);

  const loadRequests = useCallback(async () => {
    try {
      setLoading(true);
      const data = await lateRequestService.getMyLateRequests({});
      setRequests(data.lateRequests || []);
      setError('');
    } catch (err) {
      setError('ไม่สามารถโหลดข้อมูลได้');
      console.error('Failed to load requests:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, [loadRequests]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!requestDate || !scheduledTime || !actualTime || !reason) {
      setError('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }

    try {
      setSubmitting(true);
      setError('');

      let attachmentUrl = undefined;
      if (attachmentFile) {
        const result = await lateRequestService.uploadAttachment(attachmentFile);
        attachmentUrl = result.url;
      }

      const lateMinutes = calculateLateMinutes(scheduledTime, actualTime);

      await lateRequestService.createLateRequest({
        requestDate: new Date(requestDate),
        scheduledTime,
        actualTime,
        reason,
        attachmentUrl,
      });

      setShowSuccess(true);
      setShowFormModal(false);
      setRequestDate('');
      setScheduledTime('');
      setActualTime('');
      setReason('');
      setAttachmentFile(null);
      setAttachmentPreview(null);

      await loadRequests();

      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาด');
      console.error('Error submitting request:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditOpen = (request: LateRequest) => {
    setSelectedRequest(request);
    setIsEditing(true);

    const [hour, min] = request.scheduledTime.split(':');
    setEditScheduledHour(hour);
    setEditScheduledMin(min);

    const [actualHour, actualMin] = request.actualTime.split(':');
    setEditActualHour(actualHour);
    setEditActualMin(actualMin);

    setEditReason(request.reason);
    setEditAttachmentFile(null);
    setEditAttachmentPreview(request.attachmentUrl || null);
    setEditImagePreviewUrl(request.attachmentUrl || null);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;

    try {
      setSubmitting(true);
      setError('');

      const scheduledTime = `${editScheduledHour.padStart(2, '0')}:${editScheduledMin.padStart(2, '0')}`;
      const actualTime = `${editActualHour.padStart(2, '0')}:${editActualMin.padStart(2, '0')}`;

      let attachmentUrl = editAttachmentPreview || undefined;
      if (editAttachmentFile) {
        const result = await lateRequestService.uploadAttachment(editAttachmentFile);
        attachmentUrl = result.url;
      }

      await lateRequestService.updateLateRequest(selectedRequest.id, {
        scheduledTime,
        actualTime,
        reason: editReason,
        attachmentUrl,
      });

      setShowSuccess(true);
      setIsEditing(false);
      setSelectedRequest(null);
      await loadRequests();
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาด');
      console.error('Error updating request:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!selectedRequest) return;

    try {
      setSubmitting(true);
      await lateRequestService.deleteLateRequest(selectedRequest.id);
      setShowSuccess(true);
      setIsEditing(false);
      setSelectedRequest(null);
      setShowEditDeleteConfirm(false);
      await loadRequests();
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'ไม่สามารถลบได้');
      console.error('Error deleting request:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setAttachmentFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        setAttachmentPreview(event.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleEditAttachmentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setEditAttachmentFile(file);
      const reader = new FileReader();
      reader.onload = (event) => {
        const result = event.target?.result as string;
        setEditImagePreviewUrl(result);
      };
      reader.readAsDataURL(file);
    }
  };

  if (loading) return <div className="p-4">กำลังโหลด...</div>;

  return (
    <div className="space-y-4">
      {showSuccess && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          ✓ บันทึกข้อมูลสำเร็จ
        </div>
      )}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      <div className="flex justify-between items-center">
        <h3 className="text-xl font-semibold text-gray-800">คำขอมาสายของฉัน</h3>
        <Button onClick={() => setShowFormModal(true)} className="bg-orange-500 hover:bg-orange-600">
          + เพิ่มคำขอ
        </Button>
      </div>

      {/* Form Modal */}
      {showFormModal && (
        <Card className="p-6 border-orange-200">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-lg font-semibold">เพิ่มคำขอมาสาย</h4>
              <button
                type="button"
                onClick={() => setShowFormModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">วันที่ขอมาสาย</label>
              <DatePicker value={requestDate} onChange={setRequestDate} />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">เวลาที่ควรมา</label>
                <input
                  type="time"
                  value={scheduledTime}
                  onChange={(e) => setScheduledTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">เวลาที่มาจริง</label>
                <input
                  type="time"
                  value={actualTime}
                  onChange={(e) => setActualTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">เหตุผล</label>
              <textarea
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500"
                placeholder="กรุณาระบุเหตุผลการมาสาย"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ไฟล์แนบ</label>
              <input
                type="file"
                onChange={handleAttachmentChange}
                accept="image/*,.pdf,.doc,.docx"
                className="w-full"
              />
              {attachmentPreview && (
                <div className="mt-2 p-2 bg-gray-50 rounded border border-gray-200">
                  {attachmentPreview.startsWith('data:image') ? (
                    <img src={attachmentPreview} alt="preview" className="max-w-xs max-h-40" />
                  ) : (
                    <span className="text-sm text-gray-600">{attachmentFile?.name}</span>
                  )}
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                onClick={() => setShowFormModal(false)}
                variant="outline"
              >
                ยกเลิก
              </Button>
              <Button type="submit" disabled={submitting} className="bg-orange-500 hover:bg-orange-600">
                {submitting ? 'กำลังบันทึก...' : 'บันทึก'}
              </Button>
            </div>
          </form>
        </Card>
      )}

      {/* Edit Modal */}
      {isEditing && selectedRequest && (
        <Card className="p-6 border-orange-200">
          <form onSubmit={handleEditSubmit} className="space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-lg font-semibold">แก้ไขคำขอมาสาย</h4>
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ชั่วโมง (ที่ควรมา)</label>
                <input
                  type="text"
                  value={editScheduledHour}
                  onChange={(e) => setEditScheduledHour(e.target.value.replace(/\D/g, '').slice(0, 2))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  maxLength={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">นาที (ที่ควรมา)</label>
                <input
                  type="text"
                  value={editScheduledMin}
                  onChange={(e) => setEditScheduledMin(e.target.value.replace(/\D/g, '').slice(0, 2))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  maxLength={2}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">ชั่วโมง (มาจริง)</label>
                <input
                  type="text"
                  value={editActualHour}
                  onChange={(e) => setEditActualHour(e.target.value.replace(/\D/g, '').slice(0, 2))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  maxLength={2}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">นาที (มาจริง)</label>
                <input
                  type="text"
                  value={editActualMin}
                  onChange={(e) => setEditActualMin(e.target.value.replace(/\D/g, '').slice(0, 2))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  maxLength={2}
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">เหตุผล</label>
              <textarea
                value={editReason}
                onChange={(e) => setEditReason(e.target.value)}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">ไฟล์แนบ</label>
              <input
                type="file"
                onChange={handleEditAttachmentChange}
                accept="image/*,.pdf,.doc,.docx"
                className="w-full"
              />
              {editImagePreviewUrl && (
                <div className="mt-2 p-2 bg-gray-50 rounded border border-gray-200">
                  {editImagePreviewUrl.startsWith('data:image') ? (
                    <img src={editImagePreviewUrl} alt="preview" className="max-w-xs max-h-40" />
                  ) : (
                    <a href={editImagePreviewUrl} target="_blank" rel="noreferrer" className="text-sm text-blue-600 hover:underline">
                      ดูไฟล์
                    </a>
                  )}
                </div>
              )}
            </div>

            {showEditDeleteConfirm ? (
              <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
                <p className="text-red-700 mb-3">แน่ใจหรือว่าต้องการลบคำขอนี้?</p>
                <div className="flex gap-2">
                  <Button
                    onClick={handleDelete}
                    disabled={submitting}
                    className="bg-red-600 hover:bg-red-700"
                  >
                    {submitting ? 'กำลังลบ...' : 'ลบ'}
                  </Button>
                  <Button
                    onClick={() => setShowEditDeleteConfirm(false)}
                    variant="outline"
                  >
                    ยกเลิก
                  </Button>
                </div>
              </div>
            ) : (
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  type="button"
                  onClick={() => setShowEditDeleteConfirm(true)}
                  variant="outline"
                  className="text-red-600 hover:bg-red-50"
                >
                  <Trash2 className="w-4 h-4 mr-2" />
                  ลบ
                </Button>
                <Button
                  type="button"
                  onClick={() => setIsEditing(false)}
                  variant="outline"
                >
                  ยกเลิก
                </Button>
                <Button type="submit" disabled={submitting} className="bg-orange-500 hover:bg-orange-600">
                  {submitting ? 'กำลังบันทึก...' : 'บันทึก'}
                </Button>
              </div>
            )}
          </form>
        </Card>
      )}

      {/* Requests List */}
      <div className="space-y-3">
        {requests.length === 0 ? (
          <p className="text-gray-500 text-center py-8">ไม่มีคำขอมาสาย</p>
        ) : (
          requests.map((request) => (
            <Card
              key={request.id}
              className="p-4 hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-orange-400"
              onClick={() => handleEditOpen(request)}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-orange-500" />
                    <span className="font-semibold text-gray-800">
                      {new Date(request.requestDate).toLocaleDateString('th-TH')}
                    </span>
                    <StatusBadge status={request.status} />
                  </div>
                  <p className="text-gray-600">
                    เวลามา: {request.scheduledTime} → {request.actualTime} ({request.lateMinutes} นาที)
                  </p>
                  <p className="text-gray-600 text-sm mt-1">{request.reason}</p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleEditOpen(request);
                    }}
                    className="text-orange-500 hover:bg-orange-50 p-2 rounded"
                  >
                    <Pencil className="w-5 h-5" />
                  </button>
                </div>
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────── LATE REQUESTS TO APPROVE TAB ────────────────────────────────
function LateRequestsToApproveTab() {
  console.log('[LateRequestsToApproveTab] Component MOUNTED');
  const { user: authUser } = useAuth();
  const [requests, setRequests] = useState<LateRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);

  const [selectedRequest, setSelectedRequest] = useState<LateRequest | null>(null);
  const [adminComment, setAdminComment] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [approveSubmitting, setApproveSubmitting] = useState(false);

  const loadRequests = useCallback(async () => {
    console.log('[loadRequests] CALLED');
    try {
      setLoading(true);
      const data = await lateRequestService.getAllLateRequests({ status: 'PENDING', take: 20 });
      console.log('[LateRequestsToApproveTab] Received data:', data);
      console.log('[LateRequestsToApproveTab] Setting requests:', data.lateRequests);
      setRequests(data.lateRequests || []);
      setError('');
    } catch (err) {
      setError('โหลดข้อมูลไม่สำเร็จ');
      console.error('Failed to load requests:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadRequests();
  }, []);

  useEffect(() => {
    console.log('[LateRequestsToApproveTab] Render - requests state:', requests);
  }, [requests]);

  const handleApprove = async (request: LateRequest) => {
    if (!request.id) return;
    try {
      setApproveSubmitting(true);
      setError('');
      await lateRequestService.approveLateRequest(request.id, { adminComment });
      setShowSuccess(true);
      setSelectedRequest(null);
      setAdminComment('');
      await loadRequests();
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'ไม่สามารถอนุมัติได้');
      console.error('Error approving request:', err);
    } finally {
      setApproveSubmitting(false);
    }
  };

  const handleReject = async (request: LateRequest) => {
    if (!request.id) return;
    try {
      setApproveSubmitting(true);
      setError('');
      await lateRequestService.rejectLateRequest(request.id, { rejectionReason });
      setShowSuccess(true);
      setSelectedRequest(null);
      setRejectionReason('');
      await loadRequests();
      setTimeout(() => setShowSuccess(false), 3000);
    } catch (err: any) {
      setError(err.message || 'ไม่สามารถปฏิเสธได้');
      console.error('Error rejecting request:', err);
    } finally {
      setApproveSubmitting(false);
    }
  };

  if (loading) return <div className="p-4">กำลังโหลด...</div>;

  return (
    <div className="space-y-4">
      {showSuccess && (
        <div className="p-4 bg-green-50 border border-green-200 rounded-lg text-green-700">
          ✓ บันทึกข้อมูลสำเร็จ
        </div>
      )}
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
          {error}
        </div>
      )}

      <h3 className="text-xl font-semibold text-gray-800">คำขอมาสายที่รอการอนุมัติ</h3>

      {requests.length === 0 ? (
        <p className="text-gray-500 text-center py-8">ไม่มีคำขอที่รอการอนุมัติ</p>
      ) : (
        <div className="space-y-3">
          {requests.map((request) => (
            <Card
              key={request.id}
              className="p-4 hover:shadow-md transition-shadow cursor-pointer border-l-4 border-l-orange-400"
              onClick={() => setSelectedRequest(request)}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock className="w-4 h-4 text-orange-500" />
                    <span className="font-semibold text-gray-800">
                      {request.user?.firstName} {request.user?.lastName}
                    </span>
                    <span className="text-gray-600 text-sm">
                      {new Date(request.requestDate).toLocaleDateString('th-TH')}
                    </span>
                  </div>
                  <p className="text-gray-600">
                    เวลามา: {request.scheduledTime} → {request.actualTime} ({request.lateMinutes} นาที)
                  </p>
                  <p className="text-gray-600 text-sm mt-1">{request.reason}</p>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Approval Modal */}
      {selectedRequest && (
        <Card className="p-6 border-orange-200 fixed inset-0 m-auto w-96 max-h-96 shadow-2xl z-50">
          <div className="flex justify-between items-center mb-4">
            <h4 className="text-lg font-semibold">อนุมัติคำขอ</h4>
            <button
              onClick={() => setSelectedRequest(null)}
              className="text-gray-500 hover:text-gray-700"
            >
              ✕
            </button>
          </div>

          <div className="space-y-4 mb-4">
            <p className="text-gray-600">
              <span className="font-semibold">{selectedRequest.user?.firstName} {selectedRequest.user?.lastName}</span> ขอมาสาย
              <span className="text-orange-600 font-semibold"> {selectedRequest.lateMinutes} นาที</span>
            </p>
            <p className="text-gray-600 text-sm">{selectedRequest.reason}</p>
            {selectedRequest.attachmentUrl && (
              <a
                href={selectedRequest.attachmentUrl}
                target="_blank"
                rel="noreferrer"
                className="text-blue-600 hover:underline text-sm"
              >
                ดูไฟล์แนบ
              </a>
            )}
          </div>

          <div className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">หมายเหตุ (ถ้ามี)</label>
              <textarea
                value={adminComment}
                onChange={(e) => setAdminComment(e.target.value)}
                rows={2}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="ตัวเลือก"
              />
            </div>

            <div className="flex gap-2">
              <Button
                onClick={() => handleApprove(selectedRequest)}
                disabled={approveSubmitting}
                className="flex-1 bg-green-600 hover:bg-green-700"
              >
                <CheckCircle className="w-4 h-4 mr-2" />
                {approveSubmitting ? 'กำลังอนุมัติ...' : 'อนุมัติ'}
              </Button>
              <Button
                onClick={() => setRejectionReason('')}
                variant="outline"
                className="flex-1"
              >
                ปฏิเสธ
              </Button>
            </div>

            {rejectionReason && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">เหตุผลการปฏิเสธ</label>
                <textarea
                  value={rejectionReason}
                  onChange={(e) => setRejectionReason(e.target.value)}
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
                <div className="flex gap-2 mt-2">
                  <Button
                    onClick={() => handleReject(selectedRequest)}
                    disabled={approveSubmitting}
                    className="flex-1 bg-red-600 hover:bg-red-700"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    {approveSubmitting ? 'กำลังปฏิเสธ...' : 'ยืนยันการปฏิเสธ'}
                  </Button>
                  <Button
                    onClick={() => setRejectionReason('')}
                    variant="outline"
                    className="flex-1"
                  >
                    ยกเลิก
                  </Button>
                </div>
              </div>
            )}
          </div>
        </Card>
      )}
    </div>
  );
}

function calculateLateMinutes(scheduledTime: string, actualTime: string): number {
  const [schedHour, schedMin] = scheduledTime.split(':').map(Number);
  const [actualHour, actualMin] = actualTime.split(':').map(Number);
  
  const schedMinutes = schedHour * 60 + schedMin;
  const actualMinutes = actualHour * 60 + actualMin;
  
  return Math.max(0, actualMinutes - schedMinutes);
}

// ─────────────────────────────── MAIN PAGE COMPONENT ────────────────────────────────
export default function SuperAdminLateRequestPage() {
  return (
    <div className="p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold text-gray-800">การขอมาสาย</h1>
        <p className="text-gray-600 mt-1">จัดการคำขอมาสายของคุณและอนุมัติคำขอจากพนักงาน</p>
      </div>

      <Tabs defaultValue="my-requests" className="w-full">
        <TabsList className="grid grid-cols-2 w-full mb-6">
          <TabsTrigger value="my-requests" className="text-base">คำขอของฉัน</TabsTrigger>
          <TabsTrigger value="approve" className="text-base">อนุมัติคำขอ</TabsTrigger>
        </TabsList>

        <TabsContent value="my-requests">
          <MyLateRequestsTab />
        </TabsContent>

        <TabsContent value="approve">
          <LateRequestsToApproveTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
