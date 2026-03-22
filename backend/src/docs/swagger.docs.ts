/**
 * ============================================================
 * 📚 Swagger JSDoc — API Documentation
 *
 * ทำไมแยก docs ออกมาเป็นไฟล์นี้?
 * เพราะถ้าใส่ JSDoc ไว้ใน routes หรือ controller จะทำให้
 * โค้ดหลักอ่านยากมาก แยกออกมาให้ docs อยู่ที่เดียวบำรุงรักษาง่ายกว่า
 *
 * ไฟล์นี้ไม่มีโค้ด runtime จริง — มีแค่ JSDoc comment
 * swagger-jsdoc จะ parse comment เหล่านี้สร้าง OpenAPI 3.0 spec
 * ============================================================
 */

/**
 * @swagger
 * tags:
 *   - name: Auth
 *     description: |
 *       API สำหรับการยืนยันตัวตน (Authentication)
 *
 *       **Flow การ Login:**
 *       1. POST /api/auth/login → ได้ `accessToken` + `refreshToken`
 *       2. ใส่ `accessToken` ใน `Authorization: Bearer <token>` ทุก request
 *       3. เมื่อ `accessToken` หมดอายุ → POST /api/auth/refresh ด้วย `refreshToken`
 *       4. POST /api/auth/logout เมื่อต้องการออกจากระบบ
 *
 *       **Token Expiry:**
 *       - `accessToken`: 30 นาที (JWT — signed ด้วย HS256)
 *       - `refreshToken`: 7 วัน
 *
 *       **ข้อมูล Login:**
 *       - username: `employeeId` เช่น BKK001
 *       - password: `nationalId` (เลขบัตรประชาชน) — รหัสเริ่มต้นที่ระบบ hash ไว้ตั้งแต่สร้าง account
 *       - เมื่อเปลี่ยนรหัสแล้ว → ใช้รหัสใหม่เท่านั้น (nationalId ใช้ไม่ได้อีก)
 *
 *       **Dual Login (Admin/SuperAdmin):**
 *       - ใช้ `adminPassword` → เข้าหน้า Admin/SuperAdmin Dashboard
 *       - ใช้รหัสปกติ → เข้าหน้า User Dashboard
 *   - name: Users
 *     description: |
 *       API สำหรับจัดการผู้ใช้/พนักงาน
 *
 *       **ทำไมต้องมี role-based access?**
 *       ข้อมูลพนักงานมีข้อมูลส่วนตัว (PDPA) ต้องจำกัดว่าใครเห็นข้อมูลใคร
 *
 *       **สิทธิ์การเข้าถึง:**
 *       - SuperAdmin: CRUD ได้ทุกสาขา  
 *       - Admin: CRUD ได้เฉพาะสาขาตัวเอง
 *       - User: ดูได้เฉพาะข้อมูลตัวเอง
 *
 *       **employeeId Auto-Generate:**
 *       ระบบสร้างอัตโนมัติจาก `branchCode + running number` เช่น BKK001, CNX002
 *   - name: Shifts
 *     description: |
 *       API สำหรับจัดการตารางงาน/กะ
 *
 *       **ทำไมต้องมีระบบกะ?**
 *       แต่ละพนักงานอาจมีเวลาเข้า-ออกงานต่างกัน (กะเช้า/กะบ่าย/กะดึก)
 *       ระบบกะทำให้คำนวณ ON_TIME/LATE/ABSENT ได้อัตโนมัติตาม grace period
 *       และ late threshold ที่ Admin ตั้งไว้ต่อกะ
 *
 *       **สิทธิ์การเข้าถึง:**
 *       - SuperAdmin: จัดการได้ทุกสาขา
 *       - Admin: จัดการได้เฉพาะสาขาตัวเอง
 *       - User: ดูได้เฉพาะกะของตัวเอง
 *   - name: Attendance
 *     description: |
 *       API สำหรับการเข้างาน-ออกงาน (Check-in / Check-out)
 *
 *       **ทำไมต้อง Check-in ด้วย GPS?**
 *       เพื่อยืนยันว่าพนักงานอยู่ในพื้นที่จริง ป้องกันการ check-in แทน
 *       ระบบจะคำนวณระยะห่างจากพิกัดที่ส่งมากับพิกัด location
 *       ถ้าเกิน radius ที่กำหนดจะไม่อนุญาต
 *
 *       **สิทธิ์การเข้าถึง:**
 *       - ทุก role: check-in/check-out ได้
 *       - Admin/SuperAdmin: ดู/แก้ไข/ลบ attendance ทุกคน
 *   - name: Dashboard
 *     description: |
 *       📊 API สำหรับหน้า Admin Dashboard
 *
 *       **ทำไมต้องมี Dashboard API?**
 *       Admin/SuperAdmin ต้องเห็นภาพรวมข้อมูลพนักงาน ‒ สถิติเข้างาน,
 *       ตำแหน่งสาขาบนแผนที่, พนักงาน check-in นอกพื้นที่ ฯลฯ
 *       โดย aggregate ข้อมูลทั้งหมดจาก attendance, branch, user
 *
 *       **สิทธิ์การเข้าถึง:**
 *       - **Admin**: เห็นเฉพาะข้อมูลสาขาตัวเอง
 *       - **SuperAdmin**: เห็นทั้งองค์กร (สามารถ filter branchId ได้)
 *
 *       **Endpoints (4 endpoints):**
 *       | Endpoint | ใช้ทำอะไร |
 *       |----------|----------|
 *       | attendance-summary | Donut Chart สรุปสถานะวันนี้ |
 *       | employees-today | ตารางพนักงาน + สถานะ check-in |
 *       | branches-map | Map pins ของแต่ละสาขา |
 *       | location-events | Alert พนักงาน check-in นอกพื้นที่ |
 *   - name: Events
 *     description: |
 *       🎉 API สำหรับจัดการกิจกรรม/อีเวนต์
 *
 *       **ทำไมต้องมีระบบ Event?**
 *       องค์กรจัดกิจกรรมต่าง ๆ เช่น ประชุม, อบรม, กิจกรรมบริษัท
 *       ต้องกำหนดผู้เข้าร่วมตามประเภท (ทุกคน, รายบุคคล, ตามสาขา, ตาม role)
 *       และต้อง track สถิติกิจกรรมทั้งหมด
 *
 *       **participantType:**
 *       - `ALL` — ทุกคนเข้าร่วมได้ (ไม่ต้องระบุ participants)
 *       - `INDIVIDUAL` — ระบุ userIds
 *       - `BRANCH` — ระบุ branchIds
 *       - `ROLE` — ระบุ roles
 *
 *       **สิทธิ์การเข้าถึง:**
 *       - **Admin/SuperAdmin**: สร้าง, แก้ไข, ลบ, กู้คืน, ดูสถิติ
 *       - **ทุก role (authenticated)**: ดูรายการ, ดูกิจกรรมตัวเอง
 *
 *       **WebSocket:**
 *       เชื่อมต่อ `ws://HOST/ws/events` สำหรับ real-time event updates
 *   - name: Download Report
 *     description: |
 *       📥 API สำหรับดาวน์โหลดรายงาน (Excel)
 *
 *       **ทำไมต้องมี Download API?**
 *       Admin ต้องดาวน์โหลดรายงาน attendance/shift เป็นไฟล์เพื่อนำไปวิเคราะห์
 *       หรือพิมพ์เป็นเอกสาร พร้อมเก็บ audit log ว่าใครดาวน์โหลดอะไร เมื่อไร
 *
 *       **รูปแบบรายงานที่รองรับ:**
 *       - `excel` (.xlsx) — สำหรับวิเคราะห์ข้อมูลใน spreadsheet
 *      
 *
 *       **ประเภทรายงาน:**
 *       - `attendance` — ประวัติเข้า-ออกงาน
 *       - `shift` — ข้อมูลกะงาน
 *
 *       **สิทธิ์การเข้าถึง:**
 *       - **Admin**: ดาวน์โหลดเฉพาะสาขาตัวเอง
 *       - **SuperAdmin**: ดาวน์โหลดได้ทั้งองค์กร
 *   - name: Announcements
 *     description: |
 *       📢 API สำหรับจัดการประกาศ/ข่าวสารภายในองค์กร
 *
 *       **ทำไมต้องมีระบบประกาศ?**
 *       Admin/SuperAdmin ต้องสื่อสารกับพนักงานแบบ broadcast
 *       โดยไม่ต้องส่ง LINE/email แยกทีละคน สามารถกำหนดกลุ่มเป้าหมายได้
 *
 *       **Status Flow:**
 *       ```
 *       DRAFT → (send) → SENT
 *       ```
 *       เมื่อ SENT แล้วแก้ไขไม่ได้ (immutable)
 *
 *       **Targeting:**
 *       - `targetRoles` ว่าง = ส่งหา ทุก role
 *       - `targetBranchIds` ว่าง = ส่ง ทุกสาขา
 *       - ADMIN จะถูกจำกัดให้ส่งได้แค่ใน branch ตัวเองเสมอ ไม่ว่าจะตั้งค่าอะไร
 *       - ADMIN ไม่สามารถส่งให้ SUPERADMIN ได้
 *
 *       **Email:**
 *       ระบบจะส่งอีเมลอัตโนมัติผ่าน Resend ทุกครั้งที่มีการ Send (fire-and-forget)
 *
 *       **Soft Delete:**
 *       ประกาศที่ถูกลบจะยังคงอยู่ใน DB แต่มี `deletedAt` — ไม่ปรากฏใน list
 */

/**
 * @swagger
 * /api/shifts:
 *   post:
 *     summary: สร้างกะงานใหม่ (Admin/SuperAdmin only)
 *     description: |
 *       สร้างตารางงานใหม่ให้พนักงาน พร้อมกำหนด grace period และ late threshold
 *       รองรับทั้งการสร้างให้พนักงาน 1 คน (`userId`) หรือหลายคน (`userIds`) ใน endpoint เดียว
 *
 *       **ทำไม grace period และ late threshold ถึงเก็บต่อกะ?**
 *       แต่ละกะอาจมีนโยบายเวลาต่างกัน เช่น กะดึกอาจยืดหยุ่นกว่ากะเช้า
 *       ค่า default: gracePeriodMinutes=15, lateThresholdMinutes=30
 *
 *       **shiftType:**
 *       - `REGULAR` — ใช้ทุกวัน ไม่กำหนดวัน
 *       - `SPECIFIC_DAY` — ต้องระบุ specificDays เช่น ["MONDAY","FRIDAY"]
 *       - `CUSTOM` — ต้องระบุ customDate วันเดียว เช่น "2026-03-15"
 *
 *       **replaceExisting (optional):**
 *       ถ้าพนักงานมี active shift อยู่แล้ว ระบบจะตอบ 409 ก่อน
 *       และต้องส่ง `replaceExisting=true` เพื่อยืนยันให้แทนที่กะเดิม
 *
 *       **userId vs userIds:**
 *       - ส่ง `userId` = สร้างกะเดียว
 *       - ส่ง `userIds` = สร้างหลายคนแบบ all-or-nothing
 *         (ถ้าคนใดคนหนึ่งไม่ผ่าน validation จะ rollback ทั้งคำขอ)
 *
 *       **แนะนำสำหรับ Try it out:**
 *       ใส่ `locationId` ทุกครั้ง (ค่าเดโมเริ่มต้น: 151)
 *     tags:
 *       - Shifts
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateShiftRequest'
 *           examples:
 *             กะเช้าประจำ:
 *               summary: กะเช้า REGULAR ทุกวัน
 *               value:
 *                 name: "กะเช้า"
 *                 shiftType: "REGULAR"
 *                 startTime: "08:00"
 *                 endTime: "17:00"
 *                 locationId: 151
 *                 gracePeriodMinutes: 15
 *                 lateThresholdMinutes: 30
 *                 userId: 151
 *                 replaceExisting: true
 *             กะเฉพาะวัน:
 *               summary: กะจันทร์-ศุกร์ SPECIFIC_DAY
 *               value:
 *                 name: "กะจันทร์-ศุกร์"
 *                 shiftType: "SPECIFIC_DAY"
 *                 startTime: "09:00"
 *                 endTime: "18:00"
 *                 locationId: 151
 *                 specificDays: ["MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY"]
 *                 userId: 151
 *             กะวันพิเศษ:
 *               summary: กะวันเดียว CUSTOM
 *               value:
 *                 name: "งานพิเศษวันเสาร์"
 *                 shiftType: "CUSTOM"
 *                 startTime: "10:00"
 *                 endTime: "15:00"
 *                 locationId: 151
 *                 customDate: "2026-03-15"
 *                 userId: 151
 *             กะเดียวให้หลายคน:
 *               summary: สร้างกะเดียวกันให้หลาย user (all-or-nothing)
 *               value:
 *                 name: "กะเช้าสาขาหลัก"
 *                 shiftType: "REGULAR"
 *                 startTime: "08:00"
 *                 endTime: "17:00"
 *                 locationId: 151
 *                 gracePeriodMinutes: 15
 *                 lateThresholdMinutes: 30
 *                 userIds: [151, 152, 153]
 *                 replaceExisting: false
 *     responses:
 *       201:
 *         description: |
 *           สร้างกะสำเร็จ
 *           - single user: คืน Shift 1 รายการ
 *           - multi user: คืน createdCount และ shifts[]
 *         content:
 *           application/json:
 *             examples:
 *               single-user:
 *                 value:
 *                   success: true
 *                   message: "สร้างกะเรียบร้อยแล้ว"
 *                   data:
 *                     shiftId: 151
 *                     userId: 151
 *                     name: "กะเช้า"
 *                     shiftType: "REGULAR"
 *                     startTime: "08:00"
 *                     endTime: "17:00"
 *               multi-user:
 *                 value:
 *                   success: true
 *                   message: "สร้างกะเรียบร้อยแล้ว 3 รายการ"
 *                   data:
 *                     createdCount: 3
 *                     shifts:
 *                       - shiftId: 151
 *                         userId: 151
 *                         name: "กะเช้า"
 *                       - shiftId: 152
 *                         userId: 152
 *                         name: "กะเช้า"
 *       400:
 *         description: |
 *           Bad Request — สาเหตุที่เป็นไปได้:
 *           - รูปแบบเวลาไม่ถูกต้อง (ต้องเป็น HH:MM)
 *           - SPECIFIC_DAY ไม่ระบุ specificDays
 *           - CUSTOM ไม่ระบุ customDate
 *           - ไม่พบ userId/userIds หรือ locationId
 *       401:
 *         description: ไม่ได้ login หรือ Token หมดอายุ
 *       403:
 *         description: ไม่มีสิทธิ์ — หรือ Admin พยายามสร้างกะให้พนักงานสาขาอื่น
 *       409:
 *         description: พนักงานมี active shift อยู่แล้ว (ต้องส่ง replaceExisting=true เพื่อยืนยันแทนที่)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 error:
 *                   type: string
 *                   example: "พนักงานบางคนมี active shift อยู่แล้ว กรุณายืนยันการย้ายกะด้วย replaceExisting=true"
 *                 code:
 *                   type: string
 *                   example: "SHIFT_CONFLICT"
 *                 details:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/BulkShiftErrorDetail'
 *
 *   get:
 *     summary: ดึงรายการกะทั้งหมด (กรองตาม role อัตโนมัติ)
 *     description: |
 *       ดึงกะตาม role ของผู้เรียก:
 *       - SuperAdmin: เห็นทุกกะทุกสาขา
 *       - Admin: เห็นเฉพาะกะสาขาตัวเอง
 *       - User: เห็นเฉพาะกะของตัวเอง
 *
 *       **ทำไมไม่แยก 3 endpoint?**
 *       เพราะ return type เหมือนกัน กรองตาม role ใน service ทำให้ลด duplication
 *     tags:
 *       - Shifts
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: integer
 *         description: กรองเฉพาะกะของพนักงาน ID นี้ (optional)
 *       - in: query
 *         name: shiftType
 *         schema:
 *           type: string
 *           enum: [REGULAR, SPECIFIC_DAY, CUSTOM]
 *         description: กรองตามประเภทกะ (optional)
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: กรองเฉพาะกะที่เปิด/ปิดใช้งาน (default User=true, Admin=ทั้งหมด)
 *     responses:
 *       200:
 *         description: ดึงข้อมูลสำเร็จ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Shift'
 *       401:
 *         description: ไม่ได้ login
 */

/**
 * @swagger
 * /api/shifts/today/{userId}:
 *   get:
 *     summary: ดึงกะที่ใช้งานได้วันนี้ของพนักงาน
 *     description: |
 *       ดึงเฉพาะกะที่ active และตรงกับวันนี้ สำหรับใช้ก่อนหน้า check-in
 *
 *       **ทำไมต้องมี endpoint นี้แยกจาก GET /api/shifts?**
 *       หน้า check-in ต้องแสดงเฉพาะกะที่ควรเข้าวันนี้
 *       ไม่ต้องแสดงกะวันอื่น เพื่อลด confusion
 *
 *       **Logic:**
 *       - REGULAR → ใช้ได้ทุกวัน
 *       - SPECIFIC_DAY → ต้องตรงกับวันในสัปดาห์วันนี้
 *       - CUSTOM → ต้อง customDate ตรงกับวันนี้
 *     tags:
 *       - Shifts
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: รหัสพนักงานที่ต้องการดูกะวันนี้
 *         example: 151
 *     responses:
 *       200:
 *         description: รายการกะที่ active วันนี้ (อาจเป็น array ว่างถ้าไม่มีกะวันนี้)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Shift'
 *                   description: กะที่ active วันนี้ (array ว่าง = ไม่มีกะวันนี้)
 *       401:
 *         description: ไม่ได้ login
 */

/**
 * @swagger
 * /api/shifts/{id}:
 *   get:
 *     summary: ดึงข้อมูลกะตาม ID
 *     description: |
 *       ดึงรายละเอียดกะพร้อม user, location, ผู้สร้าง, ผู้แก้ไข, ผู้ลบ
 *       ใช้ก่อนแสดง detail modal หรือก่อน edit form
 *     tags:
 *       - Shifts
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: รหัสกะที่ต้องการ
 *         example: 151
 *     responses:
 *       200:
 *         description: ดึงข้อมูลสำเร็จ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Shift'
 *       401:
 *         description: ไม่ได้ login
 *       404:
 *         description: ไม่พบกะที่ระบุ
 *
 *   put:
 *     summary: อัปเดตกะ (Admin/SuperAdmin only)
 *     description: |
 *       แก้ไขข้อมูลกะที่มีอยู่ ส่งเฉพาะ field ที่ต้องการเปลี่ยน
 *
 *       **ทำไม patch แค่บาง field ได้?**
 *       ลด payload size และป้องกัน overwrite field ที่ไม่ได้ตั้งใจแก้
 *       ทุก field เป็น optional — ส่งมาเท่าที่จำเป็น
 *     tags:
 *       - Shifts
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: รหัสกะที่ต้องการแก้ไข
 *         example: 151
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 example: "กะเช้า (ปรับใหม่)"
 *               startTime:
 *                 type: string
 *                 example: "08:30"
 *                 description: รูปแบบ HH:MM
 *               endTime:
 *                 type: string
 *                 example: "17:30"
 *                 description: รูปแบบ HH:MM
 *               gracePeriodMinutes:
 *                 type: integer
 *                 example: 10
 *                 description: เข้าก่อนได้กี่นาที
 *               lateThresholdMinutes:
 *                 type: integer
 *                 example: 20
 *                 description: สายเกินนี้ถือว่าขาด
 *               isActive:
 *                 type: boolean
 *                 example: true
 *                 description: เปิด/ปิดใช้งานกะ
 *               locationId:
 *                 type: integer
 *                 nullable: true
 *                 example: 2
 *                 description: เปลี่ยนสถานที่ (null = ไม่ตรวจ GPS)
 *               specificDays:
 *                 type: array
 *                 items:
 *                   type: string
 *                   enum: [MONDAY,TUESDAY,WEDNESDAY,THURSDAY,FRIDAY,SATURDAY,SUNDAY]
 *               customDate:
 *                 type: string
 *                 format: date
 *                 example: "2026-04-01"
 *               userId:
 *                 type: integer
 *                 example: 151
 *                 description: มอบหมายกะให้พนักงานคนใหม่
 *               replaceExisting:
 *                 type: boolean
 *                 example: true
 *                 description: true = ยืนยันให้แทนที่ active shift เดิมของพนักงานเป้าหมาย
 *     responses:
 *       200:
 *         description: อัปเดตสำเร็จ พร้อม audit log
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "อัปเดตกะงานเรียบร้อยแล้ว"
 *                 data:
 *                   $ref: '#/components/schemas/Shift'
 *       400:
 *         description: รูปแบบเวลาไม่ถูกต้อง
 *       409:
 *         description: พนักงานมี active shift อยู่แล้ว (ต้องส่ง replaceExisting=true)
 *       401:
 *         description: ไม่ได้ login
 *       403:
 *         description: ไม่มีสิทธิ์ — Admin พยายามแก้กะของสาขาอื่น
 *       404:
 *         description: ไม่พบกะ
 *
 *   delete:
 *     summary: ลบกะ — Soft Delete (Admin/SuperAdmin only)
 *     description: |
 *       ปิดการใช้งานกะ (isActive=false) และบันทึก deletedAt/deleteReason
 *
 *       **ทำไมใช้ Soft Delete?**
 *       กะที่ผูกกับ Attendance ที่บันทึกไปแล้วจะ orphan ถ้าลบจริง (Hard Delete)
 *       Soft Delete รักษาข้อมูลประวัติไว้ครบ และยัง restore ได้ถ้าลบผิด
 *
 *       **ต้องระบุ deleteReason เสมอ** — เพื่อความโปร่งใสและ accountability
 *     tags:
 *       - Shifts
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: รหัสกะที่ต้องการลบ
 *         example: 151
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - deleteReason
 *             properties:
 *               deleteReason:
 *                 type: string
 *                 example: "ยกเลิกกะเนื่องจากปรับตารางงานใหม่"
 *                 description: เหตุผลในการลบ — จำเป็นต้องระบุ
 *     responses:
 *       200:
 *         description: ลบสำเร็จ (Soft Delete — ยังมีข้อมูลอยู่ใน DB)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "ลบกะงานเรียบร้อยแล้ว"
 *       400:
 *         description: ไม่ระบุ deleteReason
 *       401:
 *         description: ไม่ได้ login
 *       403:
 *         description: ไม่มีสิทธิ์ — Admin พยายามลบกะของสาขาอื่น
 *       404:
 *         description: ไม่พบกะ
 */

/**
 * @swagger
 * /api/attendance/check-gps:
 *   post:
 *     summary: ตรวจสอบ GPS ว่าอยู่ในพื้นที่อนุญาตหรือไม่
 *     description: |
 *       ตรวจสอบว่าพิกัด GPS ที่ส่งมาอยู่ภายในรัศมีของ location หรือไม่
 *       ใช้ก่อน check-in เพื่อแสดงสถานะ GPS บนหน้า Dashboard
 *
 *       **การหา Location:**
 *       - ถ้าส่ง `locationId` → ใช้ location นั้นตรง ๆ
 *       - ถ้าส่ง `shiftId` → ดึง location จาก shift
 *       - ถ้าไม่ส่งทั้งคู่ → ต้องมีอย่างน้อย 1 อย่าง
 *
 *       **การคำนวณ:**
 *       ใช้ geolib ฝั่ง backend เพื่อความปลอดภัย (ไม่ trust client distance)
 *     tags:
 *       - Attendance
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - latitude
 *               - longitude
 *             properties:
 *               latitude:
 *                 type: number
 *                 example: 13.7563
 *               longitude:
 *                 type: number
 *                 example: 100.5018
 *               locationId:
 *                 type: integer
 *                 example: 151
 *                 description: ระบุ location ตรง ๆ (optional ถ้ามี shiftId)
 *               shiftId:
 *                 type: integer
 *                 example: 151
 *                 description: ดึง location จาก shift (optional ถ้ามี locationId)
 *     responses:
 *       200:
 *         description: ผลตรวจ GPS
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     withinRadius:
 *                       type: boolean
 *                       example: true
 *                       description: true = อยู่ในพื้นที่
 *                     distance:
 *                       type: number
 *                       example: 45.2
 *                       description: ระยะห่างจากศูนย์กลาง (เมตร)
 *                     radius:
 *                       type: number
 *                       example: 100
 *                       description: รัศมีที่อนุญาต (เมตร)
 *                     location:
 *                       type: object
 *                       properties:
 *                         locationId:
 *                           type: integer
 *                         locationName:
 *                           type: string
 *                         latitude:
 *                           type: number
 *                         longitude:
 *                           type: number
 *                     message:
 *                       type: string
 *                       example: "อยู่ในรัศมี 45 ม. (อนุญาต 100 ม.)"
 *       400:
 *         description: ไม่ได้ส่ง locationId หรือ shiftId
 *       404:
 *         description: ไม่พบ location หรือ shift
 */

/**
 * @swagger
 * /api/attendance/check-in:
 *   post:
 *     summary: เข้างาน (Check-in)
 *     description: |
 *       บันทึกเวลาเข้างานพร้อม GPS, รูปภาพ, และคำนวณสถานะอัตโนมัติ
 *
 *       **ข้อจำกัดเพิ่มเติม:**
 *       - ไม่สามารถ check-in หลังเวลาออกงาน (endTime) ของกะได้
 *       - พิกัด (0,0) ถูกปฏิเสธ — ต้องเปิด GPS จริง
 *
 *       **Flow การทำงาน:**
 *       1. ตรวจสอบว่า check-in ซ้ำในวันนี้หรือยัง
 *       2. ตรวจสอบใบลาที่อนุมัติวันนี้ (ถ้ามี → status=LEAVE_APPROVED)
 *       3. ตรวจสอบ GPS ว่าอยู่ในพื้นที่ location ที่กำหนด (ถ้ามี locationId)
 *       4. คำนวณสถานะ: ON_TIME / LATE / ABSENT ตาม gracePeriod และ lateThreshold ของกะ
 *       5. บันทึก attendance record + audit log
 *
 *       **สถานะที่ได้:**
 *       - `ON_TIME` — มาตรงเวลาหรือก่อนเวลาภายใน grace period
 *       - `LATE` — มาสาย แต่ไม่เกิน late threshold
 *       - `ABSENT` — สายเกิน late threshold (ถือว่าขาด)
 *       - `LEAVE_APPROVED` — มีใบลาอนุมัติวันนี้
 *     tags:
 *       - Attendance
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CheckInRequest'
 *           examples:
 *             พร้อม GPS และกะ:
 *               summary: Check-in พร้อม GPS และระบุกะ
 *               value:
 *                 shiftId: 151
 *                 locationId: 151
 *                 latitude: 13.7563
 *                 longitude: 100.5018
 *                 address: "อาคาร A ชั้น 3, กรุงเทพฯ"
 *             Check-in กะดึก:
 *               summary: ตัวอย่าง check-in อีกกะของผู้ใช้ที่ล็อกอินอยู่
 *               value:
 *                 shiftId: 152
 *                 latitude: 13.7565
 *                 longitude: 100.5020
 *     responses:
 *       201:
 *         description: เข้างานสำเร็จ — คืน attendance record พร้อม user, shift, location
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "เข้างานสำเร็จ — ON_TIME"
 *                 data:
 *                   $ref: '#/components/schemas/AttendanceRecord'
 *       400:
 *         description: |
 *           Bad Request — สาเหตุที่เป็นไปได้:
 *           - check-in ซ้ำในวันนี้แล้ว
 *           - ไม่พบกะที่ระบุ หรือกะไม่ใช่ของ user นี้
 *           - อยู่นอกพื้นที่ GPS (ห่างเกิน radius)
 *           - กะถูกปิดใช้งานแล้ว
 *       401:
 *         description: ไม่ได้ login
 */

/**
 * @swagger
 * /api/attendance/check-out:
 *   post:
 *     summary: ออกงาน (Check-out)
 *     description: |
 *       บันทึกเวลาออกงานโดยอัปเดต attendance record ที่ check-in ไว้
 *
 *       **ทำไม UPDATE แทน INSERT?**
 *       1 วันทำงาน = 1 attendance record (checkIn + checkOut อยู่ row เดียวกัน)
 *       ลด query complexity ของ report และ dashboard
 *
 *       **ลำดับการค้นหา record:**
 *       - ถ้าระบุ attendanceId → ใช้ record นั้นตรง ๆ (สำหรับกรณีมีหลายกะ)
 *       - ถ้าไม่ระบุ → หา record ล่าสุดที่ checkOut=null ของ user
 *     tags:
 *       - Attendance
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CheckOutRequest'
 *           examples:
 *             ออกงานปกติ:
 *               summary: Check-out พร้อม GPS
 *               value:
 *                 latitude: 13.7563
 *                 longitude: 100.5018
 *                 address: "อาคาร A ชั้น 3, กรุงเทพฯ"
 *             ระบุ record:
 *               summary: ระบุ attendanceId ตรง (กรณีมีหลายกะ)
 *               value:
 *                 attendanceId: 151
 *     responses:
 *       200:
 *         description: ออกงานสำเร็จ — คืน attendance record ที่มี checkOut แล้ว
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "ออกงานสำเร็จ"
 *                 data:
 *                   $ref: '#/components/schemas/AttendanceRecord'
 *       400:
 *         description: |
 *           Bad Request — สาเหตุที่เป็นไปได้:
 *           - ไม่พบ check-in ที่ยังไม่ได้ออก (อาจ check-out ไปแล้ว)
 *           - อยู่นอกพื้นที่ GPS
 *       401:
 *         description: ไม่ได้ login
 */

/**
 * @swagger
 * /api/attendance/history/{userId}:
 *   get:
 *     summary: ดูประวัติการเข้างาน (กรองตามช่วงเวลา/สถานะ)
 *     description: |
 *       ดึงประวัติการเข้างานของพนักงาน สามารถกรองตามช่วงวันที่และสถานะได้
 *
 *       **User ดูได้แค่ของตัวเอง** — ถ้า Admin ส่ง userId ของคนอื่นมาได้ด้วย
 *       (enforce ใน service layer ว่า User ดูได้เฉพาะ userId ตัวเอง)
 *     tags:
 *       - Attendance
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: รหัสพนักงาน
 *         example: 151
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: กรองวันที่เริ่มต้น (ISO 8601) เช่น 2026-02-01
 *         example: "2026-02-01"
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: กรองวันที่สิ้นสุด เช่น 2026-02-28
 *         example: "2026-02-28"
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ON_TIME, LATE, LATE_APPROVED, ABSENT, LEAVE_APPROVED]
 *         description: กรองเฉพาะสถานะนี้ (optional)
 *     responses:
 *       200:
 *         description: รายการประวัติการเข้างาน เรียงล่าสุดก่อน
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/AttendanceRecord'
 *       401:
 *         description: ไม่ได้ login
 */

/**
 * @swagger
 * /api/attendance/today/{userId}:
 *   get:
 *     summary: ดูสถานะการเข้างานวันนี้ของพนักงาน
 *     description: |
 *       ดึง attendance record ทุก record ที่ check-in วันนี้ของพนักงาน
 *
 *       **ใช้งานที่ไหน?**
 *       Dashboard หน้าแรก — แสดงสถานะ "เข้างานแล้ว / ยังไม่เข้า / ออกแล้ว"
 *       real-time ทุกครั้งที่ refresh
 *     tags:
 *       - Attendance
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: integer
 *         description: รหัสพนักงาน
 *         example: 151
 *     responses:
 *       200:
 *         description: ข้อมูลการเข้างานวันนี้ (array ว่าง = ยังไม่ได้ check-in)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/AttendanceRecord'
 *       401:
 *         description: ไม่ได้ login
 */

/**
 * @swagger
 * /api/attendance:
 *   get:
 *     summary: ดูประวัติการเข้างานทั้งหมด (Admin/SuperAdmin only)
 *     description: |
 *       ดึง attendance record ทุกคนในระบบ พร้อมกรองตาม userId/ช่วงวันที่/สถานะ
 *       ใช้สำหรับหน้า Admin report และ export ข้อมูล
 *     tags:
 *       - Attendance
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: integer
 *         description: กรองเฉพาะพนักงานคนนี้ (optional)
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: กรองวันที่เริ่มต้น เช่น 2026-02-01
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: กรองวันที่สิ้นสุด เช่น 2026-02-28
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ON_TIME, LATE, LATE_APPROVED, ABSENT, LEAVE_APPROVED]
 *         description: กรองเฉพาะสถานะนี้ (optional)
 *     responses:
 *       200:
 *         description: รายการ attendance ทั้งหมด พร้อม user info
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/AttendanceRecord'
 *       401:
 *         description: ไม่ได้ login
 *       403:
 *         description: ไม่มีสิทธิ์ (ต้องเป็น Admin/SuperAdmin)
 */

/**
 * @swagger
 * /api/attendance/{id}:
 *   put:
 *     summary: แก้ไข attendance record (Admin/SuperAdmin only)
 *     description: |
 *       Admin แก้ไขข้อมูลการเข้างานที่บันทึกผิดหรือระบบมีปัญหา
 *       พร้อมบันทึก audit log ว่า Admin คนไหนแก้เมื่อไหร่ เปลี่ยนจากอะไรเป็นอะไร
 *
 *       **ทำไม Admin ต้องแก้ได้?**
 *       GPS ผิดพลาด, พนักงานลืม check-out, ระบบล่ม, ฯ
 *       มีกรณีจริงที่ต้องแก้ manual เสมอ → ต้องมี audit trail กำกับ
 *     tags:
 *       - Attendance
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: รหัส attendance record ที่ต้องการแก้ไข
 *         example: 151
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [ON_TIME, LATE, LATE_APPROVED, ABSENT, LEAVE_APPROVED]
 *                 example: "ON_TIME"
 *                 description: แก้ไขสถานะ
 *               note:
 *                 type: string
 *                 example: "แก้ไขโดย Admin เนื่องจาก GPS ล้มเหลว"
 *                 description: หมายเหตุการแก้ไข
 *               checkIn:
 *                 type: string
 *                 format: date-time
 *                 example: "2026-02-22T08:05:00.000Z"
 *                 description: แก้ไขเวลาเข้างาน (ถ้าบันทึกผิด)
 *               checkOut:
 *                 type: string
 *                 format: date-time
 *                 example: "2026-02-22T17:00:00.000Z"
 *                 description: แก้ไขเวลาออกงาน (เช่น พนักงานลืม check-out)
 *               editReason:
 *                 type: string
 *                 example: "แก้เวลาตามหลักฐานจากกล้องวงจรปิด"
 *                 description: จำเป็นเมื่อมีการแก้ checkIn/checkOut
 *     responses:
 *       200:
 *         description: แก้ไขสำเร็จ พร้อมบันทึก audit log (oldValues/newValues)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "อัปเดตข้อมูลการเข้างานเรียบร้อยแล้ว"
 *                 data:
 *                   $ref: '#/components/schemas/AttendanceRecord'
 *       401:
 *         description: ไม่ได้ login
 *       403:
 *         description: ไม่มีสิทธิ์
 *       404:
 *         description: ไม่พบ attendance record
 *
 *   delete:
 *     summary: ลบ attendance record — Soft Delete (Admin/SuperAdmin only)
 *     description: |
 *       ทำ soft delete โดยเซ็ต deletedAt/deletedByUserId/deleteReason
 *       record ยังอยู่ใน DB แต่จะไม่แสดงในการ query ปกติ
 *
 *       **ทำไมต้อง Soft Delete?**
 *       ข้อมูลการเข้างานเป็น historical record ที่มีนัยสำคัญทางกฎหมาย (PDPA, เอกสารแรงงาน)
 *       ถ้าลบจริงจะทำให้ audit trail ขาดหาย ไม่สามารถตรวจสอบย้อนหลังได้
 *     tags:
 *       - Attendance
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: รหัส attendance record ที่ต้องการลบ
 *         example: 151
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - deletedByUserId
 *             properties:
 *               deletedByUserId:
 *                 type: integer
 *                 example: 151
 *                 description: รหัส Admin ที่ทำการลบ (สำหรับ audit trail)
 *               deleteReason:
 *                 type: string
 *                 example: "บันทึกผิดพลาด duplicate"
 *                 description: เหตุผลในการลบ (ควรระบุเสมอ)
 *     responses:
 *       200:
 *         description: ลบสำเร็จ (Soft Delete)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "ลบข้อมูลการเข้างานเรียบร้อยแล้ว (Soft Delete)"
 *       401:
 *         description: ไม่ได้ login
 *       403:
 *         description: ไม่มีสิทธิ์
 *       404:
 *         description: ไม่พบ attendance record
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     AttendanceRecord:
 *       type: object
 *       description: |
 *         ข้อมูลการเข้า-ออกงาน 1 record (1 วันทำงาน = 1 record)
 *         checkOut จะเป็น null ถ้ายังไม่ได้ออกงาน
 *       properties:
 *         attendanceId:
 *           type: integer
 *           example: 151
 *         userId:
 *           type: integer
 *           example: 151
 *         shiftId:
 *           type: integer
 *           nullable: true
 *           example: 151
 *           description: null = walk-in (ไม่มีกะ)
 *         locationId:
 *           type: integer
 *           nullable: true
 *           example: 2
 *           description: null = ไม่มีการตรวจ GPS
 *         checkIn:
 *           type: string
 *           format: date-time
 *           example: "2026-02-22T08:03:00.000Z"
 *         checkOut:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           example: "2026-02-22T17:05:00.000Z"
 *           description: null = ยังไม่ได้ check-out
 *         checkInPhoto:
 *           type: string
 *           nullable: true
 *           description: URL รูป selfie ตอนเข้างาน
 *         checkOutPhoto:
 *           type: string
 *           nullable: true
 *           description: URL รูป selfie ตอนออกงาน
 *         checkInLat:
 *           type: number
 *           nullable: true
 *           example: 13.7563
 *         checkInLng:
 *           type: number
 *           nullable: true
 *           example: 100.5018
 *         checkInAddress:
 *           type: string
 *           nullable: true
 *           example: "อาคาร A ชั้น 3"
 *         checkInDistance:
 *           type: number
 *           nullable: true
 *           example: 45.2
 *           description: ระยะห่างจาก location center ตอนเข้า (เมตร)
 *         checkOutLat:
 *           type: number
 *           nullable: true
 *         checkOutLng:
 *           type: number
 *           nullable: true
 *         checkOutAddress:
 *           type: string
 *           nullable: true
 *         checkOutDistance:
 *           type: number
 *           nullable: true
 *           description: ระยะห่างจาก location center ตอนออก (เมตร)
 *         status:
 *           type: string
 *           enum: [ON_TIME, LATE, LATE_APPROVED, ABSENT, LEAVE_APPROVED]
 *           example: "ON_TIME"
 *           description: |
 *             - ON_TIME: เข้าตรงเวลาหรือก่อนเวลาภายใน grace period
 *             - LATE: มาสายแต่ไม่เกิน lateThreshold
 *             - ABSENT: สายเกิน lateThreshold (ถือว่าขาดงาน)
 *             - LATE_APPROVED: มาสายและได้รับอนุมัติคำขอมาสายแล้ว
 *             - LEAVE_APPROVED: มีใบลาอนุมัติวันนี้
 *         lateMinutes:
 *           type: integer
 *           example: 0
 *           description: จำนวนนาทีที่สาย (0 ถ้า ON_TIME)
 *         workedMinutes:
 *           type: integer
 *           nullable: true
 *           example: 510
 *           description: เวลาทำงานรวมจริง (นาที) จาก checkIn ถึง checkOut; ถ้ายังไม่ checkOut จะเป็น null
 *         breakDeductedMinutes:
 *           type: integer
 *           example: 60
 *           description: นาทีพักที่หักตามกฎหมายแรงงาน (กะเกิน 5 ชั่วโมง หัก 60 นาที)
 *         leaveDeductedMinutes:
 *           type: integer
 *           example: 30
 *           description: นาทีลารายชั่วโมงที่ได้รับอนุมัติและต้องหักออกจากเวลาทำงาน
 *         netWorkedMinutes:
 *           type: integer
 *           nullable: true
 *           example: 420
 *           description: เวลาทำงานสุทธิ (workedMinutes - breakDeductedMinutes - leaveDeductedMinutes)
 *         note:
 *           type: string
 *           nullable: true
 *           example: "เข้างานตรงเวลา (มาก่อน 3 นาที)"
 *         isAutoCheckout:
 *           type: boolean
 *           example: false
 *           description: true = ระบบ auto checkout ให้ (งานค้างข้ามคืน)
 *         createdAt:
 *           type: string
 *           format: date-time
 *         user:
 *           type: object
 *           properties:
 *             userId:
 *               type: integer
 *             firstName:
 *               type: string
 *             lastName:
 *               type: string
 *             employeeId:
 *               type: string
 *         shift:
 *           nullable: true
 *           $ref: '#/components/schemas/Shift'
 *         location:
 *           nullable: true
 *           type: object
 *           properties:
 *             locationId:
 *               type: integer
 *             locationName:
 *               type: string
 *             latitude:
 *               type: number
 *             longitude:
 *               type: number
 *             radius:
 *               type: number
 *               description: รัศมีที่อนุญาต (เมตร)
 */

// ============================================================
// 🔐 AUTH ENDPOINTS
// ============================================================

/**
 * @swagger
 * /api/auth/login:
 *   post:
 *     summary: เข้าสู่ระบบ (Login)
 *     description: |
 *       ล็อกอินด้วย `employeeId` และ `password`
 *
 *       **ข้อมูลที่ได้รับกลับ:**
 *       - `accessToken` — ใช้แนบใน `Authorization: Bearer <token>` ทุก request (อายุ 30 นาที)
 *       - `refreshToken` — ใช้ขอ accessToken ใหม่เมื่อหมดอายุ (อายุ 7 วัน)
 *       - `expiresIn` — อายุ accessToken เป็นวินาที (1800)
 *       - `dashboardMode` — บอก frontend ว่าควร redirect ไป dashboard ไหน
 *       - `user` — ข้อมูลพนักงาน (userId, employeeId, role, branchId, ชื่อ ฯลฯ)
 *
 *       **Token เป็น JWT (HS256)** signed ด้วย `JWT_SECRET` — เก็บใน database ด้วย (รองรับ revoke ผ่าน logout)
 *       JWT Payload: `sub` (userId), `employeeId`, `role`, `dashboardMode`, `jti`
 *
 *       **ระบบ Password:**
 *       - รหัสเริ่มต้น = `nationalId` (ระบบ hash ไว้ใน `password` column ตั้งแต่สร้าง account)
 *       - เปลี่ยนรหัสแล้ว → ใช้รหัสใหม่ที่ตั้งไว้เท่านั้น (nationalId ใช้ไม่ได้อีก)
 *
 *       **ระบบ Dual Login สำหรับ Admin/SuperAdmin:**
 *       - ใส่ `adminPassword` → `dashboardMode: 'admin'` หรือ `'superadmin'` (เข้าหน้า Admin Dashboard)
 *       - ใส่รหัสปกติ (nationalId หรือรหัสที่เปลี่ยนไว้) → `dashboardMode: 'user'` (เข้าหน้า User Dashboard)
 *
 *       **Rate Limit:** 5 ครั้งต่อ 60 วินาที ต่อ IP
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/LoginRequest'
 *           examples:
 *             Login ปกติ (User):
 *               summary: Login ด้วย employeeId และ nationalId → dashboardMode user
 *               value:
 *                 employeeId: "BKK0001"
 *                 password: "4850495039640"
 *             Login Admin ด้วย adminPassword:
 *               summary: Admin ใช้ adminPassword → dashboardMode admin
 *               value:
 *                 employeeId: "BKK0001"
 *                 password: "adm0034"
 *             Login Admin ด้วยรหัสปกติ:
 *               summary: Admin ใส่ nationalId → dashboardMode user
 *               value:
 *                 employeeId: "BKK0001"
 *                 password: "4850495039640"
 *             Login หลังเปลี่ยนรหัส:
 *               summary: Login หลังเปลี่ยนรหัสผ่านแล้ว
 *               value:
 *                 employeeId: "CNX002"
 *                 password: "mySecurePass123"
 *     responses:
 *       200:
 *         description: Login สำเร็จ — ได้รับ accessToken และ refreshToken
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/LoginResponse'
 *       400:
 *         description: ไม่ได้ระบุ employeeId หรือ password
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error: "employeeId และ password (nationalId) จำเป็นต้องระบุ"
 *       401:
 *         description: |
 *           รหัสผ่านไม่ถูกต้อง หรือบัญชีถูกระงับ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *             example:
 *               success: false
 *               error: "รหัสผ่านไม่ถูกต้อง"
 *       429:
 *         description: เกิน Rate Limit — ลองใหม่หลัง 60 วินาที
 */

/**
 * @swagger
 * /api/auth/logout:
 *   post:
 *     summary: ออกจากระบบ (Logout)
 *     description: |
 *       ยกเลิก session ปัจจุบัน — token จะถูก revoke ทันที
 *
 *       **หลังจาก logout:**
 *       - `accessToken` เดิมใช้ไม่ได้อีก (แม้ยังไม่หมดอายุ)
 *       - ต้อง login ใหม่เพื่อรับ token ชุดใหม่
 *     tags:
 *       - Auth
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: Logout สำเร็จ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "Logout สำเร็จ"
 *       400:
 *         description: ไม่ได้ระบุ Token
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: Token ไม่ถูกต้องหรือหมดอายุ
 */

/**
 * @swagger
 * /api/auth/refresh:
 *   post:
 *     summary: ขอ accessToken ใหม่ (Refresh Token)
 *     description: |
 *       ใช้ `refreshToken` เพื่อขอ `accessToken` ชุดใหม่ โดยไม่ต้อง login ใหม่
 *
 *       **เมื่อไหร่ต้องใช้?**
 *       เมื่อ API ตอบ 401 พร้อมข้อความว่า token หมดอายุ
 *       Frontend ควร intercept 401 → เรียก refresh อัตโนมัติ → retry request เดิม
 *
 *       **ถ้า refreshToken หมดอายุด้วย** (เกิน 7 วัน) → ต้อง login ใหม่
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - refreshToken
 *             properties:
 *               refreshToken:
 *                 type: string
 *                 description: Refresh Token ที่ได้จากการ login
 *                 example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *     responses:
 *       200:
 *         description: ได้รับ accessToken ใหม่
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 accessToken:
 *                   type: string
 *                   description: Access Token ใหม่ JWT (อายุ 30 นาที)
 *                   example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *       400:
 *         description: ไม่ได้ระบุ refreshToken
 *       401:
 *         description: refreshToken ไม่ถูกต้องหรือหมดอายุ — ต้อง login ใหม่
 */

/**
 * @swagger
 * /api/auth/change-password:
 *   post:
 *     summary: เปลี่ยนรหัสผ่าน (Change Password)
 *     description: |
 *       เปลี่ยนรหัสผ่านปกติของตัวเอง ต้องระบุรหัสปัจจุบันก่อนถึงจะเปลี่ยนได้
 *
 *       **รหัสผ่านเริ่มต้น** คือ `nationalId` (เลขบัตรประชาชน 13 หลัก) ซึ่งระบบ hash เก็บไว้ตั้งแต่สร้าง account
 *       หลังเปลี่ยนรหัสแล้ว `nationalId` จะใช้ login ไม่ได้อีก
 *
 *       > **หมายเหตุ:** API นี้เปลี่ยนเฉพาะรหัสปกติ (password/nationalId)
 *       > ไม่ใช่ `adminPassword` — สำหรับเข้าหน้า Admin Dashboard
 *
 *       **ข้อกำหนดรหัสผ่าน:**
 *       - ความยาวอย่างน้อย 6 ตัวอักษร
 *     tags:
 *       - Auth
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - currentPassword
 *               - newPassword
 *             properties:
 *               currentPassword:
 *                 type: string
 *                 description: รหัสผ่านปัจจุบัน (หรือ nationalId ถ้ายังไม่เคยเปลี่ยน)
 *                 example: "1234567890123"
 *               newPassword:
 *                 type: string
 *                 description: รหัสผ่านใหม่ (อย่างน้อย 6 ตัวอักษร)
 *                 example: "MyNewPass@2026"
 *     responses:
 *       200:
 *         description: เปลี่ยนรหัสผ่านสำเร็จ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: "เปลี่ยนรหัสผ่านสำเร็จ"
 *       400:
 *         description: |
 *           Bad Request — สาเหตุที่เป็นไปได้:
 *           - ไม่ระบุ currentPassword หรือ newPassword
 *           - รหัสผ่านใหม่สั้นน้อยกว่า 6 ตัวอักษร
 *           - รหัสผ่านปัจจุบันไม่ถูกต้อง
 *       401:
 *         description: ไม่ได้ login
 */

// ============================================================
// 👤 USER MANAGEMENT ENDPOINTS
// ============================================================

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: ดึงรายการพนักงานทั้งหมด (กรองตาม role อัตโนมัติ)
 *     description: |
 *       ดึงข้อมูลพนักงานตาม role ของผู้เรียก:
 *       - **SuperAdmin** — เห็นทุกสาขา
 *       - **Admin** — เห็นเฉพาะสาขาตัวเอง
 *       - **User** — เห็นเฉพาะข้อมูลตัวเอง
 *
 *       รองรับการ filter ตามสาขา, role, สถานะ และ full-text search
 *       รองรับ pagination ด้วย `page` และ `limit`
 *     tags:
 *       - Users
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: branchId
 *         schema:
 *           type: integer
 *         description: กรองตาม branchId (SuperAdmin only)
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [USER, MANAGER, ADMIN, SUPERADMIN]
 *         description: กรองตาม role
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, INACTIVE, RESIGNED]
 *         description: กรองตามสถานะพนักงาน
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: ค้นหาจากชื่อ, นามสกุล, employeeId, อีเมล
 *         example: "สมชาย"
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: หน้าที่ต้องการ
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *         description: จำนวนรายการต่อหน้า
 *     responses:
 *       200:
 *         description: รายการพนักงาน พร้อม pagination info
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     users:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/UserProfile'
 *                     total:
 *                       type: integer
 *                       example: 42
 *                     page:
 *                       type: integer
 *                       example: 1
 *                     limit:
 *                       type: integer
 *                       example: 20
 *                     totalPages:
 *                       type: integer
 *                       example: 3
 *       401:
 *         description: ไม่ได้ login หรือ token ไม่ถูกต้อง
 *       403:
 *         description: ไม่มีสิทธิ์เข้าถึง
 *
 *   post:
 *     summary: สร้างพนักงานใหม่ (Admin/SuperAdmin only)
 *     description: |
 *       สร้าง user account พร้อม auto-generate `employeeId` จาก branchCode
 *       เช่น สาขากรุงเทพ (BKK) → BKK001, BKK002, ...
 *
 *       **รหัสผ่านเริ่มต้น:** `nationalId` ของพนักงาน
 *       พนักงานสามารถเปลี่ยนรหัสผ่านได้ที่ `POST /api/auth/change-password`
 *       เมื่อเปลี่ยนรหัสแล้ว รหัสจะถูก hash ด้วย bcrypt โดยอัตโนมัติ
 *
 *       **Role ที่รองรับ:**
 *       - `USER` — พนักงานทั่วไป (`dashboardMode: user`)
 *       - `MANAGER` — ผู้จัดการ (`dashboardMode: manager`) — เห็นข้อมูลสาขาตัวเอง
 *       - `ADMIN` — ผู้ดูแลสาขา — login ได้ 2 mode (user/admin)
 *       - `SUPERADMIN` — ผู้ดูแลระบบทั้งองค์กร — login ได้ 2 mode (user/superadmin)
 *
 *       **ข้อมูลที่จำเป็น:**
 *       `title`, `firstName`, `lastName`, `gender`, `nationalId`,
 *       `emergent_tel`, `emergent_first_name`, `emergent_last_name`, `emergent_relation`,
 *       `phone`, `email`, `password`, `birthDate`, `branchId`
 *     tags:
 *       - Users
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateUserRequest'
 *           examples:
 *             สร้างพนักงานใหม่:
 *               summary: สร้างพนักงานสาขากรุงเทพ
 *               value:
 *                 title: "MR"
 *                 firstName: "สมชาย"
 *                 lastName: "ใจดี"
 *                 nickname: "ชาย"
 *                 gender: "MALE"
 *                 nationalId: "1234567890123"
 *                 emergent_tel: "0812345678"
 *                 emergent_first_name: "สมหญิง"
 *                 emergent_last_name: "ใจดี"
 *                 emergent_relation: "ภรรยา"
 *                 phone: "0898765432"
 *                 email: "somchai@example.com"
 *                 password: "1234567890123"
 *                 birthDate: "1990-01-15"
 *                 branchId: 1
 *                 role: "USER"
 *     responses:
 *       201:
 *         description: สร้างพนักงานสำเร็จ พร้อม employeeId ที่ auto-generate
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "สร้างผู้ใช้เรียบร้อยแล้ว"
 *                 data:
 *                   $ref: '#/components/schemas/UserProfile'
 *       400:
 *         description: |
 *           Bad Request — สาเหตุที่เป็นไปได้:
 *           - ไม่ระบุ field ที่จำเป็น
 *           - email ซ้ำในระบบ
 *           - nationalId ซ้ำในระบบ
 *           - title/gender ไม่ถูกต้อง
 *       401:
 *         description: ไม่ได้ login
 *       403:
 *         description: ไม่มีสิทธิ์ — ต้องเป็น Admin/SuperAdmin
 */

/**
 * @swagger
 * /api/users/statistics:
 *   get:
 *     summary: ดึงสถิติพนักงาน (สำหรับ Dashboard)
 *     description: |
 *       ดึงข้อมูลสรุปจำนวนพนักงานตาม role และสถานะ
 *       ใช้แสดงการ์ดสถิติบน Admin Dashboard
 *     tags:
 *       - Users
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: ข้อมูลสถิติพนักงาน
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     total:
 *                       type: integer
 *                       example: 85
 *                       description: จำนวนพนักงานทั้งหมด
 *                     active:
 *                       type: integer
 *                       example: 80
 *                       description: จำนวนพนักงาน Active
 *                     inactive:
 *                       type: integer
 *                       example: 3
 *                       description: จำนวนพนักงาน Inactive
 *                     resigned:
 *                       type: integer
 *                       example: 2
 *                       description: จำนวนพนักงานที่ลาออกแล้ว
 *                     byRole:
 *                       type: object
 *                       properties:
 *                         USER:
 *                           type: integer
 *                           example: 70
 *                         MANAGER:
 *                           type: integer
 *                           example: 8
 *                         ADMIN:
 *                           type: integer
 *                           example: 5
 *       400:
 *         description: ไม่ระบุ requesterRole
 *       401:
 *         description: ไม่ได้ login
 */

/**
 * @swagger
 * /api/users/csv-template:
 *   get:
 *     summary: ดาวน์โหลด CSV Template สำหรับ Bulk Import
 *     description: |
 *       ดาวน์โหลดไฟล์ CSV ตัวอย่างสำหรับนำเข้าพนักงานจำนวนมาก
 *       ไฟล์มี header row และ 2 row ตัวอย่าง
 *
 *       **หมายเหตุ:** `employeeId` ไม่ต้องใส่ ระบบจะ auto-generate ให้
 *     tags:
 *       - Users
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: ไฟล์ CSV template
 *         content:
 *           text/csv:
 *             schema:
 *               type: string
 *               example: |
 *                 title,firstName,lastName,nickname,gender,nationalId,...
 *                 MR,สมชาย,ใจดี,ชาย,MALE,1234567890123,...
 */

/**
 * @swagger
 * /api/users/bulk:
 *   post:
 *     summary: นำเข้าพนักงานจำนวนมากจาก CSV (Bulk Import)
 *     description: |
 *       นำเข้าพนักงานหลายคนพร้อมกันจาก CSV string
 *
 *       **รูปแบบ CSV:**
 *       ```
 *       title,firstName,lastName,nickname,gender,nationalId,emergent_tel,emergent_first_name,emergent_last_name,emergent_relation,phone,email,password,birthDate,branchId,role
 *       MR,สมชาย,ใจดี,ชาย,MALE,1234567890123,0812345678,สมหญิง,ใจดี,ภรรยา,0898765432,somchai@example.com,pass123,1990-01-15,1,USER
 *       ```
 *
 *       **ผลลัพธ์:** ระบบจะรายงานว่า success/failed กี่รายการ พร้อม error detail ต่อ row
 *     tags:
 *       - Users
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - createdByUserId
 *               - creatorRole
 *               - csvData
 *             properties:
 *               createdByUserId:
 *                 type: integer
 *                 example: 1
 *                 description: รหัส Admin ที่ทำการ import
 *               creatorRole:
 *                 type: string
 *                 enum: [ADMIN, SUPERADMIN]
 *                 example: "ADMIN"
 *               creatorBranchId:
 *                 type: integer
 *                 example: 1
 *                 description: สาขาของ Admin (จำเป็นถ้า creatorRole=ADMIN)
 *               csvData:
 *                 type: string
 *                 description: ข้อมูล CSV เป็น string (รวม header row)
 *                 example: "title,firstName,...\nMR,สมชาย,..."
 *     responses:
 *       201:
 *         description: นำเข้าเสร็จสิ้น — แสดงจำนวน success/failed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "นำเข้าข้อมูลสำเร็จ 10 รายการ, ล้มเหลว 2 รายการ"
 *                 data:
 *                   type: object
 *                   properties:
 *                     success:
 *                       type: integer
 *                       example: 10
 *                     failed:
 *                       type: integer
 *                       example: 2
 *                     createdUsers:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/UserProfile'
 *                     errors:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           row:
 *                             type: integer
 *                             example: 3
 *                           error:
 *                             type: string
 *                             example: "email ซ้ำในระบบ"
 *       400:
 *         description: รูปแบบ CSV ไม่ถูกต้อง หรือไม่มีข้อมูล
 *       401:
 *         description: ไม่ได้ login
 *       403:
 *         description: ไม่มีสิทธิ์
 */

/**
 * @swagger
 * /api/users/{id}:
 *   get:
 *     summary: ดึงข้อมูลพนักงานตาม ID
 *     description: |
 *       ดึงข้อมูลพนักงาน 1 คน พร้อมข้อมูล branch, shift และสถิติการเข้างาน
 *
 *       **User** ดูได้เฉพาะข้อมูลตัวเอง
 *       **Admin** ดูได้เฉพาะพนักงานสาขาตัวเอง
 *       **SuperAdmin** ดูได้ทุกคน
 *     tags:
 *       - Users
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: รหัสพนักงานที่ต้องการดู
 *         example: 5
 *     responses:
 *       200:
 *         description: ข้อมูลพนักงาน
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/UserProfile'
 *       401:
 *         description: ไม่ได้ login
 *       403:
 *         description: ไม่มีสิทธิ์ดูข้อมูลพนักงานสาขาอื่น
 *       404:
 *         description: ไม่พบพนักงานที่ระบุ
 *
 *   put:
 *     summary: อัปเดตข้อมูลพนักงาน (Admin/SuperAdmin only)
 *     description: |
 *       แก้ไขข้อมูลพนักงาน ส่งเฉพาะ field ที่ต้องการเปลี่ยน
 *       พร้อมบันทึก audit log ว่า Admin คนไหนแก้เมื่อไหร่
 *
 *       **ทำไม Admin แก้ข้อมูลพนักงานของสาขาอื่นไม่ได้?**
 *       ป้องกันการ cross-branch data manipulation
 *       แต่ละ Admin รับผิดชอบเฉพาะพนักงานสาขาตัวเองเท่านั้น
 *     tags:
 *       - Users
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: รหัสพนักงานที่ต้องการแก้ไข
 *         example: 5
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateUserRequest'
 *           examples:
 *             แก้เบอร์โทร:
 *               summary: แก้ไขเบอร์โทรและอีเมล
 *               value:
 *                 phone: "0891234567"
 *                 email: "new-email@example.com"
 *             เปลี่ยน role:
 *               summary: เลื่อนตำแหน่งเป็น MANAGER
 *               value:
 *                 role: "MANAGER"
 *     responses:
 *       200:
 *         description: อัปเดตสำเร็จ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "อัปเดตผู้ใช้เรียบร้อยแล้ว"
 *                 data:
 *                   $ref: '#/components/schemas/UserProfile'
 *       401:
 *         description: ไม่ได้ login
 *       403:
 *         description: ไม่มีสิทธิ์แก้ไขพนักงานสาขาอื่น
 *       404:
 *         description: ไม่พบพนักงาน
 *
 *   delete:
 *     summary: ลบพนักงาน — Soft Delete เป็น RESIGNED (Admin/SuperAdmin only)
 *     description: |
 *       เปลี่ยน status พนักงานเป็น `RESIGNED` พร้อมบันทึก deleteReason และ audit log
 *
 *       **ทำไมใช้ Soft Delete (RESIGNED)?**
 *       - ข้อมูลการเข้างานและประวัติการทำงานยังคงอยู่ครบ
 *       - รองรับ PDPA — ข้อมูลแรงงานต้องเก็บไว้ตามกฎหมาย
 *       - สามารถ reactivate ได้ถ้าพนักงานกลับมาทำงาน
 *     tags:
 *       - Users
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: รหัสพนักงานที่ต้องการลบ
 *         example: 5
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - deleteReason
 *             properties:
 *               deleteReason:
 *                 type: string
 *                 example: "พนักงานลาออกตามใจสมัคร"
 *                 description: เหตุผลในการลบ — จำเป็นต้องระบุ
 *     responses:
 *       200:
 *         description: ลบสำเร็จ (Soft Delete — status=RESIGNED)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "ลบผู้ใช้เรียบร้อยแล้ว"
 *       400:
 *         description: ไม่ระบุ deleteReason
 *       401:
 *         description: ไม่ได้ login
 *       403:
 *         description: ไม่มีสิทธิ์ลบพนักงานสาขาอื่น
 *       404:
 *         description: ไม่พบพนักงาน
 */

/**
 * @swagger
 * /api/users/{id}/avatar:
 *   get:
 *     summary: ดึง URL รูปโปรไฟล์ (Avatar)
 *     description: |
 *       ดึง avatar URL ของพนักงาน สำหรับแสดงรูปโปรไฟล์ใน UI
 *       Avatar ถูก generate อัตโนมัติจาก Supabase Storage ตาม `avatarGender`
 *     tags:
 *       - Users
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: รหัสพนักงาน
 *         example: 5
 *     responses:
 *       200:
 *         description: Avatar URL
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     userId:
 *                       type: integer
 *                       example: 5
 *                     employeeId:
 *                       type: string
 *                       example: "BKK001"
 *                     avatarUrl:
 *                       type: string
 *                       nullable: true
 *                       example: "https://xxx.supabase.co/storage/v1/object/public/avatars/male-1.png"
 *       401:
 *         description: ไม่ได้ login
 *       404:
 *         description: ไม่พบพนักงาน
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     LoginRequest:
 *       type: object
 *       required:
 *         - employeeId
 *         - password
 *       properties:
 *         employeeId:
 *           type: string
 *           description: รหัสพนักงาน เช่น BKK001, CNX002
 *           example: "BKK0001"
 *         password:
 *           type: string
 *           description: รหัสผ่าน (nationalId เริ่มต้น หรือรหัสที่เปลี่ยนแล้ว)
 *           example: "4850495039640"
 *
 *     LoginResponse:
 *       type: object
 *       properties:
 *         accessToken:
 *           type: string
 *           description: Access Token แบบ JWT (HS256, อายุ 30 นาที)
 *           example: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
 *         refreshToken:
 *           type: string
 *           description: Refresh Token แบบ random hex (อายุ 7 วัน)
 *           example: "b7e1a4c3d9f2..."
 *         expiresIn:
 *           type: integer
 *           description: อายุของ accessToken หน่วยเป็นวินาที
 *           example: 1800
 *         dashboardMode:
 *           type: string
 *           enum: [superadmin, admin, manager, user]
 *           description: |
 *             บอก frontend ว่าควร redirect ไป dashboard ไหนหลัง login
 *             - `superadmin` — SuperAdmin ใช้ adminPassword
 *             - `admin` — Admin ใช้ adminPassword
 *             - `manager` — Manager ใช้รหัสปกติ
 *             - `user` — ทุก role ที่ใช้รหัสปกติ (รวม Admin/SuperAdmin)
 *           example: "user"
 *         user:
 *           $ref: '#/components/schemas/UserProfile'
 *
 *     UserProfile:
 *       type: object
 *       description: ข้อมูลพนักงานที่ใช้แสดงใน UI
 *       properties:
 *         userId:
 *           type: integer
 *           example: 5
 *         employeeId:
 *           type: string
 *           example: "BKK001"
 *           description: รหัสพนักงาน auto-generate
 *         title:
 *           type: string
 *           enum: [MR, MRS, MISS]
 *           example: "MR"
 *         firstName:
 *           type: string
 *           example: "สมชาย"
 *         lastName:
 *           type: string
 *           example: "ใจดี"
 *         nickname:
 *           type: string
 *           nullable: true
 *           example: "ชาย"
 *         gender:
 *           type: string
 *           enum: [MALE, FEMALE]
 *           example: "MALE"
 *         phone:
 *           type: string
 *           example: "0898765432"
 *         email:
 *           type: string
 *           format: email
 *           example: "somchai@example.com"
 *         birthDate:
 *           type: string
 *           format: date
 *           example: "1990-01-15"
 *         role:
 *           type: string
 *           enum: [USER, MANAGER, ADMIN, SUPERADMIN]
 *           example: "USER"
 *         status:
 *           type: string
 *           enum: [ACTIVE, INACTIVE, RESIGNED]
 *           example: "ACTIVE"
 *         branchId:
 *           type: integer
 *           example: 1
 *         avatarUrl:
 *           type: string
 *           nullable: true
 *           example: "https://xxx.supabase.co/storage/v1/object/public/avatars/male-1.png"
 *         department:
 *           type: string
 *           nullable: true
 *           example: "ฝ่ายขาย"
 *           description: แผนกที่พนักงานสังกัด
 *         position:
 *           type: string
 *           nullable: true
 *           example: "พนักงานขาย"
 *           description: ตำแหน่งงานของพนักงาน
 *         bloodType:
 *           type: string
 *           nullable: true
 *           example: "AB"
 *           description: หมู่เลือด (A, B, AB, O)
 *         adminPassword:
 *           type: string
 *           nullable: true
 *           description: |
 *             รหัสผ่านสำหรับเข้าหน้า Admin Dashboard (เฉพาะ role ADMIN/SUPERADMIN)
 *             ถ้าเป็น null = ไม่สามารถ login เป็น Admin ได้
 *           example: "adm456"
 *         emergent_tel:
 *           type: string
 *           example: "0812345678"
 *         emergent_first_name:
 *           type: string
 *           example: "สมหญิง"
 *         emergent_last_name:
 *           type: string
 *           example: "ใจดี"
 *         emergent_relation:
 *           type: string
 *           example: "ภรรยา"
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *
 *     CreateUserRequest:
 *       type: object
 *       required:
 *         - createdByUserId
 *         - creatorRole
 *         - title
 *         - firstName
 *         - lastName
 *         - gender
 *         - nationalId
 *         - emergent_tel
 *         - emergent_first_name
 *         - emergent_last_name
 *         - emergent_relation
 *         - phone
 *         - email
 *         - birthDate
 *         - branchId
 *       properties:
 *         createdByUserId:
 *           type: integer
 *           example: 1
 *           description: รหัส Admin ที่สร้าง (สำหรับ audit log)
 *         creatorRole:
 *           type: string
 *           enum: [ADMIN, SUPERADMIN]
 *           example: "ADMIN"
 *         creatorBranchId:
 *           type: integer
 *           example: 1
 *           description: สาขาของ Admin (จำเป็นถ้า creatorRole=ADMIN)
 *         title:
 *           type: string
 *           enum: [MR, MRS, MISS]
 *           example: "MR"
 *           description: คำนำหน้า MR=นาย, MRS=นาง, MISS=นางสาว
 *         firstName:
 *           type: string
 *           example: "สมชาย"
 *         lastName:
 *           type: string
 *           example: "ใจดี"
 *         nickname:
 *           type: string
 *           nullable: true
 *           example: "ชาย"
 *         gender:
 *           type: string
 *           enum: [MALE, FEMALE]
 *           example: "MALE"
 *         nationalId:
 *           type: string
 *           example: "1234567890123"
 *           description: เลขบัตรประชาชน 13 หลัก
 *         emergent_tel:
 *           type: string
 *           example: "0812345678"
 *           description: เบอร์ติดต่อฉุกเฉิน
 *         emergent_first_name:
 *           type: string
 *           example: "สมหญิง"
 *         emergent_last_name:
 *           type: string
 *           example: "ใจดี"
 *         emergent_relation:
 *           type: string
 *           example: "ภรรยา"
 *           description: ความสัมพันธ์กับผู้ติดต่อฉุกเฉิน
 *         phone:
 *           type: string
 *           example: "0898765432"
 *         email:
 *           type: string
 *           format: email
 *           example: "somchai@example.com"
 *         password:
 *           type: string
 *           nullable: true
 *           example: "MyCustomPass123"
 *           description: |
 *             รหัสผ่านเริ่มต้น (optional) — ถ้าไม่ระบุ ระบบจะใช้ `nationalId` เป็นรหัสเริ่มต้นให้อัตโนมัติ
 *             ค่าที่ส่งมา (หรือ nationalId) จะถูก hash ด้วย bcrypt เก็บใน `password` column
 *             พนักงาน login ด้วยค่านี้ได้ทันทีตั้งแต่วันแรก
 *         birthDate:
 *           type: string
 *           format: date
 *           example: "1990-01-15"
 *         branchId:
 *           type: integer
 *           example: 1
 *           description: สาขาที่พนักงานสังกัด (ใช้ generate employeeId)
 *         role:
 *           type: string
 *           enum: [USER, MANAGER, ADMIN, SUPERADMIN]
 *           default: USER
 *           example: "USER"
 *
 *     UpdateUserRequest:
 *       type: object
 *       required:
 *         - updatedByUserId
 *         - updaterRole
 *       properties:
 *         updatedByUserId:
 *           type: integer
 *           example: 1
 *           description: รหัส Admin ที่แก้ไข (สำหรับ audit log)
 *         updaterRole:
 *           type: string
 *           enum: [ADMIN, SUPERADMIN]
 *           example: "ADMIN"
 *         updaterBranchId:
 *           type: integer
 *           example: 1
 *           description: สาขาของ Admin ที่แก้ไข
 *         firstName:
 *           type: string
 *           example: "สมชาย"
 *         lastName:
 *           type: string
 *           example: "ใจดี"
 *         nickname:
 *           type: string
 *           example: "ชาย"
 *         phone:
 *           type: string
 *           example: "0898765432"
 *         email:
 *           type: string
 *           format: email
 *           example: "new-email@example.com"
 *         birthDate:
 *           type: string
 *           format: date
 *           example: "1990-01-15"
 *         branchId:
 *           type: integer
 *           example: 2
 *           description: โอนสาขา
 *         role:
 *           type: string
 *           enum: [USER, MANAGER, ADMIN, SUPERADMIN]
 *           example: "MANAGER"
 *         status:
 *           type: string
 *           enum: [ACTIVE, INACTIVE, RESIGNED]
 *           example: "ACTIVE"
 *         nationalId:
 *           type: string
 *           example: "1234567890123"
 *         emergent_tel:
 *           type: string
 *           example: "0812345678"
 *         emergent_first_name:
 *           type: string
 *           example: "สมหญิง"
 *         emergent_last_name:
 *           type: string
 *           example: "ใจดี"
 *         emergent_relation:
 *           type: string
 *           example: "ภรรยา"
 *         avatarGender:
 *           type: string
 *           enum: [male, female]
 *           example: "male"
 *           description: เปลี่ยน avatar ตามเพศ
 *         department:
 *           type: string
 *           nullable: true
 *           example: "ฝ่ายขาย"
 *           description: แผนกที่พนักงานสังกัด (null = ลบข้อมูล)
 *         position:
 *           type: string
 *           nullable: true
 *           example: "พนักงานขาย"
 *           description: ตำแหน่งงานของพนักงาน (null = ลบข้อมูล)
 *         bloodType:
 *           type: string
 *           nullable: true
 *           example: "AB"
 *           description: หมู่เลือด เช่น A, B, AB, O (null = ลบข้อมูล)
 *         password:
 *           type: string
 *           example: "NewPass@2026"
 *           description: |
 *             รีเซ็ตรหัสผ่านพนักงาน — จะถูก hash ด้วย bcrypt และเก็บใน password
 *             พนักงานสามารถใช้รหัสนี้ login เข้าระบบได้ทันที
 *             ถ้าไม่ระบุ = รหัสผ่านเดิมไม่เปลี่ยน
 */

// ════════════════════════════════════════════════════════════
// 📊 DASHBOARD ENDPOINTS
// ════════════════════════════════════════════════════════════

/**
 * @swagger
 * /api/dashboard/attendance-summary:
 *   get:
 *     summary: สรุป Attendance วันนี้ (Donut Chart)
 *     description: |
 *       ดึงจำนวนพนักงานแยกตามสถานะ (ON_TIME, LATE, ABSENT, LEAVE) ของวันที่ระบุ
 *       สำหรับแสดง Donut Chart บน Dashboard
 *
 *       **การนับ:**
 *       - `onTime` — สถานะ ON_TIME + LEAVE_APPROVED
 *       - `late` — สถานะ LATE
 *       - `absent` — สถานะ ABSENT
 *       - `leave` — มีใบลาอนุมัติ (leaveRequest status=APPROVED)
 *       - `total` — attendance + leave (ไม่ซ้ำกัน)
 *
 *       **Role-based:**
 *       - ADMIN → เห็นเฉพาะสาขาตัวเอง
 *       - SUPERADMIN → เห็นทั้งองค์กร (สามารถ filter branchId ได้)
 *     tags:
 *       - Dashboard
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: branchId
 *         schema:
 *           type: integer
 *           example: 1
 *         required: false
 *         description: |
 *           Filter เฉพาะสาขา (SUPERADMIN only)
 *           ADMIN จะใช้ branchId ของตัวเองอัตโนมัติ
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *           example: "2026-03-11"
 *         required: false
 *         description: วันที่ต้องการดู format YYYY-MM-DD (default = วันนี้)
 *         example: "2026-03-11"
 *     responses:
 *       200:
 *         description: สรุป attendance สำเร็จ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     onTime:
 *                       type: integer
 *                       example: 15
 *                       description: จำนวนพนักงานมาตรงเวลา (ON_TIME + LEAVE_APPROVED)
 *                     late:
 *                       type: integer
 *                       example: 3
 *                       description: จำนวนพนักงานมาสาย
 *                     absent:
 *                       type: integer
 *                       example: 2
 *                       description: จำนวนพนักงานขาดงาน
 *                     leave:
 *                       type: integer
 *                       example: 1
 *                       description: จำนวนพนักงานที่มีใบลาอนุมัติ
 *                     total:
 *                       type: integer
 *                       example: 21
 *                       description: จำนวนรวมทั้งหมด (attendance + leave)
 *             example:
 *               success: true
 *               data:
 *                 onTime: 15
 *                 late: 3
 *                 absent: 2
 *                 leave: 1
 *                 total: 21
 *       401:
 *         description: ไม่ได้ login
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /api/dashboard/employees-today:
 *   get:
 *     summary: รายชื่อพนักงานพร้อมสถานะวันนี้ (Table)
 *     description: |
 *       ดึงรายชื่อพนักงานทั้งหมดพร้อมสถานะ check-in/check-out ของวันที่ระบุ
 *       สำหรับแสดงเป็น Table บน Dashboard
 *
 *       **ข้อมูลที่ได้:**
 *       - employeeId, ชื่อ-นามสกุล, สาขา
 *       - สถานะ (ON_TIME / LATE / ABSENT / LEAVE)
 *       - เวลาเข้า-ออก (format HH:mm 24 ชม.)
 *       - จำนวนนาทีที่สาย
 *
 *       **หมายเหตุ:** พนักงานที่ลาจะแสดง status = "LEAVE"
 *       โดย checkIn/checkOut เป็น null
 *     tags:
 *       - Dashboard
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: branchId
 *         schema:
 *           type: integer
 *           example: 1
 *         required: false
 *         description: Filter เฉพาะสาขา (SUPERADMIN only)
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *           example: "2026-03-11"
 *         required: false
 *         description: วันที่ต้องการดู format YYYY-MM-DD (default = วันนี้)
 *         example: "2026-03-11"
 *     responses:
 *       200:
 *         description: ดึงข้อมูลพนักงานวันนี้สำเร็จ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       employeeId:
 *                         type: string
 *                         example: "BKK001"
 *                       name:
 *                         type: string
 *                         example: "สมชาย ใจดี"
 *                         description: firstName + lastName
 *                       branch:
 *                         type: string
 *                         example: "สาขากรุงเทพ"
 *                       status:
 *                         type: string
 *                         enum: [ON_TIME, LATE, ABSENT, LEAVE]
 *                         example: "ON_TIME"
 *                         description: |
 *                           สถานะจาก attendance หรือ "LEAVE" ถ้ามีใบลาอนุมัติ
 *                       checkIn:
 *                         type: string
 *                         nullable: true
 *                         example: "08:30"
 *                         description: เวลาเข้างาน (HH:mm 24h, null ถ้ายังไม่ check-in หรือลา)
 *                       checkOut:
 *                         type: string
 *                         nullable: true
 *                         example: "17:30"
 *                         description: เวลาออกงาน (HH:mm 24h, null ถ้ายังไม่ check-out)
 *                       lateMinutes:
 *                         type: integer
 *                         example: 0
 *                         description: จำนวนนาทีที่สาย (0 ถ้า ON_TIME หรือ LEAVE)
 *                 total:
 *                   type: integer
 *                   example: 25
 *       401:
 *         description: ไม่ได้ login
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /api/dashboard/branches-map:
 *   get:
 *     summary: ข้อมูลสาขาสำหรับ Map Pins
 *     description: |
 *       ดึงข้อมูลสาขาพร้อม lat/lng สำหรับแสดง pin บนแผนที่
 *       แต่ละ pin แสดงชื่อสาขา, จำนวนพนักงาน, ที่อยู่
 *
 *       **Role-based:**
 *       - ADMIN → เห็นเฉพาะสาขาตัวเอง (1 pin)
 *       - SUPERADMIN → เห็นทุกสาขา (หลาย pins)
 *     tags:
 *       - Dashboard
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: ดึงข้อมูลสาขาสำเร็จ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       branchId:
 *                         type: integer
 *                         example: 1
 *                       name:
 *                         type: string
 *                         example: "สำนักงานใหญ่"
 *                       latitude:
 *                         type: number
 *                         example: 13.7563
 *                       longitude:
 *                         type: number
 *                         example: 100.5018
 *                       totalEmployees:
 *                         type: integer
 *                         example: 25
 *                         description: จำนวนพนักงานในสาขา (จาก _count.users)
 *                       address:
 *                         type: string
 *                         nullable: true
 *                         example: "123 ถนนสาทร กรุงเทพฯ"
 *                 total:
 *                   type: integer
 *                   example: 3
 *       401:
 *         description: ไม่ได้ login
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /api/dashboard/location-events:
 *   get:
 *     summary: พนักงาน Check-in นอกพื้นที่ (Alert List)
 *     description: |
 *       ดึงรายชื่อพนักงานที่ check-in จากตำแหน่งที่อยู่นอก radius ที่กำหนด
 *       ใช้สำหรับ security monitoring / fraud detection
 *
 *       **Logic:** กรอง attendance วันที่ระบุ
 *       ที่มี location แต่ `checkInDistance > location.radius`
 *     tags:
 *       - Dashboard
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: branchId
 *         schema:
 *           type: integer
 *           example: 1
 *         required: false
 *         description: Filter เฉพาะสาขา (SUPERADMIN only)
 *       - in: query
 *         name: date
 *         schema:
 *           type: string
 *           format: date
 *           example: "2026-03-11"
 *         required: false
 *         description: วันที่ต้องการดู format YYYY-MM-DD (default = วันนี้)
 *         example: "2026-03-11"
 *     responses:
 *       200:
 *         description: ดึงเหตุการณ์นอกพื้นที่สำเร็จ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       eventId:
 *                         type: integer
 *                         example: 42
 *                         description: attendanceId ของ record นั้น (ชื่อ field เป็น eventId)
 *                       employeeName:
 *                         type: string
 *                         example: "สมชาย ใจดี"
 *                       checkInTime:
 *                         type: string
 *                         example: "08:45"
 *                         description: เวลา check-in (HH:mm 24h)
 *                       expectedLocation:
 *                         type: string
 *                         example: "สำนักงานใหญ่"
 *                         description: ชื่อ location ที่ควรอยู่
 *                       actualDistance:
 *                         type: number
 *                         example: 350
 *                         description: ระยะห่างจริง (เมตร)
 *                       allowedRadius:
 *                         type: number
 *                         example: 100
 *                         description: รัศมีที่อนุญาต (เมตร)
 *                       timestamp:
 *                         type: string
 *                         format: date-time
 *                         example: "2026-03-05T01:45:00.000Z"
 *                         description: createdAt ของ attendance record
 *                 total:
 *                   type: integer
 *                   example: 2
 *       401:
 *         description: ไม่ได้ login
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

// ════════════════════════════════════════════════════════════
// 🎉 EVENT ENDPOINTS
// ════════════════════════════════════════════════════════════

/**
 * @swagger
 * /api/events:
 *   post:
 *     summary: สร้างกิจกรรมใหม่ (Admin/SuperAdmin only)
 *     description: |
 *       สร้างกิจกรรมใหม่พร้อมกำหนดสถานที่, ช่วงเวลา, ผู้เข้าร่วม
 *
 *       **สถานที่จัดกิจกรรม (2 โหมด):**
 *       - **Mode A** (Location ที่มีอยู่): ส่ง `locationId` → ใช้พิกัดจาก Location table
 *       - **Mode B** (Custom venue): ส่ง `venueName` + `venueLatitude` + `venueLongitude`
 *       - ต้องเลือกอย่างน้อย 1 โหมด
 *
 *       **participantType rules:**
 *       - `ALL` → ไม่ต้องส่ง participants (ทุกคนเข้าร่วมได้)
 *       - `INDIVIDUAL` → ส่ง `participants.userIds`
 *       - `BRANCH` → ส่ง `participants.branchIds`
 *       - `ROLE` → ส่ง `participants.roles`
 *
 *       **Validation:**
 *       - ต้องระบุ eventName, startDateTime, endDateTime, participantType
 *       - startDateTime ต้องน้อยกว่า endDateTime
 *       - Location (mode A) ต้องมีอยู่จริงและยังไม่ถูกลบ
 *
 *       **เวลา/Timezone:**
 *       - ส่งวันเวลาแบบ ISO 8601 หากต้องการเวลาไทย (UTC+7) **ต้องใช้ `+07:00` suffix** เช่น `2026-03-20T09:00:00.000+07:00`
 *       - หากใช้ `Z` suffix เวลาจะถูกตีความว่า UTC (UTC+0) ซึ่งจะทำให้เวลาคลาดเคลื่อนไป 7 ชั่วโมง
 *     tags:
 *       - Events
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - eventName
 *               - startDateTime
 *               - endDateTime
 *               - participantType
 *             properties:
 *               eventName:
 *                 type: string
 *                 example: "ประชุมประจำเดือน"
 *               description:
 *                 type: string
 *                 example: "ประชุมสรุปผลงานประจำเดือนมีนาคม"
 *               locationId:
 *                 type: integer
 *                 description: Mode A — Location ที่มีอยู่ (FK → locations)
 *                 example: 5
 *               venueName:
 *                 type: string
 *                 description: Mode B — ชื่อสถานที่แบบ custom
 *                 example: "ห้องประชุม A ชั้น 3"
 *               venueLatitude:
 *                 type: number
 *                 description: Mode B — ละติจูด custom venue
 *                 example: 13.7563
 *               venueLongitude:
 *                 type: number
 *                 description: Mode B — ลองจิจูด custom venue
 *                 example: 100.5018
 *               startDateTime:
 *                 type: string
 *                 format: date-time
 *                 description: "เวลาเริ่มต้น — ใช้ offset +07:00 สำหรับเวลาไทย เช่น 09:00 น. ไทย = 2026-03-10T09:00:00.000+07:00"
 *                 example: "2026-03-10T09:00:00.000+07:00"
 *               endDateTime:
 *                 type: string
 *                 format: date-time
 *                 description: "เวลาสิ้นสุด — ใช้ offset +07:00 สำหรับเวลาไทย เช่น 17:00 น. ไทย = 2026-03-10T17:00:00.000+07:00"
 *                 example: "2026-03-10T17:00:00.000+07:00"
 *               participantType:
 *                 type: string
 *                 enum: [ALL, INDIVIDUAL, BRANCH, ROLE]
 *                 example: "ALL"
 *               participants:
 *                 type: object
 *                 description: ผู้เข้าร่วม (ไม่ต้องส่งถ้า participantType=ALL)
 *                 properties:
 *                   userIds:
 *                     type: array
 *                     items:
 *                       type: integer
 *                     description: สำหรับ INDIVIDUAL
 *                   branchIds:
 *                     type: array
 *                     items:
 *                       type: integer
 *                     description: สำหรับ BRANCH
 *                   roles:
 *                     type: array
 *                     items:
 *                       type: string
 *                       enum: [USER, MANAGER, ADMIN, SUPERADMIN]
 *                     description: สำหรับ ROLE
 *           example:
 *             eventName: "กิจกรรม Team Building"
 *             description: "กิจกรรมสร้างทีมประจำปี"
 *             locationId: 5
 *             startDateTime: "2026-03-20T09:00:00.000+07:00"
 *             endDateTime: "2026-03-20T17:00:00.000+07:00"
 *             participantType: "ALL"
 *     responses:
 *       201:
 *         description: สร้างกิจกรรมสำเร็จ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "สร้างกิจกรรมเรียบร้อยแล้ว"
 *                 data:
 *                   $ref: '#/components/schemas/Event'
 *       400:
 *         description: |
 *           ข้อมูลไม่ครบหรือไม่ถูกต้อง:
 *           - ไม่ระบุ eventName, startDateTime, endDateTime, participantType
 *           - ไม่ระบุสถานที่ (ต้องมี locationId หรือ venueName)
 *           - startDateTime >= endDateTime
 *           - ไม่พบ location ที่ระบุ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: ไม่ได้ login
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: ไม่มีสิทธิ์ (ต้องเป็น Admin/SuperAdmin)
 *
 *   get:
 *     summary: ดึงรายการกิจกรรมทั้งหมด (Authenticated)
 *     description: |
 *       ดึงกิจกรรมทั้งหมด (ที่ยังไม่ถูก soft delete) พร้อม pagination, search, filter
 *       ส่งคืนข้อมูลพร้อมสถิติ total/active/inactive
 *
 *       **Response data structure:** `data.data` = array กิจกรรม, `data.total/active/inactive` = สถิติ
 *     tags:
 *       - Events
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: ค้นหาจากชื่อหรือรายละเอียด (case-insensitive)
 *       - in: query
 *         name: participantType
 *         schema:
 *           type: string
 *           enum: [ALL, INDIVIDUAL, BRANCH, ROLE]
 *         description: กรองตามประเภทผู้เข้าร่วม
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: string
 *           enum: ["true", "false"]
 *         description: กรองตามสถานะ (true = active, false = inactive)
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: กรองกิจกรรมที่เริ่มหลังวันนี้
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: กรองกิจกรรมที่จบก่อนวันนี้
 *       - in: query
 *         name: skip
 *         schema:
 *           type: integer
 *           default: 0
 *         description: จำนวนที่ข้าม (pagination offset)
 *       - in: query
 *         name: take
 *         schema:
 *           type: integer
 *           default: 20
 *         description: จำนวนต่อหน้า
 *       - in: query
 *         name: branchId
 *         schema:
 *           type: integer
 *         description: กรองเฉพาะ Event ที่ participantType=ALL หรือ BRANCH ที่ตรงกับ branchId
 *     responses:
 *       200:
 *         description: ดึงรายการกิจกรรมสำเร็จ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "ดึงรายการกิจกรรมสำเร็จ"
 *                 data:
 *                   type: object
 *                   properties:
 *                     data:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/EventListItem'
 *                     total:
 *                       type: integer
 *                       example: 25
 *                       description: จำนวนกิจกรรมทั้งหมด (ไม่รวมที่ถูกลบ)
 *                     active:
 *                       type: integer
 *                       example: 20
 *                       description: จำนวนกิจกรรมที่ active
 *                     inactive:
 *                       type: integer
 *                       example: 5
 *                       description: จำนวนกิจกรรมที่ inactive
 *       401:
 *         description: ไม่ได้ login
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /api/events/my:
 *   get:
 *     summary: ดึงกิจกรรมที่ผู้ใช้เข้าร่วมได้ (Authenticated)
 *     description: |
 *       ดึงเฉพาะกิจกรรมที่เกี่ยวข้องกับผู้ใช้ปัจจุบัน ตาม participantType:
 *       - `ALL` → แสดงทุกกิจกรรม
 *       - `INDIVIDUAL` → แสดงเฉพาะที่มี userId ตรง
 *       - `BRANCH` → แสดงเฉพาะที่ branchId ตรง
 *       - `ROLE` → แสดงเฉพาะที่ role ตรง
 *
 *       แสดงเฉพาะกิจกรรมที่ **ยังไม่จบ** (endDateTime >= now), active, ไม่ถูกลบ
 *       เรียงตาม startDateTime ใกล้ที่สุดก่อน (ASC)
 *     tags:
 *       - Events
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: ดึงกิจกรรมสำเร็จ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "ดึงกิจกรรมที่เข้าร่วมสำเร็จ"
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       eventId:
 *                         type: integer
 *                         example: 1
 *                       eventName:
 *                         type: string
 *                         example: "กิจกรรม Team Building"
 *                       startDateTime:
 *                         type: string
 *                         format: date-time
 *                       endDateTime:
 *                         type: string
 *                         format: date-time
 *                       participantType:
 *                         type: string
 *                         enum: [ALL, INDIVIDUAL, BRANCH, ROLE]
 *                       isActive:
 *                         type: boolean
 *                       location:
 *                         type: object
 *                         nullable: true
 *                         properties:
 *                           locationId:
 *                             type: integer
 *                           locationName:
 *                             type: string
 *                           address:
 *                             type: string
 *                             nullable: true
 *                           latitude:
 *                             type: number
 *                           longitude:
 *                             type: number
 *                           radius:
 *                             type: number
 *                       _count:
 *                         type: object
 *                         properties:
 *                           attendance:
 *                             type: integer
 *                             example: 12
 *                             description: จำนวน attendance records ของกิจกรรมนี้
 *       401:
 *         description: ไม่ได้ login
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /api/events/statistics:
 *   get:
 *     summary: สถิติกิจกรรมภาพรวม (Admin/SuperAdmin only)
 *     description: |
 *       คำนวณสถิติกิจกรรมทั้งหมด (7 parallel queries):
 *       - `totalEvents` — จำนวนกิจกรรมที่ยังไม่ถูกลบ
 *       - `activeEvents` — isActive=true และไม่ถูกลบ
 *       - `upcomingEvents` — startDateTime > now
 *       - `ongoingEvents` — startDateTime <= now <= endDateTime
 *       - `pastEvents` — endDateTime < now
 *       - `deletedEvents` — deletedAt != null
 *       - `byParticipantType` — groupBy participantType (เฉพาะไม่ถูกลบ)
 *
 *       ใช้แสดง Stats Cards + Pie Chart บนหน้า Event Management
 *     tags:
 *       - Events
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: ดึงสถิติสำเร็จ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "ดึงสถิติกิจกรรมสำเร็จ"
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalEvents:
 *                       type: integer
 *                       example: 50
 *                     activeEvents:
 *                       type: integer
 *                       example: 35
 *                     upcomingEvents:
 *                       type: integer
 *                       example: 10
 *                     ongoingEvents:
 *                       type: integer
 *                       example: 5
 *                     pastEvents:
 *                       type: integer
 *                       example: 20
 *                     deletedEvents:
 *                       type: integer
 *                       example: 3
 *                     byParticipantType:
 *                       type: array
 *                       items:
 *                         type: object
 *                         properties:
 *                           type:
 *                             type: string
 *                             enum: [ALL, INDIVIDUAL, BRANCH, ROLE]
 *                           count:
 *                             type: integer
 *                       example:
 *                         - type: ALL
 *                           count: 20
 *                         - type: BRANCH
 *                           count: 15
 *                         - type: INDIVIDUAL
 *                           count: 10
 *                         - type: ROLE
 *                           count: 5
 *       401:
 *         description: ไม่ได้ login
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: ไม่มีสิทธิ์ (ต้องเป็น Admin/SuperAdmin)
 */

/**
 * @swagger
 * /api/events/{id}:
 *   get:
 *     summary: ดึงรายละเอียดกิจกรรมด้วย ID (Authenticated)
 *     description: |
 *       ดึงข้อมูลกิจกรรมแบบละเอียด รวมถึง:
 *       - สถานที่จัดกิจกรรม (location) — full object
 *       - ผู้สร้าง (creator) พร้อม email, role
 *       - ผู้แก้ไข (updatedBy), ผู้ลบ (deletedBy)
 *       - รายชื่อผู้เข้าร่วม (event_participants) พร้อม user/branch detail
 *       - จำนวน attendance (_count.attendance)
 *     tags:
 *       - Events
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *         description: Event ID
 *         example: 1
 *     responses:
 *       200:
 *         description: ดึงกิจกรรมสำเร็จ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/EventDetail'
 *       404:
 *         description: ไม่พบกิจกรรม
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: ไม่ได้ login
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *
 *   put:
 *     summary: แก้ไขกิจกรรม (Admin/SuperAdmin only)
 *     description: |
 *       แก้ไขข้อมูลกิจกรรม ส่งเฉพาะ field ที่ต้องการแก้ไข
 *
 *       **ข้อจำกัด:**
 *       - ไม่สามารถแก้กิจกรรมที่ถูก soft delete แล้ว
 *       - ถ้าเปลี่ยน participantType หรือ participants → ลบผู้เข้าร่วมเดิมและเพิ่มใหม่
 *       - startDateTime ต้องน้อยกว่า endDateTime (ถ้าส่งมาเปลี่ยน)
 *       - `locationId: null` จะล้าง location ออก
 *
 *       **เวลา/Timezone:**
 *       - ส่งวันเวลาแบบ ISO 8601 หากต้องการเวลาไทย (UTC+7) **ต้องใช้ `+07:00` suffix** เช่น `2026-03-20T22:40:00.000+07:00`
 *       - หากใช้ `Z` suffix เวลาจะถูกตีความว่า UTC (UTC+0) ซึ่งจะทำให้เวลาคลาดเคลื่อนไป 7 ชั่วโมง
 *     tags:
 *       - Events
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *         description: Event ID
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               eventName:
 *                 type: string
 *               description:
 *                 type: string
 *               locationId:
 *                 type: integer
 *                 nullable: true
 *                 description: null = ล้าง location, undefined = ไม่เปลี่ยน
 *               venueName:
 *                 type: string
 *               venueLatitude:
 *                 type: number
 *               venueLongitude:
 *                 type: number
 *               startDateTime:
 *                 type: string
 *                 format: date-time
 *                 description: "เวลาเริ่มต้น — ใช้ offset +07:00 สำหรับเวลาไทย เช่น 09:00 น. ไทย = 2026-03-10T09:00:00.000+07:00"
 *                 example: "2026-03-20T09:00:00.000+07:00"
 *               endDateTime:
 *                 type: string
 *                 format: date-time
 *                 description: "เวลาสิ้นสุด — ใช้ offset +07:00 สำหรับเวลาไทย เช่น 18:00 น. ไทย = 2026-03-20T18:00:00.000+07:00"
 *                 example: "2026-03-20T18:00:00.000+07:00"
 *               participantType:
 *                 type: string
 *                 enum: [ALL, INDIVIDUAL, BRANCH, ROLE]
 *               isActive:
 *                 type: boolean
 *               participants:
 *                 type: object
 *                 properties:
 *                   userIds:
 *                     type: array
 *                     items:
 *                       type: integer
 *                   branchIds:
 *                     type: array
 *                     items:
 *                       type: integer
 *                   roles:
 *                     type: array
 *                     items:
 *                       type: string
 *           example:
 *             eventName: "ประชุมประจำเดือน (แก้ไข)"
 *             startDateTime: "2026-03-20T09:00:00.000+07:00"
 *             endDateTime: "2026-03-20T18:00:00.000+07:00"
 *     responses:
 *       200:
 *         description: แก้ไขกิจกรรมสำเร็จ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "แก้ไขกิจกรรมเรียบร้อยแล้ว"
 *                 data:
 *                   $ref: '#/components/schemas/Event'
 *       400:
 *         description: ข้อมูลไม่ถูกต้อง หรือกิจกรรมถูก soft delete แล้ว
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: ไม่พบกิจกรรม
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: ไม่ได้ login
 *       403:
 *         description: ไม่มีสิทธิ์ (ต้องเป็น Admin/SuperAdmin)
 *
 *   delete:
 *     summary: ลบกิจกรรม — Soft Delete (Admin/SuperAdmin only)
 *     description: |
 *       Soft delete กิจกรรม (set deletedAt + isActive=false)
 *
 *       **ข้อจำกัด:**
 *       - ไม่สามารถลบกิจกรรมที่กำลังดำเนินการอยู่ (startDateTime <= now <= endDateTime)
 *       - ไม่สามารถลบกิจกรรมที่ถูก soft delete แล้ว
 *       - สามารถกู้คืนได้ด้วย POST /api/events/:id/restore
 *     tags:
 *       - Events
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *         description: Event ID
 *         example: 1
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               deleteReason:
 *                 type: string
 *                 example: "ยกเลิกกิจกรรมเนื่องจากสถานที่ไม่พร้อม"
 *                 description: เหตุผลในการลบ (optional)
 *     responses:
 *       200:
 *         description: ลบกิจกรรมสำเร็จ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "ลบกิจกรรมเรียบร้อยแล้ว"
 *                 data:
 *                   $ref: '#/components/schemas/Event'
 *       400:
 *         description: ไม่สามารถลบกิจกรรมที่กำลังดำเนินการ หรือถูกลบแล้ว
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: ไม่พบกิจกรรม
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: ไม่ได้ login
 *       403:
 *         description: ไม่มีสิทธิ์ (ต้องเป็น Admin/SuperAdmin)
 */

/**
 * @swagger
 * /api/events/{id}/restore:
 *   post:
 *     summary: กู้คืนกิจกรรมที่ถูกลบ (Admin/SuperAdmin only)
 *     description: |
 *       กู้คืนกิจกรรมที่ถูก soft delete กลับมา
 *       (set deletedAt=null, deletedByUserId=null, deleteReason=null)
 *
 *       **หมายเหตุ:** isActive จะยังเป็น false — ต้อง PUT แยกถ้าต้องการเปิดใช้งาน
 *     tags:
 *       - Events
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *         description: Event ID
 *         example: 1
 *     responses:
 *       200:
 *         description: กู้คืนกิจกรรมสำเร็จ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "กู้คืนกิจกรรมเรียบร้อยแล้ว"
 *                 data:
 *                   $ref: '#/components/schemas/Event'
 *       400:
 *         description: กิจกรรมนี้ยังไม่ถูกลบ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: ไม่พบกิจกรรม
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: ไม่ได้ login
 *       403:
 *         description: ไม่มีสิทธิ์ (ต้องเป็น Admin/SuperAdmin)
 */

/**
 * @swagger
 * /api/events/{id}/checkin:
 *   post:
 *     summary: เข้าร่วมกิจกรรม — Event Check-In (Authenticated)
 *     description: |
 *       บันทึกเวลาเข้าร่วมกิจกรรมพร้อม GPS และรูปภาพ
 *
 *       **Flow การทำงาน:**
 *       1. ตรวจสอบว่ากิจกรรม active, ไม่ถูกลบ, อยู่ในช่วงเวลา (start ≤ now ≤ end)
 *       2. ตรวจสอบว่าผู้ใช้มีสิทธิ์เข้าร่วม (ตาม participantType)
 *       3. ตรวจสอบว่ายังไม่เคย check-in กิจกรรมนี้ (1 user : 1 check-in per event)
 *       4. ตรวจสอบ GPS (ถ้ามีสถานที่):
 *          - **Mode A** (locationId): ใช้พิกัดและ radius จาก Location table
 *          - **Mode B** (custom venue): ใช้ venueLatitude/venueLongitude, radius=500m
 *       5. สร้าง Attendance record (eventId, shiftId=null, status=ON_TIME, lateMinutes=0)
 *       6. สร้าง audit log
 *
 *       **Attendance status:** จะเป็น `ON_TIME` เสมอ (เพราะ event ไม่มี concept ของ late)
 *     tags:
 *       - Events
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *         description: Event ID
 *         example: 1
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               latitude:
 *                 type: number
 *                 example: 13.7563
 *                 description: GPS latitude (ไม่ล้อง GPS ไม่ต้องใส่)
 *               longitude:
 *                 type: number
 *                 example: 100.5018
 *                 description: GPS longitude
 *               address:
 *                 type: string
 *                 example: "อาคาร A ชั้น 3, กรุงเทพฯ"
 *                 description: ที่อยู่ text
 *           example:
 *             latitude: 13.7563
 *             longitude: 100.5018
 *             address: "อาคาร A ชั้น 3, กรุงเทพฯ"
 *     responses:
 *       201:
 *         description: เข้าร่วมกิจกรรมสำเร็จ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "เข้าร่วมกิจกรรมสำเร็จ"
 *                 data:
 *                   $ref: '#/components/schemas/EventAttendance'
 *       400:
 *         description: |
 *           สาเหตุที่เป็นไปได้:
 *           - กิจกรรมไม่ active หรือถูกลบ
 *           - ยังไม่ถึงเวลาหรือเลยเวลากิจกรรม
 *           - ผู้ใช้ไม่มีสิทธิ์เข้าร่วม
 *           - check-in ซ้ำ (เคย check-in แล้ว)
 *           - อยู่นอกพื้นที่ GPS (distance > radius)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: ไม่พบกิจกรรม
 *       401:
 *         description: ไม่ได้ login
 */

/**
 * @swagger
 * /api/events/{id}/checkout:
 *   post:
 *     summary: ออกจากกิจกรรม — Event Check-Out (Authenticated)
 *     description: |
 *       บันทึกเวลาออกจากกิจกรรม โดยอัปเดต attendance record ที่ check-in ไว้
 *
 *       **Logic:**
 *       1. หา attendance ที่ checkOut=null สำหรับ user+event นี้
 *       2. ตรวจสอบ GPS (ถ้า attendance เดิมมี locationId) — ใช้ radius เดียวกับ check-in
 *       3. อัปเดต checkOut fields
 *
 *       **หมายเหตุ:** Custom venue (Mode B) ไม่ตรวจ GPS ตอน checkout
 *     tags:
 *       - Events
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *         description: Event ID
 *         example: 1
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               latitude:
 *                 type: number
 *                 example: 13.7563
 *               longitude:
 *                 type: number
 *                 example: 100.5018
 *               address:
 *                 type: string
 *                 example: "อาคาร A ชั้น 3, กรุงเทพฯ"
 *           example:
 *             latitude: 13.7563
 *             longitude: 100.5018
 *             address: "อาคาร A ชั้น 3, กรุงเทพฯ"
 *     responses:
 *       200:
 *         description: ออกจากกิจกรรมสำเร็จ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "ออกจากกิจกรรมสำเร็จ"
 *                 data:
 *                   $ref: '#/components/schemas/EventAttendance'
 *       400:
 *         description: |
 *           สาเหตุที่เป็นไปได้:
 *           - ยังไม่เคย check-in กิจกรรมนี้
 *           - check-out ไปแล้ว
 *           - อยู่นอกพื้นที่ GPS
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: ไม่พบกิจกรรม หรือไม่พบ attendance record
 *       401:
 *         description: ไม่ได้ login
 */

/**
 * @swagger
 * /api/events/{id}/my-attendance:
 *   get:
 *     summary: ดูสถานะการเข้าร่วมกิจกรรมของตัวเอง (Authenticated)
 *     description: |
 *       ตรวจสอบว่าผู้ใช้ปัจจุบัน check-in/check-out กิจกรรมนี้แล้วหรือยัง
 *       ใช้สำหรับแสดงปุ่ม Check-in / Check-out ในหน้า Event Detail
 *
 *       **Response:**
 *       - `checkedIn: false` → แสดงปุ่ม Check-in
 *       - `checkedIn: true, checkedOut: false` → แสดงปุ่ม Check-out
 *       - `checkedIn: true, checkedOut: true` → แสดง "เข้าร่วมแล้ว"
 *     tags:
 *       - Events
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           example: 1
 *         description: Event ID
 *         example: 1
 *     responses:
 *       200:
 *         description: ดึงสถานะสำเร็จ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     checkedIn:
 *                       type: boolean
 *                       example: true
 *                       description: true = เคย check-in แล้ว
 *                     checkedOut:
 *                       type: boolean
 *                       example: false
 *                       description: true = เคย check-out แล้ว
 *                     attendance:
 *                       type: object
 *                       nullable: true
 *                       description: null ถ้ายังไม่เคย check-in
 *                       properties:
 *                         attendanceId:
 *                           type: integer
 *                           example: 100
 *                         checkIn:
 *                           type: string
 *                           format: date-time
 *                         checkOut:
 *                           type: string
 *                           format: date-time
 *                           nullable: true
 *                         checkInPhoto:
 *                           type: string
 *                           nullable: true
 *                         checkOutPhoto:
 *                           type: string
 *                           nullable: true
 *                         status:
 *                           type: string
 *                           example: "ON_TIME"
 *             examples:
 *               ยังไม่ check-in:
 *                 value:
 *                   success: true
 *                   data:
 *                     checkedIn: false
 *                     checkedOut: false
 *                     attendance: null
 *               check-in แล้ว:
 *                 value:
 *                   success: true
 *                   data:
 *                     checkedIn: true
 *                     checkedOut: false
 *                     attendance:
 *                       attendanceId: 100
 *                       checkIn: "2026-03-05T08:00:00.000+07:00"
 *                       checkOut: null
 *                       checkInPhoto: null
 *                       checkOutPhoto: null
 *                       status: "ON_TIME"
 *               check-out แล้ว:
 *                 value:
 *                   success: true
 *                   data:
 *                     checkedIn: true
 *                     checkedOut: true
 *                     attendance:
 *                       attendanceId: 100
 *                       checkIn: "2026-03-05T08:00:00.000+07:00"
 *                       checkOut: "2026-03-05T17:00:00.000+07:00"
 *                       checkInPhoto: null
 *                       checkOutPhoto: null
 *                       status: "ON_TIME"
 *       401:
 *         description: ไม่ได้ login
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

// ════════════════════════════════════════════════════════════
// 📥 DOWNLOAD REPORT ENDPOINTS
// ════════════════════════════════════════════════════════════

/**
 * @swagger
 * /api/download/report:
 *   get:
 *     summary: ดาวน์โหลดรายงาน Attendance/Shift (Excel)
 *     description: |
 *       สร้างและดาวน์โหลดรายงานเป็นไฟล์ Excel (.xlsx)
 *
 *       **ประเภทรายงาน:**
 *       - `attendance` — ประวัติเข้า-ออกงาน (Employee ID, Name, Check In/Out, Status, Late Minutes)
 *       - `shift` — ข้อมูลกะงาน (Employee ID, Name, Shift Name, Type, Start/End Time, Active)
 *
 *       **Role-based:**
 *       - ADMIN → ดาวน์โหลดเฉพาะสาขาตัวเอง
 *       - SUPERADMIN → ดาวน์โหลดได้ทั้งองค์กร + filter branchId ได้
 *
 *       **Response:** Binary file (ไม่ใช่ JSON)
 *       - Content-Type: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
 *       - Content-Disposition: `attachment; filename="..."`
 *
 *       **ข้อจำกัด:** ดึงสูงสุด 100 records ต่อครั้ง
 *     tags:
 *       - Download Report
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: type
 *         required: true
 *         schema:
 *           type: string
 *           enum: [attendance, shift]
 *           example: "attendance"
 *         description: ประเภทรายงาน — attendance หรือ shift
 *         example: "attendance"
 *       - in: query
 *         name: format
 *         required: true
 *         schema:
 *           type: string
 *           enum: [excel]
 *           example: "excel"
 *         description: รูปแบบไฟล์ (excel เท่านั้น)
 *         example: "excel"
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *           example: "2026-01-01"
 *         description: วันเริ่มต้น (default = 1 ม.ค. ปีนี้)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *           example: "2026-12-31"
 *         description: วันสิ้นสุด (default = วันนี้)
 *       - in: query
 *         name: branchId
 *         schema:
 *           type: integer
 *         description: Filter สาขา (SUPERADMIN only, ADMIN ใช้สาขาตัวเอง)
 *     responses:
 *       200:
 *         description: ไฟล์รายงาน (binary download)
 *         content:
 *           application/vnd.openxmlformats-officedocument.spreadsheetml.sheet:
 *             schema:
 *               type: string
 *               format: binary
 *       400:
 *         description: ข้อมูลไม่ครบ (type หรือ format ไม่ถูกต้อง)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         description: ไม่ได้ login
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /api/download/history:
 *   get:
 *     summary: ดูประวัติการดาวน์โหลด (Audit Trail)
 *     description: |
 *       ดึงประวัติการดาวน์โหลดรายงาน — ใครดาวน์โหลดอะไร เมื่อไร
 *
 *       **Role-based:**
 *       - ADMIN → เห็นเฉพาะ history ของตัวเอง
 *       - SUPERADMIN → เห็นทั้งองค์กร
 *
 *       **Pagination:**
 *       - `limit` — จำนวน record ต่อหน้า (default: 10)
 *       - `offset` — ข้าม records (page 2 ใช้ offset = limit)
 *     tags:
 *       - Download Report
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: จำนวน record ต่อหน้า
 *       - in: query
 *         name: offset
 *         schema:
 *           type: integer
 *           default: 0
 *         description: จำนวน record ที่ข้าม (pagination)
 *     responses:
 *       200:
 *         description: ดึงประวัติดาวน์โหลดสำเร็จ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/DownloadLog'
 *                 pagination:
 *                   type: object
 *                   properties:
 *                     limit:
 *                       type: integer
 *                       example: 10
 *                     offset:
 *                       type: integer
 *                       example: 0
 *                     total:
 *                       type: integer
 *                       example: 5
 *       401:
 *         description: ไม่ได้ login
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

// ============================================================
// 📢 Announcements
// ============================================================

/**
 * @swagger
 * /api/announcements:
 *   post:
 *     summary: สร้างประกาศใหม่ (Admin/SuperAdmin only)
 *     description: |
 *       สร้างประกาศใหม่ในสถานะ DRAFT
 *
 *       **ทำไมต้องเป็น DRAFT ก่อน?**
 *       เพื่อให้ Admin ตรวจทานก่อนส่งจริง เมื่อส่งแล้วจะเป็น immutable
 *
 *       **targetRoles / targetBranchIds:**
 *       - ว่างทั้งคู่ = ส่งหาทุกคนในองค์กร
 *       - ระบุ roles = ส่งเฉพาะ role นั้น ๆ
 *       - ระบุ branchIds = ส่งเฉพาะสาขานั้น ๆ
 *     tags:
 *       - Announcements
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateAnnouncementRequest'
 *           examples:
 *             ส่งทุกคน:
 *               summary: ประกาศทั่วไปส่งทุกคนทุกสาขา
 *               value:
 *                 title: "ประกาศหยุดวันสงกรานต์"
 *                 content: "บริษัทหยุดวันสงกรานต์ตั้งแต่ 13-15 เมษายน 2026"
 *             ส่งเฉพาะสาขา:
 *               summary: ประกาศเฉพาะสาขา BKK
 *               value:
 *                 title: "ประชุมทีม BKK"
 *                 content: "ขอเชิญพนักงานสาขา BKK เข้าประชุมวันศุกร์"
 *                 targetBranchIds: [1]
 *             ส่งเฉพาะ role:
 *               summary: ประกาศเฉพาะ MANAGER
 *               value:
 *                 title: "ประชุมผู้บริหาร"
 *                 content: "นัดประชุมผู้จัดการทุกสาขา"
 *                 targetRoles: ["MANAGER"]
 *     responses:
 *       201:
 *         description: สร้างประกาศสำเร็จ (status = DRAFT)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Announcement'
 *                 message:
 *                   type: string
 *                   example: สร้างประกาศเรียบร้อยแล้ว
 *       400:
 *         description: ไม่ได้ส่ง title หรือ content
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         $ref: '#/components/responses/Unauthorized'
 *       403:
 *         description: ไม่มีสิทธิ์ (ต้องเป็น Admin หรือ SuperAdmin)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   get:
 *     summary: ดึงรายการประกาศทั้งหมด (Authenticated)
 *     description: |
 *       ดึงประกาศทั้งหมดที่ยังไม่ถูก soft-delete
 *       เรียงจากใหม่ → เก่า (`createdAt DESC`)
 *     tags:
 *       - Announcements
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [DRAFT, SENT]
 *         description: กรองตามสถานะ — ไม่ระบุ = ดึงทุกสถานะ
 *       - in: query
 *         name: createdByUserId
 *         schema:
 *           type: integer
 *         description: กรองเฉพาะประกาศที่สร้างโดย userId นี้
 *     responses:
 *       200:
 *         description: ดึงรายการประกาศสำเร็จ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Announcement'
 *       401:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /api/announcements/{id}:
 *   get:
 *     summary: ดึงประกาศตาม ID พร้อมรายชื่อผู้รับ
 *     description: |
 *       ดึงประกาศรายชิ้นพร้อม JOIN recipients และ creator
 *       ถ้าประกาศถูก soft-delete จะได้ 404
 *     tags:
 *       - Announcements
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: announcementId
 *     responses:
 *       200:
 *         description: ดึงประกาศสำเร็จ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/AnnouncementWithRecipients'
 *       404:
 *         description: ไม่พบประกาศ (หรือถูก soft-delete แล้ว)
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       401:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   put:
 *     summary: แก้ไขประกาศ — DRAFT เท่านั้น (Admin/SuperAdmin only)
 *     description: |
 *       แก้ไขได้เฉพาะประกาศที่ยังเป็น **DRAFT**
 *       รองรับ partial update — ส่งแค่ field ที่ต้องการเปลี่ยน
 *
 *       **ทำไมแก้ไขไม่ได้หลัง SENT?**
 *       มีคนรับข้อมูลไปแล้ว การแก้ไขทำให้ DB ไม่ตรงกับที่ผู้รับได้รับจริง
 *     tags:
 *       - Announcements
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: announcementId ที่ต้องการแก้ไข
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdateAnnouncementRequest'
 *           example:
 *             title: "ประกาศฉบับแก้ไข"
 *             content: "เนื้อหาใหม่"
 *     responses:
 *       200:
 *         description: อัปเดตประกาศสำเร็จ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   $ref: '#/components/schemas/Announcement'
 *                 message:
 *                   type: string
 *                   example: อัปเดตประกาศเรียบร้อยแล้ว
 *       400:
 *         description: ประกาศอยู่ในสถานะ SENT แก้ไขไม่ได้
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *   delete:
 *     summary: ลบประกาศ (Soft Delete) — Admin/SuperAdmin only
 *     description: |
 *       Soft Delete ประกาศ — ตั้งค่า `deletedAt` และ `deleteReason`
 *       ประกาศไม่ปรากฏใน list แต่ยังอยู่ใน DB เพื่อ audit trail
 *
 *       **ทำไมต้อง deleteReason?**
 *       เพื่อให้ audit log มีบริบท — รู้ว่าลบเพราะอะไร
 *     tags:
 *       - Announcements
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: announcementId ที่ต้องการลบ
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - deleteReason
 *             properties:
 *               deleteReason:
 *                 type: string
 *                 example: "ข้อมูลผิดพลาด ต้องการสร้างใหม่"
 *     responses:
 *       200:
 *         description: ลบประกาศสำเร็จ (Soft Delete)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: ลบประกาศเรียบร้อยแล้ว (Soft Delete)
 *       400:
 *         description: ไม่ได้ส่ง deleteReason
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /api/announcements/{id}/send:
 *   post:
 *     summary: ส่งประกาศ DRAFT → SENT (Admin/SuperAdmin only)
 *     description: |
 *       เปลี่ยน status จาก DRAFT → SENT บันทึก recipients และส่งอีเมลอัตโนมัติ
 *
 *       **Permission rules:**
 *       - **ADMIN**: ส่งได้เฉพาะใน branch ตัวเอง, ไม่สามารถส่งให้ SUPERADMIN
 *       - **SUPERADMIN**: ส่งได้ทุกคน ทุก branch ทุก role
 *
 *       **Email (fire-and-forget):**
 *       Resend ส่งอีเมลแบบ async — API response กลับมาทันที ไม่รอ delivery
 *     tags:
 *       - Announcements
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: announcementId ที่ต้องการส่ง (ต้องเป็น DRAFT)
 *     responses:
 *       200:
 *         description: ส่งประกาศสำเร็จ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     announcement:
 *                       $ref: '#/components/schemas/Announcement'
 *                     recipientCount:
 *                       type: integer
 *                       example: 42
 *                 message:
 *                   type: string
 *                   example: "ส่งประกาศเรียบร้อยแล้ว ส่งให้ 42 คน"
 *       400:
 *         description: ประกาศไม่ได้อยู่ในสถานะ DRAFT
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         description: ไม่มีสิทธิ์ส่ง
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       404:
 *         description: ไม่พบประกาศ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /api/announcements/{announcementId}/recipients/{recipientId}:
 *   delete:
 *     summary: ลบผู้รับออก 1 คน (Admin/SuperAdmin only)
 *     description: |
 *       ลบ recipient record ออกจาก `announcement_recipients`
 *       ใช้เมื่อต้องการ revoke การส่งของพนักงานคนนั้นโดยไม่กระทบคนอื่น
 *     tags:
 *       - Announcements
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: announcementId
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: recipientId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: ลบผู้รับสำเร็จ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: ลบผู้รับประกาศเรียบร้อยแล้ว
 *       404:
 *         description: ไม่พบ recipient
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

/**
 * @swagger
 * /api/announcements/{announcementId}/recipients:
 *   delete:
 *     summary: ล้างผู้รับทั้งหมดของประกาศ (Admin/SuperAdmin only)
 *     description: |
 *       Hard-delete recipients ทั้งหมดใน `announcement_recipients` ของประกาศนี้
 *
 *       **ทำไมต้องมี endpoint นี้?**
 *       ใช้ก่อน re-send ประกาศให้กลุ่มใหม่ — ต้องล้างก่อนแล้วค่อย send ใหม่
 *       ป้องกัน duplicate records ใน announcement_recipients
 *     tags:
 *       - Announcements
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: announcementId
 *         required: true
 *         schema:
 *           type: integer
 *         description: announcementId ที่ต้องการล้าง recipients
 *     responses:
 *       200:
 *         description: ล้างผู้รับสำเร็จ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     clearedCount:
 *                       type: integer
 *                       example: 35
 *                 message:
 *                   type: string
 *                   example: "ล้างผู้รับประกาศเรียบร้อยแล้ว ลบ 35 รายการ"
 *       404:
 *         description: ไม่พบประกาศ
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 *       403:
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ErrorResponse'
 */

// ════════════════════════════════════════════════════════════
// 📐 COMPONENT SCHEMAS — Dashboard, Events, Shared
// ════════════════════════════════════════════════════════════

/**
 * @swagger
 * components:
 *   schemas:
 *     ErrorResponse:
 *       type: object
 *       properties:
 *         success:
 *           type: boolean
 *           example: false
 *         error:
 *           type: string
 *           example: "ข้อมูลไม่ถูกต้อง"
 *
 *     Event:
 *       type: object
 *       description: |
 *         ข้อมูลกิจกรรม (base) — ส่งกลับจาก create/update/delete/restore
 *         `sendSuccess()` จะแปลง dates เป็นเวลาไทย (UTC+7)
 *       properties:
 *         eventId:
 *           type: integer
 *           example: 1
 *         eventName:
 *           type: string
 *           example: "กิจกรรม Team Building"
 *         description:
 *           type: string
 *           nullable: true
 *           example: "กิจกรรมสร้างทีมประจำปี"
 *         locationId:
 *           type: integer
 *           nullable: true
 *           example: 5
 *           description: FK → Location (null ถ้าใช้ custom venue)
 *         venueName:
 *           type: string
 *           nullable: true
 *           example: "ห้องประชุม A ชั้น 3"
 *           description: ชื่อสถานที่แบบ custom (null ถ้าใช้ locationId)
 *         venueLatitude:
 *           type: number
 *           nullable: true
 *           example: 13.7563
 *         venueLongitude:
 *           type: number
 *           nullable: true
 *           example: 100.5018
 *         startDateTime:
 *           type: string
 *           format: date-time
 *           example: "2026-03-10T09:00:00.000+07:00"
 *         endDateTime:
 *           type: string
 *           format: date-time
 *           example: "2026-03-10T17:00:00.000+07:00"
 *         participantType:
 *           type: string
 *           enum: [ALL, INDIVIDUAL, BRANCH, ROLE]
 *           example: "ALL"
 *         isActive:
 *           type: boolean
 *           example: true
 *         createdByUserId:
 *           type: integer
 *           example: 1
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedByUserId:
 *           type: integer
 *           nullable: true
 *         updatedAt:
 *           type: string
 *           format: date-time
 *         deletedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *         deletedByUserId:
 *           type: integer
 *           nullable: true
 *         deleteReason:
 *           type: string
 *           nullable: true
 *         location:
 *           type: object
 *           nullable: true
 *           properties:
 *             locationId:
 *               type: integer
 *             locationName:
 *               type: string
 *             address:
 *               type: string
 *               nullable: true
 *             latitude:
 *               type: number
 *             longitude:
 *               type: number
 *             radius:
 *               type: number
 *               description: รัศมีที่อนุญาต (เมตร)
 *         creator:
 *           type: object
 *           properties:
 *             userId:
 *               type: integer
 *             firstName:
 *               type: string
 *             lastName:
 *               type: string
 *         updatedBy:
 *           type: object
 *           nullable: true
 *           properties:
 *             userId:
 *               type: integer
 *             firstName:
 *               type: string
 *             lastName:
 *               type: string
 *
 *     EventListItem:
 *       type: object
 *       description: |
 *         กิจกรรมใน list (GET /api/events) — ข้อมูลเหมือน Event
 *         แต่เพิ่ม _count และ event_participants สำหรับ filtering
 *       allOf:
 *         - $ref: '#/components/schemas/Event'
 *         - type: object
 *           properties:
 *             _count:
 *               type: object
 *               properties:
 *                 event_participants:
 *                   type: integer
 *                   example: 5
 *                   description: จำนวนผู้เข้าร่วมที่กำหนดไว้
 *                 attendance:
 *                   type: integer
 *                   example: 12
 *                   description: จำนวน attendance records
 *             event_participants:
 *               type: array
 *               description: branchId จากผู้เข้าร่วม (ใช้กรอง branch)
 *               items:
 *                 type: object
 *                 properties:
 *                   branchId:
 *                     type: integer
 *                     nullable: true
 *
 *     EventDetail:
 *       type: object
 *       description: |
 *         กิจกรรมแบบละเอียด (GET /api/events/:id)
 *         เพิ่ม event_participants แบบเต็ม, creator พร้อม email/role, deletedBy
 *       allOf:
 *         - $ref: '#/components/schemas/Event'
 *         - type: object
 *           properties:
 *             creator:
 *               type: object
 *               properties:
 *                 userId:
 *                   type: integer
 *                 firstName:
 *                   type: string
 *                 lastName:
 *                   type: string
 *                 email:
 *                   type: string
 *                 role:
 *                   type: string
 *                   enum: [USER, MANAGER, ADMIN, SUPERADMIN]
 *             deletedBy:
 *               type: object
 *               nullable: true
 *               properties:
 *                 userId:
 *                   type: integer
 *                 firstName:
 *                   type: string
 *                 lastName:
 *                   type: string
 *             event_participants:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   users:
 *                     type: object
 *                     nullable: true
 *                     description: ข้อมูล user (participantType=INDIVIDUAL)
 *                     properties:
 *                       userId:
 *                         type: integer
 *                       firstName:
 *                         type: string
 *                       lastName:
 *                         type: string
 *                       email:
 *                         type: string
 *                   branches:
 *                     type: object
 *                     nullable: true
 *                     description: ข้อมูล branch (participantType=BRANCH)
 *                     properties:
 *                       branchId:
 *                         type: integer
 *                       name:
 *                         type: string
 *                       code:
 *                         type: string
 *             _count:
 *               type: object
 *               properties:
 *                 attendance:
 *                   type: integer
 *                   example: 12
 *
 *     EventAttendance:
 *       type: object
 *       description: |
 *         Attendance record ของ event check-in/check-out
 *         dates ถูกแปลงเป็นเวลาไทย (UTC+7) โดย sendSuccess()
 *       properties:
 *         attendanceId:
 *           type: integer
 *           example: 100
 *         userId:
 *           type: integer
 *           example: 5
 *         eventId:
 *           type: integer
 *           example: 1
 *         locationId:
 *           type: integer
 *           nullable: true
 *           example: 5
 *         shiftId:
 *           type: integer
 *           nullable: true
 *           description: เป็น null เสมอสำหรับ event attendance
 *         checkIn:
 *           type: string
 *           format: date-time
 *           example: "2026-03-05T08:00:00.000+07:00"
 *         checkInPhoto:
 *           type: string
 *           nullable: true
 *           description: Base64 selfie ตอนเข้าร่วม
 *         checkInLat:
 *           type: number
 *           nullable: true
 *           example: 13.7563
 *         checkInLng:
 *           type: number
 *           nullable: true
 *           example: 100.5018
 *         checkInAddress:
 *           type: string
 *           nullable: true
 *         checkInDistance:
 *           type: number
 *           nullable: true
 *           example: 45.3
 *           description: ระยะห่างจาก location/venue center (เมตร)
 *         checkOut:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           example: "2026-03-05T17:00:00.000+07:00"
 *         checkOutPhoto:
 *           type: string
 *           nullable: true
 *         checkOutLat:
 *           type: number
 *           nullable: true
 *         checkOutLng:
 *           type: number
 *           nullable: true
 *         checkOutAddress:
 *           type: string
 *           nullable: true
 *         checkOutDistance:
 *           type: number
 *           nullable: true
 *         status:
 *           type: string
 *           example: "ON_TIME"
 *           description: เป็น ON_TIME เสมอสำหรับ event check-in
 *         lateMinutes:
 *           type: integer
 *           example: 0
 *           description: เป็น 0 เสมอสำหรับ event check-in
 *         note:
 *           type: string
 *           nullable: true
 *           example: "เข้าร่วมกิจกรรม: กิจกรรม Team Building"
 *         user:
 *           type: object
 *           properties:
 *             userId:
 *               type: integer
 *             firstName:
 *               type: string
 *             lastName:
 *               type: string
 *             employeeId:
 *               type: string
 *         event:
 *           type: object
 *           properties:
 *             eventId:
 *               type: integer
 *             eventName:
 *               type: string
 *         location:
 *           type: object
 *           nullable: true
 *           properties:
 *             locationId:
 *               type: integer
 *             locationName:
 *               type: string
 *             latitude:
 *               type: number
 *             longitude:
 *               type: number
 *             radius:
 *               type: number
 */

// ============================================================
// 📋 AUDIT LOG ENDPOINTS
// ============================================================

/**
 * @swagger
 * tags:
 *   - name: Audit
 *     description: |
 *       📋 API สำหรับ Audit Log (Admin/SuperAdmin เท่านั้น)
 *
 *       **ทำไมต้องมี Audit API?**
 *       Admin ต้องตรวจสอบได้ว่า "ใครทำอะไร เมื่อไหร่" ตามข้อกำหนด PDPA
 *
 *       **การเก็บรักษา:**
 *       Audit logs ถูกลบอัตโนมัติหลัง 90 วัน ด้วย cron job (ทุกวัน 02:00)
 *
 *       **สิทธิ์การเข้าถึง:**
 *       - Admin/SuperAdmin เท่านั้น
 */

/**
 * @swagger
 * /api/audit:
 *   get:
 *     summary: ดึง Audit Logs
 *     description: |
 *       ดึงรายการ audit logs ตามเงื่อนไขที่กำหนด (paginated)
 *       เรียง createdAt DESC (ล่าสุดขึ้นก่อน)
 *
 *       **SQL เทียบเท่า:**
 *       ```sql
 *       SELECT al.*, u."firstName", u."lastName", u."employeeId"
 *       FROM "audit_logs" al
 *       LEFT JOIN "users" u ON al."userId" = u."userId"
 *       WHERE (conditions)
 *       ORDER BY al."createdAt" DESC
 *       LIMIT $limit
 *       ```
 *     tags:
 *       - Audit
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: integer
 *         description: กรองเฉพาะ action ของ user คนนี้
 *       - in: query
 *         name: action
 *         schema:
 *           type: string
 *         description: กรองเฉพาะ action นี้ เช่น CHECK_IN, UPDATE_ATTENDANCE
 *       - in: query
 *         name: targetTable
 *         schema:
 *           type: string
 *         description: กรองเฉพาะตารางนี้ เช่น attendance, shifts
 *       - in: query
 *         name: targetId
 *         schema:
 *           type: integer
 *         description: กรองเฉพาะ record ID นี้
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: วันเริ่มต้น (ISO string)
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date-time
 *         description: วันสิ้นสุด (ISO string)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 100
 *         description: จำนวนสูงสุดต่อหน้า
 *     responses:
 *       200:
 *         description: ดึง audit logs สำเร็จ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/AuditLog'
 *       401:
 *         description: ไม่ได้ login
 *       403:
 *         description: ไม่ใช่ Admin/SuperAdmin
 */

/**
 * @swagger
 * /api/audit/actions:
 *   get:
 *     summary: ดึงรายชื่อ Action ทั้งหมด
 *     description: |
 *       ดึง AuditAction constants ทั้งหมด สำหรับใช้เป็น dropdown filter ฝั่ง frontend
 *       เช่น CHECK_IN, CHECK_OUT, UPDATE_ATTENDANCE, ...
 *     tags:
 *       - Audit
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: สำเร็จ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   description: key-value ของ action constants
 *                   example:
 *                     CHECK_IN: "CHECK_IN"
 *                     CHECK_OUT: "CHECK_OUT"
 *                     UPDATE_ATTENDANCE: "UPDATE_ATTENDANCE"
 *       401:
 *         description: ไม่ได้ login
 *       403:
 *         description: ไม่ใช่ Admin/SuperAdmin
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     AuditLog:
 *       type: object
 *       description: |
 *         Audit log record — บันทึกว่า "ใครทำอะไร กับข้อมูลอะไร เมื่อเวลาใด"
 *         ถูกสร้างอัตโนมัติโดย audit middleware สำหรับทุก write request
 *       properties:
 *         logId:
 *           type: integer
 *           example: 1234
 *         userId:
 *           type: integer
 *           nullable: true
 *           example: 151
 *           description: ผู้กระทำ — null ถ้า system action
 *         action:
 *           type: string
 *           example: "CHECK_IN"
 *           description: ชื่อ action จาก AuditAction constants
 *         targetTable:
 *           type: string
 *           example: "attendance"
 *         targetId:
 *           type: integer
 *           example: 151
 *           description: primary key ของ record ที่ถูกกระทำ
 *         oldValues:
 *           type: object
 *           nullable: true
 *           description: snapshot ก่อนเปลี่ยน (null สำหรับ CREATE)
 *         newValues:
 *           type: object
 *           nullable: true
 *           description: snapshot หลังเปลี่ยน (null สำหรับ DELETE)
 *         ipAddress:
 *           type: string
 *           nullable: true
 *           example: "203.150.11.1"
 *         userAgent:
 *           type: string
 *           nullable: true
 *         createdAt:
 *           type: string
 *           format: date-time
 *         user:
 *           type: object
 *           nullable: true
 *           properties:
 *             userId:
 *               type: integer
 *             firstName:
 *               type: string
 *             lastName:
 *               type: string
 *             employeeId:
 *               type: string
 */

// ============================================================
// 📍 LOCATION ENDPOINTS
// ============================================================

/**
 * @swagger
 * tags:
 *   - name: Locations
 *     description: |
 *       📍 API สำหรับจัดการสถานที่ (Locations)
 *
 *       ใช้กำหนดสถานที่สำหรับการเช็คอิน, สถานที่จัดงาน ของ Event, หรือสาขา
 *
 *       **ประเภทสถานที่ (locationType):** `OFFICE` `BRANCH` `EVENT` `SITE` `MEETING` `OTHER`
 *
 *       **สิทธิ์การเข้าถึง:**
 *       - ดูรายการ / ค้นหา: ทุก Role ที่ login แล้ว
 *       - สร้าง / แก้ไข / ลบ / กู้คืน: Admin / SuperAdmin เท่านั้น
 */

/**
 * @swagger
 * /api/locations:
 *   post:
 *     summary: สร้างสถานที่ใหม่ (Admin/SuperAdmin เท่านั้น)
 *     tags: [Locations]
 *     description: |
 *       สร้างสถานที่ใหม่สำหรับใช้กำหนดจุดเช็คอิน, สถานที่จัดงาน ของ Event หรือสาขา
 *
 *       **ต้องส่งมาด้วย:** `locationName`, `address`, `locationType`, `latitude`, `longitude`, `radius`
 *
 *       **ฟิลด์ที่ไม่บังคับ:** `description`, `isActive`
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - locationName
 *               - address
 *               - locationType
 *               - latitude
 *               - longitude
 *               - radius
 *             properties:
 *               locationName:
 *                 type: string
 *                 example: "สำนักงานใหญ่"
 *               address:
 *                 type: string
 *                 example: "123 ถ.สุขุมวิท แขวงคลองเตย กรุงเทพฯ 10110"
 *               locationType:
 *                 type: string
 *                 enum: [OFFICE, BRANCH, EVENT, SITE, MEETING, OTHER]
 *                 example: OFFICE
 *                 description: ประเภทสถานที่
 *               latitude:
 *                 type: number
 *                 format: float
 *                 example: 13.7563
 *                 description: พิกัด latitude
 *               longitude:
 *                 type: number
 *                 format: float
 *                 example: 100.5018
 *                 description: พิกัด longitude
 *               radius:
 *                 type: number
 *                 format: float
 *                 example: 100
 *                 minimum: 1
 *                 description: "รัศมีเช็คอิน (เมตร) — จำเป็น ต้องมากกว่า 0 ระบบใช้ค่านี้ตรวจสอบว่าพนักงานอยู่ในพื้นที่เช็คอินหรือไม่"
 *               description:
 *                 type: string
 *                 example: "สำนักงานใหญ่กรุงเทพ ชั้น 10"
 *               isActive:
 *                 type: boolean
 *                 example: true
 *                 description: เปิดใช้งานสถานที่นี้ (ค่าเริ่มต้น true)
 *           examples:
 *             สร้างสำนักงาน:
 *               value:
 *                 locationName: "สำนักงานใหญ่"
 *                 address: "123 ถ.สุขุมวิท แขวงคลองเตย กรุงเทพฯ 10110"
 *                 locationType: "OFFICE"
 *                 latitude: 13.7563
 *                 longitude: 100.5018
 *                 radius: 150
 *                 description: "สำนักงานใหญ่กรุงเทพ"
 *                 isActive: true
 *             สร้าง สถานที่จัดงาน ของ Event:
 *               value:
 *                 locationName: "ห้องประชุม A"
 *                 address: "อาคาร B ชั้น 3"
 *                 locationType: "MEETING"
 *                 latitude: 13.7650
 *                 longitude: 100.5380
 *                 radius: 50
 *     responses:
 *       201:
 *         description: สร้างสถานที่สำเร็จ
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *             example:
 *               success: true
 *               message: "สร้างสถานที่เรียบร้อยแล้ว"
 *               data:
 *                 locationId: 1
 *                 locationName: "สำนักงานใหญ่"
 *                 address: "123 ถ.สุขุมวิท กรุงเทพฯ"
 *                 locationType: "OFFICE"
 *                 latitude: 13.7563
 *                 longitude: 100.5018
 *                 radius: 150
 *                 isActive: true
 *                 createdAt: "2026-03-10T08:00:00.000Z"
 *       400:
 *         description: |
 *           Bad Request — สาเหตุที่เป็นไปได้:
 *           - ไม่ครบ field ที่จำเป็น
 *           - locationType ไม่ถูกต้อง
 *       401:
 *         description: ไม่ได้ login
 *       403:
 *         description: ไม่มีสิทธิ์ — ต้องเป็น Admin/SuperAdmin
 *   get:
 *     summary: ดึงรายการสถานที่ทั้งหมด
 *     tags: [Locations]
 *     description: |
 *       ดึงรายการสถานที่ทั้งหมดพร้อม pagination และ filter
 *
 *       **สิทธิ์:** ทุก Role ที่ login แล้ว
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: ค้นหาตามชื่อสถานที่หรือที่อยู่
 *         example: "สำนักงาน"
 *       - in: query
 *         name: locationType
 *         schema:
 *           type: string
 *           enum: [OFFICE, BRANCH, EVENT, SITE, MEETING, OTHER]
 *         description: กรองตามประเภทสถานที่
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: กรองตามสถานะ (true = เปิดใช้งาน)
 *       - in: query
 *         name: skip
 *         schema:
 *           type: integer
 *           default: 0
 *         description: จำนวน record ที่ข้าม (pagination)
 *       - in: query
 *         name: take
 *         schema:
 *           type: integer
 *           default: 10
 *         description: จำนวน record ที่ต้องการ (pagination)
 *     responses:
 *       200:
 *         description: รายการสถานที่
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 items:
 *                   - locationId: 1
 *                     locationName: "สำนักงานใหญ่"
 *                     locationType: "OFFICE"
 *                     latitude: 13.7563
 *                     longitude: 100.5018
 *                     radius: 150
 *                     isActive: true
 *                 total: 1
 *                 skip: 0
 *                 take: 10
 *       401:
 *         description: ไม่ได้ login
 */

/**
 * @swagger
 * /api/locations/nearby:
 *   get:
 *     summary: ค้นหาสถานที่ใกล้เคียง
 *     tags: [Locations]
 *     description: |
 *       ค้นหาสถานที่ที่อยู่ในรัศมีที่กำหนดจากพิกัดที่ส่งมา
 *
 *       **ต้องส่งมาด้วย:** `latitude`, `longitude`
 *
 *       **ไม่บังคับ:** `radiusKm` (ค่าเริ่มต้น: 5 กิโลเมตร)
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: latitude
 *         required: true
 *         schema:
 *           type: number
 *           format: float
 *         description: พิกัด latitude ของตำแหน่งปัจจุบัน
 *         example: 13.7563
 *       - in: query
 *         name: longitude
 *         required: true
 *         schema:
 *           type: number
 *           format: float
 *         description: พิกัด longitude ของตำแหน่งปัจจุบัน
 *         example: 100.5018
 *       - in: query
 *         name: radiusKm
 *         schema:
 *           type: number
 *           format: float
 *           default: 5
 *         description: รัศมีค้นหา (กิโลเมตร, ค่าเริ่มต้น 5)
 *     responses:
 *       200:
 *         description: รายการสถานที่ใกล้เคียง
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 - locationId: 1
 *                   locationName: "สำนักงานใหญ่"
 *                   latitude: 13.7563
 *                   longitude: 100.5018
 *                   distanceKm: 0.12
 *       400:
 *         description: ต้องระบุ latitude และ longitude
 *       401:
 *         description: ไม่ได้ login
 */

/**
 * @swagger
 * /api/locations/statistics:
 *   get:
 *     summary: ดึงสถิติสถานที่ (Admin/SuperAdmin เท่านั้น)
 *     tags: [Locations]
 *     description: |
 *       ดึงสถิติภาพรวมของสถานที่ทั้งหมด เช่น จำนวนแยกตามประเภท, สถิติการใช้งาน
 *
 *       **สิทธิ์:** Admin / SuperAdmin เท่านั้น
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: สถิติสถานที่
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 total: 10
 *                 active: 8
 *                 inactive: 2
 *                 byType:
 *                   OFFICE: 3
 *                   BRANCH: 4
 *                   EVENT: 2
 *                   MEETING: 1
 *       401:
 *         description: ไม่ได้ login
 *       403:
 *         description: ไม่มีสิทธิ์ — ต้องเป็น Admin/SuperAdmin
 */

/**
 * @swagger
 * /api/locations/{id}:
 *   get:
 *     summary: ดึงสถานที่ด้วย ID
 *     tags: [Locations]
 *     description: ดึงข้อมูลสถานที่เดียวตาม ID
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         description: Location ID
 *         example: 1
 *     responses:
 *       200:
 *         description: ข้อมูลสถานที่
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 locationId: 1
 *                 locationName: "สำนักงานใหญ่"
 *                 address: "123 ถ.สุขุมวิท กรุงเทพฯ"
 *                 locationType: "OFFICE"
 *                 latitude: 13.7563
 *                 longitude: 100.5018
 *                 radius: 150
 *                 isActive: true
 *                 createdAt: "2026-03-10T08:00:00.000Z"
 *       401:
 *         description: ไม่ได้ login
 *       404:
 *         description: ไม่พบสถานที่
 *   put:
 *     summary: แก้ไขสถานที่ (Admin/SuperAdmin เท่านั้น)
 *     tags: [Locations]
 *     description: |
 *       แก้ไขข้อมูลสถานที่ ส่งเฉพาะ field ที่ต้องการเปลี่ยนแปลง
 *
 *       **สิทธิ์:** Admin / SuperAdmin เท่านั้น
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               locationName:
 *                 type: string
 *                 example: "สำนักงานใหญ่ (ปรับปรุงใหม่)"
 *               address:
 *                 type: string
 *                 example: "123 ถ.สุขุมวิท กรุงเทพฯ 10110"
 *               locationType:
 *                 type: string
 *                 enum: [OFFICE, BRANCH, EVENT, SITE, MEETING, OTHER]
 *               latitude:
 *                 type: number
 *                 format: float
 *                 example: 13.7563
 *               longitude:
 *                 type: number
 *                 format: float
 *                 example: 100.5018
 *               radius:
 *                 type: number
 *                 format: float
 *                 example: 200
 *               description:
 *                 type: string
 *               isActive:
 *                 type: boolean
 *                 example: true
 *           examples:
 *             แก้ไขรัศมี:
 *               value:
 *                 radius: 200
 *                 description: "ขยายรัศมีเช็คอิน"
 *             ปิดการใช้งาน:
 *               value:
 *                 isActive: false
 *     responses:
 *       200:
 *         description: แก้ไขสถานที่สำเร็จ
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "แก้ไขสถานที่เรียบร้อยแล้ว"
 *               data:
 *                 locationId: 1
 *                 locationName: "สำนักงานใหญ่ (ปรับปรุงใหม่)"
 *                 radius: 200
 *                 isActive: true
 *                 updatedAt: "2026-03-10T09:00:00.000Z"
 *       401:
 *         description: ไม่ได้ login
 *       403:
 *         description: ไม่มีสิทธิ์ — ต้องเป็น Admin/SuperAdmin
 *       404:
 *         description: ไม่พบสถานที่
 *   delete:
 *     summary: ลบสถานที่ (Admin/SuperAdmin เท่านั้น)
 *     tags: [Locations]
 *     description: |
 *       ลบสถานที่แบบ Soft Delete (สามารถกู้คืนได้ภายหลัง)
 *
 *       **สิทธิ์:** Admin / SuperAdmin เท่านั้น
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               deleteReason:
 *                 type: string
 *                 example: "สาขาปิดตัว"
 *     responses:
 *       200:
 *         description: ลบสถานที่สำเร็จ
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "ลบสถานที่เรียบร้อยแล้ว"
 *       401:
 *         description: ไม่ได้ login
 *       403:
 *         description: ไม่มีสิทธิ์ — ต้องเป็น Admin/SuperAdmin
 *       404:
 *         description: ไม่พบสถานที่
 */

/**
 * @swagger
 * /api/locations/{id}/restore:
 *   post:
 *     summary: กู้คืนสถานที่ที่ถูกลบ (Admin/SuperAdmin เท่านั้น)
 *     tags: [Locations]
 *     description: |
 *       กู้คืนสถานที่ที่ถูก Soft Delete ให้กลับมาใช้งานได้
 *
 *       **สิทธิ์:** Admin / SuperAdmin เท่านั้น
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 1
 *     responses:
 *       200:
 *         description: กู้คืนสถานที่สำเร็จ
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "กู้คืนสถานที่เรียบร้อยแล้ว"
 *       401:
 *         description: ไม่ได้ login
 *       403:
 *         description: ไม่มีสิทธิ์ — ต้องเป็น Admin/SuperAdmin
 *       404:
 *         description: ไม่พบสถานที่
 */

// ============================================================
// ⏰ LATE REQUEST ENDPOINTS
// ============================================================

/**
 * @swagger
 * tags:
 *   - name: Late Requests
 *     description: |
 *       ⏰ API สำหรับจัดการคำขอมาสาย (Late Requests)
 *
 *       พนักงานยื่นคำขอชี้แจงเหตุผลการมาสาย Admin ตรวจสอบและ อนุมัติ/ปฏิเสธ
 *
 *       **สถานะ:** `PENDING` → `APPROVED` / `REJECTED`
 *
 *       **สิทธิ์การเข้าถึง:**
 *       - สร้าง / ดูของตัวเอง / แก้ไข / ลบ (เฉพาะ PENDING): ทุก Role ที่ login แล้ว
 *       - ดูทั้งหมด / อนุมัติ / ปฏิเสธ: Admin / SuperAdmin / Manager
 */

/**
 * @swagger
 * /api/late-requests:
 *   post:
 *     summary: สร้างคำขอมาสายใหม่
 *     tags: [Late Requests]
 *     description: |
 *       ยื่นคำขอชี้แจงเหตุผลการมาสาย
 *
 *       **ต้องส่งมาด้วย:** `requestDate`, `scheduledTime`, `actualTime`, `reason`
 *
 *       **ไม่บังคับ:** `attendanceId` (ผูกกับ attendance record), `attachmentUrl`
 *
 *       รูปแบบเวลา: `HH:MM` เช่น `08:30`, `09:15`
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - requestDate
 *               - scheduledTime
 *               - actualTime
 *               - reason
 *             properties:
 *               attendanceId:
 *                 type: integer
 *                 description: ID ของ attendance record (ถ้ามี)
 *                 example: 42
 *               requestDate:
 *                 type: string
 *                 format: date
 *                 example: "2026-03-10"
 *                 description: วันที่มาสาย
 *               scheduledTime:
 *                 type: string
 *                 example: "08:30"
 *                 description: เวลาที่กำหนดเข้างาน (HH:MM)
 *               actualTime:
 *                 type: string
 *                 example: "09:15"
 *                 description: เวลาที่มาถึงจริง (HH:MM)
 *               reason:
 *                 type: string
 *                 example: "รถติดบนทางด่วน"
 *                 description: เหตุผลการมาสาย
 *               attachmentUrl:
 *                 type: string
 *                 example: "https://storage.example.com/evidence.jpg"
 *                 description: URL ไฟล์หลักฐาน (ถ้ามี)
 *           examples:
 *             คำขอมาสายทั่วไป:
 *               value:
 *                 requestDate: "2026-03-10"
 *                 scheduledTime: "08:30"
 *                 actualTime: "09:15"
 *                 reason: "รถติดบนทางด่วน"
 *             คำขอพร้อมหลักฐาน:
 *               value:
 *                 attendanceId: 42
 *                 requestDate: "2026-03-10"
 *                 scheduledTime: "08:30"
 *                 actualTime: "09:45"
 *                 reason: "อุบัติเหตุบนถนน"
 *                 attachmentUrl: "https://storage.example.com/evidence.jpg"
 *     responses:
 *       201:
 *         description: สร้างคำขอมาสายสำเร็จ
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "สร้างคำขอมาสายเรียบร้อยแล้ว"
 *               data:
 *                 lateRequestId: 10
 *                 userId: 5
 *                 requestDate: "2026-03-10"
 *                 scheduledTime: "08:30"
 *                 actualTime: "09:15"
 *                 reason: "รถติดบนทางด่วน"
 *                 status: "PENDING"
 *                 createdAt: "2026-03-10T09:20:00.000Z"
 *       400:
 *         description: |
 *           Bad Request — สาเหตุที่เป็นไปได้:
 *           - ไม่ครบ field ที่จำเป็น
 *           - รูปแบบ date/time ไม่ถูกต้อง
 *       401:
 *         description: ไม่ได้ login
 *   get:
 *     summary: ดึงคำขอมาสายทั้งหมด (Admin/Manager เท่านั้น)
 *     tags: [Late Requests]
 *     description: |
 *       ดึงคำขอมาสายของพนักงานทุกคน พร้อม filter และ pagination
 *
 *       **สิทธิ์:** Admin / SuperAdmin / Manager เท่านั้น
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED]
 *         description: กรองตามสถานะ (ถ้าไม่ส่งจะดึงทุกสถานะ)
 *       - in: query
 *         name: skip
 *         schema:
 *           type: integer
 *           default: 0
 *         description: จำนวน record ที่ข้าม
 *       - in: query
 *         name: take
 *         schema:
 *           type: integer
 *           default: 10
 *         description: จำนวน record ที่ต้องการ
 *     responses:
 *       200:
 *         description: รายการคำขอมาสายทั้งหมด
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 items:
 *                   - lateRequestId: 10
 *                     userId: 5
 *                     requestDate: "2026-03-10"
 *                     scheduledTime: "08:30"
 *                     actualTime: "09:15"
 *                     reason: "รถติด"
 *                     status: "PENDING"
 *                 total: 1
 *       401:
 *         description: ไม่ได้ login
 *       403:
 *         description: ไม่มีสิทธิ์ — ต้องเป็น Admin/Manager
 */

/**
 * @swagger
 * /api/late-requests/my:
 *   get:
 *     summary: ดึงคำขอมาสายของตัวเอง
 *     tags: [Late Requests]
 *     description: |
 *       ดึงรายการคำขอมาสายของผู้ใช้ที่ login อยู่ พร้อม filter และ pagination
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED]
 *         description: กรองตามสถานะ
 *       - in: query
 *         name: skip
 *         schema:
 *           type: integer
 *           default: 0
 *       - in: query
 *         name: take
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: รายการคำขอมาสายของฉัน
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 items:
 *                   - lateRequestId: 10
 *                     requestDate: "2026-03-10"
 *                     scheduledTime: "08:30"
 *                     actualTime: "09:15"
 *                     reason: "รถติด"
 *                     status: "PENDING"
 *                 total: 1
 *       401:
 *         description: ไม่ได้ login
 */

/**
 * @swagger
 * /api/late-requests/my/statistics:
 *   get:
 *     summary: ดึงสถิติการมาสายของตัวเอง
 *     tags: [Late Requests]
 *     description: |
 *       ดึงสรุปสถิติการมาสายของผู้ใช้ที่ login อยู่ เช่น จำนวนครั้งแยกตามสถานะ
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: สถิติการมาสาย
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 total: 5
 *                 pending: 1
 *                 approved: 3
 *                 rejected: 1
 *       401:
 *         description: ไม่ได้ login
 */

/**
 * @swagger
 * /api/late-requests/{id}:
 *   get:
 *     summary: ดึงคำขอมาสายด้วย ID
 *     tags: [Late Requests]
 *     description: ดึงข้อมูลคำขอมาสายเดียวตาม ID
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 10
 *     responses:
 *       200:
 *         description: ข้อมูลคำขอมาสาย
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 lateRequestId: 10
 *                 userId: 5
 *                 requestDate: "2026-03-10"
 *                 scheduledTime: "08:30"
 *                 actualTime: "09:15"
 *                 reason: "รถติด"
 *                 status: "PENDING"
 *                 adminComment: null
 *                 rejectionReason: null
 *                 createdAt: "2026-03-10T09:20:00.000Z"
 *       401:
 *         description: ไม่ได้ login
 *       404:
 *         description: ไม่พบคำขอมาสาย
 *   put:
 *     summary: แก้ไขคำขอมาสาย (เจ้าของหรือ Admin, เฉพาะสถานะ PENDING)
 *     tags: [Late Requests]
 *     description: |
 *       แก้ไขข้อมูลคำขอมาสาย ทำได้เฉพาะเมื่อสถานะเป็น `PENDING` เท่านั้น
 *
 *       **สิทธิ์:** เจ้าของคำขอ หรือ Admin / SuperAdmin
 *
 *       ส่งเฉพาะ field ที่ต้องการเปลี่ยนแปลง
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 10
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               requestDate:
 *                 type: string
 *                 format: date
 *                 example: "2026-03-10"
 *               scheduledTime:
 *                 type: string
 *                 example: "08:30"
 *               actualTime:
 *                 type: string
 *                 example: "09:20"
 *               reason:
 *                 type: string
 *                 example: "รถติดมาก ไม่ใช่แค่รถติดปกติ"
 *               attachmentUrl:
 *                 type: string
 *                 example: "https://storage.example.com/new-evidence.jpg"
 *           examples:
 *             แก้ไขเหตุผล:
 *               value:
 *                 reason: "รถเสียระหว่างทาง"
 *                 attachmentUrl: "https://storage.example.com/car-breakdown.jpg"
 *     responses:
 *       200:
 *         description: แก้ไขคำขอมาสายสำเร็จ
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "แก้ไขคำขอมาสายเรียบร้อยแล้ว"
 *               data:
 *                 lateRequestId: 10
 *                 reason: "รถเสียระหว่างทาง"
 *                 status: "PENDING"
 *                 updatedAt: "2026-03-10T10:00:00.000Z"
 *       401:
 *         description: ไม่ได้ login
 *       403:
 *         description: ไม่มีสิทธิ์แก้ไข
 *       404:
 *         description: ไม่พบคำขอมาสาย
 *   delete:
 *     summary: ลบคำขอมาสาย (เจ้าของหรือ Admin, เฉพาะสถานะ PENDING)
 *     tags: [Late Requests]
 *     description: |
 *       ลบคำขอมาสาย ทำได้เฉพาะเมื่อสถานะเป็น `PENDING` เท่านั้น
 *
 *       **สิทธิ์:** เจ้าของคำขอ หรือ Admin / SuperAdmin
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 10
 *     responses:
 *       200:
 *         description: ลบคำขอมาสายสำเร็จ
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "ลบคำขอมาสายเรียบร้อยแล้ว"
 *       401:
 *         description: ไม่ได้ login
 *       403:
 *         description: ไม่มีสิทธิ์ลบ
 *       404:
 *         description: ไม่พบคำขอมาสาย
 */

/**
 * @swagger
 * /api/late-requests/{id}/approve:
 *   post:
 *     summary: อนุมัติคำขอมาสาย (Admin/Manager เท่านั้น)
 *     tags: [Late Requests]
 *     description: |
 *       อนุมัติคำขอมาสาย สถานะจะเปลี่ยนจาก `PENDING` เป็น `APPROVED`
 *
 *       **สิทธิ์:** Admin / SuperAdmin / Manager เท่านั้น
 *
 *       **ไม่บังคับ:** `adminComment` (หมายเหตุจาก Admin)
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 10
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               adminComment:
 *                 type: string
 *                 example: "อนุมัติ - เหตุสุดวิสัย"
 *     responses:
 *       200:
 *         description: อนุมัติคำขอมาสายสำเร็จ
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "อนุมัติคำขอมาสายเรียบร้อยแล้ว"
 *               data:
 *                 lateRequestId: 10
 *                 status: "APPROVED"
 *                 adminComment: "อนุมัติ - เหตุสุดวิสัย"
 *                 approvedByUserId: 1
 *       401:
 *         description: ไม่ได้ login
 *       403:
 *         description: ไม่มีสิทธิ์อนุมัติ — ต้องเป็น Admin/Manager
 *       404:
 *         description: ไม่พบคำขอมาสาย
 */

/**
 * @swagger
 * /api/late-requests/{id}/reject:
 *   post:
 *     summary: ปฏิเสธคำขอมาสาย (Admin/Manager เท่านั้น)
 *     tags: [Late Requests]
 *     description: |
 *       ปฏิเสธคำขอมาสาย สถานะจะเปลี่ยนจาก `PENDING` เป็น `REJECTED`
 *
 *       **สิทธิ์:** Admin / SuperAdmin / Manager เท่านั้น
 *
 *       **ต้องส่งมาด้วย:** `rejectionReason`
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 10
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - rejectionReason
 *             properties:
 *               rejectionReason:
 *                 type: string
 *                 example: "ไม่มีหลักฐานประกอบ"
 *     responses:
 *       200:
 *         description: ปฏิเสธคำขอมาสายสำเร็จ
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "ปฏิเสธคำขอมาสายเรียบร้อยแล้ว"
 *               data:
 *                 lateRequestId: 10
 *                 status: "REJECTED"
 *                 rejectionReason: "ไม่มีหลักฐานประกอบ"
 *       400:
 *         description: ต้องระบุ rejectionReason
 *       401:
 *         description: ไม่ได้ login
 *       403:
 *         description: ไม่มีสิทธิ์ปฏิเสธ — ต้องเป็น Admin/Manager
 *       404:
 *         description: ไม่พบคำขอมาสาย
 */

// ============================================================
// 🏖️ LEAVE REQUEST ENDPOINTS
// ============================================================

/**
 * @swagger
 * tags:
 *   - name: Leave Requests
 *     description: |
 *       🏖️ API สำหรับจัดการใบลา (Leave Requests)
 *
 *       พนักงานยื่นใบลาประเภทต่าง ๆ Admin ตรวจสอบและ อนุมัติ/ปฏิเสธ
 *       ระบบจะนับเฉพาะวันทำงาน (จันทร์-ศุกร์) และตรวจสอบวันลาคงเหลือโดยอัตโนมัติ
 *
 *       **ประเภทการลา:** `SICK` `PERSONAL` `VACATION` `MILITARY` `TRAINING` `MATERNITY` `STERILIZATION` `ORDINATION`
 *
 *       **สถานะ:** `PENDING` → `APPROVED` / `REJECTED`
 *
 *       **สิทธิ์การเข้าถึง:**
 *       - สร้าง / ดูของตัวเอง / แก้ไข / ลบ (เฉพาะ PENDING): ทุก Role ที่ login แล้ว
 *       - ดูทั้งหมด / อนุมัติ / ปฏิเสธ: Admin / SuperAdmin / Manager
 */

/**
 * @swagger
 * /api/leave-requests:
 *   post:
 *     summary: สร้างใบลาใหม่
 *     tags: [Leave Requests]
 *     description: |
 *       ยื่นใบลาประเภทต่าง ๆ ระบบจะนับเฉพาะวันทำงาน (จันทร์-ศุกร์)
 *       และหักออกจากโควต้าวันลาอัตโนมัติเมื่อได้รับการอนุมัติ
 *
 *       **ต้องส่งมาด้วย:** `leaveType`, `startDate`, `endDate`
 *
 *       **ไม่บังคับ:** `reason`, `attachmentUrl`, `medicalCertificateUrl`
 *
 *       **หมายเหตุ:** ลา SICK ≥ 3 วัน ต้องแนบใบรับรองแพทย์ใน `medicalCertificateUrl`
 *     security:
 *       - BearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - leaveType
 *               - startDate
 *               - endDate
 *             properties:
 *               leaveType:
 *                 type: string
 *                 enum: [SICK, PERSONAL, VACATION, MILITARY, TRAINING, MATERNITY, STERILIZATION, ORDINATION]
 *                 example: SICK
 *                 description: ประเภทการลา
 *               startDate:
 *                 type: string
 *                 format: date
 *                 example: "2026-03-15"
 *                 description: วันที่เริ่มลา
 *               endDate:
 *                 type: string
 *                 format: date
 *                 example: "2026-03-16"
 *                 description: วันที่สิ้นสุดการลา
 *               reason:
 *                 type: string
 *                 example: "ป่วยไข้หวัด"
 *               attachmentUrl:
 *                 type: string
 *                 example: "https://storage.example.com/doc.pdf"
 *                 description: URL ไฟล์หลักฐาน
 *               medicalCertificateUrl:
 *                 type: string
 *                 example: "https://storage.example.com/medical-cert.pdf"
 *                 description: URL ใบรับรองแพทย์ (จำเป็นสำหรับ SICK ≥ 3 วัน)
 *           examples:
 *             ลาป่วย:
 *               value:
 *                 leaveType: "SICK"
 *                 startDate: "2026-03-15"
 *                 endDate: "2026-03-16"
 *                 reason: "ป่วยไข้หวัด"
 *             ลาพักร้อน:
 *               value:
 *                 leaveType: "VACATION"
 *                 startDate: "2026-04-01"
 *                 endDate: "2026-04-03"
 *                 reason: "พักผ่อนประจำปี"
 *     responses:
 *       201:
 *         description: สร้างใบลาสำเร็จ
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "สร้างใบลาเรียบร้อยแล้ว"
 *               data:
 *                 leaveRequestId: 20
 *                 userId: 5
 *                 leaveType: "SICK"
 *                 startDate: "2026-03-15"
 *                 endDate: "2026-03-16"
 *                 totalDays: 2
 *                 status: "PENDING"
 *                 createdAt: "2026-03-10T08:00:00.000Z"
 *       400:
 *         description: |
 *           Bad Request — สาเหตุที่เป็นไปได้:
 *           - ไม่ครบ field ที่จำเป็น
 *           - leaveType ไม่ถูกต้อง
 *           - วันลาซ้อนทับกับใบลาที่มีอยู่
 *           - วันลาคงเหลือไม่เพียงพอ
 *       401:
 *         description: ไม่ได้ login
 *   get:
 *     summary: ดึงใบลาทั้งหมด (Admin/Manager เท่านั้น)
 *     tags: [Leave Requests]
 *     description: |
 *       ดึงใบลาของพนักงานทุกคน พร้อม filter และ pagination
 *
 *       **สิทธิ์:** Admin / SuperAdmin / Manager เท่านั้น
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED]
 *         description: กรองตามสถานะ (ถ้าไม่ส่งจะดึงทุกสถานะ)
 *       - in: query
 *         name: skip
 *         schema:
 *           type: integer
 *           default: 0
 *       - in: query
 *         name: take
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: รายการใบลาทั้งหมด
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 items:
 *                   - leaveRequestId: 20
 *                     userId: 5
 *                     leaveType: "SICK"
 *                     startDate: "2026-03-15"
 *                     endDate: "2026-03-16"
 *                     totalDays: 2
 *                     status: "PENDING"
 *                 total: 1
 *       401:
 *         description: ไม่ได้ login
 *       403:
 *         description: ไม่มีสิทธิ์ — ต้องเป็น Admin/Manager
 */

/**
 * @swagger
 * /api/leave-requests/my:
 *   get:
 *     summary: ดึงใบลาของตัวเอง
 *     tags: [Leave Requests]
 *     description: |
 *       ดึงรายการใบลาของผู้ใช้ที่ login อยู่ พร้อม filter และ pagination
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, APPROVED, REJECTED]
 *         description: กรองตามสถานะ
 *       - in: query
 *         name: skip
 *         schema:
 *           type: integer
 *           default: 0
 *       - in: query
 *         name: take
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: รายการใบลาของฉัน
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 items:
 *                   - leaveRequestId: 20
 *                     leaveType: "SICK"
 *                     startDate: "2026-03-15"
 *                     endDate: "2026-03-16"
 *                     totalDays: 2
 *                     status: "APPROVED"
 *                 total: 1
 *       401:
 *         description: ไม่ได้ login
 */

/**
 * @swagger
 * /api/leave-requests/my/statistics:
 *   get:
 *     summary: ดึงสถิติการลาของตัวเอง
 *     tags: [Leave Requests]
 *     description: |
 *       ดึงสรุปสถิติการลาของผู้ใช้ที่ login อยู่ แยกตามประเภทการลาและสถานะ
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: สถิติการลา
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 total: 8
 *                 pending: 1
 *                 approved: 6
 *                 rejected: 1
 *                 byType:
 *                   SICK: 3
 *                   VACATION: 2
 *                   PERSONAL: 3
 *       401:
 *         description: ไม่ได้ login
 */

/**
 * @swagger
 * /api/leave-requests/my/quota:
 *   get:
 *     summary: ดึงโควต้าวันลาคงเหลือของตัวเอง
 *     tags: [Leave Requests]
 *     description: |
 *       ดึงโควต้าวันลาคงเหลือทุกประเภทของผู้ใช้ที่ login อยู่
 *       ระบบคำนวณเฉพาะวันทำงาน (จันทร์-ศุกร์)
 *     security:
 *       - BearerAuth: []
 *     responses:
 *       200:
 *         description: โควต้าวันลาคงเหลือทุกประเภท
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 SICK:
 *                   total: 30
 *                   used: 3
 *                   remaining: 27
 *                 PERSONAL:
 *                   total: 3
 *                   used: 1
 *                   remaining: 2
 *                 VACATION:
 *                   total: 6
 *                   used: 2
 *                   remaining: 4
 *       401:
 *         description: ไม่ได้ login
 */

/**
 * @swagger
 * /api/leave-requests/{id}:
 *   get:
 *     summary: ดึงใบลาด้วย ID
 *     tags: [Leave Requests]
 *     description: ดึงข้อมูลใบลาเดียวตาม ID
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 20
 *     responses:
 *       200:
 *         description: ข้อมูลใบลา
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               data:
 *                 leaveRequestId: 20
 *                 userId: 5
 *                 leaveType: "SICK"
 *                 startDate: "2026-03-15"
 *                 endDate: "2026-03-16"
 *                 totalDays: 2
 *                 reason: "ป่วยไข้หวัด"
 *                 status: "PENDING"
 *                 adminComment: null
 *                 rejectionReason: null
 *                 createdAt: "2026-03-10T08:00:00.000Z"
 *       401:
 *         description: ไม่ได้ login
 *       404:
 *         description: ไม่พบใบลา
 *   put:
 *     summary: แก้ไขใบลา (เจ้าของหรือ Admin, เฉพาะสถานะ PENDING)
 *     tags: [Leave Requests]
 *     description: |
 *       แก้ไขข้อมูลใบลา ทำได้เฉพาะเมื่อสถานะเป็น `PENDING` เท่านั้น
 *
 *       **สิทธิ์:** เจ้าของใบลา หรือ Admin / SuperAdmin
 *
 *       ส่งเฉพาะ field ที่ต้องการเปลี่ยนแปลง
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 20
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               leaveType:
 *                 type: string
 *                 enum: [SICK, PERSONAL, VACATION, MILITARY, TRAINING, MATERNITY, STERILIZATION, ORDINATION]
 *               startDate:
 *                 type: string
 *                 format: date
 *                 example: "2026-03-15"
 *               endDate:
 *                 type: string
 *                 format: date
 *                 example: "2026-03-17"
 *               reason:
 *                 type: string
 *                 example: "ป่วยหนักกว่าที่คิด"
 *               attachmentUrl:
 *                 type: string
 *                 example: "https://storage.example.com/updated-doc.pdf"
 *           examples:
 *             ขยายวันลา:
 *               value:
 *                 endDate: "2026-03-17"
 *                 reason: "ป่วยหนักกว่าที่คิด"
 *     responses:
 *       200:
 *         description: แก้ไขใบลาสำเร็จ
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "แก้ไขใบลาเรียบร้อยแล้ว"
 *               data:
 *                 leaveRequestId: 20
 *                 endDate: "2026-03-17"
 *                 totalDays: 3
 *                 status: "PENDING"
 *                 updatedAt: "2026-03-10T10:00:00.000Z"
 *       401:
 *         description: ไม่ได้ login
 *       403:
 *         description: ไม่มีสิทธิ์แก้ไข
 *       404:
 *         description: ไม่พบใบลา
 *   delete:
 *     summary: ลบใบลา (เจ้าของหรือ Admin, เฉพาะสถานะ PENDING)
 *     tags: [Leave Requests]
 *     description: |
 *       ลบใบลา ทำได้เฉพาะเมื่อสถานะเป็น `PENDING` เท่านั้น
 *
 *       **สิทธิ์:** เจ้าของใบลา หรือ Admin / SuperAdmin
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 20
 *     responses:
 *       200:
 *         description: ลบใบลาสำเร็จ
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "ลบใบลาเรียบร้อยแล้ว"
 *       401:
 *         description: ไม่ได้ login
 *       403:
 *         description: ไม่มีสิทธิ์ลบ
 *       404:
 *         description: ไม่พบใบลา
 */

/**
 * @swagger
 * /api/leave-requests/{id}/approve:
 *   post:
 *     summary: อนุมัติใบลา (Admin/Manager เท่านั้น)
 *     tags: [Leave Requests]
 *     description: |
 *       อนุมัติใบลา สถานะจะเปลี่ยนจาก `PENDING` เป็น `APPROVED`
 *       และระบบจะหักวันลาออกจากโควต้าอัตโนมัติ
 *
 *       **สิทธิ์:** Admin / SuperAdmin / Manager เท่านั้น
 *
 *       **ไม่บังคับ:** `adminComment` (หมายเหตุจาก Admin)
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 20
 *     requestBody:
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               adminComment:
 *                 type: string
 *                 example: "อนุมัติ"
 *     responses:
 *       200:
 *         description: อนุมัติใบลาสำเร็จ
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "อนุมัติใบลาเรียบร้อยแล้ว"
 *               data:
 *                 leaveRequestId: 20
 *                 status: "APPROVED"
 *                 adminComment: "อนุมัติ"
 *                 approvedByUserId: 1
 *                 approvedAt: "2026-03-11T08:00:00.000Z"
 *       401:
 *         description: ไม่ได้ login
 *       403:
 *         description: ไม่มีสิทธิ์อนุมัติ — ต้องเป็น Admin/Manager
 *       404:
 *         description: ไม่พบใบลา
 */

/**
 * @swagger
 * /api/leave-requests/{id}/reject:
 *   post:
 *     summary: ปฏิเสธใบลา (Admin/Manager เท่านั้น)
 *     tags: [Leave Requests]
 *     description: |
 *       ปฏิเสธใบลา สถานะจะเปลี่ยนจาก `PENDING` เป็น `REJECTED`
 *
 *       **สิทธิ์:** Admin / SuperAdmin / Manager เท่านั้น
 *
 *       **ต้องส่งมาด้วย:** `rejectionReason`
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *         example: 20
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - rejectionReason
 *             properties:
 *               rejectionReason:
 *                 type: string
 *                 example: "วันลาหมดแล้ว"
 *     responses:
 *       200:
 *         description: ปฏิเสธใบลาสำเร็จ
 *         content:
 *           application/json:
 *             example:
 *               success: true
 *               message: "ปฏิเสธใบลาเรียบร้อยแล้ว"
 *               data:
 *                 leaveRequestId: 20
 *                 status: "REJECTED"
 *                 rejectionReason: "วันลาหมดแล้ว"
 *       400:
 *         description: ต้องระบุ rejectionReason
 *       401:
 *         description: ไม่ได้ login
 *       403:
 *         description: ไม่มีสิทธิ์ปฏิเสธ — ต้องเป็น Admin/Manager
 *       404:
 *         description: ไม่พบใบลา
 */
