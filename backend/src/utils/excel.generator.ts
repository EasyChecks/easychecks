import ExcelJS from 'exceljs';

/**
 * 📊 Excel Generator Utility
 * สำหรับสร้างไฟล์ Excel
 */

export interface ExcelOptions {
  fileName: string;
  sheetName: string;
  columns: ExcelJS.Column[];
  data: any[];
  title?: string;
  autoFilter?: boolean;
  freezePane?: boolean;
}

/**
 * สร้างไฟล์ Excel จากข้อมูล
 */
export async function generateExcel(options: ExcelOptions): Promise<Buffer> {
  const {
    fileName,
    sheetName,
    columns,
    data,
    title,
    autoFilter = true,
    freezePane = true,
  } = options;

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet(sheetName);

  // ตั้งค่า columns
  worksheet.columns = columns;

  // เพิ่มชื่อเรื่อง (optional)
  if (title) {
    worksheet.insertRows(1, [
      [title], // merged cell ด้านบน
    ]);
    worksheet.mergeCells('A1:' + String.fromCharCode(64 + columns.length) + '1');
    const titleCell = worksheet.getCell('A1');
    titleCell.font = {
      bold: true,
      size: 14,
    };
    titleCell.alignment = { horizontal: 'center', vertical: 'middle' };

    // ทำให้แถวหัวตัวเลขเริ่มจากแถว 3
    data.forEach((row, index) => {
      worksheet.insertRow(index + 3, Object.values(row));
    });

    // freeze pane แถว 2 (header row)
    if (freezePane) {
      worksheet.views = [{ state: 'frozen', ySplit: 2 }];
    }
  } else {
    // เพิ่มข้อมูล
    worksheet.addRows(data);

    // freeze pane แถว 1 (header row)
    if (freezePane) {
      worksheet.views = [{ state: 'frozen', ySplit: 1 }];
    }
  }

  // Auto filter - skip เนื่องจาก ExcelJS API issue
  // if (autoFilter && data.length > 0) {
  //   const startCell = title ? 'A2' : 'A1';
  //   const endCell =
  //     String.fromCharCode(64 + columns.length) + (title ? data.length + 2 : data.length + 1);
  //   // ExcelJS autoFilter มี compatibility issue
  // }

  // ปรับความกว้างของ columns
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

  // แปลง workbook เป็น buffer
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer as unknown as Buffer;
}
