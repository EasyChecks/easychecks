'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Thermometer, FileText, Plane, Heart, Shield, BookOpen, Stethoscope, Sparkles, Pencil, X, Trash2, ChevronDown } from 'lucide-react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { DatePicker } from '@/components/ui/DateTimePicker';
import Toast from '@/components/common/Toast';
import { leaveRequestService, LeaveRequest, LeaveQuotaItem } from '@/services/leaveRequestService';
import { lateRequestService, LateRequest } from '@/services/lateRequestService';
import { useAuth } from '@/contexts/AuthContext';
import { getLeaveRequestErrorMessage } from '@/utils/leaveRequestErrors';

const LEAVE_TYPE_MAP: Record<string, { label: string; Icon: React.ElementType; color: string; apiValue: string }> = {
  SICK:          { label: 'ลาป่วย',           Icon: Thermometer, color: 'text-red-500 bg-red-50',      apiValue: 'SICK' },
  PERSONAL:      { label: 'ลากิจธุระ', Icon: FileText,    color: 'text-blue-500 bg-blue-50',    apiValue: 'PERSONAL' },
  VACATION:      { label: 'ลาพักร้อน',       Icon: Plane,       color: 'text-sky-500 bg-sky-50',      apiValue: 'VACATION' },
  MATERNITY:     { label: 'ลาคลอดบุตร',     Icon: Heart,       color: 'text-pink-500 bg-pink-50',    apiValue: 'MATERNITY' },
  MILITARY:      { label: 'ลาเพื่อรับราชการทหาร', Icon: Shield, color: 'text-gray-600 bg-gray-100',   apiValue: 'MILITARY' },
  TRAINING:      { label: 'ลาฝึกอบรม',       Icon: BookOpen,    color: 'text-indigo-500 bg-indigo-50',apiValue: 'TRAINING' },
  STERILIZATION: { label: 'ลาทำหมัน',     Icon: Stethoscope, color: 'text-teal-500 bg-teal-50',    apiValue: 'STERILIZATION' },
  ORDINATION:    { label: 'ลาบวช',          Icon: Sparkles,    color: 'text-amber-500 bg-amber-50',  apiValue: 'ORDINATION' },
  PATERNITY:     { label: 'ลาช่วยภริยาคลอด',  Icon: Heart,       color: 'text-purple-500 bg-purple-50', apiValue: 'PATERNITY' },
};

const HISTORY_TAKE = 10;

const STATUS_OPTIONS = [
  { value: 'ALL', label: 'ทุกสถานะ', dot: 'bg-gray-400' },
  { value: 'PENDING', label: 'รอพิจารณา', dot: 'bg-amber-400' },
  { value: 'APPROVED', label: 'อนุมัติ', dot: 'bg-emerald-500' },
  { value: 'REJECTED', label: 'ไม่อนุมัติ', dot: 'bg-rose-500' },
];

function StatusBadge({ status }: { status: string }) {
  if (status === 'APPROVED') return <Badge variant="active">อนุมัติ</Badge>;
  if (status === 'REJECTED') return <Badge className="bg-red-100 text-red-700 hover:bg-red-100">ไม่อนุมัติ</Badge>;
  return <Badge variant="pending">รอพิจารณา</Badge>;
}

function StatusFilterSelect({ value, onChange }: { value: string; onChange: (nextValue: string) => void }) {
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const selected = STATUS_OPTIONS.find((option) => option.value === value) ?? STATUS_OPTIONS[0];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!wrapperRef.current) return;
      if (wrapperRef.current.contains(event.target as Node)) return;
      setOpen(false);
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={wrapperRef} className="relative">
      <button
        type="button"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={() => setOpen((prev) => !prev)}
        className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none text-sm bg-white flex items-center justify-between gap-2"
      >
        <span className="flex items-center gap-2 text-gray-900">
          <span className={`w-2 h-2 rounded-full ${selected.dot}`} />
          {selected.label}
        </span>
        <ChevronDown className={`w-4 h-4 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div
          role="listbox"
          className="absolute z-20 mt-2 w-full rounded-xl border border-gray-200 bg-white shadow-lg p-1"
        >
          {STATUS_OPTIONS.map((option) => {
            const isActive = option.value === value;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isActive}
                onClick={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg text-sm transition ${
                  isActive ? 'bg-orange-50 text-orange-700' : 'text-gray-700 hover:bg-gray-50'
                }`}
              >
                <span className="flex items-center gap-2">
                  <span className={`w-2 h-2 rounded-full ${option.dot}`} />
                  {option.label}
                </span>
                {isActive && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full border border-orange-200 bg-orange-100 text-orange-700">
                    เลือกแล้ว
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function fmtDate(iso: string) {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear() + 543;
  return `${dd}/${mm}/${yyyy}`;
}

function formatQuotaValue(value: number | null | undefined) {
  if (value === null || value === undefined) return 'ไม่จำกัด';
  return `${value} วัน`;
}

// ─────────────────────────────────────── LEAVE TAB ────────────────────────────────────────────
function LeaveTab() {
  const { user: authUser } = useAuth();
  const [quota, setQuota] = useState<LeaveQuotaItem[]>([]);
  const [historyRequests, setHistoryRequests] = useState<LeaveRequest[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [toast, setToast] = useState<{ message: string; type?: 'success' | 'error' | 'warning' | 'info' } | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [expandedQuota, setExpandedQuota] = useState<string | null>(null);

  const [selectedType, setSelectedType] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [reason, setReason] = useState('');
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [isHourly, setIsHourly] = useState(false);
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');


  // Edit sheet state
  const [editingReq, setEditingReq] = useState<LeaveRequest | null>(null);
  const [editType, setEditType] = useState('');
  const [editStart, setEditStart] = useState('');
  const [editEnd, setEditEnd] = useState('');
  const [editIsHourly, setEditIsHourly] = useState(false);
  const [editStartTime, setEditStartTime] = useState('');
  const [editEndTime, setEditEndTime] = useState('');
  const [editReason, setEditReason] = useState('');
  const [editAttachmentUrl, setEditAttachmentUrl] = useState('');
  const [editAttachmentFile, setEditAttachmentFile] = useState<File | null>(null);
  const [editAttachmentUploading, setEditAttachmentUploading] = useState(false);
  const [editSubmitting, setEditSubmitting] = useState(false);
  const [editError, setEditError] = useState('');
  const [historyQuery, setHistoryQuery] = useState('');
  const [historyStatus, setHistoryStatus] = useState('ALL');

  const buildHistoryParams = useCallback((skipValue: number) => ({
    skip: skipValue,
    take: HISTORY_TAKE,
    status: historyStatus === 'ALL' ? undefined : historyStatus,
    query: historyQuery.trim() || undefined,
  }), [historyQuery, historyStatus]);

  const showToast = (message: string, type: 'success' | 'error' | 'warning' | 'info' = 'error') => {
    setToast({ message, type });
  };

  const refreshHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const h = await leaveRequestService.getMyLeaveRequests(buildHistoryParams(0));
      setHistoryRequests(h.leaveRequests);
      setHistoryTotal(h.total);
    } catch {
      setHistoryRequests([]);
      setHistoryTotal(0);
    } finally {
      setHistoryLoading(false);
    }
  }, [buildHistoryParams]);

  const loadMoreHistory = async () => {
    setHistoryLoadingMore(true);
    try {
      const h = await leaveRequestService.getMyLeaveRequests(buildHistoryParams(historyRequests.length));
      setHistoryRequests((prev) => [...prev, ...h.leaveRequests]);
      setHistoryTotal(h.total);
    } finally {
      setHistoryLoadingMore(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      refreshHistory();
    }, 300);
    return () => clearTimeout(timer);
  }, [refreshHistory]);

  useEffect(() => {
    async function load() {
      try {
        const [q, h] = await Promise.all([
          leaveRequestService.getMyLeaveQuota(),
          leaveRequestService.getMyLeaveRequests(buildHistoryParams(0)),
        ]);
        setQuota(q);
        setHistoryRequests(h.leaveRequests);
        setHistoryTotal(h.total);
      } catch {
        setError('โหลดข้อมูลไม่สำเร็จ');
        showToast('โหลดข้อมูลไม่สำเร็จ');
      } finally {
        setLoading(false);
        setHistoryLoading(false);
      }
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const openEdit = (req: LeaveRequest) => {
    setEditingReq(req);
    setEditType(req.leaveType);
    setEditStart(req.startDate.split('T')[0]);
    setEditEnd(req.endDate.split('T')[0]);
    setEditIsHourly(req.isHourly ?? false);
    setEditStartTime(req.startTime ?? '');
    setEditEndTime(req.endTime ?? '');
    setEditReason(req.reason ?? '');
    setEditAttachmentUrl(req.medicalCertificateUrl ?? req.attachmentUrl ?? '');
    setEditAttachmentFile(null);
    setEditError('');
  };
  const closeEdit = () => { setEditingReq(null); setEditError(''); };

  const handleSaveEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingReq) return;
    if (editIsHourly && editType === 'PERSONAL') {
      if (!editType || !editStart || !editStartTime || !editEndTime) { setEditError('กรุณากรอกข้อมูลให้ครบ'); showToast('กรุณากรอกข้อมูลให้ครบ'); return; }
    } else {
      if (!editType || !editStart || !editEnd) { setEditError('กรุณากรอกข้อมูลให้ครบ'); showToast('กรุณากรอกข้อมูลให้ครบ'); return; }
    }
    setEditSubmitting(true);
    setEditError('');
    try {
      let finalAttachUrl = editAttachmentUrl;

      if (editAttachmentFile) {
        setEditAttachmentUploading(true);
        const uploadedUrl = await leaveRequestService.uploadAttachment(editAttachmentFile);
        setEditAttachmentUploading(false);
        finalAttachUrl = uploadedUrl;
      }

      await leaveRequestService.updateLeaveRequest(editingReq.leaveId, {
        leaveType: editType, startDate: editStart, endDate: editIsHourly ? editStart : editEnd, reason: editReason,
        ...(editIsHourly && { isHourly: true, startTime: editStartTime, endTime: editEndTime }),
        ...(finalAttachUrl.trim() && {
          attachmentUrl: finalAttachUrl.trim(),
          medicalCertificateUrl: finalAttachUrl.trim(),
        }),
      });
      closeEdit();
      await refreshHistory();
    } catch (err: unknown) {
      setEditAttachmentUploading(false);
      const finalMsg = getLeaveRequestErrorMessage(err, 'บันทึกไม่สำเร็จ');
      setEditError(finalMsg);
      showToast(finalMsg);
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!editingReq) return;
    setShowDeleteConfirm(true);
  };

  const confirmDelete = async () => {
    if (!editingReq) return;
    setShowDeleteConfirm(false);
    setEditSubmitting(true);
    try {
      await leaveRequestService.deleteLeaveRequest(editingReq.leaveId);
      closeEdit();
      await refreshHistory();
    } catch (err: unknown) {
      const finalMsg = getLeaveRequestErrorMessage(err, 'ยกเลิกคำขอไม่สำเร็จ');
      setEditError(finalMsg);
      showToast(finalMsg);
    } finally {
      setEditSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedType) {
      setError('กรุณาเลือกประเภทการลา');
      showToast('กรุณาเลือกประเภทการลา');
      return;
    }
    
    if (isHourly && selectedType === 'PERSONAL') {
      // Hourly leave validation
      if (!startDate || !startTime || !endTime) {
        setError('กรุณากรอกวันที่และเวลาให้ครบ');
        showToast('กรุณากรอกวันที่และเวลาให้ครบ');
        return;
      }
    } else {
      // Full day leave validation
      if (!startDate || !endDate) {
        setError('กรุณาเลือกช่วงวันที่');
        showToast('กรุณาเลือกช่วงวันที่');
        return;
      }
      if (needsMedCert && !attachmentFile) {
        setError('กรุณาแนบไฟล์ เนื่องจากลาป่วยเกิน 3 วัน');
        showToast('กรุณาแนบไฟล์ เนื่องจากลาป่วยเกิน 3 วัน');
        return;
      }
    }
    
    setError('');
    setSubmitting(true);
    try {
      let finalAttachUrl = '';
      if (attachmentFile) {
        finalAttachUrl = await leaveRequestService.uploadAttachment(attachmentFile);
      }
      
      await leaveRequestService.createLeaveRequest({
        leaveType: selectedType,
        startDate,
        endDate: isHourly ? startDate : endDate,
        reason,
        ...(finalAttachUrl && {
          attachmentUrl: finalAttachUrl,
          medicalCertificateUrl: finalAttachUrl,
        }),
        ...(isHourly && { isHourly: true, startTime, endTime }),
      });
      setShowSuccess(true);
      setTimeout(async () => {
        setSelectedType('');
        setStartDate('');
        setEndDate('');
        setReason('');
        setAttachmentFile(null);
        setIsHourly(false);
        setStartTime('');
        setEndTime('');
        await refreshHistory();
        setShowFormModal(false);
      }, 2500);
      setTimeout(() => {
        setShowSuccess(false);
      }, 3000);
    } catch (err: unknown) {
      const finalMsg = getLeaveRequestErrorMessage(err, 'ส่งคำขอไม่สำเร็จ');
      setError(finalMsg);
      showToast(finalMsg);
    } finally {
      setSubmitting(false);
    }
  };

  const quotaMap: Record<string, LeaveQuotaItem> = {};
  quota.forEach(q => { quotaMap[q.leaveType] = q; });

  const mainTypes = ['SICK', 'PERSONAL', 'VACATION', 'MATERNITY'];
  const extraTypes = ['MILITARY', 'TRAINING', 'STERILIZATION', 'ORDINATION', 'PATERNITY'];
  
  const rawGender = (authUser as { gender?: string | null })?.gender ?? null;
  const normalizedGender = rawGender ? String(rawGender).toUpperCase() : null;

  const title = (authUser as { title?: string })?.title ?? '';
  const titleLower = title.toLowerCase();
  const titleGender = title === 'นาย' || titleLower === 'mr'
    ? 'MALE'
    : title === 'นาง' || title === 'นางสาว' || titleLower === 'mrs' || titleLower === 'ms' || titleLower === 'miss'
    ? 'FEMALE'
    : null;

  const userGender = normalizedGender === 'MALE' || normalizedGender === 'FEMALE'
    ? normalizedGender
    : titleGender;
  const isMale = userGender === 'MALE';
  const isFemale = userGender === 'FEMALE';
  
  const allowedQuotaItems = quota.filter((item) => {
    if (item.genderRestriction) {
      if (!userGender || item.genderRestriction !== userGender) return false;
    }
    if (item.leaveType === 'VACATION' && item.maxDaysPerYear === 0 && item.maxPaidDaysPerYear === 0) {
      return false;
    }
    return true;
  });

  const allowedTypeList = allowedQuotaItems.map((item) => item.leaveType);
  const allowedTypeSet = new Set(allowedTypeList);

  const isAllowedType = (type: string) => {
    if (allowedTypeSet.size > 0) return allowedTypeSet.has(type);
    if (type === 'MATERNITY') return isFemale;
    if (type === 'ORDINATION' || type === 'MILITARY' || type === 'PATERNITY') return isMale;
    return true;
  };

  const filteredMainTypes = mainTypes.filter((type) => isAllowedType(type));
  const filteredExtraTypes = extraTypes.filter((type) => isAllowedType(type));
  const filteredTypes = [...filteredMainTypes, ...filteredExtraTypes];
  const quotaTypes = allowedTypeList;

  useEffect(() => {
    if (!selectedType) return;
    if (allowedTypeList.length > 0 && !allowedTypeList.includes(selectedType)) {
      setSelectedType('');
    }
  }, [selectedType, allowedTypeList]);

  const selectedQuota = selectedType ? quotaMap[selectedType] : null;
  const selectedTotalPerYear = selectedQuota?.maxDaysPerYear ?? null;
  const selectedPaidPerYear = selectedQuota?.maxPaidDaysPerYear ?? null;
  const selectedRemainingTotal = selectedQuota && selectedTotalPerYear !== null
    ? Math.max(0, selectedTotalPerYear - selectedQuota.usedDays)
    : null;
  const selectedRemainingPaid = selectedQuota && selectedPaidPerYear !== null
    ? Math.max(0, selectedPaidPerYear - selectedQuota.usedPaidDays)
    : null;
  const selectedMaxPerRequest = selectedQuota?.maxDaysTotal ?? null;
  const selectedIneligible = selectedQuota && selectedTotalPerYear === 0 && selectedPaidPerYear === 0;

  const today = new Date().toISOString().split('T')[0];
  const isSick = selectedType === 'SICK';
  const allowPastDaily = selectedType === 'PERSONAL' || selectedType === 'ลากิจ' || selectedType === 'ลากิจธุระ';
  const weekdayCount = (() => {
    if (!startDate || !endDate) return 0;
    let count = 0;
    const d = new Date(startDate + 'T00:00:00');
    const e = new Date(endDate + 'T00:00:00');
    while (d <= e) {
      const dow = d.getDay();
      if (dow !== 0 && dow !== 6) count++;
      d.setDate(d.getDate() + 1);
    }
    return count;
  })();
  const needsMedCert = isSick && weekdayCount >= 3;

  return (
    <div className="space-y-4">
      <Toast
        open={Boolean(toast)}
        type={toast?.type}
        message={toast?.message ?? ''}
        onClose={() => setToast(null)}
      />

      {/* Leave Quota List */}
      {!loading && quota.length > 0 && (
        <div className="space-y-2">
          <h3 className="font-semibold text-gray-800 px-1">โควต้าการลา (ปีนี้)</h3>
          {quotaTypes.map((type) => {
            const q = quotaMap[type];
            const info = LEAVE_TYPE_MAP[type];
            if (!q || !info) return null;

            const totalPerYear = q.maxDaysPerYear;
            const remainingPerYear = totalPerYear !== null && totalPerYear !== undefined
              ? Math.max(0, totalPerYear - q.usedDays)
              : null;
            const paidPerYear = q.maxPaidDaysPerYear;
            const remainingPaid = paidPerYear !== null && paidPerYear !== undefined
              ? Math.max(0, paidPerYear - q.usedPaidDays)
              : null;
            const usageText = totalPerYear !== null && totalPerYear !== undefined
              ? `ใช้ไป ${q.usedDays} วัน จาก ${totalPerYear} วัน`
              : `ใช้ไป ${q.usedDays} วัน (ไม่จำกัด)`;
            const usedPercent = totalPerYear ? Math.min((q.usedDays / totalPerYear) * 100, 100) : 0;
            const isExpanded = expandedQuota === type;

            return (
              <Card 
                key={type}
                className="overflow-hidden border-2 border-gray-200 hover:border-orange-300 transition-colors"
              >
                {/* Header */}
                <button
                  onClick={() => setExpandedQuota(isExpanded ? null : type)}
                  className="w-full p-4 flex items-center gap-3 hover:bg-gray-50 active:bg-gray-100 transition-colors"
                >
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${info?.color ?? 'bg-gray-100 text-gray-400'}`}>
                    {info && <info.Icon className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 text-left">
                    <div className="font-semibold text-gray-800">{info?.label}</div>
                    <div className="text-xs text-gray-500">{usageText}</div>
                  </div>
                  <ChevronDown className={`w-5 h-5 text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                </button>

                {/* Progress Bar */}
                {totalPerYear !== null && totalPerYear !== undefined && (
                  <div className="px-4 pb-3">
                    <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-linear-to-r from-orange-500 to-orange-600 transition-all"
                        style={{ width: `${usedPercent}%` }}
                      />
                    </div>
                    <div className="flex justify-between items-center mt-1.5">
                      <span className="text-xs text-gray-500">เหลือ {remainingPerYear} วัน</span>
                      <span className={`text-xs font-semibold ${usedPercent >= 80 ? 'text-red-600' : usedPercent >= 50 ? 'text-amber-600' : 'text-green-600'}`}>
                        {Math.round(100 - usedPercent)}%
                      </span>
                    </div>
                  </div>
                )}

                {/* Details - Dropdown */}
                {isExpanded && (
                  <div className="px-4 pb-4 pt-2 border-t border-gray-100 bg-gray-50 space-y-2 text-sm text-gray-700">
                    <div className="flex justify-between">
                      <span className="text-gray-600">วันลาทั้งหมด/ปี:</span>
                      <span className="font-semibold">{formatQuotaValue(totalPerYear)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">วันที่ได้รับค่าจ้าง/ปี:</span>
                      <span className="font-semibold">{q.isPaid ? formatQuotaValue(paidPerYear) : 'ไม่ได้รับค่าจ้าง'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">ลาได้ต่อครั้งไม่เกิน:</span>
                      <span className="font-semibold">{formatQuotaValue(q.maxDaysTotal ?? null)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">วันลาที่ใช้ไปแล้ว:</span>
                      <span className="font-semibold">{q.usedDays} วัน</span>
                    </div>
                    {q.isPaid && paidPerYear !== null && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">วันลาที่ได้ค่าจ้างแล้ว:</span>
                        <span className="font-semibold">{q.usedPaidDays} วัน</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-gray-600">วันลาคงเหลือปีนี้:</span>
                      <span className="font-semibold text-orange-600">{remainingPerYear !== null ? `${remainingPerYear} วัน` : 'ไม่จำกัด'}</span>
                    </div>
                    {q.isPaid && remainingPaid !== null && (
                      <div className="flex justify-between">
                        <span className="text-gray-600">วันลาคงเหลือที่ได้ค่าจ้าง:</span>
                        <span className="font-semibold text-orange-600">{remainingPaid} วัน</span>
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Floating Submit Button */}
      <div className="fixed bottom-18 right-6 z-50">
        <button
          onClick={() => setShowFormModal(true)}
          className="relative w-12 h-12 rounded-full bg-linear-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 text-white shadow-lg hover:shadow-xl transition-all active:scale-95 flex items-center justify-center group"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <div className="absolute right-full mr-3 px-3 py-1.5 bg-gray-900 text-white text-xs rounded-md whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            ส่งคำขอลา
          </div>
        </button>
      </div>

      {/* Form Modal */}
      {showFormModal && (
        <div className="fixed inset-0 z-9999 flex items-end">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowFormModal(false)} />
          <div className="relative bg-white w-full rounded-t-2xl overflow-visible" style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-200 bg-linear-to-r from-orange-500 to-orange-600 text-white shrink-0">
              <h2 className="text-lg font-bold">ส่งคำขอลา</h2>
              <button 
                onClick={() => setShowFormModal(false)}
                className="p-1 rounded-lg hover:bg-white/20"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Form Content */}
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              <form id="leave-request-form" onSubmit={handleSubmit} className="space-y-4">
                {/* Leave Type */}
                <div>
                  <label className="block font-semibold text-gray-800 mb-3">
                    ประเภทการลา <span className="text-red-500">*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {filteredTypes.map(key => {
                      const info = LEAVE_TYPE_MAP[key];
                      return (
                        <button key={key} type="button" onClick={() => { setSelectedType(key); setIsHourly(false); setStartTime(''); setEndTime(''); }}
                          className={`p-4 rounded-xl border-2 transition-all ${selectedType === key ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-gray-300'}`}>
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2 ${info?.color ?? ''}`}>
                            {info && <info.Icon className="w-5 h-5" />}
                          </div>
                          <div className="text-sm font-medium text-gray-900">{info?.label}</div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {selectedQuota && (
                  <div className="rounded-xl border-2 border-orange-100 bg-orange-50/60 p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-orange-700">สิทธิ์การลา</span>
                      {selectedIneligible && (
                        <span className="text-xs text-red-600">ยังไม่ถึงเกณฑ์อายุงาน 1 ปี</span>
                      )}
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-gray-700">
                      <div className="flex items-center justify-between">
                        <span>รวม/ปี</span>
                        <span className="font-semibold">{formatQuotaValue(selectedTotalPerYear)}</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>คงเหลือ/ปี</span>
                        <span className="font-semibold">
                          {selectedRemainingTotal !== null ? `${selectedRemainingTotal} วัน` : 'ไม่จำกัด'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>สิทธิ์ได้รับค่าจ้าง/ปี</span>
                        <span className="font-semibold">
                          {selectedQuota.isPaid ? formatQuotaValue(selectedPaidPerYear) : 'ไม่ได้รับค่าจ้าง'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>คงเหลือแบบได้รับค่าจ้าง</span>
                        <span className="font-semibold">
                          {selectedQuota.isPaid && selectedRemainingPaid !== null ? `${selectedRemainingPaid} วัน` : '—'}
                        </span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span>ต่อครั้งไม่เกิน</span>
                        <span className="font-semibold">{formatQuotaValue(selectedMaxPerRequest)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Dates / Hours */}
                <div className="space-y-3">
                  <label className="block font-semibold text-gray-800">ช่วงเวลา <span className="text-red-500">*</span></label>
                  
                  {/* Hourly Mode Toggle - Only for PERSONAL */}
                  {selectedType === 'PERSONAL' && (
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => { setIsHourly(false); setStartTime(''); setEndTime(''); }}
                        className={`flex-1 px-3 py-2 rounded-lg border-2 transition-all text-sm font-medium ${!isHourly ? 'border-orange-500 bg-orange-50 text-gray-900' : 'border-gray-200 text-gray-600'}`}
                      >
                        ลาแบบวัน
                      </button>
                      <button
                        type="button"
                        onClick={() => { setIsHourly(true); setEndDate(''); }}
                        className={`flex-1 px-3 py-2 rounded-lg border-2 transition-all text-sm font-medium ${isHourly ? 'border-orange-500 bg-orange-50 text-gray-900' : 'border-gray-200 text-gray-600'}`}
                      >
                        ลาแบบชั่วโมง
                      </button>
                    </div>
                  )}

                  {isHourly && selectedType === 'PERSONAL' ? (
                    <>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">วันที่</label>
                        <DatePicker value={startDate} onChange={setStartDate} weekdaysOnly placeholder="เลือกวันที่" />
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">เวลาเริ่มต้น</label>
                          <div className="flex gap-1 items-center">
                            <input type="number" min="0" max="23" placeholder="HH" value={startTime.split(':')[0] || ''}
                              onChange={e => { const [h] = startTime.split(':'); const newVal = String(parseInt(e.target.value) || 0).padStart(2, '0'); const m = (h || '00').padStart(2, '0') === '00' && !startTime ? '00' : (h || '00').split(':')[1] || '00'; setStartTime(`${newVal}:${m}`); }}
                              className="w-12 px-2 py-2 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none text-center" />
                            <span className="text-gray-600">:</span>
                            <input type="number" min="0" max="59" placeholder="MM" value={startTime.split(':')[1] || ''}
                              onChange={e => { const [h] = startTime.split(':'); const newVal = String(parseInt(e.target.value) || 0).padStart(2, '0'); const hours = (h || '00').padStart(2, '0'); setStartTime(`${hours}:${newVal}`); }}
                              className="w-12 px-2 py-2 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none text-center" />
                            <span className="text-xs text-gray-500 ml-1">24h</span>
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm text-gray-600 mb-1">เวลาสิ้นสุด</label>
                          <div className="flex gap-1 items-center">
                            <input type="number" min="0" max="23" placeholder="HH" value={endTime.split(':')[0] || ''}
                              onChange={e => { const [h] = endTime.split(':'); const newVal = String(parseInt(e.target.value) || 0).padStart(2, '0'); const m = (h || '00').padStart(2, '0') === '00' && !endTime ? '00' : (h || '00').split(':')[1] || '00'; setEndTime(`${newVal}:${m}`); }}
                              className="w-12 px-2 py-2 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none text-center" />
                            <span className="text-gray-600">:</span>
                            <input type="number" min="0" max="59" placeholder="MM" value={endTime.split(':')[1] || ''}
                              onChange={e => { const [h] = endTime.split(':'); const newVal = String(parseInt(e.target.value) || 0).padStart(2, '0'); const hours = (h || '00').padStart(2, '0'); setEndTime(`${hours}:${newVal}`); }}
                              className="w-12 px-2 py-2 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none text-center" />
                            <span className="text-xs text-gray-500 ml-1">24h</span>
                          </div>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">วันที่เริ่มต้น</label>
                        <DatePicker value={startDate} onChange={setStartDate} placeholder="เลือกวันเริ่มต้น"
                          weekdaysOnly={selectedType !== 'MATERNITY'} min={isSick || allowPastDaily ? undefined : today} />
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">วันที่สิ้นสุด</label>
                        <DatePicker value={endDate} min={startDate || (isSick || allowPastDaily ? undefined : today)} onChange={setEndDate} placeholder="เลือกวันสิ้นสุด"
                          weekdaysOnly={selectedType !== 'MATERNITY'} />
                      </div>
                    </>
                  )}
                </div>

                {/* Reason */}
                <div>
                  <label className="block font-semibold text-gray-800 mb-3">เหตุผล</label>
                  <textarea value={reason} onChange={e => setReason(e.target.value)}
                    placeholder="กรอกเหตุผลการลา..." rows={3}
                    className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none resize-none" />
                </div>

                {/* Attachment Section - For all leave types, but required for SICK if over 3 days */}
                <div>
                  <label className="block font-semibold text-gray-800 mb-3">
                    {selectedType === 'SICK' ? 'แนบไฟล์' : 'ไฟล์แนบ'} 
                    {needsMedCert && <span className="text-red-500"> *</span>}
                    <span className="text-sm font-normal text-gray-500 ml-1">{selectedType === 'SICK' && needsMedCert ? '(บังคับ)' : '(ไม่บังคับ)'}</span>
                  </label>
                  {needsMedCert && (
                    <p className="text-xs text-amber-600 mb-2">ลาป่วยเกิน 3 วัน ต้องแนบไฟล์ — PDF, JPG, PNG</p>
                  )}
                  <label className="flex items-center gap-3 cursor-pointer w-full px-3 py-3 border-2 border-dashed transition-colors rounded-xl bg-white"
                    style={{borderColor: needsMedCert ? '#fbbf24' : '#d1d5db', backgroundColor: needsMedCert ? '#fffbeb' : 'white'}}>
                    <svg className="w-5 h-5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" style={{color: needsMedCert ? '#f59e0b' : '#9ca3af'}}><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
                    <span className="text-sm text-gray-600 truncate flex-1">
                      {attachmentFile ? attachmentFile.name : 'คลิกเพื่อเลือกไฟล์'}
                    </span>
                    {attachmentFile && (
                      <button type="button" onClick={(e) => { e.preventDefault(); setAttachmentFile(null); }}
                        className="text-gray-500 hover:text-red-600 shrink-0">✕</button>
                    )}
                    <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="sr-only"
                      onChange={e => { const f = e.target.files?.[0] ?? null; setAttachmentFile(f); }} />
                  </label>
                </div>

                {error && <p className="text-sm text-red-600 px-1">{error}</p>}
              </form>
            </div>

            {/* Footer */}
            <div className="px-5 pb-5 pt-3 border-t border-gray-100 bg-white flex gap-3 shrink-0">
              <Button form="leave-request-form" type="submit" disabled={submitting}
                className="flex-1 bg-orange-500 hover:bg-orange-600 py-4 disabled:opacity-50">
                {submitting ? 'กำลังส่ง...' : 'ส่งคำขอลา'}
              </Button>
              <Button 
                type="button" 
                variant="outline"
                onClick={() => setShowFormModal(false)}
                className="border-gray-300"
              >
                ยกเลิก
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* History Requests */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-800">ประวัติคำขอลา</h3>
          {historyTotal > 0 && (
            <span className="text-xs text-gray-400">
              {historyRequests.length}/{historyTotal} รายการ
            </span>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <input
            value={historyQuery}
            onChange={(e) => setHistoryQuery(e.target.value)}
            placeholder="ค้นหาประเภท, เหตุผล, สถานะ"
            className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none text-sm"
          />
          <StatusFilterSelect value={historyStatus} onChange={setHistoryStatus} />
        </div>
        {historyLoading ? (
          <div className="text-sm text-gray-500 text-center py-6">กำลังโหลด...</div>
        ) : historyTotal === 0 ? (
          <div className="text-sm text-gray-400 text-center py-6">
            {historyQuery.trim() || historyStatus !== 'ALL' ? 'ไม่พบรายการที่ตรงกับการค้นหา' : 'ยังไม่มีประวัติคำขอลา'}
          </div>
        ) : (
          <div className="space-y-2">
            {historyRequests.map((req, i) => {
              const info = LEAVE_TYPE_MAP[req.leaveType];
              const isPending = req.status === 'PENDING';
              const totalDays = req.numberOfDays ?? 0;
              const paidDays = typeof req.paidDays === 'number' ? req.paidDays : totalDays;
              const unpaidDays = Math.max(0, totalDays - paidDays);
              const payText = req.isHourly
                ? null
                : paidDays === 0
                ? `ไม่ได้รับค่าจ้าง ${totalDays} วัน`
                : unpaidDays === 0
                ? `ได้รับค่าจ้าง ${paidDays} วัน`
                : `ได้รับค่าจ้าง ${paidDays} วัน / ไม่ได้รับค่าจ้าง ${unpaidDays} วัน`;
              return (
                <div
                  key={req.leaveId ?? i}
                  className={`rounded-2xl border transition-all ${
                    isPending
                      ? 'bg-orange-50 border-orange-200 active:scale-[0.98] cursor-pointer'
                      : req.status === 'APPROVED'
                      ? 'bg-white border-green-200'
                      : req.status === 'REJECTED'
                      ? 'bg-white border-red-100'
                      : 'bg-white border-gray-200'
                  }`}
                  onClick={() => isPending && openEdit(req)}
                >
                  <div className="flex items-center gap-3 p-3.5">
                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 ${info?.color ?? 'bg-gray-100 text-gray-400'}`}>
                      {info && <info.Icon className="w-5 h-5" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-gray-900 text-sm">{info?.label ?? req.leaveType}</span>
                        <StatusBadge status={req.status} />
                      </div>
                      <div className="text-xs text-gray-500 mt-0.5">
                        {fmtDate(req.startDate)} – {fmtDate(req.endDate)}
                        {req.isHourly && req.leaveHours ? <span className="ml-1 font-medium text-gray-700">({req.leaveHours} ชั่วโมง)</span> : req.numberOfDays ? <span className="ml-1 font-medium text-gray-700">({req.numberOfDays} วัน)</span> : null}
                      </div>
                      {payText && (
                        <div className="text-xs text-gray-600 mt-0.5">{payText}</div>
                      )}
                      {req.reason && !req.rejectionReason && (
                        <div className="text-xs text-gray-600 mt-1 truncate">หมายเหตุ: {req.reason}</div>
                      )}
                    </div>
                    {isPending && (
                      <div className="shrink-0 w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center">
                        <Pencil className="w-3.5 h-3.5 text-orange-500" />
                      </div>
                    )}
                  </div>
                  {isPending && (
                    <div className="px-3.5 pb-2.5 -mt-1">
                      <span className="text-xs text-orange-500">แตะเพื่อดูรายละเอียด / แก้ไข</span>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
        {historyRequests.length < historyTotal && (
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={loadMoreHistory}
            disabled={historyLoadingMore}
          >
            {historyLoadingMore ? 'กำลังโหลด...' : 'โหลดเพิ่ม'}
          </Button>
        )}
      </div>

      {/* ─── Edit Bottom Sheet ─── */}
      {editingReq && (
        <div className="fixed inset-0 z-9999 flex flex-col justify-end">
          <div className="absolute inset-0 bg-black/50" onClick={closeEdit} />
          <div className="relative bg-white rounded-t-2xl overflow-hidden" style={{ maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
            {/* Header */}
            <div className="flex items-center justify-between p-5 border-b border-gray-200 shrink-0">
              <h3 className="text-lg font-bold text-gray-900">แก้ไขคำขอลา</h3>
              <button type="button" onClick={closeEdit} className="p-1 rounded-lg hover:bg-gray-100">
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-5 space-y-4">

            <form id="edit-leave-form" onSubmit={handleSaveEdit} className="space-y-4">
              {/* Type selector */}
              <div>
                <label className="block font-semibold text-gray-800 mb-3">
                  ประเภทการลา <span className="text-red-500">*</span>
                </label>
                <div className="grid grid-cols-3 gap-3">
                  {filteredTypes.map(key => {
                    const info = LEAVE_TYPE_MAP[key];
                    return (
                      <button key={key} type="button" onClick={() => setEditType(key)}
                        className={`p-4 rounded-xl border-2 transition-all ${editType === key ? 'border-orange-500 bg-orange-50' : 'border-gray-200 hover:border-gray-300'}`}>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2 ${info?.color ?? ''}`}>
                          {info && <info.Icon className="w-5 h-5" />}
                        </div>
                        <div className="text-sm font-medium text-gray-900">{info?.label}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Dates */}
              <div className="space-y-3">
                <label className="block font-semibold text-gray-800">ช่วงเวลา <span className="text-red-500">*</span></label>
                
                {/* Hourly Mode Toggle - Only for PERSONAL */}
                {editType === 'PERSONAL' && (
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => { setEditIsHourly(false); setEditStartTime(''); setEditEndTime(''); }}
                      className={`flex-1 px-3 py-2 rounded-lg border-2 transition-all text-sm font-medium ${!editIsHourly ? 'border-orange-500 bg-orange-50 text-gray-900' : 'border-gray-200 text-gray-600'}`}
                    >
                      ลาแบบวัน
                    </button>
                    <button
                      type="button"
                      onClick={() => { setEditIsHourly(true); setEditEnd(''); }}
                      className={`flex-1 px-3 py-2 rounded-lg border-2 transition-all text-sm font-medium ${editIsHourly ? 'border-orange-500 bg-orange-50 text-gray-900' : 'border-gray-200 text-gray-600'}`}
                    >
                      ลาแบบชั่วโมง
                    </button>
                  </div>
                )}

                {editIsHourly && editType === 'PERSONAL' ? (
                  <>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">วันที่</label>
                      <DatePicker value={editStart} onChange={setEditStart} weekdaysOnly placeholder="เลือกวันที่" />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">เวลาเริ่มต้น</label>
                        <div className="flex gap-1 items-center">
                          <input type="number" min="0" max="23" placeholder="HH" value={editStartTime.split(':')[0] || ''}
                            onChange={e => { const [h] = editStartTime.split(':'); const newVal = String(parseInt(e.target.value) || 0).padStart(2, '0'); const m = (h || '00').padStart(2, '0') === '00' && !editStartTime ? '00' : (h || '00').split(':')[1] || '00'; setEditStartTime(`${newVal}:${m}`); }}
                            className="w-12 px-2 py-2 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none text-center" />
                          <span className="text-gray-600">:</span>
                          <input type="number" min="0" max="59" placeholder="MM" value={editStartTime.split(':')[1] || ''}
                            onChange={e => { const [h] = editStartTime.split(':'); const newVal = String(parseInt(e.target.value) || 0).padStart(2, '0'); const hours = (h || '00').padStart(2, '0'); setEditStartTime(`${hours}:${newVal}`); }}
                            className="w-12 px-2 py-2 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none text-center" />
                          <span className="text-xs text-gray-500 ml-1">24h</span>
                        </div>
                      </div>
                      <div>
                        <label className="block text-sm text-gray-600 mb-1">เวลาสิ้นสุด</label>
                        <div className="flex gap-1 items-center">
                          <input type="number" min="0" max="23" placeholder="HH" value={editEndTime.split(':')[0] || ''}
                            onChange={e => { const [h] = editEndTime.split(':'); const newVal = String(parseInt(e.target.value) || 0).padStart(2, '0'); const m = (h || '00').padStart(2, '0') === '00' && !editEndTime ? '00' : (h || '00').split(':')[1] || '00'; setEditEndTime(`${newVal}:${m}`); }}
                            className="w-12 px-2 py-2 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none text-center" />
                          <span className="text-gray-600">:</span>
                          <input type="number" min="0" max="59" placeholder="MM" value={editEndTime.split(':')[1] || ''}
                            onChange={e => { const [h] = editEndTime.split(':'); const newVal = String(parseInt(e.target.value) || 0).padStart(2, '0'); const hours = (h || '00').padStart(2, '0'); setEditEndTime(`${hours}:${newVal}`); }}
                            className="w-12 px-2 py-2 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none text-center" />
                          <span className="text-xs text-gray-500 ml-1">24h</span>
                        </div>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">วันที่เริ่มต้น</label>
                      <DatePicker value={editStart} onChange={setEditStart} weekdaysOnly={editType !== 'MATERNITY'} placeholder="วันเริ่มต้น" />
                    </div>
                    <div>
                      <label className="block text-sm text-gray-600 mb-1">วันที่สิ้นสุด</label>
                      <DatePicker value={editEnd} min={editStart} onChange={setEditEnd} weekdaysOnly={editType !== 'MATERNITY'} placeholder="วันสิ้นสุด" />
                    </div>
                  </>
                )}
              </div>

              {/* Reason */}
              <div>
                <label className="block font-semibold text-gray-800 mb-3">เหตุผล</label>
                <textarea value={editReason} onChange={e => setEditReason(e.target.value)}
                  placeholder="กรอกเหตุผลการลา..." rows={3}
                  className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none resize-none" />
              </div>

              {/* Existing File Preview */}
              {editAttachmentUrl && (
                <div className="p-3 bg-blue-50 rounded-lg border-2 border-blue-200">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium text-blue-900">ไฟล์ที่แนบมา:</span>
                    <button
                      type="button"
                      onClick={() => setEditAttachmentUrl('')}
                      className="text-xs text-blue-600 hover:text-blue-900"
                    >
                      ลบ
                    </button>
                  </div>
                  {editAttachmentUrl.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={editAttachmentUrl} alt="attachment" className="max-h-24 rounded" />
                  ) : editAttachmentUrl.match(/\.pdf$/i) ? (
                    <a href={editAttachmentUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm">
                      ดูไฟล์ PDF
                    </a>
                  ) : (
                    <a href={editAttachmentUrl} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline text-sm break-all">
                      {editAttachmentUrl}
                    </a>
                  )}
                </div>
              )}

              {/* Attachment */}
              <div>
                <label className="block font-semibold text-gray-800 mb-3">ไฟล์แนบ <span className="text-sm font-normal text-gray-500">(ไม่บังคับ)</span></label>
                <label className="flex items-center gap-3 cursor-pointer w-full px-3 py-3 border-2 border-dashed border-gray-200 rounded-xl bg-white hover:border-orange-300 transition-colors">
                  <svg className="w-5 h-5 shrink-0 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                  </svg>
                    <span className="text-sm text-gray-600 truncate flex-1">
                      {editAttachmentFile?.name ?? 'เลือกไฟล์หรือวาง'}
                    </span>
                  {editAttachmentFile && (
                    <button type="button" onClick={(e) => { e.preventDefault(); setEditAttachmentFile(null); }}
                      className="text-gray-500 hover:text-red-600 shrink-0">✕</button>
                  )}
                  <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="sr-only"
                    onChange={e => setEditAttachmentFile(e.target.files?.[0] ?? null)} />
                </label>
              </div>

              {editError && <p className="text-sm text-red-600 px-1">{editError}</p>}
            </form>
            </div>
            {/* Sticky footer */}
            <div className="px-5 pb-5 pt-3 border-t border-gray-100 bg-white flex gap-3 shrink-0">
              <Button form="edit-leave-form" type="submit" disabled={editSubmitting || editAttachmentUploading}
                className="flex-1 bg-orange-500 hover:bg-orange-600 disabled:opacity-50">
                {editSubmitting || editAttachmentUploading ? 'กำลังบันทึก...' : 'บันทึก'}
              </Button>
              <Button type="button" variant="outline" disabled={editSubmitting}
                onClick={handleDelete}
                className="flex items-center gap-1.5 border-red-300 text-red-600 hover:bg-red-50">
                <Trash2 className="w-4 h-4" />
                ยกเลิกคำขอ
              </Button>
            </div>
          </div>
        </div>
      )}

      {showSuccess && (
        <div className="fixed inset-0 z-99999 flex items-center justify-center p-4 bg-black/50">
          <Card className="p-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">ส่งคำขอสำเร็จ!</h3>
            <p className="text-gray-600">รอผู้จัดการพิจารณาอนุมัติ</p>
          </Card>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-99999 flex items-center justify-center p-4 bg-black/50">
          <Card className="p-6 max-w-sm w-full">
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto mb-4 bg-red-100 rounded-full flex items-center justify-center">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-red-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-gray-900 mb-2">ยืนยันการยกเลิก</h3>
              <p className="text-gray-600">คุณแน่ใจหรือว่าต้องการยกเลิกคำขอลานี้?</p>
            </div>
            <div className="flex gap-3">
              <Button 
                variant="outline" 
                onClick={() => setShowDeleteConfirm(false)}
                disabled={editSubmitting}
                className="flex-1"
              >
                ไม่, ยกเลิก
              </Button>
              <Button 
                onClick={confirmDelete}
                disabled={editSubmitting}
                className="flex-1 bg-red-500 hover:bg-red-600 disabled:opacity-50"
              >
                {editSubmitting ? 'กำลังลบ...' : 'ยกเลิกคำขอ'}
              </Button>
            </div>
          </Card>
        </div>
      )}

    </div>
  );
}

// ─────────────────────────────────────── LATE TAB ─────────────────────────────────────────────
function LateTab() {
  const [historyRequests, setHistoryRequests] = useState<LateRequest[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);
  const [historyLoading, setHistoryLoading] = useState(true);
  const [historyLoadingMore, setHistoryLoadingMore] = useState(false);
  const [stats, setStats] = useState<{ totalRequests?: number; totalLateMinutes?: number; approved?: number; pending?: number } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [showSuccess, setShowSuccess] = useState(false);
  const [historyQuery, setHistoryQuery] = useState('');
  const [historyStatus, setHistoryStatus] = useState('ALL');

  const buildHistoryParams = useCallback((skipValue: number) => ({
    skip: skipValue,
    take: HISTORY_TAKE,
    status: historyStatus === 'ALL' ? undefined : historyStatus,
    query: historyQuery.trim() || undefined,
  }), [historyQuery, historyStatus]);

  const [requestDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [scheduledTime, setScheduledTime] = useState('');
  const [actualTime, setActualTime] = useState('');
  const [reason, setReason] = useState('');
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [attachmentPreview, setAttachmentPreview] = useState<string>('');
  const [attachmentUploading, setAttachmentUploading] = useState(false);

  // ===== EDIT/DELETE LATE REQUEST =====
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editScheduledHour, setEditScheduledHour] = useState('');
  const [editScheduledMin, setEditScheduledMin] = useState('');
  const [editActualHour, setEditActualHour] = useState('');
  const [editActualMin, setEditActualMin] = useState('');
  const [editReason, setEditReason] = useState('');
  const [editAttachmentFile, setEditAttachmentFile] = useState<File | null>(null);
  const [editAttachmentPreview, setEditAttachmentPreview] = useState<string>('');
  const [editImagePreviewUrl, setEditImagePreviewUrl] = useState<string>('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<number | null>(null);

  useEffect(() => {
    async function load() {
      try {
        const [s, h] = await Promise.all([
          lateRequestService.getMyLateStatistics(),
          lateRequestService.getMyLateRequests(buildHistoryParams(0)),
        ]);
        setStats(s);
        setHistoryRequests(h.lateRequests);
        setHistoryTotal(h.total);
      } catch {
        // keep empty
      } finally {
        setHistoryLoading(false);
      }
    }
    load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshHistory = useCallback(async () => {
    setHistoryLoading(true);
    try {
      const h = await lateRequestService.getMyLateRequests(buildHistoryParams(0));
      setHistoryRequests(h.lateRequests);
      setHistoryTotal(h.total);
    } catch {
      setHistoryRequests([]);
      setHistoryTotal(0);
    } finally {
      setHistoryLoading(false);
    }
  }, [buildHistoryParams]);

  const loadMoreHistory = async () => {
    setHistoryLoadingMore(true);
    try {
      const h = await lateRequestService.getMyLateRequests(buildHistoryParams(historyRequests.length));
      setHistoryRequests((prev) => [...prev, ...h.lateRequests]);
      setHistoryTotal(h.total);
    } finally {
      setHistoryLoadingMore(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => {
      refreshHistory();
    }, 300);
    return () => clearTimeout(timer);
  }, [refreshHistory]);

  const lateMinutesPreview = (() => {
    if (!scheduledTime || !actualTime) return null;
    const [sh, sm] = scheduledTime.split(':').map(Number);
    const [ah, am] = actualTime.split(':').map(Number);
    const diff = (ah * 60 + am) - (sh * 60 + sm);
    return diff > 0 ? diff : null;
  })();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!scheduledTime || !actualTime || !reason || !attachmentFile) { 
      setError('กรุณากรอกข้อมูลให้ครบถ้วน'); 
      return; 
    }
    if (lateMinutesPreview === null) { 
      setError('เวลาที่มาจริงต้องหลังเวลาที่กำหนด'); 
      return; 
    }
    setError('');
    setSubmitting(true);
    try {
      let attachmentUrl = '';
      if (attachmentFile) {
        setAttachmentUploading(true);
        attachmentUrl = await lateRequestService.uploadAttachment(attachmentFile);
        setAttachmentUploading(false);
      }
      
      await lateRequestService.createLateRequest({ 
        requestDate, 
        scheduledTime, 
        actualTime, 
        reason,
        attachmentUrl: attachmentUrl.trim()
      });
      setShowSuccess(true);
      setScheduledTime(''); 
      setActualTime(''); 
      setReason('');
      setAttachmentFile(null);
      setAttachmentPreview('');
      await refreshHistory();
      setTimeout(() => setShowSuccess(false), 2500);
    } catch (err: unknown) {
      const axiosMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(axiosMsg || 'เกิดข้อผิดพลาด กรุณาลองใหม่');
    } finally {
      setSubmitting(false);
    }
  };

  const handleEditOpen = (req: LateRequest) => {
    setEditingId(req.id);
    const [sh, sm] = req.scheduledTime.split(':');
    const [ah, am] = req.actualTime.split(':');
    setEditScheduledHour(sh || '00');
    setEditScheduledMin(sm || '00');
    setEditActualHour(ah || '00');
    setEditActualMin(am || '00');
    setEditReason(req.reason);
    setEditAttachmentFile(null);
    setEditAttachmentPreview(req.attachmentUrl ? req.attachmentUrl.split('/').pop() || '' : '');
    if (req.attachmentUrl && (req.attachmentUrl.endsWith('.jpg') || req.attachmentUrl.endsWith('.jpeg') || req.attachmentUrl.endsWith('.png'))) {
      setEditImagePreviewUrl(req.attachmentUrl);
    } else {
      setEditImagePreviewUrl('');
    }
  };

  const handleEditSubmit = async () => {
    setError('');
    const scheduledTime = `${editScheduledHour.padStart(2, '0')}:${editScheduledMin.padStart(2, '0')}`;
    const actualTime = `${editActualHour.padStart(2, '0')}:${editActualMin.padStart(2, '0')}`;
    
    if (!scheduledTime || !actualTime || !editReason) {
      setError('กรุณากรอกข้อมูลให้ครบถ้วน');
      return;
    }
    setSubmitting(true);
    try {
      const updateData: Record<string, string> = {
        scheduledTime,
        actualTime,
        reason: editReason,
      };
      
      if (editAttachmentFile) {
        setAttachmentUploading(true);
        const uploadedUrl = await lateRequestService.uploadAttachment(editAttachmentFile);
        setAttachmentUploading(false);
        updateData.attachmentUrl = uploadedUrl;
      }
      
      await lateRequestService.updateLateRequest(editingId!, updateData);
      setEditingId(null);
      await refreshHistory();
      setError('');
    } catch (err: unknown) {
      const axiosMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(axiosMsg || 'เกิดข้อผิดพลาด');
      console.error('Edit error:', err);
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    setSubmitting(true);
    try {
      await lateRequestService.deleteLateRequest(id);
      setShowDeleteConfirm(null);
      await refreshHistory();
      setError('');
    } catch (err: unknown) {
      const axiosMsg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message;
      setError(axiosMsg || 'เกิดข้อผิดพลาด');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Stats */}
      {stats && (
        <Card className="p-4">
          <h3 className="font-semibold text-gray-800 mb-3">สถิติปีนี้</h3>
          <div className="grid grid-cols-3 gap-3 text-center">
            <div className="p-2 bg-orange-50 rounded-lg">
              <div className="text-xl font-bold text-orange-600">{stats.totalRequests ?? 0}</div>
              <div className="text-xs text-gray-500">ครั้งทั้งหมด</div>
            </div>
            <div className="p-2 bg-green-50 rounded-lg">
              <div className="text-xl font-bold text-green-600">{stats.approved ?? 0}</div>
              <div className="text-xs text-gray-500">อนุมัติแล้ว</div>
            </div>
            <div className="p-2 bg-gray-50 rounded-lg">
              <div className="text-xl font-bold text-gray-600">{stats.totalLateMinutes ?? 0}</div>
              <div className="text-xs text-gray-500">นาทีรวม</div>
            </div>
          </div>
        </Card>
      )}

      {/* Form */}
      <form onSubmit={handleSubmit} className="space-y-4">
        <Card className="p-4">
          <label className="block font-semibold text-gray-800 mb-3">วันที่มาสาย</label>
          <div className="px-4 py-3 border-2 border-gray-200 rounded-xl bg-gray-50 text-gray-700 font-medium">
            {requestDate ? new Date(requestDate).toLocaleDateString('th-TH', { year: 'numeric', month: 'long', day: 'numeric' }) : '-'}
          </div>
        </Card>

        <Card className="p-4 space-y-3">
          <label className="block font-semibold text-gray-800">เวลา <span className="text-red-500">*</span></label>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm text-gray-600 mb-1">เวลาที่กำหนด</label>
              <div className="flex gap-1 items-center">
                <input type="number" min="0" max="23" placeholder="HH" value={scheduledTime.split(':')[0] || ''}
                  onChange={e => { 
                    const [h] = scheduledTime.split(':'); 
                    const newVal = String(parseInt(e.target.value) || 0).padStart(2, '0'); 
                    const m = (h || '00').split(':')[1] || '00'; 
                    setScheduledTime(`${newVal}:${m}`); 
                  }}
                  className="w-12 px-2 py-3 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none text-center" />
                <span className="text-gray-600">:</span>
                <input type="number" min="0" max="59" placeholder="MM" value={scheduledTime.split(':')[1] || ''}
                  onChange={e => { 
                    const [h] = scheduledTime.split(':'); 
                    const newVal = String(parseInt(e.target.value) || 0).padStart(2, '0'); 
                    const hours = (h || '00').padStart(2, '0'); 
                    setScheduledTime(`${hours}:${newVal}`); 
                  }}
                  className="w-12 px-2 py-3 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none text-center" />
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-600 mb-1">เวลาที่มาจริง</label>
              <div className="flex gap-1 items-center">
                <input type="number" min="0" max="23" placeholder="HH" value={actualTime.split(':')[0] || ''}
                  onChange={e => { 
                    const [h] = actualTime.split(':'); 
                    const newVal = String(parseInt(e.target.value) || 0).padStart(2, '0'); 
                    const m = (h || '00').split(':')[1] || '00'; 
                    setActualTime(`${newVal}:${m}`); 
                  }}
                  className="w-12 px-2 py-3 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none text-center" />
                <span className="text-gray-600">:</span>
                <input type="number" min="0" max="59" placeholder="MM" value={actualTime.split(':')[1] || ''}
                  onChange={e => { 
                    const [h] = actualTime.split(':'); 
                    const newVal = String(parseInt(e.target.value) || 0).padStart(2, '0'); 
                    const hours = (h || '00').padStart(2, '0'); 
                    setActualTime(`${hours}:${newVal}`); 
                  }}
                  className="w-12 px-2 py-3 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:outline-none text-center" />
              </div>
            </div>
          </div>
          {lateMinutesPreview !== null && (
            <div className="p-3 bg-orange-50 rounded-lg text-center">
              <span className="text-sm text-gray-600">สาย </span>
              <span className="text-lg font-bold text-orange-600">{lateMinutesPreview} นาที</span>
            </div>
          )}
        </Card>

        <Card className="p-4">
          <label className="block font-semibold text-gray-800 mb-3">
            เหตุผล <span className="text-red-500">*</span>
          </label>
          <textarea value={reason} onChange={e => setReason(e.target.value)}
            placeholder="กรอกเหตุผลที่มาสาย..." rows={3}
            className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none resize-none" />
        </Card>

        <Card className="p-4">
          <label className="block font-semibold text-gray-800 mb-3">
            แนบไฟล์ <span className="text-red-500">*</span>
            <span className="text-sm font-normal text-gray-500 ml-1">(บังคับ)</span>
          </label>
          <p className="text-xs text-orange-600 mb-2">PDF, JPG, PNG</p>
          {attachmentPreview && (
            <div className="mb-3 rounded-lg overflow-hidden border-2 border-orange-200 bg-orange-50 p-3">
              {attachmentFile?.type.startsWith('image/') ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={attachmentPreview} alt="preview" className="max-h-48 max-w-full mx-auto rounded" />
              ) : (
                <div className="text-center p-4 text-gray-600">📄 {attachmentFile?.name}</div>
              )}
            </div>
          )}
          <label className="flex items-center gap-3 cursor-pointer w-full px-3 py-3 border-2 border-dashed border-orange-300 transition-colors rounded-xl bg-orange-50 hover:bg-orange-100">
            <svg className="w-5 h-5 shrink-0 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" /></svg>
            <span className="text-sm text-gray-700 truncate flex-1">
              {attachmentFile ? attachmentFile.name : 'คลิกเพื่อเลือกไฟล์'}
            </span>
            {attachmentFile && (
              <button type="button" onClick={(e) => { e.preventDefault(); setAttachmentFile(null); setAttachmentPreview(''); }}
                className="text-gray-500 hover:text-red-600 shrink-0">✕</button>
            )}
            <input type="file" accept=".pdf,.jpg,.jpeg,.png" className="sr-only"
              onChange={e => {
                const f = e.target.files?.[0] ?? null;
                setAttachmentFile(f);
                if (f) {
                  const reader = new FileReader();
                  reader.onload = () => setAttachmentPreview(reader.result as string);
                  reader.readAsDataURL(f);
                } else {
                  setAttachmentPreview('');
                }
              }} />
          </label>
        </Card>

        {error && <p className="text-sm text-red-600 px-1">{error}</p>}

        <Button type="submit" disabled={submitting || attachmentUploading}
          className="w-full bg-orange-500 hover:bg-orange-600 py-6 text-lg disabled:opacity-50">
          {submitting || attachmentUploading ? 'กำลังส่ง...' : 'ส่งคำขอมาสาย'}
        </Button>
      </form>

      {/* History Requests */}
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-800">ประวัติคำขอมาสาย</h3>
          {historyTotal > 0 && (
            <span className="text-xs text-gray-400">
              {historyRequests.length}/{historyTotal} รายการ
            </span>
          )}
        </div>
        <div className="flex flex-col gap-2 mb-3">
          <input
            value={historyQuery}
            onChange={(e) => setHistoryQuery(e.target.value)}
            placeholder="ค้นหาวันที่, เหตุผล, สถานะ"
            className="w-full px-3 py-2 border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none text-sm"
          />
          <StatusFilterSelect value={historyStatus} onChange={setHistoryStatus} />
        </div>
        {historyLoading ? (
          <div className="text-sm text-gray-500 text-center py-4">กำลังโหลด...</div>
        ) : historyTotal === 0 ? (
          <div className="text-sm text-gray-500 text-center py-4">
            {historyQuery.trim() || historyStatus !== 'ALL' ? 'ไม่พบรายการที่ตรงกับการค้นหา' : 'ยังไม่มีประวัติคำขอมาสาย'}
          </div>
        ) : (
          <div className="space-y-3">
            {historyRequests.map((req) => (
                <div
                  key={req.id}
                  onClick={() => req.status === 'PENDING' && handleEditOpen(req)}
                  className={`p-3 bg-gray-50 rounded-lg ${req.status === 'PENDING' ? 'cursor-pointer hover:bg-blue-50 transition' : ''}`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-gray-900">{fmtDate(req.requestDate)}</span>
                    <StatusBadge status={req.status} />
                  </div>
                  <div className="text-sm text-gray-600">
                    กำหนด {req.scheduledTime} / มาจริง {req.actualTime}
                    <span className="ml-2 text-orange-600 font-medium">สาย {req.lateMinutes} นาที</span>
                  </div>
                  {req.reason && <div className="text-xs text-gray-500 mt-1">{req.reason}</div>}
                  {req.rejectionReason && <div className="text-xs text-red-600 mt-1">เหตุผล: {req.rejectionReason}</div>}
                </div>
              ))}
          </div>
        )}
        {historyRequests.length < historyTotal && (
          <Button
            type="button"
            variant="outline"
            className="w-full mt-3"
            onClick={loadMoreHistory}
            disabled={historyLoadingMore}
          >
            {historyLoadingMore ? 'กำลังโหลด...' : 'โหลดเพิ่ม'}
          </Button>
        )}
      </Card>

      {showSuccess && (
        <div className="fixed inset-0 z-9999 flex items-center justify-center p-4 bg-black/50">
          <Card className="p-6 text-center">
            <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">ส่งคำขอสำเร็จ!</h3>
            <p className="text-gray-600">รอผู้จัดการพิจารณาอนุมัติ</p>
          </Card>
        </div>
      )}

      {/* ===== EDIT MODAL ===== */}
      {editingId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <Card className="w-full max-w-sm max-h-[75vh] p-0 rounded-xl shadow-xl flex flex-col">
            {/* Header */}
            <div className="bg-linear-to-r from-orange-500 to-orange-600 px-5 py-3 rounded-t-xl flex items-center justify-between shrink-0">
              <h3 className="text-xl font-bold text-white">แก้ไขคำขอมาสาย</h3>
              <button
                onClick={() => setEditingId(null)}
                className="w-9 h-9 rounded-full bg-white/15 text-white hover:bg-white/25 flex items-center justify-center"
                aria-label="ปิด"
              >
                <span className="block text-2xl leading-none -translate-y-px">×</span>
              </button>
            </div>

            {/* Body */}
            <div className="p-5 space-y-4 overflow-y-auto flex-1">
              {/* Scheduled Time */}
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-2">เวลาที่กำหนด</label>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <div className="min-w-0">
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={2}
                      placeholder="HH"
                      value={editScheduledHour}
                      onChange={e => { 
                        const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 2);
                        setEditScheduledHour(val);
                      }}
                      className="w-full min-w-0 px-2 py-2 border border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none text-center text-base font-medium"
                    />
                  </div>
                  <div className="text-lg text-gray-400">:</div>
                  <div className="min-w-0">
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={2}
                      placeholder="MM"
                      value={editScheduledMin}
                      onChange={e => { 
                        const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 2);
                        setEditScheduledMin(val);
                      }}
                      className="w-full min-w-0 px-2 py-2 border border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none text-center text-base font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Actual Time */}
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-2">เวลาที่มาจริง</label>
                <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2">
                  <div className="min-w-0">
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={2}
                      placeholder="HH"
                      value={editActualHour}
                      onChange={e => { 
                        const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 2);
                        setEditActualHour(val);
                      }}
                      className="w-full min-w-0 px-2 py-2 border border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none text-center text-base font-medium"
                    />
                  </div>
                  <div className="text-lg text-gray-400">:</div>
                  <div className="min-w-0">
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={2}
                      placeholder="MM"
                      value={editActualMin}
                      onChange={e => { 
                        const val = e.target.value.replace(/[^0-9]/g, '').slice(0, 2);
                        setEditActualMin(val);
                      }}
                      className="w-full min-w-0 px-2 py-2 border border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none text-center text-base font-medium"
                    />
                  </div>
                </div>
              </div>

              {/* Reason */}
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-2">เหตุผล</label>
                <textarea
                  value={editReason}
                  onChange={e => setEditReason(e.target.value)}
                  placeholder="บรรยายเหตุผลการมาสาย"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:border-orange-500 focus:outline-none resize-none text-sm"
                  rows={3}
                />
              </div>

              {/* File Upload */}
              <div>
                <label className="block text-base font-semibold text-gray-700 mb-2">ไฟล์แนบ (PDF, JPG, PNG)</label>
                {editImagePreviewUrl && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={editImagePreviewUrl} alt="Preview" className="mb-2 max-h-40 object-contain rounded-lg border border-gray-200" />
                )}
                {editAttachmentPreview && !editImagePreviewUrl && (
                  <div className="mb-2 p-2 bg-orange-50 border-l-3 border-orange-500 rounded-lg text-sm text-orange-700">{editAttachmentPreview}</div>
                )}
                <label className="block cursor-pointer">
                  <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:border-orange-500 hover:bg-orange-50 transition text-center">
                    <p className="text-base text-gray-600 font-medium">เลือกไฟล์</p>
                  </div>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.png,.jpeg"
                    className="hidden"
                    onChange={e => {
                      const f = e.target.files?.[0] ?? null;
                      if (f) {
                        setEditAttachmentFile(f);
                        setEditAttachmentPreview(f.name);
                        if (f.type.startsWith('image/')) {
                          const reader = new FileReader();
                          reader.onload = (evt) => setEditImagePreviewUrl(evt.target?.result as string);
                          reader.readAsDataURL(f);
                        } else {
                          setEditImagePreviewUrl('');
                        }
                      }
                    }}
                  />
                </label>
              </div>

              {error && <div className="p-2 bg-red-50 border-l-3 border-red-500 rounded text-sm text-red-700">{error}</div>}
            </div>

            {/* Footer */}
            <div className="bg-linear-to-b from-white to-orange-50/70 px-5 py-4 border-t border-orange-100 shrink-0">
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setEditingId(null)} className="px-3 py-2.5 text-sm font-semibold border border-gray-200 text-gray-700 rounded-xl hover:bg-gray-50 transition">ยกเลิก</button>
                <button onClick={handleEditSubmit} disabled={submitting} className="px-3 py-2.5 text-sm font-semibold bg-orange-500 hover:bg-orange-600 text-white rounded-xl shadow-sm transition disabled:opacity-50 disabled:cursor-not-allowed">
                  {submitting ? 'กำลังบันทึก...' : 'บันทึก'}
                </button>
              </div>
              <button onClick={() => { setEditingId(null); setShowDeleteConfirm(editingId!); }} className="w-full mt-3 px-3 py-2.5 text-sm font-semibold bg-red-500 hover:bg-red-600 text-white rounded-xl transition">
                ยกเลิกคำขอมาสาย
              </button>
            </div>
          </Card>
        </div>
      )}

      {/* ===== DELETE CONFIRMATION ===== */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <Card className="max-w-sm p-6 space-y-4">
            <h3 className="text-lg font-bold text-gray-900">ยกเลิกคำขอมาสาย</h3>
            <p className="text-gray-600">คุณแน่ใจว่าต้องการยกเลิกคำขอนี้?</p>
            <div className="flex gap-2">
              <button onClick={() => setShowDeleteConfirm(null)} className="flex-1 px-4 py-2 border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition">ยกเลิก</button>
              <button onClick={() => handleDelete(showDeleteConfirm)} disabled={submitting} className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg transition disabled:opacity-50">
                {submitting ? 'กำลัง...' : 'ยกเลิกคำขอ'}
              </button>
            </div>
          </Card>
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────── MAIN PAGE ────────────────────────────────────────────
export default function LeaveRequestPage() {
  const { user } = useAuth();
  const router = useRouter();

  // Redirect admin/manager/superadmin to their respective dashboards, not /user/leave-request
  useEffect(() => {
    if (user && user.role !== 'user') {
      if (user.role === 'admin') {
        router.push('/admin/leave-request');
      } else if (user.role === 'manager') {
        router.push('/manager/leave-request');
      } else if (user.role === 'superadmin') {
        router.push('/superadmin/leave-request');
      }
    }
  }, [user, router]);

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-linear-to-r from-orange-500 to-orange-600 text-white">
        <h2 className="text-xl font-bold">คำขอลา / มาสาย</h2>
        <p className="text-sm text-white/90">ยื่นคำขอลาและแจ้งมาสาย</p>
      </Card>

      <Tabs defaultValue="leave" className="w-full">
        <TabsList className="sticky top-20 z-30 grid w-full grid-cols-2">
          <TabsTrigger value="leave">ขอลา</TabsTrigger>
          <TabsTrigger value="late">ขอมาสาย</TabsTrigger>
        </TabsList>
        <TabsContent value="leave" className="mt-4">
          <LeaveTab />
        </TabsContent>
        <TabsContent value="late" className="mt-4">
          <LateTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
