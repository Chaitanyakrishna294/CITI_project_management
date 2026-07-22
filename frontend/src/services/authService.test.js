import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('./apiClient', () => ({
  apiRequest: vi.fn(),
}));

import { apiRequest } from './apiClient';
import { login, logout, fetchCurrentUser } from './authService';

describe('authService', () => {
  beforeEach(() => {
    apiRequest.mockReset();
  });

  it('login calls apiRequest with auth-service, /login, POST, body and auth:false', async () => {
    apiRequest.mockResolvedValue({ token: 't', user: { id: 1 } });
    const result = await login('a@b.com', 'secret');
    expect(apiRequest).toHaveBeenCalledWith('auth-service', '/login', {
      method: 'POST',
      body: { email: 'a@b.com', password: 'secret' },
      auth: false,
    });
    expect(result).toEqual({ token: 't', user: { id: 1 } });
  });

  it('logout calls apiRequest with auth-service, /logout, POST', async () => {
    apiRequest.mockResolvedValue({ ok: true });
    await logout();
    expect(apiRequest).toHaveBeenCalledWith('auth-service', '/logout', { method: 'POST' });
  });

  it('fetchCurrentUser calls apiRequest with auth-service, /me, GET', async () => {
    apiRequest.mockResolvedValue({ user: { id: 1 } });
    await fetchCurrentUser();
    expect(apiRequest).toHaveBeenCalledWith('auth-service', '/me', { method: 'GET' });
  });
});
