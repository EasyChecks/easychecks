import swaggerJsdoc from 'swagger-jsdoc';
import type { Application } from 'express';
import swaggerUi from 'swagger-ui-express';

const options: swaggerJsdoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'EasyCheck API Documentation',
      version: '1.0.0',
      description: 'API documentation สำหรับระบบ EasyCheck - ระบบจัดการการเข้างานและตารางงาน',
      contact: {
        name: 'EasyCheck Support',
        email: 'support@easycheck.com',
      },
    },
    servers: [
      {
        url: 'http://localhost:3000',
        description: 'Development server',
      },
      {
        url: 'https://api.easycheck.com',
        description: 'Production server',
      },
    ],
    components: {
      securitySchemes: {
        BearerAuth: {
          type: 'http',
          scheme: 'bearer',
          description: 'ใส่ Session Token ที่ได้จากการ Login (accessToken) ใน Authorization: Bearer <token>',
        },
      },
      schemas: {
        // Common Response
        ErrorResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: false,
            },
            error: {
              type: 'string',
              example: 'Error message',
            },
          },
        },
        SuccessResponse: {
          type: 'object',
          properties: {
            success: {
              type: 'boolean',
              example: true,
            },
            message: {
              type: 'string',
              example: 'Operation successful',
            },
          },
        },
        
        // Shift Schemas
        Shift: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1,
            },
            name: {
              type: 'string',
              example: 'กะเช้า',
            },
            shiftType: {
              type: 'string',
              enum: ['REGULAR', 'SPECIFIC_DAY', 'CUSTOM'],
              example: 'REGULAR',
            },
            startTime: {
              type: 'string',
              format: 'time',
              example: '08:00',
            },
            endTime: {
              type: 'string',
              format: 'time',
              example: '17:00',
            },
            userId: {
              type: 'integer',
              example: 1,
            },
            locationId: {
              type: 'integer',
              nullable: true,
              example: 1,
            },
            gracePeriodMinutes: {
              type: 'integer',
              example: 15,
            },
            lateThresholdMinutes: {
              type: 'integer',
              example: 30,
            },
            specificDays: {
              type: 'array',
              items: {
                type: 'string',
              },
              example: ['MONDAY', 'WEDNESDAY', 'FRIDAY'],
            },
            customDate: {
              type: 'string',
              format: 'date',
              nullable: true,
              example: '2026-02-15',
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        CreateShiftRequest: {
          type: 'object',
          required: ['name', 'shiftType', 'startTime', 'endTime', 'userId'],
          properties: {
            name: {
              type: 'string',
              example: 'กะเช้า',
              description: 'ชื่อของกะงาน',
            },
            shiftType: {
              type: 'string',
              enum: ['REGULAR', 'SPECIFIC_DAY', 'CUSTOM'],
              example: 'REGULAR',
              description: 'ประเภทของกะ',
            },
            startTime: {
              type: 'string',
              format: 'time',
              example: '08:00',
              description: 'เวลาเริ่มงาน (HH:MM)',
            },
            endTime: {
              type: 'string',
              format: 'time',
              example: '17:00',
              description: 'เวลาเลิกงาน (HH:MM)',
            },
            userId: {
              type: 'integer',
              example: 1,
              description: 'รหัสพนักงานที่รับกะนี้',
            },
            locationId: {
              type: 'integer',
              nullable: true,
              example: 1,
              description: 'รหัสสถานที่ทำงาน (optional)',
            },
            gracePeriodMinutes: {
              type: 'integer',
              example: 15,
              description: 'ระยะเวลาที่เข้าก่อนได้ (นาที)',
            },
            lateThresholdMinutes: {
              type: 'integer',
              example: 30,
              description: 'ระยะเวลาที่นับว่าสาย (นาที)',
            },
            specificDays: {
              type: 'array',
              items: {
                type: 'string',
                enum: ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY'],
              },
              example: ['MONDAY', 'WEDNESDAY', 'FRIDAY'],
              description: 'วันที่ใช้กะนี้ (สำหรับ SPECIFIC_DAY)',
            },
            customDate: {
              type: 'string',
              format: 'date',
              nullable: true,
              example: '2026-02-15',
              description: 'วันที่เฉพาะ (สำหรับ CUSTOM)',
            },
          },
        },
        
        // Attendance Schemas
        Attendance: {
          type: 'object',
          properties: {
            id: {
              type: 'integer',
              example: 1,
            },
            userId: {
              type: 'integer',
              example: 1,
            },
            shiftId: {
              type: 'integer',
              nullable: true,
              example: 1,
            },
            locationId: {
              type: 'integer',
              nullable: true,
              example: 1,
            },
            checkInTime: {
              type: 'string',
              format: 'date-time',
              example: '2026-02-13T08:00:00Z',
            },
            checkOutTime: {
              type: 'string',
              format: 'date-time',
              nullable: true,
              example: '2026-02-13T17:00:00Z',
            },
            checkInPhoto: {
              type: 'string',
              nullable: true,
              description: 'URL ของรูปภาพเข้างาน',
            },
            checkOutPhoto: {
              type: 'string',
              nullable: true,
              description: 'URL ของรูปภาพออกงาน',
            },
            checkInAddress: {
              type: 'string',
              nullable: true,
              example: 'Bangkok, Thailand',
            },
            checkOutAddress: {
              type: 'string',
              nullable: true,
              example: 'Bangkok, Thailand',
            },
            checkInLatitude: {
              type: 'number',
              format: 'double',
              nullable: true,
              example: 13.7563,
            },
            checkInLongitude: {
              type: 'number',
              format: 'double',
              nullable: true,
              example: 100.5018,
            },
            checkOutLatitude: {
              type: 'number',
              format: 'double',
              nullable: true,
            },
            checkOutLongitude: {
              type: 'number',
              format: 'double',
              nullable: true,
            },
            isLate: {
              type: 'boolean',
              example: false,
            },
            isOvertime: {
              type: 'boolean',
              example: false,
            },
            overtimeMinutes: {
              type: 'integer',
              example: 0,
            },
            createdAt: {
              type: 'string',
              format: 'date-time',
            },
            updatedAt: {
              type: 'string',
              format: 'date-time',
            },
          },
        },
        CheckInRequest: {
          type: 'object',
          required: ['userId'],
          properties: {
            userId: {
              type: 'integer',
              example: 1,
              description: 'รหัสผู้ใช้',
            },
            shiftId: {
              type: 'integer',
              example: 1,
              description: 'รหัสกะงาน (optional)',
            },
            locationId: {
              type: 'integer',
              example: 1,
              description: 'รหัสสถานที่ (optional)',
            },
            photo: {
              type: 'string',
              format: 'base64',
              description: 'รูปภาพในรูปแบบ Base64 (optional)',
            },
            latitude: {
              type: 'number',
              format: 'double',
              example: 13.7563,
              description: 'ละติจูด GPS (optional)',
            },
            longitude: {
              type: 'number',
              format: 'double',
              example: 100.5018,
              description: 'ลองจิจูด GPS (optional)',
            },
            address: {
              type: 'string',
              example: 'Bangkok, Thailand',
              description: 'ที่อยู่ (optional)',
            },
          },
        },
        CheckOutRequest: {
          type: 'object',
          required: ['userId'],
          properties: {
            userId: {
              type: 'integer',
              example: 1,
              description: 'รหัสผู้ใช้',
            },
            attendanceId: {
              type: 'integer',
              example: 1,
              description: 'รหัส attendance ที่จะออก (optional)',
            },
            shiftId: {
              type: 'integer',
              example: 1,
              description: 'รหัสกะงาน (optional)',
            },
            photo: {
              type: 'string',
              format: 'base64',
              description: 'รูปภาพในรูปแบบ Base64 (optional)',
            },
            latitude: {
              type: 'number',
              format: 'double',
              example: 13.7563,
              description: 'ละติจูด GPS (optional)',
            },
            longitude: {
              type: 'number',
              format: 'double',
              example: 100.5018,
              description: 'ลองจิจูด GPS (optional)',
            },
            address: {
              type: 'string',
              example: 'Bangkok, Thailand',
              description: 'ที่อยู่ (optional)',
            },
          },
        },

        // ──────────────────────────────────────────────
        // Auth Schemas
        // ──────────────────────────────────────────────
        LoginRequest: {
          type: 'object',
          required: ['employeeId', 'password'],
          properties: {
            employeeId: {
              type: 'string',
              example: 'BKK001',
              description: 'รหัสพนักงาน เช่น BKK001, CNX002',
            },
            password: {
              type: 'string',
              example: '1234567890123',
              description: 'รหัสผ่าน (nationalId เริ่มต้น หรือรหัสที่เปลี่ยนแล้ว)',
            },
          },
        },
        LoginResponse: {
          type: 'object',
          properties: {
            accessToken: {
              type: 'string',
              description: 'Session Token (อายุ 15 นาที) — ใช้ใน Authorization: Bearer <token>',
              example: 'a3f8d2c1b5e9...',
            },
            refreshToken: {
              type: 'string',
              description: 'Refresh Token (อายุ 7 วัน) — ใช้ขอ accessToken ใหม่',
              example: 'f7c4e6a2d1b8...',
            },
            expiresIn: {
              type: 'integer',
              description: 'อายุของ accessToken (วินาที)',
              example: 900,
            },
            user: {
              $ref: '#/components/schemas/LoginUser',
            },
          },
        },
        LoginUser: {
          type: 'object',
          description: 'ข้อมูลผู้ใช้ที่ได้รับหลัง Login สำเร็จ',
          properties: {
            userId: { type: 'integer', example: 5 },
            employeeId: { type: 'string', example: 'BKK001' },
            firstName: { type: 'string', example: 'สมชาย' },
            lastName: { type: 'string', example: 'ใจดี' },
            email: { type: 'string', example: 'somchai@example.com' },
            role: {
              type: 'string',
              enum: ['USER', 'MANAGER', 'ADMIN', 'SUPERADMIN'],
              example: 'ADMIN',
            },
            avatarUrl: { type: 'string', nullable: true, example: 'https://xxx.supabase.co/storage/v1/object/public/avatars/male-1.png' },
            branchId: { type: 'integer', nullable: true, example: 1 },
          },
        },

        // ──────────────────────────────────────────────
        // User Schemas
        // ──────────────────────────────────────────────
        UserProfile: {
          type: 'object',
          description: 'ข้อมูลพนักงานที่ใช้แสดงใน UI',
          properties: {
            userId: { type: 'integer', example: 5 },
            employeeId: {
              type: 'string',
              example: 'BKK001',
              description: 'รหัสพนักงาน auto-generate',
            },
            title: {
              type: 'string',
              enum: ['MR', 'MRS', 'MISS'],
              example: 'MR',
            },
            firstName: { type: 'string', example: 'สมชาย' },
            lastName: { type: 'string', example: 'ใจดี' },
            nickname: { type: 'string', nullable: true, example: 'ชาย' },
            gender: {
              type: 'string',
              enum: ['MALE', 'FEMALE'],
              example: 'MALE',
            },
            phone: { type: 'string', example: '0898765432' },
            email: {
              type: 'string',
              format: 'email',
              example: 'somchai@example.com',
            },
            birthDate: {
              type: 'string',
              format: 'date',
              example: '1990-01-15',
            },
            role: {
              type: 'string',
              enum: ['USER', 'MANAGER', 'ADMIN', 'SUPERADMIN'],
              example: 'USER',
            },
            status: {
              type: 'string',
              enum: ['ACTIVE', 'INACTIVE', 'RESIGNED'],
              example: 'ACTIVE',
            },
            branchId: { type: 'integer', example: 1 },
            avatarUrl: {
              type: 'string',
              nullable: true,
              example:
                'https://xxx.supabase.co/storage/v1/object/public/avatars/male-1.png',
            },
            emergent_tel: { type: 'string', example: '0812345678' },
            emergent_first_name: { type: 'string', example: 'สมหญิง' },
            emergent_last_name: { type: 'string', example: 'ใจดี' },
            emergent_relation: { type: 'string', example: 'ภรรยา' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time' },
          },
        },
        CreateUserRequest: {
          type: 'object',
          required: [
            'title', 'firstName', 'lastName', 'gender', 'nationalId',
            'emergent_tel', 'emergent_first_name', 'emergent_last_name',
            'emergent_relation', 'phone', 'email', 'password',
            'birthDate', 'branchId',
          ],
          properties: {
            title: {
              type: 'string',
              enum: ['MR', 'MRS', 'MISS'],
              example: 'MR',
            },
            firstName: { type: 'string', example: 'สมชาย' },
            lastName: { type: 'string', example: 'ใจดี' },
            nickname: { type: 'string', nullable: true, example: 'ชาย' },
            gender: {
              type: 'string',
              enum: ['MALE', 'FEMALE'],
              example: 'MALE',
            },
            nationalId: {
              type: 'string',
              example: '1234567890123',
              description: 'เลขบัตรประชาชน 13 หลัก (ใช้เป็นรหัสผ่านเริ่มต้น)',
            },
            emergent_tel: { type: 'string', example: '0812345678' },
            emergent_first_name: { type: 'string', example: 'สมหญิง' },
            emergent_last_name: { type: 'string', example: 'ใจดี' },
            emergent_relation: { type: 'string', example: 'ภรรยา' },
            phone: { type: 'string', example: '0898765432' },
            email: {
              type: 'string',
              format: 'email',
              example: 'somchai@example.com',
            },
            password: {
              type: 'string',
              example: '1234567890123',
              description: 'รหัสผ่านเริ่มต้น',
            },
            birthDate: {
              type: 'string',
              format: 'date',
              example: '1990-01-15',
            },
            branchId: {
              type: 'integer',
              example: 1,
              description: 'สาขาที่พนักงานสังกัด (ใช้ generate employeeId)',
            },
            role: {
              type: 'string',
              enum: ['USER', 'MANAGER', 'ADMIN', 'SUPERADMIN'],
              default: 'USER',
              example: 'USER',
            },
          },
        },
        UpdateUserRequest: {
          type: 'object',
          properties: {
            firstName: { type: 'string', example: 'สมชาย' },
            lastName: { type: 'string', example: 'ใจดี' },
            nickname: { type: 'string', example: 'ชาย' },
            phone: { type: 'string', example: '0898765432' },
            email: { type: 'string', format: 'email', example: 'new@example.com' },
            birthDate: { type: 'string', format: 'date', example: '1990-01-15' },
            branchId: { type: 'integer', example: 2 },
            role: {
              type: 'string',
              enum: ['USER', 'MANAGER', 'ADMIN', 'SUPERADMIN'],
              example: 'MANAGER',
            },
            status: {
              type: 'string',
              enum: ['ACTIVE', 'INACTIVE', 'RESIGNED'],
              example: 'ACTIVE',
            },
            nationalId: { type: 'string', example: '1234567890123' },
            emergent_tel: { type: 'string', example: '0812345678' },
            emergent_first_name: { type: 'string', example: 'สมหญิง' },
            emergent_last_name: { type: 'string', example: 'ใจดี' },
            emergent_relation: { type: 'string', example: 'ภรรยา' },
            avatarGender: {
              type: 'string',
              enum: ['male', 'female'],
              example: 'male',
              description: 'เปลี่ยน avatar',
            },
          },
        },

        // ──────────────────────────────────────────────
        // Dashboard Schemas
        // ──────────────────────────────────────────────
        AttendanceSummary: {
          type: 'object',
          description: 'สรุปจำนวน attendance วันนี้สำหรับ Donut Chart',
          properties: {
            onTime: { type: 'integer', example: 15, description: 'จำนวนมาตรงเวลา' },
            late: { type: 'integer', example: 3, description: 'จำนวนมาสาย' },
            absent: { type: 'integer', example: 2, description: 'จำนวนขาดงาน' },
            total: { type: 'integer', example: 20, description: 'จำนวนทั้งหมด' },
          },
        },
        EmployeeToday: {
          type: 'object',
          description: 'ข้อมูลพนักงานพร้อมสถานะ check-in วันนี้',
          properties: {
            employeeId: { type: 'string', example: 'BKK001' },
            name: { type: 'string', example: 'สมชาย ใจดี' },
            branch: { type: 'string', example: 'สำนักงานใหญ่' },
            status: { type: 'string', enum: ['ON_TIME', 'LATE', 'ABSENT'], example: 'ON_TIME' },
            checkIn: { type: 'string', example: '08:30', description: 'เวลาเข้างาน (HH:mm)' },
            checkOut: { type: 'string', nullable: true, example: '17:30', description: 'เวลาออกงาน (HH:mm)' },
            lateMinutes: { type: 'integer', example: 0 },
          },
        },
        BranchMap: {
          type: 'object',
          description: 'ข้อมูลสาขาสำหรับแสดง Map Pins',
          properties: {
            branchId: { type: 'integer', example: 1 },
            name: { type: 'string', example: 'สำนักงานใหญ่' },
            latitude: { type: 'number', format: 'double', example: 13.7563 },
            longitude: { type: 'number', format: 'double', example: 100.5018 },
            totalEmployees: { type: 'integer', example: 50 },
            address: { type: 'string', example: 'กรุงเทพมหานคร' },
          },
        },
        LocationEvent: {
          type: 'object',
          description: 'เหตุการณ์ check-in นอกพื้นที่',
          properties: {
            eventId: { type: 'integer', example: 101 },
            employeeName: { type: 'string', example: 'สมหญิง รักไทย' },
            checkInTime: { type: 'string', example: '09:15' },
            expectedLocation: { type: 'string', example: 'สำนักงานใหญ่' },
            actualDistance: { type: 'integer', example: 1500, description: 'ระยะห่างจริง (เมตร)' },
            allowedRadius: { type: 'integer', example: 200, description: 'radius ที่กำหนด (เมตร)' },
            timestamp: { type: 'string', format: 'date-time' },
          },
        },
        BranchStats: {
          type: 'object',
          description: 'สถิติ KPI ของสาขา',
          properties: {
            branchId: { type: 'integer', example: 1 },
            name: { type: 'string', example: 'สำนักงานใหญ่' },
            totalEmployees: { type: 'integer', example: 50 },
            presentToday: { type: 'integer', example: 40 },
            lateToday: { type: 'integer', example: 5 },
            absentToday: { type: 'integer', example: 5 },
            attendanceRate: { type: 'integer', example: 80, description: 'อัตราการมา (%)' },
          },
        },

        // ──────────────────────────────────────────────
        // Event Schemas
        // ──────────────────────────────────────────────
        Event: {
          type: 'object',
          description: 'ข้อมูลกิจกรรม/อีเวนต์',
          properties: {
            eventId: { type: 'integer', example: 1 },
            eventName: { type: 'string', example: 'ประชุมประจำเดือน' },
            description: { type: 'string', nullable: true, example: 'ประชุมสรุปผลงานประจำเดือน' },
            locationId: { type: 'integer', example: 1 },
            participantType: {
              type: 'string',
              enum: ['ALL', 'INDIVIDUAL', 'BRANCH', 'ROLE'],
              example: 'ALL',
            },
            isActive: { type: 'boolean', example: true },
            startDateTime: { type: 'string', format: 'date-time', example: '2026-03-01T09:00:00.000Z' },
            endDateTime: { type: 'string', format: 'date-time', example: '2026-03-01T12:00:00.000Z' },
            createdAt: { type: 'string', format: 'date-time' },
            updatedAt: { type: 'string', format: 'date-time', nullable: true },
            deletedAt: { type: 'string', format: 'date-time', nullable: true },
            deleteReason: { type: 'string', nullable: true },
            location: {
              type: 'object',
              properties: {
                locationId: { type: 'integer', example: 1 },
                locationName: { type: 'string', example: 'ห้องประชุม A' },
                address: { type: 'string', example: 'อาคาร A ชั้น 5' },
                latitude: { type: 'number', format: 'double', example: 13.7563 },
                longitude: { type: 'number', format: 'double', example: 100.5018 },
                radius: { type: 'integer', example: 200 },
              },
            },
            creator: {
              type: 'object',
              properties: {
                userId: { type: 'integer', example: 1 },
                firstName: { type: 'string', example: 'Admin' },
                lastName: { type: 'string', example: 'User' },
              },
            },
            _count: {
              type: 'object',
              properties: {
                event_participants: { type: 'integer', example: 10 },
                attendance: { type: 'integer', example: 8 },
              },
            },
          },
        },
        CreateEventRequest: {
          type: 'object',
          required: ['eventName', 'locationId', 'startDateTime', 'endDateTime', 'participantType'],
          properties: {
            eventName: { type: 'string', example: 'ประชุมประจำเดือน', description: 'ชื่อกิจกรรม' },
            description: { type: 'string', example: 'ประชุมสรุปผลงาน', description: 'รายละเอียด (optional)' },
            locationId: { type: 'integer', example: 1, description: 'ID สถานที่จัดกิจกรรม' },
            startDateTime: { type: 'string', format: 'date-time', example: '2026-03-01T09:00:00.000Z', description: 'วันเวลาเริ่ม' },
            endDateTime: { type: 'string', format: 'date-time', example: '2026-03-01T12:00:00.000Z', description: 'วันเวลาสิ้นสุด' },
            participantType: {
              type: 'string',
              enum: ['ALL', 'INDIVIDUAL', 'BRANCH', 'ROLE'],
              example: 'ALL',
              description: 'ประเภทผู้เข้าร่วม',
            },
            participants: {
              type: 'object',
              description: 'รายชื่อผู้เข้าร่วม (ไม่ต้องส่งถ้า participantType = ALL)',
              properties: {
                userIds: { type: 'array', items: { type: 'integer' }, example: [1, 2, 3], description: 'สำหรับ INDIVIDUAL' },
                branchIds: { type: 'array', items: { type: 'integer' }, example: [1, 2], description: 'สำหรับ BRANCH' },
                roles: { type: 'array', items: { type: 'string', enum: ['USER', 'MANAGER', 'ADMIN', 'SUPERADMIN'] }, example: ['USER', 'MANAGER'], description: 'สำหรับ ROLE' },
              },
            },
          },
        },
        UpdateEventRequest: {
          type: 'object',
          description: 'ส่งเฉพาะ field ที่ต้องการแก้ไข',
          properties: {
            eventName: { type: 'string', example: 'ชื่อกิจกรรมใหม่' },
            description: { type: 'string', example: 'รายละเอียดใหม่' },
            startDateTime: { type: 'string', format: 'date-time' },
            endDateTime: { type: 'string', format: 'date-time' },
            participantType: { type: 'string', enum: ['ALL', 'INDIVIDUAL', 'BRANCH', 'ROLE'] },
            isActive: { type: 'boolean', example: false },
            participants: {
              type: 'object',
              properties: {
                userIds: { type: 'array', items: { type: 'integer' } },
                branchIds: { type: 'array', items: { type: 'integer' } },
                roles: { type: 'array', items: { type: 'string' } },
              },
            },
          },
        },
        DeleteEventRequest: {
          type: 'object',
          properties: {
            deleteReason: { type: 'string', example: 'ยกเลิกเนื่องจากสถานการณ์ฉุกเฉิน', description: 'เหตุผลการลบ (optional)' },
          },
        },
        EventStatistics: {
          type: 'object',
          description: 'สถิติกิจกรรมทั้งหมด',
          properties: {
            totalEvents: { type: 'integer', example: 20 },
            activeEvents: { type: 'integer', example: 15 },
            upcomingEvents: { type: 'integer', example: 8 },
            ongoingEvents: { type: 'integer', example: 3 },
            pastEvents: { type: 'integer', example: 4 },
            deletedEvents: { type: 'integer', example: 2 },
            byParticipantType: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  type: { type: 'string', example: 'ALL' },
                  count: { type: 'integer', example: 5 },
                },
              },
            },
          },
        },
        EventListResponse: {
          type: 'object',
          properties: {
            data: { type: 'array', items: { $ref: '#/components/schemas/Event' } },
            total: { type: 'integer', example: 15 },
            active: { type: 'integer', example: 12 },
            inactive: { type: 'integer', example: 3 },
          },
        },

        // ──────────────────────────────────────────────
        // Download Report Schemas
        // ──────────────────────────────────────────────
        DownloadLog: {
          type: 'object',
          description: 'ประวัติการดาวน์โหลดรายงาน',
          properties: {
            downloadLogId: { type: 'integer', example: 1 },
            userId: { type: 'integer', example: 1 },
            fileName: { type: 'string', example: 'attendance_1708588800000.xlsx' },
            reportType: { type: 'string', example: 'attendance' },
            downloadAt: { type: 'string', format: 'date-time' },
            user: {
              type: 'object',
              properties: {
                employeeId: { type: 'string', example: 'BKK001' },
                firstName: { type: 'string', example: 'สมชาย' },
                lastName: { type: 'string', example: 'ใจดี' },
              },
            },
          },
        },

        // ───────────────────────────────────────────
        // 📢 Announcement Schemas
        // ───────────────────────────────────────────
        Announcement: {
          type: 'object',
          properties: {
            announcementId:   { type: 'integer', example: 1 },
            title:            { type: 'string',  example: 'ประกาศหยุดวันสงกรานต์' },
            content:          { type: 'string',  example: 'Hdays in 2026 จะมีวันหยุดเพิ่มเติม 1 วัน' },
            targetRoles:      { type: 'array', items: { type: 'string', enum: ['SUPERADMIN','ADMIN','MANAGER','USER'] }, example: ['ADMIN','USER'] },
            targetBranchIds:  { type: 'array', items: { type: 'integer' }, example: [1, 2] },
            status:           { type: 'string', enum: ['DRAFT','SENT'], example: 'DRAFT' },
            createdByUserId:  { type: 'integer', example: 3 },
            updatedByUserId:  { type: 'integer', nullable: true, example: null },
            sentByUserId:     { type: 'integer', nullable: true, example: null },
            sentAt:           { type: 'string',  format: 'date-time', nullable: true, example: null },
            deletedAt:        { type: 'string',  format: 'date-time', nullable: true, example: null },
            deleteReason:     { type: 'string',  nullable: true, example: null },
            createdAt:        { type: 'string',  format: 'date-time' },
            updatedAt:        { type: 'string',  format: 'date-time' },
            creator: {
              type: 'object',
              properties: {
                userId:    { type: 'integer', example: 3 },
                firstName: { type: 'string',  example: 'สมคิด' },
                lastName:  { type: 'string',  example: 'เก่งกาจ' },
              },
            },
          },
        },

        AnnouncementWithRecipients: {
          allOf: [
            { '$ref': '#/components/schemas/Announcement' },
            {
              type: 'object',
              properties: {
                recipients: {
                  type: 'array',
                  items: {
                    type: 'object',
                    properties: {
                      recipientId:    { type: 'integer', example: 10 },
                      announcementId: { type: 'integer', example: 1 },
                      userId:         { type: 'integer', example: 7 },
                      sentAt:         { type: 'string', format: 'date-time' },
                      user: {
                        type: 'object',
                        properties: {
                          userId:    { type: 'integer', example: 7 },
                          firstName: { type: 'string',  example: 'อนุวัตร' },
                          lastName:  { type: 'string',  example: 'ค์เกื้อ' },
                          email:     { type: 'string',  example: 'anuwatch@company.com' },
                        },
                      },
                    },
                  },
                },
              },
            },
          ],
        },

        CreateAnnouncementRequest: {
          type: 'object',
          required: ['title', 'content'],
          properties: {
            title:           { type: 'string', example: 'ประกาศหยุดวันสงกรานต์' },
            content:         { type: 'string', example: 'บริษัทหยุดวันสงกรานต์ทุกวัน' },
            targetRoles:     { type: 'array', items: { type: 'string', enum: ['SUPERADMIN','ADMIN','MANAGER','USER'] }, description: 'ตั้งค่าว่าง = ส่งหาทุก role', example: ['ADMIN','USER'] },
            targetBranchIds: { type: 'array', items: { type: 'integer' }, description: 'ตั้งค่าว่าง = ส่งทุกสาขา', example: [1, 2] },
          },
        },

        UpdateAnnouncementRequest: {
          type: 'object',
          properties: {
            title:           { type: 'string', example: 'ประกาศแก้ไข' },
            content:         { type: 'string', example: 'เนื้อหาใหม่' },
            targetRoles:     { type: 'array', items: { type: 'string', enum: ['SUPERADMIN','ADMIN','MANAGER','USER'] } },
            targetBranchIds: { type: 'array', items: { type: 'integer' } },
          },
        },
      },
    },
    security: [
      {
        BearerAuth: [],
      },
    ],
  },
  apis: ['./src/routes/*.ts', './src/routes/*.js', './src/docs/*.ts'], // ระบุไฟล์ที่มี JSDoc comments
};

const swaggerSpec = swaggerJsdoc(options);

export const setupSwagger = (app: Application) => {
  // Swagger UI
  app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec, {
    explorer: true,
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'EasyCheck API Docs',
  }));

  // JSON endpoint
  app.get('/api-docs.json', (req, res) => {
    res.setHeader('Content-Type', 'application/json');
    res.send(swaggerSpec);
  });

  console.log('📚 Swagger documentation available at /api-docs');
};

export default swaggerSpec;
