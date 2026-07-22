import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen, waitFor, within } from '../test/test-utils';
import UserManagement from './UserManagement';
import * as usersService from '../services/usersService';

vi.mock('../services/usersService');

const activeUser = {
  id: 1,
  name: 'Ada Admin',
  email: 'ada@example.com',
  role: 'admin',
  is_active: true,
};
const inactiveUser = {
  id: 2,
  name: 'Ivy Inactive',
  email: 'ivy@example.com',
  role: 'viewer',
  is_active: false,
};

function mockList(users) {
  usersService.listUsers.mockResolvedValue({ users });
}

function renderPage() {
  return renderWithProviders(<UserManagement />);
}

beforeEach(() => {
  vi.clearAllMocks();
  usersService.listUsers.mockResolvedValue({ users: [] });
});

describe('UserManagement page', () => {
  it('shows "No users yet." when the list is empty', async () => {
    mockList([]);
    renderPage();
    expect(await screen.findByText('No users yet.')).toBeInTheDocument();
  });

  it('renders a row per user with name/email/role/status', async () => {
    mockList([activeUser, inactiveUser]);
    renderPage();

    await screen.findByText('Ada Admin');
    const row1 = screen.getByText('Ada Admin').closest('tr');
    expect(within(row1).getByText('ada@example.com')).toBeInTheDocument();
    expect(within(row1).getByText('admin')).toBeInTheDocument();
    expect(within(row1).getByText('Active')).toBeInTheDocument();

    const row2 = screen.getByText('Ivy Inactive').closest('tr');
    expect(within(row2).getByText('ivy@example.com')).toBeInTheDocument();
    expect(within(row2).getByText('viewer')).toBeInTheDocument();
    expect(within(row2).getByText('Inactive')).toBeInTheDocument();
  });

  it('hides "Deactivate" for already-inactive users, shows it for active ones', async () => {
    mockList([activeUser, inactiveUser]);
    renderPage();
    await screen.findByText('Ada Admin');

    const row1 = screen.getByText('Ada Admin').closest('tr');
    expect(within(row1).getByRole('button', { name: 'Deactivate' })).toBeInTheDocument();

    const row2 = screen.getByText('Ivy Inactive').closest('tr');
    expect(within(row2).queryByRole('button', { name: 'Deactivate' })).not.toBeInTheDocument();
  });

  describe('Add User dialog', () => {
    it('creates via createUser with name/email/password/role and closes+reloads on success', async () => {
      const user = userEvent.setup();
      mockList([]);
      usersService.createUser.mockResolvedValue({ user: { id: 10 } });
      renderPage();
      await screen.findByText('No users yet.');

      await user.click(screen.getByRole('button', { name: 'Add User' }));
      await screen.findByRole('heading', { name: 'Add User' });

      await user.type(screen.getByLabelText('Name *'), 'New Person');
      await user.type(screen.getByLabelText('Email *'), 'new@example.com');
      await user.type(screen.getByLabelText('Password *'), 'sekret123');

      const roleField = screen.getByLabelText('Role');
      await user.click(roleField);
      await user.click(await screen.findByRole('option', { name: 'project_manager' }));

      usersService.listUsers.mockClear();
      await user.click(screen.getByRole('button', { name: 'Create' }));

      await waitFor(() => {
        expect(usersService.createUser).toHaveBeenCalledWith({
          name: 'New Person',
          email: 'new@example.com',
          password: 'sekret123',
          role: 'project_manager',
        });
      });

      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: 'Add User' })).not.toBeInTheDocument();
      });
      expect(usersService.listUsers).toHaveBeenCalled();
    });

    it('shows an error and stays open when createUser rejects', async () => {
      const user = userEvent.setup();
      mockList([]);
      usersService.createUser.mockRejectedValue(new Error('Email already in use'));
      renderPage();
      await screen.findByText('No users yet.');

      await user.click(screen.getByRole('button', { name: 'Add User' }));
      await screen.findByRole('heading', { name: 'Add User' });

      await user.type(screen.getByLabelText('Name *'), 'Dup Person');
      await user.type(screen.getByLabelText('Email *'), 'dup@example.com');
      await user.type(screen.getByLabelText('Password *'), 'sekret123');

      await user.click(screen.getByRole('button', { name: 'Create' }));

      expect(await screen.findByText('Email already in use')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Add User' })).toBeInTheDocument();
    });
  });

  describe('Edit User dialog', () => {
    it('pre-fills name/role/is_active, the Switch toggles, and Save calls updateUser with edited values', async () => {
      const user = userEvent.setup();
      mockList([activeUser]);
      usersService.updateUser.mockResolvedValue({ user: { ...activeUser } });
      renderPage();
      await screen.findByText('Ada Admin');

      const row = screen.getByText('Ada Admin').closest('tr');
      await user.click(within(row).getByRole('button', { name: 'Edit' }));
      await screen.findByRole('heading', { name: 'Edit User' });

      const nameField = screen.getByLabelText('Name');
      expect(nameField).toHaveValue('Ada Admin');
      const roleField = screen.getByLabelText('Role');
      expect(roleField).toHaveTextContent('admin');
      const activeSwitch = screen.getByRole('checkbox', { name: 'Active' });
      expect(activeSwitch).toBeChecked();

      await user.clear(nameField);
      await user.type(nameField, 'Ada Updated');

      await user.click(roleField);
      await user.click(await screen.findByRole('option', { name: 'finance' }));

      await user.click(activeSwitch);
      expect(activeSwitch).not.toBeChecked();

      usersService.listUsers.mockClear();
      await user.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(usersService.updateUser).toHaveBeenCalledWith(activeUser.id, {
          name: 'Ada Updated',
          role: 'finance',
          is_active: false,
        });
      });
      expect(usersService.listUsers).toHaveBeenCalled();
    });
  });

  describe('Deactivate action', () => {
    it('confirmed deactivate calls window.confirm then deactivateUser and reloads', async () => {
      const user = userEvent.setup();
      mockList([activeUser]);
      usersService.deactivateUser.mockResolvedValue({});
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      renderPage();
      await screen.findByText('Ada Admin');

      usersService.listUsers.mockClear();
      await user.click(screen.getByRole('button', { name: 'Deactivate' }));

      expect(confirmSpy).toHaveBeenCalled();
      await waitFor(() => {
        expect(usersService.deactivateUser).toHaveBeenCalledWith(activeUser.id);
      });
      expect(usersService.listUsers).toHaveBeenCalled();
    });

    it('cancelled confirm does NOT call deactivateUser', async () => {
      const user = userEvent.setup();
      mockList([activeUser]);
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
      renderPage();
      await screen.findByText('Ada Admin');

      await user.click(screen.getByRole('button', { name: 'Deactivate' }));

      expect(confirmSpy).toHaveBeenCalled();
      expect(usersService.deactivateUser).not.toHaveBeenCalled();
    });
  });
});
