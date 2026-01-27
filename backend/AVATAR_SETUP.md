# 📸 Avatar Upload - Supabase Storage Integration

## ✨ Features

- ✅ **รูปภาพผู้ใหญ่จริง** - ใช้ RandomUser API (ไม่มีรูปเด็ก)
- ✅ **เก็บใน Supabase Storage** - อัปโหลดไปยัง bucket อัตโนมัติ
- ✅ **Public URLs** - สามารถเข้าถึงรูปได้ทันทีผ่าน URL
- ✅ **Fallback Support** - ถ้า upload ล้มเหลว จะใช้ placeholder แทน

## 🔧 Setup

### 1. เพิ่ม Supabase Credentials ใน `.env`:

```env
SUPABASE_URL=https://opkkxhpchxvqcnjzxtcu.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
SUPABASE_BUCKET_NAME=easycheck-bucket
```

⚠️ **สำคัญ**: ใช้ **service_role key** ไม่ใช่ anon key เพราะต้องการสิทธิ์ในการอัปโหลดไฟล์

### 2. หา SUPABASE_SERVICE_ROLE_KEY:

1. ไปที่ [Supabase Dashboard](https://supabase.com/dashboard)
2. เลือก Project: `opkkxhpchxvqcnjzxtcu`
3. ไปที่ **Settings** → **API**
4. คัดลอก **service_role secret** key (ไม่ใช่ anon public)

⚠️ **คำเตือน**: service_role key มีสิทธิ์เต็มที่ ห้ามเผยแพร่หรือ commit ลง git!

### 3. สร้าง Storage Bucket (ถ้ายังไม่มี):

Bucket จะถูกสร้างอัตโนมัติเมื่อรัน seed script แต่ถ้าต้องการสร้างเอง:

1. ไปที่ **Storage** → **Create new bucket**
2. ชื่อ: `easycheck-bucket`
3. **Public bucket**: ✅ เปิด
4. **File size limit**: 5 MB
5. **Allowed MIME types**: `image/jpeg`, `image/png`, `image/webp`

## 🚀 Usage

### Seed Database พร้อมรูปจริง:

```bash
npm run seed
```

ระบบจะ:
1. ✅ ตรวจสอบ/สร้าง Supabase bucket
2. ✅ ดาวน์โหลดรูปจาก RandomUser API (รูปผู้ใหญ่)
3. ✅ อัปโหลดไป Supabase Storage
4. ✅ บันทึก URL ลง database

### ตัวอย่าง Avatar URLs:

```
https://opkkxhpchxvqcnjzxtcu.supabase.co/storage/v1/object/public/easycheck-bucket/avatars/SA001.jpg
https://opkkxhpchxvqcnjzxtcu.supabase.co/storage/v1/object/public/easycheck-bucket/avatars/BKK0001.jpg
```

## 📂 Storage Structure

```
easycheck-bucket/
└── avatars/
    ├── SA001.jpg      (Superadmin)
    ├── BKK0001.jpg    (Admin BKK)
    ├── CNX0001.jpg    (Admin CNX)
    ├── HKT0001.jpg    (Admin HKT)
    ├── BKK0002.jpg    (Manager)
    └── ...
```

## 🔐 Security Policies

Bucket ถูกตั้งค่าเป็น **Public** เพื่อให้สามารถเข้าถึงรูปได้โดยไม่ต้อง authenticate

ถ้าต้องการเพิ่มความปลอดภัย สามารถตั้ง RLS Policies:

```sql
-- อนุญาตให้ทุกคนอ่านได้
CREATE POLICY "Public Access"
ON storage.objects FOR SELECT
USING ( bucket_id = 'easycheck-bucket' );

-- อนุญาตให้เฉพาะ authenticated users อัปโหลดได้
CREATE POLICY "Authenticated users can upload avatars"
ON storage.objects FOR INSERT
WITH CHECK ( 
  bucket_id = 'easycheck-bucket' 
  AND auth.role() = 'authenticated' 
);
```

## 🛠️ Utility Functions

### อัปโหลดรูป:

```typescript
import { uploadAvatarToSupabase } from './src/utils/supabase-storage';

const avatarUrl = await uploadAvatarToSupabase('EMP001', 'male');
```

### ลบรูป:

```typescript
import { deleteAvatar } from './src/utils/supabase-storage';

await deleteAvatar('EMP001');
```

### ตรวจสอบ Bucket:

```typescript
import { ensureBucketExists } from './src/utils/supabase-storage';

await ensureBucketExists();
```

## 🐛 Troubleshooting

### Error: "Bucket not found"
- สร้าง bucket ชื่อ `easycheck-bucket` ใน Supabase Dashboard
- หรือรัน `ensureBucketExists()` เพื่อสร้างอัตโนมัติ

### Error: "Invalid API key"
- ตรวจสอบ `SUPABASE_ANON_KEY` ใน `.env`
- ใช้ **anon public** key ไม่ใช่ **service_role** key

### รูปไม่แสดง
- ตรวจสอบว่า bucket เป็น **Public**
- ลอง access URL โดยตรงในเบราว์เซอร์
- ตรวจสอบ CORS settings ใน Supabase

### Upload ช้า
- RandomUser API อาจช้าในบางครั้ง
- ระบบมี fallback ไปใช้ UI Avatars อัตโนมัติ

## 📝 Notes

- **RandomUser API** ให้รูปผู้ใหญ่เท่านั้น (age 18+)
- รูปจะถูก cache ด้วย `seed` parameter เพื่อให้ได้รูปเดิมเสมอ
- ขนาดรูป: **200x200 pixels** (large size)
- Format: **JPEG**

## 🔗 References

- [Supabase Storage Docs](https://supabase.com/docs/guides/storage)
- [RandomUser API](https://randomuser.me/)
- [Prisma Client Docs](https://www.prisma.io/docs/concepts/components/prisma-client)
