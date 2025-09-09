import { expect, afterEach, beforeAll, afterAll, vi } from 'vitest';
import { cleanup } from '@testing-library/react';
import * as matchers from '@testing-library/jest-dom/matchers';
import { server } from '@/test/mocks/server';
// Silence framer-motion scrollTo in JSDOM
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(window as any).scrollTo = vi.fn();

// extends Vitest's expect method with methods from react-testing-library
expect.extend(matchers);

// Start MSW
beforeAll(() => server.listen({ onUnhandledRequest: 'warn' }));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(), // deprecated
    removeListener: vi.fn(), // deprecated
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));


// runs a cleanup after each test case (e.g. clearing jsdom)
afterEach(() => {
  cleanup();
  server.resetHandlers();
});

// Close MSW once all tests are done
afterAll(() => server.close());
