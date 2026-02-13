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
          bearerFormat: 'JWT',
          description: 'ใส่ JWT Token ที่ได้จากการ Login',
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
