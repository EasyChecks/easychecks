import { Router } from 'express';
import { authController } from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { rateLimitMiddleware, loginAttemptMiddleware } from '../middleware/rateLimit.middleware.js';

const router = Router();

/**
 * 🔐 AUTH ROUTES - Database Session with Refresh Token
 */

// Rate limit: 5 login attempts per 60 seconds per IP
const loginRateLimit = rateLimitMiddleware('login', 5, 60);

// Public routes
router.post('/login', loginRateLimit, loginAttemptMiddleware, authController.login);
router.post('/refresh', authController.refresh);

// Protected routes
router.post('/logout', authenticate, authController.logout);
router.post('/change-password', authenticate, authController.changePassword);

export default router;
