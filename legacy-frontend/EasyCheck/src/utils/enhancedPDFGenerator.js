/**
 * Enhanced PDF Generator - สร้าง PDF จากข้อมูลจริง
 * รองรับภาษาไทย, SVG icons, และข้อมูลที่ซับซ้อน
 */

import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * สร้าง HTML table สำหรับ PDF
 */
const createHTMLTable = (data, metadata) => {
  if (!data || data.length === 0) {
    return '<p>ไม่พบข้อมูล</p>';
  }

  const headers = Object.keys(data[0]);

  // ไม่ใช้ SVG - เป็น text ธรรมดา
  const formatValue = (key, value) => {
    // แสดง text ธรรมดาโดยไม่มี badge หรือ icon
    return value;
  };

  let tableHTML = `
    <div style="font-family: 'Sarabun', 'Prompt', 'Noto Sans Thai', sans-serif; background: white; padding: 20px;">
      <!-- Header Section -->
      <div style="margin-bottom: 24px; padding-bottom: 16px; border-bottom: 2px solid #F26623;">
        <h1 style="margin: 0 0 8px 0; font-size: 24px; font-weight: bold; color: #111827;">
          ${metadata.title || 'รายงานข้อมูลพนักงาน'}
        </h1>
        <div style="display: flex; flex-wrap: wrap; gap: 16px; font-size: 13px; color: #6B7280;">
          <div>
            <span style="font-weight: 600;">วันที่:</span>
            <span>${metadata.startDate || ''} ถึง ${metadata.endDate || ''}</span>
          </div>

          <div>
            <span style="font-weight: 600;">จำนวนข้อมูล:</span>
            <span>${data.length} รายการ</span>
          </div>
          <div>
            <span style="font-weight: 600;">สร้างเมื่อ:</span>
            <span>${new Date().toLocaleString('th-TH', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}</span>
          </div>
        </div>
      </div>

      <!-- Table Section -->
      <div style="overflow-x: auto;">
        <table style="width: 100%; border-collapse: collapse; font-size: 7px;">
          <thead>
            <tr style="background: linear-gradient(135deg, #F26623 0%, #E95420 100%);">
  `;

  // Add headers with better width control
  headers.forEach(header => {
    // กำหนดความกว้างตามชนิดของ column
    let colWidth = '80px';
    if (header === 'ลำดับ') colWidth = '40px';
    else if (header === 'รหัสพนักงาน') colWidth = '70px';
    else if (header === 'ชื่อ-นามสกุล') colWidth = '120px';
    else if (header === 'อีเมล') colWidth = '110px';
    else if (header.includes('วัน') || header.includes('มา') || header.includes('ขาด') || header.includes('ลา')) colWidth = '50px';
    else if (header.includes('เปอร์เซ็นต์')) colWidth = '65px';
    
    tableHTML += `
              <th style="padding: 6px 4px; text-align: left; color: white; font-weight: 600; border: 1px solid #D97706; white-space: normal; width: ${colWidth}; word-wrap: break-word; font-size: 8px; line-height: 1.3;">
                ${header}
              </th>
    `;
  });

  tableHTML += `
            </tr>
          </thead>
          <tbody>
  `;

  // Add data rows
  data.forEach((row, rowIndex) => {
    const bgColor = rowIndex % 2 === 0 ? '#FFFFFF' : '#FFF7ED';
    tableHTML += `<tr style="background-color: ${bgColor};">`;

    headers.forEach(header => {
      const value = row[header] || '-';
      const formattedValue = formatValue(header, value);

      tableHTML += `
              <td style="padding: 5px 3px; text-align: left; border: 1px solid #E5E7EB; color: #374151; white-space: normal; word-wrap: break-word; font-size: 7.5px; line-height: 1.4; vertical-align: middle;">
                ${formattedValue}
              </td>
      `;
    });

    tableHTML += `</tr>`;
  });

  tableHTML += `
          </tbody>
        </table>
      </div>

      <!-- Summary Section -->
      ${
        metadata.statistics
          ? `
      <div style="margin-top: 24px; padding: 16px; background: #F3F4F6; border-radius: 8px; display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 16px;">
        <div>
          <div style="font-size: 11px; color: #6B7280; margin-bottom: 4px;">จำนวนพนักงานทั้งหมด</div>
          <div style="font-size: 20px; font-weight: bold; color: #111827;">${metadata.statistics.totalEmployees || 0}</div>
        </div>
        <div>
          <div style="font-size: 11px; color: #6B7280; margin-bottom: 4px;">จำนวนแผนก</div>
          <div style="font-size: 20px; font-weight: bold; color: #111827;">${metadata.statistics.totalDepartments || 0}</div>
        </div>
        <div>
          <div style="font-size: 11px; color: #6B7280; margin-bottom: 4px;">เปอร์เซ็นต์มาตรงเวลา</div>
          <div style="font-size: 20px; font-weight: bold; color: #10B981;">${metadata.statistics.avgAttendanceRate || 0}%</div>
        </div>
      </div>
      `
          : ''
      }

      <!-- Footer Section -->
      <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #E5E7EB; text-align: center; font-size: 11px; color: #9CA3AF;">
        <p style="margin: 0;">รายงานนี้สร้างโดยระบบ EasyCheck • © ${new Date().getFullYear()}</p>
      </div>
    </div>
  `;

  return tableHTML;
};

/**
 * สร้าง PDF จากข้อมูล
 */
export const generateEnhancedPDF = async (data, metadata) => {
  try {
    // Create temporary container
    const container = document.createElement('div');
    container.style.position = 'absolute';
    container.style.left = '-9999px';
    container.style.top = '0';
    container.style.width = '2200px'; // เพิ่มความกว้างเพื่อรองรับข้อมูลเยอะ
    container.style.background = 'white';
    document.body.appendChild(container);

    // Build HTML content
    const htmlContent = createHTMLTable(data, metadata);
    container.innerHTML = htmlContent;

    // Wait for fonts to load
    await document.fonts.ready;

    // Add small delay to ensure rendering
    await new Promise(resolve => setTimeout(resolve, 100));

    // Convert to canvas
    const canvas = await html2canvas(container, {
      scale: 1.2, // ลด scale ลงเพื่อให้พอดีกับหน้ากระดาษ
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
      windowWidth: 2200, // ใช้ width ที่เพิ่มขึ้นเพื่อรองรับข้อมูลเยอะ
      onclone: (clonedDoc) => {
        const clonedContainer = clonedDoc.querySelector('div');
        if (clonedContainer) {
          clonedContainer.style.display = 'block';
        }
      },
    });

    // Remove temporary container
    document.body.removeChild(container);

    // Create PDF
    const imgWidth = 297; // A4 width in mm (landscape)
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    const pageHeight = 210; // A4 height in mm (landscape)

    const doc = new jsPDF('l', 'mm', 'a4');
    let heightLeft = imgHeight;
    let position = 0;

    // Add first page
    doc.addImage(
      canvas.toDataURL('image/png'),
      'PNG',
      0,
      position,
      imgWidth,
      imgHeight,
      undefined,
      'FAST'
    );
    heightLeft -= pageHeight;

    // Add additional pages if needed
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      doc.addPage();
      doc.addImage(
        canvas.toDataURL('image/png'),
        'PNG',
        0,
        position,
        imgWidth,
        imgHeight,
        undefined,
        'FAST'
      );
      heightLeft -= pageHeight;
    }

    return doc;
  } catch (error) {
    console.error('PDF generation error:', error);
    throw new Error(`ไม่สามารถสร้าง PDF ได้: ${error.message}`);
  }
};

/**
 * ดาวน์โหลด PDF
 */
export const downloadPDF = async (data, metadata, filename) => {
  const doc = await generateEnhancedPDF(data, metadata);
  doc.save(filename);
};

export default {
  generateEnhancedPDF,
  downloadPDF,
};
