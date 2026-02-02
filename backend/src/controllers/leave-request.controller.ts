import type { Request, Response } from 'express';
import { 
  LeaveRequestUserActions, 
  LeaveRequestAdminActions 
} from '../services/leave-request.service.js';
import { sendSuccess, sendError } from '../utils/response.js';

/**
 * Leave Request Controller - จัดการ API ใบลา
 */

/**
 * POST /api/leave-requests
 * สร้างใบลาใหม่
 */
export const createLeaveRequest = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return sendError(res, 'ไม่พบข้อมูลผู้ใช้', 401);
    }

    const { leaveType, startDate, endDate, reason, attachmentUrl } = req.body;

    if (!leaveType || !startDate || !endDate) {
      return sendError(res, 'กรุณาระบุ leaveType, startDate, endDate', 400);
    }

    if (!['SICK', 'PERSONAL', 'VACATION'].includes(leaveType)) {
      return sendError(res, 'leaveType ต้องเป็น SICK, PERSONAL, หรือ VACATION', 400);
    }

    const leaveRequest = await LeaveRequestUserActions.createLeaveRequest({
      userId,
      leaveType,
      startDate: new Date(startDate),
      endDate: new Date(endDate),
      reason,
      attachmentUrl,
    });

    sendSuccess(res, leaveRequest, 'สร้างใบลาเรียบร้อยแล้ว', 201);
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการสร้างใบลา');
  }
};

/**
 * GET /api/leave-requests/my
 * ดึงใบลาของผู้ใช้เอง
 */
export const getMyLeaveRequests = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return sendError(res, 'ไม่พบข้อมูลผู้ใช้', 401);
    }

    const status = req.query.status as 'PENDING' | 'APPROVED' | 'REJECTED' | undefined;
    const skip = req.query.skip ? parseInt(req.query.skip as string) : 0;
    const take = req.query.take ? parseInt(req.query.take as string) : 10;

    const result = await LeaveRequestUserActions.getLeaveRequestsByUser(
      userId,
      status,
      skip,
      take
    );

    sendSuccess(res, result, 'ดึงใบลาสำเร็จ');
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการดึงใบลา');
  }
};

/**
 * GET /api/leave-requests/my/statistics
 * ดึงสถิติการลาของผู้ใช้เอง
 */
export const getMyLeaveStatistics = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return sendError(res, 'ไม่พบข้อมูลผู้ใช้', 401);
    }

    const statistics = await LeaveRequestUserActions.getLeaveStatistics(userId);

    sendSuccess(res, statistics, 'ดึงสถิติการลาสำเร็จ');
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการดึงสถิติ');
  }
};

/**
 * GET /api/leave-requests
 * ดึงใบลาทั้งหมด (Admin only)
 */
export const getAllLeaveRequests = async (req: Request, res: Response) => {
  try {
    const status = req.query.status as 'PENDING' | 'APPROVED' | 'REJECTED' | undefined;
    const skip = req.query.skip ? parseInt(req.query.skip as string) : 0;
    const take = req.query.take ? parseInt(req.query.take as string) : 10;

    const result = await LeaveRequestAdminActions.getAllLeaveRequests(status, skip, take);

    sendSuccess(res, result, 'ดึงใบลาสำเร็จ');
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการดึงใบลา');
  }
};

/**
 * GET /api/leave-requests/:id
 * ดึงใบลาด้วย ID
 */
export const getLeaveRequestById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const leaveId = parseInt(id);

    if (!leaveId) {
      return sendError(res, 'ID ใบลาไม่ถูกต้อง', 400);
    }

    const leaveRequest = await LeaveRequestUserActions.getLeaveRequestById(leaveId);

    if (!leaveRequest) {
      return sendError(res, 'ไม่พบใบลา', 404);
    }

    sendSuccess(res, leaveRequest);
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการดึงใบลา');
  }
};

/**
 * PATCH /api/leave-requests/:id
 * แก้ไขใบลา
 */
export const updateLeaveRequest = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    const leaveId = parseInt(id);

    if (!userId) {
      return sendError(res, 'ไม่พบข้อมูลผู้ใช้', 401);
    }

    if (!leaveId) {
      return sendError(res, 'ID ใบลาไม่ถูกต้อง', 400);
    }

    const leaveRequest = await LeaveRequestUserActions.getLeaveRequestById(leaveId);

    if (!leaveRequest) {
      return sendError(res, 'ไม่พบใบลา', 404);
    }

    // ตรวจสอบว่าเป็นเจ้าของหรือ Admin
    if (leaveRequest.user.userId !== userId && req.user?.role !== 'ADMIN' && req.user?.role !== 'SUPERADMIN') {
      return sendError(res, 'คุณไม่มีสิทธิ์แก้ไขใบลานี้', 403);
    }

    const { leaveType, startDate, endDate, reason, attachmentUrl } = req.body;

    const updatedLeaveRequest = await LeaveRequestUserActions.updateLeaveRequest(leaveId, {
      leaveType,
      startDate: startDate ? new Date(startDate) : undefined,
      endDate: endDate ? new Date(endDate) : undefined,
      reason,
      attachmentUrl,
    });

    sendSuccess(res, updatedLeaveRequest, 'แก้ไขใบลาเรียบร้อยแล้ว');
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการแก้ไขใบลา');
  }
};

/**
 * POST /api/leave-requests/:id/approve
 * อนุมัติใบลา (Admin only)
 */
export const approveLeaveRequest = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    const leaveId = parseInt(id);
    const { adminComment } = req.body;

    if (!userId) {
      return sendError(res, 'ไม่พบข้อมูลผู้ใช้', 401);
    }

    if (!leaveId) {
      return sendError(res, 'ID ใบลาไม่ถูกต้อง', 400);
    }

    const leaveRequest = await LeaveRequestUserActions.getLeaveRequestById(leaveId);

    if (!leaveRequest) {
      return sendError(res, 'ไม่พบใบลา', 404);
    }

    const approvedLeaveRequest = await LeaveRequestAdminActions.approveLeaveRequest(leaveId, {
      approvedByUserId: userId,
      adminComment,
    });

    sendSuccess(res, approvedLeaveRequest, 'อนุมัติใบลาเรียบร้อยแล้ว');
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการอนุมัติใบลา');
  }
};

/**
 * POST /api/leave-requests/:id/reject
 * ปฏิเสธใบลา (Admin only)
 */
export const rejectLeaveRequest = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    const leaveId = parseInt(id);
    const { rejectionReason } = req.body;

    if (!userId) {
      return sendError(res, 'ไม่พบข้อมูลผู้ใช้', 401);
    }

    if (!leaveId) {
      return sendError(res, 'ID ใบลาไม่ถูกต้อง', 400);
    }

    if (!rejectionReason) {
      return sendError(res, 'กรุณาระบุเหตุผลการปฏิเสธ', 400);
    }

    const leaveRequest = await LeaveRequestUserActions.getLeaveRequestById(leaveId);

    if (!leaveRequest) {
      return sendError(res, 'ไม่พบใบลา', 404);
    }

    const rejectedLeaveRequest = await LeaveRequestAdminActions.rejectLeaveRequest(leaveId, {
      approvedByUserId: userId,
      rejectionReason,
    });

    sendSuccess(res, rejectedLeaveRequest, 'ปฏิเสธใบลาเรียบร้อยแล้ว');
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการปฏิเสธใบลา');
  }
};

/**
 * DELETE /api/leave-requests/:id
 * ลบใบลา (เฉพาะ PENDING)
 */
export const deleteLeaveRequest = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    const leaveId = parseInt(id);

    if (!userId) {
      return sendError(res, 'ไม่พบข้อมูลผู้ใช้', 401);
    }

    if (!leaveId) {
      return sendError(res, 'ID ใบลาไม่ถูกต้อง', 400);
    }

    const leaveRequest = await LeaveRequestUserActions.getLeaveRequestById(leaveId);

    if (!leaveRequest) {
      return sendError(res, 'ไม่พบใบลา', 404);
    }

    // ตรวจสอบว่าเป็นเจ้าของหรือ Admin
    if (leaveRequest.user.userId !== userId && req.user?.role !== 'ADMIN' && req.user?.role !== 'SUPERADMIN') {
      return sendError(res, 'คุณไม่มีสิทธิ์ลบใบลานี้', 403);
    }

    await LeaveRequestUserActions.deleteLeaveRequest(leaveId);

    sendSuccess(res, null, 'ลบใบลาเรียบร้อยแล้ว');
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการลบใบลา');
  }
};
