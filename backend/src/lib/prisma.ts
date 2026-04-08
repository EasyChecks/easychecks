import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL; // อ่านค่า URL สำหรับเชื่อมต่อ DB จาก environment

if (!connectionString) { // กันกรณีไม่มี DATABASE_URL
  throw new Error('DATABASE_URL environment variable is not set'); // แจ้งชัดเจนว่า env ขาด
}

const pool = new Pool({ // สร้าง PostgreSQL connection pool โดยใช้ค่า URL
  connectionString, // ส่ง URL เข้าไปให้ pool ใช้เชื่อมต่อ
  options: '-c timezone=Asia/Bangkok', // บังคับ timezone ของ session ให้เป็น Asia/Bangkok
}); // จบการตั้งค่า pool
const adapter = new PrismaPg(pool); // แปลง pg pool ให้ Prisma ใช้งานผ่าน adapter

let prismaInstance: any = null;

async function initPrisma() {
  if (!prismaInstance) {
    try {
      prismaInstance = new PrismaClient({ adapter }); // สร้าง Prisma client กลางสำหรับ query ทั้งระบบ
      console.log('✓ Prisma connected');
    } catch (error) {
      console.error('✗ Prisma connection failed:', error);
      throw error;
    }
  }
  return prismaInstance;
}

// Export lazy getter
export async function getPrisma() {
  return await initPrisma();
}

export let prisma: any = null;

// Initialize on module load (async)
(async () => {
  prisma = await initPrisma();
})().catch((err) => {
  console.error('Failed to initialize Prisma:', err);
  process.exit(1);
});

export default prisma;
