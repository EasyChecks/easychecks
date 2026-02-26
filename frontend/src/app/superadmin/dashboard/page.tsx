"use client";

import React, { useState, useRef, useMemo, useEffect } from "react";
import dynamic from "next/dynamic";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  UserX, 
  Calendar, 
  Clock,
  X,
  Search,
  Map as MapIcon,
  Satellite
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import dashboardService, { AttendanceSummary as DashboardSummary, EmployeeToday, BranchMapItem } from "@/services/dashboardService";
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
interface BranchOption {
  code: string;
  name: string;
}

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
  const { user } = useAuth();

  // States
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [statsType, setStatsType] = useState<StatsType>("attendance");
  const [expandedLocationIds, setExpandedLocationIds] = useState<string[]>([]);
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
  const [branchesMap, setBranchesMap] = useState<BranchMapItem[]>([]);
  const [apiEvents, setApiEvents] = useState<ApiEventItem[]>([]);
  const [apiLocations, setApiLocations] = useState<LocationItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Branch options: dynamic from API
  const branchOptions: BranchOption[] = useMemo(() => [
    { code: "all", name: "สาขา: ทั้งหมด" },
    ...branchesMap.map(b => ({ code: String(b.branchId), name: b.name })),
  ], [branchesMap]);

  // ── Fetch dashboard data when branch changes ──
  useEffect(() => {
    const branchIdNum =
      selectedBranch !== "all" ? parseInt(selectedBranch, 10) : undefined;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        const [summary, employees, branches, eventsResp, locations] = await Promise.all([
          dashboardService.getAttendanceSummary(branchIdNum),
          dashboardService.getEmployeesToday(branchIdNum),
          dashboardService.getBranchesMap(),
          eventService.getAll({ take: 100 }),
          locationService.getAll(),
        ]);
        setDashboardSummary(summary);
        setEmployeesToday(employees.data);
        setBranchesMap(branches.data);
        setApiEvents(eventsResp.data);
        setApiLocations(locations);
      } catch (err) {
        console.error('[Dashboard] Failed to fetch data:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [selectedBranch]);

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

  const toggleLocationDetails = (locationId: string) => {
    const wasExpanded = expandedLocationIds.includes(locationId);
    if (wasExpanded) {
      setExpandedLocationIds(prev => prev.filter(id => id !== locationId));
    } else {
      setExpandedLocationIds(prev => [...prev, locationId]);
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

      {/* Page Header */}
      <div className="bg-white border-b border-borderMain px-6 py-4">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-primaryMain">ภาพรวมการปฏิบัติงานทั้งหมด</h1>
            <p className="text-sm text-textMain/70 mt-1">
              ข้อมูลเรียลไทม์ของระบบตรวจสอบการเข้างาน การลางาน และพื้นที่อนุญาต
            </p>
          </div>

          {/* Branch Filter (SuperAdmin only) */}
          {user?.role === "superadmin" && (
            <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-textMain">สาขา:</label>
              <select
                value={selectedBranch}
                onChange={(e) => setSelectedBranch(e.target.value)}
                className="appearance-none px-4 py-2.5 pr-10 border-2 border-borderMain rounded-lg text-sm font-medium text-primaryMain hover:border-accentMain focus:border-accentMain focus:ring-2 focus:ring-accentMain/20 transition-all outline-none cursor-pointer bg-white min-w-50"
              >
                {branchOptions.map((branch) => (
                  <option key={branch.code} value={branch.code}>
                    {branch.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </div>

      {/* Main Content */}
      <main className="px-6 py-8 max-w-8xl mx-auto">
        {/* Section 1: Stats with Selector */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-primaryMain">
              {statsType === "attendance" ? "สถิติการเข้างาน" : "สถิติการเข้าร่วมกิจกรรม"}
            </h2>
            <div className="flex gap-2 bg-borderMain/50 rounded-lg p-1">
              <Button
                variant={statsType === "attendance" ? "default" : "ghost"}
                onClick={() => setStatsType("attendance")}
              >
                การเข้างาน
              </Button>
              <Button
                variant={statsType === "event" ? "default" : "ghost"}
                onClick={() => setStatsType("event")}
              >
                กิจกรรม
              </Button>
            </div>
          </div>

          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {statsType === "attendance" ? (
              <>
                <button
                  onClick={() => handleDetailClick("absent", attendanceStats.absentUsers)}
                  className="bg-red-500 rounded-2xl shadow-sm p-6 text-white hover:bg-red-600 transition-all transform hover:scale-105"
                >
                  <div className="flex items-center justify-between h-full gap-4">
                    <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                      <UserX className="w-12 h-12" />
                    </div>
                    <div className="flex-1 text-left">
                      <h3 className="text-white/90 text-xl font-semibold mb-1">ขาดงาน</h3>
                      <p className="text-sm text-white/80">คลิกเพื่อดูรายละเอียด →</p>
                    </div>
                    <p className="text-6xl font-bold">{attendanceStats.absentCount}</p>
                  </div>
                </button>

                <button
                  onClick={() => handleDetailClick("leave", attendanceStats.leaveUsers)}
                  className="bg-blue-500 rounded-2xl shadow-sm p-6 text-white hover:bg-blue-600 transition-all transform hover:scale-105"
                >
                  <div className="flex items-center justify-between h-full gap-4">
                    <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                      <Calendar className="w-12 h-12" />
                    </div>
                    <div className="flex-1 text-left">
                      <h3 className="text-white/90 text-xl font-semibold mb-1">ลางาน</h3>
                      <p className="text-sm text-white/80">คลิกเพื่อดูรายละเอียด →</p>
                    </div>
                    <p className="text-6xl font-bold">{attendanceStats.leaveCount}</p>
                  </div>
                </button>

                <button
                  onClick={() => handleDetailClick("late", attendanceStats.lateUsers)}
                  className="bg-orange-500 rounded-2xl shadow-sm p-6 text-white hover:bg-orange-600 transition-all transform hover:scale-105"
                >
                  <div className="flex items-center justify-between h-full gap-4">
                    <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                      <Clock className="w-12 h-12" />
                    </div>
                    <div className="flex-1 text-left">
                      <h3 className="text-white/90 text-xl font-semibold mb-1">มาสาย</h3>
                      <p className="text-sm text-white/80">คลิกเพื่อดูรายละเอียด →</p>
                    </div>
                    <p className="text-6xl font-bold">{attendanceStats.lateCount}</p>
                  </div>
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => handleDetailClick("notParticipated", eventStats.notParticipatedUsers)}
                  className="bg-red-500 rounded-2xl shadow-sm p-6 text-white hover:bg-red-600 transition-all transform hover:scale-105"
                >
                  <div className="flex items-center justify-between h-full gap-4">
                    <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                      <UserX className="w-12 h-12" />
                    </div>
                    <div className="flex-1 text-left">
                      <h3 className="text-white/90 text-xl font-semibold mb-1">ยังไม่เข้าร่วม</h3>
                      <p className="text-sm text-white/80">คลิกเพื่อดูรายละเอียด →</p>
                    </div>
                    <p className="text-6xl font-bold">{eventStats.notParticipatedCount}</p>
                  </div>
                </button>

                <button
                  onClick={() => handleDetailClick("leave", eventStats.leaveEventUsers)}
                  className="bg-blue-500 rounded-2xl shadow-sm p-6 text-white hover:bg-blue-600 transition-all transform hover:scale-105"
                >
                  <div className="flex items-center justify-between h-full gap-4">
                    <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                      <Calendar className="w-12 h-12" />
                    </div>
                    <div className="flex-1 text-left">
                      <h3 className="text-white/90 text-xl font-semibold mb-1">ลางาน</h3>
                      <p className="text-sm text-white/80">คลิกเพื่อดูรายละเอียด →</p>
                    </div>
                    <p className="text-6xl font-bold">{eventStats.leaveEventCount}</p>
                  </div>
                </button>

                <button
                  onClick={() => handleDetailClick("late", eventStats.lateEventUsers)}
                  className="bg-orange-500 rounded-2xl shadow-sm p-6 text-white hover:bg-orange-600 transition-all transform hover:scale-105"
                >
                  <div className="flex items-center justify-between h-full gap-4">
                    <div className="w-20 h-20 bg-white/20 rounded-full flex items-center justify-center backdrop-blur-sm">
                      <Clock className="w-12 h-12" />
                    </div>
                    <div className="flex-1 text-left">
                      <h3 className="text-white/90 text-xl font-semibold mb-1">มาสาย</h3>
                      <p className="text-sm text-white/80">คลิกเพื่อดูรายละเอียด →</p>
                    </div>
                    <p className="text-6xl font-bold">{eventStats.lateEventCount}</p>
                  </div>
                </button>
              </>
            )}
          </div>
        </div>

        {/* Section 2: Donut Chart */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="text-primaryMain">
              {statsType === "attendance" ? "สัดส่วนการมาทำงาน" : "สัดส่วนการเข้าร่วมกิจกรรม"}
            </CardTitle>
            <CardDescription>
              แสดงสัดส่วนข้อมูลในรูปแบบกราฟวงกลม (Donut Chart)
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col md:flex-row items-center gap-8">
              {/* Donut Chart */}
              <div className="w-full md:w-1/2 h-75">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={donutChartData}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={100}
                      paddingAngle={5}
                      dataKey="value"
                      label={({ name, percent }: { name?: string; percent?: number }) => 
                        `${name ?? ''} ${((percent ?? 0) * 100).toFixed(0)}%`
                      }
                    >
                      {donutChartData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip 
                      contentStyle={{
                        backgroundColor: "white",
                        border: "2px solid #E2E8F0",
                        borderRadius: "8px",
                        padding: "8px",
                      }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Legend */}
              <div className="w-full md:w-1/2 space-y-4">
                {donutChartData.map((item) => (
                  <div key={item.name} className="flex items-center justify-between p-4 bg-secondaryMain rounded-lg border-2 border-borderMain">
                    <div className="flex items-center gap-3">
                      <div 
                        className="w-4 h-4 rounded-full" 
                        style={{ backgroundColor: item.color }}
                      />
                      <span className="font-medium text-textMain">{item.name}</span>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-bold text-primaryMain">{item.value}</p>
                      <p className="text-xs text-textMain/70">
                        {((item.value / donutChartData.reduce((a, b) => a + b.value, 0)) * 100).toFixed(1)}%
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section 3: Map ต้องใช้ MapContainer จาก react-leaflet */}
        <Card>
          <CardHeader className="border-b border-borderMain">
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="text-primaryMain">ตั้งค่าพื้นที่และกิจกรรม</CardTitle>
                <CardDescription className="mt-1">
                  กำหนดพื้นที่ปฏิบัติงานและกิจกรรมต่างๆ ที่พนักงานสามารถเข้าถึงได้
                </CardDescription>
              </div>
              <Badge variant="secondary" className="text-accentMain bg-accentMain/10 text-sm px-4 py-2">
                {locationsWithStatus.length} รายการ
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            {/* Map Controls */}
            <div className="flex flex-col md:flex-row gap-4 mb-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-textMain/40" />
                <input
                  type="text"
                  placeholder="ค้นหาพื้นที่หรือกิจกรรม..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-borderMain rounded-lg focus:outline-none focus:ring-2 focus:ring-primaryMain"
                />
              </div>
              <div className="flex gap-2">
                <Button
                  variant={filterType === 'all' ? 'default' : 'outline'}
                  onClick={() => setFilterType('all')}
                  size="sm"
                >
                  ทั้งหมด
                </Button>
                <Button
                  variant={filterType === 'location' ? 'default' : 'outline'}
                  onClick={() => setFilterType('location')}
                  size="sm"
                >
                  พื้นที่
                </Button>
                <Button
                  variant={filterType === 'event' ? 'default' : 'outline'}
                  onClick={() => setFilterType('event')}
                  size="sm"
                >
                  กิจกรรม
                </Button>
                <Button
                  variant={mapType === 'default' ? 'default' : 'outline'}
                  onClick={() => setMapType('default')}
                  size="sm"
                >
                  <MapIcon className="h-4 w-4" />
                </Button>
                <Button
                  variant={mapType === 'satellite' ? 'default' : 'outline'}
                  onClick={() => setMapType('satellite')}
                  size="sm"
                >
                  <Satellite className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Map */}
            {typeof window !== 'undefined' && filteredLocations.length > 0 && (
              <div className="h-125 rounded-lg overflow-hidden border border-borderMain">
                <MapContainer
                  center={[filteredLocations[0].latitude, filteredLocations[0].longitude]}
                  zoom={13}
                  className="h-full w-full"
                  ref={mapRef}
                >
                  <TileLayer
                    attribution={getTileLayerAttribution()}
                    url={getTileLayerUrl()}
                  />
                  {filteredLocations.map((location) => (
                    <React.Fragment key={location.id}>
                      <Marker
                        position={[location.latitude, location.longitude]}
                      >
                        <Popup>
                          <div className="p-2">
                            <h3 className="font-bold text-sm">{location.name}</h3>
                            {location.description && (
                              <p className="text-xs text-gray-600 mt-1">{location.description}</p>
                            )}
                            <div className="mt-2 space-y-1">
                              <p className="text-xs">
                                <span className="font-medium">ทีม:</span> {location.team}
                              </p>
                              <p className="text-xs">
                                <span className="font-medium">เวลา:</span> {location.time}
                              </p>
                              <p className={`text-xs font-medium ${location.statusColor}`}>
                                {location.checkInStatus}
                              </p>
                            </div>
                          </div>
                        </Popup>
                      </Marker>
                      <Circle
                        center={[location.latitude, location.longitude]}
                        radius={location.radius}
                        pathOptions={{
                          color: location.type === 'event' ? '#f97316' : '#10b981',
                          fillColor: location.type === 'event' ? '#f97316' : '#10b981',
                          fillOpacity: 0.2,
                        }}
                      />
                    </React.Fragment>
                  ))}
                </MapContainer>
              </div>
            )}

            {/* No Data */}
            {filteredLocations.length === 0 && (
              <div className="text-center py-12 text-textMain/60">
                <MapIcon className="w-16 h-16 mx-auto mb-4 text-textMain/30" />
                <p className="text-lg font-medium">ไม่พบข้อมูล</p>
                <p className="text-sm mt-2 text-textMain/50">
                  ลองค้นหาด้วยคำอื่นหรือเปลี่ยนตัวกรอง
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
