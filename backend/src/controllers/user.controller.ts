// ═══════════════════════════════════════════════════════════════
// 📁 user.controller.ts — User Management Controller
// ═══════════════════════════════════════════════════════════════
// 👤 รับ HTTP Request ที่เกี่ยวกับการจัดการพนักงาน แล้วส่งต่อให้ userService
//
// Functions ในไฟล์นี้:
//   1️⃣ createUser()        — POST   /api/users            (Admin/SuperAdmin)
//   2️⃣ getUsers()          — GET    /api/users            (Admin/SuperAdmin)
//   3️⃣ getUserById()       — GET    /api/users/:id        (ทุก role)
//   4️⃣ updateUser()        — PUT    /api/users/:id        (Admin/SuperAdmin)
//   5️⃣ deleteUser()        — DELETE /api/users/:id        (Admin/SuperAdmin)
//   6️⃣ bulkCreateUsers()   — POST   /api/users/bulk       (Admin/SuperAdmin)
//   7️⃣ getUserStatistics() — GET    /api/users/statistics  (Admin/SuperAdmin)
//   8️⃣ getUserAvatar()     — GET    /api/users/:id/avatar  (ทุก role)
//   9️⃣ getCsvTemplate()    — GET    /api/users/csv-template (Admin/SuperAdmin)
//
// สิทธิ์การเข้าถึง (RBAC):
// ┌────────────┬───────┬──────────────┬──────────────┬──────────────┐
// │ Action     │ USER  │ MANAGER      │ ADMIN        │ SUPERADMIN   │
// ├────────────┼───────┼──────────────┼──────────────┼──────────────┤
// │ Create     │  ✗    │  ✗           │ สาขาตัวเอง  │ ทุกสาขา     │
// │ Read (all) │  ✗    │  ✗           │ สาขาตัวเอง  │ ทุกสาขา     │
// │ Read (own) │  ✓    │  ✓           │  ✓           │  ✓           │
// │ Update     │  ✗    │  ✗           │ สาขาตัวเอง  │ ทุกสาขา     │
// │ Delete     │  ✗    │  ✗           │ สาขาตัวเอง  │ ทุกสาขา     │
// └────────────┴───────┴──────────────┴──────────────┴──────────────┘
//
// 📌 Source: routes/user.routes.ts → user.controller → user.service
// ═══════════════════════════════════════════════════════════════

import type { Request, Response } from 'express';                        // ← Express types
import * as userService from '../services/user.service.js';              // ← User business logic
import { broadcastUserUpdate } from '../websocket/attendance.websocket.js';  // ← WebSocket broadcast
import { sendSuccess, sendError } from '../utils/response.js';          // ← Standard response helpers
import { parse } from 'csv-parse/sync';                                 // ← CSV parser (synchronous)

// ═══════════════════════════════════════════════════════════════
// 1️⃣ createUser() — สร้างพนักงานใหม่
// ═══════════════════════════════════════════════════════════════
// POST /api/users
// - Auto-generate employeeId จาก branchCode (เช่น BKK001)
// - Hash password ด้วย bcrypt
// - Upload avatar อัตโนมัติตามเพศ
// - บันทึก Audit Log
// - Admin สร้างได้เฉพาะสาขาตัวเอง, SuperAdmin สร้างได้ทุกสาขา
export const createUser = async (req: Request, res: Response) => {
  try {
    const requester = req.user!;  // ← ข้อมูล requester จาก JWT (ผ่าน authenticate middleware)

    // ✅ STEP 1: ตรวจสิทธิ์ — เฉพาะ ADMIN/SUPERADMIN
    if (!['ADMIN', 'SUPERADMIN'].includes(requester.role)) {
      return sendError(res, 'ไม่มีสิทธิ์สร้างผู้ใช้ (ต้องเป็น ADMIN หรือ SUPERADMIN)', 403);  // ← 403 Forbidden
    }

    const { ...userData } = req.body;  // ← ดึงข้อมูลทั้งหมดจาก body

    // ✅ STEP 2: Validate required fields
    const requiredFields = ['title', 'firstName', 'lastName', 'gender', 'nationalId', 
                           'emergent_tel', 'emergent_first_name', 'emergent_last_name', 'emergent_relation',
                           'phone', 'email', 'birthDate', 'branchId'];  // ← ไม่มี employeeId (auto-generate)
    for (const field of requiredFields) {
      if (!userData[field]) {
        return sendError(res, `กรุณาระบุ ${field}`, 400);  // ← 400 Bad Request
      }
    }

    // ✅ STEP 3: Validate title (MR/MRS/MISS)
    const titleUpper = userData.title?.toUpperCase();  // ← แปลงตัวพิมพ์ใหญ่
    if (!['MR', 'MRS', 'MISS'].includes(titleUpper)) {
      return sendError(res, 'title ต้องเป็น MR (นาย), MRS (นาง) หรือ MISS (นางสาว)', 400);
    }
    userData.title = titleUpper;  // ← เก็บเป็นตัวพิมพ์ใหญ่

    // ✅ STEP 4: Validate gender (MALE/FEMALE)
    const genderUpper = userData.gender?.toUpperCase();  // ← แปลงตัวพิมพ์ใหญ่
    if (genderUpper !== 'MALE' && genderUpper !== 'FEMALE') {
      return sendError(res, 'gender ต้องเป็น MALE หรือ FEMALE', 400);
    }
    userData.gender = genderUpper;  // ← เก็บเป็นตัวพิมพ์ใหญ่

    // ✅ STEP 5: ส่งต่อให้ userService.createUser()
    const user = await userService.createUser({
      ...userData,
      branchId: parseInt(userData.branchId),    // ← string → number
      createdByUserId: requester.userId,        // ← ผู้สร้าง
      creatorRole: requester.role,              // ← role ของผู้สร้าง
      creatorBranchId: requester.branchId,      // ← สาขาของผู้สร้าง
    });

    // ✅ STEP 6: Broadcast ผ่าน WebSocket
    broadcastUserUpdate('CREATE', user);  // ← แจ้ง real-time ทุก client

    sendSuccess(res, user, 'สร้างผู้ใช้เรียบร้อยแล้ว', 201);  // ← 201 Created
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการสร้างผู้ใช้');  // ← 500 Internal Server Error
  }
};

// ═══════════════════════════════════════════════════════════════
// 2️⃣ getUsers() — ดึงรายชื่อพนักงานทั้งหมด (paginated + RBAC)
// ═══════════════════════════════════════════════════════════════
// GET /api/users
// Query: branchId?, role?, status?, search?, page?, limit?
export const getUsers = async (req: Request, res: Response) => {
  try {
    const requester = req.user!;  // ← ข้อมูล requester จาก JWT
    const { branchId, role, status, search, page, limit } = req.query;  // ← query parameters

    // ✅ STEP 1: เตรียม filter object
    const filters: any = {};
    if (branchId) filters.branchId = parseInt(branchId as string);  // ← กรองตามสาขา
    if (role) filters.role = role as string;                        // ← กรองตาม role
    if (status) filters.status = status as string;                  // ← กรองตาม status
    if (search) filters.search = search as string;                  // ← ค้นหาชื่อ/รหัส

    // ✅ STEP 2: ส่งต่อให้ userService.getUsers()
    const result = await userService.getUsers(
      requester.userId,                           // ← userId ของผู้ request
      requester.role,                             // ← role (สำหรับ RBAC filter)
      requester.branchId,                         // ← สาขา (Admin เห็นเฉพาะสาขาตัวเอง)
      filters,                                    // ← filter object
      page ? parseInt(page as string) : 1,        // ← หน้าปัจจุบัน (default: 1)
      limit ? parseInt(limit as string) : 20      // ← จำนวนต่อหน้า (default: 20)
    );

    sendSuccess(res, result);  // ← return { users, total, page, limit }
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้');
  }
};

// ═══════════════════════════════════════════════════════════════
// 3️⃣ getUserById() — ดึงข้อมูลพนักงานตาม ID
// ═══════════════════════════════════════════════════════════════
// GET /api/users/:id
export const getUserById = async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id as string);  // ← ดึง userId จาก URL param

    // ✅ STEP 1: Validate userId
    if (!userId || isNaN(userId)) {
      return sendError(res, 'กรุณาระบุ userId ที่ถูกต้อง', 400);  // ← 400 Bad Request
    }

    const requester = req.user!;  // ← ข้อมูล requester จาก JWT

    // ✅ STEP 2: ส่งต่อให้ userService.getUserById()
    const user = await userService.getUserById(
      userId,                    // ← target userId
      requester.userId,          // ← requester userId
      requester.role,            // ← role (สำหรับ RBAC)
      requester.branchId         // ← สาขา (Admin เห็นเฉพาะสาขาตัวเอง)
    );

    sendSuccess(res, user);  // ← return user object
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลผู้ใช้');
  }
};

// ═══════════════════════════════════════════════════════════════
// 4️⃣ updateUser() — แก้ไขข้อมูลพนักงาน
// ═══════════════════════════════════════════════════════════════
// PUT /api/users/:id
// - แก้ไขได้: ชื่อ, เบอร์, อีเมล, nationalId, แผนก, ตำแหน่ง ฯลฯ
// - Reset รหัสผ่าน: ส่ง field `password` มาใน body → hash ด้วย bcrypt
// - Admin แก้ได้เฉพาะสาขาตัวเอง, SuperAdmin แก้ได้ทุกคน
export const updateUser = async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id as string);  // ← ดึง userId จาก URL param

    // ✅ STEP 1: Validate userId
    if (!userId || isNaN(userId)) {
      return sendError(res, 'กรุณาระบุ userId ที่ถูกต้อง', 400);  // ← 400 Bad Request
    }

    const requester = req.user!;  // ← ข้อมูล requester จาก JWT

    // ✅ STEP 2: ตรวจสิทธิ์
    if (!['ADMIN', 'SUPERADMIN'].includes(requester.role)) {
      return sendError(res, 'ไม่มีสิทธิ์แก้ไขผู้ใช้ (ต้องเป็น ADMIN หรือ SUPERADMIN)', 403);  // ← 403 Forbidden
    }

    const { ...updateData } = req.body;  // ← ดึงข้อมูลที่ต้องการแก้ไข

    // ✅ STEP 3: ส่งต่อให้ userService.updateUser()
    const updatedUser = await userService.updateUser(
      userId,                    // ← target userId
      requester.userId,          // ← ผู้แก้ไข
      requester.role,            // ← role ของผู้แก้ไข
      requester.branchId,        // ← สาขาของผู้แก้ไข
      updateData                 // ← ข้อมูลที่ต้องการแก้ไข (partial)
    );

    // ✅ STEP 4: Broadcast ผ่าน WebSocket
    broadcastUserUpdate('UPDATE', updatedUser);  // ← แจ้ง real-time ทุก client

    sendSuccess(res, updatedUser, 'อัปเดตผู้ใช้เรียบร้อยแล้ว');  // ← 200 OK
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการอัปเดตผู้ใช้');
  }
};

// ═══════════════════════════════════════════════════════════════
// 5️⃣ deleteUser() — ลบพนักงาน (Soft Delete)
// ═══════════════════════════════════════════════════════════════
// DELETE /api/users/:id
// Body: { deleteReason: string } — จำเป็น เพื่อบันทึกใน Audit Log
// ไม่ลบจริง → เปลี่ยน status เป็น RESIGNED เพื่อรักษาประวัติ
export const deleteUser = async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id as string);  // ← ดึง userId จาก URL param

    // ✅ STEP 1: Validate userId
    if (!userId || isNaN(userId)) {
      return sendError(res, 'กรุณาระบุ userId ที่ถูกต้อง', 400);  // ← 400 Bad Request
    }

    const requester = req.user!;  // ← ข้อมูล requester จาก JWT

    // ✅ STEP 2: ตรวจสิทธิ์
    if (!['ADMIN', 'SUPERADMIN'].includes(requester.role)) {
      return sendError(res, 'ไม่มีสิทธิ์ลบผู้ใช้ (ต้องเป็น ADMIN หรือ SUPERADMIN)', 403);  // ← 403 Forbidden
    }

    const { deleteReason } = req.body;  // ← ดึงเหตุผลจาก body

    // ✅ STEP 3: Validate deleteReason
    if (!deleteReason || deleteReason.trim().length === 0) {
      return sendError(res, 'กรุณาระบุเหตุผลในการลบ (deleteReason)', 400);  // ← ต้องมีเหตุผล
    }

    // ✅ STEP 4: ส่งต่อให้ userService.deleteUser()
    const result = await userService.deleteUser(
      userId,                    // ← target userId
      requester.userId,          // ← ผู้ลบ
      requester.role,            // ← role ของผู้ลบ
      requester.branchId,        // ← สาขาของผู้ลบ
      deleteReason               // ← เหตุผลในการลบ
    );

    // ✅ STEP 5: Broadcast ผ่าน WebSocket
    broadcastUserUpdate('DELETE', result);  // ← แจ้ง real-time ทุก client

    sendSuccess(res, null, 'ลบผู้ใช้เรียบร้อยแล้ว');  // ← 200 OK
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการลบผู้ใช้');
  }
};

// ═══════════════════════════════════════════════════════════════
// 6️⃣ bulkCreateUsers() — นำเข้าพนักงานจาก CSV
// ═══════════════════════════════════════════════════════════════
// POST /api/users/bulk
// Body: { csvData: string } — CSV data as string
// employeeId จะถูก auto-generate จาก branchCode + running number
export const bulkCreateUsers = async (req: Request, res: Response) => {
  try {
    const requester = req.user!;  // ← ข้อมูล requester จาก JWT

    // ✅ STEP 1: ตรวจสิทธิ์
    if (!['ADMIN', 'SUPERADMIN'].includes(requester.role)) {
      return sendError(res, 'ไม่มีสิทธิ์นำเข้าข้อมูล (ต้องเป็น ADMIN หรือ SUPERADMIN)', 403);  // ← 403 Forbidden
    }
    const { csvData } = req.body;  // ← ดึง CSV data จาก body

    // ✅ STEP 2: Validate csvData
    if (!csvData || typeof csvData !== 'string') {
      return sendError(res, 'กรุณาระบุ csvData', 400);  // ← 400 Bad Request
    }

    // ✅ STEP 3: Parse CSV → array of objects
    let users: any[];
    try {
      users = parse(csvData, {
        columns: true,          // ← ใช้ row แรกเป็น column names
        skip_empty_lines: true, // ← ข้ามบรรทัดว่าง
        trim: true,             // ← ตัด whitespace
      });
    } catch (parseError: any) {
      return sendError(res, `รูปแบบ CSV ไม่ถูกต้อง: ${parseError.message}`, 400);  // ← parse error
    }

    if (!users || users.length === 0) {
      return sendError(res, 'ไม่พบข้อมูลใน CSV', 400);  // ← CSV ว่าง
    }

    // ✅ STEP 4: ส่งต่อให้ userService.bulkCreateUsers()
    const result = await userService.bulkCreateUsers(
      users,                     // ← array ของ user data
      requester.userId,          // ← ผู้ import
      requester.role,            // ← role ของผู้ import
      requester.branchId         // ← สาขาของผู้ import
    );

    // ✅ STEP 5: Broadcast ผ่าน WebSocket
    if (result.success > 0) {  // ← broadcast เฉพาะเมื่อมีสร้างสำเร็จ
      broadcastUserUpdate('BULK_CREATE', {
        success: result.success,            // ← จำนวนสำเร็จ
        failed: result.failed,              // ← จำนวนล้มเหลว
        createdUsers: result.createdUsers,  // ← รายชื่อที่สร้างสำเร็จ
      });
    }

    sendSuccess(res, result, `นำเข้าข้อมูลสำเร็จ ${result.success} รายการ, ล้มเหลว ${result.failed} รายการ`, 201);  // ← 201 Created
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการนำเข้าข้อมูล');
  }
};

// ═══════════════════════════════════════════════════════════════
// 7️⃣ getUserStatistics() — ดึงสถิติพนักงาน (Dashboard)
// ═══════════════════════════════════════════════════════════════
// GET /api/users/statistics
export const getUserStatistics = async (req: Request, res: Response) => {
  try {
    const requester = req.user!;  // ← ข้อมูล requester จาก JWT

    // ✅ STEP 1: ส่งต่อให้ userService.getUserStatistics()
    const statistics = await userService.getUserStatistics(
      requester.role,       // ← role (สำหรับ RBAC filter)
      requester.branchId    // ← สาขา (Admin เห็นเฉพาะสาขาตัวเอง)
    );

    sendSuccess(res, statistics);  // ← return { total, byStatus, byRole }
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการดึงข้อมูลสถิติ');
  }
};

// ═══════════════════════════════════════════════════════════════
// 8️⃣ getUserAvatar() — ดึง Avatar URL ของพนักงาน
// ═══════════════════════════════════════════════════════════════
// GET /api/users/:id/avatar
export const getUserAvatar = async (req: Request, res: Response) => {
  try {
    const userId = parseInt(req.params.id as string);  // ← ดึง userId จาก URL param

    // ✅ STEP 1: Validate userId
    if (!userId || isNaN(userId)) {
      return sendError(res, 'กรุณาระบุ userId ที่ถูกต้อง', 400);  // ← 400 Bad Request
    }

    // ✅ STEP 2: ดึงข้อมูล user
    const user = await userService.getUserById(userId);  // ← ดึง user จาก DB
    
    sendSuccess(res, { 
      userId: user.userId,          // ← userId
      employeeId: user.employeeId,  // ← รหัสพนักงาน
      avatarUrl: user.avatarUrl     // ← avatar URL (Supabase หรือ fallback)
    });
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการดึงรูปโปรไฟล์');
  }
};

// ═══════════════════════════════════════════════════════════════
// 9️⃣ getCsvTemplate() — ดาวน์โหลด CSV template สำหรับ bulk import
// ═══════════════════════════════════════════════════════════════
// GET /api/users/csv-template
export const getCsvTemplate = async (_req: Request, res: Response) => {
  try {
    // ✅ STEP 1: สร้าง CSV template พร้อมตัวอย่างข้อมูล
    const template = `employeeId,firstName,lastName,nickname,nationalId,emergent_tel,emergent_first_name,emergent_last_name,emergent_relation,phone,email,password,birthDate,branchId,role,avatarGender
EMP001,สมชาย,ใจดี,ชาย,1234567890123,0812345678,สมหญิง,ใจดี,ภรรยา,0898765432,somchai@example.com,password123,1990-01-15,1,USER,male
EMP002,สมหญิง,รักดี,หญิง,1234567890124,0812345679,สมชาย,รักดี,สามี,0898765433,somying@example.com,password456,1992-05-20,1,USER,female`;

    // ✅ STEP 2: ตั้ง HTTP headers สำหรับ download
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');  // ← MIME type = CSV
    res.setHeader('Content-Disposition', 'attachment; filename=users_import_template.csv');  // ← filename
    res.send('\ufeff' + template);  // ← \ufeff = BOM สำหรับ Excel UTF-8 support
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการสร้าง template');
  }
};

// ═══════════════════════════════════════════════════════════════
// 📦 Default Export — รวมทุก function ที่ export
// ═══════════════════════════════════════════════════════════════
export default {
  createUser,           // ← 1️⃣ สร้างพนักงานใหม่
  getUsers,             // ← 2️⃣ ดึงรายชื่อพนักงาน
  getUserById,          // ← 3️⃣ ดึงข้อมูลพนักงานตาม ID
  updateUser,           // ← 4️⃣ แก้ไขข้อมูลพนักงาน
  deleteUser,           // ← 5️⃣ ลบพนักงาน (soft delete)
  bulkCreateUsers,      // ← 6️⃣ Import พนักงานจาก CSV
  getUserStatistics,    // ← 7️⃣ ดึงสถิติ (Dashboard)
  getUserAvatar,        // ← 8️⃣ ดึง Avatar URL
  getCsvTemplate,       // ← 9️⃣ ดาวน์โหลด CSV template
};
