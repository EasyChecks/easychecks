'use client';

import { useState, useMemo, useCallback, lazy, Suspense } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useAuth } from '@/contexts/AuthContext';
import { DEFAULT_LEAVE_QUOTA, LEAVE_TYPE_DESCRIPTIONS, LeaveQuotaMap, LeaveQuotaSettings, LeaveType } from '@/types/leave';
import { User } from '@/types/user';

// Lazy load heavy modals
const EditModal = lazy(() => import('@/components/admin/LeaveQuotaEditModal'));
const SuccessDialog = lazy(() => import('@/components/common/AlertDialog').then(mod => ({ default: mod.default })));

// Mock users data (would come from API in real app)
const mockUsers: User[] = [
  { id: '1', employeeId: 'BKK001', name: 'สมชาย ใจดี', department: 'IT', provinceCode: 'BKK', role: 'user', status: 'active', email: '', username: '' },
  { id: '2', employeeId: 'BKK002', name: 'สมหญิง รักงาน', department: 'HR', provinceCode: 'BKK', role: 'user', status: 'active', email: '', username: '' },
  { id: '3', employeeId: 'CNX001', name: 'สมปอง ขยัน', department: 'IT', provinceCode: 'CNX', role: 'user', status: 'active', email: '', username: '' },
];

const branchNames: Record<string, string> = {
  'BKK': 'กรุงเทพมหานคร',
  'CNX': 'เชียงใหม่',
  'PKT': 'ภูเก็ต'
};

export default function LeaveQuotaManagement() {
  const { user } = useAuth();
  const isSuperAdmin = user?.role === 'superadmin';
  
  // Core state only
  const [activeTab, setActiveTab] = useState<'global' | 'individual'>('global');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterDepartment, setFilterDepartment] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [editingType, setEditingType] = useState<LeaveType | null>(null);
  const [showSuccess, setShowSuccess] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');

  // Load from localStorage (only once)
  const [quotaSettings, setQuotaSettings] = useState<LeaveQuotaMap>(() => {
    if (typeof window === 'undefined') return DEFAULT_LEAVE_QUOTA;
    const saved = localStorage.getItem('leaveQuotaSettings');
    return saved ? JSON.parse(saved) : DEFAULT_LEAVE_QUOTA;
  });

  const [individualQuotas, setIndividualQuotas] = useState<Record<string, LeaveQuotaMap>>(() => {
    if (typeof window === 'undefined') return {};
    const saved = localStorage.getItem('individualLeaveQuotas');
    return saved ? JSON.parse(saved) : {};
  });

  // Derived values with useMemo
  const selectedUser = useMemo(() => 
    selectedUserId ? mockUsers.find(u => u.id === selectedUserId) : null,
    [selectedUserId]
  );

  const filteredUsers = useMemo(() => {
    let result = mockUsers;
    
    if (isSuperAdmin && filterBranch) {
      result = result.filter(u => u.provinceCode === filterBranch);
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
    
    return result;
  }, [filterBranch, filterDepartment, searchQuery, isSuperAdmin]);

  const departments = useMemo(() => 
    [...new Set(mockUsers.map(u => u.department))].filter(Boolean),
    []
  );

  const branches = useMemo(() => 
    [...new Set(mockUsers.map(u => u.provinceCode))].filter(Boolean).sort(),
    []
  );

  // Optimized handlers
  const handleSave = useCallback((leaveType: LeaveType, settings: LeaveQuotaSettings) => {
    if (activeTab === 'global') {
      const newSettings = { ...quotaSettings, [leaveType]: settings };
      setQuotaSettings(newSettings);
      localStorage.setItem('leaveQuotaSettings', JSON.stringify(newSettings));
      setSuccessMsg(`บันทึกการตั้งค่า "${leaveType}" สำหรับทุกคนเรียบร้อยแล้ว`);
    } else if (selectedUser) {
      const newQuotas = {
        ...individualQuotas,
        [selectedUser.id]: {
          ...individualQuotas[selectedUser.id],
          [leaveType]: settings
        }
      };
      setIndividualQuotas(newQuotas);
      localStorage.setItem('individualLeaveQuotas', JSON.stringify(newQuotas));
      setSuccessMsg(`บันทึกการตั้งค่า "${leaveType}" สำหรับ ${selectedUser.name} เรียบร้อยแล้ว`);
    }
    
    setShowSuccess(true);
    setEditingType(null);
    setTimeout(() => setShowSuccess(false), 2000);
  }, [activeTab, quotaSettings, individualQuotas, selectedUser]);

  const handleResetToGlobal = useCallback((leaveType: LeaveType) => {
    if (!selectedUser) return;
    
    const newQuotas = { ...individualQuotas };
    if (newQuotas[selectedUser.id]) {
      delete newQuotas[selectedUser.id][leaveType];
      if (Object.keys(newQuotas[selectedUser.id]).length === 0) {
        delete newQuotas[selectedUser.id];
      }
    }
    
    setIndividualQuotas(newQuotas);
    localStorage.setItem('individualLeaveQuotas', JSON.stringify(newQuotas));
    setSuccessMsg(`รีเซ็ตโควต้า "${leaveType}" ของ ${selectedUser.name} กลับไปใช้ค่าเริ่มต้นแล้ว`);
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
  }, [selectedUser, individualQuotas]);

  const getDisplayQuota = useCallback((leaveType: LeaveType): LeaveQuotaSettings => {
    if (activeTab === 'individual' && selectedUser) {
      return individualQuotas[selectedUser.id]?.[leaveType] || quotaSettings[leaveType];
    }
    return quotaSettings[leaveType];
  }, [activeTab, selectedUser, individualQuotas, quotaSettings]);

  const hasCustomQuota = useCallback((leaveType: LeaveType): boolean => {
    return activeTab === 'individual' && !!selectedUser && !!individualQuotas[selectedUser.id]?.[leaveType];
  }, [activeTab, selectedUser, individualQuotas]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card className="p-6 bg-gradient-to-r from-orange-500 to-orange-600 text-white border-none shadow-lg">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg">
            <svg xmlns="http://www.w3.org/2000/svg" height="32px" viewBox="0 -960 960 960" width="32px" fill="white">
              <path d="M320-240h320v-80H320v80Zm0-160h320v-80H320v80ZM240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h320l240 240v480q0 33-23.5 56.5T720-80H240Zm280-520v-200H240v640h480v-440H520Z"/>
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold mb-1">จัดการโควต้าการลา</h1>
            <p className="text-white/90 text-sm">ตั้งค่าจำนวนวันลาและเงื่อนไขการลาสำหรับพนักงาน</p>
          </div>
        </div>
      </Card>

      {/* Tabs */}
      <Card className="p-2 border-2 border-gray-200">
        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'global' | 'individual')}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="global" onClick={() => setSelectedUserId(null)}>
              <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="currentColor" className="mr-2">
                <path d="M480-80q-83 0-156-31.5T197-197q-54-54-85.5-127T80-480q0-83 31.5-156T197-763q54-54 127-85.5T480-880q83 0 156 31.5T763-763q54 54 85.5 127T880-480q0 83-31.5 156T763-197q-54 54-127 85.5T480-80Z"/>
              </svg>
              โควต้าทั่วไป
            </TabsTrigger>
            <TabsTrigger value="individual">
              <svg xmlns="http://www.w3.org/2000/svg" height="20px" viewBox="0 -960 960 960" width="20px" fill="currentColor" className="mr-2">
                <path d="M480-480q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47ZM160-160v-112q0-34 17.5-62.5T224-378q62-31 126-46.5T480-440q66 0 130 15.5T736-378q29 15 46.5 43.5T800-272v112H160Z"/>
              </svg>
              รายบุคคล
            </TabsTrigger>
          </TabsList>

          <TabsContent value="individual" className="mt-4">
            <Card className="p-5 border-2 border-gray-200">
              <label className="block text-sm font-bold text-gray-700 mb-3">ค้นหาและเลือกพนักงาน</label>
              
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                {/* Search */}
                <div className={`${isSuperAdmin ? 'md:col-span-2' : 'md:col-span-3'} relative`}>
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="ค้นหาชื่อหรือรหัสพนักงาน..."
                    className="w-full pl-10 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none"
                  />
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>

                {/* Branch Filter */}
                {isSuperAdmin && (
                  <select
                    value={filterBranch}
                    onChange={(e) => setFilterBranch(e.target.value)}
                    className="px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none"
                  >
                    <option value="">สาขา: ทั้งหมด</option>
                    {branches.map(branch => (
                      <option key={branch} value={branch}>{branch} ({branchNames[branch]})</option>
                    ))}
                  </select>
                )}

                {/* Department Filter */}
                <select
                  value={filterDepartment}
                  onChange={(e) => setFilterDepartment(e.target.value)}
                  className="px-4 py-3 border-2 border-gray-300 rounded-lg focus:border-orange-500 focus:ring-2 focus:ring-orange-200 outline-none"
                >
                  <option value="">ทุกแผนก</option>
                  {departments.map(dept => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>

              {/* User List */}
              <div className="grid grid-cols-2 gap-3 max-h-64 overflow-y-auto">
                {filteredUsers.map(user => (
                  <button
                    key={user.id}
                    onClick={() => setSelectedUserId(user.id)}
                    className={`p-3 rounded-lg border-2 text-left transition-all ${
                      selectedUserId === user.id
                        ? 'bg-orange-50 border-orange-300 shadow-sm'
                        : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <p className="font-semibold text-gray-800 text-sm">{user.name}</p>
                    <p className="text-xs text-gray-500">{user.employeeId} • {user.department}</p>
                  </button>
                ))}
              </div>

              {selectedUser && individualQuotas[selectedUser.id] && Object.keys(individualQuotas[selectedUser.id]).length > 0 && (
                <div className="mt-4 p-4 bg-orange-50 border-l-4 border-orange-500 rounded-lg">
                  <p className="text-sm font-semibold text-gray-800">
                    มีโควต้าพิเศษ {Object.keys(individualQuotas[selectedUser.id]).length} ประเภท
                  </p>
                </div>
              )}
            </Card>
          </TabsContent>
        </Tabs>
      </Card>

      {/* Leave Type Cards */}
      {(activeTab === 'global' || (activeTab === 'individual' && selectedUser)) && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(Object.keys(quotaSettings) as LeaveType[]).map(leaveType => {
            const quota = getDisplayQuota(leaveType);
            const isCustom = hasCustomQuota(leaveType);
            
            return (
              <Card key={leaveType} className={`overflow-hidden ${isCustom ? 'ring-2 ring-orange-500 ring-offset-2' : 'border-2 border-gray-200'}`}>
                {isCustom && (
                  <div className="bg-orange-500 text-white text-xs font-bold px-3 py-1 text-center">
                    โควต้าพิเศษ
                  </div>
                )}

                <div className="p-4 border-b-2 border-gray-100 bg-gradient-to-br from-gray-50 to-white">
                  <h3 className="text-lg font-bold text-gray-800 mb-1">{leaveType}</h3>
                  <p className="text-xs text-gray-600 line-clamp-2">{LEAVE_TYPE_DESCRIPTIONS[leaveType]}</p>
                </div>

                <div className="p-4 space-y-3">
                  <div className="bg-gradient-to-r from-orange-50 to-orange-100 rounded-lg p-3 border border-orange-200">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-700">วันลาต่อปี</span>
                      <span className="text-2xl font-bold text-orange-600">{quota.totalDays}</span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3 bg-gray-50 rounded-lg p-3 border border-gray-200">
                    <div className={`w-8 h-8 ${quota.requireDocument ? 'bg-orange-500' : 'bg-gray-400'} rounded-lg flex items-center justify-center shadow-sm`}>
                      <svg xmlns="http://www.w3.org/2000/svg" height="16px" viewBox="0 -960 960 960" width="16px" fill="white">
                        <path d="M319-250h322v-60H319v60Zm0-170h322v-60H319v60ZM220-80q-24 0-42-18t-18-42v-680q0-24 18-42t42-18h361l219 219v521q0 24-18 42t-42 18H220Z"/>
                      </svg>
                    </div>
                    <p className="text-xs font-semibold text-gray-800 flex-1">
                      {quota.requireDocument 
                        ? (quota.documentAfterDays > 0 ? `แนบเมื่อลา ${quota.documentAfterDays} วันขึ้นไป` : 'แนบทุกครั้ง')
                        : 'ไม่บังคับ'
                      }
                    </p>
                  </div>
                </div>

                <div className="p-3 bg-gray-50 border-t-2 border-gray-100 flex gap-2">
                  <Button
                    onClick={() => setEditingType(leaveType)}
                    className="flex-1 bg-orange-500 hover:bg-orange-600"
                  >
                    แก้ไข
                  </Button>
                  {isCustom && (
                    <Button
                      onClick={() => handleResetToGlobal(leaveType)}
                      variant="outline"
                      className="px-3"
                      title="รีเซ็ตกลับไปใช้ค่าทั่วไป"
                    >
                      <svg xmlns="http://www.w3.org/2000/svg" height="18px" viewBox="0 -960 960 960" width="18px" fill="currentColor">
                        <path d="M480-160q-134 0-227-93t-93-227q0-134 93-227t227-93q69 0 132 28.5T720-690v-110h80v280H520v-80h168q-32-56-87.5-88T480-720q-100 0-170 70t-70 170q0 100 70 170t170 70q77 0 139-44t87-116h84q-28 106-114 173t-196 67Z"/>
                      </svg>
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {/* Empty State */}
      {activeTab === 'individual' && !selectedUser && (
        <Card className="p-12 text-center border-2 border-dashed border-gray-300">
          <div className="w-20 h-20 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <svg xmlns="http://www.w3.org/2000/svg" height="40px" viewBox="0 -960 960 960" width="40px" fill="#9ca3af">
              <path d="M480-480q-66 0-113-47t-47-113q0-66 47-113t113-47q66 0 113 47t47 113q0 66-47 113t-113 47ZM160-160v-112q0-34 17.5-62.5T224-378q62-31 126-46.5T480-440q66 0 130 15.5T736-378q29 15 46.5 43.5T800-272v112H160Z"/>
            </svg>
          </div>
          <h3 className="text-xl font-bold text-gray-700 mb-2">เลือกพนักงาน</h3>
          <p className="text-sm text-gray-500">กรุณาเลือกพนักงานที่ต้องการตั้งค่าโควต้าพิเศษ</p>
        </Card>
      )}

      {/* Modals - Lazy loaded */}
      <Suspense fallback={<div className="fixed inset-0 bg-black/20 backdrop-blur-sm z-50" />}>
        {editingType && (
          <EditModal
            leaveType={editingType}
            currentSettings={getDisplayQuota(editingType)}
            onSave={(settings) => handleSave(editingType, settings)}
            onCancel={() => setEditingType(null)}
            userName={activeTab === 'individual' ? selectedUser?.name : undefined}
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
