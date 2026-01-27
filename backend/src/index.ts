import express from 'express';
import cors from 'cors';
import mainRouter from './routes';

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(express.json());

// Routes
app.use('/api', mainRouter); 

// Health Check (เอาไว้เทสว่า Server ดับไหม)
app.get('/', (req, res) => {
  res.send('Backend is running smoothly!');
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});