import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';
import { Readable } from 'stream';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const bucketName = process.env.SUPABASE_BUCKET_NAME || 'easycheck-bucket';

if (!supabaseUrl || !supabaseKey) {
  throw new Error('SUPABASE_URL และ SUPABASE_ANON_KEY (หรือ SUPABASE_SERVICE_ROLE_KEY) ต้องตั้งค่าใน .env');
}

const supabase = createClient(supabaseUrl, supabaseKey);

/**
 * ดาวน์โหลดรูปจาก RandomUser API และอัปโหลดไป Supabase Storage
 * @param gender - 'male' หรือ 'female'
 * @param seed - seed สำหรับให้ได้รูปเดิม (ใช้ employeeId)
 * @returns URL ของรูปใน Supabase Storage
 */
export async function uploadAvatarToSupabase(
  employeeId: string,
  gender: 'male' | 'female' = 'male'
): Promise<string> {
  try {
    // 1. ดาวน์โหลดรูปจาก RandomUser API (รูปผู้ใหญ่เท่านั้น)
    const randomUserUrl = `https://randomuser.me/api/?gender=${gender}&seed=${employeeId}&nat=th,us,gb`;
    const response = await fetch(randomUserUrl);
    const data = await response.json() as any;
    
    if (!data.results || data.results.length === 0) {
      throw new Error('ไม่สามารถดาวน์โหลดรูปจาก RandomUser API');
    }

    const imageUrl = data.results[0].picture.large; // รูปขนาดใหญ่
    
    // 2. ดาวน์โหลดรูปภาพ
    const imageResponse = await fetch(imageUrl);
    const imageBuffer = await imageResponse.arrayBuffer();
    
    // 3. อัปโหลดไป Supabase Storage
    const fileName = `avatars/${employeeId}.jpg`;
    const { data: uploadData, error } = await supabase.storage
      .from(bucketName)
      .upload(fileName, Buffer.from(imageBuffer), {
        contentType: 'image/jpeg',
        upsert: true, // อัปเดตถ้ามีอยู่แล้ว
      });

    if (error) {
      console.error('❌ Upload error:', error);
      // ถ้า upload ล้มเหลว ให้ใช้ URL จาก RandomUser แทน
      return imageUrl;
    }

    // 4. สร้าง public URL
    const { data: publicData } = supabase.storage
      .from(bucketName)
      .getPublicUrl(fileName);

    return publicData.publicUrl;
  } catch (error) {
    console.error('❌ Error in uploadAvatarToSupabase:', error);
    // Fallback: ใช้ UI Avatars ถ้าเกิด error
    return `https://ui-avatars.com/api/?name=${employeeId}&background=random&size=200`;
  }
}

/**
 * ตรวจสอบว่า bucket มีอยู่หรือไม่ ถ้าไม่มีให้สร้าง
 */
export async function ensureBucketExists(): Promise<void> {
  try {
    const { data: buckets, error } = await supabase.storage.listBuckets();
    
    if (error) {
      console.error('❌ Error listing buckets:', error);
      return;
    }

    const bucketExists = buckets?.some(b => b.name === bucketName);

    if (!bucketExists) {
      console.log(`📦 Creating bucket: ${bucketName}...`);
      const { error: createError } = await supabase.storage.createBucket(bucketName, {
        public: true, // ทำให้เป็น public bucket
      });

      if (createError) {
        console.error('❌ Error creating bucket:', createError);
      } else {
        console.log(`✅ Bucket ${bucketName} created successfully!`);
      }
    } else {
      console.log(`✅ Bucket ${bucketName} already exists.`);
    }
  } catch (error) {
    console.error('❌ Error in ensureBucketExists:', error);
  }
}

/**
 * ลบรูปภาพจาก Supabase Storage
 */
export async function deleteAvatar(employeeId: string): Promise<boolean> {
  try {
    const fileName = `avatars/${employeeId}.jpg`;
    const { error } = await supabase.storage
      .from(bucketName)
      .remove([fileName]);

    if (error) {
      console.error('❌ Delete error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('❌ Error in deleteAvatar:', error);
    return false;
  }
}
