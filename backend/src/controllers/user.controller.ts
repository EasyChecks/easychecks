import type { Request, Response } from 'express';
import * as userService from '../services/user.service.js';
import { broadcastUserUpdate } from '../websocket/attendance.websocket.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { parse } from 'csv-parse/sync';

/**
 * 👤 User Controller - จัดการ API เกี่ยวกับผู้ใช้
 *
 * สิทธิ์การเข้าถึง (Role-based Access Control):
 * ┌────────────┬───────┬──────────────┬──────────────┬──────────────┐
 * │ Action     │ USER  │ MANAGER      │ ADMIN        │ SUPERADMIN   │
 * ├────────────┼───────┼──────────────┼──────────────┼──────────────┤
 * │ Create     │  ✗    │  ✗           │ สาขาตัวเอง  │ ทุกสาขา     │
 * │ Read (all) │  ✗    │  ✗           │ สาขาตัวเอง  │ ทุกสาขา     │
 * │ Read (own) │  ✓    │  ✓           │  ✓           │  ✓           │
 * │ Update     │  ✗    │  ✗           │ สาขาตัวเอง  │ ทุกสาขา     │
 * │ Delete     │  ✗    │  ✗           │ สาขาตัวเอง  │ ทุกสาขา     │
 * └────────────┴───────┴──────────────┴──────────────┴──────────────┘
 *
 * ทุก endpoint ใช้ข้อมูล requester จาก req.user (ผ่าน authenticate middleware)
 */

/**
 * ➕ สร้างพนักงานใหม่ (Admin/SuperAdmin only)
 * POST /api/users
 *
 * ขั้นตอน:
 * 1. ตรวจ role จาก req.user (ผ่าน authenticate)
 * 2. Validate required fields
 * 3. ส่งต่อให้ userService.createUser() ซึ่งจะ:
 *    - Auto-generate employeeId จาก branchCode (เช่น BKK001)
 *    - Hash password ด้วย bcrypt
 *    - Upload avatar อัตโนมัติตามเพศ
 *    - บันทึก Audit Log
 * 4. Broadcast WebSocket เพื่ออัพเดท real-time
 *
 * Admin สร้างได้เฉพาะสาขาตัวเอง, SuperAdmin สร้างได้ทุกสาขา
 */
export const createUser = async (req: Request, res: Response) => {
  try {
    // ดึงข้อมูล requester จาก token (ผ่าน authenticate middleware)
    const requester = req.user!;
    if (!['ADMIN', 'SUPERADMIN'].includes(requester.role)) {
      return sendError(res, 'ไม่มีสิทธิ์สร้างผู้ใช้ (ต้องเป็น ADMIN หรือ SUPERADMIN)', 403);
    }

    const { ...userData } = req.body;

    // Validate required fields (ไม่มี employeeId แล้ว เพราะ auto-generate)
    const requiredFields = ['title', 'firstName', 'lastName', 'gender', 'nationalId', 
                           'emergent_tel', 'emergent_first_name', 'emergent_last_name', 'emergent_relation',
                           'phone', 'email', 'password', 'birthDate', 'branchId'];
    for (const field of requiredFields) {
      if (!userData[field]) {
        return sendError(res, `กรุณาระบุ ${field}`, 400);
      }
    }

    // Validate title
    const titleUpper = userData.title?.toUpperCase();
    if (!['MR', 'MRS', 'MISS'].includes(titleUpper)) {
      return sendError(res, 'title ต้องเป็น MR (นาย), MRS (นาง) หรือ MISS (นางสาว)', 400);
    }
    userData.title = titleUpper;

    // Validate gender
    const genderUpper = userData.gender?.toUpperCase();
    if (genderUpper !== 'MALE' && genderUpper !== 'FEMALE') {
      return sendError(res, 'gender ต้องเป็น MALE หรือ FEMALE', 400);
    }
    userData.gender = genderUpper;

    // เรียก service
    const user = await userService.createUser({
      ...userData,
      branchId: parseInt(userData.branchId),
      createdByUserId: requester.userId,
      creatorRole: requester.role,
      creatorBranchId: requester.branchId,
    });

    // 📡 Broadcast ผ่าน WebSocket (polling) หลังจาก Create สำเร็จ
    broadcastUserUpdate('CREATE', user);

    sendSuccess(res, user, 'สร้างผู้ใช้เรียบร้อยแล้ว', 201);
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการสร้างผู้ใช้');
  }
};

/**
 * 📋 ดึงผู้ใช้ทั้งหมด (ตาม role และ branch)
 * GET /api/users
 *
 * Query: {
 *   branchId?: number,  // (optional) กรองตามสาขา (SuperAdmin only)
 *   role?: string,      // (optional) กรองตาม role
 *   status?: string,    // (optional) กรองตาม status
 *   search?: string,    // (optional) ค้นหา
 *   page?: number,      // (optional) หน้า
 *   limit?: number      // (optional) จำนวนต่อหน้า
 * }
 */
export const getUsers = async (req: Request, res: Response) => {
  try {
    // ดึงข้อมูล requester จาก token
    const requester = req.user!;
    const { branchId, role, status, search, page, limit } = req.query;

    // เตรียม filter
    const filters: any = {};
    if (branchId) filters.branchId = parseInt(branchId as string);
    if (role) filters.role = role as string;
    if (status) filters.status = status as string;
    if (search) filters.search = search as string;

    // เรียก service
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

/**
 * 📋 ดึงผู้ใช้ตาม ID
 * GET /api/users/:id
 * 
 * Query: {
 *   requesterId?: number,
 *   requesterRole?: string,
 *   requesterBranchId?: number
 * }
 */
export const getUserById = async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id as string);

    if (!userId || isNaN(userId)) {
      return sendError(res, 'กรุณาระบุ userId ที่ถูกต้อง', 400);
    }

    const requester = req.user!;

    // เรียก service
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

/**
 * 🔄 อัปเดตข้อมูลพนักงาน (Admin/SuperAdmin only)
 * PUT /api/users/:id
 *
 * สามารถแก้ไขได้: ชื่อ, เบอร์, อีเมล, nationalId, แผนก, ตำแหน่ง ฯลฯ
 * การ reset รหัสผ่าน: ส่ง field `password` มาใน body
 *   → service จะ hash ด้วย bcrypt แล้วบันทึกใน password column
 *   → พนักงานจะต้อง login ด้วยรหัสใหม่ได้ทันที
 *
 * Admin แก้ได้เฉพาะคนในสาขาตัวเอง, SuperAdmin แก้ได้ทุกคน
 * Admin ไม่สามารถย้ายพนักงานไปสาขาอื่นได้
 */
export const updateUser = async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id as string);

    if (!userId || isNaN(userId)) {
      return sendError(res, 'กรุณาระบุ userId ที่ถูกต้อง', 400);
    }

    // ดึงข้อมูล requester จาก token
    const requester = req.user!;
    if (!['ADMIN', 'SUPERADMIN'].includes(requester.role)) {
      return sendError(res, 'ไม่มีสิทธิ์แก้ไขผู้ใช้ (ต้องเป็น ADMIN หรือ SUPERADMIN)', 403);
    }

    const { ...updateData } = req.body;

    // เรียก service
    const updatedUser = await userService.updateUser(
      userId,
      requester.userId,
      requester.role,
      requester.branchId,
      updateData
    );

    // 📡 Broadcast ผ่าน WebSocket (polling) หลังจาก Update สำเร็จ
    broadcastUserUpdate('UPDATE', updatedUser);

    sendSuccess(res, updatedUser, 'อัปเดตผู้ใช้เรียบร้อยแล้ว');
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการอัปเดตผู้ใช้');
  }
};

/**
 * 🗑️ ลบพนักงาน — Soft Delete (Admin/SuperAdmin only)
 * DELETE /api/users/:id
 *
 * ไม่ได้ลบข้อมูลออกจาก database จริง แต่เปลี่ยน status เป็น RESIGNED
 * เพื่อรักษาประวัติ Attendance, Leave Request และ Audit Log ไว้
 * Body: { deleteReason: string } — จำเป็น เพื่อบันทึกใน Audit Log
 */
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

    // เรียก service
    const result = await userService.deleteUser(
      userId,
      requester.userId,
      requester.role,
      requester.branchId,
      deleteReason
    );

    // 📡 Broadcast ผ่าน WebSocket (polling) หลังจาก Delete สำเร็จ
    broadcastUserUpdate('DELETE', result);

    sendSuccess(res, null, 'ลบผู้ใช้เรียบร้อยแล้ว');
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการลบผู้ใช้');
  }
};

/**
 * 📤 Bulk Import Users จาก CSV
 * POST /api/users/bulk
 * 
 * Body: {
 *   createdByUserId: number,   // (จำเป็น) ผู้สร้าง
 *   creatorRole: string,       // (จำเป็น) ADMIN หรือ SUPERADMIN
 *   creatorBranchId?: number,  // (จำเป็นถ้าเป็น ADMIN) สาขาของผู้สร้าง
 *   csvData: string            // (จำเป็น) CSV data as string
 * }
 * 
 * CSV Format (employeeId ไม่ต้องใส่ จะ auto-generate):
 * title,firstName,lastName,nickname,gender,nationalId,emergent_tel,emergent_first_name,emergent_last_name,emergent_relation,phone,email,password,birthDate,branchId,role
 * 
 * Title: MR (นาย), MRS (นาง), MISS (นางสาว)
 * 
 * ⚡ employeeId จะถูก auto-generate จาก branchCode + running number
 */
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

    // Parse CSV
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

    // เรียก service
    const result = await userService.bulkCreateUsers(
      users,
      requester.userId,
      requester.role,
      requester.branchId
    );

    // 📡 Broadcast ผ่าน WebSocket (polling) หลังจาก Bulk Import สำเร็จ
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

/**
 * 📊 Get user statistics (for dashboard)
 * GET /api/users/statistics
 * 
 * Query: {
 *   requesterRole: string,
 *   requesterBranchId?: number
 * }
 */
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

/**
 * 📷 Get user avatar URL
 * GET /api/users/:id/avatar
 */
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

/**
 * 📝 Get CSV template for bulk import
 * GET /api/users/csv-template
 */
export const getCsvTemplate = async (_req: Request, res: Response) => {
  try {
    const template = `employeeId,firstName,lastName,nickname,nationalId,emergent_tel,emergent_first_name,emergent_last_name,emergent_relation,phone,email,password,birthDate,branchId,role,avatarGender
EMP001,สมชาย,ใจดี,ชาย,1234567890123,0812345678,สมหญิง,ใจดี,ภรรยา,0898765432,somchai@example.com,password123,1990-01-15,1,USER,male
EMP002,สมหญิง,รักดี,หญิง,1234567890124,0812345679,สมชาย,รักดี,สามี,0898765433,somying@example.com,password456,1992-05-20,1,USER,female`;

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', 'attachment; filename=users_import_template.csv');
    res.send('\ufeff' + template); // Add BOM for Excel UTF-8 support
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
