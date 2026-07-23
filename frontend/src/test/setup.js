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
    // Tests run desktop-viewport and reduced-motion: assertions target final
    // state, so entrance animations resolve instantly under test.
    matches: query.includes('min-width') || query.includes('prefers-reduced-motion'),
    onchange: null,
    addListener: vi.fn(), // deprecated, still called by some libraries
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  };
}

// Plain functions, NOT vi.fn(): several suites call vi.resetAllMocks() in
// beforeEach, which would strip a mock's implementation and make matchMedia
// return undefined — crashing any component that reads .matches during render.
window.matchMedia = matchMediaStub;

/** Switch the viewport for a single test: setViewport('mobile'). */
export function setViewport(size) {
  window.matchMedia = (query) => ({
    ...matchMediaStub(query),
    matches: query.includes('prefers-reduced-motion')
      ? true
      : size === 'desktop'
        ? query.includes('min-width')
        : !query.includes('min-width'),
  });
}

afterEach(() => {
  cleanup();
  localStorage.clear();
  window.matchMedia = matchMediaStub;
});
