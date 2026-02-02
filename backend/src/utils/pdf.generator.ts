import PDFDocument from 'pdfkit';

/**
 * 📄 PDF Generator Utility
 * สำหรับสร้างไฟล์ PDF
 */

export interface PDFOptions {
  title: string;
  fileName: string;
  columns: string[];
  data: any[];
  pageSize?: 'A4' | 'A3' | 'LETTER';
  landscape?: boolean;
}

/**
 * สร้างไฟล์ PDF จากข้อมูล
 */
export function generatePDF(options: PDFOptions): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const {
        title,
        columns,
        data,
        pageSize = 'A4',
        landscape = true,
      } = options;

      const doc = new PDFDocument({
        size: pageSize,
        margin: 20,
      } as any);

      const chunks: Buffer[] = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => {
        resolve(Buffer.concat(chunks));
      });
      doc.on('error', reject);

      // เพิ่มชื่อเรื่อง
      doc.fontSize(16).font('Helvetica-Bold').text(title, { align: 'center' });
      doc.moveDown(0.5);

      // สร้างตาราง
      const columnWidths = columns.map(() => 
        (doc.page.width - 40) / columns.length
      );

      // Header row
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

      // Data rows
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

      // Footer
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
