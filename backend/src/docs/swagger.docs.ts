/**
 * @swagger
 * tags:
 *   - name: Shifts
 *     description: API สำหรับจัดการตารางงาน/กะ
 *   - name: Attendance
 *     description: API สำหรับการเข้างาน-ออกงาน
 */

/**
 * @swagger
 * /api/shifts:
 *   post:
 *     summary: สร้างกะงานใหม่
 *     description: สร้างตารางงาน/กะใหม่ในระบบ (Admin/SuperAdmin only)
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
 *     responses:
 *       201:
 *         description: สร้างกะงานสำเร็จ
 *       400:
 *         description: ข้อมูลไม่ถูกต้อง
 *       401:
 *         description: ไม่ได้ authenticate
 *       403:
 *         description: ไม่มีสิทธิ์เข้าถึง
 *   get:
 *     summary: ดึงรายการกะงานทั้งหมด
 *     description: ดึงกะทั้งหมด ตาม role และ branch
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
 *         description: รหัสผู้ใช้ที่ขอดูข้อมูล
 *       - in: query
 *         name: requesterRole
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: userId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: shiftType
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: ดึงข้อมูลสำเร็จ
 *       401:
 *         description: ไม่ได้ authenticate
 */

/**
 * @swagger
 * /api/shifts/today/{userId}:
 *   get:
 *     summary: ดึงกะงานที่ใช้งานได้ในวันนี้
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
 *     responses:
 *       200:
 *         description: ดึงข้อมูลสำเร็จ
 */

/**
 * @swagger
 * /api/shifts/{id}:
 *   get:
 *     summary: ดึงข้อมูลกะงานตาม ID
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
 *     responses:
 *       200:
 *         description: ดึงข้อมูลสำเร็จ
 *       404:
 *         description: ไม่พบกะงาน
 *   put:
 *     summary: อัปเดตกะงาน
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
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *               startTime:
 *                 type: string
 *               endTime:
 *                 type: string
 *     responses:
 *       200:
 *         description: อัปเดตสำเร็จ
 *       403:
 *         description: ไม่มีสิทธิ์
 *   delete:
 *     summary: ลบกะงาน
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
 *               deleteReason:
 *                 type: string
 *     responses:
 *       200:
 *         description: ลบสำเร็จ
 *       403:
 *         description: ไม่มีสิทธิ์
 */

/**
 * @swagger
 * /api/attendance/check-in:
 *   post:
 *     summary: เข้างาน (Check-in)
 *     description: บันทึกเวลาเข้างาน
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
 *     responses:
 *       201:
 *         description: เข้างานสำเร็จ
 *       400:
 *         description: ข้อมูลไม่ถูกต้อง
 */

/**
 * @swagger
 * /api/attendance/check-out:
 *   post:
 *     summary: ออกงาน (Check-out)
 *     description: บันทึกเวลาออกงาน
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
 *     responses:
 *       200:
 *         description: ออกงานสำเร็จ
 *       400:
 *         description: ข้อมูลไม่ถูกต้อง
 */

/**
 * @swagger
 * /api/attendance/history/{userId}:
 *   get:
 *     summary: ดึงประวัติการเข้างาน
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
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: ดึงข้อมูลสำเร็จ
 */

/**
 * @swagger
 * /api/attendance/today/{userId}:
 *   get:
 *     summary: ดึงข้อมูลการเข้างานวันนี้
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
 *     responses:
 *       200:
 *         description: ดึงข้อมูลสำเร็จ
 *       404:
 *         description: ไม่พบข้อมูล
 */

/**
 * @swagger
 * /api/attendance:
 *   get:
 *     summary: ดึงประวัติการเข้างานทั้งหมด (Admin only)
 *     tags:
 *       - Attendance
 *     security:
 *       - BearerAuth: []
 *     parameters:
 *       - in: query
 *         name: userId
 *         schema:
 *           type: integer
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: ดึงข้อมูลสำเร็จ
 *       403:
 *         description: ไม่มีสิทธิ์
 */

/**
 * @swagger
 * /api/attendance/{id}:
 *   put:
 *     summary: อัปเดตการเข้างาน
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
 *               status:
 *                 type: string
 *               note:
 *                 type: string
 *     responses:
 *       200:
 *         description: อัปเดตสำเร็จ
 *       403:
 *         description: ไม่มีสิทธิ์
 *   delete:
 *     summary: ลบการเข้างาน
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
 *     responses:
 *       200:
 *         description: ลบสำเร็จ
 *       403:
 *         description: ไม่มีสิทธิ์
 */
