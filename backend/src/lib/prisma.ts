/**
 * 🔌 DATABASE CONNECTION - เชื่อมต่อฐานข้อมูล PostgreSQL ผ่าน Prisma ORM
 *
 * สถาปัตยกรรม:
 *   PostgreSQL ← pg Pool ← PrismaPg Adapter ← PrismaClient
 *
 * ทำไมต้องใช้ Pool + Adapter?
 *   - pg Pool = จัดการ connection pooling (ไม่ต้องเปิด/ปิดทุก query)
 *   - PrismaPg = adapter ให้ Prisma คุยกับ pg Pool ได้
 *   - PrismaClient = ORM สำหรับ query (type-safe, auto-complete)
 *
 * Lazy Initialization:
 *   - สร้าง PrismaClient ครั้งแรกที่เรียกใช้ (ไม่สร้างตอน import)
 *   - ป้องกัน multiple instances ใน development (hot reload)
 */

import { PrismaClient } from '@prisma/client';  // ← Prisma ORM client (type-safe query builder)
import { Pool } from 'pg';                     // ← PostgreSQL connection pool (จัดการ connection)
import { PrismaPg } from '@prisma/adapter-pg'; // ← Adapter เชื่อม Prisma กับ pg Pool
import 'dotenv/config';                        // ← โหลด .env file เข้า process.env

// ═══════════════════════════════════════════════════════════════
// ① อ่าน DATABASE_URL จาก environment variable
// ═══════════════════════════════════════════════════════════════
const connectionString = process.env.DATABASE_URL; // ← URL เชื่อมต่อ DB (เช่น postgres://user:pass@host:5432/db)

if (!connectionString) { // ← กันกรณี .env ไม่มี DATABASE_URL
  throw new Error('DATABASE_URL environment variable is not set'); // ← หยุดทันที ถ้าไม่มี URL
}

// ═══════════════════════════════════════════════════════════════
// ② สร้าง PostgreSQL Connection Pool
// ═══════════════════════════════════════════════════════════════
const pool = new Pool({                           // ← สร้าง pool สำหรับจัดการหลาย connection พร้อมกัน
  connectionString,                               // ← ใช้ URL จาก env
  options: '-c timezone=Asia/Bangkok',            // ← บังคับ timezone เป็น Bangkok ทุก session
});                                               // ← pool พร้อมใช้งาน

// ═══════════════════════════════════════════════════════════════
// ③ สร้าง Prisma Adapter (เชื่อม Prisma ↔ pg Pool)
// ═══════════════════════════════════════════════════════════════
const adapter = new PrismaPg(pool);               // ← แปลง pg pool ให้ Prisma ใช้งานได้

// ═══════════════════════════════════════════════════════════════
// ④ Lazy Initialization — สร้าง PrismaClient ครั้งแรกที่เรียกใช้
// ═══════════════════════════════════════════════════════════════
let prismaInstance: any = null;                   // ← เก็บ instance ไว้ ป้องกันสร้างซ้ำ

async function initPrisma() {                     // ← ฟังก์ชันสร้าง PrismaClient (เรียกครั้งเดียว)
  if (!prismaInstance) {                          // ← ถ้ายังไม่เคยสร้าง
    try {
      prismaInstance = new PrismaClient({ adapter }); // ← สร้าง PrismaClient พร้อม pg adapter
      console.log('✓ Prisma connected');          // ← แจ้งว่าเชื่อมต่อสำเร็จ
    } catch (error) {
      console.error('✗ Prisma connection failed:', error); // ← แจ้ง error ถ้าเชื่อมต่อไม่ได้
      throw error;                                // ← โยน error ต่อให้ caller จัดการ
    }
  }
  return prismaInstance;                          // ← คืน instance ที่สร้างไว้แล้ว
}

// ═══════════════════════════════════════════════════════════════
// ⑤ Export สำหรับใช้งานทั้งระบบ
// ═══════════════════════════════════════════════════════════════

// Export async getter (สำหรับกรณีต้องการ await)
export async function getPrisma() {               // ← ใช้เมื่อต้องการ await initialization
  return await initPrisma();
}

// Export synchronous reference (สำหรับ import ปกติ)
export let prisma: any = null;                    // ← ตัวแปรกลาง — ใช้ได้ทันทีหลัง init เสร็จ

// Initialize ตอน module load (async IIFE)
(async () => {                                    // ← IIFE: เรียก initPrisma ทันทีตอน import
  prisma = await initPrisma();                    // ← assign ผลลัพธ์ให้ prisma
})().catch((err) => {                             // ← ถ้า init ล้มเหลว
  console.error('Failed to initialize Prisma:', err); // ← log error
  process.exit(1);                                // ← หยุด server ทันที (ไม่มี DB = ทำงานไม่ได้)
});

export default prisma;                            // ← default export สำหรับ import prisma from '...'
