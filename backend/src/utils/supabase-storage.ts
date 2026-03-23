import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
const bucketName = process.env.SUPABASE_BUCKET_NAME || 'easycheck-bucket';

if (!supabaseUrl || !supabaseKey) {
  throw new Error('SUPABASE_URL และ SUPABASE_ANON_KEY (หรือ SUPABASE_SERVICE_ROLE_KEY) ต้องตั้งค่าใน .env');
}

const supabase = createClient(supabaseUrl, supabaseKey);

type AttendancePhotoKind = 'check-in' | 'check-out';

function parseImageInput(photo: string): { buffer: Buffer; contentType: string; extension: string } {
  const dataUrlMatch = photo.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);
  if (dataUrlMatch?.[1] && dataUrlMatch?.[2]) {
    const contentType = dataUrlMatch[1];
    const base64 = dataUrlMatch[2];
    const extension = contentType.split('/')[1]?.split('+')[0] || 'jpg';
    return {
      buffer: Buffer.from(base64, 'base64'),
      contentType,
      extension,
    };
  }

  // รองรับกรณี frontend ส่ง base64 ตรงๆ (ไม่มี data URL prefix)
  return {
    buffer: Buffer.from(photo, 'base64'),
    contentType: 'image/jpeg',
    extension: 'jpg',
  };
}

/**
 * อัปโหลดรูป check-in/check-out ไป Supabase Storage และคืน public URL
 */
export async function uploadAttendancePhotoToSupabase(
  userId: number,
  photo: string,
  kind: AttendancePhotoKind,
): Promise<string> {
  if (!photo || photo.trim().length === 0) {
    throw new Error('รูปภาพว่าง ไม่สามารถอัปโหลดได้');
  }

  // ถ้าส่งมาเป็น URL อยู่แล้ว (เช่น รีไทรจาก client) ให้ใช้ต่อได้เลย
  if (/^https?:\/\//i.test(photo)) {
    return photo;
  }

  const { buffer, contentType, extension } = parseImageInput(photo);
  const now = new Date();
  const yyyy = String(now.getUTCFullYear());
  const mm = String(now.getUTCMonth() + 1).padStart(2, '0');
  const dd = String(now.getUTCDate()).padStart(2, '0');
  const fileName = `attendance/${kind}/${yyyy}/${mm}/${dd}/u${userId}-${Date.now()}.${extension}`;

  const { error } = await supabase.storage
    .from(bucketName)
    .upload(fileName, buffer, {
      contentType,
      upsert: false,
    });

  if (error) {
    throw new Error(`อัปโหลดรูป ${kind} ไป Supabase ไม่สำเร็จ: ${error.message}`);
  }

  const { data: publicData } = supabase.storage.from(bucketName).getPublicUrl(fileName);
  return publicData.publicUrl;
}

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

const ALLOWED_MIME_TYPES: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'application/pdf': 'pdf',
};

/**
 * อัปโหลดไฟล์แนบ (รูปภาพ / PDF) จาก base64 ไปยัง Supabase Storage
 * @param base64 - base64 string ของไฟล์ (ไม่รวม data URI prefix)
 * @param mimeType - MIME type เช่น 'image/jpeg', 'application/pdf'
 * @param userId - user ID สำหรับบอก folder
 * @param originalFilename - ชื่อไฟล์ต้นฉบับ
 * @returns public URL ของไฟล์ที่อัปโหลด
 */
export async function uploadAttachmentToSupabase(
  base64: string,
  mimeType: string,
  userId: number,
  originalFilename?: string,
): Promise<string> {
  const ext = ALLOWED_MIME_TYPES[mimeType];
  if (!ext) throw new Error(`ไม่รองรับไฟล์ประเภท ${mimeType}`);

  const buffer = Buffer.from(base64, 'base64');
  const safeName = originalFilename
    ? originalFilename.replace(/[^a-zA-Z0-9.\-_]/g, '_').slice(0, 60)
    : `file.${ext}`;
  const fileName = `attachments/${userId}/${Date.now()}_${safeName}`;

  const { error } = await supabase.storage
    .from(bucketName)
    .upload(fileName, buffer, { contentType: mimeType, upsert: false });

  if (error) throw new Error(`อัปโหลดไม่สำเร็จ: ${error.message}`);

  const { data: publicData } = supabase.storage.from(bucketName).getPublicUrl(fileName);
  return publicData.publicUrl;
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
