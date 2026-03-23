# EasyCheck Frontend

Next.js App Router frontend for EasyCheck admin and employee workflows.

## Stack

- Next.js 16
- React 19
- TypeScript
- Tailwind CSS 4
- Radix UI + Lucide
- Vitest + Testing Library

## Setup

1. Install dependencies.

```bash
npm install
```

2. Create `.env.local`.

```env
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon-key>
```

3. Run dev server.

```bash
npm run dev
```

App URL: `http://localhost:3000`

## Scripts

```bash
npm run dev              # next dev
npm run build            # next build
npm start                # next start
npm run lint             # eslint
npm test                 # vitest run --passWithNoTests
npm run test:watch       # vitest watch
npm run test:coverage    # vitest coverage
```

## Structure

- `src/app`: route pages (admin, superadmin, user flows)
- `src/components`: reusable UI and feature components
- `src/services`: API clients and request adapters
- `src/hooks`: custom hooks
- `src/types`: shared types
- `src/utils`: helpers and transforms

## API Contract Expectations

- Auth token is required for protected pages.
- Attendance check-in now requires selected `shiftId` and real GPS.
- Service layer normalizes response shape before UI usage.

## Docker Notes

When running with root `docker-compose.yml`, frontend is served behind Nginx and hot reload is available via mounted source.

```bash
docker-compose up -d frontend
docker-compose logs -f frontend
```

## Testing Notes

- Vitest config: `vitest.config.ts`
- Setup file: `vitest.setup.ts`
- Path alias `@` resolves to `src`

Use this when changing API response shapes:

```bash
npm test
npm run lint
```

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
