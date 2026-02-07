"use client";

import { User, AttendanceEditData, AttendanceCheckData } from "@/types/user";
import { Badge } from "@/components/ui/badge";

interface UserTableProps {
  users: User[];
  onSelectUser: (user: User) => void;
  getStatusBadge: (status: string) => string;
  currentUser: User | null;
  onAttendanceEdit?: (editData: AttendanceEditData | null) => void;
  onSaveAttendanceEdit?: () => void;
  editingAttendance?: AttendanceEditData | null;
  attendanceForm?: Partial<AttendanceCheckData>;
  onAttendanceFormChange?: (form: Partial<AttendanceCheckData>) => void;
}

export default function UserTable({ 
  users, 
  onSelectUser,
  currentUser
}: UserTableProps) {
  const getStatusVariant = (status: string): "active" | "suspend" | "pending" | "leave" | "default" => {
    const statusLower = status.toLowerCase();
    if (statusLower === 'active') return 'active';
    if (statusLower === 'suspended') return 'suspend';
    if (statusLower === 'pending') return 'pending';
    if (statusLower === 'leave') return 'leave';
    return 'default';
  };

  const getBranchBadgeColor = (branch: string): string => {
    const branchMap: Record<string, string> = {
      'BKK': 'bg-blue-100 text-blue-700',
      'CNX': 'bg-purple-100 text-purple-700',
      'PKT': 'bg-teal-100 text-teal-700'
    };
    return branchMap[branch] || 'bg-gray-100 text-gray-700';
  };

  return (
    <div className="overflow-x-auto border border-gray-200 rounded-xl">
      <table className="min-w-full divide-y divide-gray-200">
        <thead className="bg-gray-50">
          <tr>
            <th className="px-6 py-3 text-xs font-semibold tracking-wider text-left text-gray-700 uppercase">
              ชื่อ-นามสกุล
            </th>
            <th className="px-6 py-3 text-xs font-semibold tracking-wider text-left text-gray-700 uppercase">
              รหัสพนักงาน
            </th>
            <th className="px-6 py-3 text-xs font-semibold tracking-wider text-left text-gray-700 uppercase">
              แผนก
            </th>
            <th className="px-6 py-3 text-xs font-semibold tracking-wider text-left text-gray-700 uppercase">
              ตำแหน่ง
            </th>
            <th className="px-6 py-3 text-xs font-semibold tracking-wider text-left text-gray-700 uppercase">
              สาขา
            </th>
            <th className="px-6 py-3 text-xs font-semibold tracking-wider text-left text-gray-700 uppercase">
              สถานะ
            </th>
            <th className="px-6 py-3 text-xs font-semibold tracking-wider text-left text-gray-700 uppercase">
              บทบาท
            </th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-200">
          {users.length === 0 ? (
            <tr>
              <td colSpan={7} className="px-6 py-12 text-center text-gray-500">
                <div className="flex flex-col items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" className="w-12 h-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                  </svg>
                  <p className="text-sm">ไม่พบผู้ใช้งานในระบบ</p>
                </div>
              </td>
            </tr>
          ) : (
            users.map((user) => {
              const userBranch = user.branch || user.provinceCode || user.employeeId?.substring(0, 3) || 'N/A';
              
              return (
                <tr
                  key={user.id}
                  onClick={() => onSelectUser(user)}
                  className="transition-colors cursor-pointer hover:bg-gray-50"
                >
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-3">
                      <div className="flex-shrink-0 w-10 h-10">
                        {user.profileImage ? (
                          <img
                            src={user.profileImage}
                            alt={user.name}
                            className="w-10 h-10 rounded-full"
                          />
                        ) : (
                          <div className="flex items-center justify-center w-10 h-10 font-semibold text-white rounded-full bg-gradient-to-br from-orange-400 to-orange-600">
                            {user.name.charAt(0).toUpperCase()}
                          </div>
                        )}
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-gray-900">{user.name}</div>
                        <div className="text-xs text-gray-500">{user.email}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-900 whitespace-nowrap">
                    {user.employeeId}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700 whitespace-nowrap">
                    {user.department}
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700 whitespace-nowrap">
                    {user.position}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-2 py-1 text-xs font-semibold rounded-lg ${getBranchBadgeColor(userBranch)}`}>
                      {userBranch}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <Badge variant={getStatusVariant(user.status)}>
                      {user.status}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-700 capitalize whitespace-nowrap">
                    {user.role}
                  </td>
                </tr>
              );
            })
          )}
        </tbody>
      </table>
    </div>
  );
}
