import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import mainRouter from './routes/index.js';
import { setupAttendanceWebSocket } from './websocket/attendance.websocket.js';
import { setupSwagger } from './config/swagger.js';

const app = express();
const PORT = process.env.PORT || 3000;

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
app.use((err: any, req: any, res: any, next: any) => {
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

// Setup WebSocket สำหรับ real-time attendance
setupAttendanceWebSocket(server);

server.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Server is running on http://0.0.0.0:${PORT}`);
});