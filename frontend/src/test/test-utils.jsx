import { vi } from 'vitest';
import { render } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider, AuthContext } from '../contexts/AuthContext';

/**
 * Renders a component wrapped in MemoryRouter + the REAL AuthProvider,
 * matching the app's actual provider tree (see src/App.jsx). AuthProvider
 * calls authService.fetchCurrentUser() on mount if a token is present in
 * localStorage, so mock '../services/authService' in tests that use this
 * and need to control the authenticated user (or set no token for logged-out).
 */
export function renderWithProviders(ui, { route = '/', initialEntries, ...options } = {}) {
  const entries = initialEntries || [route];
  return render(
    <MemoryRouter initialEntries={entries}>
      <AuthProvider>{ui}</AuthProvider>
    </MemoryRouter>,
    options
  );
}

/**
 * Renders a component wrapped in MemoryRouter + a FAKE AuthContext.Provider
 * with a fixed value -- no network/localStorage bootstrap involved. Use this
 * for page/component tests that just need `useAuth()` to return a known user
 * (or null for logged-out), which is the common case.
 *
 * renderWithAuth(<Projects />, { user: { id: 1, name: 'A', role: 'admin' } })
 */
export function renderWithAuth(
  ui,
  { user = null, loading = false, login = vi.fn(), logout = vi.fn(), route = '/', initialEntries, ...options } = {}
) {
  const entries = initialEntries || [route];
  return render(
    <MemoryRouter initialEntries={entries}>
      <AuthContext.Provider value={{ user, loading, login, logout }}>{ui}</AuthContext.Provider>
    </MemoryRouter>,
    options
  );
}

export * from '@testing-library/react';
