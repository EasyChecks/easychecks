'use client';

import { useState, useEffect, useMemo, useCallback, lazy, Suspense } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { LeaveQuotaSettings, LeaveType, LEAVE_TYPE_DESCRIPTIONS } from '@/types/leave';
import { userService } from '@/services/user';
import { leaveQuotaService, LeaveQuotaScope, LeaveQuotaEffectiveItem, LeaveQuotaOverride } from '@/services/leaveQuotaService';
import { User } from '@/types/user';

const EditModal = lazy(() => import('@/components/admin/LeaveQuotaEditModal'));
const SuccessDialog = lazy(() => import('@/components/common/AlertDialog').then(mod => ({ default: mod.default })));

const QUOTA_PAGE_SIZE = 12;
const TARGET_PAGE_SIZE = 12;

const branchNames: Record<string, string> = {
  BKK: 'กรุงเทพมหานคร',
  CNX: 'เชียงใหม่',
  PKT: 'ภูเก็ต',
};

const scopeLabels: Record<LeaveQuotaScope, string> = {
  GLOBAL: 'โควต้าทั่วไป',
  BRANCH: 'รายสาขา',
  DEPARTMENT: 'รายแผนก',
  USER: 'รายบุคคล',
};

function formatQuotaValue(value: number | null | undefined): string {
  if (value === null || value === undefined) return 'ไม่จำกัด';
  return `${value} วัน`;
}

function getTargetKeyFromOverride(override: LeaveQuotaOverride): string {
  if (override.scope === 'USER') return String(override.userId ?? '');
  if (override.scope === 'DEPARTMENT') return String(override.department ?? '');
  if (override.scope === 'BRANCH') return String(override.branchCode ?? '');
  return 'GLOBAL';
}

export default function LeaveQuotaManagementPage() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'superadmin';
  const adminBranchCode = useMemo(() => {
    if (!user) return null;
    return user.branchCode || user.branch || user.provinceCode || null;
  }, [user]);

  const [allUsers, setAllUsers] = useState<User[]>([]);

  const [activeTab, setActiveTab] = useState<'global' | 'individual'>('global');
  const [scope, setScope] = useState<LeaveQuotaScope>('USER');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedDepartment, setSelectedDepartment] = useState<string | null>(null);
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [onlyHasOverride, setOnlyHasOverride] = useState(false);

  const [quotaItems, setQuotaItems] = useState<LeaveQuotaEffectiveItem[]>([]);
  const [quotaOverrides, setQuotaOverrides] = useState<Record<string, LeaveQuotaOverride>>({});
  const [overrideTargets, setOverrideTargets] = useState<{ USER: Set<string>; DEPARTMENT: Set<string>; BRANCH: Set<string> }>({
    USER: new Set(),
    DEPARTMENT: new Set(),
    BRANCH: new Set(),
  });

  const [editingType, setEditingType] = useState<LeaveType | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [loadingQuota, setLoadingQuota] = useState(false);

  const [quotaPage, setQuotaPage] = useState(1);
  const [targetPage, setTargetPage] = useState(1);

  useEffect(() => {
    userService.getManageUsers(user!, { limit: 500 })
      .then(res => setAllUsers(res.users))
      .catch(() => {})
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const refreshOverrideTargets = useCallback(async () => {
    try {
      const [userOverrides, deptOverrides, branchOverrides] = await Promise.all([
        leaveQuotaService.getOverridesByScope('USER'),
        leaveQuotaService.getOverridesByScope('DEPARTMENT'),
        leaveQuotaService.getOverridesByScope('BRANCH'),
      ]);
      const userSet = new Set(userOverrides.map(getTargetKeyFromOverride).filter(Boolean));
      const deptSet = new Set(deptOverrides.map(getTargetKeyFromOverride).filter(Boolean));
      const branchSet = new Set(branchOverrides.map(getTargetKeyFromOverride).filter(Boolean));
      setOverrideTargets({ USER: userSet, DEPARTMENT: deptSet, BRANCH: branchSet });
    } catch {
      // ignore
    }
  }, []);

  useEffect(() => {
    refreshOverrideTargets();
  }, [refreshOverrideTargets]);

  const departments = useMemo(() =>
    [...new Set(allUsers.map(u => u.department).filter(Boolean))] as string[],
    [allUsers]
  );

  const branches = useMemo(() =>
    [...new Set(allUsers.map(u => u.provinceCode || u.branch).filter(Boolean))] as string[],
    [allUsers]
  );

  const selectedUser = useMemo(() =>
    selectedUserId ? allUsers.find(u => u.id === selectedUserId) : null,
    [selectedUserId, allUsers]
  );

  const filteredUsers = useMemo(() => {
    let result = allUsers;

    if (isSuperAdmin && filterBranch) {
      result = result.filter(u => (u.provinceCode || u.branch) === filterBranch);
    }

    if (filterDepartment) {
      result = result.filter(u => u.department === filterDepartment);
    }

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(u =>
        u.name.toLowerCase().includes(query) ||
        u.employeeId.toLowerCase().includes(query)
      );
    }

    if (onlyHasOverride) {
      result = result.filter(u => overrideTargets.USER.has(String(u.id)));
    }

    return result;
  }, [allUsers, filterBranch, filterDepartment, searchQuery, onlyHasOverride, overrideTargets.USER, isSuperAdmin]);

  const filteredDepartments = useMemo(() => {
    let result = departments;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(dept => dept.toLowerCase().includes(query));
    }

    if (onlyHasOverride) {
      result = result.filter(dept => overrideTargets.DEPARTMENT.has(dept));
    }

    return result;
  }, [departments, searchQuery, onlyHasOverride, overrideTargets.DEPARTMENT]);

  const filteredBranches = useMemo(() => {
    let result = branches;

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(branch => branch.toLowerCase().includes(query));
    }

    if (onlyHasOverride) {
      result = result.filter(branch => overrideTargets.BRANCH.has(branch));
    }

    return result;
  }, [branches, searchQuery, onlyHasOverride, overrideTargets.BRANCH]);

  const quotaTotalPages = Math.max(1, Math.ceil(quotaItems.length / QUOTA_PAGE_SIZE));
  const pagedQuotaItems = useMemo(() => {
    const start = (quotaPage - 1) * QUOTA_PAGE_SIZE;
    return quotaItems.slice(start, start + QUOTA_PAGE_SIZE);
  }, [quotaItems, quotaPage]);

  const targetList = useMemo(() => {
    if (scope === 'DEPARTMENT') return filteredDepartments;
    if (scope === 'BRANCH') return filteredBranches;
    return filteredUsers;
  }, [scope, filteredDepartments, filteredBranches, filteredUsers]);

  const targetTotalPages = Math.max(1, Math.ceil(targetList.length / TARGET_PAGE_SIZE));
  const pagedTargets = useMemo(() => {
    const start = (targetPage - 1) * TARGET_PAGE_SIZE;
    return targetList.slice(start, start + TARGET_PAGE_SIZE);
  }, [targetList, targetPage]);

  useEffect(() => {
    if (quotaPage > quotaTotalPages) setQuotaPage(quotaTotalPages);
  }, [quotaPage, quotaTotalPages]);

  useEffect(() => {
    if (targetPage > targetTotalPages) setTargetPage(targetTotalPages);
  }, [targetPage, targetTotalPages]);

  useEffect(() => {
    setQuotaPage(1);
  }, [activeTab, scope, selectedUserId, selectedDepartment, selectedBranch]);

  useEffect(() => {
    setTargetPage(1);
  }, [scope, searchQuery, filterDepartment, filterBranch, onlyHasOverride]);

  const resolveTargetParams = useCallback(() => {
    if (activeTab === 'global') {
      if (isSuperAdmin) return { scope: 'GLOBAL' as LeaveQuotaScope };
      if (adminBranchCode) return { scope: 'BRANCH' as LeaveQuotaScope, branchCode: adminBranchCode };
      return null;
    }

    if (scope === 'USER' && selectedUserId) {
      return { scope, userId: Number(selectedUserId) };
    }
    if (scope === 'DEPARTMENT' && selectedDepartment) {
      return { scope, department: selectedDepartment };
    }
    if (scope === 'BRANCH' && selectedBranch) {
      return { scope, branchCode: selectedBranch };
    }

    return null;
  }, [activeTab, scope, selectedUserId, selectedDepartment, selectedBranch, isSuperAdmin, adminBranchCode]);

  const loadQuotaData = useCallback(async () => {
    const targetParams = resolveTargetParams();
    if (!targetParams) {
      setQuotaItems([]);
      setQuotaOverrides({});
      return;
    }

    setLoadingQuota(true);
    try {
      const [effective, overrides] = await Promise.all([
        leaveQuotaService.getEffectiveQuotas(targetParams),
        leaveQuotaService.getOverrides(targetParams),
      ]);

      const overrideMap: Record<string, LeaveQuotaOverride> = {};
      overrides.forEach((override) => {
        overrideMap[override.leaveType] = override;
      });

      setQuotaItems(effective);
      setQuotaOverrides(overrideMap);
    } catch {
      setQuotaItems([]);
      setQuotaOverrides({});
    } finally {
      setLoadingQuota(false);
    }
  }, [resolveTargetParams]);

  useEffect(() => {
    loadQuotaData();
  }, [loadQuotaData]);

  const handleSave = useCallback(async (leaveType: LeaveType, settings: LeaveQuotaSettings) => {
    const targetParams = resolveTargetParams();
    if (!targetParams) return;
    const displayName = quotaItems.find(q => q.leaveType === leaveType)?.displayName ?? leaveType;

    try {
      await leaveQuotaService.saveOverride({
        ...targetParams,
        leaveType,
        ...settings,
      });
      setSuccessMsg(`บันทึกโควต้า ${displayName} เรียบร้อยแล้ว`);
      setShowSuccess(true);
      setEditingType(null);
      await loadQuotaData();
      await refreshOverrideTargets();
    } catch {
      setSuccessMsg('ไม่สามารถบันทึกโควต้าได้');
      setShowSuccess(true);
    }

    setTimeout(() => setShowSuccess(false), 2000);
  }, [resolveTargetParams, loadQuotaData, refreshOverrideTargets]);

  const handleReset = useCallback(async (leaveType: LeaveType) => {
    const targetParams = resolveTargetParams();
    if (!targetParams) return;
    const displayName = quotaItems.find(q => q.leaveType === leaveType)?.displayName ?? leaveType;

    try {
      await leaveQuotaService.deleteOverride({ ...targetParams, leaveType });
      setSuccessMsg(`รีเซ็ตโควต้า ${displayName} สำเร็จแล้ว`);
      setShowSuccess(true);
      await loadQuotaData();
      await refreshOverrideTargets();
    } catch {
      setSuccessMsg('ไม่สามารถรีเซ็ตโควต้าได้');
      setShowSuccess(true);
    }

    setTimeout(() => setShowSuccess(false), 2000);
  }, [resolveTargetParams, loadQuotaData, refreshOverrideTargets]);

  const handleScopeChange = (value: LeaveQuotaScope) => {
    setScope(value);
    setSelectedUserId(null);
    setSelectedDepartment(null);
    setSelectedBranch(null);
    setSearchQuery('');
    setFilterDepartment('');
    setFilterBranch('');
  };

  return (
    <div className="min-h-screen space-y-4 px-4 pb-6 pt-4 sm:px-5">
      <Card className="p-5 bg-linear-to-r from-orange-500 to-orange-600 text-white border-none shadow-lg">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg">
            <svg xmlns="http://www.w3.org/2000/svg" height="32px" viewBox="0 -960 960 960" width="32px" fill="white">
              <path d="M320-240h320v-80H320v80Zm0-160h320v-80H320v80ZM240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h320l240 240v480q0 33-23.5 56.5T720-80H240Zm280-520v-200H240v640h480v-440H520Z"/>
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold mb-1">จัดการโควต้าการลา</h1>
            <p className="text-white/90 text-sm">กำหนดเงื่อนไขและจำนวนวันลาให้ตรงกับนโยบายองค์กร</p>
          </div>
        </div>
      </Card>

      <Card className="p-2 border-2 border-gray-200">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'global' | 'individual')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="global" onClick={() => setScope('USER')}>โควต้าทั่วไป</TabsTrigger>
            <TabsTrigger value="individual">รายบุคคล / รายแผนก{isSuperAdmin ? ' / รายสาขา' : ''}</TabsTrigger>
          </TabsList>

          <TabsContent value="global" className="mt-3 space-y-3">
            {!isSuperAdmin && !adminBranchCode && (
              <Card className="p-3 border-2 border-red-200 bg-red-50">
                <p className="text-sm text-red-600">ไม่พบสาขาของผู้ดูแลระบบ จึงไม่สามารถโหลดโควต้าได้</p>
              </Card>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {quotaItems.map((quota) => {
                const isCustom = Boolean(quotaOverrides[quota.leaveType]);
                return (
                  <Card key={quota.leaveType} className={`overflow-hidden ${isCustom ? 'ring-2 ring-orange-500 ring-offset-2' : 'border-2 border-gray-200'}`}>
                    <div className="p-3 space-y-2">
                      <div>
                        <h3 className="text-lg font-bold text-gray-800">{quota.displayName}</h3>
                        <p className="text-xs text-gray-600 line-clamp-2">{LEAVE_TYPE_DESCRIPTIONS[quota.leaveType]}</p>
                      </div>
                      <div className="space-y-2 text-sm text-gray-700">
                        <div className="flex justify-between">
                          <span>โควต้ารวม/ปี</span>
                          <span className="font-semibold text-orange-600">{formatQuotaValue(quota.rules.maxDaysPerYear)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>โควต้าได้รับค่าจ้าง/ปี</span>
                          <span className="font-semibold text-orange-600">{formatQuotaValue(quota.rules.maxPaidDaysPerYear)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>สูงสุดต่อครั้ง</span>
                          <span className="font-semibold">{formatQuotaValue(quota.rules.maxDaysTotal)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span>เอกสาร</span>
                          <span className="font-semibold">
                            {quota.rules.requireDocument
                              ? (quota.rules.documentAfterDays > 0 ? `แนบเมื่อ ${quota.rules.documentAfterDays} วันขึ้นไป` : 'แนบทุกครั้ง')
                              : 'ไม่ต้องแนบ'}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span>สถานะค่าจ้าง</span>
                          <span className={`font-semibold ${quota.rules.paid ? 'text-green-600' : 'text-gray-500'}`}>
                            {quota.rules.paid ? 'ได้รับค่าจ้าง' : 'ไม่ได้รับค่าจ้าง'}
                          </span>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button className="flex-1 bg-orange-500 hover:bg-orange-600" onClick={() => setEditingType(quota.leaveType)}>
                          แก้ไข
                        </Button>
                        {isCustom && (
                          <Button variant="outline" className="flex-1" onClick={() => handleReset(quota.leaveType)}>
                            รีเซ็ต
                          </Button>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          </TabsContent>

          <TabsContent value="individual" className="mt-3 space-y-3">
            <Card className="p-3 border-2 border-gray-200 space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-gray-700">ขอบเขต:</span>
                {((isSuperAdmin ? ['USER', 'DEPARTMENT', 'BRANCH'] : ['USER', 'DEPARTMENT']) as LeaveQuotaScope[]).map((value) => (
                  <Button
                    key={value}
                    variant={scope === value ? 'default' : 'outline'}
                    className={scope === value ? 'bg-orange-500 hover:bg-orange-600' : ''}
                    onClick={() => handleScopeChange(value)}
                  >
                    {scopeLabels[value]}
                  </Button>
                ))}
              </div>

              <p className="text-sm font-semibold text-gray-700">ตัวกรองขั้นสูง</p>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2">
                <div className="md:col-span-2">
                  <label className="block text-xs font-semibold text-gray-600 mb-1">ค้นหา</label>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ค้นหาชื่อ รหัส หรือคำที่เกี่ยวข้อง"
                    className="w-full px-3 py-2 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none"
                  />
                </div>
                {scope === 'USER' && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">แผนก</label>
                    <div className="relative">
                      <select
                        value={filterDepartment}
                        onChange={(e) => setFilterDepartment(e.target.value)}
                        className="w-full pl-3 pr-10 py-2 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none appearance-none bg-white"
                      >
                        <option value="">ทุกแผนก</option>
                        {departments.map((dept) => (
                          <option key={dept} value={dept}>{dept}</option>
                        ))}
                      </select>
                      <svg
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                )}
                {scope === 'USER' && isSuperAdmin && (
                  <div>
                    <label className="block text-xs font-semibold text-gray-600 mb-1">สาขา</label>
                    <div className="relative">
                      <select
                        value={filterBranch}
                        onChange={(e) => setFilterBranch(e.target.value)}
                        className="w-full pl-3 pr-10 py-2 border-2 border-gray-200 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none appearance-none bg-white"
                      >
                        <option value="">ทุกสาขา</option>
                        {branches.map((branch) => (
                          <option key={branch} value={branch}>{branch} {branchNames[branch] ? `(${branchNames[branch]})` : ''}</option>
                        ))}
                      </select>
                      <svg
                        className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                      </svg>
                    </div>
                  </div>
                )}
              </div>

              <label className="flex items-center gap-2 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={onlyHasOverride}
                  onChange={(e) => setOnlyHasOverride(e.target.checked)}
                  className="w-4 h-4 text-orange-500 border-gray-300 rounded"
                />
                แสดงเฉพาะที่มีโควต้าพิเศษ
              </label>
            </Card>

            <Card className="p-3 border-2 border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-semibold text-gray-800">เลือก {scopeLabels[scope]}</p>
                  <p className="text-xs text-gray-500">แสดงผล 12 รายการต่อหน้า</p>
                </div>
                <Badge className="bg-orange-100 text-orange-700">{targetList.length} รายการ</Badge>
              </div>

              {scope === 'USER' && (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
                  {pagedTargets.map((target) => {
                    const userItem = target as User;
                    const isSelected = selectedUserId === userItem.id;
                    return (
                      <button
                        key={userItem.id}
                        onClick={() => setSelectedUserId(userItem.id)}
                        className={`p-3 rounded-lg border-2 text-left transition-all ${
                          isSelected ? 'bg-orange-50 border-orange-300 shadow-sm' : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <p className="font-semibold text-gray-800 text-sm">{userItem.name}</p>
                        <p className="text-xs text-gray-500">{userItem.employeeId} • {userItem.department}</p>
                        {(overrideTargets.USER.has(String(userItem.id))) && (
                          <Badge className="mt-2 bg-orange-100 text-orange-700">โควต้าพิเศษ</Badge>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}

              {scope === 'DEPARTMENT' && (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
                  {(pagedTargets as string[]).map((dept) => (
                    <button
                      key={dept}
                      onClick={() => setSelectedDepartment(dept)}
                      className={`p-3 rounded-lg border-2 text-left transition-all ${
                        selectedDepartment === dept ? 'bg-orange-50 border-orange-300 shadow-sm' : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <p className="font-semibold text-gray-800 text-sm">{dept}</p>
                      {overrideTargets.DEPARTMENT.has(dept) && (
                        <Badge className="mt-2 bg-orange-100 text-orange-700">โควต้าพิเศษ</Badge>
                      )}
                    </button>
                  ))}
                </div>
              )}

              {scope === 'BRANCH' && (
                <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-2">
                  {(pagedTargets as string[]).map((branch) => (
                    <button
                      key={branch}
                      onClick={() => setSelectedBranch(branch)}
                      className={`p-3 rounded-lg border-2 text-left transition-all ${
                        selectedBranch === branch ? 'bg-orange-50 border-orange-300 shadow-sm' : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                      }`}
                    >
                      <p className="font-semibold text-gray-800 text-sm">{branch}</p>
                      <p className="text-xs text-gray-500">{branchNames[branch] ?? ''}</p>
                      {overrideTargets.BRANCH.has(branch) && (
                        <Badge className="mt-2 bg-orange-100 text-orange-700">โควต้าพิเศษ</Badge>
                      )}
                    </button>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-gray-500">หน้า {targetPage} / {targetTotalPages}</p>
                <div className="flex gap-2">
                  <Button variant="outline" disabled={targetPage <= 1} onClick={() => setTargetPage(prev => Math.max(1, prev - 1))}>
                    ก่อนหน้า
                  </Button>
                  <Button variant="outline" disabled={targetPage >= targetTotalPages} onClick={() => setTargetPage(prev => Math.min(targetTotalPages, prev + 1))}>
                    ถัดไป
                  </Button>
                </div>
              </div>
            </Card>

            <Card className="p-3 border-2 border-gray-200">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <p className="text-sm font-semibold text-gray-800">โควต้าที่ใช้กับ {scopeLabels[scope]}</p>
                  <p className="text-xs text-gray-500">เลือกเป้าหมายแล้วจึงแก้ไขได้</p>
                </div>
              </div>

              {loadingQuota && (
                <div className="flex items-center justify-center py-10">
                  <div className="w-8 h-8 border-4 border-orange-500 rounded-full animate-spin border-t-transparent" />
                </div>
              )}

              {!loadingQuota && quotaItems.length === 0 && (
                <div className="text-center py-10 text-sm text-gray-500">กรุณาเลือกเป้าหมายเพื่อดูโควต้า</div>
              )}

              {!loadingQuota && quotaItems.length > 0 && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                  {pagedQuotaItems.map((quota) => {
                    const isCustom = Boolean(quotaOverrides[quota.leaveType]);
                    return (
                      <Card key={quota.leaveType} className={`overflow-hidden ${isCustom ? 'ring-2 ring-orange-500 ring-offset-2' : 'border-2 border-gray-200'}`}>
                        <div className="p-3 space-y-2">
                          <div>
                            <h3 className="text-lg font-bold text-gray-800">{quota.displayName}</h3>
                            <p className="text-xs text-gray-600 line-clamp-2">{LEAVE_TYPE_DESCRIPTIONS[quota.leaveType]}</p>
                          </div>
                          <div className="space-y-2 text-sm text-gray-700">
                            <div className="flex justify-between">
                              <span>โควต้ารวม/ปี</span>
                              <span className="font-semibold text-orange-600">{formatQuotaValue(quota.rules.maxDaysPerYear)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>โควต้าได้รับค่าจ้าง/ปี</span>
                              <span className="font-semibold text-orange-600">{formatQuotaValue(quota.rules.maxPaidDaysPerYear)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>สูงสุดต่อครั้ง</span>
                              <span className="font-semibold">{formatQuotaValue(quota.rules.maxDaysTotal)}</span>
                            </div>
                            <div className="flex justify-between">
                              <span>เอกสาร</span>
                              <span className="font-semibold">
                                {quota.rules.requireDocument
                                  ? (quota.rules.documentAfterDays > 0 ? `แนบเมื่อ ${quota.rules.documentAfterDays} วันขึ้นไป` : 'แนบทุกครั้ง')
                                  : 'ไม่ต้องแนบ'}
                              </span>
                            </div>
                            <div className="flex justify-between">
                              <span>สถานะค่าจ้าง</span>
                              <span className={`font-semibold ${quota.rules.paid ? 'text-green-600' : 'text-gray-500'}`}>
                                {quota.rules.paid ? 'ได้รับค่าจ้าง' : 'ไม่ได้รับค่าจ้าง'}
                              </span>
                            </div>
                          </div>
                          <div className="flex gap-2">
                            <Button className="flex-1 bg-orange-500 hover:bg-orange-600" onClick={() => setEditingType(quota.leaveType)}>
                              แก้ไข
                            </Button>
                            {isCustom && (
                              <Button variant="outline" className="flex-1" onClick={() => handleReset(quota.leaveType)}>
                                รีเซ็ต
                              </Button>
                            )}
                          </div>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}

            </Card>
          </TabsContent>
        </Tabs>
      </Card>

      <Suspense fallback={null}>
        {editingType && (
          <EditModal
            leaveType={editingType}
            currentSettings={quotaItems.find(q => q.leaveType === editingType)?.rules ?? {
              maxDaysPerYear: null,
              maxPaidDaysPerYear: null,
              maxDaysTotal: null,
              paid: false,
              requireDocument: false,
              documentAfterDays: 0,
            }}
            onSave={(settings) => handleSave(editingType, settings)}
            onCancel={() => setEditingType(null)}
            userName={selectedUser?.name}
          />
        )}
        {showSuccess && (
          <SuccessDialog
            isOpen={showSuccess}
            type="success"
            title="สำเร็จ"
            message={successMsg}
            onClose={() => setShowSuccess(false)}
            autoClose={true}
          />
        )}
      </Suspense>
    </div>
  );
}
