'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function ManagerHistoryPage() {
  const [selectedMonth, setSelectedMonth] = useState('2026-02');
  const [viewMode, setViewMode] = useState<'my' | 'team'>('my');

  const myAttendance = [
    { date: '7 ก.พ. 68', checkIn: '08:30', checkOut: '17:30', status: 'ontime', hours: 8 },
    { date: '6 ก.พ. 68', checkIn: '08:45', checkOut: '17:35', status: 'late', hours: 8 },
    { date: '5 ก.พ. 68', checkIn: '08:25', checkOut: '17:20', status: 'ontime', hours: 8 },
  ];

  const teamAttendance = [
    { date: '7 ก.พ. 68', name: 'สมชาย ใจดี', checkIn: '08:30', checkOut: '17:30', status: 'ontime' },
    { date: '7 ก.พ. 68', name: 'สมหญิง รักงาน', checkIn: '08:25', checkOut: '17:35', status: 'ontime' },
    { date: '7 ก.พ. 68', name: 'ประยุทธ จริงใจ', checkIn: '09:15', checkOut: '17:45', status: 'late' },
    { date: '7 ก.พ. 68', name: 'วิไล ขยัน', checkIn: '-', checkOut: '-', status: 'leave' },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ontime':
        return <Badge variant="active">ตรงเวลา</Badge>;
      case 'late':
        return <Badge variant="suspend">มาสาย</Badge>;
      case 'leave':
        return <Badge variant="default">ลา</Badge>;
      case 'absent':
        return <Badge className="bg-red-100 text-red-700">ขาด</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      <Card className="p-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white">
        <h2 className="text-xl font-bold">ประวัติ</h2>
        <p className="text-sm text-white/90">บันทึกการเข้างานของฉันและทีม</p>
      </Card>

      <Tabs defaultValue="my" className="w-full" onValueChange={(v) => setViewMode(v as 'my' | 'team')}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="my">ฉัน</TabsTrigger>
          <TabsTrigger value="team">ทีม</TabsTrigger>
        </TabsList>

        <TabsContent value="my" className="space-y-4 mt-4">
          <Card className="p-4">
            <label className="block font-semibold text-gray-800 mb-2">เลือกเดือน</label>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
            />
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold text-gray-800 mb-3">สรุปประจำเดือน</h3>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div>
                <div className="text-2xl font-bold text-gray-900">22</div>
                <div className="text-xs text-gray-500">ทั้งหมด</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">20</div>
                <div className="text-xs text-gray-500">ตรงเวลา</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-600">1</div>
                <div className="text-xs text-gray-500">มาสาย</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">1</div>
                <div className="text-xs text-gray-500">ลา</div>
              </div>
            </div>
          </Card>

          <div className="space-y-3">
            {myAttendance.map((record, index) => (
              <Card key={index} className="p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-medium text-gray-900">{record.date}</span>
                  {getStatusBadge(record.status)}
                </div>
                <div className="grid grid-cols-3 gap-2 text-sm">
                  <div>
                    <div className="text-gray-500">เข้า</div>
                    <div className="font-semibold text-gray-900">{record.checkIn}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">ออก</div>
                    <div className="font-semibold text-gray-900">{record.checkOut}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">รวม</div>
                    <div className="font-semibold text-gray-900">{record.hours} ชม.</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="team" className="space-y-4 mt-4">
          <Card className="p-4">
            <label className="block font-semibold text-gray-800 mb-2">เลือกวันที่</label>
            <input
              type="date"
              defaultValue={new Date().toISOString().split('T')[0]}
              className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
            />
          </Card>

          <Card className="p-4">
            <h3 className="font-semibold text-gray-800 mb-3">สรุปทีม</h3>
            <div className="grid grid-cols-4 gap-2 text-center">
              <div>
                <div className="text-2xl font-bold text-gray-900">5</div>
                <div className="text-xs text-gray-500">ทั้งหมด</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-green-600">2</div>
                <div className="text-xs text-gray-500">ตรงเวลา</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-orange-600">1</div>
                <div className="text-xs text-gray-500">มาสาย</div>
              </div>
              <div>
                <div className="text-2xl font-bold text-blue-600">1</div>
                <div className="text-xs text-gray-500">ลา</div>
              </div>
            </div>
          </Card>

          <div className="space-y-3">
            {teamAttendance.map((record, index) => (
              <Card key={index} className="p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="font-medium text-gray-900">{record.name}</div>
                  {getStatusBadge(record.status)}
                </div>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div>
                    <div className="text-gray-500">เข้า</div>
                    <div className="font-semibold text-gray-900">{record.checkIn}</div>
                  </div>
                  <div>
                    <div className="text-gray-500">ออก</div>
                    <div className="font-semibold text-gray-900">{record.checkOut}</div>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
