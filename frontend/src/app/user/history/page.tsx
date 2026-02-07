'use client';

import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

export default function HistoryPage() {
  const [selectedMonth, setSelectedMonth] = useState('2026-02');

  const attendanceHistory = [
    { date: '7 ก.พ. 68', checkIn: '08:30', checkOut: '17:30', status: 'ontime', hours: 8 },
    { date: '6 ก.พ. 68', checkIn: '08:45', checkOut: '17:35', status: 'late', hours: 8 },
    { date: '5 ก.พ. 68', checkIn: '08:25', checkOut: '17:20', status: 'ontime', hours: 8 },
    { date: '4 ก.พ. 68', checkIn: '-', checkOut: '-', status: 'leave', hours: 0 },
    { date: '3 ก.พ. 68', checkIn: '08:30', checkOut: '17:30', status: 'ontime', hours: 8 },
  ];

  const leaveHistory = [
    { date: '4 ก.พ. 68', type: 'ลาป่วย', duration: '1 วัน', status: 'approved', reason: 'ไข้หวัด' },
    { date: '25-26 ม.ค. 68', type: 'ลากิจ', duration: '2 วัน', status: 'approved', reason: 'ธุระส่วนตัว' },
    { date: '15 ม.ค. 68', type: 'ลาพักร้อน', duration: '1 วัน', status: 'rejected', reason: 'ไปต่างจังหวัด' },
  ];

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'ontime':
        return <Badge variant="active">ตรงเวลา</Badge>;
      case 'late':
        return <Badge variant="suspend">มาสาย</Badge>;
      case 'leave':
        return <Badge variant="default">ลา</Badge>;
      case 'approved':
        return <Badge variant="active">อนุมัติ</Badge>;
      case 'rejected':
        return <Badge className="bg-red-100 text-red-700">ไม่อนุมัติ</Badge>;
      case 'pending':
        return <Badge variant="default">รอพิจารณา</Badge>;
      default:
        return <Badge variant="default">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <Card className="p-4 bg-gradient-to-r from-blue-500 to-blue-600 text-white">
        <h2 className="text-xl font-bold">ประวัติ</h2>
        <p className="text-sm text-white/90">บันทึกการเข้างานและการลา</p>
      </Card>

      {/* Month Selector */}
      <Card className="p-4">
        <label className="block font-semibold text-gray-800 mb-2">เลือกเดือน</label>
        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="w-full px-4 py-3 border-2 border-gray-200 rounded-xl focus:border-blue-500 focus:outline-none"
        />
      </Card>

      {/* Summary */}
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

      {/* Tabs */}
      <Tabs defaultValue="attendance" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="attendance">การเข้างาน</TabsTrigger>
          <TabsTrigger value="leave">การลา</TabsTrigger>
        </TabsList>

        <TabsContent value="attendance" className="space-y-3 mt-4">
          {attendanceHistory.map((record, index) => (
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
        </TabsContent>

        <TabsContent value="leave" className="space-y-3 mt-4">
          {leaveHistory.map((record, index) => (
            <Card key={index} className="p-4">
              <div className="flex items-center justify-between mb-2">
                <div>
                  <span className="font-medium text-gray-900">{record.type}</span>
                  <span className="text-sm text-gray-500 ml-2">({record.duration})</span>
                </div>
                {getStatusBadge(record.status)}
              </div>
              <div className="text-sm text-gray-600 mb-1">{record.date}</div>
              <div className="text-sm text-gray-500 bg-gray-50 p-2 rounded">
                เหตุผล: {record.reason}
              </div>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}
