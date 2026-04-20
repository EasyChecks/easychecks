// controller รู้แค่ HTTP — validate input, เรียก service, broadcast WebSocket, ส่ง response
// RBAC: ADMIN จัดการได้เฉพาะสาขาตัวเอง / SUPERADMIN จัดการได้ทุกสาขา

import type { Request, Response } from 'express';
import * as userService from '../services/user.service.js';
import { broadcastUserUpdate } from '../websocket/attendance.websocket.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { parse } from 'csv-parse/sync';
import { prisma } from '../lib/prisma.js';

// createUser — POST /api/users
// employeeId auto-generate จาก branchCode (เช่น BKK001)
export const createUser = async (req: Request, res: Response) => {
  try {
    const requester = req.user!;

    if (!['ADMIN', 'SUPERADMIN'].includes(requester.role)) {
      return sendError(res, 'ไม่มีสิทธิ์สร้างผู้ใช้ (ต้องเป็น ADMIN หรือ SUPERADMIN)', 403);
    }

    const { ...userData } = req.body;

    // resolve branchCode → branchId เพราะ frontend อาจส่ง branchCode แทน
    if (!userData.branchId && userData.branchCode) {
      const branch = await prisma.branch.findUnique({
        where: { code: userData.branchCode },
      });
      if (!branch) {
        return sendError(res, `ไม่พบสาขา: ${userData.branchCode}`, 400);
      }
      userData.branchId = branch.branchId;
    }

    const requiredFields = ['title', 'firstName', 'lastName', 'gender', 'nationalId', 
                           'emergent_tel', 'emergent_first_name', 'emergent_last_name', 'emergent_relation',
                           'phone', 'email', 'birthDate', 'branchId'];
    for (const field of requiredFields) {
      if (!userData[field]) {
        return sendError(res, `กรุณาระบุ ${field}`, 400);
      }
    }

    const titleUpper = userData.title?.toUpperCase();
    if (!['MR', 'MRS', 'MISS'].includes(titleUpper)) {
      return sendError(res, 'title ต้องเป็น MR (นาย), MRS (นาง) หรือ MISS (นางสาว)', 400);
    }
    userData.title = titleUpper;

    const genderUpper = userData.gender?.toUpperCase();
    if (genderUpper !== 'MALE' && genderUpper !== 'FEMALE') {
      return sendError(res, 'gender ต้องเป็น MALE หรือ FEMALE', 400);
    }
    userData.gender = genderUpper;

    const user = await userService.createUser({
      ...userData,
      branchId: parseInt(userData.branchId),
      createdByUserId: requester.userId,
      creatorRole: requester.role,
      creatorBranchId: requester.branchId,
    });

    broadcastUserUpdate('CREATE', user);
    sendSuccess(res, user, 'สร้างผู้ใช้เรียบร้อยแล้ว', 201);
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการสร้างผู้ใช้');
  }
};

// getUsers — GET /api/users (paginated + RBAC filter ตามสาขา)
export const getUsers = async (req: Request, res: Response) => {
  try {
    const requester = req.user!;
    const { branchId, role, status, search, page, limit } = req.query;

    const filters: any = {};
    if (branchId) filters.branchId = parseInt(branchId as string);
    if (role) filters.role = role as string;
    if (status) filters.status = status as string;
    if (search) filters.search = search as string;

    const result = await userService.getUsers(
      requester.userId,
      requester.role,
      requester.branchId,
      filters,
      page ? parseInt(page as string) : 1,
      limit ? parseInt(limit as string) : 20
    );

    sendSuccess(res, result);
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้');
  }
};

// getUserById — GET /api/users/:id
export const getUserById = async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id as string);
    if (!userId || isNaN(userId)) {
      return sendError(res, 'กรุณาระบุ userId ที่ถูกต้อง', 400);
    }

    const requester = req.user!;
    const user = await userService.getUserById(
      userId,
      requester.userId,
      requester.role,
      requester.branchId
    );

    sendSuccess(res, user);
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้');
  }
};

// updateUser — PUT /api/users/:id
// รองรับ reset password (ส่ง field `password` มา → hash ด้วย bcrypt)
export const updateUser = async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id as string);
    if (!userId || isNaN(userId)) {
      return sendError(res, 'กรุณาระบุ userId ที่ถูกต้อง', 400);
    }

    const requester = req.user!;
    if (!['ADMIN', 'SUPERADMIN'].includes(requester.role)) {
      return sendError(res, 'ไม่มีสิทธิ์แก้ไขผู้ใช้ (ต้องเป็น ADMIN หรือ SUPERADMIN)', 403);
    }

    const { ...updateData } = req.body;
    const updatedUser = await userService.updateUser(
      userId,
      requester.userId,
      requester.role,
      requester.branchId,
      updateData
    );

    broadcastUserUpdate('UPDATE', updatedUser);
    sendSuccess(res, updatedUser, 'อัปเดตผู้ใช้เรียบร้อยแล้ว');
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการอัปเดตผู้ใช้');
  }
};

// deleteUser — DELETE /api/users/:id (soft delete → RESIGNED)
// ต้องระบุ deleteReason เพื่อ audit trail
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id as string);
    if (!userId || isNaN(userId)) {
      return sendError(res, 'กรุณาระบุ userId ที่ถูกต้อง', 400);
    }

    const requester = req.user!;
    if (!['ADMIN', 'SUPERADMIN'].includes(requester.role)) {
      return sendError(res, 'ไม่มีสิทธิ์ลบผู้ใช้ (ต้องเป็น ADMIN หรือ SUPERADMIN)', 403);
    }

    const { deleteReason } = req.body;
    if (!deleteReason || deleteReason.trim().length === 0) {
      return sendError(res, 'กรุณาระบุเหตุผลในการลบ (deleteReason)', 400);
    }

    const result = await userService.deleteUser(
      userId,
      requester.userId,
      requester.role,
      requester.branchId,
      deleteReason
    );

    broadcastUserUpdate('DELETE', result);
    sendSuccess(res, null, 'ลบผู้ใช้เรียบร้อยแล้ว');
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการลบผู้ใช้');
  }
};

// bulkCreateUsers — POST /api/users/bulk (import จาก CSV)
// employeeId auto-generate จาก branchCode + running number
export const bulkCreateUsers = async (req: Request, res: Response) => {
  try {
    const requester = req.user!;
    if (!['ADMIN', 'SUPERADMIN'].includes(requester.role)) {
      return sendError(res, 'ไม่มีสิทธิ์นำเข้าข้อมูล (ต้องเป็น ADMIN หรือ SUPERADMIN)', 403);
    }
    const { csvData } = req.body;

    if (!csvData || typeof csvData !== 'string') {
      return sendError(res, 'กรุณาระบุ csvData', 400);
    }

    let users: any[];
    try {
      users = parse(csvData, {
        columns: true,
        skip_empty_lines: true,
        trim: true,
      });
    } catch (parseError: any) {
      return sendError(res, `รูปแบบ CSV ไม่ถูกต้อง: ${parseError.message}`, 400);
    }

    if (!users || users.length === 0) {
      return sendError(res, 'ไม่พบข้อมูลใน CSV', 400);
    }

    const result = await userService.bulkCreateUsers(
      users,
      requester.userId,
      requester.role,
      requester.branchId
    );

    if (result.success > 0) {
      broadcastUserUpdate('BULK_CREATE', {
        success: result.success,
        failed: result.failed,
        createdUsers: result.createdUsers,
      });
    }

    sendSuccess(res, result, `นำเข้าข้อมูลสำเร็จ ${result.success} รายการ, ล้มเหลว ${result.failed} รายการ`, 201);
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการนำเข้าข้อมูล');
  }
};

// getUserStatistics — GET /api/users/statistics (dashboard summary)
export const getUserStatistics = async (req: Request, res: Response) => {
  try {
    const requester = req.user!;
    const statistics = await userService.getUserStatistics(
      requester.role,
      requester.branchId
    );
    sendSuccess(res, statistics);
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลสถิติ');
  }
};

// getUserAvatar — GET /api/users/:id/avatar
export const getUserAvatar = async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id as string);
    if (!userId || isNaN(userId)) {
      return sendError(res, 'กรุณาระบุ userId ที่ถูกต้อง', 400);
    }

    const user = await userService.getUserById(userId);
    sendSuccess(res, { 
      userId: user.userId,
      employeeId: user.employeeId,
      avatarUrl: user.avatarUrl
    });
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการดึงรูปโปรไฟล์');
  }
};

// getCsvTemplate — GET /api/users/csv-template
// BOM (\ufeff) จำเป็นเพื่อให้ Excel อ่าน UTF-8 ภาษาไทยได้ถูกต้อง
export const getCsvTemplate = async (_req: Request, res: Response) => {
  try {
    const template = `title,firstName,lastName,nickname,gender,nationalId,emergent_tel,emergent_first_name,emergent_last_name,emergent_relation,phone,email,password,birthDate,branchId,role
MR,สมชาย,ใจดี,ชาย,MALE,1234567890123,0812345678,สมหญิง,ใจดี,ภรรยา,0898765432,somchai@example.com,,1990-01-15,1,USER
MISS,สมหญิง,รักดี,หญิง,FEMALE,1234567890124,0812345679,สมชาย,รักดี,สามี,0898765433,somying@example.com,,1992-05-20,1,USER`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=users_import_template.csv');
    res.send('\ufeff' + template);
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการสร้าง template');
  }
};

export default {
  createUser,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  bulkCreateUsers,
  getUserStatistics,
  getUserAvatar,
  getCsvTemplate,
};
