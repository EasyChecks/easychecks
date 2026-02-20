import type { Request, Response } from 'express';
import {
  downloadReport,
} from '../services/download.service.js';

/**
 * 📥 DownloadController - จัดการ HTTP Request/Response สำหรับ Download API
 * 
 * ทำไมต้องแยก Controller?
 * - Controller เป็นชั้นรับ request จาก HTTP, validate input, return response
 * - Service handle business logic (query database, generate file)
 * - แยกกัน ทำให้ code reusable, testable, readable
 */

/**
 * GET /api/download/report - ดาวน์โหลดรายงาน (Attendance หรือ Shift)
 * 
 * ทำไมต้องแยก function นี้?
 * - API endpoint ต้องแยกแต่ละ route
 * - Validate query parameters: type, format, dateRange
 * - ส่งไฟล์กลับเป็น attachment (Content-Disposition)
 * 
 * Permission:
 * - ต้อง authenticate (check req.user)
 * - ADMIN: ตัวเองและ subordinates
 * - SUPERADMIN: ทุกคนทั้งโปรแกรม
 */
export async function handleDownloadReport(req: Request, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
      return;
    }

    const { type, format, startDate, endDate, branchId } = req.query;
    console.log('📥 Download request:', { type, format, startDate, endDate, branchId });

    /**
     * Validate required parameters
     * 
     * เหตุผล:
     * - ต้องมี type + format เพื่อรู้ว่า generate file type ไหน
     * - ถ้า missing → return 400 (Bad Request)
     */
    if (!type || !format) {
      res.status(400).json({
        success: false,
        error: 'Missing required parameters: type, format',
      });
      return;
    }

    /**
     * Validate type parameter
     * 
     * Support type:
     * - attendance: attendance records
     * - shift: shift records
     */
    if (!['attendance', 'shift'].includes(type as string)) {
      res.status(400).json({
        success: false,
        error: 'Invalid type. Must be "attendance" or "shift"',
      });
      return;
    }

    /**
     * Validate format parameter
     * 
     * Support format:
     * - excel: XLSX spreadsheet (วิเคราะห์ได้ง่าย)
     * - pdf: PDF document (พิมพ์เป็นเอกสารลายประมาณ)
     */
    if (!['excel', 'pdf'].includes(format as string)) {
      res.status(400).json({
        success: false,
        error: 'Invalid format. Must be "excel" or "pdf"',
      });
      return;
    }

    console.log('⏳ Generating report...');
    
    /**
     * สร้าง query object สำหรับ service
     * 
     * SQL (Pseudo-code):
     * SELECT * FROM attendance/shift
     * WHERE (startDate IS NULL OR createdDate >= startDate)
     *   AND (endDate IS NULL OR createdDate <= endDate)
     *   AND (branchId IS NULL OR branchId = ?)
     */
    const downloadQuery = {
      type: type as 'attendance' | 'shift',
      format: format as 'excel' | 'pdf',
      ...(startDate && { startDate: new Date(startDate as string) }),
      ...(endDate && { endDate: new Date(endDate as string) }),
      ...(branchId && { branchId: parseInt(branchId as string) }),
    };

    /**
     * เรียก service เพื่อสร้างไฟล์
     * 
     * Return value:
     * - buffer: ข้อมูล file (bytes)
     * - fileName: ชื่อไฟล์ให้ user save as
     * - mimeType: Content-Type header (application/vnd.ms-excel, application/pdf)
     */
    const { buffer, fileName, mimeType } = await downloadReport(user, downloadQuery);

    console.log('✅ Report generated:', fileName);
    
    /**
     * ส่ง HTTP Response พร้อมไฟล์
     * 
     * Header ที่ส่ง:
     * - Content-Type: MIME type (เบราวเซอร์รู้ว่า file type ไหน)
     * - Content-Disposition: attachment (บังคับให้ download แทน preview)
     */
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.send(buffer);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    console.error('❌ Error:', message);
    
    res.status(500).json({
      success: false,
      error: message,
    });
  }
}

/**
 * GET /api/download/history - ดูประวัติการดาวน์โหลด
 * 
 * ทำไมต้องมี endpoint นี้?
 * - Audit trail: รู้ว่าใครดาวน์โหลดรายงานไหน เมื่อไร
 * - Security: เช็คว่ามี unauthorized download หรือไม่
 * - Compliance: ต้องบันทึก data access สำหรับ regulation
 * 
 * Role-based filtering:
 * - ADMIN: เห็นเฉพาะตัวเอง
 * - SUPERADMIN: เห็นทั้งหมด
 */
export async function handleDownloadHistory(req: Request, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({
        success: false,
        error: 'Unauthorized',
      });
      return;
    }

    const { limit = 10, offset = 0 } = req.query;

    /**
     * Query download history จาก database
     * 
     * SQL ที่ใช้:
     * SELECT dl.*, u.employeeId, u.firstName, u.lastName
     * FROM downloadLog dl
     * JOIN user u ON dl.userId = u.userId
     * WHERE (user.role = 'SUPERADMIN' OR dl.userId = ?)
     * ORDER BY dl.downloadAt DESC
     * LIMIT ? OFFSET ?;
     * 
     * Pagination:
     * - limit: จำนวน record ต่อหน้า (default 10)
     * - offset: ข้ามกี่ record (สำหรับหน้า 2+ ใช้ offset: page*limit)
     */
    const downloadLogs = await (
      await import('../lib/prisma.js')
    ).prisma.downloadLog.findMany({
      where: user.role === 'SUPERADMIN' ? {} : { userId: user.userId },
      include: {
        user: {
          select: {
            employeeId: true,
            firstName: true,
            lastName: true,
          },
        },
      },
      orderBy: { downloadAt: 'desc' },
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });

    /**
     * ส่ง response พร้อม pagination info
     * 
     * ทำไมต้อง pagination?
     * - ถ้า history เก่า 10000 record → ส่งทั้งหมด = slow
     * - ส่งทีละ 10-50 record → ตอบเร็ว, user experience ดี
     */
    res.status(200).json({
      success: true,
      data: downloadLogs,
      pagination: {
        limit: parseInt(limit as string),
        offset: parseInt(offset as string),
        total: downloadLogs.length,
      },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    
    res.status(500).json({
      success: false,
      error: message,
    });
  }
}
