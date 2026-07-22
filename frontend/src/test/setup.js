import '@testing-library/jest-dom/vitest';
import { afterEach, vi } from 'vitest';
import { cleanup } from '@testing-library/react';

/**
 * jsdom does not implement window.matchMedia, which MUI's useMediaQuery needs
 * for the responsive layout (req/UI_UX_Design&UserFlow.md §13). Without it every
 * query resolves false, i.e. the smallest breakpoint. Tests should exercise the
 * desktop layout by default, so resolve `min-width` queries to true and let
 * individual tests override this to assert mobile behaviour.
 */
function matchMediaStub(query) {
  return {
    media: query,
    matches: query.includes('min-width'),
    onchange: null,
    addListener: vi.fn(), // deprecated, still called by some libraries
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };
}

window.matchMedia = vi.fn().mockImplementation(matchMediaStub);

/** Switch the viewport for a single test: setViewport('mobile'). */
export function setViewport(size) {
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    ...matchMediaStub(query),
    matches: size === 'desktop' ? query.includes('min-width') : !query.includes('min-width'),
  }));
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  window.matchMedia = vi.fn().mockImplementation(matchMediaStub);
});
