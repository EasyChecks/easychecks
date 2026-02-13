# 🚀 EasyCheck

ระบบจัดการเวลาทำงานและการเข้างานที่ทันสมัย พัฒนาด้วย Next.js, Express.js และ Supabase

[![CI Pipeline](https://github.com/EasyChecks/easychecks/workflows/CI%20Pipeline/badge.svg)](https://github.com/EasyChecks/easychecks/actions)
[![Node Version](https://img.shields.io/badge/node-22.x-green.svg)](https://nodejs.org)
[![Docker](https://img.shields.io/badge/docker-ready-blue.svg)](https://www.docker.com/)

---

## 📋 Table of Contents

- [Tech Stack](#-tech-stack)
- [Quick Start](#-quick-start)
  - [Development (Local)](#development-local)
  - [Development (Docker)](#development-docker-recommended)
- [Team Rules](#-team-rules)
- [Project Structure](#-project-structure)
- [Documentation](#-documentation)

---

## 🛠 Tech Stack

| Layer | Technology |
|-------|-----------|
| **Frontend** | Next.js, React, TailwindCSS |
| **Backend** | Express.js, TypeScript |
| **Database** | PostgreSQL (Supabase) |
| **ORM** | Prisma |
| **Tooling** | Docker, Prettier, NVM |

---

## 🚀 Quick Start

### Development (Local)

#### Prerequisites
- **Node.js 22.x** (via NVM)
- **PostgreSQL** (or Supabase account)

#### Steps

```bash
# 1. Clone repository
git clone https://github.com/EasyChecks/easychecks.git
cd easychecks

# 2. Set Node version (Required!)
nvm use
# If Node 22 not installed: nvm install 22

# 3. Install dependencies (all 3 locations)
npm install                    # Root (Prettier)
cd backend && npm install      # Backend
cd ../frontend && npm install  # Frontend

# 4. Setup environment variables
# Backend: Create backend/.env
# - Add DATABASE_URL from Supabase (check Discord)

# Frontend: Create frontend/.env.local  
# - Add NEXT_PUBLIC_API_URL (check Discord)

# 5. Generate Prisma client
cd backend
npx prisma generate

# 6. Run development servers (2 terminals)
cd backend && npm run dev      # Port 3001
cd frontend && npm run dev     # Port 3000
```

**Access:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001
- API Docs: http://localhost:3001/api-docs

---

### Development (Docker) 🐳 *Recommended*

ใช้ Docker สำหรับ development environment ที่สมบูรณ์ พร้อม hot reload!

#### Prerequisites
- [Docker](https://docs.docker.com/get-docker/) 20.10+
- [Docker Compose](https://docs.docker.com/compose/install/) 2.0+

#### Quick Start

```bash
# 1. Clone repository
git clone https://github.com/EasyChecks/easychecks.git
cd easychecks

# 2. Create environment file
cp .env.example .env
# Edit .env with your values (DATABASE_URL, SUPABASE_URL, etc.)

# 3. Start all services
docker-compose up -d

# 4. View logs
docker-compose logs -f

# 5. Stop services
docker-compose down
```

**Access:**
- Frontend: http://localhost
- Backend API: http://localhost:3000
- Backend Health: http://localhost:3000/api/health
- Swagger Docs: http://localhost:3000/api-docs

#### 🔥 Hot Reload Features

แก้ไขโค้ดใน VS Code แล้วเห็นผลทันที ไม่ต้อง restart container!

- **Backend**: แก้ไข `backend/**/*.ts` → auto reload
- **Frontend**: แก้ไข `frontend/src/**/*` → auto reload  
- **Prisma**: แก้ไข `backend/prisma/schema.prisma` → re-generate client

#### Docker Commands

```bash
# View running containers
docker-compose ps

# View logs (all services)
docker-compose logs -f

# View logs (specific service)
docker-compose logs -f backend
docker-compose logs -f frontend

# Restart specific service
docker-compose restart backend
docker-compose restart frontend

# Enter container shell
docker exec -it easycheck-backend sh
docker exec -it easycheck-frontend sh

# Run Prisma commands
docker exec -it easycheck-backend npx prisma generate
docker exec -it easycheck-backend npx prisma migrate dev
docker exec -it easycheck-backend npm run seed

# Run tests
docker exec -it easycheck-backend npm test
docker exec -it easycheck-frontend npm test

# Rebuild images
docker-compose up -d --build

# Clean up everything
docker-compose down -v  # ⚠️ This deletes database data!
```

---

## 🚩 Team Rules

**ห้ามข้าม! สำคัญมาก**

### 1. Case Sensitivity 🔤
- **ห้าม** ตั้งชื่อไฟล์หรือโฟลเดอร์ด้วยตัวพิมพ์ใหญ่
- ใช้ `camelCase` สำหรับตัวแปรและฟังก์ชัน
- ใช้ `kebab-case` สำหรับชื่อไฟล์และโฟลเดอร์

**✅ Good:**
```
userController.ts
auth-middleware.ts
getUserData()
```

**❌ Bad:**
```
UserController.ts
AuthMiddleware.ts
GetUserData()
```

### 2. Format on Save ✨
- **ติดตั้ง**: Prettier extension ใน VS Code
- **เปิดใช้**: Format on Save ใน VS Code settings
- **รัน Format**: ก่อน commit ทุกครั้ง

```bash
# Format all files before commit
npm run format
```

### 3. Commit History 📝
- ใช้ commit messages ที่มีความหมาย
- รัน `npm run format` ก่อน push เสมอ

**Format:**
```bash
feat: add user authentication
fix: resolve login redirect issue
docs: update API documentation
style: format code with prettier
test: add unit tests for auth service
```

### 4. Code Review 👀
- สร้าง Pull Request สำหรับการเปลี่ยนแปลงทุกครั้ง
- รอ approval ก่อน merge
- Test ใน local และ Docker ก่อน push

---

## 📁 Project Structure

```
easycheck/
├── backend/                 # Express.js API
│   ├── src/
│   │   ├── controllers/    # Request handlers
│   │   ├── routes/         # API routes
│   │   ├── services/       # Business logic
│   │   ├── middleware/     # Custom middleware
│   │   └── utils/          # Helper functions
│   ├── prisma/             # Database schema & migrations
│   └── README.md           # Backend documentation
│
├── frontend/               # Next.js App
│   ├── src/
│   │   ├── app/           # App router pages
│   │   ├── components/    # React components
│   │   ├── hooks/         # Custom hooks
│   │   ├── services/      # API calls
│   │   └── utils/         # Helper functions
│   └── README.md          # Frontend documentation
│
├── .github/
│   └── workflows/         # CI pipeline
├── docker-compose.yml     # Development environment
└── README.md             # This file
```

---

## 📚 Documentation

| Document | Description |
|----------|-------------|
| [Backend README](backend/README.md) | Backend API, database, testing |
| [Frontend README](frontend/README.md) | Frontend architecture, components |
| [.github/workflows/ci-cd.yml](.github/workflows/ci-cd.yml) | CI pipeline details |

---

## 🧪 Testing

```bash
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
