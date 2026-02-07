/**
 * 📧 EMAIL UTILITIES - ส่งอีเมล Password Reset
 * ใช้ Nodemailer หรือ SendGrid
 */

/**
 * ส่งอีเมล Password Reset
 * TODO: ตั้งค่า Email Service (Gmail, SendGrid, etc.)
 */
export async function sendPasswordResetEmail(
  email: string,
  firstName: string,
  resetToken: string
): Promise<void> {
  try {
    // TODO: ใช้ Nodemailer หรือ SendGrid ส่งอีเมล
    const resetLink = `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`;

    console.log(`
      📧 PASSWORD RESET EMAIL
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      To: ${email}
      Name: ${firstName}
      Reset Link: ${resetLink}
      Expires: 1 hour
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `);

    // ============================================
    // ตัวอย่าง: ใช้ Nodemailer กับ Gmail
    // ============================================
    // import nodemailer from 'nodemailer';
    //
    // const transporter = nodemailer.createTransport({
    //   service: 'gmail',
    //   auth: {
    //     user: process.env.EMAIL_USER,
    //     pass: process.env.EMAIL_PASSWORD
    //   }
    // });
    //
    // const mailOptions = {
    //   from: process.env.EMAIL_FROM || 'noreply@easychecks.com',
    //   to: email,
    //   subject: 'EasyChecks - รีเซ็ตรหัสผ่าน',
    //   html: `
    //     <h2>สวัสดี ${firstName}</h2>
    //     <p>คุณได้ขอรีเซ็ตรหัสผ่านสำหรับบัญชี EasyChecks ของคุณ</p>
    //     <p>กรุณากดลิงก์ด้านล่างเพื่อเปลี่ยนรหัสผ่าน:</p>
    //     <a href="${resetLink}" style="
    //       display: inline-block;
    //       padding: 12px 24px;
    //       background-color: #007bff;
    //       color: white;
    //       text-decoration: none;
    //       border-radius: 4px;
    //     ">
    //       รีเซ็ตรหัสผ่าน
    //     </a>
    //     <p style="color: #666; font-size: 12px;">
    //       ลิงก์นี้จะหมดอายุใน 1 ชั่วโมง
    //     </p>
    //     <p style="color: #999; font-size: 12px;">
    //       ถ้าคุณไม่ได้ขอรีเซ็ตรหัสผ่าน กรุณาลบอีเมลนี้
    //     </p>
    //   `
    // };
    //
    // await transporter.sendMail(mailOptions);

    // ============================================
    // ตัวอย่าง: ใช้ SendGrid
    // ============================================
    // import sgMail from '@sendgrid/mail';
    //
    // sgMail.setApiKey(process.env.SENDGRID_API_KEY!);
    //
    // const msg = {
    //   to: email,
    //   from: process.env.EMAIL_FROM || 'noreply@easychecks.com',
    //   subject: 'EasyChecks - รีเซ็ตรหัสผ่าน',
    //   html: `...`
    // };
    //
    // await sgMail.send(msg);

  } catch (error) {
    console.error('❌ Send email error:', error);
    // ไม่ throw error เพราะไม่ต้องให้ login fail ถ้า email service down
  }
}

/**
 * ส่งอีเมล Welcome
 */
export async function sendWelcomeEmail(
  email: string,
  firstName: string
): Promise<void> {
  try {
    console.log(`
      📧 WELCOME EMAIL
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      To: ${email}
      Name: ${firstName}
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `);

    // TODO: ส่งอีเมล Welcome
  } catch (error) {
    console.error('❌ Send welcome email error:', error);
  }
}

/**
 * ส่งอีเมล Login Alert
 */
export async function sendLoginAlertEmail(
  email: string,
  firstName: string,
  loginTime: string,
  ipAddress?: string
): Promise<void> {
  try {
    console.log(`
      📧 LOGIN ALERT EMAIL
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
      To: ${email}
      Name: ${firstName}
      Time: ${loginTime}
      IP: ${ipAddress || 'Unknown'}
      ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `);

    // TODO: ส่งอีเมล Login Alert
  } catch (error) {
    console.error('❌ Send login alert email error:', error);
  }
}
