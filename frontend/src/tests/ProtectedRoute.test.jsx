import { describe, it, expect } from 'vitest';
import { Routes, Route } from 'react-router-dom';
import { screen } from '@testing-library/react';
import { renderWithAuth } from '../test/test-utils';
import ProtectedRoute from '../components/ProtectedRoute';

function renderTree({ user, loading, allowedRoles, route = '/protected' }) {
  return renderWithAuth(
    <Routes>
      <Route path="/login" element={<div>Login Page</div>} />
      <Route path="/dashboard" element={<div>Dashboard Page</div>} />
      <Route element={<ProtectedRoute allowedRoles={allowedRoles} />}>
        <Route path="/protected" element={<div>Protected Content</div>} />
      </Route>
    </Routes>,
    { user, loading, route }
  );
}

describe('ProtectedRoute', () => {
  it('renders nothing and does not redirect while loading', () => {
    renderTree({ user: null, loading: true });
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
    expect(screen.queryByText('Login Page')).not.toBeInTheDocument();
    expect(screen.queryByText('Dashboard Page')).not.toBeInTheDocument();
  });

  it('redirects to /login when there is no user', () => {
    renderTree({ user: null, loading: false });
    expect(screen.getByText('Login Page')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('redirects to /dashboard when user role is not in allowedRoles', () => {
    renderTree({
      user: { id: 1, name: 'Ann', role: 'viewer' },
      loading: false,
      allowedRoles: ['admin'],
    });
    expect(screen.getByText('Dashboard Page')).toBeInTheDocument();
    expect(screen.queryByText('Protected Content')).not.toBeInTheDocument();
  });

  it('renders the protected content when user has an allowed role', () => {
    renderTree({
      user: { id: 1, name: 'Ann', role: 'admin' },
      loading: false,
      allowedRoles: ['admin'],
    });
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });

  it('renders the protected content when no allowedRoles prop is given at all', () => {
    renderTree({
      user: { id: 1, name: 'Ann', role: 'viewer' },
      loading: false,
    });
    expect(screen.getByText('Protected Content')).toBeInTheDocument();
  });
});
