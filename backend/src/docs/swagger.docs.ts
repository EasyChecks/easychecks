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
 */

/**
 * @swagger
 * /api/shifts:
 *   post:
 *     summary: สร้างกะงานใหม่ (Admin/SuperAdmin only)
 *     description: |
 *       สร้างตารางงานใหม่ให้พนักงาน พร้อมกำหนด grace period และ late threshold
 *
 *       **ทำไม grace period และ late threshold ถึงเก็บต่อกะ?**
 *       แต่ละกะอาจมีนโยบายเวลาต่างกัน เช่น กะดึกอาจยืดหยุ่นกว่ากะเช้า
 *       ค่า default: gracePeriodMinutes=15, lateThresholdMinutes=30
 *
 *       **shiftType:**
 *       - `REGULAR` — ใช้ทุกวัน ไม่กำหนดวัน
 *       - `SPECIFIC_DAY` — ต้องระบุ specificDays เช่น ["MONDAY","FRIDAY"]
 *       - `CUSTOM` — ต้องระบุ customDate วันเดียว เช่น "2026-03-15"
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
 *                 gracePeriodMinutes: 15
 *                 lateThresholdMinutes: 30
 *                 userId: 5
 *             กะเฉพาะวัน:
 *               summary: กะจันทร์-ศุกร์ SPECIFIC_DAY
 *               value:
 *                 name: "กะจันทร์-ศุกร์"
 *                 shiftType: "SPECIFIC_DAY"
 *                 startTime: "09:00"
 *                 endTime: "18:00"
 *                 specificDays: ["MONDAY","TUESDAY","WEDNESDAY","THURSDAY","FRIDAY"]
 *                 userId: 5
 *             กะวันพิเศษ:
 *               summary: กะวันเดียว CUSTOM
 *               value:
 *                 name: "งานพิเศษวันเสาร์"
 *                 shiftType: "CUSTOM"
 *                 startTime: "10:00"
 *                 endTime: "15:00"
 *                 customDate: "2026-03-15"
 *                 userId: 5
 *     responses:
 *       201:
 *         description: สร้างกะสำเร็จ — คืน shift record พร้อม user และ location
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
 *                   example: "สร้างกะงานเรียบร้อยแล้ว"
 *                 data:
 *                   $ref: '#/components/schemas/Shift'
 *       400:
 *         description: |
 *           Bad Request — สาเหตุที่เป็นไปได้:
 *           - รูปแบบเวลาไม่ถูกต้อง (ต้องเป็น HH:MM)
 *           - SPECIFIC_DAY ไม่ระบุ specificDays
 *           - CUSTOM ไม่ระบุ customDate
 *           - ไม่พบ userId หรือ locationId
 *       401:
 *         description: ไม่ได้ login หรือ Token หมดอายุ
 *       403:
 *         description: ไม่มีสิทธิ์ — หรือ Admin พยายามสร้างกะให้พนักงานสาขาอื่น
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
 *         name: requesterId
 *         required: true
 *         schema:
 *           type: integer
 *         description: รหัสผู้ใช้ที่ขอดูข้อมูล (ใช้กรองตาม role)
 *         example: 1
 *       - in: query
 *         name: requesterRole
 *         required: true
 *         schema:
 *           type: string
 *           enum: [USER, ADMIN, SUPERADMIN]
 *         description: Role ของผู้ขอ — ใช้ตัดสินว่าเห็นข้อมูลแค่ไหน
 *         example: ADMIN
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
 *         example: 5
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
 *         example: 1
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
 *         example: 1
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
 *         example: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - deletedByUserId
 *               - deleteReason
 *             properties:
 *               deletedByUserId:
 *                 type: integer
 *                 example: 1
 *                 description: รหัส Admin ที่ทำการลบ (ใช้สำหรับ audit trail)
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
 * /api/attendance/check-in:
 *   post:
 *     summary: เข้างาน (Check-in)
 *     description: |
 *       บันทึกเวลาเข้างานพร้อม GPS, รูปภาพ, และคำนวณสถานะอัตโนมัติ
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
 *                 userId: 5
 *                 shiftId: 1
 *                 locationId: 2
 *                 latitude: 13.7563
 *                 longitude: 100.5018
 *                 address: "อาคาร A ชั้น 3, กรุงเทพฯ"
 *             Check-in อย่างง่าย:
 *               summary: Check-in ไม่มี GPS ไม่มีกะ (walk-in)
 *               value:
 *                 userId: 5
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
 *                 userId: 5
 *                 latitude: 13.7563
 *                 longitude: 100.5018
 *                 address: "อาคาร A ชั้น 3, กรุงเทพฯ"
 *             ระบุ record:
 *               summary: ระบุ attendanceId ตรง (กรณีมีหลายกะ)
 *               value:
 *                 userId: 5
 *                 attendanceId: 42
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
 *         example: 5
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
 *           enum: [ON_TIME, LATE, ABSENT, LEAVE_APPROVED]
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
 *         example: 5
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
 *           enum: [ON_TIME, LATE, ABSENT, LEAVE_APPROVED]
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
 *         example: 42
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - updatedByUserId
 *             properties:
 *               updatedByUserId:
 *                 type: integer
 *                 example: 1
 *                 description: รหัส Admin ที่ทำการแก้ไข (สำหรับ audit trail)
 *               status:
 *                 type: string
 *                 enum: [ON_TIME, LATE, ABSENT, LEAVE_APPROVED]
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
 *         example: 42
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
 *                 example: 1
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
 *           example: 42
 *         userId:
 *           type: integer
 *           example: 5
 *         shiftId:
 *           type: integer
 *           nullable: true
 *           example: 1
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
 *           enum: [ON_TIME, LATE, ABSENT, LEAVE_APPROVED]
 *           example: "ON_TIME"
 *           description: |
 *             - ON_TIME: เข้าตรงเวลาหรือก่อนเวลาภายใน grace period
 *             - LATE: มาสายแต่ไม่เกิน lateThreshold
 *             - ABSENT: สายเกิน lateThreshold (ถือว่าขาดงาน)
 *             - LEAVE_APPROVED: มีใบลาอนุมัติวันนี้
 *         lateMinutes:
 *           type: integer
 *           example: 0
 *           description: จำนวนนาทีที่สาย (0 ถ้า ON_TIME)
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
