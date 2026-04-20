/**
 * downloadService.ts
 * ─────────────────────────────────────────
 * ทำไมต้องมี service layer แยก?
 * - downloadReport ได้ blob binary กลับมา ต้องจัดการสร้าง <a> tag + trigger click
 * - logic นี้ซับซ้อนเกินกว่าแค่เรียก api.get → แยกออกจาก component
 * - ใช้ร่วมกันทั้ง Admin และ SuperAdmin download-data page
 *
 * Base URL: /api/download
 * สิทธิ์: ADMIN / SUPERADMIN เท่านั้น (middleware ฝั่ง backend ตรวจ role)
 */

import api from './api';

// ทำไม ReportType มีแค่ 'attendance'?
// - backend รองรับแค่ type=attendance เท่านั้น (ไม่มี type=shift แล้ว)
// - กรองข้อมูลกะงานแยกโดยใช้ filterType แทน (all/shift/event)
export type ReportType = 'attendance';
export type ReportFormat = 'excel' | 'pdf';
// filterType ใช้แยกว่าจะดึงเฉพาะข้อมูลกะงานปกติ (กิจกรรม หรือทั้งหมด)
export type FilterType = 'all' | 'shift' | 'event';

export interface DownloadReportParams {
  type: ReportType;
  format: ReportFormat;
  startDate?: string;
  endDate?: string;
  branchId?: number;
  filterType?: FilterType;
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

export interface PreviewResult {
  columns: string[];
  rows: Record<string, unknown>[];
  total: number;
}

// ทำไมต้องมี PreviewParams แยก?
// - Preview ใช้ params เดียวกับ download แต่ไม่ต้อง format (excel/pdf)
// - Omit<> ตัด format ออกเพื่อไม่ต้อง duplicate type
export type PreviewParams = Omit<DownloadReportParams, 'format'>;

// ── Service Methods ──
// แยกเป็น 3 กลุ่ม:
// 1) downloadReport: ดาวน์โหลด binary file (Excel/PDF)
// 2) getHistory: ดึงประวัติการดาวน์โหลด (audit trail)
// 3) previewReport: ดึงข้อมูลตัวอย่าง JSON ก่อนโหลดจริง

export const downloadService = {
  /**
   * GET /api/download/report
   * ทำไมต้องใช้ responseType: 'blob'?
   * - backend ส่งกลับมาเป็น binary file (Excel/PDF) ไม่ใช่ JSON
   * - axios default แปลงเป็น JSON → binary พัง → ต้องบอกว่าเอา blob
   *
   * ทำไมต้องตรวจ res.data.type === 'application/json'?
   * - backend อาจส่ง JSON error กลับมาแทน file (e.g. ไม่มีข้อมูล)
   * - blob ไม่มี status code แยก → ต้องเช็ค content-type เอง
   *
   * SQL เบื้องหลัง (backend):
   * SELECT a.*, u.employee_id, u.first_name, u.last_name
   * FROM attendance a JOIN users u ON a.user_id = u.user_id
   * WHERE a.check_in BETWEEN ? AND ? AND u.branch_id = ?;
   */
  async downloadReport(params: DownloadReportParams): Promise<void> {
    const res = await api.get('/download/report', {
      params,
      responseType: 'blob',
    });

    // ถ้า backend ส่ง JSON error กลับมาแทนไฟล์ ให้โยน error ออกไป
    if (res.data.type === 'application/json') {
      const text = await (res.data as Blob).text();
      const json = JSON.parse(text) as { error?: string };
      throw new Error(json.error || 'เกิดข้อผิดพลาดในการสร้างไฟล์');
    }

    // อ่านชื่อไฟล์จาก Content-Disposition header
    const disposition = res.headers['content-disposition'] || '';
    const match = disposition.match(/filename="?([^";\n]+)"?/);
    const ext = params.format === 'pdf' ? 'pdf' : 'xlsx';
    const filename = match?.[1] || `${params.type}_report.${ext}`;

    // ทำไมต้องสร้าง <a> tag แล้ว click เอง?
    // - browser ไม่มี API สำหรับ save file ตรงๆ → ใช้ trick สร้าง invisible link
    // - URL.createObjectURL สร้าง temporary URL จาก blob data in memory
    // - ต้อง revokeObjectURL หลังใช้ ไม่งั้น memory รั่ว (leak)
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

  /**
   * GET /api/download/preview
   * ทำไมต้อง preview ก่อน download?
   * - ให้ admin ตรวจข้อมูลก่อน (max 20 rows) ช่วยลด download ผิด
   * - ได้ JSON กลับมา (columns + rows) ไม่ใช่ binary file
   */
  async previewReport(params: PreviewParams): Promise<PreviewResult> {
    const res = await api.get('/download/preview', { params });
    return res.data.data as PreviewResult;
  },
};

export default downloadService;
