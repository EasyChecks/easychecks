import '@testing-library/jest-dom/vitest';
import { vi } from 'vitest';

Object.defineProperty(globalThis, 'fetch', {
  value: vi.fn(),
  writable: true,
});

vi.mock('next/navigation', () => ({
  useRouter() {
    return {
      push: vi.fn(),
      replace: vi.fn(),
      prefetch: vi.fn(),
      back: vi.fn(),
    };
  },
  useSearchParams() {
    return new URLSearchParams();
  },
  usePathname() {
    return '';
  },
}));
