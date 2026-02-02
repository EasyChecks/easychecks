import { PrismaClient } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import 'dotenv/config';

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL environment variable is not set');
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);

let prismaInstance: any = null;

async function initPrisma() {
  if (!prismaInstance) {
    try {
      prismaInstance = new PrismaClient({ adapter });
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
