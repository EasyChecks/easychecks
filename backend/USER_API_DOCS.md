# User Management API

## 📋 Overview

API สำหรับจัดการผู้ใช้ใช้ระบบ EasyCheck ครอบคลุม CRUD operations, bulk import จาก CSV, และ real-time updates ผ่าน WebSocket

## ✅ Features

- ✅ **Create User**: สร้างผู้ใช้ใหม่ทีละคน
- ✅ **Read Users**: ดึงรายการผู้ใช้แบบ pagination พร้อม filters
- ✅ **Read User**: ดึงข้อมูลผู้ใช้ตาม ID
- ✅ **Update User**: แก้ไขข้อมูลผู้ใช้
- ✅ **Delete User**: ลบผู้ใช้ (soft delete - เปลี่ยน status เป็น RESIGNED)
- ✅ **Bulk Import**: นำเข้าผู้ใช้จาก CSV
- ✅ **Get Statistics**: สถิติผู้ใช้สำหรับ dashboard
- ✅ **Get Avatar**: ดึงรูปโปรไฟล์จาก Supabase Storage
- ✅ **WebSocket**: Real-time updates ผ่าน WebSocket polling

## 🎯 API Endpoints

### User CRUD

```
POST   /api/users              - สร้างผู้ใช้ใหม่
GET    /api/users              - ดึงรายการผู้ใช้ทั้งหมด
GET    /api/users/:id          - ดึงข้อมูลผู้ใช้ตาม ID
PUT    /api/users/:id          - แก้ไขข้อมูลผู้ใช้
DELETE /api/users/:id          - ลบผู้ใช้ (soft delete)
```

### Bulk Import

```
POST   /api/users/bulk         - นำเข้าผู้ใช้จาก CSV
GET    /api/users/csv-template - ดาวน์โหลด CSV template
```

### Utilities

```
GET    /api/users/statistics      - ดึงสถิติผู้ใช้
GET    /api/users/:id/avatar      - ดึงรูปโปรไฟล์
```

### WebSocket

```
WS     /ws/attendance          - WebSocket endpoint สำหรับ real-time updates
```

## 📝 Request Examples

### 1. Create User

⚡ **หมายเหตุ**: `employeeId` จะถูก auto-generate จาก `branchCode` + running number เช่น BKK001, CNX002

```bash
POST /api/users
Content-Type: application/json

{
  "createdByUserId": 1,
  "creatorRole": "SUPERADMIN",
  "creatorBranchId": 1,
  "firstName": "สมชาย",
  "lastName": "ใจดี",
  "nickname": "ชาย",
  "gender": "MALE",
  "nationalId": "1234567890123",
  "emergent_tel": "0812345678",
  "emergent_name": "สมหญิง ใจดี",
  "emergent_relation": "ภรรยา",
  "phone": "0898765432",
  "email": "somchai@example.com",
  "password": "password123",
  "birthDate": "1990-01-15",
  "branchId": 1,
  "role": "USER"
}
```

**Required Fields:**
- `firstName`, `lastName` - ชื่อ-นามสกุล
- `gender` - MALE หรือ FEMALE
- `nationalId` - เลขบัตรประชาชน
- `emergent_tel`, `emergent_name`, `emergent_relation` - ข้อมูลติดต่อฉุกเฉิน
- `phone`, `email`, `password` - ข้อมูลติดต่อและรหัสผ่าน
- `birthDate` - วันเกิด (YYYY-MM-DD)
- `branchId` - รหัสสาขา (บังคับ - ใช้สร้าง employeeId)
```

### 2. Get Users (with filters)

```bash
GET /api/users?requesterId=1&requesterRole=SUPERADMIN&page=1&limit=20&search=สมชาย&status=ACTIVE
```

### 3. Update User

```bash
PUT /api/users/123
Content-Type: application/json

{
  "updatedByUserId": 1,
  "updaterRole": "ADMIN",
  "updaterBranchId": 1,
  "firstName": "สมชาย",
  "lastName": "ใจดี",
  "phone": "0898765433",
  "status": "ACTIVE"
}
```

### 4. Delete User

```bash
DELETE /api/users/123
Content-Type: application/json

{
  "deletedByUserId": 1,
  "deleterRole": "SUPERADMIN",
  "deleteReason": "ลาออกจากงาน"
}
```

### 5. Bulk Import

⚡ **หมายเหตุ**: `employeeId` จะถูก auto-generate จาก `branchCode` + running number

```bash
POST /api/users/bulk
Content-Type: application/json

{
  "createdByUserId": 1,
  "creatorRole": "SUPERADMIN",
  "creatorBranchId": 1,
  "csvData": "firstName,lastName,nickname,gender,nationalId,emergent_tel,emergent_name,emergent_relation,phone,email,password,birthDate,branchId,role\nสมชาย,ใจดี,ชาย,MALE,1234567890123,0812345678,สมหญิง ใจดี,ภรรยา,0898765432,somchai@example.com,password123,1990-01-15,1,USER"
}
```

**CSV Header (ลำดับ):**
```
firstName,lastName,nickname,gender,nationalId,emergent_tel,emergent_name,emergent_relation,phone,email,password,birthDate,branchId,role
```

**Required CSV Fields:**
- `firstName`, `lastName`, `gender`, `nationalId`
- `emergent_tel`, `emergent_name`, `emergent_relation`
- `phone`, `email`, `password`, `birthDate`, `branchId`
```

## 📊 Response Format

### Success Response

```json
{
  "success": true,
  "message": "สร้างผู้ใช้เรียบร้อยแล้ว",
  "data": {
    "userId": 123,
    "employeeId": "BKK042",
    "firstName": "สมชาย",
    "lastName": "ใจดี",
    "nickname": "ชาย",
    "gender": "MALE",
    "nationalId": "1234567890123",
    "emergent_tel": "0812345678",
    "emergent_name": "สมหญิง ใจดี",
    "emergent_relation": "ภรรยา",
    "phone": "0898765432",
    "email": "somchai@example.com",
    "avatarUrl": "https://supabase.co/storage/v1/object/public/easycheck-bucket/avatars/BKK042.jpg",
    "birthDate": "1990-01-15",
    "branchId": 1,
    "role": "USER",
    "status": "ACTIVE",
    "createdAt": "2026-02-03T10:00:00+07:00",
    "updatedAt": "2026-02-03T10:00:00+07:00",
    "branch": {
      "branchId": 1,
      "name": "สาขากรุงเทพ",
      "code": "BKK"
    }
  }
}
```

### Error Response

```json
{
  "success": false,
  "error": "รหัสพนักงานนี้มีอยู่ในระบบแล้ว"
}
```

### Bulk Import Response

```json
{
  "success": true,
  "message": "นำเข้าข้อมูลสำเร็จ 5 รายการ, ล้มเหลว 2 รายการ",
  "data": {
    "success": 5,
    "failed": 2,
    "errors": [
      {
        "row": 3,
        "error": "อีเมลซ้ำ"
      },
      {
        "row": 5,
        "error": "branchId ไม่ถูกต้อง"
      }
    ],
    "createdUsers": [
      {
        "userId": 124,
        "employeeId": "BKK042",
        "firstName": "สมชาย",
        "lastName": "ใจดี"
      }
    ]
  }
}
```

## 🎮 WebSocket Events

เมื่อมีการ CUD users จะมี broadcast ผ่าน WebSocket:

### User Created

```json
{
  "type": "user_update",
  "action": "CREATE",
  "data": { /* user object */ },
  "timestamp": "2026-02-03T10:00:00.000Z"
}
```

### User Updated

```json
{
  "type": "user_update",
  "action": "UPDATE",
  "data": { /* updated user object */ },
  "timestamp": "2026-02-03T10:00:00.000Z"
}
```

### User Deleted

```json
{
  "type": "user_update",
  "action": "DELETE",
  "data": {
    "userId": 123,
    "status": "RESIGNED",
    "deleteReason": "ลาออกจากงาน"
  },
  "timestamp": "2026-02-03T10:00:00.000Z"
}
```

### Bulk Created

```json
{
  "type": "user_update",
  "action": "BULK_CREATE",
  "data": {
    "success": 5,
    "failed": 2,
    "createdUsers": [ /* array of created users */ ]
  },
  "timestamp": "2026-02-03T10:00:00.000Z"
}
```

## 🔒 Permissions (จะเปิดใช้หลังจาก Auth เสร็จ)

- **SuperAdmin**: CRUD ได้ทุกสาขา
- **Admin**: CRUD ได้เฉพาะสาขาตัวเอง
- **User**: ดูได้เฉพาะข้อมูลตัวเอง

## 📄 CSV Format

CSV ต้องมี header และข้อมูลดังนี้:

```csv
employeeId,firstName,lastName,nickname,nationalId,emergent_tel,emergent_name,emergent_relation,phone,email,password,birthDate,branchId,role,avatarGender
EMP001,สมชาย,ใจดี,ชาย,1234567890123,0812345678,สมหญิง ใจดี,ภรรยา,0898765432,somchai@example.com,password123,1990-01-15,1,USER,male
EMP002,สมหญิง,รักดี,หญิง,1234567890124,0812345679,สมชาย รักดี,สามี,0898765433,somying@example.com,password456,1992-05-20,1,USER,female
```

### Required Fields

- `employeeId` - รหัสพนักงาน (unique)
- `firstName` - ชื่อ
- `lastName` - นามสกุล
- `nationalId` - เลขบัตรประชาชน (unique, 13 หลัก)
- `emergent_tel` - เบอร์ติดต่อฉุกเฉิน
- `emergent_name` - ชื่อผู้ติดต่อฉุกเฉิน
- `emergent_relation` - ความสัมพันธ์
- `phone` - เบอร์โทร
- `email` - อีเมล (unique)
- `password` - รหัสผ่าน

### Optional Fields

- `nickname` - ชื่อเล่น
- `birthDate` - วันเกิด (YYYY-MM-DD)
- `branchId` - รหัสสาขา
- `role` - SUPERADMIN, ADMIN, MANAGER, USER (default: USER)
- `avatarGender` - male หรือ female (สำหรับ auto avatar)

## 🖼️ Avatar Management

- รูปโปรไฟล์จะถูกอัปโหลดไปที่ Supabase Storage bucket
- ใช้ RandomUser API สำหรับสร้างรูปตัวอย่าง
- หากไม่มีรูปจะใช้ UI Avatars เป็น fallback
- Path: `avatars/{employeeId}.jpg`

## 📦 Dependencies

- `@supabase/supabase-js` - Supabase client สำหรับ avatar storage
- `bcrypt` - Password hashing
- `csv-parse` - Parse CSV data
- `ws` - WebSocket server

## 🧪 Testing

ดาวน์โหลด CSV template:

```bash
GET /api/users/csv-template
```

## 🔧 Implementation Details

### Files Created/Modified

1. **src/services/user.service.ts** - User business logic
2. **src/controllers/user.controller.ts** - User request handlers
3. **src/routes/user.routes.ts** - User API routes
4. **src/routes/index.ts** - Added user routes
5. **src/websocket/attendance.websocket.ts** - Added user broadcast

### Features

- ✅ Password hashing with bcrypt
- ✅ Avatar upload to Supabase Storage
- ✅ CSV bulk import with validation
- ✅ Audit logging
- ✅ Branch-based access control
- ✅ Pagination
- ✅ Search filters
- ✅ Soft delete
- ✅ Real-time WebSocket updates

## 🚨 Security Notes

- Passwords are hashed with bcrypt (10 salt rounds)
- SuperAdmin cannot be deleted by non-SuperAdmin
- Users cannot delete themselves
- Admin can only manage users in their branch
- All operations are logged in audit_logs table
