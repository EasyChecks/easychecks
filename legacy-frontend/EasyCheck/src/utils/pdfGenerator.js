import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';

export const generateUserPDF = async (user) => {
  // สร้าง HTML element ชั่วคราวสำหรับแปลงเป็น PDF
  const element = document.createElement('div');
  element.style.position = 'absolute';
  element.style.left = '-9999px';
  element.style.width = '210mm';
  element.style.padding = '20px';
  element.style.backgroundColor = '#ffffff';
  element.style.fontFamily = 'Prompt, sans-serif';
  
  // สร้างเนื้อหา HTML
  element.innerHTML = `
    <div style="font-family: 'Prompt', sans-serif;">
      <!-- Header -->
      <div style="background: linear-gradient(to right, #F26623, #FF8C42); padding: 30px 20px; margin: -20px -20px 20px -20px; color: white; border-radius: 10px 10px 0 0;">
        <h1 style="margin: 0 0 10px 0; font-size: 32px; font-weight: bold;">ข้อมูลพนักงาน</h1>
        <p style="margin: 0; font-size: 16px; opacity: 0.9;">Employee Information</p>
        <p style="margin: 10px 0 0 0; font-size: 12px; opacity: 0.8;">สร้างเมื่อ: ${new Date().toLocaleDateString('th-TH', { 
          year: 'numeric', 
          month: 'long', 
          day: 'numeric' 
        })}</p>
      </div>
      
      <!-- Profile Section -->
      <div style="display: flex; gap: 20px; margin-bottom: 20px; align-items: center; background: #FFF2EC; padding: 20px; border-radius: 10px; border: 2px solid #F26623;">
        <img src="${user.profileImage || ('https://i.pravatar.cc/150?u=' + user.id)}" 
             style="width: 120px; height: 120px; border-radius: 10px; object-fit: cover; border: 3px solid white; box-shadow: 0 4px 6px rgba(0,0,0,0.1);" 
             crossorigin="anonymous" />
        <div style="flex: 1;">
          <h2 style="margin: 0 0 5px 0; font-size: 24px; color: #000000;">${user.name}</h2>
          <p style="margin: 0 0 10px 0; color: #4B5563; font-size: 16px;">${user.position || 'ไม่ระบุตำแหน่ง'}</p>
          <div style="display: inline-block; padding: 6px 16px; background: #F26623; color: white; border-radius: 20px; font-size: 14px; font-weight: 600;">
            ${user.status}
          </div>
          <p style="margin: 10px 0 0 0; color: #4B5563; font-size: 14px;">รหัสพนักงาน: ${user.employeeId}</p>
        </div>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 20px;">
        <!-- ข้อมูลส่วนตัว -->
        <div>
          <div style="background: #FFE4D0; padding: 12px 20px; border-radius: 8px 8px 0 0; margin-bottom: 0;">
                      <h3 style="margin: 0; font-size: 18px; color: #F26623; display: flex; align-items: center;">
            <svg style="width: 20px; height: 20px; margin-right: 8px; fill: #F26623;" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z"/></svg> ข้อมูลส่วนตัว
          </h3>
          </div>
          <div style="background: white; padding: 20px; border: 2px solid #FFE4D0; border-radius: 0 0 8px 8px;">
            <table style="width: 100%; font-size: 14px;">
              <tr>
                <td style="padding: 8px 0; color: #4B5563; width: 45%;">วันเกิด</td>
                <td style="padding: 8px 0; color: #000000; font-weight: 600;">${user.birthDate || 'ไม่ระบุ'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #4B5563; border-top: 1px solid #e2e8f0;">อายุ</td>
                <td style="padding: 8px 0; color: #000000; font-weight: 600; border-top: 1px solid #e2e8f0;">${user.age} ปี</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #4B5563; border-top: 1px solid #e2e8f0;">เลขบัตรประชาชน</td>
                <td style="padding: 8px 0; color: #000000; font-weight: 600; border-top: 1px solid #e2e8f0; font-size: 12px;">${user.nationalId || 'ไม่ระบุ'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #4B5563; border-top: 1px solid #e2e8f0;">หมู่เลือด</td>
                <td style="padding: 8px 0; color: #000000; font-weight: 600; border-top: 1px solid #e2e8f0;">${user.bloodType || 'ไม่ระบุ'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #4B5563; border-top: 1px solid #e2e8f0;">อีเมล</td>
                <td style="padding: 8px 0; color: #000000; font-weight: 600; border-top: 1px solid #e2e8f0; font-size: 12px;">${user.email}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #4B5563; border-top: 1px solid #e2e8f0;">เบอร์โทรศัพท์</td>
                <td style="padding: 8px 0; color: #000000; font-weight: 600; border-top: 1px solid #e2e8f0;">${user.phone}</td>
              </tr>
            </table>
          </div>
        </div>
        
        <!-- ข้อมูลการทำงาน -->
        <div>
          <div style="background: #FFE4D0; padding: 12px 20px; border-radius: 8px 8px 0 0; margin-bottom: 0;">
            <h3 style="margin: 0; font-size: 18px; color: #C84C15; display: flex; align-items: center;">
              <span style="margin-right: 8px;">
                <svg style="width: 18px; height: 18px; display: inline; fill: #F26623;" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/></svg>
              </span> ข้อมูลการทำงาน
            </h3>
          </div>
          <div style="background: white; padding: 20px; border: 2px solid #FFE4D0; border-radius: 0 0 8px 8px;">
            <table style="width: 100%; font-size: 14px;">
              <tr>
                <td style="padding: 8px 0; color: #4B5563; width: 45%;">ตำแหน่ง</td>
                <td style="padding: 8px 0; color: #000000; font-weight: 600;">${user.position || 'ไม่ระบุ'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #4B5563; border-top: 1px solid #e2e8f0;">แผนก</td>
                <td style="padding: 8px 0; color: #000000; font-weight: 600; border-top: 1px solid #e2e8f0;">${user.department || 'ไม่ระบุ'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #4B5563; border-top: 1px solid #e2e8f0;">วันเริ่มงาน</td>
                <td style="padding: 8px 0; color: #000000; font-weight: 600; border-top: 1px solid #e2e8f0;">${user.startDate || 'ไม่ระบุ'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #4B5563; border-top: 1px solid #e2e8f0;">ประเภทการจ้าง</td>
                <td style="padding: 8px 0; color: #000000; font-weight: 600; border-top: 1px solid #e2e8f0;">${user.employmentType || 'ไม่ระบุ'}</td>
              </tr>
              <tr>
                <td style="padding: 8px 0; color: #4B5563; border-top: 1px solid #e2e8f0;">เงินเดือน</td>
                <td style="padding: 8px 0; color: #000000; font-weight: 600; border-top: 1px solid #e2e8f0;">${user.salary ? user.salary.toLocaleString() + ' บาท' : 'ไม่ระบุ'}</td>
              </tr>
            </table>
          </div>
        </div>
      </div>
      
      ${user.address ? `
      <!-- ที่อยู่ -->
      <div style="margin-top: 20px;">
        <div style="background: #FFF2EC; padding: 12px 20px; border-radius: 8px 8px 0 0; margin-bottom: 0;">
          <h3 style="margin: 0; font-size: 18px; color: #F26623; display: flex; align-items: center;">
            <span style="margin-right: 8px;"><svg style="width: 20px; height: 20px; display: inline; fill: #F26623;" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.42 0-8-3.58-8-8s3.58-8 8-8 8 3.58 8 8-3.58 8-8 8zm3.5-9c.83 0 1.5-.67 1.5-1.5S16.33 8 15.5 8 14 8.67 14 9.5s.67 1.5 1.5 1.5zm-7 0c.83 0 1.5-.67 1.5-1.5S9.33 8 8.5 8 7 8.67 7 9.5 7.67 11 8.5 11zm3.5 6.5c2.33 0 4.31-1.46 5.11-3.5H6.89c.8 2.04 2.78 3.5 5.11 3.5z"/></svg></span> ที่อยู่
          </h3>
        </div>
        <div style="background: white; padding: 20px; border: 2px solid #FFF2EC; border-radius: 0 0 8px 8px; font-size: 14px; color: #000000; line-height: 1.6;">
          ${user.address}
        </div>
      </div>
      ` : ''}
      
      ${user.emergencyContact?.name || user.emergencyContact?.phone ? `
      <!-- ข้อมูลผู้ติดต่อฉุกเฉิน -->
      <div style="margin-top: 20px;">
        <div style="background: #fef3c7; padding: 12px 20px; border-radius: 8px 8px 0 0; margin-bottom: 0;">
          <h3 style="margin: 0; font-size: 18px; color: #92400e; display: flex; align-items: center;">
            <span style="margin-right: 8px;">⚠️</span> ข้อมูลผู้ติดต่อฉุกเฉิน
          </h3>
        </div>
        <div style="background: white; padding: 20px; border: 2px solid #fef3c7; border-radius: 0 0 8px 8px;">
          <table style="width: 100%; font-size: 14px;">
            <tr>
              <td style="padding: 8px 0; color: #4B5563; width: 30%;">ชื่อ-นามสกุล</td>
              <td style="padding: 8px 0; color: #000000; font-weight: 600;">${user.emergencyContact?.name || 'ไม่ระบุ'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #4B5563; border-top: 1px solid #e2e8f0;">เบอร์โทรศัพท์</td>
              <td style="padding: 8px 0; color: #000000; font-weight: 600; border-top: 1px solid #e2e8f0;">${user.emergencyContact?.phone || 'ไม่ระบุ'}</td>
            </tr>
            <tr>
              <td style="padding: 8px 0; color: #4B5563; border-top: 1px solid #e2e8f0;">ความสัมพันธ์</td>
              <td style="padding: 8px 0; color: #000000; font-weight: 600; border-top: 1px solid #e2e8f0;">${user.emergencyContact?.relationship || 'ไม่ระบุ'}</td>
            </tr>
          </table>
        </div>
      </div>
      ` : ''}
      
      ${user.workHistory && user.workHistory.length > 0 ? `
      <!-- ประวัติการทำงาน -->
      <div style="margin-top: 20px; page-break-inside: avoid;">
        <div style="background: #FFF2EC; padding: 12px 20px; border-radius: 8px 8px 0 0; margin-bottom: 0;">
          <h3 style="margin: 0; font-size: 18px; color: #F26623; display: flex; align-items: center;">
            <svg style="width: 20px; height: 20px; margin-right: 8px; fill: #F26623;" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M20 2H4c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h14l4 4V4c0-1.1-.9-2-2-2zm-2 12H6v-2h12v2zm0-3H6V9h12v2zm0-3H6V6h12v2z"/></svg> ข้อมูลการทำงาน
          </h3>
        </div>
        <div style="background: white; padding: 20px; border: 2px solid #FFF2EC; border-radius: 0 0 8px 8px;">
          ${user.workHistory.map((work, index) => `
            <div style="margin-bottom: ${index < user.workHistory.length - 1 ? '20px' : '0'}; padding-bottom: ${index < user.workHistory.length - 1 ? '20px' : '0'}; border-bottom: ${index < user.workHistory.length - 1 ? '1px solid #e2e8f0' : 'none'};">
              <div style="color: #F26623; font-weight: 700; font-size: 16px; margin-bottom: 8px;">${index + 1}. ${work.position || '-'}</div>
              <div style="color: #4B5563; font-size: 14px; margin-bottom: 4px;">
                <span style="font-weight: 600;">บริษัท:</span> ${work.company || '-'}
              </div>
              <div style="color: #4B5563; font-size: 14px;">
                <span style="font-weight: 600;">ช่วงเวลา:</span> ${work.period || '-'}
              </div>
            </div>
          `).join('')}
        </div>
      </div>
      ` : ''}
      
      ${user.education && user.education.length > 0 ? `
      <!-- การศึกษา -->
      <div style="margin-top: 20px; page-break-inside: avoid;">
        <div style="background: #FFF2EC; padding: 12px 20px; border-radius: 8px 8px 0 0; margin-bottom: 0;">
          <h3 style="margin: 0; font-size: 18px; color: #F26623; display: flex; align-items: center;">
              <span style="margin-right: 8px;">
                <svg style="width: 18px; height: 18px; display: inline; fill: #F26623;" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M5 13.18c0 .897.563 1.68 1.403 2.043C7.622 15.743 9.267 16 12 16s4.378-.257 5.597-.777c.84-.363 1.403-1.146 1.403-2.043 0-.672-.416-1.253-1.007-1.566.251.413.39.867.39 1.356 0 1.245-1.305 2.271-3.021 2.271-.929 0-1.79-.334-2.374-.879-1.294-1.18-3.556-1.18-4.85 0-.584.545-1.445.879-2.374.879-1.716 0-3.021-1.026-3.021-2.271 0-.489.139-.943.39-1.356-.591.313-1.007.894-1.007 1.566zm12.348-2.211l-3.536.954-1.605-1.605 3.536-.954c.151.041.298.112.432.207.134-.096.281-.166.432-.207zm0-1.414l-3.536.954-1.605-1.605 3.536-.954c.151.041.298.112.432.207.134-.096.281-.166.432-.207zm-17.068-1.105l3.536.954-1.605 1.605-3.536-.954c-.151-.041-.298-.112-.432-.207-.134.096-.281.166-.432.207zm8.534-3.596V2c-.405 0-.788.062-1.159.159.371.097.742.159 1.159.159s.788-.062 1.159-.159c-.371-.097-.754-.159-1.159-.159v3.086z"/></svg>
              </span> การศึกษา
          </h3>
        </div>
        <div style="background: white; padding: 20px; border: 2px solid #FFF2EC; border-radius: 0 0 8px 8px;">
          <ul style="margin: 0; padding-left: 20px; color: #000000; font-size: 14px; line-height: 1.8;">
            ${user.education.map(edu => {
              const ed = typeof edu === 'string' ? edu : `${edu.degree || edu.level || ''}${edu.institution ? ' - ' + edu.institution : ''}${edu.year ? ' (' + edu.year + ')' : ''}`;
              return `<li style="margin-bottom: 8px;">${ed}</li>`;
            }).join('')}
          </ul>
        </div>
      </div>
      ` : ''}
      
      ${user.skills && user.skills.length > 0 ? `
      <!-- ทักษะ -->
      <div style="margin-top: 20px; page-break-inside: avoid;">
        <div style="background: #FFF2EC; padding: 12px 20px; border-radius: 8px 8px 0 0; margin-bottom: 0;">
          <h3 style="margin: 0; font-size: 18px; color: #F26623; display: flex; align-items: center;">
            <svg style="width: 18px; height: 18px; display: inline; fill: #F26623; margin-right: 8px;" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path d="M13 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V9z"/><path d="M13 2v7h7"/></svg>
            ทักษะ
          </h3>
        </div>
        <div style="background: white; padding: 20px; border: 2px solid #FFF2EC; border-radius: 0 0 8px 8px;">
          <div style="display: flex; flex-wrap: wrap; gap: 10px;">
            ${user.skills.map(skill => {
              const formatted = typeof skill === 'string'
                ? skill
                : `${skill.name || ''}${skill.level ? ' - ' + skill.level : ''}${skill.years ? ' (' + skill.years + ' ปี)' : ''}`;
              return `
              <span style="display: inline-block; padding: 8px 16px; background: linear-gradient(to right, #FFF2EC, #FFF2EC); color: #F26623; border-radius: 20px; font-size: 13px; font-weight: 600;">
                ${formatted}
              </span>
            `;
            }).join('')}
          </div>
        </div>
      </div>
      ` : ''}
      
      <!-- Footer -->
      <div style="margin-top: 40px; padding-top: 20px; border-top: 2px solid #e2e8f0; text-align: center; color: #94a3b8; font-size: 12px;">
        <p style="margin: 0;">เอกสารนี้สร้างโดยระบบ EasyCheck</p>
        <p style="margin: 5px 0 0 0;">วันที่พิมพ์: ${new Date().toLocaleString('th-TH')}</p>
      </div>
    </div>
  `;
  
  document.body.appendChild(element);
  
  try {
    // รอให้รูปภาพโหลดเสร็จ
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // แปลง HTML เป็น canvas
    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });
    
    // สร้าง PDF
    const imgWidth = 210; // A4 width in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;
    
    const doc = new jsPDF('p', 'mm', 'a4');
    const imgData = canvas.toDataURL('image/png');
    
    // คำนวณจำนวนหน้า
    let heightLeft = imgHeight;
    let position = 0;
    const pageHeight = 297; // A4 height in mm
    
    // หน้าแรก
    doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;
    
    // หน้าถัดไป (ถ้ามี)
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      doc.addPage();
      doc.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }
    
    // บันทึกไฟล์
    doc.save(`${user.employeeId}_${user.name.replace(/\s+/g, '_')}.pdf`);
  } catch (error) {
    console.error('Error generating PDF:', error);
    alert('เกิดข้อผิดพลาดในการสร้าง PDF: ' + error.message);
  } finally {
    // ลบ element ชั่วคราว
    document.body.removeChild(element);
  }
};
