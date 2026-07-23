import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { AuthProvider, useAuth } from '../contexts/AuthContext';

vi.mock('../services/authService');
import * as authService from '../services/authService';

function Consumer() {
  const { user, loading, login, logout } = useAuth();
  return (
    <div>
      <div data-testid="loading">{String(loading)}</div>
      <div data-testid="user-name">{user?.name || ''}</div>
      <button onClick={() => login('a@b.com', 'pw')}>login</button>
      {/* logout() rethrows after its try/finally cleanup when authService.logout() rejects
          (see AuthContext.jsx) -- swallow it here since this test only cares about the
          finally-block cleanup, not the rejection itself. Note: the real caller,
          AppLayout.handleLogout, does NOT catch this rejection -- see test comment below. */}
      <button onClick={() => logout().catch(() => {})}>logout</button>
    </div>
  );
}

describe('AuthContext / AuthProvider + useAuth', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetAllMocks();
  });

  it('with no token in localStorage, loading becomes false, user stays null, fetchCurrentUser never called', async () => {
    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(screen.getByTestId('user-name').textContent).toBe('');
    expect(authService.fetchCurrentUser).not.toHaveBeenCalled();
  });

  it('with token present, fetchCurrentUser is called and on success user is set + loading becomes false', async () => {
    localStorage.setItem('citi_token', 'tok123');
    authService.fetchCurrentUser.mockResolvedValue({ user: { id: 1, name: 'Ann', role: 'admin' } });

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    expect(authService.fetchCurrentUser).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(screen.getByTestId('user-name').textContent).toBe('Ann');
  });

  it('with token present but fetchCurrentUser rejects, token is removed and user stays null', async () => {
    localStorage.setItem('citi_token', 'tok123');
    authService.fetchCurrentUser.mockRejectedValue(new Error('unauthorized'));

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    expect(screen.getByTestId('user-name').textContent).toBe('');
    expect(localStorage.getItem('citi_token')).toBeNull();
  });

  it('login stores returned token in localStorage and sets user', async () => {
    authService.login.mockResolvedValue({ token: 'new-token', user: { id: 2, name: 'Bob', role: 'viewer' } });

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));

    await userEvent.click(screen.getByText('login'));

    await waitFor(() => expect(screen.getByTestId('user-name').textContent).toBe('Bob'));
    expect(localStorage.getItem('citi_token')).toBe('new-token');
  });

  // NOTE: AuthContext.logout() awaits authService.logout() in a try/finally, so the
  // cleanup (localStorage removal + setUser(null)) runs even on rejection, but the
  // finally block does not swallow the error -- it rethrows after cleanup. In the real
  // app, AppLayout.handleLogout() does `await logout(); navigate('/login', ...)` with no
  // try/catch, so a rejected authService.logout() call (e.g. a network error) would
  // produce an unhandled promise rejection there and skip the navigate() call, even
  // though the user is already locally logged out. This looks like a real bug in
  // AppLayout.jsx, not fixed here per instructions.
  it('logout clears token and user even when authService.logout() rejects', async () => {
    authService.login.mockResolvedValue({ token: 'new-token', user: { id: 2, name: 'Bob', role: 'viewer' } });
    authService.logout.mockRejectedValue(new Error('network error'));

    render(
      <AuthProvider>
        <Consumer />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByTestId('loading').textContent).toBe('false'));
    await userEvent.click(screen.getByText('login'));
    await waitFor(() => expect(screen.getByTestId('user-name').textContent).toBe('Bob'));

    await userEvent.click(screen.getByText('logout'));

    await waitFor(() => expect(screen.getByTestId('user-name').textContent).toBe(''));
    expect(localStorage.getItem('citi_token')).toBeNull();
  });

  it('useAuth throws when called outside an AuthProvider', () => {
    // Suppress the React error-boundary console.error noise for this expected throw.
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => render(<Consumer />)).toThrow('useAuth must be used within an AuthProvider');
    consoleSpy.mockRestore();
  });
});
