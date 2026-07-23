import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithAuth, screen, within } from '../test/test-utils';
import DeliverablesPanel from '../components/DeliverablesPanel';

vi.mock('../services/deliverablesService');
vi.mock('../services/usersService');

import * as deliverablesService from '../services/deliverablesService';
import * as usersService from '../services/usersService';

const project = { id: 1, manager_id: 5, name: 'X' };

function renderPanel({ user, canManage }) {
  return renderWithAuth(<DeliverablesPanel project={project} canManage={canManage} />, { user });
}

describe('DeliverablesPanel', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    usersService.listUsers.mockResolvedValue({ users: [] });
  });

  it('shows "No deliverables yet." when empty', async () => {
    deliverablesService.listDeliverables.mockResolvedValue({ deliverables: [] });
    renderPanel({ user: { id: 1, role: 'team_member' }, canManage: false });

    expect(await screen.findByText('No deliverables yet.')).toBeInTheDocument();
  });

  it('shows "Add Deliverable" only when canManage', async () => {
    deliverablesService.listDeliverables.mockResolvedValue({ deliverables: [] });
    renderPanel({ user: { id: 1, role: 'project_manager' }, canManage: true });

    await screen.findByText('No deliverables yet.');
    expect(screen.getByRole('button', { name: 'Add Deliverable' })).toBeInTheDocument();
  });

  it('does not show "Add Deliverable" when canManage is false', async () => {
    deliverablesService.listDeliverables.mockResolvedValue({ deliverables: [] });
    renderPanel({ user: { id: 1, role: 'team_member' }, canManage: false });

    await screen.findByText('No deliverables yet.');
    expect(screen.queryByRole('button', { name: 'Add Deliverable' })).not.toBeInTheDocument();
  });

  it('mixed table: only the owned row gets the editable select when canManage=false', async () => {
    deliverablesService.listDeliverables.mockResolvedValue({
      deliverables: [
        { id: 1, title: 'Owned by me', status: 'in_progress', owner_id: 42, owner_name: 'Me' },
        { id: 2, title: 'Owned by other', status: 'not_started', owner_id: 77, owner_name: 'Other' },
      ],
    });
    renderPanel({ user: { id: 42, role: 'team_member' }, canManage: false });

    const ownedRow = (await screen.findByText('Owned by me')).closest('tr');
    const otherRow = screen.getByText('Owned by other').closest('tr');

    // owned row: editable select present
    expect(within(ownedRow).getByRole('combobox')).toBeInTheDocument();
    // other row: read-only Chip, no combobox
    expect(within(otherRow).queryByRole('combobox')).not.toBeInTheDocument();
    expect(within(otherRow).getByText('not_started')).toBeInTheDocument();
  });

  it('changing the status select calls updateDeliverable with the new status', async () => {
    const user = userEvent.setup();
    deliverablesService.listDeliverables.mockResolvedValue({
      deliverables: [{ id: 1, title: 'Task A', status: 'not_started', owner_id: 42, owner_name: 'Me' }],
    });
    deliverablesService.updateDeliverable.mockResolvedValue({});

    renderPanel({ user: { id: 42, role: 'team_member' }, canManage: false });

    await screen.findByText('Task A');
    const select = screen.getByRole('combobox');
    await user.click(select);
    const option = await screen.findByRole('option', { name: 'in_progress' });
    await user.click(option);

    expect(deliverablesService.updateDeliverable).toHaveBeenCalledWith(1, { status: 'in_progress' });
  });

  it('Edit/Delete buttons appear only when canManage, even for the owner-of-that-row case', async () => {
    deliverablesService.listDeliverables.mockResolvedValue({
      deliverables: [{ id: 1, title: 'Owned by me', status: 'in_progress', owner_id: 42, owner_name: 'Me' }],
    });
    renderPanel({ user: { id: 42, role: 'team_member' }, canManage: false });

    const row = (await screen.findByText('Owned by me')).closest('tr');
    expect(within(row).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(within(row).queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });

  it('Edit/Delete buttons appear when canManage is true', async () => {
    deliverablesService.listDeliverables.mockResolvedValue({
      deliverables: [{ id: 1, title: 'Task A', status: 'in_progress', owner_id: 99, owner_name: 'Other' }],
    });
    renderPanel({ user: { id: 5, role: 'project_manager' }, canManage: true });

    const row = (await screen.findByText('Task A')).closest('tr');
    expect(within(row).getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    expect(within(row).getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  });

  describe('delete confirmation', () => {
    let confirmSpy;
    beforeEach(() => {
      confirmSpy = vi.spyOn(window, 'confirm');
    });
    afterEach(() => {
      confirmSpy.mockRestore();
    });

    it('does not delete when window.confirm returns false', async () => {
      const user = userEvent.setup();
      confirmSpy.mockReturnValue(false);
      deliverablesService.listDeliverables.mockResolvedValue({
        deliverables: [{ id: 1, title: 'Task A', status: 'in_progress', owner_id: 99, owner_name: 'Other' }],
      });
      renderPanel({ user: { id: 5, role: 'project_manager' }, canManage: true });

      await screen.findByText('Task A');
      await user.click(screen.getByRole('button', { name: 'Delete' }));

      expect(confirmSpy).toHaveBeenCalled();
      expect(deliverablesService.deleteDeliverable).not.toHaveBeenCalled();
    });

    it('deletes when window.confirm returns true', async () => {
      const user = userEvent.setup();
      confirmSpy.mockReturnValue(true);
      deliverablesService.listDeliverables.mockResolvedValue({
        deliverables: [{ id: 1, title: 'Task A', status: 'in_progress', owner_id: 99, owner_name: 'Other' }],
      });
      deliverablesService.deleteDeliverable.mockResolvedValue({});
      renderPanel({ user: { id: 5, role: 'project_manager' }, canManage: true });

      await screen.findByText('Task A');
      await user.click(screen.getByRole('button', { name: 'Delete' }));

      expect(confirmSpy).toHaveBeenCalled();
      expect(deliverablesService.deleteDeliverable).toHaveBeenCalledWith(1);
    });
  });

  it('owner picker is a select for admins', async () => {
    const user = userEvent.setup();
    deliverablesService.listDeliverables.mockResolvedValue({ deliverables: [] });
    usersService.listUsers.mockResolvedValue({
      users: [{ id: 10, name: 'Alice', role: 'team_member', is_active: true }],
    });
    renderPanel({ user: { id: 1, role: 'admin' }, canManage: true });

    await screen.findByText('No deliverables yet.');
    await user.click(screen.getByRole('button', { name: 'Add Deliverable' }));

    expect(await screen.findByLabelText('Owner')).toBeInTheDocument();
    expect(screen.queryByLabelText('Owner User ID')).not.toBeInTheDocument();
  });

  it('owner picker is a free-text numeric field for non-admins', async () => {
    const user = userEvent.setup();
    deliverablesService.listDeliverables.mockResolvedValue({ deliverables: [] });
    renderPanel({ user: { id: 1, role: 'project_manager' }, canManage: true });

    await screen.findByText('No deliverables yet.');
    await user.click(screen.getByRole('button', { name: 'Add Deliverable' }));

    const ownerField = await screen.findByLabelText('Owner User ID');
    expect(ownerField).toBeInTheDocument();
    expect(ownerField).toHaveAttribute('type', 'number');
    expect(screen.queryByLabelText('Owner')).not.toBeInTheDocument();
  });
});
