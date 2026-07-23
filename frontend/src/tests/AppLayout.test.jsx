import { describe, it, expect, vi, afterEach } from 'vitest';
import { Routes, Route, useLocation } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { renderWithAuth, screen, waitFor } from '../test/test-utils';
import { setViewport } from '../test/setup';
import AppLayout from '../components/AppLayout';

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
    expect(screen.getByText('Jamie Doe')).toBeInTheDocument();
    expect(screen.getByText('Team member')).toBeInTheDocument();
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

  // req/UI_UX_Design&UserFlow.md §4 fixes the sidebar contents.
  it('renders every navigation destination from the spec for an admin', () => {
    renderLayout({ user: adminUser });
    ['Dashboard', 'Projects', 'Deliverables', 'Resources', 'Budgets', 'Reports', 'Users'].forEach(
      (label) => {
        expect(screen.getByRole('link', { name: label })).toBeInTheDocument();
      }
    );
  });

  it('links each navigation item to its route', () => {
    renderLayout({ user: adminUser });
    const expected = {
      Dashboard: '/dashboard',
      Projects: '/projects',
      Deliverables: '/deliverables',
      Resources: '/resources',
      Budgets: '/budgets',
      Reports: '/reports',
      Users: '/users',
    };
    Object.entries(expected).forEach(([label, href]) => {
      expect(screen.getByRole('link', { name: label })).toHaveAttribute('href', href);
    });
  });

  it('hides Budgets from roles without financial visibility', () => {
    renderLayout({ user: teamMemberUser });
    expect(screen.queryByRole('link', { name: 'Budgets' })).not.toBeInTheDocument();
    // …but still shows the screens every role can reach.
    expect(screen.getByRole('link', { name: 'Deliverables' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Reports' })).toBeInTheDocument();
  });

  it('shows Budgets to the finance team', () => {
    renderLayout({ user: { id: 3, name: 'Fin Adeyemi', role: 'finance' } });
    expect(screen.getByRole('link', { name: 'Budgets' })).toBeInTheDocument();
  });

  describe('responsive behaviour (req/UI_UX §13)', () => {
    afterEach(() => {
      setViewport('desktop');
    });

    it('shows a permanent sidebar and no hamburger on desktop', () => {
      setViewport('desktop');
      renderLayout({ user: adminUser });

      expect(screen.queryByRole('button', { name: /open navigation menu/i })).not.toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Dashboard' })).toBeInTheDocument();
    });

    it('collapses the sidebar behind a hamburger on mobile', async () => {
      const user = userEvent.setup();
      setViewport('mobile');
      renderLayout({ user: adminUser });

      // The closed drawer stays mounted for performance but is aria-hidden, so
      // it is correctly invisible to assistive technology until opened.
      expect(screen.queryByRole('navigation', { name: /main navigation/i })).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /open navigation menu/i }));

      expect(screen.getByRole('navigation', { name: /main navigation/i })).toBeInTheDocument();
      expect(screen.getByRole('link', { name: 'Projects' })).toBeInTheDocument();
    });

    it('closes the mobile drawer after choosing a destination', async () => {
      const user = userEvent.setup();
      setViewport('mobile');
      // Both routes render the layout, so it survives the navigation.
      renderWithAuth(
        <Routes>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<div>dashboard content</div>} />
            <Route path="/projects" element={<div>projects content</div>} />
          </Route>
        </Routes>,
        { user: adminUser, initialEntries: ['/dashboard'] }
      );

      await user.click(screen.getByRole('button', { name: /open navigation menu/i }));
      await user.click(screen.getByRole('link', { name: 'Projects' }));

      expect(await screen.findByText('projects content')).toBeInTheDocument();
      await waitFor(() =>
        expect(screen.queryByRole('navigation', { name: /main navigation/i })).not.toBeInTheDocument()
      );
    });
  });
});
