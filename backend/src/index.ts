import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import { parse } from 'url';
import mainRouter from './routes/index.js';
import { setupAttendanceWebSocket } from './websocket/attendance.websocket.js';
import { setupEventWebSocket } from './websocket/event.websocket.js';
import { setupSwagger } from './config/swagger.js';

const app = express();
const PORT = Number(process.env.PORT) || 3001;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // เพิ่ม limit สำหรับรับรูปภาพ base64

// Setup Swagger Documentation
setupSwagger(app);

// Health Check endpoint for Docker
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development'
  });
});

// Routes
app.use('/api', mainRouter);

// 404 Handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
    path: req.path,
    method: req.method
  });
});

// Error Handler
import type { Request, Response, NextFunction } from 'express';
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error('Error:', err);
  res.status(500).json({
    success: false,
    error: err.message || 'Internal server error'
  });
});

// Health Check (เอาไว้เทสว่า Server ดับไหม)
app.get('/', (req, res) => {
  res.send('Backend is running smoothly!');
});

// Test API
app.get('/api/test', (req, res) => {
  res.json({
    success: true,
    message: 'API working',
    user: req.user || 'Not authenticated'
  });
});

// สร้าง HTTP server สำหรับ WebSocket
const server = createServer(app);

// Setup WebSocket servers (แต่ละตัวจะ register upgrade handler ของตัวเอง)
const attendanceWss = setupAttendanceWebSocket(server);
const eventWss = setupEventWebSocket(server);

// แทนที่ upgrade handlers แยกกัน ด้วย centralized routing ตัวเดียว
// เพราะ attendance handler ทำ socket.destroy() กับ path ที่ไม่ใช่ /ws/attendance
// ทำให้ /ws/events ถูกปิดก่อนจะถึง event handler
server.removeAllListeners('upgrade');
server.on('upgrade', (request, socket, head) => {
  const { pathname } = parse(request.url || '');
  if (pathname === '/ws/attendance') {
    attendanceWss.handleUpgrade(request, socket, head, (ws) => {
      attendanceWss.emit('connection', ws, request);
    });
  } else if (pathname === '/ws/events') {
    eventWss.handleUpgrade(request, socket, head, (ws) => {
      eventWss.emit('connection', ws, request);
    });
  } else {
    socket.destroy();
  }
});

server.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
});