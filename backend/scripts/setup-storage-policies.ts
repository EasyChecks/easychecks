import pg from 'pg';
import fs from 'fs';
import path from 'path';

const { Pool } = pg;

async function setupStoragePolicies() {
  const directUrl = process.env.DIRECT_URL;
  
  if (!directUrl) {
    console.error('❌ DIRECT_URL ไม่ได้ตั้งค่าใน .env');
    process.exit(1);
  }

  const pool = new Pool({
    connectionString: directUrl,
  });

  try {
    console.log('🔐 กำลังตั้งค่า Storage RLS Policies...\n');

    // อ่าน SQL file
    const sqlPath = path.join(process.cwd(), 'prisma', 'enable-storage-rls.sql');
    const sql = fs.readFileSync(sqlPath, 'utf-8');

    // แยก SQL statements (แบ่งตาม semicolon)
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0 && !s.startsWith('--'));

    for (const statement of statements) {
      if (statement.includes('CREATE POLICY')) {
        const policyName = statement.match(/"([^"]+)"/)?.[1] || 'unknown';
        try {
          await pool.query(statement);
          console.log(`✅ สร้าง policy: ${policyName}`);
        } catch (error: any) {
          if (error.code === '42710') {
            console.log(`⚠️  Policy ${policyName} มีอยู่แล้ว`);
          } else {
            throw error;
          }
        }
      } else if (statement.includes('SELECT')) {
        // Query เพื่อดู policies ที่มี
        const result = await pool.query(statement);
        console.log('\n📋 Storage Policies ที่มีอยู่:');
        console.table(result.rows);
      }
    }

    console.log('\n✅ ตั้งค่า Storage RLS Policies เสร็จสิ้น!');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

setupStoragePolicies();
