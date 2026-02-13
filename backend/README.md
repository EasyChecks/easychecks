# Backend - EasyCheck API

Express.js REST API with TypeScript, Prisma ORM, and PostgreSQL

---

## 📋 Table of Contents

- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Development](#development)
- [Testing](#testing)
- [API Documentation](#api-documentation)
- [Database](#database)
- [Environment Variables](#environment-variables)

---

## Tech Stack

- **Runtime**: Node.js 22.x
- **Framework**: Express.js 5.x
- **Language**: TypeScript
- **Database**: PostgreSQL (Supabase)
- **ORM**: Prisma
- **Authentication**: JWT / Supabase Auth
- **Testing**: Jest + Supertest
- **Documentation**: Swagger/OpenAPI

---

## Project Structure

```
backend/
├── src/
│   ├── controllers/      # Request handlers
│   ├── routes/          # API route definitions
│   ├── services/        # Business logic layer
│   ├── middleware/      # Custom middleware (auth, rate limit, etc.)
│   ├── utils/           # Helper functions
│   ├── types/           # TypeScript types/interfaces
│   ├── config/          # Configuration files
│   ├── websocket/       # WebSocket handlers
│   ├── docs/            # API documentation
│   └── index.ts         # Application entry point
│
├── prisma/
│   ├── schema.prisma    # Database schema
│   ├── migrations/      # Database migrations
│   └── seed.ts          # Database seeding
│
├── __tests__/           # Test files
├── Dockerfile           # Development Docker image
├── Dockerfile.prod      # Production Docker image
└── package.json         # Dependencies & scripts
```

---

## Getting Started

### Prerequisites

- Node.js 22.x
- PostgreSQL (or Supabase account)
- Docker (optional)

### Installation

```bash
# Install dependencies
npm install

# Setup environment variables
cp .env.example .env
# Edit .env with your DATABASE_URL and other configs

# Generate Prisma Client
npx prisma generate

# Run database migrations
npx prisma migrate dev

# Seed database (optional)
npm run seed
```

### Run Development Server

```bash
# Start server with hot reload
npm run dev

# Server runs on http://localhost:3000
# API Docs: http://localhost:3000/api-docs
# Health Check: http://localhost:3000/api/health
```

---

## Development

### Available Scripts

```bash
npm run dev              # Start development server with hot reload
npm run build            # Build TypeScript to JavaScript
npm start                # Run production build
npm test                 # Run tests
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Generate coverage report
npm run seed             # Seed database with sample data
```

### Hot Reload

Development server uses `tsx watch` for automatic reloading when files change.

**In Docker:**
```bash
# Source code is mounted as volume
# Changes automatically reload inside container
docker-compose logs -f backend
```

### Code Style

- Use **TypeScript** for type safety
- Follow **camelCase** naming convention
- Run **Prettier** before committing: `npm run format`
- Use **ESLint** for linting: `npm run lint`

---

## Testing

### Unit Tests

```bash
# Run all tests
npm test

# Watch mode (recommended during development)
npm run test:watch

# Coverage report
npm run test:coverage
```

### Test Structure

```typescript
// src/__tests__/auth.test.ts
import request from 'supertest';
import app from '../index';

describe('Authentication API', () => {
  describe('POST /api/auth/login', () => {
    it('should return 200 with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'test@example.com', password: 'password' });
      
      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('token');
    });
  });
});
```

### Writing Tests

- Place tests in `src/__tests__/`
- Name test files: `*.test.ts`
- Use descriptive test names
- Mock external dependencies
- Aim for 80%+ coverage

---

## API Documentation

### Swagger UI

Interactive API documentation available at:
- **Development**: http://localhost:3000/api-docs
- **Production**: https://your-domain.com/api-docs

### Endpoints Overview

| Method | Endpoint | Description | Auth |
|--------|----------|-------------|------|
| `GET` | `/api/health` | Health check | ❌ |
| `POST` | `/api/auth/login` | User login | ❌ |
| `POST` | `/api/auth/register` | User registration | ❌ |
| `GET` | `/api/users` | Get all users | ✅ |
| `GET` | `/api/users/:id` | Get user by ID | ✅ |
| `POST` | `/api/attendance/check-in` | Check in | ✅ |
| `POST` | `/api/attendance/check-out` | Check out | ✅ |

**Note**: ✅ = Requires authentication token

### Response Format

**Success Response:**
```json
{
  "success": true,
  "data": { ... },
  "message": "Operation successful"
}
```

**Error Response:**
```json
{
  "success": false,
  "error": "Error message",
  "details": { ... }
}
```

---

## Database

### Prisma Commands

```bash
# Generate Prisma Client
npx prisma generate

# Create migration
npx prisma migrate dev --name migration_name

# Apply migrations
npx prisma migrate deploy

# Reset database (⚠️ deletes all data)
npx prisma migrate reset

# Open Prisma Studio (GUI)
npx prisma studio

# Seed database
npm run seed
```

### Schema Example

```prisma
// prisma/schema.prisma
model User {
  id        String   @id @default(uuid())
  email     String   @unique
  name      String
  role      Role     @default(EMPLOYEE)
  createdAt DateTime @default(now())
  updatedAt DateTime @updatedAt
  
  attendances Attendance[]
}

model Attendance {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  checkIn   DateTime
  checkOut  DateTime?
  status    AttendanceStatus
}
```

### Migrations

- Stored in `prisma/migrations/`
- Auto-generated when running `prisma migrate dev`
- Applied automatically in Docker on startup
- Production: use `prisma migrate deploy`

---

## Environment Variables

Create `.env` file in backend directory:

```env
# Database
DATABASE_URL="postgresql://user:password@localhost:5432/easycheck?schema=public&pgbouncer=true"
DIRECT_URL="postgresql://user:password@localhost:5432/easycheck?schema=public"

# Supabase
SUPABASE_URL="https://your-project.supabase.co"
SUPABASE_KEY="your-supabase-anon-key"

# Server
PORT=3000
NODE_ENV=development

# JWT (if using custom auth)
JWT_SECRET="your-secret-key"
JWT_EXPIRES_IN="7d"

# CORS
CORS_ORIGIN="http://localhost:3000"
```

**Required Variables:**
- `DATABASE_URL` - Prisma connection string
- `DIRECT_URL` - Direct database connection (for migrations)
- `SUPABASE_URL` - Supabase project URL
- `SUPABASE_KEY` - Supabase anonymous key

---

## Docker

### Development

```bash
# Start with docker-compose (from root)
docker-compose up -d

# View logs
docker-compose logs -f backend

# Enter container
docker exec -it easycheck-backend sh

# Run Prisma commands inside container
docker exec -it easycheck-backend npx prisma generate
docker exec -it easycheck-backend npx prisma migrate dev
```

### Production

```bash
# Build and run production image
docker-compose -f docker-compose.prod.yml up -d backend

# Production uses multi-stage build for smaller image
```

**Features:**
- ✅ Hot reload in development
- ✅ Anonymous volume for `node_modules` (no red in VS Code)
- ✅ Health checks
- ✅ Automatic migrations on startup
- ✅ Optimized production build

---

## WebSocket

Real-time features using WebSocket:

```typescript
// Connect to WebSocket
const ws = new WebSocket('ws://localhost:3000');

// Listen for attendance updates
ws.on('attendance:update', (data) => {
  console.log('Attendance updated:', data);
});
```

**Events:**
- `attendance:check-in` - User checked in
- `attendance:check-out` - User checked out
- `attendance:update` - Attendance record updated

---

## Security

### Best Practices

- ✅ Input validation with Zod
- ✅ Rate limiting on auth endpoints
- ✅ SQL injection prevention (Prisma)
- ✅ CORS configuration
- ✅ Environment variables for secrets
- ✅ Password hashing (bcrypt)
- ✅ JWT authentication
- ✅ Role-based access control (RBAC)

### Middleware

```typescript
// Authentication
import { authMiddleware } from './middleware/auth.middleware';
router.get('/protected', authMiddleware, controller);

// Role checking
import { roleMiddleware } from './middleware/role.middleware';
router.delete('/admin', authMiddleware, roleMiddleware(['ADMIN']), controller);

// Rate limiting
import { rateLimitMiddleware } from './middleware/rateLimit.middleware';
router.post('/login', rateLimitMiddleware, controller);
```

---

## Troubleshooting

### Common Issues

**Prisma Client not generated:**
```bash
npx prisma generate
npm run dev
```

**Database connection error:**
- Check `DATABASE_URL` in `.env`
- Ensure PostgreSQL is running
- Verify network connectivity

**Port already in use:**
```bash
lsof -i :3000
kill -9 <PID>
```

**Hot reload not working:**
- Check file is saved
- Restart dev server: `npm run dev`
- In Docker: `docker-compose restart backend`

---

## Performance

### Optimization Tips

- Use Prisma query optimization
- Implement caching (Redis)
- Use database indexes
- Paginate large datasets
- Optimize N+1 queries

### Monitoring

```typescript
// Log response time
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`${req.method} ${req.path} - ${duration}ms`);
  });
  next();
});
```

---

## Contributing

1. Create feature branch
2. Write tests for new features
3. Follow code style guidelines
4. Update API documentation
5. Run tests and ensure they pass
6. Submit Pull Request

---

## Resources

- [Express.js Documentation](https://expressjs.com/)
- [Prisma Documentation](https://www.prisma.io/docs)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)
- [Supabase Documentation](https://supabase.com/docs)
- [Jest Documentation](https://jestjs.io/)

---

## Support

Need help?
- Check [main README](../README.md)
- Ask in Discord server
- Create an issue on GitHub
