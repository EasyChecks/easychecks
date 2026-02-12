import type { Request, Response } from 'express';
import * as userService from '../services/user.service.js';
import { broadcastUserUpdate } from '../websocket/attendance.websocket.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { parse } from 'csv-parse/sync';

/**
 * 👤 User Controller - จัดการ API เกี่ยวกับผู้ใช้
 * 
 * 🔴 หมายเหตุ: ตอนนี้ยังไม่มี Auth Middleware
 * - รับ userId, role, branchId จาก body แทน req.user
 * - รอเพื่อนทำ Auth เสร็จค่อยเปลี่ยน
 * 
 * สิทธิ์การเข้าถึง:
 * - SuperAdmin: ดู/สร้าง/แก้/ลบ ได้ทุกสาขา
 * - Admin: ดู/สร้าง/แก้/ลบ ได้เฉพาะสาขาตัวเอง
 * - User: ดูได้เฉพาะข้อมูลตัวเอง
 */

/**
 * ➕ สร้างผู้ใช้ใหม่ (Admin/SuperAdmin only)
 * POST /api/users
 * 
 * Body: {
 *   createdByUserId: number,   // (จำเป็น) ผู้สร้าง
 *   creatorRole: string,       // (จำเป็น) ADMIN หรือ SUPERADMIN
 *   creatorBranchId?: number,  // (จำเป็นถ้าเป็น ADMIN) สาขาของผู้สร้าง
 *   title: string,             // (จำเป็น) MR (นาย), MRS (นาง), MISS (นางสาว)
 *   firstName: string,         // (จำเป็น) ชื่อ
 *   lastName: string,          // (จำเป็น) นามสกุล
 *   nickname?: string,         // (optional) ชื่อเล่น
 *   gender: string,            // (จำเป็น) MALE หรือ FEMALE
 *   nationalId: string,        // (จำเป็น) เลขบัตรประชาชน
 *   emergent_tel: string,      // (จำเป็น) เบอร์ติดต่อฉุกเฉิน
 *   emergent_first_name: string,     // (จำเป็น) ชื่อจริงผู้ติดต่อคือกเฉิน
 *   emergent_last_name: string,     // (จำเป็น) นามสกุลผู้ติดต่อคือกเฉิน
 *   emergent_relation: string, // (จำเป็น) ความสัมพันธ์
 *   phone: string,             // (จำเป็น) เบอร์โทร
 *   email: string,             // (จำเป็น) อีเมล
 *   password: string,          // (จำเป็น) รหัสผ่าน
 *   birthDate: string,         // (จำเป็น) วันเกิด YYYY-MM-DD
 *   branchId: number,          // (จำเป็น) รหัสสาขา (สำหรับสร้าง employeeId)
 *   role?: string,             // (optional) Role: USER, MANAGER, ADMIN, SUPERADMIN
 * }
 * 
 * ⚡ employeeId จะถูก auto-generate จาก branchCode + running number
 *    เช่น BKK001, CNX002, HKT003
 */
export const createUser = async (req: Request, res: Response) => {
  try {
    // ดึงข้อมูลจาก body (ตอนนี้ยังไม่มี auth)
    // TODO: หลังจากเพื่อนทำ Auth เสร็จ เปลี่ยนเป็น req.user
    const { 
      createdByUserId, 
      creatorRole, 
      creatorBranchId,
      ...userData 
    } = req.body;

    // ตรวจสอบว่ามีข้อมูลที่จำเป็นมาไหม
    if (!createdByUserId) {
      return sendError(res, 'กรุณาระบุ createdByUserId (ผู้สร้าง)', 400);
    }

    if (!creatorRole || !['ADMIN', 'SUPERADMIN'].includes(creatorRole)) {
      return sendError(res, 'กรุณาระบุ creatorRole ที่ถูกต้อง (ADMIN หรือ SUPERADMIN)', 400);
    }

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
      createdByUserId: parseInt(createdByUserId),
      creatorRole,
      creatorBranchId: creatorBranchId ? parseInt(creatorBranchId) : undefined,
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
 *   requesterId: number,     // (จำเป็น) ผู้ขอดูข้อมูล
 *   requesterRole: string,   // (จำเป็น) Role ของผู้ขอ
 *   requesterBranchId?: number,
 *   branchId?: number,       // (optional) กรองตามสาขา (SuperAdmin only)
 *   role?: string,           // (optional) กรองตาม role
 *   status?: string,         // (optional) กรองตาม status
 *   search?: string,         // (optional) ค้นหา
 *   page?: number,           // (optional) หน้า
 *   limit?: number           // (optional) จำนวนต่อหน้า
 * }
 */
export const getUsers = async (req: Request, res: Response) => {
  try {
    // ดึงข้อมูลจาก query (ตอนนี้ยังไม่มี auth)
    // TODO: หลังจากเพื่อนทำ Auth เสร็จ เปลี่ยนเป็น req.user
    const { 
      requesterId, 
      requesterRole, 
      requesterBranchId,
      branchId,
      role,
      status,
      search,
      page,
      limit
    } = req.query;

    // ตรวจสอบว่ามีข้อมูลที่จำเป็นมาไหม
    if (!requesterId) {
      return sendError(res, 'กรุณาระบุ requesterId (ผู้ขอดูข้อมูล)', 400);
    }

    if (!requesterRole) {
      return sendError(res, 'กรุณาระบุ requesterRole', 400);
    }

    // เตรียม filter
    const filters: any = {};
    if (branchId) filters.branchId = parseInt(branchId as string);
    if (role) filters.role = role as string;
    if (status) filters.status = status as string;
    if (search) filters.search = search as string;

    // เรียก service
    const result = await userService.getUsers(
      parseInt(requesterId as string),
      requesterRole as string,
      requesterBranchId ? parseInt(requesterBranchId as string) : undefined,
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

    const { requesterId, requesterRole, requesterBranchId } = req.query;

    // เรียก service
    const user = await userService.getUserById(
      userId,
      requesterId ? parseInt(requesterId as string) : undefined,
      requesterRole as string | undefined,
      requesterBranchId ? parseInt(requesterBranchId as string) : undefined
    );

    sendSuccess(res, user);
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้');
  }
};

/**
 * 🔄 อัปเดตผู้ใช้
 * PUT /api/users/:id
 * 
 * Body: {
 *   updatedByUserId: number,   // (จำเป็น) ผู้แก้ไข
 *   updaterRole: string,       // (จำเป็น) Role ของผู้แก้ไข
 *   updaterBranchId?: number,  // (ถ้าเป็น ADMIN) สาขาของผู้แก้ไข
 *   firstName?, lastName?, nickname?, nationalId?,
 *   emergent_tel?, emergent_first_name?, emergent_last_name?, emergent_relation?,
 *   phone?, email?, password?, birthDate?,
 *   branchId?, role?, status?, avatarGender?
 * }
 */
export const updateUser = async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id as string);

    if (!userId || isNaN(userId)) {
      return sendError(res, 'กรุณาระบุ userId ที่ถูกต้อง', 400);
    }

    // ดึงข้อมูลจาก body
    const { 
      updatedByUserId, 
      updaterRole, 
      updaterBranchId,
      ...updateData 
    } = req.body;

    // ตรวจสอบว่ามีข้อมูลที่จำเป็นมาไหม
    if (!updatedByUserId) {
      return sendError(res, 'กรุณาระบุ updatedByUserId (ผู้แก้ไข)', 400);
    }

    if (!updaterRole) {
      return sendError(res, 'กรุณาระบุ updaterRole', 400);
    }

    // เรียก service
    const updatedUser = await userService.updateUser(
      userId, 
      parseInt(updatedByUserId), 
      updaterRole,
      updaterBranchId ? parseInt(updaterBranchId) : undefined,
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
 * 🗑️ ลบผู้ใช้ (soft delete - เปลี่ยน status เป็น RESIGNED)
 * DELETE /api/users/:id
 * 
 * Body: { 
 *   deletedByUserId: number,   // (จำเป็น) ผู้ลบ
 *   deleterRole: string,       // (จำเป็น) Role ของผู้ลบ
 *   deleterBranchId?: number,  // (ถ้าเป็น ADMIN) สาขาของผู้ลบ
 *   deleteReason: string       // (จำเป็น) เหตุผลในการลบ
 * }
 */
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id as string);

    if (!userId || isNaN(userId)) {
      return sendError(res, 'กรุณาระบุ userId ที่ถูกต้อง', 400);
    }

    const { deletedByUserId, deleterRole, deleterBranchId, deleteReason } = req.body;

    // ตรวจสอบว่ามีข้อมูลที่จำเป็นมาไหม
    if (!deletedByUserId) {
      return sendError(res, 'กรุณาระบุ deletedByUserId (ผู้ลบ)', 400);
    }

    if (!deleterRole || !['ADMIN', 'SUPERADMIN'].includes(deleterRole)) {
      return sendError(res, 'กรุณาระบุ deleterRole ที่ถูกต้อง (ADMIN หรือ SUPERADMIN)', 400);
    }

    if (!deleteReason || deleteReason.trim().length === 0) {
      return sendError(res, 'กรุณาระบุเหตุผลในการลบ (deleteReason)', 400);
    }

    // เรียก service
    const result = await userService.deleteUser(
      userId, 
      parseInt(deletedByUserId), 
      deleterRole,
      deleterBranchId ? parseInt(deleterBranchId) : undefined,
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
    const { createdByUserId, creatorRole, creatorBranchId, csvData } = req.body;

    // ตรวจสอบว่ามีข้อมูลที่จำเป็นมาไหม
    if (!createdByUserId) {
      return sendError(res, 'กรุณาระบุ createdByUserId (ผู้สร้าง)', 400);
    }

    if (!creatorRole || !['ADMIN', 'SUPERADMIN'].includes(creatorRole)) {
      return sendError(res, 'กรุณาระบุ creatorRole ที่ถูกต้อง (ADMIN หรือ SUPERADMIN)', 400);
    }

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
      parseInt(createdByUserId),
      creatorRole,
      creatorBranchId ? parseInt(creatorBranchId) : undefined
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
    const { requesterRole, requesterBranchId } = req.query;

    if (!requesterRole) {
      return sendError(res, 'กรุณาระบุ requesterRole', 400);
    }

    const statistics = await userService.getUserStatistics(
      requesterRole as string,
      requesterBranchId ? parseInt(requesterBranchId as string) : undefined
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
