import type { Request, Response } from 'express';
import {
  downloadReport,
} from '../services/download.service.js';

/**
 * 📥 Download Controller
 * จัดการ HTTP requests
 */

/**
 * GET /api/download/report
 * ดาวน์โหลดรายงาน
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

    // Validate input
    if (!type || !format) {
      res.status(400).json({
        success: false,
        error: 'Missing required parameters: type, format',
      });
      return;
    }

    if (!['attendance', 'shift'].includes(type as string)) {
      res.status(400).json({
        success: false,
        error: 'Invalid type. Must be "attendance" or "shift"',
      });
      return;
    }

    if (!['excel', 'pdf'].includes(format as string)) {
      res.status(400).json({
        success: false,
        error: 'Invalid format. Must be "excel" or "pdf"',
      });
      return;
    }

    console.log('⏳ Generating report...');
    // ดาวน์โหลด
    const downloadQuery: any = {
      type: type as 'attendance' | 'shift',
      format: format as 'excel' | 'pdf',
    };
    if (startDate) downloadQuery.startDate = new Date(startDate as string);
    if (endDate) downloadQuery.endDate = new Date(endDate as string);
    if (branchId) downloadQuery.branchId = parseInt(branchId as string);

    const { buffer, fileName, mimeType } = await downloadReport(user, downloadQuery);

    console.log('✅ Report generated:', fileName);
    // ส่งไฟล์
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
 * GET /api/download/history
 * ดูประวัติการดาวน์โหลด
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

    // Query history
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
