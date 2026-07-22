import { describe, it, expect, vi } from 'vitest';
import { Routes, Route, useLocation } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { renderWithAuth, screen } from '../test/test-utils';
import AppLayout from './AppLayout';

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-probe">{location.pathname}{location.search}</div>;
}

function renderLayout({ user, logout, initialEntries = ['/dashboard'] } = {}) {
  return renderWithAuth(
    <Routes>
      <Route path="/dashboard" element={<AppLayout />}>
        <Route index element={<div>child content</div>} />
      </Route>
      <Route path="*" element={<LocationProbe />} />
    </Routes>,
    { user, logout, initialEntries }
  );
}

const teamMemberUser = { id: 1, name: 'Jamie Doe', role: 'team_member' };
const adminUser = { id: 2, name: 'Ada Admin', role: 'admin' };

describe('AppLayout', () => {
  it('renders the outlet child content', () => {
    renderLayout({ user: teamMemberUser });
    expect(screen.getByText('child content')).toBeInTheDocument();
  });

  it('navigates to /search?q=<term> when a search term is submitted', async () => {
    const user = userEvent.setup();
    renderLayout({ user: teamMemberUser });

    const input = screen.getByPlaceholderText(/search projects, deliverables, resources/i);
    await user.type(input, 'roadmap');
    await user.keyboard('{Enter}');

    const probe = await screen.findByTestId('location-probe');
    expect(probe).toHaveTextContent('/search?q=roadmap');
  });

  it('does not navigate when the search term is empty or whitespace-only', async () => {
    const user = userEvent.setup();
    renderLayout({ user: teamMemberUser });

    const input = screen.getByPlaceholderText(/search projects, deliverables, resources/i);
    await user.type(input, '   ');
    await user.keyboard('{Enter}');

    // still on the dashboard route, outlet content intact
    expect(screen.getByText('child content')).toBeInTheDocument();
    expect(screen.queryByTestId('location-probe')).not.toBeInTheDocument();
  });

  it('calls logout and navigates to /login when the Logout button is clicked', async () => {
    const user = userEvent.setup();
    const logout = vi.fn().mockResolvedValue();
    renderLayout({ user: teamMemberUser, logout });

    await user.click(screen.getByRole('button', { name: /logout/i }));

    expect(logout).toHaveBeenCalledTimes(1);
    const probe = await screen.findByTestId('location-probe');
    expect(probe).toHaveTextContent('/login');
  });

  it('shows the user name and role when a user is present', () => {
    renderLayout({ user: teamMemberUser });
    expect(screen.getByText('Jamie Doe · team_member')).toBeInTheDocument();
  });

  it('does not show user name/role or logout button when no user is present', () => {
    renderLayout({ user: null });
    expect(screen.queryByRole('button', { name: /logout/i })).not.toBeInTheDocument();
  });

  it('hides the Users nav item for a non-admin user', () => {
    renderLayout({ user: teamMemberUser });
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
    expect(screen.getByText('Projects')).toBeInTheDocument();
    expect(screen.getByText('Resources')).toBeInTheDocument();
    expect(screen.queryByText('Users')).not.toBeInTheDocument();
  });

  it('shows the Users nav item for an admin user', () => {
    renderLayout({ user: adminUser });
    expect(screen.getByText('Users')).toBeInTheDocument();
  });
});
