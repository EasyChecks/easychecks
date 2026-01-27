-- ========================================
-- Supabase Storage RLS Policies
-- สำหรับ bucket: easycheck-bucket
-- ========================================

-- 1. อนุญาตให้ทุกคนอ่านไฟล์ได้ (Public Read)
CREATE POLICY "Public Access - Anyone can view avatars"
ON storage.objects FOR SELECT
USING ( bucket_id = 'easycheck-bucket' );

-- 2. อนุญาตให้ Authenticated users อัปโหลดได้
CREATE POLICY "Authenticated users can upload avatars"
ON storage.objects FOR INSERT
WITH CHECK ( 
  bucket_id = 'easycheck-bucket'
);

-- 3. อนุญาตให้ Authenticated users อัปเดตไฟล์ของตัวเองได้
CREATE POLICY "Authenticated users can update avatars"
ON storage.objects FOR UPDATE
USING ( bucket_id = 'easycheck-bucket' )
WITH CHECK ( bucket_id = 'easycheck-bucket' );

-- 4. อนุญาตให้ Authenticated users ลบไฟล์ได้
CREATE POLICY "Authenticated users can delete avatars"
ON storage.objects FOR DELETE
USING ( bucket_id = 'easycheck-bucket' );

-- ========================================
-- ตรวจสอบ policies ที่สร้างแล้ว
-- ========================================
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies
WHERE schemaname = 'storage'
AND tablename = 'objects'
ORDER BY policyname;
