'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ClipboardList, Search, RefreshCw } from 'lucide-react';
import auditService from '@/services/audit';
import { AuditLog } from '@/types/audit';

function formatThaiDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString('th-TH', {
    timeZone: 'Asia/Bangkok',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function actionColor(action: string): string {
  if (action.includes('DELETE') || action.includes('REJECT')) return 'bg-red-100 text-red-700';
  if (action.includes('CREATE') || action.includes('APPROVE') || action.includes('CHECK_IN')) return 'bg-green-100 text-green-700';
  if (action.includes('UPDATE') || action.includes('CHECK_OUT')) return 'bg-amber-100 text-amber-700';
  return 'bg-slate-100 text-slate-700';
}

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [actions, setActions] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [actionFilter, setActionFilter] = useState('');
  const [tableFilter, setTableFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [fetchedActions, fetchedLogs] = await Promise.all([
        auditService.getActions(),
        auditService.getLogs({
          action: actionFilter || undefined,
          targetTable: tableFilter || undefined,
          startDate: startDate || undefined,
          endDate: endDate || undefined,
          limit: 200,
        }),
      ]);

      setActions(fetchedActions);
      setLogs(fetchedLogs);
    } catch (error) {
      console.error('Failed to load audit logs', error);
      alert('โหลด Audit Log ไม่สำเร็จ');
    } finally {
      setLoading(false);
    }
  }, [actionFilter, tableFilter, startDate, endDate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const tableOptions = useMemo(() => {
    return Array.from(new Set(logs.map((x) => x.targetTable))).sort();
  }, [logs]);

  const filteredLogs = useMemo(() => {
    if (!search) return logs;
    const q = search.toLowerCase();
    return logs.filter((log) => {
      const userName = `${log.user?.firstName ?? ''} ${log.user?.lastName ?? ''}`.toLowerCase();
      const employeeId = (log.user?.employeeId ?? '').toLowerCase();
      const action = log.action.toLowerCase();
      const target = `${log.targetTable} ${log.targetId}`.toLowerCase();
      return userName.includes(q) || employeeId.includes(q) || action.includes(q) || target.includes(q);
    });
  }, [logs, search]);

  return (
    <div className="min-h-screen p-4 bg-slate-50 sm:p-6">
      <Card className="p-6 border border-orange-100 shadow-sm">
        <div className="flex flex-col gap-4 mb-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-800">
              <ClipboardList className="w-6 h-6 text-gray-700" />
              <span>Audit Log</span>
            </h1>
            <p className="text-sm text-gray-500">ดูประวัติการทำงานของระบบรวมทุกโมดูล</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-orange-600 border-orange-300 bg-orange-50">
              {filteredLogs.length} รายการ
            </Badge>
            <Button variant="outline" onClick={loadData} className="gap-2">
              <RefreshCw className="w-4 h-4" />
              รีเฟรช
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 mb-6 md:grid-cols-2 xl:grid-cols-5">
          <div className="relative">
            <Search className="absolute w-4 h-4 text-gray-400 left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="ค้นหา user, action, table, id"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full py-2 pl-9 pr-3 text-sm border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
            />
          </div>

          <select
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
            className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
          >
            <option value="">ทุก action</option>
            {actions.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>

          <select
            value={tableFilter}
            onChange={(e) => setTableFilter(e.target.value)}
            className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
          >
            <option value="">ทุกตาราง</option>
            {tableOptions.map((table) => (
              <option key={table} value={table}>{table}</option>
            ))}
          </select>

          <input
            type="date"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
          />

          <input
            type="date"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            className="w-full px-3 py-2 text-sm border-2 border-gray-200 rounded-xl focus:border-orange-500 focus:outline-none"
          />
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="w-8 h-8 border-4 border-orange-500 rounded-full animate-spin border-t-transparent" />
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-10 text-center text-gray-500">ไม่พบข้อมูล Audit Log ตามเงื่อนไข</div>
        ) : (
          <div className="overflow-x-auto border rounded-xl bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-100 text-slate-700">
                <tr>
                  <th className="px-3 py-2 text-left">เวลา</th>
                  <th className="px-3 py-2 text-left">ผู้ใช้งาน</th>
                  <th className="px-3 py-2 text-left">Action</th>
                  <th className="px-3 py-2 text-left">ตาราง/ID</th>
                  <th className="px-3 py-2 text-left">IP</th>
                </tr>
              </thead>
              <tbody>
                {filteredLogs.map((log) => (
                  <tr key={log.logId} className="border-t border-gray-100 hover:bg-orange-50/40">
                    <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{formatThaiDateTime(log.createdAt)}</td>
                    <td className="px-3 py-2">
                      <div className="font-medium text-gray-800">
                        {log.user ? `${log.user.firstName} ${log.user.lastName}` : 'SYSTEM'}
                      </div>
                      <div className="text-xs text-gray-500">{log.user?.employeeId ?? '-'}</div>
                    </td>
                    <td className="px-3 py-2">
                      <Badge className={`${actionColor(log.action)} border-0`}>{log.action}</Badge>
                    </td>
                    <td className="px-3 py-2 text-gray-700">
                      {log.targetTable} / {log.targetId}
                    </td>
                    <td className="px-3 py-2 text-gray-500">{log.ipAddress ?? '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
