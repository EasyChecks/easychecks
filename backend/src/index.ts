import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import mainRouter from './routes/index.js';
import { setupAttendanceWebSocket } from './websocket/attendance.websocket.js';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '50mb' })); // เพิ่ม limit สำหรับรับรูปภาพ base64

// Routes
app.use('/api', mainRouter); 

// Health Check (เอาไว้เทสว่า Server ดับไหม)
app.get('/', (req, res) => {
  res.send('Backend is running smoothly!');
});

// สร้าง HTTP server สำหรับ WebSocket
const server = createServer(app);

// Setup WebSocket สำหรับ real-time attendance
setupAttendanceWebSocket(server);

server.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  console.log(`📡 WebSocket endpoint: ws://localhost:${PORT}/ws/attendance`);
});