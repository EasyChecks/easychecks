# EasyCheck - ระบบบันทึกเวลาการทำงาน

## 🔐 ข้อมูลเข้าสู่ระบบ (Login Credentials)

### Admin

- USERNAME : `ADMBKK1010001`
- PASSWORD : `Admin@GGS2024!`

### SuperAdmin

- USERNAME : `ADMBKK1010002`
- PASSWORD : `SuperAdmin@GGS2024!`

### Manager

- USERNAME : `BKK1010003`
- PASSWORD : `1100243657224`

### User

- USERNAME : `BKK1010001`
- PASSWORD : `1209876543210`

---

## ⚙️ การตั้งค่าระบบ (Configuration)

ระบบใช้ **Environment Variables** เพื่อให้สามารถปรับแต่งการทำงานได้โดยไม่ต้องแก้ไข code

### 🚀 วิธีการใช้งาน

1. **Development (Local)**

   ```bash
   # ใช้ไฟล์ .env
   npm run dev
   ```

2. **Production Deployment**

   ```bash
   # แก้ไขค่าใน .env สำหรับ production
   VITE_ENABLE_MOCK_DATA=false
   VITE_API_URL=https://api.yourproduction.com/api

   # Build
   npm run build
   ```

### 📸 การขออนุญาตกล้อง

ระบบจะขออนุญาตใช้กล้องก่อนเข้าหน้าถ่ายรูปเช็คอิน/เช็คเอาท์ โดยอัตโนมัติ

**คุณสมบัติ:**

- ตรวจสอบความรองรับของเบราว์เซอร์
- แสดง error message ที่ชัดเจน (ไม่อนุญาต, ไม่พบกล้อง, กล้องถูกใช้งานอยู่)
- สามารถปิดการตรวจสอบผ่าน `VITE_ENABLE_CAMERA_CHECK=false`

### 📍 การตรวจสอบตำแหน่ง GPS

ระบบตรวจสอบว่าผู้ใช้อยู่ในพื้นที่อนุญาตหรือไม่ก่อนเช็คอิน

**การปรับแต่ง:**

- `VITE_GPS_HIGH_ACCURACY=false` → เร็วกว่า แต่แม่นยำน้อยกว่า (แนะนำ)
- `VITE_GPS_HIGH_ACCURACY=true` → ช้ากว่า แต่แม่นยำมากกว่า
- `VITE_GPS_TIMEOUT=5000` → รอไม่เกิน 5 วินาที

---

## 🛠️ Technologies

- **React 18** - UI Framework
- **Vite** - Build Tool
- **React Router** - Routing
- **Tailwind CSS** - Styling
- **Geolocation API** - GPS Tracking
- **MediaDevices API** - Camera Access
- **StorageEvent API** - Multi-tab Sync
- **localStorage** - Client-side Storage

---

## 📦 Installation

```bash
# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Start development server
npm run dev
```

---

## 🔥 Features

- ✅ Multi-tab synchronization (แท็บ Admin ซิงค์กับ Admin, User ซิงค์กับ User)
- ✅ Persistent session (login ครั้งเดียวไม่ต้อง login ใหม่)
- ✅ Real-time data sync (Admin แก้ข้อมูล User เห็นทันที)
- ✅ GPS-based check-in/out (ตรวจสอบพื้นที่อนุญาต)
- ✅ Camera permission request (ขออนุญาตกล้องก่อนถ่ายรูป)
- ✅ Dynamic configuration (ปรับแต่งผ่าน .env ไม่ต้องแก้ code)
- ✅ Mock data system (ทดสอบโดยไม่ต้องมี backend)

---

## 📄 License

MIT# Force rebuild
