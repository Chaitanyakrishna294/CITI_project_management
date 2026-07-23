import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiRequest } from '../services/apiClient';

function mockFetchOnce({ ok = true, status = 200, json } = {}) {
  global.fetch.mockResolvedValueOnce({
    ok,
    status,
    json: json === undefined ? vi.fn().mockResolvedValue({}) : (typeof json === 'function' ? json : vi.fn().mockResolvedValue(json)),
  });
}

describe('apiClient / apiRequest', () => {
  beforeEach(() => {
    global.fetch = vi.fn();
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('builds the correct URL from service and path', async () => {
    mockFetchOnce({ json: { ok: true } });
    await apiRequest('projects-service', '/projects/5', { auth: false });
    const [url] = global.fetch.mock.calls[0];
    expect(url).toBe('http://localhost:3001/api/projects-service/projects/5');
  });

  it('always sets Content-Type: application/json', async () => {
    mockFetchOnce({ json: {} });
    await apiRequest('auth-service', '/login', { auth: false });
    const [, options] = global.fetch.mock.calls[0];
    expect(options.headers['Content-Type']).toBe('application/json');
  });

  it('includes Authorization header with token when auth is true and token exists', async () => {
    localStorage.setItem('citi_token', 'abc123');
    mockFetchOnce({ json: {} });
    await apiRequest('users-service', '/users', { auth: true });
    const [, options] = global.fetch.mock.calls[0];
    expect(options.headers.Authorization).toBe('Bearer abc123');
  });

  it('omits Authorization header when auth is false', async () => {
    localStorage.setItem('citi_token', 'abc123');
    mockFetchOnce({ json: {} });
    await apiRequest('auth-service', '/login', { auth: false });
    const [, options] = global.fetch.mock.calls[0];
    expect(options.headers.Authorization).toBeUndefined();
  });

  it('omits Authorization header when auth is true but no token is stored', async () => {
    mockFetchOnce({ json: {} });
    await apiRequest('users-service', '/users', { auth: true });
    const [, options] = global.fetch.mock.calls[0];
    expect(options.headers.Authorization).toBeUndefined();
  });

  it('serializes body as JSON when provided', async () => {
    mockFetchOnce({ json: {} });
    await apiRequest('auth-service', '/login', { method: 'POST', body: { email: 'a@b.com', password: 'x' }, auth: false });
    const [, options] = global.fetch.mock.calls[0];
    expect(options.body).toBe(JSON.stringify({ email: 'a@b.com', password: 'x' }));
  });

  it('omits body (undefined) when not provided', async () => {
    mockFetchOnce({ json: {} });
    await apiRequest('users-service', '/users', { auth: false });
    const [, options] = global.fetch.mock.calls[0];
    expect(options.body).toBeUndefined();
  });

  it('returns the parsed JSON when res.ok is true', async () => {
    mockFetchOnce({ ok: true, json: { user: { id: 1, name: 'Ann' } } });
    const result = await apiRequest('auth-service', '/me', { auth: true });
    expect(result).toEqual({ user: { id: 1, name: 'Ann' } });
  });

  it('throws an Error with data.error as message when res is not ok and error present', async () => {
    mockFetchOnce({ ok: false, status: 401, json: { error: 'Invalid credentials' } });
    await expect(apiRequest('auth-service', '/login', { auth: false })).rejects.toThrow('Invalid credentials');
  });

  it('throws fallback Error message when res is not ok and body has no error field', async () => {
    mockFetchOnce({ ok: false, status: 500, json: {} });
    await expect(apiRequest('auth-service', '/login', { auth: false })).rejects.toThrow(
      'Request failed with status 500'
    );
  });

  it('throws fallback Error message when res is not ok and body fails to parse as JSON', async () => {
    global.fetch.mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: vi.fn().mockRejectedValue(new Error('not json')),
    });
    await expect(apiRequest('auth-service', '/login', { auth: false })).rejects.toThrow(
      'Request failed with status 503'
    );
  });
});
