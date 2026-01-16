#🚀 EasyCheck

🛠 #Tech Stack
Frontend: Next.js, Tailwind CSS

Backend: Express.js, TypeScript

Database: Supabase via Prisma ORM

Tooling: Prettier, NVM (Node 22)

#📥 วิธีการติดตั้ง (Getting Started)
เพื่อให้เครื่องทุกคนรันได้เหมือนกัน ห้ามข้าม!
1. Clone Project
git clone https://github.com/EasyChecks/easychecks.git
cd easychecks

2. Set Node Version (สำคัญ!)
ใช้ nvm เพื่อให้เวอร์ชันตรงกัน:
nvm use
ถ้ายังไม่มีเวอร์ชัน 22 ให้รัน nvm install 22

3. Install Dependencies (ต้องลงทั้ง 3 จุด)
  1.Root: npm install (สำหรับ Prettier)
  2.Backend: cd backend && npm install
  3.Frontend: cd frontend && npm install

4. Setup Environment Variables (.env)
ก๊อปไฟล์ตัวอย่างมาสร้างไฟล์จริง:

ใน backend/: สร้างไฟล์ .env แล้วใส่ DATABASE_URL จาก Supabase (ในdiscord)
ใน frontend/: สร้างไฟล์ .env.local แล้วใส่ NEXT_PUBLIC_API_URL="ทางไปapi" (ในdiscord)

5. Generate Prisma Client
ในโฟลเดอร์ backend ให้รันคำสั่งนี้เพื่อให้โค้ดรู้จักฐานข้อมูล:
npx prisma generate

#🏃‍♂️ วิธีการรันโปรเจกต์
เปิด Terminal แยก 2 หน้าจอ:

Backend: cd backend && npm run dev (รันที่พอร์ต 3001)
Frontend: cd frontend && npm run dev (รันที่พอร์ต 3000)

#🚩 กฎเหล็กของทีม (Team Rules)
Case Sensitivity: ห้ามตั้งชื่อไฟล์หรือโฟลเดอร์ด้วยตัวพิมพ์ใหญ่ (ให้ใช้camelCase)
Format on Save: ลง Extension Prettier ใน VS Code และตั้งค่า Format on Save ทุกคน โค้ดจะได้ไม่เละ
Commit History: ก่อน Push งาน ให้รัน npm run format ที่ Root เสมอ
