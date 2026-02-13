import type { Request, Response } from 'express';
import { 
  LateRequestUserActions, 
  LateRequestAdminActions 
} from '../services/late-request.service.js';
import { sendSuccess, sendError } from '../utils/response.js';
import { asyncHandler } from '../utils/async-handler.js';
import { UnauthorizedError, BadRequestError, NotFoundError, ForbiddenError } from '../utils/custom-errors.js';

/**
 * Late Request Controller - จัดการ API การขอมาสาย
 */

/**
 * POST /api/late-requests
 * สร้างคำขอมาสายใหม่
 */
export const createLateRequest = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    throw new UnauthorizedError('ไม่พบข้อมูลผู้ใช้');
  }

  const { attendanceId, requestDate, scheduledTime, actualTime, reason, attachmentUrl } = req.body;

  if (!requestDate || !scheduledTime || !actualTime || !reason) {
    throw new BadRequestError('กรุณาระบุ requestDate, scheduledTime, actualTime, reason');
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
});

/**
 * GET /api/late-requests/my
 * ดึงคำขอมาสายของผู้ใช้เอง
 */
export const getMyLateRequests = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    throw new UnauthorizedError('ไม่พบข้อมูลผู้ใช้');
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
});

/**
 * GET /api/late-requests/my/statistics
 * ดึงสถิติการมาสายของผู้ใช้เอง
 */
export const getMyLateStatistics = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    throw new UnauthorizedError('ไม่พบข้อมูลผู้ใช้');
  }

  const statistics = await LateRequestUserActions.getLateStatistics(userId);

  sendSuccess(res, statistics, 'ดึงสถิติการมาสายสำเร็จ');
});

/**
 * GET /api/late-requests
 * ดึงคำขอมาสายทั้งหมด (Admin only)
 */
export const getAllLateRequests = asyncHandler(async (req: Request, res: Response) => {
  const status = req.query.status as 'PENDING' | 'APPROVED' | 'REJECTED' | undefined;
  const skip = req.query.skip ? parseInt(req.query.skip as string) : 0;
  const take = req.query.take ? parseInt(req.query.take as string) : 10;

  const result = await LateRequestAdminActions.getAllLateRequests(status, skip, take);

  sendSuccess(res, result, 'ดึงคำขอมาสายสำเร็จ');
});

/**
 * GET /api/late-requests/:id
 * ดึงคำขอมาสายด้วย ID
 */
export const getLateRequestById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const lateRequestId = parseInt(id);

  if (!lateRequestId) {
    throw new BadRequestError('ID คำขอมาสายไม่ถูกต้อง');
  }

  const lateRequest = await LateRequestUserActions.getLateRequestById(lateRequestId);

  if (!lateRequest) {
    throw new NotFoundError('ไม่พบคำขอมาสาย');
  }

  sendSuccess(res, lateRequest);
});

/**
 * PATCH /api/late-requests/:id
 * แก้ไขคำขอมาสาย
 */
export const updateLateRequest = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const { id } = req.params;
  const lateRequestId = parseInt(id);

  if (!userId) {
    throw new UnauthorizedError('ไม่พบข้อมูลผู้ใช้');
  }

  if (!lateRequestId) {
    throw new BadRequestError('ID คำขอมาสายไม่ถูกต้อง');
  }

  const lateRequest = await LateRequestUserActions.getLateRequestById(lateRequestId);

  if (!lateRequest) {
    throw new NotFoundError('ไม่พบคำขอมาสาย');
  }

  // ตรวจสอบว่าเป็นเจ้าของหรือ Admin
  if (lateRequest.userId !== userId && req.user?.role !== 'ADMIN' && req.user?.role !== 'SUPERADMIN') {
    throw new ForbiddenError('คุณไม่มีสิทธิ์แก้ไขคำขอมาสายนี้');
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
});

/**
 * POST /api/late-requests/:id/approve
 * อนุมัติคำขอมาสาย (Admin only)
 */
export const approveLateRequest = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const { id } = req.params;
  const lateRequestId = parseInt(id);
  const { adminComment } = req.body;

  if (!userId) {
    throw new UnauthorizedError('ไม่พบข้อมูลผู้ใช้');
  }

  if (!lateRequestId) {
    throw new BadRequestError('ID คำขอมาสายไม่ถูกต้อง');
  }

  const lateRequest = await LateRequestUserActions.getLateRequestById(lateRequestId);

  if (!lateRequest) {
    throw new NotFoundError('ไม่พบคำขอมาสาย');
  }

  const approvedLateRequest = await LateRequestAdminActions.approveLateRequest(lateRequestId, {
    approvedByUserId: userId,
    adminComment,
  });

  sendSuccess(res, approvedLateRequest, 'อนุมัติคำขอมาสายเรียบร้อยแล้ว');
});

/**
 * POST /api/late-requests/:id/reject
 * ปฏิเสธคำขอมาสาย (Admin only)
 */
export const rejectLateRequest = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const { id } = req.params;
  const lateRequestId = parseInt(id);
  const { rejectionReason } = req.body;

  if (!userId) {
    throw new UnauthorizedError('ไม่พบข้อมูลผู้ใช้');
  }

  if (!lateRequestId) {
    throw new BadRequestError('ID คำขอมาสายไม่ถูกต้อง');
  }

  if (!rejectionReason) {
    throw new BadRequestError('กรุณาระบุเหตุผลการปฏิเสธ');
  }

  const lateRequest = await LateRequestUserActions.getLateRequestById(lateRequestId);

  if (!lateRequest) {
    throw new NotFoundError('ไม่พบคำขอมาสาย');
  }

  const rejectedLateRequest = await LateRequestAdminActions.rejectLateRequest(lateRequestId, {
    approvedByUserId: userId,
    rejectionReason,
  });

  sendSuccess(res, rejectedLateRequest, 'ปฏิเสธคำขอมาสายเรียบร้อยแล้ว');
});

/**
 * DELETE /api/late-requests/:id
 * ลบคำขอมาสาย (เฉพาะ PENDING)
 */
export const deleteLateRequest = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const { id } = req.params;
  const lateRequestId = parseInt(id);

  if (!userId) {
    throw new UnauthorizedError('ไม่พบข้อมูลผู้ใช้');
  }

  if (!lateRequestId) {
    throw new BadRequestError('ID คำขอมาสายไม่ถูกต้อง');
  }

  const lateRequest = await LateRequestUserActions.getLateRequestById(lateRequestId);

  if (!lateRequest) {
    throw new NotFoundError('ไม่พบคำขอมาสาย');
  }

  // ตรวจสอบว่าเป็นเจ้าของหรือ Admin
  if (lateRequest.userId !== userId && req.user?.role !== 'ADMIN' && req.user?.role !== 'SUPERADMIN') {
    throw new ForbiddenError('คุณไม่มีสิทธิ์ลบคำขอมาสายนี้');
  }

  await LateRequestUserActions.deleteLateRequest(lateRequestId);

  sendSuccess(res, null, 'ลบคำขอมาสายเรียบร้อยแล้ว');
});
