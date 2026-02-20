import ExcelJS from 'exceljs';

/**
 * 📊 ExcelGenerator - สร้างไฟล์ Excel จากข้อมูล
 * 
 * ทำไมต้องมีฟังก์ชันนี้?
 * - ไฟล์ Excel เป็นรูปแบบที่ใช้กันอย่างแพร่หลายในสำนักงาน (เปิดง่าย, ดึง common)
 * - ต้องมีการจัดรูปแบบให้สวยงาม (header, border, frozen row)
 * - ต้องสามารถ style ข้อมูลให้อ่านง่าย
 */

export interface ExcelOptions {
  fileName?: string;
  sheetName: string;
  columns: unknown[];
  data: Record<string, unknown>[];
  title?: string;
  autoFilter?: boolean;
  freezePane?: boolean;
}

/**
 * สร้างไฟล์ Excel จากข้อมูล
 * 
 * ทำไมแยก function นี้?
 * - Component หลาย ๆ ตัว (Download, Report) ต้องสร้าง Excel
 * - เพื่อไม่ให้ repeat code การจัด format
 * - ให้มี unified style ในทั่ว application
 */
export async function generateExcel(options: ExcelOptions): Promise<Buffer> {
  const {
    sheetName,
    columns,
    data,
    title,
    freezePane = true,
  } = options;

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  // ตั้งค่า columns (width, header)
  worksheet.columns = columns;

  // เพิ่มชื่อเรื่องด้านบน (เพื่อทำให้เห็นว่ารายงานนี้คืออะไร)
  if (title) {
    worksheet.insertRows(1, [
      [title], // merged cell สินค้าด้านบน
    ]);
    worksheet.mergeCells('A1:' + String.fromCharCode(64 + columns.length) + '1');
    const titleCell = worksheet.getCell('A1');
    titleCell.font = {
      bold: true,
      size: 14,
    };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    /**
     * ใส่ข้อมูลเริ่มจากแถว 3 (row 1 = title, row 2 = header)
     * 
     * ทำไมต้องเริ่มจาก row 3?
     * - ให้มีพื้นที่สำหรับชื่อรายงาน (row 1)
     * - ให้ header row (row 2) อยู่ติดกับข้อมูล เวลา freeze ทั้งหมดเห็น
     */
    data.forEach((row, index) => {
      worksheet.insertRow(index + 3, Object.values(row));
    });

    /**
     * Freeze 2 แถวแรก (title + header)
     * 
     * เหตุผล:
     * - ให้เห็นชื่อรายงาน + column header เวลาเลื่อนลง
     * - เอกสารที่มีสิ่งนี้อ่านง่ายกว่า ไม่สับสน column ไหน
     */
    if (freezePane) {
      worksheet.views = [{ state: 'frozen', ySplit: 2 }];
    }
  } else {
    /**
     * ใส่ข้อมูลปกติ (row 1 = header)
     * 
     * SQL ที่เกี่ยวข้อง:
     * INSERT INTO worksheet (columns...) VALUES (...);
     * SELECT * FROM data;
     */
    worksheet.addRows(data);

    /**
     * Freeze header row เพื่อให้มองเห็นได้เวลาเลื่อน
     * 
     * เหตุผล:
     * - ทำให้ผู้อ่าน Excel รู้ว่า column ไหนคืออะไร
     * - ลดความสับสนเวลาดูข้อมูลจำนวนมาก
     */
    if (freezePane) {
      worksheet.views = [{ state: 'frozen', ySplit: 1 }];
    }
  }

  /**
   * Auto width columns ให้เหมาะสม (แม้ว่าปิด autoFilter ไว้)
   * 
   * ทำไม?
   * - ไม่ให้ข้อความโดนตัด (default width ของ Excel ไม่เพียงพอ)
   * - คำนวณจากข้อมูลจริง เพื่อให้สวยและอ่านง่าย
   * - เซฟ max 50 character เพื่อไม่ให้แคบเกินไป
   * 
   * SQL (Pseudo-code):
   * FOR EACH column:
   *   maxLength = MAX(length(cell) for cell in column)
   *   column.width = MIN(maxLength + 2, 50)
   */
  worksheet.columns.forEach((column) => {
    let maxLength = 0;
    column.eachCell?.({ includeEmpty: true }, (cell) => {
      const cellLength = cell.value?.toString().length ?? 0;
      if (cellLength > maxLength) {
        maxLength = cellLength;
      }
    });
    column.width = Math.min(maxLength + 2, 50);
  });

  /**
   * แปลง Workbook เป็น Buffer
   * 
   * ทำไม?
   * - HTTP Response ต้อง Buffer เพื่อส่งไฟล์ไปยัง client
   * - ExcelJS.writeBuffer() return Promise<Buffer>
   * - Cast ให้เป็นประเภท Buffer ที่ TypeScript เข้าใจ
   */
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as unknown as Buffer;
}
