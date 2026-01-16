import React, { Suspense, lazy } from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider, Navigate } from "react-router-dom";
import "./index.css";
import ProtectedRoute from "./components/ProtectedRoute.jsx";
import { AuthProvider } from "./contexts/AuthProvider.jsx";
import { LeaveProvider } from "./contexts/LeaveContext.jsx";
import { TeamProvider } from "./contexts/TeamContext.jsx";
import { LoadingProvider } from "./contexts/LoadingContext.jsx";
import { LocationProvider } from "./contexts/LocationContext.jsx";
import { EventProvider } from "./contexts/EventContext.jsx";
import PuffLoader from "./components/common/PuffLoader.jsx";
import { initializeUsersData } from "./data/usersData.js";
import ErrorBoundary from "./components/common/ErrorBoundary.jsx"; // 🔥 เพิ่ม ErrorBoundary
import NotFoundPage from "./pages/NotFound.jsx"; // 🔥 เพิ่ม 404 Page

// ✅ Initialize usersData ใน localStorage ตอนเริ่มต้น
initializeUsersData();

// Import Auth และ Layout แบบปกติเพื่อความเร็ว (ใช้บ่อย)
import Auth from "./pages/Auth/Auth.jsx";
import Layout from "./pages/user/layout/Layout.jsx";
import AdminLayout from "./pages/admin/layout/layout.jsx";
import UserDashboard from "./pages/user/UserDashboard.jsx";
import Attendance from "./pages/admin/Attendance/Attendance.jsx";
import Warning from "./pages/admin/Warning/Warning.jsx";

// Lazy load หน้าที่ใช้น้อย
const AdminDashboard = lazy(() => import("./pages/admin/AdminDashboard.jsx"));
const GroupNotificationScreen = lazy(() => import("./pages/admin/GroupNotification/GroupNotificationScreen.jsx"));
const AdminManageUser = lazy(() => import("./pages/admin/AdminManageUser.jsx"));
const DownloadData = lazy(() => import("./pages/admin/DownloadData.jsx"));
const MappingAndEvents = lazy(() => import("./pages/admin/MappingAndEvents.jsx"));
const LeaveQuotaManagement = lazy(() => import("./pages/admin/LeaveQuotaManagement.jsx"));
const TakePhoto = lazy(() => import("./pages/user/takept/takept.jsx"));
const LeaveScreen = lazy(() => import("./pages/user/Leave/LeaveScreen.jsx"));
const LeaveDetail = lazy(() => import("./pages/user/Leave/LeaveDetail.jsx"));
const LeaveHistory = lazy(() => import("./pages/user/Leave/LeaveHistory.jsx"));
const EventRouter = lazy(() => import("./pages/user/Event/EventRouter.jsx"));
const ProfileScreen = lazy(() => import("./pages/user/Profile/ProfileScreen.jsx"));
const SettingsScreen = lazy(() => import("./pages/user/Settings/SettingsScreen.jsx"));
const LeaveApproval = lazy(() => import("./pages/user/Leave/LeaveApproval.jsx"));
const ScheduleDetails = lazy(() => import("./pages/user/Schedule/ScheduleDetails.jsx"));

// Loading Component - ใช้ PuffLoader
const PageLoader = () => <PuffLoader text="กำลังโหลด..." />;

const router = createBrowserRouter([
  {
    path: '/',
    element: <Navigate to="/auth" replace />
  },
  {
    path: '/auth',
    element: <Auth />
  },
  {
    path: '/admin',
    element: (
      <ProtectedRoute allowedRoles={['admin', 'superadmin']}>
        <AdminLayout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/admin/dashboard" replace />
      },
      {
        path: 'dashboard',
        element: <Suspense fallback={<PageLoader />}><AdminDashboard /></Suspense>
      },
      {
        path: 'manage-users',
        element: <Suspense fallback={<PageLoader />}><AdminManageUser /></Suspense>
      },
      {
        path: 'download',
        element: <Suspense fallback={<PageLoader />}><DownloadData /></Suspense>
      },
      {
        path: 'mapping',
        element: <Suspense fallback={<PageLoader />}><MappingAndEvents /></Suspense>
      },
      {
        path: 'notifications',
        element: <Suspense fallback={<PageLoader />}><GroupNotificationScreen /></Suspense>
      },
      {
        path: 'attendance',
        element: <Suspense fallback={<PageLoader />}><Attendance /></Suspense>
      },
      {
        path: 'warning',
        element: <Suspense fallback={<PageLoader />}><Warning /></Suspense>
      },
      {
        path: 'leave-quota',
        element: <Suspense fallback={<PageLoader />}><LeaveQuotaManagement /></Suspense>
      }
    ]
  },  
  {
    path: '/superadmin',
    element: <Navigate to="/admin" replace />
  },
  {
    path: '/manager',
    element: <Navigate to="/user" replace />
  },
  {
    path: '/user',
    element: (
      <ProtectedRoute allowedRoles={['user', 'manager']}>
        <Layout />
      </ProtectedRoute>
    ),
    children: [
      {
        index: true,
        element: <Navigate to="/user/dashboard" replace />
      },
      {
        path: 'dashboard',
        element: <UserDashboard />
      },
      {
        path: 'take-photo',
        element: <Suspense fallback={<PageLoader />}><TakePhoto /></Suspense>
      },
      {
        path: 'leave',
        element: <Suspense fallback={<PageLoader />}><LeaveScreen /></Suspense>
      },
      {
        path: 'event/*',
        element: <Suspense fallback={<PageLoader />}><EventRouter /></Suspense>
      },
      {
        path: 'profile',
        element: <Suspense fallback={<PageLoader />}><ProfileScreen /></Suspense>
      },
      {
        path: 'settings',
        element: <Suspense fallback={<PageLoader />}><SettingsScreen /></Suspense>
      },
      {
        path: 'leave-approval',
        element: (
          <ProtectedRoute allowedRoles={['manager']}>
            <Suspense fallback={<PageLoader />}><LeaveApproval /></Suspense>
          </ProtectedRoute>
        )
      },
      {
        path: 'schedule/:id',
        element: <Suspense fallback={<PageLoader />}><ScheduleDetails /></Suspense>
      }
    ]
  },
  {
    path: '/user/leave',
    element: (
      <ProtectedRoute allowedRoles={['user', 'manager']}>
        <Suspense fallback={<PageLoader />}><LeaveScreen /></Suspense>
      </ProtectedRoute>
    )
  },
  {
    path: '/user/leave/list',
    element: (
      <ProtectedRoute allowedRoles={['user', 'manager']}>
        <Suspense fallback={<PageLoader />}><LeaveHistory /></Suspense>
      </ProtectedRoute>
    )
  },
  {
    path: '/user/leave/detail/:id',
    element: (
      <ProtectedRoute allowedRoles={['user', 'manager']}>
        <Suspense fallback={<PageLoader />}><LeaveDetail /></Suspense>
      </ProtectedRoute>
    )
  },
  // 🔥 404 Page - จับทุก route ที่ไม่ตรงกับด้านบน
  {
    path: '*',
    element: <NotFoundPage />
  }
])

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    {/* 🔥 Error Boundary ครอบทั้งแอพ */}
    <ErrorBoundary>
      <LoadingProvider>
        <AuthProvider>
          <TeamProvider>
            <LeaveProvider>
              <LocationProvider>
                <EventProvider>
                  <RouterProvider router={router} />
                </EventProvider>
              </LocationProvider>
            </LeaveProvider>
          </TeamProvider>
        </AuthProvider>
      </LoadingProvider>
    </ErrorBoundary>
  </React.StrictMode>
);
