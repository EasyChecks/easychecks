'use client';

import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useAuth } from '@/contexts/AuthContext';

export default function ManagerDashboard() {
  const { user } = useAuth();

  return (
    <div className="space-y-6">
      {/* Welcome Card */}
      <Card className="p-6 bg-gradient-to-r from-purple-500 to-purple-600 text-white border-none shadow-lg">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 bg-white/20 backdrop-blur-sm rounded-xl flex items-center justify-center shadow-lg">
            <svg xmlns="http://www.w3.org/2000/svg" className="h-8 w-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold">สวัสดี, {user?.name}!</h1>
            <p className="text-white/90">{user?.position} • {user?.department}</p>
          </div>
        </div>
      </Card>

      {/* Team Overview */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="p-6 border-2 border-gray-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-blue-100 rounded-lg flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-600">สมาชิกทีม</p>
              <p className="text-2xl font-bold text-gray-800">15</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 border-2 border-gray-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-green-100 rounded-lg flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-600">เข้างานวันนี้</p>
              <p className="text-2xl font-bold text-gray-800">12</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 border-2 border-gray-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-amber-100 rounded-lg flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-600">มาสาย</p>
              <p className="text-2xl font-bold text-gray-800">2</p>
            </div>
          </div>
        </Card>

        <Card className="p-6 border-2 border-gray-200">
          <div className="flex items-center gap-3 mb-3">
            <div className="w-12 h-12 bg-purple-100 rounded-lg flex items-center justify-center">
              <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
            <div>
              <p className="text-sm text-gray-600">ลา/ขาด</p>
              <p className="text-2xl font-bold text-gray-800">3</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Pending Approvals */}
      <Card className="p-6 border-2 border-gray-200">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-gray-800">รออนุมัติ</h2>
          <Badge variant="pending">5 รายการ</Badge>
        </div>
        <div className="space-y-3">
          <div className="p-4 bg-amber-50 rounded-lg border border-amber-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center">
                  <span className="text-sm font-bold text-gray-600">SM</span>
                </div>
                <div>
                  <p className="font-semibold text-gray-800">สมชาย ใจดี</p>
                  <p className="text-sm text-gray-600">ขอลาป่วย 1 วัน</p>
                </div>
              </div>
              <Badge variant="pending">รออนุมัติ</Badge>
            </div>
            <div className="flex gap-2 mt-3">
              <button className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium text-sm transition-all">
                อนุมัติ
              </button>
              <button className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium text-sm transition-all">
                ปฏิเสธ
              </button>
            </div>
          </div>

          <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gray-200 rounded-lg flex items-center justify-center">
                  <span className="text-sm font-bold text-gray-600">SH</span>
                </div>
                <div>
                  <p className="font-semibold text-gray-800">สมหญิง รักงาน</p>
                  <p className="text-sm text-gray-600">ขอมาสาย 30 นาที</p>
                </div>
              </div>
              <Badge variant="pending">รออนุมัติ</Badge>
            </div>
            <div className="flex gap-2 mt-3">
              <button className="flex-1 px-4 py-2 bg-green-500 hover:bg-green-600 text-white rounded-lg font-medium text-sm transition-all">
                อนุมัติ
              </button>
              <button className="flex-1 px-4 py-2 bg-red-500 hover:bg-red-600 text-white rounded-lg font-medium text-sm transition-all">
                ปฏิเสธ
              </button>
            </div>
          </div>
        </div>
      </Card>

      {/* Team Attendance */}
      <Card className="p-6 border-2 border-gray-200">
        <h2 className="text-xl font-bold text-gray-800 mb-4">สถานะทีมวันนี้</h2>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b-2 border-gray-200">
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">พนักงาน</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">เช็คอิน</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">เช็คเอาท์</th>
                <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">สถานะ</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-gray-100">
                <td className="py-3 px-4">
                  <p className="font-medium text-gray-800">สมชาย ใจดี</p>
                  <p className="text-sm text-gray-600">IT Developer</p>
                </td>
                <td className="py-3 px-4 text-gray-700">08:05</td>
                <td className="py-3 px-4 text-gray-700">-</td>
                <td className="py-3 px-4">
                  <Badge variant="active">ทำงานอยู่</Badge>
                </td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-3 px-4">
                  <p className="font-medium text-gray-800">สมหญิง รักงาน</p>
                  <p className="text-sm text-gray-600">IT Support</p>
                </td>
                <td className="py-3 px-4 text-gray-700">08:30</td>
                <td className="py-3 px-4 text-gray-700">-</td>
                <td className="py-3 px-4">
                  <Badge variant="suspend">มาสาย</Badge>
                </td>
              </tr>
              <tr className="border-b border-gray-100">
                <td className="py-3 px-4">
                  <p className="font-medium text-gray-800">สมปอง ขยัน</p>
                  <p className="text-sm text-gray-600">IT Manager</p>
                </td>
                <td className="py-3 px-4 text-gray-700">08:00</td>
                <td className="py-3 px-4 text-gray-700">17:05</td>
                <td className="py-3 px-4">
                  <Badge variant="leave">เสร็จสิ้น</Badge>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
