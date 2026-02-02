import type { Request, Response } from 'express';
import { 
  LateRequestUserActions, 
  LateRequestAdminActions 
} from '../services/late-request.service.js';
import { sendSuccess, sendError } from '../utils/response.js';

/**
 * Late Request Controller - จัดการ API การขอมาสาย
 */

/**
 * POST /api/late-requests
 * สร้างคำขอมาสายใหม่
 */
export const createLateRequest = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return sendError(res, 'ไม่พบข้อมูลผู้ใช้', 401);
    }

    const { attendanceId, requestDate, scheduledTime, actualTime, reason, attachmentUrl } = req.body;

    if (!requestDate || !scheduledTime || !actualTime || !reason) {
      return sendError(res, 'กรุณาระบุ requestDate, scheduledTime, actualTime, reason', 400);
    }

    const lateRequest = await LateRequestUserActions.createLateRequest({
      userId,
      attendanceId: attendanceId ? parseInt(attendanceId) : undefined,
      requestDate: new Date(requestDate),
      scheduledTime,
      actualTime,
      reason,
      attachmentUrl,
    });

    sendSuccess(res, lateRequest, 'สร้างคำขอมาสายเรียบร้อยแล้ว', 201);
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการสร้างคำขอมาสาย');
  }
};

/**
 * GET /api/late-requests/my
 * ดึงคำขอมาสายของผู้ใช้เอง
 */
export const getMyLateRequests = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return sendError(res, 'ไม่พบข้อมูลผู้ใช้', 401);
    }

    const status = req.query.status as 'PENDING' | 'APPROVED' | 'REJECTED' | undefined;
    const skip = req.query.skip ? parseInt(req.query.skip as string) : 0;
    const take = req.query.take ? parseInt(req.query.take as string) : 10;

    const result = await LateRequestUserActions.getLateRequestsByUser(
      userId,
      status,
      skip,
      take
    );

    sendSuccess(res, result, 'ดึงคำขอมาสายสำเร็จ');
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการดึงคำขอมาสาย');
  }
};

/**
 * GET /api/late-requests/my/statistics
 * ดึงสถิติการมาสายของผู้ใช้เอง
 */
export const getMyLateStatistics = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;

    if (!userId) {
      return sendError(res, 'ไม่พบข้อมูลผู้ใช้', 401);
    }

    const statistics = await LateRequestUserActions.getLateStatistics(userId);

    sendSuccess(res, statistics, 'ดึงสถิติการมาสายสำเร็จ');
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการดึงสถิติ');
  }
};

/**
 * GET /api/late-requests
 * ดึงคำขอมาสายทั้งหมด (Admin only)
 */
export const getAllLateRequests = async (req: Request, res: Response) => {
  try {
    const status = req.query.status as 'PENDING' | 'APPROVED' | 'REJECTED' | undefined;
    const skip = req.query.skip ? parseInt(req.query.skip as string) : 0;
    const take = req.query.take ? parseInt(req.query.take as string) : 10;

    const result = await LateRequestAdminActions.getAllLateRequests(status, skip, take);

    sendSuccess(res, result, 'ดึงคำขอมาสายสำเร็จ');
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการดึงคำขอมาสาย');
  }
};

/**
 * GET /api/late-requests/:id
 * ดึงคำขอมาสายด้วย ID
 */
export const getLateRequestById = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const lateRequestId = parseInt(id);

    if (!lateRequestId) {
      return sendError(res, 'ID คำขอมาสายไม่ถูกต้อง', 400);
    }

    const lateRequest = await LateRequestUserActions.getLateRequestById(lateRequestId);

    if (!lateRequest) {
      return sendError(res, 'ไม่พบคำขอมาสาย', 404);
    }

    sendSuccess(res, lateRequest);
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการดึงคำขอมาสาย');
  }
};

/**
 * PATCH /api/late-requests/:id
 * แก้ไขคำขอมาสาย
 */
export const updateLateRequest = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    const lateRequestId = parseInt(id);

    if (!userId) {
      return sendError(res, 'ไม่พบข้อมูลผู้ใช้', 401);
    }

    if (!lateRequestId) {
      return sendError(res, 'ID คำขอมาสายไม่ถูกต้อง', 400);
    }

    const lateRequest = await LateRequestUserActions.getLateRequestById(lateRequestId);

    if (!lateRequest) {
      return sendError(res, 'ไม่พบคำขอมาสาย', 404);
    }

    // ตรวจสอบว่าเป็นเจ้าของหรือ Admin
    if (lateRequest.user.userId !== userId && req.user?.role !== 'ADMIN' && req.user?.role !== 'SUPERADMIN') {
      return sendError(res, 'คุณไม่มีสิทธิ์แก้ไขคำขอมาสายนี้', 403);
    }

    const { requestDate, scheduledTime, actualTime, reason, attachmentUrl } = req.body;

    const updatedLateRequest = await LateRequestUserActions.updateLateRequest(lateRequestId, {
      requestDate: requestDate ? new Date(requestDate) : undefined,
      scheduledTime,
      actualTime,
      reason,
      attachmentUrl,
    });

    sendSuccess(res, updatedLateRequest, 'แก้ไขคำขอมาสายเรียบร้อยแล้ว');
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการแก้ไขคำขอมาสาย');
  }
};

/**
 * POST /api/late-requests/:id/approve
 * อนุมัติคำขอมาสาย (Admin only)
 */
export const approveLateRequest = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    const lateRequestId = parseInt(id);
    const { adminComment } = req.body;

    if (!userId) {
      return sendError(res, 'ไม่พบข้อมูลผู้ใช้', 401);
    }

    if (!lateRequestId) {
      return sendError(res, 'ID คำขอมาสายไม่ถูกต้อง', 400);
    }

    const lateRequest = await LateRequestUserActions.getLateRequestById(lateRequestId);

    if (!lateRequest) {
      return sendError(res, 'ไม่พบคำขอมาสาย', 404);
    }

    const approvedLateRequest = await LateRequestAdminActions.approveLateRequest(lateRequestId, {
      approvedByUserId: userId,
      adminComment,
    });

    sendSuccess(res, approvedLateRequest, 'อนุมัติคำขอมาสายเรียบร้อยแล้ว');
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการอนุมัติคำขอมาสาย');
  }
};

/**
 * POST /api/late-requests/:id/reject
 * ปฏิเสธคำขอมาสาย (Admin only)
 */
export const rejectLateRequest = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    const lateRequestId = parseInt(id);
    const { rejectionReason } = req.body;

    if (!userId) {
      return sendError(res, 'ไม่พบข้อมูลผู้ใช้', 401);
    }

    if (!lateRequestId) {
      return sendError(res, 'ID คำขอมาสายไม่ถูกต้อง', 400);
    }

    if (!rejectionReason) {
      return sendError(res, 'กรุณาระบุเหตุผลการปฏิเสธ', 400);
    }

    const lateRequest = await LateRequestUserActions.getLateRequestById(lateRequestId);

    if (!lateRequest) {
      return sendError(res, 'ไม่พบคำขอมาสาย', 404);
    }

    const rejectedLateRequest = await LateRequestAdminActions.rejectLateRequest(lateRequestId, {
      approvedByUserId: userId,
      rejectionReason,
    });

    sendSuccess(res, rejectedLateRequest, 'ปฏิเสธคำขอมาสายเรียบร้อยแล้ว');
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการปฏิเสธคำขอมาสาย');
  }
};

/**
 * DELETE /api/late-requests/:id
 * ลบคำขอมาสาย (เฉพาะ PENDING)
 */
export const deleteLateRequest = async (req: Request, res: Response) => {
  try {
    const userId = req.user?.userId;
    const { id } = req.params;
    const lateRequestId = parseInt(id);

    if (!userId) {
      return sendError(res, 'ไม่พบข้อมูลผู้ใช้', 401);
    }

    if (!lateRequestId) {
      return sendError(res, 'ID คำขอมาสายไม่ถูกต้อง', 400);
    }

    const lateRequest = await LateRequestUserActions.getLateRequestById(lateRequestId);

    if (!lateRequest) {
      return sendError(res, 'ไม่พบคำขอมาสาย', 404);
    }

    // ตรวจสอบว่าเป็นเจ้าของหรือ Admin
    if (lateRequest.user.userId !== userId && req.user?.role !== 'ADMIN' && req.user?.role !== 'SUPERADMIN') {
      return sendError(res, 'คุณไม่มีสิทธิ์ลบคำขอมาสายนี้', 403);
    }

    await LateRequestUserActions.deleteLateRequest(lateRequestId);

    sendSuccess(res, null, 'ลบคำขอมาสายเรียบร้อยแล้ว');
  } catch (error: any) {
    sendError(res, error.message || 'เกิดข้อผิดพลาดในการลบคำขอมาสาย');
  }
};
