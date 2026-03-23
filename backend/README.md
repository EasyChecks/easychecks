# EasyCheck Backend

Express.js + TypeScript API for attendance, shift, leave, event, and audit workflows.

## Stack

- Node.js 22.x
- Express 5.x
- Prisma + PostgreSQL/Supabase
- WebSocket (real-time updates)
- Swagger/OpenAPI
- Vitest (test runner)

## Runbook

1. Install dependencies.

```bash
npm install
```

2. Configure environment.

Create `.env` in this folder with at least:

- `DATABASE_URL`
- `DIRECT_URL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_ANON_KEY`)
- `JWT_SECRET`

3. Sync Prisma client and database.

```bash
npx prisma generate
npx prisma migrate dev
```

4. Start API.

```bash
npm run dev
```

Default endpoints:

- API base: `http://localhost:3001/api`
- Health: `http://localhost:3001/api/health`
- Swagger: `http://localhost:3001/api-docs`

## Scripts

```bash
npm run dev               # tsx watch
npm run build             # tsc
npm start                 # run dist
npm run lint              # tsc --noEmit
npm test                  # vitest run --passWithNoTests
npm run test:watch        # vitest watch
npm run test:coverage     # vitest coverage
npm run test:core-apis    # bash ../test-apis.sh
npm run seed              # seed database
```

## DB Operations

```bash
npx prisma generate
npx prisma migrate dev --name <name>
npx prisma migrate deploy
npx prisma migrate reset --force
npx prisma studio
```

## Policy Notes

- Attendance check-in requires `shiftId` and real GPS coordinates.
- Approved full-day leave blocks check-in.
- One user has at most one active shift for today.
- Non-GET write operations are expected to emit audit logs.

## Smoke Testing

From repository root:

```bash
npm run test:core-apis
```

This script validates key attendance, shift, and audit endpoints with seeded accounts.

## Troubleshooting

- Prisma type mismatch after schema change:

```bash
npx prisma generate
npm run lint
```

- Docker volume uses stale Prisma client: regenerate inside container and restart backend.

```bash
docker exec -it easycheck-backend npx prisma generate
docker-compose restart backend
```

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
