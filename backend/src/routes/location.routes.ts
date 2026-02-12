import express from 'express';
import {
  createLocation,
  getAllLocations,
  getNearbyLocations,
  getLocationStatistics,
  getLocationById,
  updateLocation,
  deleteLocation,
  restoreLocation,
} from '../controllers/location.controller.js';
import { authenticate, authorizeRole } from '../middleware/auth.middleware.js';

const router = express.Router();

/**
 * Location Routes - จัดการ API สถานที่/แผนที่
 */

// Admin/SuperAdmin เท่านั้นที่สร้างได้
router.post('/', authenticate, authorizeRole('ADMIN', 'SUPERADMIN'), createLocation); // สร้างสถานที่

// ทุกคนที่ login แล้วสามารถดูได้
router.get('/', authenticate, getAllLocations); // ดูรายการสถานที่

// Special routes before ID routes
router.get('/nearby', authenticate, getNearbyLocations); // ค้นหาสถานที่ใกล้เคียง
router.get('/admin/statistics', authenticate, authorizeRole('ADMIN', 'SUPERADMIN'), getLocationStatistics); // สถิติ

// ID-based routes
router.get('/:id', authenticate, getLocationById); // ดูสถานที่ตาม ID

router.patch('/:id', authenticate, authorizeRole('ADMIN', 'SUPERADMIN'), updateLocation); // แก้ไข

router.delete('/:id', authenticate, authorizeRole('ADMIN', 'SUPERADMIN'), deleteLocation); // ลบ (soft delete)

router.post('/:id/restore', authenticate, authorizeRole('ADMIN', 'SUPERADMIN'), restoreLocation); // กู้คืน

export default router;
