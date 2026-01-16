// ✅ Dynamic Configuration - ไม่ต้องแก้ code เมื่อ deploy
// การใช้งาน: import { config } from '@/config'

export const config = {
  // API Configuration
  api: {
    url: import.meta.env.VITE_API_URL || 'http://localhost:3000/api',
    timeout: parseInt(import.meta.env.VITE_API_TIMEOUT) || 10000,
  },

  // App Configuration
  app: {
    name: import.meta.env.VITE_APP_NAME || 'EasyCheck',
    version: import.meta.env.VITE_APP_VERSION || '1.0.0',
  },

  // Feature Flags
  features: {
    enableMockData: import.meta.env.VITE_ENABLE_MOCK_DATA === 'true',
    enableGpsCheck: import.meta.env.VITE_ENABLE_GPS_CHECK !== 'false', // default true
    enableCameraCheck: import.meta.env.VITE_ENABLE_CAMERA_CHECK !== 'false', // default true
  },

  // GPS Configuration
  gps: {
    timeout: parseInt(import.meta.env.VITE_GPS_TIMEOUT) || 5000,
    maximumAge: parseInt(import.meta.env.VITE_GPS_MAX_AGE) || 30000,
    enableHighAccuracy: import.meta.env.VITE_GPS_HIGH_ACCURACY === 'true',
  },

  // Camera Configuration
  camera: {
    facingMode: import.meta.env.VITE_CAMERA_FACING_MODE || 'user', // 'user' or 'environment'
    width: parseInt(import.meta.env.VITE_CAMERA_WIDTH) || 640,
    height: parseInt(import.meta.env.VITE_CAMERA_HEIGHT) || 480,
  },

  // Location Configuration
  location: {
    defaultRadius: parseInt(import.meta.env.VITE_DEFAULT_LOCATION_RADIUS) || 150,
  },

  // Session Configuration
  session: {
    timeout: parseInt(import.meta.env.VITE_SESSION_TIMEOUT) || 3600000, // 1 hour
    autoLogout: import.meta.env.VITE_AUTO_LOGOUT === 'true',
  },
};

export default config;
