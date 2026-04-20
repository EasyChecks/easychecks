"use client";

import React, { useState, useMemo, useEffect, useCallback, useRef } from "react";
import dynamic from "next/dynamic";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  X,
  Search,
  Map as MapIcon,
  Satellite,
  AlertTriangle,
  CalendarIcon,
  ChevronDown,
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { format } from "date-fns";
import { th } from "date-fns/locale";
import dashboardService, { AttendanceSummary as DashboardSummary, EmployeeToday, BranchMapItem, LocationEvent, EventStatsResponse } from "@/services/dashboardService";
import { attendanceService } from "@/services/attendance";
import { Attendance } from "@/types/attendance";
import eventService, { EventItem as ApiEventItem } from "@/services/eventService";
import locationService, { LocationItem } from "@/services/locationService";
import type { DivIcon } from 'leaflet';


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
const MapController = dynamic(
  async () => {
    const { useMap } = await import('react-leaflet');
    const { useEffect } = await import('react');
    function Controller({ center, zoom }: { center: [number, number] | null; zoom: number }) {
      const map = useMap();
      useEffect(() => {
        if (!center) return;
        map.flyTo(center, zoom, { duration: 1.5 });
      }, [center, zoom, map]);
      return null;
    }
    return Controller;
  },
  { ssr: false }
);


// SVG icon HTML shared with EventMap (mapping-events page)
const LOCATION_ICON_HTML = `<svg width="32" height="42" viewBox="0 0 32 42" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 3px 6px rgba(29,78,216,0.5))"><path d="M16 2C8.27 2 2 8.27 2 16c0 9.94 14 28 14 28S30 25.94 30 16C30 8.27 23.73 2 16 2z" fill="#2563eb"/><circle cx="16" cy="16" r="5" fill="white"/></svg>`;
const EVENT_ICON_HTML = `<svg width="32" height="42" viewBox="0 0 32 42" xmlns="http://www.w3.org/2000/svg" style="filter:drop-shadow(0 3px 6px rgba(194,65,12,0.5))"><path d="M16 2C8.27 2 2 8.27 2 16c0 9.94 14 28 14 28S30 25.94 30 16C30 8.27 23.73 2 16 2z" fill="#ea580c"/><circle cx="16" cy="16" r="5" fill="white"/></svg>`;

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
  joinedUsers: User[];
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
type DetailType = "absent" | "leave" | "late" | "notParticipated" | "onTime" | "joined";

// Donut Chart Colors
const CHART_COLORS = {
  onTime: "#047857",
  late: "#F97316",
  leave: "#3B82F6",
  absent: "#EF4444",
};

export default function AdminDashboard() {
  useAuth();

  // States
  const [selectedBranch, setSelectedBranch] = useState("all");
  const [statsType, setStatsType] = useState<StatsType>("attendance");

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
  const [locationEvents, setLocationEvents] = useState<LocationEvent[]>([]);
  const [attendanceLogs, setAttendanceLogs] = useState<Attendance[]>([]);

  const [isLoading, setIsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [calendarOpen, setCalendarOpen] = useState(false);
  const [tablePage, setTablePage] = useState(1);

  // Per-event stats
  const [selectedEventId, setSelectedEventId] = useState<number | null>(null);
  const [perEventStats, setPerEventStats] = useState<EventStatsResponse | null>(null);
  const [perEventStatsLoading, setPerEventStatsLoading] = useState(false);
  const [mapFlyTarget, setMapFlyTarget] = useState<{ center: [number, number]; zoom: number } | null>(null);
  const mapHomeRef = useRef<{ center: [number, number]; zoom: number } | null>(null);
  const [mapIcons, setMapIcons] = useState<{ location: DivIcon; event: DivIcon } | null>(null);

  useEffect(() => {
    import('leaflet').then((L) => {
      const iconOpts = { className: '', iconSize: [32, 42] as [number, number], iconAnchor: [16, 42] as [number, number], popupAnchor: [0, -44] as [number, number] };
      setMapIcons({
        location: L.divIcon({ ...iconOpts, html: LOCATION_ICON_HTML }),
        event: L.divIcon({ ...iconOpts, html: EVENT_ICON_HTML }),
      });
    });
  }, []);

  // Refs to avoid stale closure in WebSocket handler
  const selectedBranchRef = useRef(selectedBranch);
  const selectedDateRef = useRef(selectedDate);
  const selectedEventIdRef = useRef(selectedEventId);
  useEffect(() => { selectedBranchRef.current = selectedBranch; }, [selectedBranch]);
  useEffect(() => { selectedDateRef.current = selectedDate; }, [selectedDate]);
  useEffect(() => { selectedEventIdRef.current = selectedEventId; }, [selectedEventId]);

  // Branch options: dynamic from API (filter out seed data branches matching "สาขา BR...")
  const branchOptions: BranchOption[] = useMemo(() => [
    { code: "all", name: "สาขา: ทั้งหมด" },
    ...branchesMap
      .filter(b => !/^สาขา\s+BR/i.test(b.name))
      .map(b => ({ code: String(b.branchId), name: b.name })),
  ], [branchesMap]);

  // ── Fetch dashboard data when branch or date changes ──
  const fetchDashboardData = useCallback(async (branchIdNum: number | undefined, dateParam: string | undefined) => {
    try {
      const dateStr = dateParam ?? format(new Date(), 'yyyy-MM-dd');
      const [summary, employees, branches, eventsResp, locations, logsResp] = await Promise.all([
        dashboardService.getAttendanceSummary(branchIdNum, dateParam),
        dashboardService.getEmployeesToday(branchIdNum, dateParam),
        dashboardService.getBranchesMap(),
        eventService.getAll({ take: 100, branchId: branchIdNum }),
        locationService.getAll(),
        attendanceService.getAll({ startDate: dateStr, endDate: dateStr }),
      ]);
      setDashboardSummary(summary);
      setEmployeesToday(employees.data);
      setBranchesMap(branches.data);
      setApiEvents(eventsResp.data);
      setApiLocations(locations.data);
      setAttendanceLogs(logsResp);
      const [locEventsResult] = await Promise.allSettled([
        dashboardService.getLocationEvents(branchIdNum, dateParam),
      ]);
      if (locEventsResult.status === 'fulfilled') setLocationEvents(locEventsResult.value.data);
    } catch (err) {
      console.error('[Dashboard] Failed to fetch data:', err);
    }
  }, []);

  useEffect(() => {
    const branchIdNum =
      selectedBranch !== "all" ? parseInt(selectedBranch, 10) : undefined;
    const dateStr = format(selectedDate, 'yyyy-MM-dd');
    const isToday = format(new Date(), 'yyyy-MM-dd') === dateStr;
    const dateParam = isToday ? undefined : dateStr;

    setSelectedEventId(null);

    const fetchData = async () => {
      setIsLoading(true);
      await fetchDashboardData(branchIdNum, dateParam);
      setIsLoading(false);
    };

    fetchData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBranch, selectedDate, fetchDashboardData]);

  // ── Fetch per-event stats when selectedEventId changes ──
  useEffect(() => {
    if (selectedEventId === null) {
      setPerEventStats(null);
      return;
    }
    let cancelled = false;
    setPerEventStatsLoading(true);
    dashboardService.getEventStats(selectedEventId)
      .then((data) => { if (!cancelled) setPerEventStats(data); })
      .catch((err) => console.error('[Dashboard] event stats error:', err))
      .finally(() => { if (!cancelled) setPerEventStatsLoading(false); });
    return () => { cancelled = true; };
  }, [selectedEventId]);

  // ── Real-time WebSocket for attendance updates ──
  useEffect(() => {
    const wsBase =
      process.env.NEXT_PUBLIC_WS_URL ||
      (process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api')
        .replace(/^http/, 'ws')
        .replace('/api', '');

    if (wsBase.includes('onrender.com') || wsBase.includes('vercel.app')) return;

    const url = `${wsBase}/ws/attendance`;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      ws = new WebSocket(url);

      ws.onopen = () => {
        console.log('[WS] Connected to', url);
      };

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg.type === 'attendance_update') {
            const branch = selectedBranchRef.current;
            const date = selectedDateRef.current;
            const branchIdNum = branch !== 'all' ? parseInt(branch, 10) : undefined;
            const dateStr = format(date, 'yyyy-MM-dd');
            const isToday = format(new Date(), 'yyyy-MM-dd') === dateStr;
            const dateParam = isToday ? undefined : dateStr;
            fetchDashboardData(branchIdNum, dateParam);
            const evtId = selectedEventIdRef.current;
            if (evtId !== null) {
              dashboardService.getEventStats(evtId)
                .then((data) => setPerEventStats(data))
                .catch(() => {});
            }
          }
        } catch {
          // ignore parse errors
        }
      };

      ws.onclose = () => {
        reconnectTimer = setTimeout(connect, 5000);
      };

      ws.onerror = () => {
        ws?.close();
      };
    };

    connect();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      ws?.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fetchDashboardData]);

  // ── Map attendanceLogs → AttendanceStats (same source as attendance-log page) ──
  const attendanceStats = useMemo((): AttendanceStats => {
    const fmtTime = (iso?: string) =>
      iso ? new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' }) : '';
    const toUser = (r: Attendance, idx: number): User => ({
      id: String(r.id ?? idx),
      name: r.user?.name ?? '-',
      department: r.user?.employeeId ?? '',
      position: '',
      avatar: r.user?.avatarUrl ?? '',
      time: fmtTime(r.checkIn),
      status: r.status,
    });
    const onTimeUsers = attendanceLogs.filter(r => r.status === 'ON_TIME').map(toUser);
    const lateUsers   = attendanceLogs.filter(r => r.status === 'LATE' || r.status === 'LATE_APPROVED').map(toUser);
    const leaveUsers  = attendanceLogs.filter(r => r.status === 'LEAVE_APPROVED').map(toUser);
    const absentUsers = attendanceLogs.filter(r => r.status === 'ABSENT').map(toUser);
    return {
      totalEmployees: attendanceLogs.length,
      absentCount:    absentUsers.length,
      leaveCount:     leaveUsers.length,
      lateCount:      lateUsers.length,
      onTimeCount:    onTimeUsers.length,
      absentUsers,
      leaveUsers,
      lateUsers,
      onTimeUsers,
    };
  }, [attendanceLogs]);

  // ── Map API events → EventStats ──
  const eventStats = useMemo((): EventStats => {
    const now = new Date();
    const activeEvts  = apiEvents.filter(e => e.isActive && new Date(e.startDateTime) <= now && new Date(e.endDateTime) >= now);
    const todayEvts   = apiEvents.filter(e => {
      const d = new Date(e.startDateTime);
      return d.toDateString() === now.toDateString();
    });
    const completedEvts = apiEvents.filter(e => new Date(e.endDateTime) < now);
    const joinedUsers = employeesToday
      .filter(e => e.eventId != null)
      .map((e, idx) => ({
        id: String(e.employeeId || idx),
        name: e.name,
        department: e.branch || '',
        position: '',
        avatar: '',
        time: e.checkIn || '',
        status: e.status,
      }));
    return {
      totalEvents:          apiEvents.length,
      activeEvents:         joinedUsers.length,
      todayEvents:          todayEvts.length,
      completedEvents:      completedEvts.length,
      notParticipatedCount: 0,
      leaveEventCount:      0,
      lateEventCount:       0,
      notParticipatedUsers: [],
      leaveEventUsers:      [],
      lateEventUsers:       [],
      joinedUsers,
    };
  }, [apiEvents, employeesToday]);

  // ── Filter events for display (date + branch) ──
  // วันนี้ → แสดงเฉพาะ ongoing/upcoming เรียงใกล้สุด
  // วันอื่น → แสดงกิจกรรมที่ overlap กับวันนั้น
  const displayedEvents = useMemo(() => {
    const dayStart = new Date(selectedDate);
    dayStart.setHours(0, 0, 0, 0);
    const dayEnd = new Date(selectedDate);
    dayEnd.setHours(23, 59, 59, 999);

    const filtered = apiEvents.filter(e => {
      const start = new Date(e.startDateTime);
      const end = new Date(e.endDateTime);
      return start <= dayEnd && end >= dayStart;
    });

    return filtered.sort(
      (a, b) => new Date(a.startDateTime).getTime() - new Date(b.startDateTime).getTime()
    );
  }, [apiEvents, selectedDate, selectedBranch, branchesMap]);

  // Combine locations from API data
  const mappingLocations: LocationWithStatus[] = apiLocations
    .filter((loc) => loc.isActive)
    .map((loc) => ({
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

  const eventLocations: LocationWithStatus[] = displayedEvents
    .filter(evt => evt.location?.latitude != null || evt.venueLatitude != null)
    .map((evt) => ({
      id: `event-${evt.eventId}`,
      name: evt.location?.locationName ?? evt.venueName ?? 'พื้นที่กำหนดเอง',
      description: `งาน: ${evt.eventName}`,
      latitude: evt.location?.latitude ?? evt.venueLatitude!,
      longitude: evt.location?.longitude ?? evt.venueLongitude!,
      radius: evt.location?.radius ?? 500,
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

  // ── คำนวณจุดกลางแผนที่ตามสาขาที่เลือก ──
  const mapCenter: [number, number] = useMemo(() => {
    if (selectedBranch !== "all" && branchesMap.length > 0 && apiLocations.length > 0) {
      const branch = branchesMap.find(b => String(b.branchId) === selectedBranch);
      if (branch) {
        const matchedLoc = apiLocations.find(
          loc => loc.locationName.includes(branch.name) || branch.name.includes(loc.locationName)
        );
        if (matchedLoc) return [matchedLoc.latitude, matchedLoc.longitude] as [number, number];
      }
    }
    // ทั้งหมด: ใช้ location สำนักงานใหญ่ถ้าเจอ
    const hq = apiLocations.find(loc => loc.locationName.includes('สำนักงานใหญ่'));
    if (hq) return [hq.latitude, hq.longitude] as [number, number];
    return [13.7563, 100.5018] as [number, number];
  }, [selectedBranch, branchesMap, apiLocations]);

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
      if (perEventStats) {
        if (perEventStats.isOpenEvent) {
          return [
            { name: "เข้าร่วม", value: perEventStats.joinedCount, color: CHART_COLORS.onTime },
          ];
        }
        return [
          { name: "เข้าร่วม", value: perEventStats.joinedCount, color: CHART_COLORS.onTime },
          { name: "ยังไม่เข้าร่วม", value: perEventStats.notJoinedCount, color: CHART_COLORS.absent },
        ];
      }
      // ไม่ได้เลือกกิจกรรม → ไม่แสดงข้อมูลการเข้าของพนักงาน
      return [];
    }
  }, [statsType, attendanceStats, perEventStats]);

  // Handlers
  const handleDetailClick = (type: DetailType, users: User[]) => {
    setDetailType(type);
    setDetailUsers(users);
    setShowDetailModal(true);
  };

  const getDetailTitle = () => {
    if (statsType === "attendance") {
      switch (detailType) {
        case "onTime": return "รายชื่อพนักงานที่มาตรงเวลา";
        case "absent": return "รายชื่อพนักงานที่ขาดงาน";
        case "leave": return "รายชื่อพนักงานที่ลางาน";
        case "late": return "รายชื่อพนักงานที่มาสาย";
        default: return "รายละเอียด";
      }
    } else {
      switch (detailType) {
        case "joined": return "รายชื่อผู้เข้าร่วมกิจกรรม";
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
      case 'ON_TIME':        return { text: 'ตรงเวลา',       cls: 'bg-green-100 text-green-800'  };
      case 'LATE':           return { text: 'สาย',            cls: 'bg-yellow-100 text-yellow-800'};
      case 'LATE_APPROVED':  return { text: 'สาย (อนุมัติ)', cls: 'bg-amber-100 text-amber-800'  };
      case 'ABSENT':         return { text: 'ขาด',            cls: 'bg-red-100 text-red-800'      };
      case 'LEAVE_APPROVED': return { text: 'ลา (อนุมัติ)',  cls: 'bg-blue-100 text-blue-800'    };
      default:               return { text: status,           cls: 'bg-gray-100 text-gray-800'    };
    }
  };

  const totalChartSum = donutChartData.reduce((a, b) => a + b.value, 0);
  const totalChart = totalChartSum || 1;

  return (
    <div className="min-h-screen bg-secondaryMain">
      {/* Detail Modal */}
      {showDetailModal && (
        <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center p-4">
          <Card className="w-full max-w-sm max-h-[70vh] overflow-hidden">
            <div className="border-b border-borderMain flex flex-row items-center justify-between py-3 px-4">
              <span className="text-sm font-semibold text-primaryMain">{getDetailTitle()}</span>
              <button
                onClick={() => setShowDetailModal(false)}
                className="text-textMain/60 hover:text-textMain ml-2 shrink-0"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <CardContent className="p-3 overflow-y-auto max-h-[calc(70vh-56px)]">
              {detailUsers.length === 0 ? (
                <div className="text-center py-6 text-textMain/60">
                  <p className="text-sm">ไม่มีข้อมูล</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {detailUsers.map((user, index) => (
                    <div
                      key={`${user.id}-${index}`}
                      className="bg-secondaryMain rounded-lg p-3 border border-borderMain hover:border-primaryMain transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full overflow-hidden shrink-0 bg-gradient-to-br from-orange-400 to-orange-600 flex items-center justify-center">
                          {user.avatar ? (
                            <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
                          ) : (
                            <span className="text-white font-bold text-sm">{user.name.charAt(0).toUpperCase()}</span>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-primaryMain text-sm truncate">{user.name}</p>
                          <p className="text-xs text-textMain/70 truncate">{user.department}{user.position ? ` - ${user.position}` : ''}</p>
                          {user.time && <p className="text-xs text-textMain/50 mt-0.5">{user.time}</p>}
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
          <div className="relative">
            <select
              value={selectedBranch}
              onChange={(e) => setSelectedBranch(e.target.value)}
              className="appearance-none pl-4 pr-10 py-2.5 border-2 border-borderMain rounded-lg text-sm font-medium text-primaryMain hover:border-accentMain focus:border-accentMain focus:ring-2 focus:ring-accentMain/20 outline-none cursor-pointer bg-white min-w-48"
            >
              {branchOptions.map((b) => (
                <option key={b.code} value={b.code}>{b.name}</option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-primaryMain" />
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
            <div className="absolute top-3 left-12 right-3 z-999 flex gap-2 flex-wrap">
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
                  <Button key={f} size="sm" variant="ghost"
                    onClick={() => setFilterType(f)}
                    style={filterType === f ? { backgroundColor: '#0f172a', color: '#fff' } : { backgroundColor: '#fff', color: '#334155' }}
                    className="text-xs shadow-md border border-gray-300 rounded-md"
                  >
                    {{ all: 'ทั้งหมด', location: 'พื้นที่', event: 'กิจกรรม' }[f]}
                  </Button>
                ))}
                <Button size="sm" variant="ghost"
                  onClick={() => setMapType('default')}
                  style={mapType === 'default' ? { backgroundColor: '#0f172a', color: '#fff' } : { backgroundColor: '#fff', color: '#334155' }}
                  className="shadow-md border border-gray-300 rounded-md"
                ><MapIcon className="h-4 w-4" /></Button>
                <Button size="sm" variant="ghost"
                  onClick={() => setMapType('satellite')}
                  style={mapType === 'satellite' ? { backgroundColor: '#0f172a', color: '#fff' } : { backgroundColor: '#fff', color: '#334155' }}
                  className="shadow-md border border-gray-300 rounded-md"
                ><Satellite className="h-4 w-4" /></Button>
              </div>
            </div>

            {/* Map itself */}
            {typeof window !== 'undefined' && filteredLocations.length > 0 ? (
              <MapContainer
                key={`map-${selectedBranch}`}
                center={mapCenter}
                zoom={selectedBranch !== "all" ? 15 : 11}
                className="h-full w-full"
              >
                <TileLayer attribution={getTileLayerAttribution()} url={getTileLayerUrl()} />
                <MapController center={mapFlyTarget?.center ?? null} zoom={mapFlyTarget?.zoom ?? 16} />
                {filteredLocations.map((location) => {
                  const isEvent = location.type === 'event';
                  const icon = isEvent ? mapIcons?.event : mapIcons?.location;
                  return (
                    <React.Fragment key={location.id}>
                      <Marker position={[location.latitude, location.longitude]} icon={icon ?? undefined}>
                        <Popup>
                          <div style={{ padding: '4px 2px' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 6 }}>
                              <div style={{ width: 8, height: 8, borderRadius: '50%', background: isEvent ? '#f97316' : '#2563eb', flexShrink: 0 }} />
                              <span style={{ fontWeight: 700, fontSize: 14, color: '#1f2937', lineHeight: 1.3 }}>{location.name}</span>
                            </div>
                            {location.description && <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}>{location.description}</div>}
                            <div style={{ fontSize: 11, color: isEvent ? '#f97316' : '#2563eb', marginTop: 4, padding: '3px 6px', background: isEvent ? '#fef9ef' : '#eff6ff', borderRadius: 4 }}>
                              {location.checkInStatus}
                            </div>
                          </div>
                        </Popup>
                      </Marker>
                      <Circle
                        center={[location.latitude, location.longitude]}
                        radius={location.radius}
                        pathOptions={isEvent
                          ? { color: '#f97316', weight: 2, dashArray: '6 4', fillColor: '#f97316', fillOpacity: 0.08 }
                          : { color: '#2563eb', weight: 2, dashArray: '6 4', fillColor: '#3b82f6', fillOpacity: 0.08 }
                        }
                      />
                    </React.Fragment>
                  );
                })}
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

          {/* Location Events Alert (endpoint #4) */}
          {locationEvents.length > 0 && (
            <div className="border-t-2 border-borderMain bg-amber-50 px-4 py-2 shrink-0">
              <div className="flex items-center gap-2 mb-1">
                <AlertTriangle className="h-4 w-4 text-amber-600" />
                <span className="text-xs font-semibold text-amber-700">แจ้งเตือน: Check-in นอกพื้นที่ ({locationEvents.length} รายการ)</span>
              </div>
              <div className="space-y-1 max-h-24 overflow-y-auto">
                {locationEvents.map((evt) => (
                  <div key={evt.eventId} className="flex items-center justify-between text-xs bg-white rounded px-2 py-1 border border-amber-200">
                    <span className="text-textMain font-medium">{evt.employeeName}</span>
                    <span className="text-textMain/60">{evt.expectedLocation}</span>
                    <span className="text-amber-700 font-mono">{evt.actualDistance}m / {evt.allowedRadius}m</span>
                    <span className="text-textMain/50">{evt.checkInTime}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Activity Log — สลับตาม tab การเข้างาน / กิจกรรม */}
          <div className="border-t-2 border-borderMain bg-white flex flex-col flex-1 min-h-0">
            <div className="px-4 py-2 border-b border-borderMain flex items-center justify-between shrink-0">
              <h3 className="text-sm font-semibold text-primaryMain">
                {statsType === 'attendance'
                  ? 'บันทึกการเข้างาน'
                  : (selectedEventId && (perEventStatsLoading || perEventStats))
                    ? 'รายชื่อผู้เข้าร่วม'
                    : 'รายการกิจกรรม'}
              </h3>
              <span className="text-xs text-textMain/60">
                {statsType === 'attendance'
                  ? `${attendanceLogs.length} รายการ`
                  : (selectedEventId && perEventStats)
                    ? `${perEventStats.isOpenEvent ? perEventStats.joinedCount : perEventStats.joinedCount + perEventStats.notJoinedCount} คน`
                    : `${displayedEvents.length} รายการ`}
              </span>
            </div>
            <div className="overflow-y-auto flex-1">
              {statsType === 'attendance' ? (() => {
                const PAGE_SIZE = 10;
                const totalPages = Math.max(1, Math.ceil(attendanceLogs.length / PAGE_SIZE));
                const safePage = Math.min(tablePage, totalPages);
                const pageItems = attendanceLogs.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
                const fmtTime = (iso?: string) => {
                  if (!iso) return '-';
                  return new Date(iso).toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Bangkok' });
                };
                return (
                  <>
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-gray-50 border-b border-borderMain">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-textMain/70">พนักงาน</th>
                          <th className="px-3 py-2 text-left font-medium text-textMain/70">กะงาน</th>
                          <th className="px-3 py-2 text-left font-medium text-textMain/70">เข้างาน</th>
                          <th className="px-3 py-2 text-left font-medium text-textMain/70">ออกงาน</th>
                          <th className="px-3 py-2 text-left font-medium text-textMain/70">สถานะ</th>
                          <th className="px-3 py-2 text-left font-medium text-textMain/70">สาย</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-borderMain/50">
                        {attendanceLogs.length === 0 ? (
                          <tr><td colSpan={6} className="text-center py-6 text-gray-400">ไม่พบข้อมูล</td></tr>
                        ) : (
                          pageItems.map((r, idx) => {
                            const sl = statusLabel(r.status);
                            return (
                              <tr key={`${r.id}-${idx}`} className="hover:bg-gray-50 transition-colors">
                                <td className="px-3 py-2">
                                  <div className="font-medium text-textMain">{r.user?.name ?? '-'}</div>
                                  <div className="text-textMain/50 font-mono text-[10px]">{r.user?.employeeId ?? ''}</div>
                                </td>
                                <td className="px-3 py-2 text-textMain/70">
                                  {r.shift ? `${r.shift.name} (${r.shift.startTime}-${r.shift.endTime})` : '-'}
                                </td>
                                <td className="px-3 py-2 text-textMain/70">{fmtTime(r.checkIn)}</td>
                                <td className="px-3 py-2 text-textMain/70">{fmtTime(r.checkOut)}</td>
                                <td className="px-3 py-2">
                                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${sl.cls}`}>{sl.text}</span>
                                </td>
                                <td className="px-3 py-2 text-textMain/70">{(() => { const m = r.lateMinutes ?? 0; if (m <= 0) return '-'; const h = Math.floor(m / 60); const mn = m % 60; return h > 0 && mn > 0 ? `${h} ชม. ${mn} น.` : h > 0 ? `${h} ชม.` : `${mn} น.`; })()}</td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                    {totalPages > 1 && (
                      <div className="flex items-center justify-center gap-2 py-2 border-t border-borderMain text-xs">
                        <button onClick={() => setTablePage(p => Math.max(1, p - 1))} disabled={safePage === 1} className="px-2 py-1 rounded border border-borderMain disabled:opacity-40 hover:bg-gray-50">‹</button>
                        <span className="text-textMain/70">{safePage} / {totalPages}</span>
                        <button onClick={() => setTablePage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} className="px-2 py-1 rounded border border-borderMain disabled:opacity-40 hover:bg-gray-50">›</button>
                      </div>
                    )}
                  </>
                );
              })() : (() => {
                // ── Participant view when event is selected ──
                if (selectedEventId && (perEventStatsLoading || perEventStats)) {
                  if (perEventStatsLoading) {
                    return (
                      <div className="flex items-center justify-center py-12 text-gray-400">
                        <div className="text-center">
                          <div className="w-8 h-8 mx-auto mb-2 border-b-2 border-primaryMain rounded-full animate-spin" />
                          <p className="text-xs">กำลังโหลดข้อมูล...</p>
                        </div>
                      </div>
                    );
                  }
                  const participants = perEventStats!.isOpenEvent
                    ? perEventStats!.joined.map(p => ({ ...p, hasJoined: true }))
                    : [
                        ...perEventStats!.joined.map(p => ({ ...p, hasJoined: true })),
                        ...perEventStats!.notJoined.map(p => ({ ...p, hasJoined: false })),
                      ];
                  const PAGE_SIZE = 10;
                  const totalPages = Math.max(1, Math.ceil(participants.length / PAGE_SIZE));
                  const safePage = Math.min(tablePage, totalPages);
                  const pageItems = participants.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
                  return (
                    <>
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-gray-50 border-b border-borderMain">
                          <tr>
                            <th className="px-3 py-2 text-left font-medium text-textMain/70">ชื่อ</th>
                            <th className="px-3 py-2 text-left font-medium text-textMain/70">สาขา</th>
                            <th className="px-3 py-2 text-left font-medium text-textMain/70">เวลาเช็คอิน</th>
                            <th className="px-3 py-2 text-left font-medium text-textMain/70">สถานะ</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-borderMain/50">
                          {participants.length === 0 ? (
                            <tr><td colSpan={4} className="text-center py-6 text-gray-400">ไม่มีข้อมูลผู้เข้าร่วม</td></tr>
                          ) : (
                            pageItems.map((p, idx) => (
                              <tr key={`${p.name}-${idx}`} className="hover:bg-gray-50 transition-colors">
                                <td className="px-3 py-2 text-textMain font-medium">{p.name}</td>
                                <td className="px-3 py-2 text-textMain/70">{p.branch || '-'}</td>
                                <td className="px-3 py-2 text-textMain/70">{p.checkIn || '-'}</td>
                                <td className="px-3 py-2">
                                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                                    p.hasJoined ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                  }`}>
                                    {p.hasJoined ? 'เข้าร่วมแล้ว' : 'ยังไม่เข้าร่วม'}
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                      </table>
                      {totalPages > 1 && (
                        <div className="flex items-center justify-center gap-2 py-2 border-t border-borderMain text-xs">
                          <button onClick={() => setTablePage(p => Math.max(1, p - 1))} disabled={safePage === 1} className="px-2 py-1 rounded border border-borderMain disabled:opacity-40 hover:bg-gray-50">‹</button>
                          <span className="text-textMain/70">{safePage} / {totalPages}</span>
                          <button onClick={() => setTablePage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} className="px-2 py-1 rounded border border-borderMain disabled:opacity-40 hover:bg-gray-50">›</button>
                        </div>
                      )}
                    </>
                  );
                }
                // ── Events list ──
                const PAGE_SIZE = 10;
                const totalPages = Math.max(1, Math.ceil(displayedEvents.length / PAGE_SIZE));
                const safePage = Math.min(tablePage, totalPages);
                const pageItems = displayedEvents.slice((safePage - 1) * PAGE_SIZE, safePage * PAGE_SIZE);
                return (
                  <>
                    <table className="w-full text-xs">
                      <thead className="sticky top-0 bg-gray-50 border-b border-borderMain">
                        <tr>
                          <th className="px-3 py-2 text-left font-medium text-textMain/70">ชื่อกิจกรรม</th>
                          <th className="px-3 py-2 text-left font-medium text-textMain/70">สถานที่</th>
                          <th className="px-3 py-2 text-left font-medium text-textMain/70">เริ่ม</th>
                          <th className="px-3 py-2 text-left font-medium text-textMain/70">สิ้นสุด</th>
                          <th className="px-3 py-2 text-left font-medium text-textMain/70">สถานะ</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-borderMain/50">
                        {displayedEvents.length === 0 ? (
                          <tr><td colSpan={5} className="text-center py-6 text-gray-400">ไม่พบกิจกรรม</td></tr>
                        ) : (
                          pageItems.map((evt) => {
                            const now = new Date();
                            const start = new Date(evt.startDateTime);
                            const end = new Date(evt.endDateTime);
                            const isOngoing = evt.isActive && start <= now && end >= now;
                            const isUpcoming = start > now;
                            const evtStatus = isOngoing
                              ? { text: 'กำลังดำเนินการ', cls: 'bg-green-100 text-green-700' }
                              : isUpcoming
                                ? { text: 'กำลังจะมาถึง', cls: 'bg-blue-100 text-blue-700' }
                                : { text: 'สิ้นสุดแล้ว', cls: 'bg-gray-100 text-gray-600' };
                            const isSelected = selectedEventId === evt.eventId;
                            return (
                              <tr
                                key={evt.eventId}
                                onClick={() => {
                                  setSelectedEventId(isSelected ? null : evt.eventId);
                                  const lat = evt.location?.latitude ?? evt.venueLatitude;
                                  const lng = evt.location?.longitude ?? evt.venueLongitude;
                                  if (!isSelected && lat != null && lng != null) {
                                    // บันทึกตำแหน่งเดิมก่อน fly ไป event
                                    if (!mapHomeRef.current) {
                                      mapHomeRef.current = { center: mapCenter, zoom: selectedBranch !== 'all' ? 15 : 11 };
                                    }
                                    setMapFlyTarget({ center: [lat, lng], zoom: 16 });
                                  } else if (isSelected) {
                                    // fly กลับบ้าน
                                    if (mapHomeRef.current) {
                                      setMapFlyTarget(mapHomeRef.current);
                                      mapHomeRef.current = null;
                                    }
                                  }
                                }}
                                className={`cursor-pointer transition-colors ${isSelected ? 'bg-primaryMain/10 border-l-2 border-primaryMain' : 'hover:bg-gray-50'}`}
                              >
                                <td className="px-3 py-2 text-textMain font-medium">{evt.eventName}</td>
                                <td className="px-3 py-2 text-textMain/70">{evt.location?.locationName || '-'}</td>
                                <td className="px-3 py-2 text-textMain/70">{format(start, 'd MMM yy HH:mm', { locale: th })}</td>
                                <td className="px-3 py-2 text-textMain/70">{format(end, 'd MMM yy HH:mm', { locale: th })}</td>
                                <td className="px-3 py-2">
                                  <span className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${evtStatus.cls}`}>
                                    {evtStatus.text}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                    {totalPages > 1 && (
                      <div className="flex items-center justify-center gap-2 py-2 border-t border-borderMain text-xs">
                        <button onClick={() => setTablePage(p => Math.max(1, p - 1))} disabled={safePage === 1} className="px-2 py-1 rounded border border-borderMain disabled:opacity-40 hover:bg-gray-50">‹</button>
                        <span className="text-textMain/70">{safePage} / {totalPages}</span>
                        <button onClick={() => setTablePage(p => Math.min(totalPages, p + 1))} disabled={safePage === totalPages} className="px-2 py-1 rounded border border-borderMain disabled:opacity-40 hover:bg-gray-50">›</button>
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          </div>
        </div>

        {/* ───── RIGHT PANEL ───── */}
        <div className="w-80 shrink-0 border-l-2 border-borderMain bg-white flex flex-col overflow-y-auto">

          {/* Tabs */}
          <div className="flex shrink-0 border-b-2 border-borderMain">
            <button
              onClick={() => { setStatsType('attendance'); setTablePage(1); }}
              style={statsType === 'attendance' ? { color: '#F97316', borderBottom: '2px solid #F97316' } : {}}
              className={`flex-1 py-3 text-sm font-semibold transition-colors bg-white ${
                statsType === 'attendance' ? '' : 'text-textMain/60 hover:text-textMain bg-gray-50'
              }`}
            >
              การเข้างาน
            </button>
            <button
              onClick={() => { setStatsType('event'); setTablePage(1); }}
              style={statsType === 'event' ? { color: '#F97316', borderBottom: '2px solid #F97316' } : {}}
              className={`flex-1 py-3 text-sm font-semibold transition-colors border-l border-borderMain ${
                statsType === 'event' ? 'bg-white' : 'text-textMain/60 hover:text-textMain bg-gray-50'
              }`}
            >
              กิจกรรม
            </button>
          </div>

          {/* Date picker */}
          <div className="px-4 py-2 bg-gray-50 border-b border-borderMain shrink-0">
            <p className="text-xs text-textMain/60 mb-1">เลือกวันที่เพื่อดูข้อมูล</p>
            <Popover open={calendarOpen} onOpenChange={setCalendarOpen}>
              <PopoverTrigger asChild>
                <button className="flex items-center gap-2 w-full px-3 py-1.5 bg-white border border-borderMain rounded-lg text-sm font-medium text-primaryMain hover:border-accentMain transition-colors">
                  <CalendarIcon className="h-4 w-4 text-primaryMain/60" />
                  <span>{format(selectedDate, 'EEEE d MMMM yyyy', { locale: th })}</span>
                  {format(selectedDate, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd') && (
                    <span className="ml-auto text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full">วันนี้</span>
                  )}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(day) => { if (day) { setSelectedDate(day); setCalendarOpen(false); } }}
                  disabled={{ after: new Date() }}
                  defaultMonth={selectedDate}
                />
              </PopoverContent>
            </Popover>
          </div>

          {/* Donut Chart */}
          <div className="px-4 py-3 shrink-0">
            {statsType === 'event' && selectedEventId && (
              <div className="mb-2 flex items-center justify-between">
                <span className="text-xs font-medium text-primaryMain truncate max-w-[200px]">
                  {perEventStats?.eventName || '...'}
                  {perEventStats?.isOpenEvent && <span className="ml-1 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">เปิดทั่วไป</span>}
                </span>
                <button onClick={() => {
                  setSelectedEventId(null);
                  if (mapHomeRef.current) {
                    setMapFlyTarget(mapHomeRef.current);
                    mapHomeRef.current = null;
                  }
                }} className="text-textMain/40 hover:text-textMain/80 text-xs">✕</button>
              </div>
            )}
            {statsType === 'event' && !selectedEventId && (
              <p className="text-xs text-textMain/50 mb-2 text-center">คลิกที่กิจกรรมเพื่อดูสถิติ</p>
            )}
            <div className="h-52">
              {donutChartData.every(d => d.value === 0) ? (
                <div className="h-full flex flex-col items-center justify-center text-textMain/40">
                  <div className="w-28 h-28 rounded-full border-8 border-gray-200 flex items-center justify-center">
                    <span className="text-xs text-center">ยังไม่มี<br/>ข้อมูล</span>
                  </div>
                </div>
              ) : (
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
              )}
            </div>
          </div>

          {/* Legend rows — clickable */}
          <div className="px-4 pb-4 space-y-2 shrink-0">
            {donutChartData.map((item) => {
              let detailFn: (() => void) | undefined;
              if (statsType === 'attendance') {
                if (item.name === 'ตรงเวลา') detailFn = () => handleDetailClick('onTime', attendanceStats.onTimeUsers);
                if (item.name === 'ขาดงาน') detailFn = () => handleDetailClick('absent', attendanceStats.absentUsers);
                if (item.name === 'ลางาน')  detailFn = () => handleDetailClick('leave',  attendanceStats.leaveUsers);
                if (item.name === 'มาสาย')  detailFn = () => handleDetailClick('late',   attendanceStats.lateUsers);
              } else if (perEventStats) {
                if (item.name === 'เข้าร่วม') detailFn = () => handleDetailClick('joined', perEventStats.joined.map((p, i) => ({ id: String(i), name: p.name, department: p.branch, position: '', avatar: '', time: p.checkIn || '', status: p.status || '' })));
                if (item.name === 'ยังไม่เข้าร่วม') detailFn = () => handleDetailClick('notParticipated', perEventStats.notJoined.map((p, i) => ({ id: String(i), name: p.name, department: p.branch, position: '', avatar: '', time: '', status: '' })));
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
            {statsType === 'attendance' ? (
              <>
                <div className="flex justify-between text-xs">
                  <span className="text-textMain/60">สรุปยอดพนักงาน (ตามสถิติ)</span>
                  <span className="font-bold text-primaryMain">{totalChartSum} คน</span>
                </div>
              </>
            ) : (
              <>
                <div className="flex justify-between text-xs">
                  <span className="text-textMain/60">กิจกรรมทั้งหมด</span>
                  <span className="font-bold text-primaryMain">{displayedEvents.length} รายการ</span>
                </div>
                {perEventStats ? (
                  <>
                    {!perEventStats.isOpenEvent && (
                      <div className="flex justify-between text-xs">
                        <span className="text-textMain/60">เป้าหมาย</span>
                        <span className="font-bold text-primaryMain">{perEventStats.joinedCount + perEventStats.notJoinedCount} คน</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs">
                      <span className="text-textMain/60">มาแล้ว</span>
                      <span className="font-bold text-emerald-600">{perEventStatsLoading ? '...' : perEventStats.joinedCount} คน</span>
                    </div>
                    {!perEventStats.isOpenEvent && (
                      <div className="flex justify-between text-xs">
                        <span className="text-textMain/60">ยังไม่มา</span>
                        <span className="font-bold text-red-500">{perEventStatsLoading ? '...' : perEventStats.notJoinedCount} คน</span>
                      </div>
                    )}
                  </>
                ) : null}
              </>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
