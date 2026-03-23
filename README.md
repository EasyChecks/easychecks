## EasyCheck

Attendance and workforce management platform with Next.js frontend, Express TypeScript backend, Prisma, and PostgreSQL/Supabase.

[![CI Pipeline](https://github.com/EasyChecks/easychecks/workflows/CI%20Pipeline/badge.svg)](https://github.com/EasyChecks/easychecks/actions)
[![Node Version](https://img.shields.io/badge/node-22.x-green.svg)](https://nodejs.org)
[![Docker](https://img.shields.io/badge/docker-ready-blue.svg)](https://www.docker.com/)

## Monorepo Layout

- `frontend`: Next.js app (port 3000 in local dev)
- `backend`: Express API + Prisma (port 3001 in local dev)
- `legacy-frontend`: legacy Vite codebase (reference/migration only)
- `test-apis.sh`: one-click core API smoke tests (attendance, shift, audit)

## Prerequisites

- Node.js 22.x
- npm
- PostgreSQL or Supabase project
- Optional: Docker + Docker Compose

## Local Development

1. Install dependencies.

```bash
npm install
cd backend && npm install
cd ../frontend && npm install
```

2. Configure environment variables.

- Create `backend/.env` with database and Supabase values
- Create `frontend/.env.local` with `NEXT_PUBLIC_API_URL=http://localhost:3001`

3. Generate Prisma client and run migrations.

```bash
cd backend
npx prisma generate
npx prisma migrate dev
```

4. Start apps in separate terminals.

```bash
cd backend && npm run dev
cd frontend && npm run dev
```

## Docker Development

```bash
docker-compose up -d --build
docker-compose logs -f
```

Typical access:

- Frontend: `http://localhost`
- API: `http://localhost:3000`
- Swagger: `http://localhost:3000/api-docs`

## Testing

From repository root:

```bash
npm run test:core-apis
```

Backend:

```bash
cd backend
npm test
npm run test:coverage
```

Frontend:

```bash
cd frontend
npm test
npm run test:coverage
```

## Common Operations

Format all files:

```bash
npm run format
```

Backend lint/type-check:

```bash
cd backend
npm run lint
```

Reset and reseed backend DB:

```bash
cd backend
npx prisma migrate reset --force
npm run seed
```

Schema sync (team-safe path after recent destructive schema updates):

```bash
cd backend
./scripts/db-sync-for-team.sh local
```

Docker stack sync (API on port 3001):

```bash
cd backend
./scripts/db-sync-for-team.sh docker
cd ..
BASE=http://localhost:3001/api bash ./test-apis.sh
```

## Documentation

- Backend guide: `backend/README.md`
- Frontend guide: `frontend/README.md`
- API docs (runtime): `/api-docs`
# Backend tests
cd backend
npm test                    # Run all tests
npm run test:watch          # Watch mode
npm run test:coverage       # Coverage report

# Frontend tests
cd frontend
npm test                    # Run all tests
npm run test:watch          # Watch mode
npm run test:coverage       # Coverage report
```

**In Docker:**
```bash
docker exec -it easycheck-backend npm test
docker exec -it easycheck-frontend npm test
```

---

## 🔧 Troubleshooting

### Hot Reload ไม่ทำงาน
```bash
docker-compose restart backend
docker-compose restart frontend
```

### Port ชนกัน
```bash
# หา process ที่ใช้ port
lsof -i :3000
lsof -i :80

# Kill process
kill -9 <PID>
```

### Database Connection Error
```bash
# Restart postgres
docker-compose restart postgres

# Check postgres logs
docker-compose logs postgres

# Reset database (⚠️ ลบข้อมูล)
docker-compose down -v
docker-compose up -d
```

### Prisma Generation Error
```bash
docker exec -it easycheck-backend npx prisma generate
docker-compose restart backend
```

---

## 🤝 Contributing

1. Fork the repository
2. Create feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'feat: add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License.

---

## 👥 Team

Made with ❤️ by EasyCheck Team

---

## 📞 Support

มีปัญหาหรือข้อสงสัย?
- 📖 อ่าน [Backend README](backend/README.md) หรือ [Frontend README](frontend/README.md)
- 💬 ถาม ใน Discord server
- 🐛 สร้าง [Issue](https://github.com/EasyChecks/easychecks/issues) บน GitHub
