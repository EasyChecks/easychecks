import type { Request, Response } from 'express';
import { 
  LeaveRequestUserActions, 
  LeaveRequestAdminActions 
} from '../services/leave-request.service.js';
import { sendSuccess } from '../utils/response.js';
import { asyncHandler } from '../utils/async-handler.js';
import { UnauthorizedError, BadRequestError, NotFoundError, ForbiddenError } from '../utils/custom-errors.js';

/**
 * Leave Request Controller - จัดการ API ใบลา
 */

/**
 * POST /api/leave-requests - สร้างใบลาใหม่
 * 
 * เหตุผลการตรวจสอบ:
 *    - leaveType: validate ตาม LEAVE_RULES เพื่อตรวจเพศ/วันลาคงเหลือ/ใบแพทย์
 *    - overlapping: ตรวจสอบใบลาซ้อนทับใน service layer
 *    - นับวันทำงาน: คำนวณโดย date-fns เพื่อไม่นับเสาร์-อาทิตย์
 */
export const createLeaveRequest = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    throw new UnauthorizedError('ไม่พบข้อมูลผู้ใช้');
  }

  const { leaveType, startDate, endDate, reason, attachmentUrl, medicalCertificateUrl } = req.body;

  if (!leaveType || !startDate || !endDate) {
    throw new BadRequestError('กรุณาระบุ leaveType, startDate, endDate');
  }

  const validLeaveTypes = ['SICK', 'PERSONAL', 'VACATION', 'MILITARY', 'TRAINING', 'MATERNITY', 'STERILIZATION', 'ORDINATION'];
  if (!validLeaveTypes.includes(leaveType)) {
    throw new BadRequestError(`leaveType ต้องเป็น ${validLeaveTypes.join(', ')}`);
  }

  const leaveRequest = await LeaveRequestUserActions.createLeaveRequest({
    userId,
    leaveType,
    startDate: new Date(startDate),
    endDate: new Date(endDate),
    reason,
    attachmentUrl,
    medicalCertificateUrl,
  });

  sendSuccess(res, leaveRequest, 'สร้างใบลาเรียบร้อยแล้ว', 201);
});

/**
 * GET /api/leave-requests/my
 * ดึงใบลาของผู้ใช้เอง
 */
export const getMyLeaveRequests = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    throw new UnauthorizedError('ไม่พบข้อมูลผู้ใช้');
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
});

/**
 * GET /api/leave-requests/my/statistics
 * ดึงสถิติการลาของผู้ใช้เอง
 */
export const getMyLeaveStatistics = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    throw new UnauthorizedError('ไม่พบข้อมูลผู้ใช้');
  }

  const statistics = await LeaveRequestUserActions.getLeaveStatistics(userId);

  sendSuccess(res, statistics, 'ดึงสถิติการลาสำเร็จ');
});

/**
 * GET /api/leave-requests/my/quota
 * ดึงโควต้าการลาของผู้ใช้เอง (วันลาคงเหลือทุกประเภท)
 */
export const getMyLeaveQuota = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;

  if (!userId) {
    throw new UnauthorizedError('ไม่พบข้อมูลผู้ใช้');
  }

  const quota = await LeaveRequestUserActions.getLeaveQuota(userId);

  sendSuccess(res, quota, 'ดึงโควต้าการลาสำเร็จ');
});

/**
 * GET /api/leave-requests
 * ดึงใบลาทั้งหมด (Admin only)
 */
export const getAllLeaveRequests = asyncHandler(async (req: Request, res: Response) => {
  const status = req.query.status as 'PENDING' | 'APPROVED' | 'REJECTED' | undefined;
  const skip = req.query.skip ? parseInt(req.query.skip as string) : 0;
  const take = req.query.take ? parseInt(req.query.take as string) : 10;

  const result = await LeaveRequestAdminActions.getAllLeaveRequests(status, skip, take);

  sendSuccess(res, result, 'ดึงใบลาสำเร็จ');
});

/**
 * GET /api/leave-requests/:id
 * ดึงใบลาด้วย ID
 */
export const getLeaveRequestById = asyncHandler(async (req: Request, res: Response) => {
  const { id } = req.params;
  const leaveId = parseInt(id as string);

  if (!leaveId) {
    throw new BadRequestError('ID ใบลาไม่ถูกต้อง');
  }

  const leaveRequest = await LeaveRequestUserActions.getLeaveRequestById(leaveId);

  if (!leaveRequest) {
    throw new NotFoundError('ไม่พบใบลา');
  }

  sendSuccess(res, leaveRequest);
});

/**
 * PATCH /api/leave-requests/:id
 * แก้ไขใบลา
 */
export const updateLeaveRequest = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const { id } = req.params;
  const leaveId = parseInt(id as string);

  if (!userId) {
    throw new UnauthorizedError('ไม่พบข้อมูลผู้ใช้');
  }

  if (!leaveId) {
    throw new BadRequestError('ID ใบลาไม่ถูกต้อง');
  }

  const leaveRequest = await LeaveRequestUserActions.getLeaveRequestById(leaveId);

  if (!leaveRequest) {
    throw new NotFoundError('ไม่พบใบลา');
  }

  // ตรวจสอบว่าเป็นเจ้าของหรือ Admin
  if (leaveRequest.userId !== userId && req.user?.role !== 'ADMIN' && req.user?.role !== 'SUPERADMIN') {
    throw new ForbiddenError('คุณไม่มีสิทธิ์แก้ไขใบลานี้');
  }

  const { leaveType, startDate, endDate, reason, attachmentUrl } = req.body;

  const updatedLeaveRequest = await LeaveRequestUserActions.updateLeaveRequest(leaveId, {
    ...(leaveType && { leaveType }),
    ...(startDate && { startDate: new Date(startDate) }),
    ...(endDate && { endDate: new Date(endDate) }),
    ...(reason && { reason }),
    ...(attachmentUrl && { attachmentUrl }),
  });

  sendSuccess(res, updatedLeaveRequest, 'แก้ไขใบลาเรียบร้อยแล้ว');
});

/**
 * POST /api/leave-requests/:id/approve
 * อนุมัติใบลา (Admin only)
 */
export const approveLeaveRequest = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const { id } = req.params;
  const leaveId = parseInt(id as string);
  const { adminComment } = req.body;

  if (!userId) {
    throw new UnauthorizedError('ไม่พบข้อมูลผู้ใช้');
  }

  if (!leaveId) {
    throw new BadRequestError('ID ใบลาไม่ถูกต้อง');
  }

  const leaveRequest = await LeaveRequestUserActions.getLeaveRequestById(leaveId);

  if (!leaveRequest) {
    throw new NotFoundError('ไม่พบใบลา');
  }

  const approvedLeaveRequest = await LeaveRequestAdminActions.approveLeaveRequest(leaveId, {
    approvedByUserId: userId,
    adminComment,
  });

  sendSuccess(res, approvedLeaveRequest, 'อนุมัติใบลาเรียบร้อยแล้ว');
});

/**
 * POST /api/leave-requests/:id/reject
 * ปฏิเสธใบลา (Admin only)
 */
export const rejectLeaveRequest = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const { id } = req.params;
  const leaveId = parseInt(id as string);
  const { rejectionReason } = req.body;

  if (!userId) {
    throw new UnauthorizedError('ไม่พบข้อมูลผู้ใช้');
  }

  if (!leaveId) {
    throw new BadRequestError('ID ใบลาไม่ถูกต้อง');
  }

  if (!rejectionReason) {
    throw new BadRequestError('กรุณาระบุเหตุผลการปฏิเสธ');
  }

  const leaveRequest = await LeaveRequestUserActions.getLeaveRequestById(leaveId);

  if (!leaveRequest) {
    throw new NotFoundError('ไม่พบใบลา');
  }

  const rejectedLeaveRequest = await LeaveRequestAdminActions.rejectLeaveRequest(leaveId, {
    approvedByUserId: userId,
    rejectionReason,
  });

  sendSuccess(res, rejectedLeaveRequest, 'ปฏิเสธใบลาเรียบร้อยแล้ว');
});

/**
 * DELETE /api/leave-requests/:id
 * ลบใบลา (เฉพาะ PENDING)
 */
export const deleteLeaveRequest = asyncHandler(async (req: Request, res: Response) => {
  const userId = req.user?.userId;
  const { id } = req.params;
  const leaveId = parseInt(id as string);

  if (!userId) {
    throw new UnauthorizedError('ไม่พบข้อมูลผู้ใช้');
  }

  if (!leaveId) {
    throw new BadRequestError('ID ใบลาไม่ถูกต้อง');
  }

  const leaveRequest = await LeaveRequestUserActions.getLeaveRequestById(leaveId);

  if (!leaveRequest) {
    throw new NotFoundError('ไม่พบใบลา');
  }

  // ตรวจสอบว่าเป็นเจ้าของหรือ Admin
  if (leaveRequest.userId !== userId && req.user?.role !== 'ADMIN' && req.user?.role !== 'SUPERADMIN') {
    throw new ForbiddenError('คุณไม่มีสิทธิ์ลบใบลานี้');
  }

  await LeaveRequestUserActions.deleteLeaveRequest(leaveId);

  sendSuccess(res, null, 'ลบใบลาเรียบร้อยแล้ว');
});
