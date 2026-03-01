import { Resend } from 'resend';

/**
 * ─────────────────────────────────────────────────────────────
 * 📧 Email Service — ส่งอีเมลผ่าน Resend
 * ─────────────────────────────────────────────────────────────
 * ทำไมใช้ Resend แทน Nodemailer + Gmail?
 * → Nodemailer ต้องตั้งค่า Gmail OAuth หรือ App Password
 *   ส่งจัดเป็น spam ง่ายกว่าเพราะ Gmail ไม่ใช่ transactional email
 *   Resend เป็น API-based โดยตรง มี deliverability ดีกว่า
 *   และ free tier รองรับ 3,000 อีเมล/เดือน
 *
 * ทำไมเก็บ client ไว้เป็น module-level variable?
 * → เพื่อ reuse connection — ถ้า new Resend() ทุกครั้งที่เรียก function
 *   จะสร้าง instance ใหม่ทุกครั้ง ซึ่งสิ้นเปลืองโดยใช่
 * ─────────────────────────────────────────────────────────────
 */

// อ่านจาก env ทุกครั้ง ไม่แคจรองไว้ใน module scope
// เพราะถ้าเปลี่ยน env โดยไม่ restart จะยังใช้บริการ onboarding@resend.dev ได้
// (ผู้รับนอกโดเมนยัง receive ได้เฉพาะอีเมลที่ยืนยันใน Resend dashboard)
const resend = new Resend(process.env.RESEND_API_KEY);
const MAIL_FROM = process.env.MAIL_FROM || 'EasyCheck <onboarding@resend.dev>';

export interface SendAnnouncementEmailOptions {
  to: string;
  recipientName: string; // ใช้ส่วนต้อนรับใน email ("สวัสดีคุณ {name}")
  title: string;        // ส่งเป็นทั้ง subject line และ heading ใน HTML
  content: string;
  sentAt: Date;         // ใช้แสดงเวลาที่ส่งจริงใน email body — timestamp ของ DB
}

/**
 * ส่งอีเมลประกาศให้ผู้รับ 1 คน
 *
 * ทำไม throw แทนที่จะ catch?
 * → เพื่อให้ sendBulkAnnouncementEmails จัดการได้เองผ่าน Promise.allSettled
 *   ถ้า swallow error ตรงนี้ จะไม่รู้ว่าส่งล้มเหลว
 */
export const sendAnnouncementEmail = async (opts: SendAnnouncementEmailOptions): Promise<void> => {
  const { to, recipientName, title, content, sentAt } = opts;

  await resend.emails.send({
    from: MAIL_FROM,
    to,
    subject: `📢 [EasyCheck] ${title}`,
    html: buildEmailHtml({ recipientName, title, content, sentAt }),
  });
};

/**
 * ส่งอีเมล batch — ถูกเรียกจาก sendAnnouncement แบบ fire-and-forget
 *
 * ทำไมใช้ Promise.allSettled แทน Promise.all?
 * → Promise.all จะล้มเหลวทันทีถ้าส่ง 1 คนไม่สำเร็จ
 *   เช่น email คนที่ 50 fail = ทั้งหมด 100 คนไม่ได้รับ
 *   allSettled ดำเนินการต่อหลังจาก fail เสมอ แล้ว report count
 *
 * ทำไมไม่ใช้ Resend batch endpoint?
 * → Resend batch API ส่งอีเมลเหมือนกันแต่ไม่ personalize (เปลี่ยน recipientName ไม่ได้)
 *   ส่งทีละคนเพื่อให้สามารถ render "สวัสดีคุณ {firstName}" ได้แต่ละคน
 */
export const sendBulkAnnouncementEmails = async (
  recipients: { email: string; firstName: string; lastName: string }[],
  title: string,
  content: string,
  sentAt: Date
): Promise<{ success: number; failed: number }> => {
  const results = await Promise.allSettled(
    recipients.map((r) =>
      sendAnnouncementEmail({
        to: r.email,
        recipientName: `${r.firstName} ${r.lastName}`,
        title,
        content,
        sentAt,
      })
    )
  );

  const success = results.filter((r) => r.status === 'fulfilled').length;
  const failed = results.filter((r) => r.status === 'rejected').length;

  if (failed > 0) {
    const errors = results
      .filter((r): r is PromiseRejectedResult => r.status === 'rejected')
      .map((r) => r.reason);
    console.error(`[EmailService] ส่งอีเมลล้มเหลว ${failed} รายการ:`, errors);
  }

  return { success, failed };
};

// ─── HTML Template ──────────────────────────────────────────────
//
// ทำไม inline style ทั้งหมด ไม่ใช้ CSS class?
// → Email clients (Outlook, Gmail) ตัด <style> tag ออก
//   ต้องใช้ style="" ใน element โดยตรงเท่านั้น
//
// ทำไม escape content ก่อน render?
// → content มาจาก user input — ถ้าไม่ escape อาจมี XSS ใน email
//   แปลง <, >, & เป็น HTML entities ก่อนเสมอ
//
// ทำไม แปลง \n → <br>?
// → HTML ignore whitespace — ถ้าไม่แปลง เนื้อหาที่มีย่อหน้าจะยุบเป็นบรรทัดเดียว

const buildEmailHtml = ({
  recipientName,
  title,
  content,
  sentAt,
}: {
  recipientName: string;
  title: string;
  content: string;
  sentAt: Date;
}): string => {
  const dateStr = sentAt.toLocaleString('th-TH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Asia/Bangkok',
  });

  // แปลง newline เป็น <br>
  const contentHtml = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');

  return `
<!DOCTYPE html>
<html lang="th">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${title}</title>
</head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 0;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#f97316,#ea580c);border-radius:12px 12px 0 0;padding:32px 40px;text-align:center;">
              <div style="font-size:28px;margin-bottom:8px;">📢</div>
              <h1 style="margin:0;color:#fff;font-size:22px;font-weight:700;">ประกาศจาก EasyCheck</h1>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="background:#fff;padding:40px;">
              <p style="margin:0 0 16px;color:#374151;font-size:15px;">สวัสดีคุณ <strong>${recipientName}</strong></p>
              <p style="margin:0 0 24px;color:#6b7280;font-size:14px;">มีประกาศใหม่จากทีมงาน:</p>

              <!-- Announcement Box -->
              <div style="background:#fff7ed;border-left:4px solid #f97316;border-radius:0 8px 8px 0;padding:20px 24px;margin-bottom:24px;">
                <h2 style="margin:0 0 12px;color:#c2410c;font-size:18px;font-weight:700;">${title}</h2>
                <p style="margin:0;color:#374151;font-size:14px;line-height:1.7;">${contentHtml}</p>
              </div>

              <p style="margin:0;color:#9ca3af;font-size:12px;">
                ส่งเมื่อ: ${dateStr} (เวลาประเทศไทย)
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background:#f9fafb;border-radius:0 0 12px 12px;padding:20px 40px;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="margin:0;color:#9ca3af;font-size:12px;">
                อีเมลนี้ส่งจากระบบ <strong>EasyCheck</strong> โดยอัตโนมัติ กรุณาอย่าตอบกลับ
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
};
