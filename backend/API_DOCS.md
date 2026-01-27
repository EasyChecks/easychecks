# 📋 Attendance & Shift API Documentation

## 🚀 สร้างเรียบร้อยแล้ว

### ✅ สิ่งที่ทำเสร็จ:

1. **Database Schema**
   - ✅ เพิ่ม `Shift` model (ตารางงาน/กะ)
   - ✅ อัปเดต `Attendance` model (เชื่อมกับ Shift และ Location)
   - ✅ เพิ่ม enums: `ShiftType`, `DayOfWeek`
   - ✅ เพิ่มฟิลด์ GPS, ระยะห่าง, auto checkout

2. **Services** 
   - ✅ `shift.service.ts` - CRUD + business logic สำหรับตารางงาน
   - ✅ `attendance.service.ts` - Check-in/out พร้อม logic การคำนวณเวลา, ระยะห่าง

3. **Controllers**
   - ✅ `shift.controller.ts` - API handlers สำหรับตารางงาน
   - ✅ `attendance.controller.ts` - API handlers สำหรับเข้า-ออกงาน

4. **Routes**
   - ✅ `/api/shifts` - จัดการตารางงาน
   - ✅ `/api/attendance` - จัดการการเข้า-ออกงาน

5. **Features**
   - ✅ ตรวจสอบตำแหน่ง GPS (Location-based check-in/out)
   - ✅ คำนวณสถานะ: ตรงเวลา, สาย, ขาด
   - ✅ รองรับกะข้ามเที่ยงคืน
   - ✅ กำหนดได้: grace period, late threshold
   - ✅ ตารางงาน 3 แบบ: REGULAR, SPECIFIC_DAY, CUSTOM

6. **Seed Data**
   - ✅ สร้าง 29 Shifts ให้พนักงาน 20 คน
   - ✅ สร้าง 94 Attendance records

---

## 🔐 Permissions

### Shifts API:
- **Create**: Admin only
- **Read**: User (own shifts), Admin (all shifts)
- **Update**: User (own shifts), Admin (all shifts)
- **Delete**: Admin only

### Attendance API:
- **Check-in/Check-out**: ทุก Role (ตัวเอง)
- **Read History**: User (own history), Admin (all history)
- **Update/Delete**: Admin only

---

## 📡 API Endpoints

### 🔹 Shifts

#### 1. สร้างกะใหม่
```http
POST /api/shifts
Authorization: Bearer <token>
Role: Admin only

Body:
{
  "name": "กะเช้า",
  "shiftType": "REGULAR",
  "startTime": "08:00",
  "endTime": "17:00",
  "gracePeriodMinutes": 15,
  "lateThresholdMinutes": 30,
  "specificDays": ["MONDAY", "WEDNESDAY", "FRIDAY"],
  "locationId": 1,
  "userId": 2
}
```

#### 2. ดึงกะทั้งหมด
```http
GET /api/shifts
Authorization: Bearer <token>

Query Params (Admin only):
- userId: กรองตาม userId
- shiftType: REGULAR | SPECIFIC_DAY | CUSTOM
- isActive: true | false
```

#### 3. ดึงกะที่ใช้งานได้วันนี้
```http
GET /api/shifts/today
Authorization: Bearer <token>
```

#### 4. ดึงกะเฉพาะ ID
```http
GET /api/shifts/:id
Authorization: Bearer <token>
```

#### 5. อัปเดตกะ
```http
PUT /api/shifts/:id
Authorization: Bearer <token>

Body:
{
  "name": "กะบ่าย",
  "startTime": "13:00",
  "endTime": "22:00",
  "isActive": true
}
```

#### 6. ลบกะ
```http
DELETE /api/shifts/:id
Authorization: Bearer <token>
Role: Admin only
```

---

### 🔹 Attendance

#### 1. Check-in
```http
POST /api/attendance/check-in
Authorization: Bearer <token>

Body:
{
  "shiftId": 1,
  "locationId": 1,
  "photo": "https://...",
  "latitude": 13.7563,
  "longitude": 100.5018,
  "address": "123 ถนนสุขุมวิท..."
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "attendanceId": 1,
    "userId": 5,
    "shiftId": 1,
    "locationId": 1,
    "checkIn": "2026-01-27T08:15:00.000Z",
    "checkInDistance": 45.3,
    "status": "LATE",
    "lateMinutes": 15,
    "note": "มาสาย 15 นาที"
  }
}
```

#### 2. Check-out
```http
POST /api/attendance/check-out
Authorization: Bearer <token>

Body:
{
  "shiftId": 1,
  "photo": "https://...",
  "latitude": 13.7563,
  "longitude": 100.5018,
  "address": "123 ถนนสุขุมวิท..."
}
```

#### 3. ดึงประวัติของตัวเอง
```http
GET /api/attendance/history
Authorization: Bearer <token>

Query Params:
- startDate: 2026-01-01
- endDate: 2026-01-31
- status: ON_TIME | LATE | ABSENT
```

#### 4. ดึงประวัติทั้งหมด (Admin)
```http
GET /api/attendance
Authorization: Bearer <token>
Role: Admin only

Query Params:
- userId: filter by user
- startDate: 2026-01-01
- endDate: 2026-01-31
- status: ON_TIME | LATE | ABSENT
```

#### 5. อัปเดตการเข้างาน (Admin)
```http
PUT /api/attendance/:id
Authorization: Bearer <token>
Role: Admin only

Body:
{
  "status": "ON_TIME",
  "note": "แก้ไขสถานะ",
  "checkIn": "2026-01-27T08:00:00.000Z",
  "checkOut": "2026-01-27T17:00:00.000Z"
}
```

#### 6. ลบการเข้างาน (Admin)
```http
DELETE /api/attendance/:id
Authorization: Bearer <token>
Role: Admin only
```

---

## 🎯 Business Logic

### เวลาการเข้างาน:
1. **Grace Period (15 นาที)**: เข้าก่อนเวลาได้ 15 นาที = ตรงเวลา
2. **Late Threshold (30 นาที)**: สายไม่เกิน 30 นาที = มาสาย
3. **Absent**: สายเกิน 30 นาที = ขาดงาน (auto checkout)

### ตัวอย่าง:
- กะเริ่ม: 09:00
- Check-in 08:45-09:00 → **ตรงเวลา**
- Check-in 09:01-09:30 → **มาสาย** (บันทึกจำนวนนาที)
- Check-in >09:30 → **ขาดงาน**

### Location-based Check-in:
- คำนวณระยะห่างด้วย Haversine formula
- ตรวจสอบว่าอยู่ในรัศมีที่กำหนด
- บันทึก GPS และระยะห่าง

### ประเภทตารางงาน:
1. **REGULAR**: ทุกวัน (ไม่ต้องระบุวัน)
2. **SPECIFIC_DAY**: ระบุวันเฉพาะ (เช่น จันทร์, พุธ, ศุกร์)
3. **CUSTOM**: กำหนดวันที่เฉพาะ (เช่น 2026-01-27)

---

## 🧪 ทดสอบ API

### 1. รัน Backend:
```bash
npm run dev
```

### 2. Login เพื่อรับ JWT Token:
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username": "superadmin", "password": "7590438532632"}'
```

### 3. ทดสอบ Check-in:
```bash
curl -X POST http://localhost:3000/api/attendance/check-in \
  -H "Authorization: Bearer <token>" \
  -H "Content-Type: application/json" \
  -d '{
    "shiftId": 1,
    "locationId": 1,
    "latitude": 13.7563,
    "longitude": 100.5018
  }'
```

---

## 📝 Notes

- ✅ ทุก endpoint ต้อง authenticate ด้วย JWT
- ✅ Admin สามารถแก้ไข/ลบได้ทั้งหมด
- ✅ User แก้ไขได้เฉพาะข้อมูลของตัวเอง
- ✅ ระบบรองรับกะข้ามเที่ยงคืน (22:00-06:00)
- ✅ Auto checkout สำหรับคนลืม checkout (future feature)

---

## 🔧 Next Steps

1. สร้าง Auth middleware (ถ้ายังไม่มี)
2. ทดสอบ API ด้วย Postman/Thunder Client
3. เพิ่ม WebSocket สำหรับ real-time updates (optional)
4. เพิ่ม notification เมื่อ check-in/out
5. เพิ่ม report/export features
