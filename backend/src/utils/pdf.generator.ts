import PDFDocument from 'pdfkit';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FONTS_DIR = path.join(__dirname, '../assets/fonts');
const THAI_FONT_REGULAR = path.join(FONTS_DIR, 'NotoSansThai-Regular.ttf');
const THAI_FONT_BOLD = path.join(FONTS_DIR, 'NotoSansThai-Bold.ttf');

function hasThaiFonts(): boolean {
  return fs.existsSync(THAI_FONT_REGULAR) && fs.existsSync(THAI_FONT_BOLD);
}

function registerFonts(doc: InstanceType<typeof PDFDocument>): { regular: string; bold: string } {
  if (hasThaiFonts()) {
    doc.registerFont('ThaiFont-Regular', THAI_FONT_REGULAR);
    doc.registerFont('ThaiFont-Bold', THAI_FONT_BOLD);
    return { regular: 'ThaiFont-Regular', bold: 'ThaiFont-Bold' };
  }
  return { regular: 'Helvetica', bold: 'Helvetica-Bold' };
}

/**
 * 📄 PDFGenerator - สร้างไฟล์ PDF จากข้อมูล
 * 
 * ทำไมต้องมีฟังก์ชันนี้?
 * - ไฟล์ PDF ใช้สำหรับพิมพ์และเก็บเป็นลายประมาณ (archive format)
 * - Excel ดีสำหรับวิเคราะห์, PDF ดีสำหรับไปพิมพ์ออกเอกสารทำงาน
 * - ต้อง centralize logic สำหรับ styling/formatting PDF
 */

export interface PDFOptions {
  title: string;
  fileName?: string;
  columns: string[];
  data: Record<string, unknown>[];
  pageSize?: 'A4' | 'A3' | 'LETTER';
  landscape?: boolean;
}

/**
 * สร้างไฟล์ PDF จากข้อมูล
 * 
 * ทำไมแยก function นี้?
 * - Component หลาย ตัว (Download, Report) ต้องสร้าง PDF
 * - ต้อง handle streaming + error handling ที่ซับซ้อน
 * - ให้มี consistent style (font, margin, layout) ทั่ว application
 */
export function generatePDF(options: PDFOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const { title, columns, data, pageSize = 'A4' } = options;
      const landscape = options.landscape !== false;

      const doc = new PDFDocument({
        size: pageSize,
        layout: landscape ? 'landscape' : 'portrait',
        margin: 30,
      });

      const fonts = registerFonts(doc);

      const chunks: Buffer[] = [];
      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // ── Column widths (fixed for 8-column attendance, A4 landscape ~782px usable) ──
      // colWidths[i] maps to columns[i] in order
      const DEFAULT_COL_W = Math.floor((doc.page.width - 60) / columns.length);
      const COL_W_MAP: Record<string, number> = {
        'รหัสพนักงาน':           60,
        'ชื่อ-นามสกุล':           120,
        'เวลาเข้างาน':             95,
        'เวลาออกงาน':             95,
        'สาย (นาที/ชั่วโมง)':     85,
        'สถานะ':                  65,
        'ประเภท':                 90,
        'หมายเหตุ':               172,
      };
      const colWidths = columns.map(c => COL_W_MAP[c] ?? DEFAULT_COL_W);
      const TABLE_W = colWidths.reduce((a, b) => a + b, 0);
      const LEFT = 30;
      const PAGE_BOTTOM = doc.page.height - 40;

      // ── Title ──────────────────────────────────────────────────────────────
      doc.fontSize(14).font(fonts.bold).fillColor('#1f2937')
        .text(title, LEFT, 30, { width: TABLE_W, align: 'center' });
      doc.fontSize(8).font(fonts.regular).fillColor('#6b7280')
        .text(`สร้างเมื่อ ${new Date().toLocaleString('th-TH')}`, LEFT, 48, {
          width: TABLE_W, align: 'center',
        });

      let y = 66;

      // ── Draw header ────────────────────────────────────────────────────────
      const drawHeader = () => {
        // Orange background
        doc.save().rect(LEFT, y, TABLE_W, 22).fill('#f97316').restore();

        doc.fontSize(9).font(fonts.bold).fillColor('#ffffff');
        let startX = LEFT;
        columns.forEach((col, i) => {
          doc.text(col, startX + 3, y + 5, { width: colWidths[i] - 6, lineBreak: false });
          startX += colWidths[i];
        });

        // Underline
        doc.save().strokeColor('#ea580c').lineWidth(1.5)
          .moveTo(LEFT, y + 22).lineTo(LEFT + TABLE_W, y + 22).stroke().restore();

        y += 22;
      };

      drawHeader();

      // ── Data rows ──────────────────────────────────────────────────────────
      data.forEach((row, idx) => {
        // Measure tallest cell in this row
        doc.fontSize(9).font(fonts.regular);
        let maxH = 0;
        columns.forEach((col, i) => {
          const text = String(row[col] ?? '');
          const h = doc.heightOfString(text, { width: colWidths[i] - 6 });
          if (h > maxH) maxH = h;
        });
        const rowH = Math.max(maxH + 8, 18);

        // Page overflow → new page + repeat header
        if (y + rowH > PAGE_BOTTOM) {
          doc.addPage();
          y = 30;
          drawHeader();
        }

        // Zebra stripe (odd rows)
        if (idx % 2 === 1) {
          doc.save().rect(LEFT, y, TABLE_W, rowH).fill('#fff7ed').restore();
        }

        // Draw all cells in this row at the SAME y position
        doc.fontSize(9).font(fonts.regular).fillColor('#374151');
        let startX = LEFT;
        columns.forEach((col, i) => {
          const text = String(row[col] ?? '');
          doc.text(text, startX + 3, y + 4, { width: colWidths[i] - 6, lineBreak: false });
          startX += colWidths[i];
        });

        // Row bottom border
        doc.save().strokeColor('#e5e7eb').lineWidth(0.4)
          .moveTo(LEFT, y + rowH).lineTo(LEFT + TABLE_W, y + rowH).stroke().restore();

        y += rowH;
      });

      // ── Footer ─────────────────────────────────────────────────────────────
      doc.fontSize(7).font(fonts.regular).fillColor('#9ca3af')
        .text(`ทั้งหมด ${data.length} รายการ`, LEFT, y + 5, {
          width: TABLE_W, align: 'right',
        });

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
