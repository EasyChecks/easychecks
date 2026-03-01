"use client";

import { useState, useEffect, useCallback } from 'react';
import announcementService from '@/services/announcementService';
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

// ─── Constants ───────────────────────────────────────────────────
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

// ─── Helpers ─────────────────────────────────────────────────────
const formatDate = (iso: string) =>
  new Date(iso).toLocaleString('th-TH', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

const parseBranchIds = (raw: string): number[] =>
  raw
    .split(',')
    .map((s) => parseInt(s.trim(), 10))
    .filter((n) => !isNaN(n) && n > 0);

// ─── Component ───────────────────────────────────────────────────
export default function AnnouncementManagement() {
  // ── Data state ──
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'ALL' | AnnouncementStatus>('ALL');

  // ── Modal state ──
  // editTarget === 'new' = create modal, editTarget is Announcement = edit modal, null = ปิด
  const [editTarget, setEditTarget] = useState<Announcement | 'new' | null>(null);
  const [viewTarget, setViewTarget] = useState<Announcement | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Announcement | null>(null);
  const [sendTarget, setSendTarget] = useState<Announcement | null>(null);

  // ── Form state ──
  const emptyForm = { title: '', content: '', targetRoles: [] as AnnouncementRole[], branchIds: '' };
  const [form, setForm] = useState(emptyForm);
  const [deleteReason, setDeleteReason] = useState('');

  // ── Loading flag (รวมเป็นตัวเดียวเพราะแต่ละ action ไม่ทับซ้อนกัน) ──
  const [loadingAction, setLoadingAction] = useState<null | 'saving' | 'sending' | 'deleting'>(null);

  // ── Alert ──
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

  // ── Fetch ──
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

  // ── Filtered list ──
  const filtered = announcements.filter((a) => {
    if (activeTab === 'ALL') return true;
    return a.status === activeTab;
  });

  const stats = {
    total: announcements.length,
    draft: announcements.filter((a) => a.status === 'DRAFT').length,
    sent: announcements.filter((a) => a.status === 'SENT').length,
  };

  // ───────────────────────────────────────────────────────────────
  // Handlers
  // ───────────────────────────────────────────────────────────────

  const openCreate = () => {
    setForm(emptyForm);
    setEditTarget('new');
  };

  const openEdit = (a: Announcement) => {
    setForm({
      title: a.title,
      content: a.content,
      targetRoles: [...a.targetRoles],
      branchIds: a.targetBranchIds.join(', '),
    });
    setEditTarget(a);
  };

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

  // ── Create ──
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

  // ── Update ──
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
        ...(form.branchIds.trim() && { targetBranchIds: parseBranchIds(form.branchIds) }),
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

  // ── Send ──
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

  // ── Delete ──
  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (!deleteReason.trim()) {
      showAlert('warning', 'ต้องระบุเหตุผล', 'กรุณากรอกเหตุผลในการลบ');
      return;
    }
    setLoadingAction('deleting');
    try {
      await announcementService.delete(deleteTarget.announcementId, deleteReason.trim());
      setDeleteTarget(null);
      setDeleteReason('');
      showAlert('success', 'ลบสำเร็จ', 'ลบประกาศเรียบร้อยแล้ว');
      fetchAnnouncements();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'เกิดข้อผิดพลาด';
      showAlert('error', 'ลบไม่สำเร็จ', msg);
    } finally {
      setLoadingAction(null);
    }
  };

  // ───────────────────────────────────────────────────────────────
  // Sub-renders
  // ───────────────────────────────────────────────────────────────

  const AnnouncementCard = ({ a }: { a: Announcement }) => (
    <Card className="p-5 transition-shadow hover:shadow-md">
      <div className="flex items-start justify-between gap-3">
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
            onClick={() => { setDeleteTarget(a); setDeleteReason(''); }}
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

  // ── Form (Create / Edit) shared render ──
  const renderFormModal = (isEdit: boolean) => (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-bold text-gray-800">
            {isEdit ? '✏️ แก้ไขประกาศ' : '➕ สร้างประกาศใหม่'}
          </h2>
          <button
            className="p-2 text-gray-400 rounded-lg hover:bg-gray-100"
            onClick={() => setEditTarget(null)}
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Title */}
          <div>
            <label className="block mb-1 text-sm font-medium text-gray-700">
              หัวข้อประกาศ <span className="text-red-500">*</span>
            </label>
            <input
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
              placeholder="กรอกหัวข้อประกาศ..."
              value={form.title}
              onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
            />
          </div>

          {/* Content */}
          <div>
            <label className="block mb-1 text-sm font-medium text-gray-700">
              เนื้อหา <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={5}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg resize-none focus:outline-none focus:ring-2 focus:ring-orange-400"
              placeholder="กรอกเนื้อหาประกาศ..."
              value={form.content}
              onChange={(e) => setForm((p) => ({ ...p, content: e.target.value }))}
            />
          </div>

          {/* Target Roles */}
          <div>
            <label className="block mb-2 text-sm font-medium text-gray-700">
              กลุ่มเป้าหมาย <span className="text-xs text-gray-400">(ไม่เลือก = ทุก Role)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {ROLE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => toggleFormRole(opt.value)}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                    form.targetRoles.includes(opt.value)
                      ? `${ROLE_BADGE_COLOR[opt.value]} ring-2 ring-offset-1 ring-current`
                      : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Target Branch IDs */}
          <div>
            <label className="block mb-1 text-sm font-medium text-gray-700">
              สาขาเป้าหมาย <span className="text-xs text-gray-400">(ID คั่นด้วย , เว้นว่าง = ทุกสาขา)</span>
            </label>
            <input
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-400"
              placeholder="เช่น 1, 2, 5"
              value={form.branchIds}
              onChange={(e) => setForm((p) => ({ ...p, branchIds: e.target.value }))}
            />
          </div>
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 pb-6">
          <Button
            variant="outline"
            onClick={() => setEditTarget(null)}
          >
            ยกเลิก
          </Button>
          <Button
            className="text-white bg-orange-500 hover:bg-orange-600"
            onClick={isEdit ? handleUpdate : handleCreate}
            disabled={loadingAction === 'saving'}
          >
            {loadingAction === 'saving' ? (
              <span className="flex items-center gap-2">
                <span className="w-4 h-4 border-2 border-white rounded-full border-t-transparent animate-spin" />
                กำลังบันทึก...
              </span>
            ) : isEdit ? 'บันทึกการแก้ไข' : 'สร้างประกาศ'}
          </Button>
        </div>
      </div>
    </div>
  );

  // ───────────────────────────────────────────────────────────────
  // Render
  // ───────────────────────────────────────────────────────────────
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
            onClick={() => setActiveTab(tab)}
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
        <div className="space-y-3">
          {filtered.map((a) => (
            <AnnouncementCard key={a.announcementId} a={a} />
          ))}
        </div>
      )}

      {/* ── Modals ── */}

      {/* Create Modal */}
      {editTarget === 'new' && renderFormModal(false)}

      {/* Edit Modal */}
      {editTarget && editTarget !== 'new' && renderFormModal(true)}

      {/* View Recipients Modal */}
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

      {/* Send Confirm Modal */}
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

      {/* Delete Confirm Modal */}
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
              <label className="block mb-1 text-sm font-medium text-gray-700">
                เหตุผลในการลบ <span className="text-red-500">*</span>
              </label>
              <input
                className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-red-400"
                placeholder="ระบุเหตุผล..."
                value={deleteReason}
                onChange={(e) => setDeleteReason(e.target.value)}
              />
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

      {/* Alert */}
      <AlertDialog {...alert} onClose={closeAlert} />
    </div>
  );
}
