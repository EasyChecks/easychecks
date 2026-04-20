import type { Request, Response } from 'express';
import {
  downloadReport,
  previewReport,
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

    const { type, format, startDate, endDate, branchId, filterType } = req.query;
    console.log('📥 Download request:', { type, format, startDate, endDate, branchId, filterType });

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
    if (type !== 'attendance') {
      res.status(400).json({
        success: false,
        error: 'Invalid type. Must be "attendance"',
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
      type: type as 'attendance',
      format: format as 'excel' | 'pdf',
      ...(startDate && { startDate: new Date(startDate as string) }),
      ...(endDate && (() => {
        const d = new Date(endDate as string);
        d.setHours(23, 59, 59, 999);
        return { endDate: d };
      })()),
      ...(branchId && { branchId: parseInt(branchId as string) }),
      ...(filterType && ['all', 'shift', 'event'].includes(filterType as string) && {
        filterType: filterType as 'all' | 'shift' | 'event',
      }),
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
 * GET /api/download/preview - ดึงข้อมูลตัวอย่างก่อนดาวน์โหลด (ส่งกลับ JSON)
 */
export async function handlePreviewReport(req: Request, res: Response): Promise<void> {
  try {
    const user = req.user;
    if (!user) {
      res.status(401).json({ success: false, error: 'Unauthorized' });
      return;
    }

    const { type, startDate, endDate, branchId, filterType } = req.query;

    if (!type || type !== 'attendance') {
      res.status(400).json({ success: false, error: 'Invalid type. Must be "attendance"' });
      return;
    }

    const result = await previewReport(user, {
      type: type as 'attendance',
      ...(startDate && { startDate: new Date(startDate as string) }),
      ...(endDate && (() => {
        const d = new Date(endDate as string);
        d.setHours(23, 59, 59, 999);
        return { endDate: d };
      })()),
      ...(branchId && { branchId: parseInt(branchId as string) }),
      ...(filterType && ['all', 'shift', 'event'].includes(filterType as string) && {
        filterType: filterType as 'all' | 'shift' | 'event',
      }),
    });

    res.json({ success: true, data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    res.status(500).json({ success: false, error: message });
  }
}

