import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithAuth, screen, waitFor, within } from '../test/test-utils';
import Resources from './Resources';
import * as resourcesService from '../services/resourcesService';
import * as usersService from '../services/usersService';

vi.mock('../services/resourcesService');
vi.mock('../services/usersService');

const adminUser = { id: 1, name: 'Ada Admin', role: 'admin' };
const pmUser = { id: 2, name: 'Pat Manager', role: 'project_manager' };
const viewerUser = { id: 3, name: 'Vera Viewer', role: 'viewer' };
const teamMemberUser = { id: 4, name: 'Tim Team', role: 'team_member' };
const financeUser = { id: 5, name: 'Fin Ance', role: 'finance' };

const resource1 = {
  id: 100,
  user_id: 2,
  user_name: 'Pat Manager',
  title: 'Engineer',
  department: 'IT',
  total_allocation_pct: 50,
  weekly_capacity: 100,
};
const resourceOver = {
  id: 101,
  user_id: 3,
  user_name: 'Vera Viewer',
  title: 'Analyst',
  department: 'Finance',
  total_allocation_pct: 120,
  weekly_capacity: 100,
};

function mockList(resources) {
  resourcesService.listResources.mockResolvedValue({ resources });
}

beforeEach(() => {
  vi.clearAllMocks();
  resourcesService.listResources.mockResolvedValue({ resources: [] });
  usersService.listUsers.mockResolvedValue({ users: [] });
});

describe('Resources page', () => {
  it('shows "No resources yet." when the list is empty', async () => {
    mockList([]);
    renderWithAuth(<Resources />, { user: viewerUser });
    expect(await screen.findByText('No resources yet.')).toBeInTheDocument();
  });

  describe('Add Resource / Edit visibility by role', () => {
    it('shows "Add Resource" and per-row "Edit" for admin', async () => {
      mockList([resource1]);
      renderWithAuth(<Resources />, { user: adminUser });
      await screen.findByText('Pat Manager');
      expect(screen.getByRole('button', { name: 'Add Resource' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    });

    // Resource records are org-wide master data and Admin-only on the backend;
    // a project_manager manages allocations, not the resource rows themselves.
    it('hides "Add Resource" and "Edit" for project_manager', async () => {
      mockList([resource1]);
      renderWithAuth(<Resources />, { user: pmUser });
      await screen.findByText('Pat Manager');
      expect(screen.queryByRole('button', { name: 'Add Resource' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    });

    it('hides "Add Resource" and "Edit" for viewer', async () => {
      mockList([resource1]);
      renderWithAuth(<Resources />, { user: viewerUser });
      await screen.findByText('Pat Manager');
      expect(screen.queryByRole('button', { name: 'Add Resource' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    });

    it('hides "Add Resource" and "Edit" for team_member', async () => {
      mockList([resource1]);
      renderWithAuth(<Resources />, { user: teamMemberUser });
      await screen.findByText('Pat Manager');
      expect(screen.queryByRole('button', { name: 'Add Resource' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    });

    it('hides "Add Resource" and "Edit" for finance', async () => {
      mockList([resource1]);
      renderWithAuth(<Resources />, { user: financeUser });
      await screen.findByText('Pat Manager');
      expect(screen.queryByRole('button', { name: 'Add Resource' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    });
  });

  describe('utilization display', () => {
    it('shows the utilization bar with no "Over-allocated" chip when at/under capacity', async () => {
      mockList([resource1]);
      renderWithAuth(<Resources />, { user: adminUser });
      await screen.findByText('Pat Manager');

      const row = screen.getByText('Pat Manager').closest('tr');
      expect(within(row).getByText('50/100%')).toBeInTheDocument();
      expect(within(row).queryByText('Over-allocated')).not.toBeInTheDocument();
    });

    it('shows the "Over-allocated" chip when total_allocation_pct exceeds weekly_capacity', async () => {
      mockList([resourceOver]);
      renderWithAuth(<Resources />, { user: adminUser });
      await screen.findByText('Vera Viewer');

      const row = screen.getByText('Vera Viewer').closest('tr');
      expect(within(row).getByText('120/100%')).toBeInTheDocument();
      expect(within(row).getByText('Over-allocated')).toBeInTheDocument();
    });
  });

  it('triggers a new listResources call with updated filters when search/department change', async () => {
    const user = userEvent.setup();
    mockList([]);
    renderWithAuth(<Resources />, { user: viewerUser });
    await screen.findByText('No resources yet.');
    resourcesService.listResources.mockClear();

    await user.type(screen.getByLabelText('Search'), 'abc');
    await waitFor(() => {
      expect(resourcesService.listResources).toHaveBeenCalledWith(
        expect.objectContaining({ q: 'abc' })
      );
    });

    resourcesService.listResources.mockClear();
    await user.type(screen.getByLabelText('Department'), 'IT');
    await waitFor(() => {
      expect(resourcesService.listResources).toHaveBeenCalledWith(
        expect.objectContaining({ department: 'IT' })
      );
    });
  });

  describe('create dialog user-picker', () => {
    it('shows a User select populated from usersService.listUsers for admin', async () => {
      const user = userEvent.setup();
      mockList([]);
      usersService.listUsers.mockResolvedValue({
        users: [
          { id: 2, name: 'Pat Manager', role: 'project_manager', is_active: true },
          { id: 6, name: 'Inactive Ivy', role: 'viewer', is_active: false },
        ],
      });
      renderWithAuth(<Resources />, { user: adminUser });
      await screen.findByText('No resources yet.');

      await user.click(screen.getByRole('button', { name: 'Add Resource' }));
      expect(await screen.findByRole('heading', { name: 'Add Resource' })).toBeInTheDocument();

      const userField = screen.getByLabelText('User *');
      await user.click(userField);
      expect(await screen.findByRole('option', { name: /Pat Manager/ })).toBeInTheDocument();
      expect(screen.queryByRole('option', { name: /Inactive Ivy/ })).not.toBeInTheDocument();
    });

    it('does not fetch the user list for a non-admin', async () => {
      mockList([]);
      renderWithAuth(<Resources />, { user: pmUser });
      await screen.findByText('No resources yet.');

      // GET /users is Admin-only, and a PM has no create dialog to populate.
      expect(usersService.listUsers).not.toHaveBeenCalled();
    });

    it('hides any user-picker (select or text field) when editing an existing row', async () => {
      const user = userEvent.setup();
      mockList([resource1]);
      renderWithAuth(<Resources />, { user: adminUser });
      await screen.findByText('Pat Manager');

      await user.click(screen.getByRole('button', { name: 'Edit' }));
      expect(await screen.findByRole('heading', { name: 'Edit Resource' })).toBeInTheDocument();

      expect(screen.queryByLabelText('User')).not.toBeInTheDocument();
      expect(screen.queryByLabelText('User ID')).not.toBeInTheDocument();
    });
  });

  describe('form submission', () => {
    it('submitting create calls createResource with the full form including user_id', async () => {
      const user = userEvent.setup();
      mockList([]);
      usersService.listUsers.mockResolvedValue({
        users: [{ id: 42, name: 'Casey Consultant', role: 'team_member', is_active: true }],
      });
      resourcesService.createResource.mockResolvedValue({ resource: { id: 200 } });
      renderWithAuth(<Resources />, { user: adminUser });
      await screen.findByText('No resources yet.');

      await user.click(screen.getByRole('button', { name: 'Add Resource' }));
      await screen.findByRole('heading', { name: 'Add Resource' });

      const dialog = screen.getByRole('dialog');
      await user.click(within(dialog).getByLabelText('User *'));
      await user.click(await screen.findByRole('option', { name: /Casey Consultant/ }));
      await user.type(within(dialog).getByLabelText('Title'), 'Consultant');
      await user.type(within(dialog).getByLabelText('Department'), 'Ops');

      resourcesService.listResources.mockClear();
      await user.click(screen.getByRole('button', { name: 'Create' }));

      await waitFor(() => {
        expect(resourcesService.createResource).toHaveBeenCalledWith(
          expect.objectContaining({
            user_id: 42,
            title: 'Consultant',
            department: 'Ops',
          })
        );
      });
      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: 'Add Resource' })).not.toBeInTheDocument();
      });
      expect(resourcesService.listResources).toHaveBeenCalled();
    });

    it('submitting an edit calls updateResource(id, {title, department, weekly_capacity}) without user_id', async () => {
      const user = userEvent.setup();
      mockList([resource1]);
      resourcesService.updateResource.mockResolvedValue({ resource: { id: resource1.id } });
      renderWithAuth(<Resources />, { user: adminUser });
      await screen.findByText('Pat Manager');

      await user.click(screen.getByRole('button', { name: 'Edit' }));
      await screen.findByRole('heading', { name: 'Edit Resource' });

      const titleField = screen.getByLabelText('Title');
      await user.clear(titleField);
      await user.type(titleField, 'Senior Engineer');

      await user.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(resourcesService.updateResource).toHaveBeenCalledWith(
          resource1.id,
          { title: 'Senior Engineer', department: 'IT', weekly_capacity: 100 }
        );
      });

      const call = resourcesService.updateResource.mock.calls[0];
      expect(call[1]).not.toHaveProperty('user_id');
    });

    it('a rejected submit shows the error in the dialog', async () => {
      const user = userEvent.setup();
      mockList([resource1]);
      resourcesService.updateResource.mockRejectedValue(new Error('Update failed'));
      renderWithAuth(<Resources />, { user: adminUser });
      await screen.findByText('Pat Manager');

      await user.click(screen.getByRole('button', { name: 'Edit' }));
      await screen.findByRole('heading', { name: 'Edit Resource' });

      await user.click(screen.getByRole('button', { name: 'Save' }));

      expect(await screen.findByText('Update failed')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'Edit Resource' })).toBeInTheDocument();
    });
  });
});
