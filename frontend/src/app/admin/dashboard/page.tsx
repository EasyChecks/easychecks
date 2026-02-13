"use client";

import React, { useState, useRef, useCallback, useMemo } from "react";
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
import { useAuth, useLocations, useEvents, usersData, type User, type Location } from "@/contexts/mock-contexts";
import "leaflet/dist/leaflet.css";

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

// Types
interface BranchOption {
  code: string;
  name: string;
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

interface LocationWithStatus extends Location {
  type: "mapping" | "event";
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
  const { getFilteredLocations } = useLocations();
  const { getFilteredEvents } = useEvents();
  
  // States
  const [selectedBranch, setSelectedBranch] = useState(user?.role === 'admin' ? (user?.branch || user?.provinceCode || 'all') : "all");
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
  
  // Branch options
  const branchOptions: BranchOption[] = [
    { code: "all", name: "สาขา: ทั้งหมด" },
    { code: "BKK", name: "BKK (กรุงเทพ)" },
    { code: "CNX", name: "CNX (เชียงใหม่)" },
    { code: "PKT", name: "PKT (ภูเก็ต)" },
  ];

  // Get filtered locations and events
  const allLocations = getFilteredLocations(user);
  const allEvents = getFilteredEvents(user);
  
  const locations = useMemo(() => {
    if (user?.role !== "superadmin" || selectedBranch === "all") {
      return allLocations;
    }
    const branchPrefix = selectedBranch === "BKK" ? "1" : 
                        selectedBranch === "CNX" ? "2" : 
                        selectedBranch === "PKT" ? "3" : null;
    
    return allLocations.filter(loc => {
      if (loc.createdBy?.branch === selectedBranch) return true;
      if (branchPrefix && loc.createdBy?.branch?.startsWith(branchPrefix)) return true;
      return loc.branchCode === selectedBranch || loc.provinceCode === selectedBranch;
    });
  }, [allLocations, selectedBranch, user?.role]);
  
  const events = useMemo(() => {
    if (user?.role !== "superadmin" || selectedBranch === "all") {
      return allEvents;
    }
    const branchPrefix = selectedBranch === "BKK" ? "1" : 
                        selectedBranch === "CNX" ? "2" : 
                        selectedBranch === "PKT" ? "3" : null;
    
    return allEvents.filter(evt => {
      if (evt.createdBy?.branch === selectedBranch) return true;
      if (branchPrefix && evt.createdBy?.branch?.startsWith(branchPrefix)) return true;
      return evt.branchCode === selectedBranch || evt.provinceCode === selectedBranch;
    });
  }, [allEvents, selectedBranch, user?.role]);

  // Calculate attendance stats
  const calculateAttendanceStats = useCallback((branchFilter = "all"): AttendanceStats => {
    const today = new Date();
    const todayStr = `${today.getDate().toString().padStart(2, "0")}/${(today.getMonth() + 1).toString().padStart(2, "0")}/${today.getFullYear() + 543}`;
    
    const users = [...usersData];
    
    const branchPrefix = branchFilter === "BKK" ? "1" : 
                        branchFilter === "CNX" ? "2" : 
                        branchFilter === "PKT" ? "3" : null;
    
    const filteredUsers = users.filter(u => {
      if (u.role === "admin" || u.role === "superadmin") return false;
      if (branchFilter === "all") return true;
      if (u.branchCode === branchFilter) return true;
      if (branchPrefix && u.branchCode?.startsWith(branchPrefix)) return true;
      return u.provinceCode === branchFilter;
    });
    
    const absentUsers: User[] = [];
    const leaveUsers: User[] = [];
    const lateUsers: User[] = [];
    const onTimeUsers: User[] = [];
    
    filteredUsers.forEach(user => {
      const todayRecord = user.attendanceRecords?.find(r => r.date === todayStr);
      
      if (todayRecord && (todayRecord.status === "leave" || todayRecord.checkIn?.status === "leave")) {
        leaveUsers.push(user);
      } else if (!todayRecord || !todayRecord.checkIn) {
        absentUsers.push(user);
      } else {
        const checkInStatus = todayRecord.checkIn.status;
        if (checkInStatus === "มาสาย") {
          lateUsers.push(user);
        } else if (checkInStatus === "ตรงเวลา") {
          onTimeUsers.push(user);
        } else if (checkInStatus === "ขาด") {
          absentUsers.push(user);
        }
      }
    });
    
    return {
      totalEmployees: filteredUsers.length,
      absentCount: absentUsers.length,
      leaveCount: leaveUsers.length,
      lateCount: lateUsers.length,
      onTimeCount: onTimeUsers.length,
      absentUsers,
      leaveUsers,
      lateUsers,
      onTimeUsers,
    };
  }, []);

  const attendanceStats = useMemo(() => {
    const branchFilter = user?.role === "superadmin" ? selectedBranch : (user?.provinceCode || user?.branch || "all");
    return calculateAttendanceStats(branchFilter);
  }, [selectedBranch, user, calculateAttendanceStats]);

  // Calculate event stats
  const calculateEventStats = useCallback((branchFilter = "all"): EventStats => {
    const today = new Date();
    const todayStr = `${today.getDate().toString().padStart(2, "0")}/${(today.getMonth() + 1).toString().padStart(2, "0")}/${today.getFullYear()}`;
    
    const activeEvents = events.filter(e => e.status === "ongoing");
    const todayEvents = events.filter(e => e.date === todayStr || e.startDate === todayStr);
    const completedEvents = events.filter(e => e.status === "completed");
    
    const users = [...usersData];
    const branchPrefix = branchFilter === "BKK" ? "1" : 
                        branchFilter === "CNX" ? "2" : 
                        branchFilter === "PKT" ? "3" : null;
    
    const filteredUsers = users.filter(u => {
      if (u.role === "admin" || u.role === "superadmin") return false;
      if (branchFilter === "all") return true;
      if (u.branchCode === branchFilter) return true;
      if (branchPrefix && u.branchCode?.startsWith(branchPrefix)) return true;
      return u.provinceCode === branchFilter;
    });
    
    const notParticipatedUsers = filteredUsers.filter(u => u.id % 6 === 0).slice(0, 4);
    const leaveEventUsers = filteredUsers.filter(u => u.id % 4 === 0 && u.id % 6 !== 0).slice(0, 5);
    const lateEventUsers = filteredUsers.filter(u => u.id % 8 === 0 && u.id % 4 !== 0 && u.id % 6 !== 0).slice(0, 4);
    
    return {
      totalEvents: events.length,
      activeEvents: activeEvents.length,
      todayEvents: todayEvents.length,
      completedEvents: completedEvents.length,
      notParticipatedCount: notParticipatedUsers.length,
      leaveEventCount: leaveEventUsers.length,
      lateEventCount: lateEventUsers.length,
      notParticipatedUsers,
      leaveEventUsers,
      lateEventUsers,
    };
  }, [events]);

  const eventStats = useMemo(() => {
    const branchFilter = user?.role === "superadmin" ? selectedBranch : (user?.provinceCode || user?.branch || "all");
    return calculateEventStats(branchFilter);
  }, [selectedBranch, user, calculateEventStats]);

  // Combine locations
  const mappingLocations: LocationWithStatus[] = locations.map((loc, index) => ({
    ...loc,
    type: "mapping" as const,
    team: loc.team || ["ทีมพัฒนา", "ทีมการตลาด", "ทีมปฏิบัติการ"][index % 3],
    time: loc.time || ["09:15 น.", "09:32 น.", "08:45 น."][index % 3],
    checkInStatus: "พื้นที่อนุญาต",
    statusColor: "text-green-600",
  }));

  const eventLocations: LocationWithStatus[] = events.map((evt) => ({
    id: `event-${evt.id}`,
    name: evt.locationName,
    description: `งาน: ${evt.name}`,
    latitude: evt.latitude,
    longitude: evt.longitude,
    radius: evt.radius,
    type: "event" as const,
    team: evt.teams ? evt.teams.join(", ") : "ไม่ระบุ",
    time: evt.startTime || "ไม่ระบุ",
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
                        <div className="w-12 h-12 bg-primaryMain rounded-full flex items-center justify-center text-white font-bold text-lg flex-shrink-0">
                          {index + 1}
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold text-primaryMain text-lg">{user.name}</h3>
                          <p className="text-sm text-textMain">{user.department} - {user.position}</p>
                          {user.email && <p className="text-xs text-textMain/70 mt-1">{user.email}</p>}
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
                className="appearance-none px-4 py-2.5 pr-10 border-2 border-borderMain rounded-lg text-sm font-medium text-primaryMain hover:border-accentMain focus:border-accentMain focus:ring-2 focus:ring-accentMain/20 transition-all outline-none cursor-pointer bg-white min-w-[200px]"
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
              <div className="w-full md:w-1/2 h-[300px]">
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
                      label={({ name, percent }) => 
                        `${name} ${(percent * 100).toFixed(0)}%`
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
              <div className="h-[500px] rounded-lg overflow-hidden border border-borderMain">
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
