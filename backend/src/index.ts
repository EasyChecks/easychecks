import express from 'express';
import cors from 'cors';
// import mainRouter from './routes'; // <-- 1. Import ตัวรวมมา (มันจะหา index.ts อัตโนมัติ)

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
// 2. บอกว่าทุก API ต้องขึ้นต้นด้วย /api แล้วค่อยไปหา mainRouter
// app.use('/api', mainRouter); 

// Health Check (เอาไว้เทสว่า Server ดับไหม)
app.get('/', (req, res) => {
  res.send('Backend is running smoothly!');
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});