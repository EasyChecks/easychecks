# Frontend - EasyCheck

Next.js application with React, TypeScript, and TailwindCSS

---

## 📋 Table of Contents

- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Getting Started](#getting-started)
- [Development](#development)
- [Testing](#testing)
- [Components](#components)
- [State Management](#state-management)
- [Styling](#styling)
- [Environment Variables](#environment-variables)

---

## Tech Stack

- **Framework**: Next.js 16.x (App Router)
- **Runtime**: Node.js 22.x
- **Language**: TypeScript
- **UI Library**: React 19.x
- **Styling**: TailwindCSS 4.x
- **Components**: Radix UI
- **Icons**: Lucide React
- **Maps**: Leaflet + React-Leaflet
- **Charts**: Recharts
- **HTTP Client**: Fetch API
- **Testing**: Jest + React Testing Library

---

## Project Structure

```
frontend/
├── src/
│   ├── app/                # Next.js App Router
│   │   ├── (auth)/        # Authentication pages
│   │   ├── dashboard/     # Dashboard pages
│   │   ├── layout.tsx     # Root layout
│   │   └── page.tsx       # Home page
│   │
│   ├── components/        # React components
│   │   ├── ui/           # Reusable UI components
│   │   ├── forms/        # Form components
│   │   ├── layouts/      # Layout components
│   │   └── features/     # Feature-specific components
│   │
│   ├── hooks/            # Custom React hooks
│   ├── services/         # API service layer
│   ├── lib/              # Utility libraries
│   ├── types/            # TypeScript types
│   └── utils/            # Helper functions
│
├── public/               # Static assets
├── Dockerfile            # Development Docker image
├── Dockerfile.prod       # Production Docker image (with Nginx)
└── nginx.conf            # Nginx configuration for production
```

---

## Getting Started

### Prerequisites

- Node.js 22.x
- npm or yarn
- Backend API running

### Installation

```bash
# Install dependencies
npm install

# Setup environment variables
cp .env.example .env.local
# Edit .env.local with your API URL

# Run development server
npm run dev
```

**Access:**
- Development: http://localhost:3000
- Docker Development: http://localhost
- Production: http://localhost (with Nginx)

---

## Development

### Available Scripts

```bash
npm run dev              # Start development server
npm run build            # Build for production
npm start                # Run production build
npm run lint             # Run ESLint
npm test                 # Run tests
npm run test:watch       # Run tests in watch mode
npm run test:coverage    # Generate coverage report
```

### Hot Reload

Next.js provides Fast Refresh for instant feedback:
- Changes to components instantly reflect in browser
- Preserves component state during edits

**In Docker:**
```bash
# Source code is mounted as volume
# Changes automatically reload
docker-compose logs -f frontend
```

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
// src/__tests__/Button.test.tsx
import { render, screen, fireEvent } from '@testing-library/react';
import Button from '@/components/ui/Button';

describe('Button Component', () => {
  it('renders button with text', () => {
    render(<Button>Click me</Button>);
    expect(screen.getByText('Click me')).toBeInTheDocument();
  });

  it('calls onClick when clicked', () => {
    const handleClick = jest.fn();
    render(<Button onClick={handleClick}>Click me</Button>);
    
    fireEvent.click(screen.getByText('Click me'));
    expect(handleClick).toHaveBeenCalledTimes(1);
  });
});
```

---

## Components

### Component Structure

```typescript
import { FC } from 'react';

interface UserCardProps {
  name: string;
  email: string;
  role: string;
}

export const UserCard: FC<UserCardProps> = ({ name, email, role }) => {
  return (
    <div className="p-4 bg-white rounded-lg shadow">
      <h3 className="text-xl font-bold">{name}</h3>
      <p className="text-gray-600">{email}</p>
      <span className="text-sm text-blue-500">{role}</span>
    </div>
  );
};
```

### UI Components

```typescript
// Button
import { Button } from '@/components/ui/button';
<Button variant="primary" size="lg">Click me</Button>

// Card
import { Card } from '@/components/ui/card';
<Card>Content</Card>

// Input
import { Input } from '@/components/ui/input';
<Input type="email" placeholder="Enter email" />
```

---

## State Management

### Custom Hooks

```typescript
// src/hooks/useAuth.ts
export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkAuth().then(setUser).finally(() => setLoading(false));
  }, []);

  const login = async (credentials) => {
    const user = await loginApi(credentials);
    setUser(user);
  };

  const logout = () => setUser(null);

  return { user, loading, login, logout };
}
```

---

## Styling

### TailwindCSS

```tsx
<div className="flex items-center justify-between p-4 bg-white rounded-lg shadow-md">
  <h1 className="text-2xl font-bold text-gray-900">Title</h1>
  <button className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600">
    Click
  </button>
</div>
```

### Responsive Design

```tsx
<div className="w-full sm:w-1/2 md:w-1/3 lg:w-1/4">
  Responsive width
</div>
```

---

## Environment Variables

Create `.env.local` file:

```env
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3000

# Supabase (if using client-side)
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
```

**Note**: Variables starting with `NEXT_PUBLIC_` are exposed to the browser.

---

## Docker

### Development

```bash
# Start with docker-compose (from root)
docker-compose up -d

# View logs
docker-compose logs -f frontend
```

**Features:**
- ✅ Hot reload enabled
- ✅ Port 80 (not 3000)
- ✅ Anonymous volume for node_modules
- ✅ Source code mounted for instant updates

### Production

Production uses **Nginx** for serving static files:

```bash
# Build and run production
docker-compose -f docker-compose.prod.yml up -d frontend
```

---

## API Integration

### Service Layer

```typescript
// src/services/api.ts
const API_URL = process.env.NEXT_PUBLIC_API_URL;

export async function fetchApi(endpoint: string, options = {}) {
  const response = await fetch(`${API_URL}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) throw new Error('API Error');
  return response.json();
}
```

---

## Performance

### Optimization Tips

1. **Image Optimization**: Use `next/image`
2. **Code Splitting**: Next.js handles automatically
3. **Lazy Loading**: Dynamic imports
4. **Memoization**: Use `useMemo` and `useCallback`

---

## Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [React Documentation](https://react.dev/)
- [TailwindCSS Documentation](https://tailwindcss.com/docs)
- [TypeScript Documentation](https://www.typescriptlang.org/docs/)

---

## Support

Need help?
- Check [main README](../README.md)
- Ask in Discord server
- Create an issue on GitHub
