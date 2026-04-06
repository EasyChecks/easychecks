import type { Request, Response } from 'express';
import { 
  LateRequestUserActions, 
  LateRequestAdminActions 
} from '../services/late-request.service.js';
import { sendSuccess } from '../utils/response.js';
import { asyncHandler } from '../utils/async-handler.js';
import { UnauthorizedError, BadRequestError, NotFoundError, ForbiddenError } from '../utils/custom-errors.js';
import { uploadAttachmentToSupabase } from '../utils/supabase-storage.js';

/**
 * Late Request Controller - จัดการ API การขอมาสาย
 */

/**
 * POST /api/late-requests/upload-attachment - อัปโหลดไฟล์แนบ
 */
export const uploadAttachment = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  if (!userId) throw new UnauthorizedError('ไม่พบข้อมูลผู้ใช้');

  const { base64, mimeType, filename } = req.body;
  if (!base64 || !mimeType) throw new BadRequestError('กรุณาส่ง base64 และ mimeType');

  const url = await uploadAttachmentToSupabase(base64, mimeType, userId, filename);
  sendSuccess(res, { url }, 'อัปโหลดไฟล์สำเร็จ');
});

/**
 * POST /api/late-requests - สร้างคำขอมาสายใหม่
 * 
 * เหตุผลการตรวจสอบ:
 *    - userId: เพื่อระบุว่าใครสร้างคำขอมาสาย
 *    - รูปแบบเวลา: validate ก่อน calculate นาทีสาย
 *    - duplicate: ตรวจสอบใน service layer เพื่อป้องกันคำขอซ้ำในวันเดียวกัน
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

  console.log(`[getLateRequest] userId=${userId}, status=${status}, skip=${skip}, take=${take}`);

  try {
    const result = await LateRequestUserActions.getLateRequestsByUser(
      userId,
      status,
      skip,
      take
    );
    sendSuccess(res, result, 'ดึงคำขอมาสายสำเร็จ');
  } catch (error) {
    console.error('[getLateRequest] Error:', error);
    throw error;
  }
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
  const userRole = (req.user?.role as string | undefined); // Get current user's role for approval hierarchy filtering
  const currentUserId = req.user?.userId; // Get current user's ID for self-request inclusion

  const result = await LateRequestAdminActions.getAllLateRequests(status, skip, take, userRole, currentUserId);

  sendSuccess(res, result, 'ดึงคำขอมาสายสำเร็จ');
});

/**
 * GET /api/late-requests/:id
 * ดึงคำขอมาสายด้วย ID
 */
export const getLateRequestById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const lateRequestId = parseInt(Array.isArray(id) ? id[0] : id);

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
 * PUT /api/late-requests/:id
 * แก้ไขคำขอมาสาย
 */
export const updateLateRequest = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const { id } = req.params;
  const lateRequestId = parseInt(Array.isArray(id) ? id[0] : id);

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
  const lateRequestId = parseInt(Array.isArray(id) ? id[0] : id);
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
  const lateRequestId = parseInt(Array.isArray(id) ? id[0] : id);
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
  const lateRequestId = parseInt(Array.isArray(id) ? id[0] : id);

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

  // Allow user to cancel their own pending requests (or admin/superadmin)
  if (lateRequest.userId !== userId && req.user?.role !== 'ADMIN' && req.user?.role !== 'SUPERADMIN') {
    throw new ForbiddenError('คุณไม่มีสิทธิ์ยกเลิกคำขอมาสายนี้');
  }

  await LateRequestUserActions.deleteLateRequest(lateRequestId);

  sendSuccess(res, null, 'ยกเลิกคำขอมาสายเรียบร้อยแล้ว');
});
