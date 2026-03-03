"use client";

import React, { useState, useRef, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  X,
  Search,
  Map as MapIcon,
  Satellite
} from "lucide-react";
import dashboardService, { AttendanceSummary as DashboardSummary, EmployeeToday } from "@/services/dashboardService";
import eventService, { EventItem as ApiEventItem } from "@/services/eventService";
import locationService, { LocationItem } from "@/services/locationService";
import type L from "leaflet";

// Dynamic import for Map components (client-side only)
const MapContainer = dynamic(
  () => import("react-leaflet").then((mod) => mod.MapContainer),
  { ssr: false }
);
const TileLayer = dynamic(
  () => import("react-leaflet").then((mod) => mod.TileLayer),
  { ssr: false }
);
const Marker = dynamic(
  () => import("react-leaflet").then((mod) => mod.Marker),
  { ssr: false }
);
const Circle = dynamic(
  () => import("react-leaflet").then((mod) => mod.Circle),
  { ssr: false }
);
const Popup = dynamic(
  () => import("react-leaflet").then((mod) => mod.Popup),
  { ssr: false }
);

// Fix Leaflet default marker icon 404 (icons load relative to page path otherwise)
if (typeof window !== "undefined") {
  import("leaflet").then((L) => {
    delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png",
      iconUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png",
      shadowUrl: "https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png",
    });
  });
}

// Types
interface User {
  id: string;
  name: string;
  department: string;
  position: string;
  avatar: string;
  time: string;
  status: string;
}

interface AttendanceStats {
  totalEmployees: number;
  absentCount: number;
  leaveCount: number;
  lateCount: number;
  onTimeCount: number;
  absentUsers: User[];
  leaveUsers: User[];
  lateUsers: User[];
  onTimeUsers: User[];
}

interface EventStats {
  totalEvents: number;
  activeEvents: number;
  todayEvents: number;
  completedEvents: number;
  notParticipatedCount: number;
  leaveEventCount: number;
  lateEventCount: number;
  notParticipatedUsers: User[];
  leaveEventUsers: User[];
  lateEventUsers: User[];
}

interface LocationWithStatus {
  id: string;
  name: string;
  description?: string;
  latitude: number;
  longitude: number;
  radius: number;
  type: "mapping" | "event";
  team: string;
  time: string;
  checkInStatus: string;
  statusColor: string;
}

type StatsType = "attendance" | "event";
type MapType = "default" | "satellite";
type FilterType = "all" | "location" | "event";
type DetailType = "absent" | "leave" | "late" | "notParticipated";

// Donut Chart Colors
const CHART_COLORS = {
  onTime: "#047857",
  late: "#F97316",
  leave: "#3B82F6",
  absent: "#EF4444",
};

export default function AdminDashboard() {
  // States
  const [statsType, setStatsType] = useState<StatsType>("attendance");
  const mapRef = useRef<L.Map | null>(null);

  // Modal states
  const [showDetailModal, setShowDetailModal] = useState(false);
  const [detailType, setDetailType] = useState<DetailType | null>(null);
  const [detailUsers, setDetailUsers] = useState<User[]>([]);

  // Map states
  const [searchQuery, setSearchQuery] = useState("");
  const [mapType, setMapType] = useState<MapType>("default");
  const [filterType, setFilterType] = useState<FilterType>("all");

  // ── API Data states ──
  const [dashboardSummary, setDashboardSummary] = useState<DashboardSummary | null>(null);
  const [employeesToday, setEmployeesToday] = useState<EmployeeToday[]>([]);
  const [apiEvents, setApiEvents] = useState<ApiEventItem[]>([]);
  const [apiLocations, setApiLocations] = useState<LocationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // ── Fetch dashboard data ──
  useEffect(() => {
    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [summary, employees, , eventsResp, locations] = await Promise.all([
          dashboardService.getAttendanceSummary(undefined),
          dashboardService.getEmployeesToday(undefined),
          dashboardService.getBranchesMap(),
          eventService.getAll({ take: 100 }),
          locationService.getAll(),
        ]);
        setDashboardSummary(summary);
        setEmployeesToday(employees.data);
        setApiEvents(eventsResp.data);
        setApiLocations(Array.isArray(locations) ? locations : (locations.data ?? []));
      } catch (err) {
        console.error('[Dashboard] Failed to fetch data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, []);

  // ── Map API employees → AttendanceStats ──
  const attendanceStats = useMemo((): AttendanceStats => {
    const toUser = (e: EmployeeToday, idx: number): User => ({
      id: String(e.employeeId || idx),
      name: e.name,
      department: e.branch || '',
      position: '',
      avatar: '',
      time: e.checkIn || '',
      status: e.status,
    });
    const absentUsers = employeesToday.filter(e => e.status === 'ABSENT').map(toUser);
    const lateUsers   = employeesToday.filter(e => e.status === 'LATE').map(toUser);
    const onTimeUsers = employeesToday.filter(e => e.status === 'ON_TIME').map(toUser);
    return {
      totalEmployees: dashboardSummary?.total ?? employeesToday.length,
      absentCount:    dashboardSummary?.absent ?? absentUsers.length,
      leaveCount:     0,
      lateCount:      dashboardSummary?.late ?? lateUsers.length,
      onTimeCount:    dashboardSummary?.onTime ?? onTimeUsers.length,
      absentUsers,
      leaveUsers:     [],
      lateUsers,
      onTimeUsers,
    };
  }, [dashboardSummary, employeesToday]);

  // ── Map API events → EventStats ──
  const eventStats = useMemo((): EventStats => {
    const now = new Date();
    const activeEvts  = apiEvents.filter(e => e.isActive && new Date(e.startDateTime) <= now && new Date(e.endDateTime) >= now);
    const todayEvts   = apiEvents.filter(e => {
      const d = new Date(e.startDateTime);
      return d.toDateString() === now.toDateString();
    });
    const completedEvts = apiEvents.filter(e => new Date(e.endDateTime) < now);
    return {
      totalEvents:          apiEvents.length,
      activeEvents:         activeEvts.length,
      todayEvents:          todayEvts.length,
      completedEvents:      completedEvts.length,
      notParticipatedCount: 0,
      leaveEventCount:      0,
      lateEventCount:       0,
      notParticipatedUsers: [],
      leaveEventUsers:      [],
      lateEventUsers:       [],
    };
  }, [apiEvents]);

  // Combine locations from API data
  const mappingLocations: LocationWithStatus[] = apiLocations.map((loc) => ({
    id: String(loc.locationId),
    name: loc.locationName,
    description: loc.address,
    latitude: loc.latitude,
    longitude: loc.longitude,
    radius: loc.radius,
    type: "mapping" as const,
    team: "",
    time: "",
    checkInStatus: "พื้นที่อนุญาต",
    statusColor: "text-green-600",
  }));

  const eventLocations: LocationWithStatus[] = apiEvents
    .filter(evt => evt.location?.latitude != null)
    .map((evt) => ({
      id: `event-${evt.eventId}`,
      name: evt.location!.locationName,
      description: `งาน: ${evt.eventName}`,
      latitude: evt.location!.latitude,
      longitude: evt.location!.longitude,
      radius: evt.location!.radius,
      type: "event" as const,
      team: "",
      time: evt.startDateTime
        ? new Date(evt.startDateTime).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' })
        : "ไม่ระบุ",
      checkInStatus: "พื้นที่กิจกรรม",
      statusColor: "text-orange-600",
    }));

  const locationsWithStatus = [...mappingLocations, ...eventLocations];
  
  const filteredLocations = locationsWithStatus.filter(location => {
    if (filterType === "location" && location.type === "event") return false;
    if (filterType === "event" && location.type !== "event") return false;
    return location.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
           location.description?.toLowerCase().includes(searchQuery.toLowerCase());
  });

  // Donut chart data
  const donutChartData = useMemo(() => {
    if (statsType === "attendance") {
      return [
        { name: "ตรงเวลา", value: attendanceStats.onTimeCount, color: CHART_COLORS.onTime },
        { name: "มาสาย", value: attendanceStats.lateCount, color: CHART_COLORS.late },
        { name: "ลางาน", value: attendanceStats.leaveCount, color: CHART_COLORS.leave },
        { name: "ขาดงาน", value: attendanceStats.absentCount, color: CHART_COLORS.absent },
      ];
    } else {
      return [
        { name: "เข้าร่วม", value: eventStats.activeEvents, color: CHART_COLORS.onTime },
        { name: "มาสาย", value: eventStats.lateEventCount, color: CHART_COLORS.late },
        { name: "ลางาน", value: eventStats.leaveEventCount, color: CHART_COLORS.leave },
        { name: "ยังไม่เข้าร่วม", value: eventStats.notParticipatedCount, color: CHART_COLORS.absent },
      ];
    }
  }, [statsType, attendanceStats, eventStats]);

  // Handlers
  const handleDetailClick = (type: DetailType, users: User[]) => {
    setDetailType(type);
    setDetailUsers(users);
    setShowDetailModal(true);
  };

  const getDetailTitle = () => {
    if (statsType === "attendance") {
      switch (detailType) {
        case "absent": return "รายชื่อพนักงานที่ขาดงาน";
        case "leave": return "รายชื่อพนักงานที่ลางาน";
        case "late": return "รายชื่อพนักงานที่มาสาย";
        default: return "รายละเอียด";
      }
    } else {
      switch (detailType) {
        case "notParticipated": return "รายชื่อผู้ที่ยังไม่เข้าร่วมกิจกรรม";
        case "leave": return "รายชื่อผู้ที่ลางานกิจกรรม";
        case "late": return "รายชื่อผู้ที่มาสายกิจกรรม";
        default: return "รายละเอียด";
      }
    }
  };

  const getTileLayerUrl = () => {
    if (mapType === "satellite") {
      return "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}";
    }
    return "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png";
  };

  const getTileLayerAttribution = () => {
    if (mapType === "satellite") {
      return '&copy; <a href="https://www.esri.com/">Esri</a>';
    }
    return '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-secondaryMain flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-4 border-b-2 border-orange-600 rounded-full animate-spin" />
          <p className="text-gray-500">กำลังโหลดข้อมูล...</p>
        </div>
      </div>
    );
  }

  const statusLabel = (status: string) => {
    switch (status) {
      case 'ON_TIME': return { text: 'ตรงเวลา', cls: 'bg-emerald-100 text-emerald-700' };
      case 'LATE':    return { text: 'มาสาย',   cls: 'bg-orange-100 text-orange-700'   };
      case 'ABSENT':  return { text: 'ขาดงาน',  cls: 'bg-red-100 text-red-700'         };
      default:        return { text: 'ไม่ทราบ', cls: 'bg-gray-100 text-gray-600'       };
    }
  };

  const totalChart = donutChartData.reduce((a, b) => a + b.value, 0) || 1;

  return (
    <div className="min-h-screen bg-secondaryMain">
      {/* Detail Modal */}
      {showDetailModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <Card className="max-w-2xl w-full max-h-[80vh] overflow-hidden">
            <CardHeader className="border-b border-borderMain flex-row items-center justify-between py-4">
              <CardTitle className="text-primaryMain">{getDetailTitle()}</CardTitle>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowDetailModal(false)}
                className="text-textMain/60 hover:text-textMain"
              >
                <X className="h-5 w-5" />
              </Button>
            </CardHeader>
            <CardContent className="p-6 overflow-y-auto max-h-[calc(80vh-80px)]">
              {detailUsers.length === 0 ? (
                <div className="text-center py-8 text-textMain/60">
                  <MapIcon className="w-16 h-16 mx-auto mb-4 text-textMain/30" />
                  <p className="text-lg font-medium">ไม่มีข้อมูล</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {detailUsers.map((user, index) => (
                    <div
                      key={user.id}
                      className="bg-secondaryMain rounded-lg p-4 border-2 border-borderMain hover:border-primaryMain transition-colors"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-primaryMain rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-primaryMain text-lg">{user.name}</h3>
                          <p className="text-sm text-textMain">{user.department} - {user.position}</p>
                          {user.time && <p className="text-xs text-textMain/70 mt-1">{user.time}</p>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Header ── */}
      <div className="bg-white border-b border-borderMain px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-primaryMain">ภาพรวมการปฏิบัติงาน</h1>
            <p className="text-sm text-textMain/70 mt-0.5">ข้อมูลเรียลไทม์ · ระบบตรวจสอบการเข้างาน</p>
          </div>
        </div>
      </div>

      {/* ── Main 2-column layout ── */}
      <main className="flex gap-0 h-[calc(100vh-73px)] overflow-hidden">

        {/* ───── LEFT COLUMN: Map + Activity Log ───── */}
        <div className="flex flex-col flex-1 min-w-0 overflow-hidden">

          {/* Map */}
          <div className="relative flex-1 min-h-0">
            {/* Map Controls overlay */}
            <div className="absolute top-3 left-3 right-3 z-999 flex gap-2 flex-wrap">
              <div className="relative flex-1 min-w-52">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="ค้นหาพื้นที่หรือกิจกรรม..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 bg-white/95 backdrop-blur-sm border border-gray-200 rounded-lg text-sm shadow focus:outline-none focus:ring-2 focus:ring-primaryMain"
                />
              </div>
              <div className="flex gap-1">
                {(['all','location','event'] as FilterType[]).map(f => (
                  <Button key={f} size="sm"
                    variant={filterType === f ? 'default' : 'outline'}
                    onClick={() => setFilterType(f)}
                    className="bg-white/95 backdrop-blur-sm text-xs"
                  >
                    {{ all: 'ทั้งหมด', location: 'พื้นที่', event: 'กิจกรรม' }[f]}
                  </Button>
                ))}
                <Button size="sm"
                  variant={mapType === 'default' ? 'default' : 'outline'}
                  onClick={() => setMapType('default')}
                  className="bg-white/95 backdrop-blur-sm"
                ><MapIcon className="h-4 w-4" /></Button>
                <Button size="sm"
                  variant={mapType === 'satellite' ? 'default' : 'outline'}
                  onClick={() => setMapType('satellite')}
                  className="bg-white/95 backdrop-blur-sm"
                ><Satellite className="h-4 w-4" /></Button>
              </div>
            </div>

            {/* Map itself */}
            {typeof window !== 'undefined' && filteredLocations.length > 0 ? (
              <MapContainer
                center={[filteredLocations[0].latitude, filteredLocations[0].longitude]}
                zoom={13}
                className="h-full w-full"
                ref={mapRef}
              >
                <TileLayer attribution={getTileLayerAttribution()} url={getTileLayerUrl()} />
                {filteredLocations.map((location) => (
                  <React.Fragment key={location.id}>
                    <Marker position={[location.latitude, location.longitude]}>
                      <Popup>
                        <div className="p-2 min-w-40">
                          <p className="font-bold text-sm">{location.name}</p>
                          {location.description && <p className="text-xs text-gray-500 mt-1">{location.description}</p>}
                          <span className={`text-xs font-medium mt-2 inline-block ${location.statusColor}`}>{location.checkInStatus}</span>
                        </div>
                      </Popup>
                    </Marker>
                    <Circle
                      center={[location.latitude, location.longitude]}
                      radius={location.radius}
                      pathOptions={{
                        color: location.type === 'event' ? '#f97316' : '#10b981',
                        fillColor: location.type === 'event' ? '#f97316' : '#10b981',
                        fillOpacity: 0.15,
                      }}
                    />
                  </React.Fragment>
                ))}
              </MapContainer>
            ) : (
              <div className="h-full flex items-center justify-center bg-gray-100">
                <div className="text-center text-gray-400">
                  <MapIcon className="w-12 h-12 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">ไม่พบข้อมูลพื้นที่</p>
                </div>
              </div>
            )}
          </div>

          {/* Activity Log */}
          <div className="h-52 border-t-2 border-borderMain bg-white flex flex-col">
            <div className="px-4 py-2 border-b border-borderMain flex items-center justify-between shrink-0">
              <h3 className="text-sm font-semibold text-primaryMain">บันทึกกิจกรรม (Activity Log)</h3>
              <span className="text-xs text-textMain/60">{employeesToday.length} รายการ</span>
            </div>
            <div className="overflow-y-auto flex-1">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-gray-50 border-b border-borderMain">
                  <tr>
                    <th className="px-3 py-2 text-left font-medium text-textMain/70 w-28">รหัสพนักงาน</th>
                    <th className="px-3 py-2 text-left font-medium text-textMain/70">ชื่อ</th>
                    <th className="px-3 py-2 text-left font-medium text-textMain/70">นามสกุล</th>
                    <th className="px-3 py-2 text-left font-medium text-textMain/70">สาขา</th>
                    <th className="px-3 py-2 text-left font-medium text-textMain/70">สถานะการเข้างาน</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-borderMain/50">
                  {employeesToday.length === 0 ? (
                    <tr><td colSpan={5} className="text-center py-6 text-gray-400">ไม่พบข้อมูล</td></tr>
                  ) : (
                    employeesToday.map((emp) => {
                      const nameParts = emp.name.split(' ');
                      const firstName = nameParts[0] ?? emp.name;
                      const lastName  = nameParts.slice(1).join(' ');
                      const sl = statusLabel(emp.status);
                      return (
                        <tr key={emp.employeeId} className="hover:bg-gray-50 transition-colors">
                          <td className="px-3 py-2 font-mono text-textMain/80">{emp.employeeId}</td>
                          <td className="px-3 py-2 text-textMain">{firstName}</td>
                          <td className="px-3 py-2 text-textMain">{lastName || '-'}</td>
                          <td className="px-3 py-2 text-textMain/70">{emp.branch || '-'}</td>
                          <td className="px-3 py-2">
                            <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${sl.cls}`}>
                              {sl.text}
                            </span>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* ───── RIGHT PANEL ───── */}
        <div className="w-80 shrink-0 border-l-2 border-borderMain bg-white flex flex-col overflow-y-auto">

          {/* Tabs */}
          <div className="flex shrink-0 border-b-2 border-borderMain">
            <button
              onClick={() => setStatsType('attendance')}
              className={`flex-1 py-3 text-sm font-semibold transition-colors ${
                statsType === 'attendance'
                  ? 'text-primaryMain border-b-2 border-primaryMain bg-white'
                  : 'text-textMain/60 hover:text-textMain bg-gray-50'
              }`}
            >
              การเข้างาน
            </button>
            <button
              onClick={() => setStatsType('event')}
              className={`flex-1 py-3 text-sm font-semibold transition-colors border-l border-borderMain ${
                statsType === 'event'
                  ? 'text-primaryMain border-b-2 border-primaryMain bg-white'
                  : 'text-textMain/60 hover:text-textMain bg-gray-50'
              }`}
            >
              กิจกรรม
            </button>
          </div>

          {/* Date range / info */}
          <div className="px-4 py-2 bg-gray-50 border-b border-borderMain shrink-0">
            <p className="text-xs text-textMain/60">เลือกช่วงเวลาหรือวันที่เพื่อดูข้อมูล</p>
            <p className="text-xs font-medium text-primaryMain mt-0.5">
              {new Date().toLocaleDateString('th-TH', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </p>
          </div>

          {/* Donut Chart */}
          <div className="px-4 py-3 shrink-0">
            <div className="h-52">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutChartData}
                    cx="50%" cy="50%"
                    innerRadius={52} outerRadius={82}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {donutChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{ backgroundColor: 'white', border: '1px solid #e2e8f0', borderRadius: '8px', fontSize: '12px' }}
                    formatter={(value: number | undefined) => [(value ?? 0) + ' คน']}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Legend rows — clickable */}
          <div className="px-4 pb-4 space-y-2 shrink-0">
            {donutChartData.map((item) => {
              let detailFn: (() => void) | undefined;
              if (statsType === 'attendance') {
                if (item.name === 'ขาดงาน') detailFn = () => handleDetailClick('absent', attendanceStats.absentUsers);
                if (item.name === 'ลางาน')  detailFn = () => handleDetailClick('leave',  attendanceStats.leaveUsers);
                if (item.name === 'มาสาย')  detailFn = () => handleDetailClick('late',   attendanceStats.lateUsers);
              } else {
                if (item.name === 'ยังไม่เข้าร่วม') detailFn = () => handleDetailClick('notParticipated', eventStats.notParticipatedUsers);
                if (item.name === 'ลางาน')      detailFn = () => handleDetailClick('leave', eventStats.leaveEventUsers);
                if (item.name === 'มาสาย')      detailFn = () => handleDetailClick('late',  eventStats.lateEventUsers);
              }
              const pct = ((item.value / totalChart) * 100).toFixed(0);
              return (
                <button
                  key={item.name}
                  onClick={detailFn}
                  disabled={!detailFn}
                  className="w-full flex items-center justify-between px-3 py-2 rounded-lg border border-borderMain hover:border-primaryMain hover:bg-gray-50 transition-colors disabled:cursor-default"
                >
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: item.color }} />
                    <span className="text-sm text-textMain">{item.name}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-bold text-primaryMain">{item.value}</span>
                    <span className="text-xs text-textMain/50 w-8 text-right">{pct}%</span>
                  </div>
                </button>
              );
            })}
          </div>

          {/* Divider */}
          <div className="border-t border-borderMain mx-4" />

          {/* Summary totals */}
          <div className="px-4 py-3 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-textMain/60">พนักงานทั้งหมด</span>
              <span className="font-bold text-primaryMain">{attendanceStats.totalEmployees} คน</span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-textMain/60">คิดรวมอัตราการสถิติ</span>
              <span className="font-bold text-emerald-600">{totalChart} คน</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
