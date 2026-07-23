import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import App from '../App';

vi.mock('../services/authService');
vi.mock('../services/projectsService', () => ({
  listProjects: vi.fn().mockResolvedValue({ projects: [] }),
}));
vi.mock('../services/budgetsService', () => ({
  listBudgets: vi.fn().mockResolvedValue({ budgets: [] }),
}));
vi.mock('../services/resourcesService', () => ({
  listResources: vi.fn().mockResolvedValue({ resources: [] }),
}));
vi.mock('../services/deliverablesService', () => ({
  listDeliverables: vi.fn().mockResolvedValue({ deliverables: [] }),
}));
vi.mock('../services/usersService', () => ({
  listUsers: vi.fn().mockResolvedValue({ users: [] }),
}));

import * as authService from '../services/authService';

function setUrl(path) {
  window.history.pushState({}, '', path);
}

describe('App routing', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('redirects an unauthenticated visit to /projects to /login', async () => {
    setUrl('/projects');
    render(<App />);

    await waitFor(() => expect(window.location.pathname).toBe('/login'));
  });

  it('redirects an authenticated non-admin visit to /users to /dashboard', async () => {
    localStorage.setItem('citi_token', 'tok');
    authService.fetchCurrentUser.mockResolvedValue({ user: { id: 1, name: 'Ann', role: 'viewer' } });
    setUrl('/users');

    render(<App />);

    await waitFor(() => expect(window.location.pathname).toBe('/dashboard'));
  });

  it('keeps an authenticated admin visit to /users on /users', async () => {
    localStorage.setItem('citi_token', 'tok');
    authService.fetchCurrentUser.mockResolvedValue({ user: { id: 1, name: 'Ann', role: 'admin' } });
    setUrl('/users');

    render(<App />);

    await waitFor(() => expect(window.location.pathname).toBe('/users'));
  });

  it('redirects / to /dashboard', async () => {
    localStorage.setItem('citi_token', 'tok');
    authService.fetchCurrentUser.mockResolvedValue({ user: { id: 1, name: 'Ann', role: 'admin' } });
    setUrl('/');

    render(<App />);

    await waitFor(() => expect(window.location.pathname).toBe('/dashboard'));
  });

  it('redirects an unknown path to /dashboard', async () => {
    localStorage.setItem('citi_token', 'tok');
    authService.fetchCurrentUser.mockResolvedValue({ user: { id: 1, name: 'Ann', role: 'admin' } });
    setUrl('/some/unknown/path');

    render(<App />);

    await waitFor(() => expect(window.location.pathname).toBe('/dashboard'));
  });
});
