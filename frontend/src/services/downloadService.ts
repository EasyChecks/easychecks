/**
 * downloadService.ts
 * ─────────────────────────────────────────
 * HTTP client สำหรับ Download API
 * Base URL: /api/download
 * สิทธิ์: ADMIN / SUPERADMIN เท่านั้น
 */

import api from './api';

export type ReportType = 'attendance' | 'shift';
export type ReportFormat = 'excel';

export interface DownloadReportParams {
  type: ReportType;
  format: ReportFormat;
  startDate?: string;
  endDate?: string;
  branchId?: number;
}

export interface DownloadHistoryItem {
  downloadLogId: number;
  userId: number;
  fileName: string;
  reportType: string;
  downloadAt: string;
  user: {
    employeeId: string;
    firstName: string;
    lastName: string;
  };
}

export interface DownloadHistoryParams {
  limit?: number;
  offset?: number;
}

export interface DownloadHistoryResponse {
  data: DownloadHistoryItem[];
  pagination: {
    limit: number;
    offset: number;
    total: number;
  };
}

// ── Service Methods ──

export const downloadService = {
  /**
   * GET /api/download/report
   * ดาวน์โหลด report เป็น Excel/PDF แล้วเปิด dialog ให้ผู้ใช้ save
   */
  async downloadReport(params: DownloadReportParams): Promise<void> {
    const res = await api.get('/download/report', {
      params,
      responseType: 'blob',
    });

    // อ่านชื่อไฟล์จาก Content-Disposition header
    const disposition = res.headers['content-disposition'] || '';
    const match = disposition.match(/filename="?([^";\n]+)"?/);
    const ext = 'xlsx';
    const filename = match?.[1] || `${params.type}_report.${ext}`;

    // สร้าง blob URL และ trigger download
    const blob = new Blob([res.data], { type: res.headers['content-type'] });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  },

  /**
   * GET /api/download/history
   * ดูประวัติการดาวน์โหลด (Audit trail)
   */
  async getHistory(params?: DownloadHistoryParams): Promise<DownloadHistoryResponse> {
    const res = await api.get('/download/history', { params });
    return { data: res.data.data, pagination: res.data.pagination };
  },
};

export default downloadService;
