# คู่มือ Deploy Backend ไปยัง Render

## ขั้นตอนการ Deploy

### 1. เตรียม Repository
- ตรวจสอบว่าโค้ดทั้งหมดถูก commit และ push ไปยัง GitHub/GitLab แล้ว
- แน่ใจว่าไฟล์ `render.yaml` อยู่ที่ root ของ repository

### 2. สร้าง Account ที่ Render.com
1. ไปที่ https://render.com
2. สมัครสมาชิก (แนะนำใช้ GitHub account เพื่อเชื่อมต่อง่าย)
3. ยืนยัน email

### 3. เตรียม Database (Supabase)
- คุณใช้ Supabase อยู่แล้ว ตรวจสอบว่ามี:
  - `DATABASE_URL` (Connection string)
  - `SUPABASE_URL`
  - `SUPABASE_ANON_KEY`
  - `SUPABASE_SERVICE_ROLE_KEY`

### 4. Deploy ด้วย Blueprint (render.yaml)

**วิธีที่ 1: ใช้ Blueprint (แนะนำ)**
1. เข้า https://dashboard.render.com
2. คลิก "New" → "Blueprint"
3. เชื่อมต่อ Repository ของคุณ
4. Render จะอ่าน `render.yaml` อัตโนมัติ
5. ตั้งค่า Environment Variables:
   ```
   DATABASE_URL=postgresql://...your-supabase-connection-string...
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   NODE_ENV=production
   ```
6. คลิก "Apply" เพื่อเริ่ม deploy

**วิธีที่ 2: Manual Setup**
1. เข้า https://dashboard.render.com
2. คลิก "New" → "Web Service"
3. เชื่อมต่อ Repository ของคุณ
4. ตั้งค่าดังนี้:
   - **Name:** easycheck-backend
   - **Region:** Singapore
   - **Branch:** main (หรือ branch ที่คุณใช้)
   - **Root Directory:** backend
   - **Runtime:** Node
   - **Build Command:** `npm install && npm run build`
   - **Start Command:** `npm start`
   - **Instance Type:** Free

5. เพิ่ม Environment Variables (เหมือนวิธีที่ 1)
6. คลิก "Create Web Service"

### 5. รอ Deploy เสร็จ
- Render จะ install dependencies และ build โค้ด
- ดู logs เพื่อตรวจสอบว่า deploy สำเร็จ
- URL ของ API จะอยู่ในรูปแบบ: `https://easycheck-backend.onrender.com`

### 6. ทดสอบ API
```bash
curl https://your-app-name.onrender.com/api
```

### 7. อัพเดต Frontend
อัพเดต API URL ใน frontend ให้ชี้ไปที่ Render URL:
- ไฟล์: `frontend/src/services/*` หรือ configuration file
- เปลี่ยน `http://localhost:3000` → `https://easycheck-backend.onrender.com`

## Environment Variables ที่ต้องการ

| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | PostgreSQL connection string | `postgresql://user:pass@host:5432/db` |
| `SUPABASE_URL` | Supabase project URL | `https://xxx.supabase.co` |
| `SUPABASE_ANON_KEY` | Supabase anon key | `eyJ...` |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase service role key | `eyJ...` |
| `NODE_ENV` | Environment | `production` |
| `PORT` | Server port (Render จัดการให้) | `3000` |

## ปัญหาที่อาจเจอและวิธีแก้

### 1. Build Failed
- ตรวจสอบ logs ใน Render Dashboard
- แน่ใจว่า `package.json` มี build script
- ลอง build ใน local ก่อน: `cd backend && npm run build`

### 2. Database Connection Error
- ตรวจสอบ `DATABASE_URL` ว่าถูกต้อง
- ตรวจสอบว่า Supabase database อนุญาตการเชื่อมต่อจาก Render IP

### 3. WebSocket Issues
- Render Free tier รองรับ WebSocket แต่อาจมี limitations
- พิจารณาใช้ Supabase Realtime แทน WebSocket โดยตรง

### 4. Cold Start (สำหรับ Free tier)
- Free instance จะ sleep หลังจากไม่มีการใช้งาน 15 นาที
- การ request แรกจะใช้เวลานานขึ้น (10-30 วินาที)
- วิธีแก้: อัพเกรดเป็น Paid plan หรือใช้ cron job ping API ทุก 14 นาที

## ขั้นตอนการอัพเดตโค้ด

เมื่อมีการเปลี่ยนแปลงโค้ด:
1. `git add .`
2. `git commit -m "update message"`
3. `git push`
4. Render จะ auto-deploy ใหม่อัตโนมัติ

## Resources
- Render Documentation: https://render.com/docs
- Render Node.js Guide: https://render.com/docs/deploy-node-express-app
- Render Environment Variables: https://render.com/docs/environment-variables

## Notes
- Render Free tier มี limitations:
  - 750 compute hours/month
  - Instance จะ sleep หลังไม่ใช้งาน 15 นาที
  - Bandwidth 100GB/month
- พิจารณาอัพเกรดเป็น Paid plan ($7/month) สำหรับ production use
