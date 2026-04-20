import { Router } from 'express';
import * as userController from '../controllers/user.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

// ทุก endpoint ต้อง authenticate — RBAC ตรวจเพิ่มใน controller
router.use(authenticate);

// static routes ต้องอยู่ก่อน /:id เพื่อไม่ให้ Express match "csv-template" เป็น :id
router.get('/csv-template', userController.getCsvTemplate);
router.get('/statistics', userController.getUserStatistics);
router.post('/bulk', userController.bulkCreateUsers);

router.post('/', userController.createUser);
router.get('/', userController.getUsers);

router.get('/:id', userController.getUserById);
router.get('/:id/avatar', userController.getUserAvatar);
router.put('/:id', userController.updateUser);
router.delete('/:id', userController.deleteUser);

export default router;
