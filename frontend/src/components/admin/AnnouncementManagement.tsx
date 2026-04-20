"use client";

// หน้าจัดการประกาศสำหรับ Admin — รวมทุกอย่างไว้ที่เดียว (list, create, edit, send, delete)
// Flow: ADMIN สร้าง DRAFT → เลือกกลุ่มเป้าหมาย → กดส่ง → SENT (immutable)

import { useState, useEffect, useCallback, useRef } from 'react';
import announcementService from '@/services/announcementService';
import api from '@/services/api';
import type {
  Announcement,
  AnnouncementRole,
  AnnouncementStatus,
  CreateAnnouncementDTO,
  UpdateAnnouncementDTO,
} from '@/types/announcement';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import AlertDialog from '@/components/common/AlertDialog';

// user แบบย่อสำหรับ dropdown เลือกผู้รับประกาศ
interface SimpleUser {
  userId: number;
  firstName: string;
  lastName: string;
  email: string;
  role: string;
}

// constants สำหรับ UI (role picker, badge color)
const ROLE_OPTIONS: { value: AnnouncementRole; label: string }[] = [
  { value: 'SUPERADMIN', label: 'Super Admin' },
  { value: 'ADMIN', label: 'Admin' },
  { value: 'MANAGER', label: 'Manager' },
  { value: 'USER', label: 'พนักงาน' },
];

const ROLE_BADGE_COLOR: Record<AnnouncementRole, string> = {
  SUPERADMIN: 'bg-purple-100 text-purple-700',
  ADMIN: 'bg-orange-100 text-orange-700',
  MANAGER: 'bg-blue-100 text-blue-700',
  USER: 'bg-green-100 text-green-700',
};

const ROLE_ICONS: Record<AnnouncementRole, string> = {
  SUPERADMIN: '',
  ADMIN: '',
  MANAGER: '',
  USER: '',
};

const ROLE_DESCRIPTIONS: Record<AnnouncementRole, string> = {
  SUPERADMIN: 'ผู้ดูแลระบบสูงสุด',
  ADMIN: 'ผู้ดูแลระบบ',
  MANAGER: 'ผู้จัดการ',
  USER: 'พนักงานทั่วไป',
};

const AVATAR_COLORS = [
  'from-violet-500 to-purple-600',
  'from-blue-500 to-cyan-500',
  'from-emerald-500 to-teal-500',
  'from-orange-500 to-amber-500',
  'from-pink-500 to-rose-500',
  'from-indigo-500 to-blue-600',
];

// ─── ฟังก์ชันช่วย ──

const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

// แปลง "1, 2, 5" เป็น [1, 2, 5] สำหรับ branchIds
const parseBranchIds = (raw: string): number[] =>
  raw
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n) && n > 0);

const PAGE_SIZE = 4;

export default function AnnouncementManagement() {
  // ── State ──
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ALL' | AnnouncementStatus>('ALL');

  // เลือกหลายรายการสำหรับลบพร้อมกัน (bulk delete)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const [showBulkDelete, setShowBulkDelete] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);

  // modals: 'new' = สร้างใหม่, Announcement = แก้ไข, null = ปิด
  const [editTarget, setEditTarget] = useState<Announcement | 'new' | null>(null);
  const [viewTarget, setViewTarget] = useState<Announcement | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);
  const [sendTarget, setSendTarget] = useState<Announcement | null>(null);

  const emptyForm = { title: '', content: '', targetRoles: [] as AnnouncementRole[], branchIds: '' };
  const [form, setForm] = useState(emptyForm);

  // user picker สำหรับเลือกผู้รับเฉพาะราย — โหลดครั้งเดียวเพราะดึง user ทั้งหมดมาใส่ dropdown
  const [allUsers, setAllUsers] = useState<SimpleUser[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<number[]>([]);
  const [userSearch, setUserSearch] = useState('');
  const [isUserPickerOpen, setIsUserPickerOpen] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const userPickerRef = useRef<HTMLDivElement>(null);

  // loading ใช้ตัวเดียวเพราะทำทีละ action
  const [loadingAction, setLoadingAction] = useState<null | 'saving' | 'sending' | 'deleting'>(null);

  const [alert, setAlert] = useState({
    isOpen: false,
    type: 'info' as 'info' | 'success' | 'error' | 'warning',
    title: '',
    message: '',
  });

  const showAlert = useCallback(
    (type: 'info' | 'success' | 'error' | 'warning', title: string, message: string) =>
      setAlert({ isOpen: true, type, title, message }),
    []
  );
  const closeAlert = () => setAlert((p) => ({ ...p, isOpen: false }));

  const fetchAnnouncements = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await announcementService.getAll();
      setAnnouncements(data);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด';
      showAlert('error', 'โหลดข้อมูลล้มเหลว', msg);
    } finally {
      setIsLoading(false);
    }
  }, [showAlert]);

  useEffect(() => {
    fetchAnnouncements();
  }, [fetchAnnouncements]);

  // โหลดครั้งเดียวเพื่อประหยัด API call ซ้ำทุกครั้งที่เปิด form
  const fetchUsers = useCallback(async () => {
    if (allUsers.length > 0) return;
    setLoadingUsers(true);
    try {
      const response = await api.get('/users', { params: { limit: 500 } });
      const data = response.data?.data ?? response.data;
      const rawList: any[] = Array.isArray(data) ? data : (data?.users ?? []);
      const mapped: SimpleUser[] = rawList.map((u: any) => ({
        userId: Number(u.userId ?? u.user_id ?? u.id),
        firstName: String(u.firstName ?? u.first_name ?? ''),
        lastName: String(u.lastName ?? u.last_name ?? ''),
        email: String(u.email ?? ''),
        role: String(u.role ?? '').toUpperCase(),
      }));
      setAllUsers(mapped);
    } catch {
      // silently fail — user picker will show empty
    } finally {
      setLoadingUsers(false);
    }
  }, [allUsers.length]);

  // ปิด dropdown เมื่อคลิกนอกพื้นที่
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (userPickerRef.current && !userPickerRef.current.contains(e.target as Node)) {
        setIsUserPickerOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // กรองตามแท็บ + แบ่งหน้า
  const filtered = announcements.filter((a) => {
    if (activeTab === 'ALL') return true;
    return a.status === activeTab;
  });
  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const paginatedList = filtered.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
  const pageIds = new Set(paginatedList.map((a) => a.announcementId));
  const allPageSelected = paginatedList.length > 0 && paginatedList.every((a) => selectedIds.has(a.announcementId));

  const stats = {
    total: announcements.length,
    draft: announcements.filter((a) => a.status === 'DRAFT').length,
    sent: announcements.filter((a) => a.status === 'SENT').length,
  };

  // Event Handlers

  const openCreate = () => {
    setForm(emptyForm);
    setSelectedUserIds([]);
    setUserSearch('');
    setIsUserPickerOpen(false);
    setEditTarget('new');
    fetchUsers();
  };

  // โหลดข้อมูลเดิมเข้า form เพื่อให้ user เห็นข้อมูลเดิมแล้วแก้ได้ทันที
  const openEdit = (a: Announcement) => {
    setForm({
      title: a.title,
      content: a.content,
      targetRoles: [...a.targetRoles],
      branchIds: a.targetBranchIds.join(', '),
    });
    setSelectedUserIds(a.targetUserIds ?? []);
    setUserSearch('');
    setIsUserPickerOpen(false);
    setEditTarget(a);
    fetchUsers();
  };

  // ดึง detail + recipients จาก API เพื่อแสดง list คนรับ
  const openView = async (a: Announcement) => {
    try {
      const detail = await announcementService.getById(a.announcementId);
      setViewTarget(detail);
    } catch {
      setViewTarget(a);
    }
  };

  const toggleFormRole = (role: AnnouncementRole) =>
    setForm((p) => ({
      ...p,
      targetRoles: p.targetRoles.includes(role)
        ? p.targetRoles.filter((r) => r !== role)
        : [...p.targetRoles, role],
    }));

  // สร้างประกาศใหม่ — DRAFT เสมอ
  const handleCreate = async () => {
    if (!form.title.trim() || !form.content.trim()) {
      showAlert('warning', 'ข้อมูลไม่ครบ', 'กรุณากรอกหัวข้อและเนื้อหา');
      return;
    }
    setLoadingAction('saving');
    try {
      const dto: CreateAnnouncementDTO = {
        title: form.title.trim(),
        content: form.content.trim(),
        ...(form.targetRoles.length > 0 && { targetRoles: form.targetRoles }),
        ...(form.branchIds.trim() && { targetBranchIds: parseBranchIds(form.branchIds) }),
        ...(selectedUserIds.length > 0 && { targetUserIds: selectedUserIds }),
      };
      await announcementService.create(dto);
      setEditTarget(null);
      showAlert('success', 'สำเร็จ', 'สร้างประกาศเรียบร้อยแล้ว');
      fetchAnnouncements();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด';
      showAlert('error', 'สร้างไม่สำเร็จ', msg);
    } finally {
      setLoadingAction(null);
    }
  };

  // แก้ไข DRAFT
  const handleUpdate = async () => {
    if (!editTarget || editTarget === 'new') return;
    if (!form.title.trim() || !form.content.trim()) {
      showAlert('warning', 'ข้อมูลไม่ครบ', 'กรุณากรอกหัวข้อและเนื้อหา');
      return;
    }
    setLoadingAction('saving');
    try {
      const dto: UpdateAnnouncementDTO = {
        title: form.title.trim(),
        content: form.content.trim(),
        targetRoles: form.targetRoles,
        targetBranchIds: form.branchIds.trim() ? parseBranchIds(form.branchIds) : [],
        targetUserIds: selectedUserIds,
      };
      await announcementService.update(editTarget.announcementId, dto);
      setEditTarget(null);
      showAlert('success', 'สำเร็จ', 'อัปเดตประกาศเรียบร้อยแล้ว');
      fetchAnnouncements();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด';
      showAlert('error', 'อัปเดตไม่สำเร็จ', msg);
    } finally {
      setLoadingAction(null);
    }
  };

  // ส่งประกาศ — DRAFT → SENT + สร้าง recipients + ส่งอีเมล
  const handleSend = async () => {
    if (!sendTarget) return;
    setLoadingAction('sending');
    try {
      const result = await announcementService.send(sendTarget.announcementId);
      setSendTarget(null);
      showAlert('success', 'ส่งประกาศสำเร็จ', `ส่งให้พนักงาน ${result.recipientCount} คน`);
      fetchAnnouncements();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด';
      showAlert('error', 'ส่งไม่สำเร็จ', msg);
    } finally {
      setLoadingAction(null);
    }
  };

  // ลบ 1 รายการ
  const handleDelete = async () => {
    if (!deleteTarget) return;
    setLoadingAction('deleting');
    try {
      await announcementService.delete(deleteTarget.announcementId);
      setDeleteTarget(null);
      setSelectedIds((prev) => { const next = new Set(prev); next.delete(deleteTarget.announcementId); return next; });
      showAlert('success', 'ลบสำเร็จ', 'ลบประกาศเรียบร้อยแล้ว');
      fetchAnnouncements();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด';
      showAlert('error', 'ลบไม่สำเร็จ', msg);
    } finally {
      setLoadingAction(null);
    }
  };

  // ลบหลายรายการ — วนลบทีละ ID เพราะ API ไม่มี bulk delete endpoint
  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setLoadingAction('deleting');
    let ok = 0;
    let fail = 0;
    for (const id of selectedIds) {
      try {
        await announcementService.delete(id);
        ok++;
      } catch {
        fail++;
      }
    }
    setSelectedIds(new Set());
    setShowBulkDelete(false);
    setLoadingAction(null);
    if (fail === 0) {
      showAlert('success', 'ลบสำเร็จ', `ลบประกาศ ${ok} รายการเรียบร้อยแล้ว`);
    } else {
      showAlert('warning', 'ลบบางส่วนไม่สำเร็จ', `สำเร็จ ${ok}, ล้มเหลว ${fail}`);
    }
    fetchAnnouncements();
  };

  // checkbox helpers
  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  /** เลือก/ยกเลิกทั้งหน้าปัจจุบัน */
  const toggleSelectAll = () => {
    if (allPageSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        pageIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        pageIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };

  const selectAllFiltered = () => {
    setSelectedIds(new Set(filtered.map((a) => a.announcementId)));
  };

  // Sub-renders

  const AnnouncementCard = ({ a }: { a: Announcement }) => (
    <Card className={`p-5 transition-shadow hover:shadow-md ${selectedIds.has(a.announcementId) ? 'ring-2 ring-orange-400 bg-orange-50/30' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        {/* Checkbox */}
        <button
          type="button"
          onClick={() => toggleSelect(a.announcementId)}
          className="mt-1 shrink-0"
        >
          <div className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
            selectedIds.has(a.announcementId)
              ? 'bg-orange-500 border-orange-500'
              : 'border-gray-300 hover:border-orange-400'
          }`}>
            {selectedIds.has(a.announcementId) && (
              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
            )}
          </div>
        </button>
        <div className="flex-1 min-w-0">
          {/* Header */}
          <div className="flex flex-wrap items-center gap-2 mb-1">
            <span
              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                a.status === 'DRAFT'
                  ? 'bg-gray-100 text-gray-600'
                  : 'bg-green-100 text-green-700'
              }`}
            >
              {a.status === 'DRAFT' ? (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
              ) : (
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
              {a.status === 'DRAFT' ? 'ฉบับร่าง' : 'ส่งแล้ว'}
            </span>
          </div>

          {/* Title */}
          <h3 className="text-base font-semibold text-gray-800 truncate">{a.title}</h3>

          {/* Content preview */}
          <p className="mt-1 text-sm text-gray-500 line-clamp-2">{a.content}</p>

          {/* Target */}
          <div className="flex flex-wrap gap-1.5 mt-2">
            {a.targetUserIds && a.targetUserIds.length > 0 ? (
              <span className="text-xs bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full">
                👤  {a.targetUserIds.length} คน
              </span>
            ) : (
              <>
                {a.targetRoles.length === 0 ? (
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">ทุก Role</span>
                ) : (
                  a.targetRoles.map((r) => (
                    <span key={r} className={`text-xs px-2 py-0.5 rounded-full ${ROLE_BADGE_COLOR[r]}`}>
                      {ROLE_OPTIONS.find((o) => o.value === r)?.label ?? r}
                    </span>
                  ))
                )}
                {a.targetBranchIds.length === 0 ? (
                  <span className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full">ทุกสาขา</span>
                ) : (
                  a.targetBranchIds.map((id) => (
                    <span key={id} className="text-xs bg-blue-50 text-blue-600 px-2 py-0.5 rounded-full">
                      สาขา #{id}
                    </span>
                  ))
                )}
              </>
            )}
          </div>

          {/* Meta */}
          <div className="flex flex-wrap gap-3 mt-2 text-xs text-gray-400">
            <span>สร้างโดย: {a.creator.firstName} {a.creator.lastName}</span>
            <span>วันที่: {formatDate(a.createdAt)}</span>
            {a.sentAt && <span>ส่งเมื่อ: {formatDate(a.sentAt)}</span>}
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-2 shrink-0">
          {a.status === 'DRAFT' && (
            <>
              <Button
                size="sm"
                variant="outline"
                className="text-xs text-orange-600 border-orange-200 hover:bg-orange-50"
                onClick={() => openEdit(a)}
              >
                <svg className="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5"/>
                </svg>
                แก้ไข
              </Button>
              <Button
                size="sm"
                className="text-xs text-white bg-green-600 hover:bg-green-700"
                onClick={() => setSendTarget(a)}
              >
                <svg className="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
                ส่ง
              </Button>
            </>
          )}
          {a.status === 'SENT' && (
            <Button
              size="sm"
              variant="outline"
              className="text-xs text-blue-600 border-blue-200 hover:bg-blue-50"
              onClick={() => openView(a)}
            >
              <svg className="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0" />
              </svg>
              ดูผู้รับ
            </Button>
          )}
          <Button
            size="sm"
            variant="outline"
            className="text-xs text-red-600 border-red-200 hover:bg-red-50"
            onClick={() => { setDeleteTarget(a); }}
          >
            <svg className="w-3.5 h-3.5 mr-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
            ลบ
          </Button>
        </div>
      </div>
    </Card>
  );

  // ฟอร์มสร้าง/แก้ไขใช้ร่วมกัน แยกด้วย isEdit flag เพื่อลด code ซ้ำ
  const renderFormModal = (isEdit: boolean) => {
    const searchLower = userSearch.toLowerCase();
    const filteredUsers = allUsers.filter((u) => {
      if (!searchLower) return true;
      const roleLabel = ROLE_OPTIONS.find((r) => r.value === u.role)?.label ?? u.role;
      return (
        u.firstName.toLowerCase().includes(searchLower) ||
        u.lastName.toLowerCase().includes(searchLower) ||
        u.email.toLowerCase().includes(searchLower) ||
        `${u.firstName} ${u.lastName}`.toLowerCase().includes(searchLower) ||
        roleLabel.toLowerCase().includes(searchLower) ||
        u.role.toLowerCase().includes(searchLower)
      );
    });

    const getAvatarColor = (id: number) => AVATAR_COLORS[id % AVATAR_COLORS.length];

    const summaryText = selectedUserIds.length > 0
      ? `เฉพาะ ${selectedUserIds.length} คน`
      : form.targetRoles.length > 0
        ? `${form.targetRoles.length} กลุ่ม${form.branchIds.trim() ? ' + สาขาที่ระบุ' : ''}`
        : 'ส่งถึงทุกคน';

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[92vh] overflow-hidden flex flex-col">

          {/* ── Gradient Header ── */}
          <div className="relative px-6 pt-6 pb-5 overflow-hidden bg-linear-to-br from-orange-500 via-orange-400 to-amber-400">
            {/* Pattern overlay */}
            <div className="absolute inset-0 opacity-10">
              <svg width="100%" height="100%"><defs><pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse"><circle cx="2" cy="2" r="1" fill="white"/></pattern></defs><rect fill="url(#grid)" width="100%" height="100%"/></svg>
            </div>
            <button
              onClick={() => setEditTarget(null)}
              className="absolute p-1.5 text-white/70 hover:text-white right-4 top-4 rounded-lg hover:bg-white/20 transition-all duration-200"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
            </button>
            <div className="relative flex items-center gap-4">
              <div className="flex items-center justify-center w-12 h-12 text-xl shadow-lg rounded-xl bg-white/20 backdrop-blur-sm shadow-orange-600/20">
                {isEdit ? '✏️' : '📢'}
              </div>
              <div>
                <h2 className="text-xl font-bold tracking-tight text-white">
                  {isEdit ? 'แก้ไขประกาศ' : 'สร้างประกาศใหม่'}
                </h2>
                <p className="text-sm text-white/80">
                  {isEdit ? 'อัปเดตรายละเอียดประกาศ' : 'กรอกข้อมูลและเลือกกลุ่มเป้าหมาย'}
                </p>
              </div>
            </div>
          </div>

          {/* ── Scrollable Body ── */}
          <div className="flex-1 px-6 py-5 space-y-6 overflow-y-auto">

            {/* ─ Section 1: ข้อมูลประกาศ ─ */}
            <div className="space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center text-xs font-bold text-white rounded-full shadow-sm w-7 h-7 bg-linear-to-br from-orange-500 to-orange-600">1</div>
                <span className="text-sm font-semibold text-gray-800">ข้อมูลประกาศ</span>
              </div>

              {/* Title */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-600">
                  หัวข้อ <span className="text-red-400">*</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
                  </div>
                  <input
                    className="w-full py-2.5 pl-10 pr-4 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400/40 focus:border-orange-400 focus:bg-white transition-all duration-200"
                    placeholder="พิมพ์หัวข้อประกาศ..."
                    value={form.title}
                    onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                  />
                </div>
              </div>

              {/* Content */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-600">
                  เนื้อหา <span className="text-red-400">*</span>
                </label>
                <textarea
                  rows={4}
                  className="w-full px-4 py-3 text-sm transition-all duration-200 border border-gray-200 resize-none bg-gray-50 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400/40 focus:border-orange-400 focus:bg-white"
                  placeholder="กรอกเนื้อหาประกาศ..."
                  value={form.content}
                  onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
                />
                <p className="text-xs text-right text-gray-400">{form.content.length} ตัวอักษร</p>
              </div>
            </div>

            <div className="border-t border-gray-200 border-dashed" />

            {/* ─ Section 2: กลุ่มเป้าหมาย ─ */}
            <div className="space-y-4">
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center text-xs font-bold text-white rounded-full shadow-sm w-7 h-7 bg-linear-to-br from-orange-500 to-orange-600">2</div>
                <span className="text-sm font-semibold text-gray-800">กลุ่มเป้าหมาย</span>
                <span className="px-2 py-0.5 text-[10px] rounded-full bg-gray-100 text-gray-500">ไม่เลือก = ทุกคน</span>
              </div>

              {/* Role cards */}
              <div className="grid grid-cols-2 gap-2.5">
                {ROLE_OPTIONS.map((opt) => {
                  const isActive = form.targetRoles.includes(opt.value);
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => toggleFormRole(opt.value)}
                      className={`relative flex items-center gap-3 px-4 py-3 rounded-xl border-2 text-left transition-all duration-200 ${
                        isActive
                          ? 'border-orange-400 bg-orange-50 shadow-sm shadow-orange-100'
                          : 'border-gray-100 bg-gray-50/50 hover:border-gray-200 hover:bg-gray-50'
                      }`}
                    >
                      <span className="text-xl">{ROLE_ICONS[opt.value]}</span>
                      <div className="flex-1 min-w-0">
                        <p className={`text-sm font-semibold ${isActive ? 'text-orange-700' : 'text-gray-700'}`}>
                          {opt.label}
                        </p>
                        <p className="text-[11px] text-gray-400 truncate">{ROLE_DESCRIPTIONS[opt.value]}</p>
                      </div>
                      {isActive && (
                        <div className="flex items-center justify-center w-5 h-5 text-white bg-orange-500 rounded-full">
                          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Branch IDs */}
              <div className="space-y-1.5">
                <label className="text-sm font-medium text-gray-600">
                  สาขาเป้าหมาย <span className="text-xs text-gray-400">(เว้นว่าง = ทุกสาขา)</span>
                </label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                    <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" /></svg>
                  </div>
                  <input
                    className="w-full py-2.5 pl-10 pr-4 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400/40 focus:border-orange-400 focus:bg-white transition-all duration-200"
                    placeholder="เช่น 1, 2, 5"
                    value={form.branchIds}
                    onChange={(e) => setForm((p) => ({ ...p, branchIds: e.target.value }))}
                  />
                </div>
              </div>
            </div>

            <div className="border-t border-gray-200 border-dashed" />

            {/* ─ Section 3: เลือกพนักงานเฉพาะราย ─ */}
            <div className="space-y-4" ref={userPickerRef}>
              <div className="flex items-center gap-2.5">
                <div className="flex items-center justify-center text-xs font-bold text-white rounded-full shadow-sm w-7 h-7 bg-linear-to-br from-orange-500 to-orange-600">3</div>
                <span className="text-sm font-semibold text-gray-800">เลือกพนักงานเฉพาะราย</span>
                <span className="px-2 py-0.5 text-[10px] rounded-full bg-gray-100 text-gray-500">ไม่บังคับ</span>
              </div>

              {selectedUserIds.length > 0 && (
                <div className="p-3 space-y-2 border border-orange-200 rounded-xl bg-orange-50/50">
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-medium text-orange-600">
                      ⚡ เลือกแล้ว {selectedUserIds.length} คน — จะส่งเฉพาะคนที่เลือก
                    </p>
                    <button
                      type="button"
                      onClick={() => setSelectedUserIds([])}
                      className="px-2 py-0.5 text-[11px] text-red-500 bg-white rounded-md border border-red-200 hover:bg-red-50 transition-colors"
                    >
                      ล้างทั้งหมด
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {selectedUserIds.map((uid) => {
                      const u = allUsers.find((x) => x.userId === uid);
                      return (
                        <span
                          key={uid}
                          className="inline-flex items-center gap-1.5 pl-1 pr-2 py-1 text-xs font-medium text-orange-800 bg-white border border-orange-200 rounded-full shadow-sm"
                        >
                          <span className={`flex items-center justify-center w-5 h-5 text-[10px] font-bold text-white rounded-full bg-linear-to-br ${getAvatarColor(uid)}`}>
                            {u ? u.firstName.charAt(0) : '#'}
                          </span>
                          {u ? `${u.firstName} ${u.lastName}` : `#${uid}`}
                          <button
                            type="button"
                            onClick={() => setSelectedUserIds((prev) => prev.filter((id) => id !== uid))}
                            className="ml-0.5 text-orange-400 hover:text-red-500 transition-colors"
                          >
                            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M6 18L18 6M6 6l12 12" /></svg>
                          </button>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Search input */}
              <div className="relative">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <svg className="w-4 h-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>
                </div>
                <input
                  className="w-full py-2.5 pl-10 pr-4 text-sm bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-orange-400/40 focus:border-orange-400 focus:bg-white transition-all duration-200"
                  placeholder="ค้นหาด้วยชื่อ, อีเมล หรือตำแหน่ง..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  onFocus={() => { setIsUserPickerOpen(true); fetchUsers(); }}
                />
                {userSearch && (
                  <button
                    type="button"
                    onClick={() => setUserSearch('')}
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-400 hover:text-gray-600"
                  >
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
                  </button>
                )}

                {/* Dropdown */}
                {isUserPickerOpen && (
                  <div className="absolute z-20 w-full mt-2 overflow-hidden bg-white border border-gray-200 shadow-xl rounded-xl shadow-gray-200/50">
                    {/* Dropdown header */}
                    <div className="px-4 py-2 text-xs font-medium text-gray-500 border-b border-gray-100 bg-gray-50/80">
                      {loadingUsers ? 'กำลังโหลด...' : `${filteredUsers.length} คน`}
                    </div>
                    <div className="overflow-y-auto max-h-60">
                      {loadingUsers ? (
                        <div className="flex items-center justify-center gap-2 py-8">
                          <div className="w-5 h-5 border-2 border-orange-400 rounded-full border-t-transparent animate-spin" />
                          <span className="text-sm text-gray-400">กำลังโหลดรายชื่อ...</span>
                        </div>
                      ) : filteredUsers.length === 0 ? (
                        <div className="py-8 text-center">
                          <div className="mb-2 text-3xl">🔍</div>
                          <p className="text-sm text-gray-400">ไม่พบพนักงานที่ค้นหา</p>
                        </div>
                      ) : (
                        filteredUsers.map((u) => {
                          const isSelected = selectedUserIds.includes(u.userId);
                          const roleLabel = ROLE_OPTIONS.find((r) => r.value === u.role)?.label ?? u.role;
                          const roleColor = ROLE_BADGE_COLOR[u.role as AnnouncementRole] ?? 'bg-gray-100 text-gray-600';
                          return (
                            <button
                              key={u.userId}
                              type="button"
                              onClick={() => {
                                setSelectedUserIds((prev) =>
                                  isSelected ? prev.filter((id) => id !== u.userId) : [...prev, u.userId]
                                );
                              }}
                              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-all duration-150 ${
                                isSelected
                                  ? 'bg-orange-50 hover:bg-orange-100/80'
                                  : 'hover:bg-gray-50'
                              }`}
                            >
                              {/* Avatar */}
                              <div className={`relative flex items-center justify-center w-9 h-9 text-sm font-bold text-white rounded-full bg-linear-to-br ${getAvatarColor(u.userId)} shrink-0`}>
                                {u.firstName.charAt(0)}
                                {isSelected && (
                                  <div className="absolute -bottom-0.5 -right-0.5 flex items-center justify-center w-4 h-4 bg-orange-500 rounded-full ring-2 ring-white">
                                    <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
                                  </div>
                                )}
                              </div>
                              {/* Info */}
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm font-medium ${isSelected ? 'text-orange-700' : 'text-gray-800'}`}>
                                  {u.firstName} {u.lastName}
                                </p>
                                <p className="text-xs text-gray-400 truncate">{u.email}</p>
                              </div>
                              {/* Role badge */}
                              <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium shrink-0 ${roleColor}`}>
                                {roleLabel}
                              </span>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ── Sticky Footer ── */}
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-100 bg-gray-50/80">
            <div className="flex items-center gap-2 text-xs text-gray-500">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0" /></svg>
              <span>เป้าหมาย: <span className="font-medium text-gray-700">{summaryText}</span></span>
            </div>
            <div className="flex gap-2.5">
              <Button
                variant="outline"
                className="rounded-xl"
                onClick={() => setEditTarget(null)}
              >
                ยกเลิก
              </Button>
              <Button
                className="text-white shadow-md rounded-xl bg-linear-to-r from-orange-500 to-orange-600 hover:from-orange-600 hover:to-orange-700 shadow-orange-200/50"
                onClick={isEdit ? handleUpdate : handleCreate}
                disabled={loadingAction === 'saving'}
              >
                {loadingAction === 'saving' ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 border-2 border-white rounded-full border-t-transparent animate-spin" />
                    กำลังบันทึก...
                  </span>
                ) : isEdit ? (
                  <span className="flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    บันทึกการแก้ไข
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5">
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" /></svg>
                    สร้างประกาศ
                  </span>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // ───────────────────────────────────────────────────────────────
  // Render
  return (
    <div className="p-6 space-y-6">
      {/* ── Page Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">📢 จัดการประกาศ</h1>
          <p className="text-sm text-gray-500 mt-0.5">สร้าง แก้ไข และส่งประกาศถึงพนักงาน</p>
        </div>
        <Button
          className="gap-2 text-white bg-orange-500 hover:bg-orange-600"
          onClick={openCreate}
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          สร้างประกาศ
        </Button>
      </div>

      {/* ── Stats ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[
          { label: 'ทั้งหมด', value: stats.total, color: 'from-slate-500 to-slate-600', icon: '📋' },
          { label: 'ฉบับร่าง', value: stats.draft, color: 'from-gray-400 to-gray-500', icon: '✏️' },
          { label: 'ส่งแล้ว', value: stats.sent, color: 'from-green-500 to-green-600', icon: '✅' },
        ].map((s) => (
          <Card key={s.label} className="p-4">
            <div className="flex items-center gap-3">
              <div className={`w-10 h-10 rounded-xl bg-linear-to-br ${s.color} flex items-center justify-center text-lg`}>
                {s.icon}
              </div>
              <div>
                <p className="text-xs text-gray-500">{s.label}</p>
                <p className="text-2xl font-bold text-gray-800">{s.value}</p>
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* ── Tabs ── */}
      <div className="flex gap-2 border-b border-gray-200">
        {(['ALL', 'DRAFT', 'SENT'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => { setActiveTab(tab); setCurrentPage(1); setSelectedIds(new Set()); }}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-orange-500 text-orange-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            {tab === 'ALL' ? 'ทั้งหมด' : tab === 'DRAFT' ? 'ฉบับร่าง' : 'ส่งแล้ว'}
            <span className="ml-1.5 text-xs bg-gray-100 text-gray-600 rounded-full px-1.5 py-0.5">
              {tab === 'ALL' ? stats.total : tab === 'DRAFT' ? stats.draft : stats.sent}
            </span>
          </button>
        ))}
      </div>

      {/* ── Bulk actions toolbar ── */}
      {filtered.length > 0 && (
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={toggleSelectAll}
            className="flex items-center gap-2 px-3 py-1.5 text-sm border rounded-lg hover:bg-gray-50 transition-colors"
          >
            <div className={`w-4 h-4 rounded border-2 flex items-center justify-center transition-colors ${
              allPageSelected ? 'bg-orange-500 border-orange-500' : 'border-gray-300'
            }`}>
              {allPageSelected && (
                <svg className="w-2.5 h-2.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" /></svg>
              )}
            </div>
            {allPageSelected ? 'ยกเลิกเลือกหน้านี้' : 'เลือกทั้งหน้า'}
          </button>
          {filtered.length > PAGE_SIZE && (
            <button
              type="button"
              onClick={selectAllFiltered}
              className="px-3 py-1.5 text-sm text-orange-600 border border-orange-200 rounded-lg hover:bg-orange-50 transition-colors"
            >
              เลือกทั้งหมด ({filtered.length})
            </button>
          )}
          {selectedIds.size > 0 && (
            <>
              <span className="text-sm text-gray-500">เลือกแล้ว {selectedIds.size} รายการ</span>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="px-3 py-1.5 text-sm text-gray-600 border rounded-lg hover:bg-gray-50 transition-colors"
              >
                ล้างการเลือก
              </button>
              <button
                type="button"
                onClick={() => setShowBulkDelete(true)}
                className="px-3 py-1.5 text-sm text-white bg-red-600 rounded-lg hover:bg-red-700 transition-colors"
              >
                🗑️ ลบที่เลือก ({selectedIds.size})
              </button>
            </>
          )}
        </div>
      )}

      {/* ── List ── */}
      {isLoading ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="w-12 h-12 mx-auto mb-3 border-4 border-orange-500 rounded-full border-t-transparent animate-spin" />
            <p className="text-sm text-gray-500">กำลังโหลดข้อมูล...</p>
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex items-center justify-center py-16">
          <div className="text-center">
            <div className="mb-3 text-5xl">📭</div>
            <p className="text-gray-500">ไม่มีประกาศในรายการนี้</p>
            <Button className="mt-4 text-white bg-orange-500 hover:bg-orange-600" onClick={openCreate}>
              สร้างประกาศแรก
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {paginatedList.map((a) => (
              <AnnouncementCard key={a.announcementId} a={a} />
            ))}
          </div>

          {/* ── Pagination ── */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={safePage <= 1}
                className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
              >
                ← ก่อนหน้า
              </button>
              {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                <button
                  key={p}
                  onClick={() => setCurrentPage(p)}
                  className={`w-9 h-9 text-sm rounded-lg transition-colors ${
                    p === safePage
                      ? 'bg-orange-500 text-white font-bold'
                      : 'border hover:bg-gray-50 text-gray-600'
                  }`}
                >
                  {p}
                </button>
              ))}
              <button
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={safePage >= totalPages}
                className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-gray-50 transition-colors"
              >
                ถัดไป →
              </button>
            </div>
          )}
        </>
      )}

      {/* ── Modals ── */}

      {/* Modal สร้างประกาศใหม่ */}
      {editTarget === 'new' && renderFormModal(false)}

      {/* Modal แก้ไขประกาศ */}
      {editTarget && editTarget !== 'new' && renderFormModal(true)}

      {/* Modal ดูรายชื่อผู้รับประกาศ */}
      {viewTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[85vh] overflow-y-auto">
            <div className="flex items-center justify-between p-6 border-b">
              <div>
                <h2 className="text-lg font-bold text-gray-800">👥 รายชื่อผู้รับประกาศ</h2>
                <p className="text-sm text-gray-500 truncate mt-0.5">{viewTarget.title}</p>
              </div>
              <button className="p-2 text-gray-400 rounded-lg hover:bg-gray-100" onClick={() => setViewTarget(null)}>
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="p-6">
              {!viewTarget.recipients || viewTarget.recipients.length === 0 ? (
                <p className="py-6 text-center text-gray-400">ไม่มีรายชื่อผู้รับ</p>
              ) : (
                <>
                  <p className="mb-3 text-sm text-gray-500">
                    ส่งถึงทั้งหมด <span className="font-semibold text-gray-800">{viewTarget.recipients.length}</span> คน
                  </p>
                  <div className="space-y-2">
                    {viewTarget.recipients.map((r) => (
                      <div
                        key={r.recipientId}
                        className="flex items-center justify-between p-3 rounded-lg bg-gray-50"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex items-center justify-center w-8 h-8 text-sm font-bold text-white rounded-full bg-linear-to-br from-orange-400 to-orange-600">
                            {r.user.firstName.charAt(0)}
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-800">
                              {r.user.firstName} {r.user.lastName}
                            </p>
                            <p className="text-xs text-gray-400">{r.user.email}</p>
                          </div>
                        </div>
                        {r.sentAt && (
                          <span className="text-xs text-gray-400">{formatDate(r.sentAt)}</span>
                        )}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
            <div className="flex justify-end px-6 pb-6">
              <Button variant="outline" onClick={() => setViewTarget(null)}>ปิด</Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal ยืนยันการส่งประกาศ */}
      {sendTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm mx-4 bg-white shadow-2xl rounded-2xl">
            <div className="p-6 text-center">
              <div className="flex items-center justify-center mx-auto mb-4 bg-green-100 rounded-full w-14 h-14">
                <svg className="text-green-600 w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </div>
              <h3 className="mb-2 text-lg font-bold text-gray-800">ยืนยันการส่งประกาศ</h3>
              <p className="mb-1 text-sm text-gray-500">
                ต้องการส่งประกาศ <span className="font-semibold text-gray-700">&ldquo;{sendTarget.title}&rdquo;</span> หรือไม่?
              </p>
              <p className="px-3 py-2 mt-3 text-xs rounded-lg text-amber-600 bg-amber-50">
                ⚠️ เมื่อส่งแล้วจะไม่สามารถแก้ไขประกาศได้อีก
              </p>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <Button className="flex-1" variant="outline" onClick={() => setSendTarget(null)}>
                ยกเลิก
              </Button>
              <Button
                className="flex-1 text-white bg-green-600 hover:bg-green-700"
                onClick={handleSend}
                disabled={loadingAction === 'sending'}
              >
                {loadingAction === 'sending' ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white rounded-full border-t-transparent animate-spin" />
                    กำลังส่ง...
                  </span>
                ) : 'ส่งประกาศ'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal ยืนยันการลบประกาศ */}
      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm mx-4 bg-white shadow-2xl rounded-2xl">
            <div className="p-6">
              <div className="flex items-center justify-center mx-auto mb-4 bg-red-100 rounded-full w-14 h-14">
                <svg className="text-red-600 w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="mb-1 text-lg font-bold text-center text-gray-800">ยืนยันการลบประกาศ</h3>
              <p className="mb-4 text-sm text-center text-gray-500">
                &ldquo;{deleteTarget.title}&rdquo;
              </p>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <Button className="flex-1" variant="outline" onClick={() => setDeleteTarget(null)}>
                ยกเลิก
              </Button>
              <Button
                className="flex-1 text-white bg-red-600 hover:bg-red-700"
                onClick={handleDelete}
                disabled={loadingAction === 'deleting'}
              >
                {loadingAction === 'deleting' ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white rounded-full border-t-transparent animate-spin" />
                    กำลังลบ...
                  </span>
                ) : 'ลบประกาศ'}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal ยืนยันการลบหลายรายการ */}
      {showBulkDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="w-full max-w-sm mx-4 bg-white shadow-2xl rounded-2xl">
            <div className="p-6">
              <div className="flex items-center justify-center mx-auto mb-4 bg-red-100 rounded-full w-14 h-14">
                <svg className="text-red-600 w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
              </div>
              <h3 className="mb-1 text-lg font-bold text-center text-gray-800">ยืนยันการลบหลายรายการ</h3>
              <p className="mb-4 text-sm text-center text-gray-500">
                ต้องการลบประกาศ <span className="font-semibold text-red-600">{selectedIds.size}</span> รายการ?
              </p>
            </div>
            <div className="flex gap-3 px-6 pb-6">
              <Button className="flex-1" variant="outline" onClick={() => setShowBulkDelete(false)}>
                ยกเลิก
              </Button>
              <Button
                className="flex-1 text-white bg-red-600 hover:bg-red-700"
                onClick={handleBulkDelete}
                disabled={loadingAction === 'deleting'}
              >
                {loadingAction === 'deleting' ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white rounded-full border-t-transparent animate-spin" />
                    กำลังลบ...
                  </span>
                ) : `ลบ ${selectedIds.size} รายการ`}
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Alert */}
      <AlertDialog {...alert} onClose={closeAlert} />
    </div>
  );
}
