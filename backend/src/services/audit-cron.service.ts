/**
 * ⏰ Audit Cron Job — ลบ Audit Logs เก่าอัตโนมัติ (90 วัน)
 * ─────────────────────────────────────────────────────────────────────
 * ทำไมต้องลบ?
 * — Audit log โตวันละหลายร้อย record → หลายเดือนจะเต็ม storage
 * — PDPA กำหนดให้เก็บ log ไม่เกิน 90 วัน (หรือตามนโยบายองค์กร)
 * — ถ้าไม่ลบ → query ช้า, backup ใหญ่, ค่า storage พุ่ง
 *
 * ทำไมใช้ node-cron แทน pg_cron?
 * — Supabase (free tier) ไม่เปิดให้ใช้ pg_cron
 * — node-cron ทำงานใน Node.js process → ไม่ต้องตั้งค่า DB เพิ่ม
 * — ข้อเสีย: ถ้า server restart ตอนเที่ยงคืนพอดี → ข้ามรอบนั้น
 *   → ไม่เป็นปัญหาเพราะรอบถัดไปจะลบแทน
 *
 * Schedule: ทุกวัน เวลา 02:00 (เวลา server)
 * ทำไม 02:00? — traffic ต่ำสุด ลด impact ต่อ query อื่น
 *
 * SQL เทียบเท่า:
 * DELETE FROM "audit_logs" WHERE "createdAt" < NOW() - INTERVAL '90 days'
 */

import cron from 'node-cron';
import { prisma } from '../lib/prisma.js';

/** จำนวนวันที่เก็บ audit log ก่อนลบ */
const RETENTION_DAYS = 90;

/**
 * เริ่ม cron job สำหรับลบ audit log เก่า
 * — เรียกครั้งเดียวตอน server start (ใน index.ts)
 * — ถ้าเรียกซ้ำจะ schedule ซ้ำ → ต้องเรียกแค่ครั้งเดียว
 */
export function startAuditCleanupCron() {
  // ===== Cron expression: "0 2 * * *" =====
  // ─ 0   → นาทีที่ 0
  // ─ 2   → ชั่วโมงที่ 2 (02:00)
  // ─ *   → ทุกวัน
  // ─ *   → ทุกเดือน
  // ─ *   → ทุกวันในสัปดาห์
  cron.schedule('0 2 * * *', async () => {
    console.log(`[CRON] 🧹 เริ่มลบ audit logs เก่ากว่า ${RETENTION_DAYS} วัน...`);

    try {
      const cutoffDate = new Date();
      cutoffDate.setDate(cutoffDate.getDate() - RETENTION_DAYS);

      // ใช้ deleteMany เพราะ Prisma ไม่มี batch delete แบบ raw SQL
      // แต่ deleteMany ใช้ WHERE clause → ปลอดภัย ไม่ลบเกิน
      const result = await prisma.auditLog.deleteMany({
        where: {
          createdAt: { lt: cutoffDate },
        },
      });

      console.log(`[CRON] ✅ ลบ audit logs สำเร็จ: ${result.count} รายการ (ก่อน ${cutoffDate.toISOString()})`);
    } catch (error) {
      // ถ้าลบ fail → log ไว้ รอรอบถัดไป ไม่ crash server
      console.error('[CRON] ❌ ลบ audit logs ล้มเหลว:', error);
    }
  });

  console.log(`[CRON] ⏰ Audit cleanup job scheduled — ทุกวัน 02:00 (ลบ log เก่ากว่า ${RETENTION_DAYS} วัน)`);
}
