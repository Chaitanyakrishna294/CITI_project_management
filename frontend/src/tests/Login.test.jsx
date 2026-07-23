import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Routes, Route } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { screen, waitFor } from '../test/test-utils';
import { renderWithAuth } from '../test/test-utils';
import Login from '../pages/Login';

function renderLogin({ login = vi.fn() } = {}) {
  return renderWithAuth(
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/dashboard" element={<div>Dashboard Page</div>} />
    </Routes>,
    { login, route: '/login' }
  );
}

describe('Login page', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('updates email and password fields as controlled inputs', async () => {
    renderLogin();
    const emailInput = screen.getByLabelText(/email/i);
    const passwordInput = screen.getByLabelText(/^password/i);

    await userEvent.type(emailInput, 'user@example.com');
    await userEvent.type(passwordInput, 'mypassword');

    expect(emailInput).toHaveValue('user@example.com');
    expect(passwordInput).toHaveValue('mypassword');
  });

  it('toggles password visibility when the show/hide icon is clicked', async () => {
    renderLogin();
    const passwordInput = screen.getByLabelText(/^password/i);
    expect(passwordInput).toHaveAttribute('type', 'password');

    await userEvent.click(screen.getByRole('button', { name: /show password/i }));
    expect(passwordInput).toHaveAttribute('type', 'text');

    await userEvent.click(screen.getByRole('button', { name: /hide password/i }));
    expect(passwordInput).toHaveAttribute('type', 'password');
  });

  it('submitting with valid credentials calls login and navigates to /dashboard', async () => {
    const login = vi.fn().mockResolvedValue({ id: 1, name: 'Ann', role: 'admin' });
    renderLogin({ login });

    await userEvent.type(screen.getByLabelText(/email/i), 'user@example.com');
    await userEvent.type(screen.getByLabelText(/^password/i), 'mypassword');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    await waitFor(() => expect(login).toHaveBeenCalledWith('user@example.com', 'mypassword'));
    expect(await screen.findByText('Dashboard Page')).toBeInTheDocument();
  });

  it('shows the error message in an Alert and does not navigate when login is rejected', async () => {
    const login = vi.fn().mockRejectedValue(new Error('Invalid credentials'));
    renderLogin({ login });

    await userEvent.type(screen.getByLabelText(/email/i), 'user@example.com');
    await userEvent.type(screen.getByLabelText(/^password/i), 'wrongpass');
    await userEvent.click(screen.getByRole('button', { name: 'Sign in' }));

    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument();
    expect(screen.queryByText('Dashboard Page')).not.toBeInTheDocument();
  });

  it('disables the submit button while login is pending and re-enables on success', async () => {
    let resolveLogin;
    const login = vi.fn().mockImplementation(
      () => new Promise((resolve) => { resolveLogin = resolve; })
    );
    renderLogin({ login });

    await userEvent.type(screen.getByLabelText(/email/i), 'user@example.com');
    await userEvent.type(screen.getByLabelText(/^password/i), 'mypassword');

    const submitButton = screen.getByRole('button', { name: 'Sign in' });
    await userEvent.click(submitButton);

    await waitFor(() => expect(submitButton).toBeDisabled());
    expect(screen.getByRole('button', { name: /signing in/i })).toBeDisabled();

    resolveLogin({ id: 1, name: 'Ann', role: 'admin' });

    await waitFor(() => expect(screen.queryByText('Dashboard Page')).toBeInTheDocument());
  });

  it('disables the submit button while login is pending and re-enables on failure', async () => {
    let rejectLogin;
    const login = vi.fn().mockImplementation(
      () => new Promise((_resolve, reject) => { rejectLogin = reject; })
    );
    renderLogin({ login });

    await userEvent.type(screen.getByLabelText(/email/i), 'user@example.com');
    await userEvent.type(screen.getByLabelText(/^password/i), 'mypassword');

    const submitButton = screen.getByRole('button', { name: 'Sign in' });
    await userEvent.click(submitButton);

    await waitFor(() => expect(submitButton).toBeDisabled());

    rejectLogin(new Error('Invalid credentials'));

    await waitFor(() => expect(submitButton).not.toBeDisabled());
    expect(await screen.findByText('Invalid credentials')).toBeInTheDocument();
  });
});
