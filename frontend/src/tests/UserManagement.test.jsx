import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen, waitFor, within } from '../test/test-utils';
import UserManagement from '../pages/UserManagement';
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

/** The page header and the empty state both offer "Add user" — open via the header. */
async function openCreateDialog(user) {
  await user.click(screen.getAllByRole('button', { name: 'Add user' })[0]);
  return screen.findByRole('dialog', { name: 'Add a user' });
}

beforeEach(() => {
  vi.clearAllMocks();
  usersService.listUsers.mockResolvedValue({ users: [] });
});

describe('UserManagement page', () => {
  it('shows the empty state when the list is empty', async () => {
    mockList([]);
    renderPage();
    expect(await screen.findByText('No users yet')).toBeInTheDocument();
  });

  it('renders a row per user with name/email/role label/status', async () => {
    mockList([activeUser, inactiveUser]);
    renderPage();

    await screen.findByText('Ada Admin');
    const row1 = screen.getByText('Ada Admin').closest('tr');
    expect(within(row1).getByText('ada@example.com')).toBeInTheDocument();
    expect(within(row1).getByText('Admin')).toBeInTheDocument();
    expect(within(row1).getByText('Active')).toBeInTheDocument();

    const row2 = screen.getByText('Ivy Inactive').closest('tr');
    expect(within(row2).getByText('ivy@example.com')).toBeInTheDocument();
    expect(within(row2).getByText('Viewer')).toBeInTheDocument();
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

  describe('Add user dialog', () => {
    it('creates via createUser with name/email/password/role and closes+reloads on success', async () => {
      const user = userEvent.setup();
      mockList([]);
      usersService.createUser.mockResolvedValue({ user: { id: 10 } });
      renderPage();
      await screen.findByText('No users yet');

      const dialog = await openCreateDialog(user);

      await user.type(within(dialog).getByLabelText('Full name *'), 'New Person');
      await user.type(within(dialog).getByLabelText('Email *'), 'new@example.com');
      await user.type(within(dialog).getByLabelText('Password *'), 'sekret123');
      await user.click(within(dialog).getByRole('radio', { name: /^Project manager/ }));

      usersService.listUsers.mockClear();
      await user.click(within(dialog).getByRole('button', { name: 'Add user' }));

      await waitFor(() => {
        expect(usersService.createUser).toHaveBeenCalledWith({
          name: 'New Person',
          email: 'new@example.com',
          password: 'sekret123',
          role: 'project_manager',
        });
      });

      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: 'Add a user' })).not.toBeInTheDocument();
      });
      expect(usersService.listUsers).toHaveBeenCalled();
      // §11: success confirmation on completion.
      expect(await screen.findByText('New Person added')).toBeInTheDocument();
    });

    it('defaults the role to the least-privileged option, Viewer', async () => {
      const user = userEvent.setup();
      mockList([]);
      renderPage();
      await screen.findByText('No users yet');

      const dialog = await openCreateDialog(user);
      expect(within(dialog).getByRole('radio', { name: /^Viewer/ })).toBeChecked();
    });

    it('shows an error and stays open when createUser rejects', async () => {
      const user = userEvent.setup();
      mockList([]);
      usersService.createUser.mockRejectedValue(new Error('Email already in use'));
      renderPage();
      await screen.findByText('No users yet');

      const dialog = await openCreateDialog(user);

      await user.type(within(dialog).getByLabelText('Full name *'), 'Dup Person');
      await user.type(within(dialog).getByLabelText('Email *'), 'dup@example.com');
      await user.type(within(dialog).getByLabelText('Password *'), 'sekret123');

      await user.click(within(dialog).getByRole('button', { name: 'Add user' }));

      expect(await screen.findByText('Email already in use')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Add a user' })).toBeInTheDocument();
    });
  });

  describe('Edit user dialog', () => {
    it('pre-fills name/role/is_active, the Switch toggles, and Save calls updateUser with edited values', async () => {
      const user = userEvent.setup();
      mockList([activeUser]);
      usersService.updateUser.mockResolvedValue({ user: { ...activeUser } });
      renderPage();
      await screen.findByText('Ada Admin');

      const row = screen.getByText('Ada Admin').closest('tr');
      await user.click(within(row).getByRole('button', { name: 'Edit' }));
      const dialog = await screen.findByRole('dialog', { name: 'Edit user' });

      const nameField = within(dialog).getByLabelText('Full name');
      expect(nameField).toHaveValue('Ada Admin');
      expect(within(dialog).getByRole('radio', { name: /^Admin/ })).toBeChecked();
      const activeSwitch = within(dialog).getByRole('checkbox', { name: 'Active' });
      expect(activeSwitch).toBeChecked();

      await user.clear(nameField);
      await user.type(nameField, 'Ada Updated');

      await user.click(within(dialog).getByRole('radio', { name: /^Finance/ }));

      await user.click(activeSwitch);
      expect(activeSwitch).not.toBeChecked();

      usersService.listUsers.mockClear();
      await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));

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
    it('confirmed deactivate calls deactivateUser via the ConfirmDialog and reloads', async () => {
      const user = userEvent.setup();
      mockList([activeUser]);
      usersService.deactivateUser.mockResolvedValue({});
      renderPage();
      await screen.findByText('Ada Admin');

      usersService.listUsers.mockClear();
      await user.click(screen.getByRole('button', { name: 'Deactivate' }));

      const dialog = await screen.findByRole('dialog', { name: 'Deactivate Ada Admin?' });
      await user.click(within(dialog).getByRole('button', { name: 'Deactivate' }));

      await waitFor(() => {
        expect(usersService.deactivateUser).toHaveBeenCalledWith(activeUser.id);
      });
      expect(usersService.listUsers).toHaveBeenCalled();
    });

    it('cancelling the ConfirmDialog does NOT call deactivateUser', async () => {
      const user = userEvent.setup();
      mockList([activeUser]);
      renderPage();
      await screen.findByText('Ada Admin');

      await user.click(screen.getByRole('button', { name: 'Deactivate' }));
      const dialog = await screen.findByRole('dialog', { name: 'Deactivate Ada Admin?' });
      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

      await waitFor(() => {
        expect(screen.queryByRole('dialog', { name: 'Deactivate Ada Admin?' })).not.toBeInTheDocument();
      });
      expect(usersService.deactivateUser).not.toHaveBeenCalled();
    });
  });
});
