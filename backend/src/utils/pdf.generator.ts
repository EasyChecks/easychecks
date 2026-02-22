import PDFDocument from 'pdfkit';

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
      const {
        title,
        columns,
        data,
        pageSize = 'A4',
      } = options;

      /**
       * สร้าง PDFDocument instance
       * 
       * ทำไมใช้ margin = 20?
       * - ให้มีพื้นที่เว้นขอบ (ปลายน้อยเวลาพิมพ์)
       * - ทำให้ PDF อ่านง่าย เอกสารดูสุดมืออาชีพ
       */
      const doc = new PDFDocument({
        size: pageSize,
        margin: 20,
      } as PDFKit.PDFDocumentOptions);

      /**
       * Collect chunks เพื่อ concatenate เป็น single Buffer
       * 
       * เหตุผล:
       * - PDFKit emit data events ทีละ chunk
       * - ต้องรวมเข้าด้วยกันเป็น complete PDF buffer
       * - Resolve promise เมื่อเขียน complete PDFDocument
       */
      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
      doc.on('error', reject);

      /**
       * เพิ่มชื่อเรื่องด้านบน
       * 
       * ทำไม?
       * - ให้ผู้อ่านรู้เลยว่ารายงานนี้คืออะไร (title page)
       * - ใช้ Bold + Font size 16 เพื่อให้เด่น
       */
      doc.fontSize(16).font('Helvetica-Bold').text(title, { align: 'center' });
      doc.moveDown(0.5);

      /**
       * คำนวณ column width ให้เท่ากัน
       * 
       * SQL (Pseudo-code):
       * total_width = page_width - margins
       * column_width = total_width / number_of_columns
       * 
       * เหตุผล:
       * - ใช้ width ตรง ๆ เวลา render text
       * - ข้อมูลขนาดใหญ่ต้อง truncate (ellipsis) เพื่อไม่ให้ overflow
       */
      const columnWidths = columns.map(() => 
        (doc.page.width - 40) / columns.length
      );

      /**
       * Header row - Column names
       * 
       * ทำไม?
       * - ให้ผู้อ่าน Excel รู้คอลัมน์ไหนคืออะไร
       * - ใช้ Bold font เพื่อให้เห็นความแตกต่าง
       */
      doc.fontSize(10).font('Helvetica-Bold').fillColor('black');
      let x = 20;
      columns.forEach((col, i) => {
        const width = columnWidths[i] ?? 0;
        doc.text(col, x, doc.y, {
          width: width,
          align: 'left',
          ellipsis: true,
        });
        x += width;
      });
      doc.moveDown();

      /**
       * Data rows - Loop through all data
       * 
       * เหตุผล:
       * - Render แต่ละ row จากข้อมูล
       * - ใช้ column widths มาก่อนเพื่อให้ align กระทั่งกับ header
       * - ellipsis ข้อมูล long string เพื่อไม่ให้ overflow
       */
      doc.font('Helvetica').fontSize(9);
      data.forEach((row) => {
        x = 20;
        columns.forEach((col, i) => {
          const width = columnWidths[i] ?? 0;
          const value = row[col]?.toString() ?? '';
          doc.text(value, x, doc.y, {
            width: width,
            align: 'left',
            ellipsis: true,
          });
          x += width;
        });
        doc.moveDown();
      });

      /**
       * Footer - Generated timestamp
       * 
       * ทำไม?
       * - ให้รู้ว่ารายงานสร้างเมื่อไร (audit trail)
       * - ประโยชน์ถ้ามีการเปรียบเทียบ report เวลาต่างกัน
       */
      doc.fontSize(8).text(
        `Generated on ${new Date().toLocaleString()}`,
        { align: 'center' }
      );

      doc.end();
    } catch (error) {
      reject(error);
    }
  });
}
