// Mock Contexts สำหรับ Dashboard
"use client";

import { createContext, useContext, ReactNode } from "react";

interface User {
  id: number;
  name: string;
  email: string;
  role: "user" | "admin" | "superadmin";
  provinceCode?: string;
  branch?: string;
  branchCode?: string;
  department?: string;
  position?: string;
  attendanceRecords?: AttendanceRecord[];
}

interface AttendanceRecord {
  date: string;
  status?: string;
  checkIn?: {
    status: string;
    time?: string;
  };
  checkOut?: {
    time?: string;
  };
}

interface Location {
  id: string;
  name: string;
  description?: string;
  latitude: number;
  longitude: number;
  radius: number;
  createdBy?: {
    branch?: string;
  };
  branchCode?: string;
  provinceCode?: string;
  team?: string;
  time?: string;
}

interface Event {
  id: string;
  name: string;
  locationName: string;
  latitude: number;
  longitude: number;
  radius: number;
  status: "ongoing" | "completed" | "upcoming";
  date?: string;
  startDate?: string;
  startTime?: string;
  teams?: string[];
  createdBy?: {
    branch?: string;
  };
  branchCode?: string;
  provinceCode?: string;
}

interface AuthContextType {
  user: User | null;
}

interface LocationContextType {
  getFilteredLocations: (user: User | null) => Location[];
}

interface EventContextType {
  getFilteredEvents: (user: User | null) => Event[];
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);
const LocationContext = createContext<LocationContextType | undefined>(undefined);
const EventContext = createContext<EventContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    // Mock user for development
    return {
      user: {
        id: 1,
        name: "Admin User",
        email: "admin@example.com",
        role: "superadmin" as const,
        provinceCode: "BKK",
        branch: "BKK",
        branchCode: "101",
      },
    };
  }
  return context;
}

export function useLocations() {
  const context = useContext(LocationContext);
  if (!context) {
    // Mock locations for development
    return {
      getFilteredLocations: () => [
        {
          id: "loc-1",
          name: "สำนักงานใหญ่ กรุงเทพ",
          description: "สำนักงานใหญ่ บริษัท",
          latitude: 13.7563,
          longitude: 100.5018,
          radius: 100,
          branchCode: "101",
          provinceCode: "BKK",
          team: "ทีมพัฒนา",
          time: "09:00 น.",
        },
        {
          id: "loc-2",
          name: "สาขาเชียงใหม่",
          description: "สาขาภาคเหนือ",
          latitude: 18.7883,
          longitude: 98.9853,
          radius: 150,
          branchCode: "201",
          provinceCode: "CNX",
          team: "ทีมการตลาด",
          time: "08:30 น.",
        },
        {
          id: "loc-3",
          name: "สาขาภูเก็ต",
          description: "สาขาภาคใต้",
          latitude: 7.8804,
          longitude: 98.3923,
          radius: 120,
          branchCode: "301",
          provinceCode: "PKT",
          team: "ทีมปฏิบัติการ",
          time: "09:15 น.",
        },
      ],
    };
  }
  return context;
}

export function useEvents() {
  const context = useContext(EventContext);
  if (!context) {
    // Mock events for development
    return {
      getFilteredEvents: () => [
        {
          id: "evt-1",
          name: "ประชุมใหญ่ประจำปี",
          locationName: "ห้องประชุมชั้น 5",
          latitude: 13.7563,
          longitude: 100.5018,
          radius: 50,
          status: "ongoing" as const,
          startDate: "07/02/2026",
          startTime: "09:00 น.",
          teams: ["ทีมพัฒนา", "ทีมการตลาด"],
          branchCode: "101",
          provinceCode: "BKK",
        },
        {
          id: "evt-2",
          name: "อบรมพนักงานใหม่",
          locationName: "ห้องฝึกอบรม",
          latitude: 18.7883,
          longitude: 98.9853,
          radius: 80,
          status: "upcoming" as const,
          startDate: "08/02/2026",
          startTime: "10:00 น.",
          teams: ["ทีมปฏิบัติการ"],
          branchCode: "201",
          provinceCode: "CNX",
        },
      ],
    };
  }
  return context;
}

// Mock usersData
export const usersData = [
  {
    id: 1,
    name: "สมชาย ใจดี",
    email: "somchai@example.com",
    role: "user" as const,
    department: "การตลาด",
    position: "พนักงาน",
    branchCode: "101",
    provinceCode: "BKK",
    attendanceRecords: [],
  },
  {
    id: 2,
    name: "วิภา สุขใจ",
    email: "wipa@example.com",
    role: "user" as const,
    department: "ขาย",
    position: "หัวหน้าทีม",
    branchCode: "101",
    provinceCode: "BKK",
    attendanceRecords: [],
  },
  {
    id: 3,
    name: "ชัยวัฒน์ รักดี",
    email: "chaiwat@example.com",
    role: "user" as const,
    department: "IT",
    position: "นักพัฒนา",
    branchCode: "201",
    provinceCode: "CNX",
    attendanceRecords: [],
  },
];

export type { User, Location, Event, AttendanceRecord };
