import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithAuth, screen, waitFor, within } from '../test/test-utils';
import Resources from '../pages/Resources';
import * as resourcesService from '../services/resourcesService';
import * as usersService from '../services/usersService';
import { downloadCsv } from '../utils/csv';

vi.mock('../services/resourcesService');
vi.mock('../services/usersService');

// Only the download is stubbed — toCsv still runs, so the assertions below
// exercise the real column contract (exportValue, exportable: false).
vi.mock('../utils/csv', async (importOriginal) => ({
  ...(await importOriginal()),
  downloadCsv: vi.fn(),
}));

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

/** First-cell text of every body row, in the order the table renders them. */
function bodyRowNames() {
  const [, ...bodyRows] = screen.getAllByRole('row');
  return bodyRows.map((row) => within(row).getAllByRole('cell')[0].textContent);
}

beforeEach(() => {
  vi.clearAllMocks();
  resourcesService.listResources.mockResolvedValue({ resources: [] });
  usersService.listUsers.mockResolvedValue({ users: [] });
});

describe('Resources page', () => {
  it('shows the empty state when the list is empty', async () => {
    mockList([]);
    renderWithAuth(<Resources />, { user: viewerUser });
    expect(await screen.findByText('No resources yet')).toBeInTheDocument();
  });

  it('shows a skeleton loading state while the list is being fetched', () => {
    resourcesService.listResources.mockReturnValue(new Promise(() => {}));
    renderWithAuth(<Resources />, { user: viewerUser });

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('No resources yet')).not.toBeInTheDocument();
  });

  it('shows a retryable error state when the fetch fails', async () => {
    const user = userEvent.setup();
    resourcesService.listResources.mockRejectedValue(new Error('Service unavailable'));
    renderWithAuth(<Resources />, { user: viewerUser });

    expect(await screen.findByText('Could not load resources')).toBeInTheDocument();
    expect(screen.getByText('Service unavailable')).toBeInTheDocument();

    mockList([resource1]);
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Pat Manager')).toBeInTheDocument();
  });

  describe('Add Resource / Edit visibility by role', () => {
    it('shows "Add Resource" and per-row "Edit" for admin', async () => {
      mockList([resource1]);
      renderWithAuth(<Resources />, { user: adminUser });
      await screen.findByText('Pat Manager');
      expect(screen.getByRole('button', { name: 'Add Resource' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
    });

    it('shows "Add Resource" and per-row "Edit" for project_manager', async () => {
      mockList([resource1]);
      renderWithAuth(<Resources />, { user: pmUser });
      await screen.findByText('Pat Manager');
      expect(screen.getByRole('button', { name: 'Add Resource' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Edit' })).toBeInTheDocument();
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

    it('offers the empty-state call to action to admin', async () => {
      mockList([]);
      renderWithAuth(<Resources />, { user: adminUser });
      await screen.findByText('No resources yet');
      // Two entry points: the page-header action and the empty-state CTA.
      expect(screen.getAllByRole('button', { name: 'Add Resource' })).toHaveLength(2);
    });

    it('offers the empty-state call to action to a project_manager', async () => {
      mockList([]);
      renderWithAuth(<Resources />, { user: pmUser });
      await screen.findByText('No resources yet');
      expect(screen.getAllByRole('button', { name: 'Add Resource' })).toHaveLength(2);
    });

    it('omits the empty-state call to action for a viewer', async () => {
      mockList([]);
      renderWithAuth(<Resources />, { user: viewerUser });
      await screen.findByText('No resources yet');
      expect(screen.queryByRole('button', { name: 'Add Resource' })).not.toBeInTheDocument();
    });
  });

  describe('utilization display', () => {
    it('shows the utilization bar with no "Over-allocated" indicator when at/under capacity', async () => {
      mockList([resource1]);
      renderWithAuth(<Resources />, { user: adminUser });
      await screen.findByText('Pat Manager');

      const row = screen.getByText('Pat Manager').closest('tr');
      expect(within(row).getByText('50/100%')).toBeInTheDocument();
      expect(within(row).queryByText('Over-allocated')).not.toBeInTheDocument();
    });

    it('shows the "Over-allocated" indicator when total_allocation_pct exceeds weekly_capacity', async () => {
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
    mockList([resource1]);
    renderWithAuth(<Resources />, { user: viewerUser });
    await screen.findByText('Pat Manager');
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

  it('omits blank filters from the request', async () => {
    mockList([resource1]);
    renderWithAuth(<Resources />, { user: viewerUser });
    await screen.findByText('Pat Manager');

    expect(resourcesService.listResources).toHaveBeenCalledWith({});
  });

  it('keeps the filter toolbar reachable when a filter matches nothing', async () => {
    const user = userEvent.setup();
    mockList([resource1]);
    renderWithAuth(<Resources />, { user: viewerUser });
    await screen.findByText('Pat Manager');

    mockList([]);
    await user.type(screen.getByLabelText('Search'), 'zzz');

    expect(await screen.findByText('No resources match these filters.')).toBeInTheDocument();
    expect(screen.getByLabelText('Search')).toHaveValue('zzz');
  });

  describe('sorting and pagination', () => {
    it('sorts by name ascending by default and toggles to descending', async () => {
      const user = userEvent.setup();
      mockList([resourceOver, resource1]);
      renderWithAuth(<Resources />, { user: viewerUser });
      await screen.findByText('Pat Manager');

      expect(bodyRowNames()).toEqual(['Pat Manager', 'Vera Viewer']);

      await user.click(screen.getByRole('button', { name: /^name$/i }));
      expect(bodyRowNames()).toEqual(['Vera Viewer', 'Pat Manager']);
    });

    it('sorts the Utilization column numerically, not lexicographically', async () => {
      const user = userEvent.setup();
      mockList([
        { ...resource1, id: 1, user_name: 'Alpha', total_allocation_pct: 100 },
        { ...resource1, id: 2, user_name: 'Beta', total_allocation_pct: 25 },
        { ...resource1, id: 3, user_name: 'Gamma', total_allocation_pct: 9 },
      ]);
      renderWithAuth(<Resources />, { user: viewerUser });
      await screen.findByText('Alpha');

      await user.click(screen.getByRole('button', { name: /utilization/i }));

      // Lexicographic order would put '100' before '25'.
      expect(bodyRowNames()).toEqual(['Gamma', 'Beta', 'Alpha']);
    });

    it('paginates at ten rows and shows the rest on the next page', async () => {
      const user = userEvent.setup();
      const many = Array.from({ length: 12 }, (_, i) => ({
        ...resource1,
        id: 200 + i,
        user_name: `Person ${String(i + 1).padStart(2, '0')}`,
      }));
      mockList(many);
      renderWithAuth(<Resources />, { user: viewerUser });
      await screen.findByText('Person 01');

      expect(bodyRowNames()).toHaveLength(10);
      expect(screen.queryByText('Person 11')).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Go to next page' }));

      expect(bodyRowNames()).toEqual(['Person 11', 'Person 12']);
    });
  });

  describe('CSV export', () => {
    it('exports the rows to resources.csv with plain-text flag values', async () => {
      const user = userEvent.setup();
      mockList([resource1, resourceOver]);
      renderWithAuth(<Resources />, { user: viewerUser });
      await screen.findByText('Pat Manager');

      await user.click(screen.getByRole('button', { name: /export/i }));

      expect(downloadCsv).toHaveBeenCalledTimes(1);
      const [filename, csv] = downloadCsv.mock.calls[0];
      expect(filename).toBe('resources.csv');
      expect(csv.split('\n')[0]).toBe('Name,Title,Department,Utilization,Over-allocated');
      expect(csv).toContain('Pat Manager,Engineer,IT,50/100%,No');
      expect(csv).toContain('Vera Viewer,Analyst,Finance,120/100%,Yes');
    });

    it('omits the actions column from the export', async () => {
      const user = userEvent.setup();
      mockList([resource1]);
      renderWithAuth(<Resources />, { user: adminUser });
      await screen.findByText('Pat Manager');

      await user.click(screen.getByRole('button', { name: /export/i }));

      expect(downloadCsv.mock.calls[0][1].split('\n')[0]).not.toContain('Actions');
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
      await screen.findByText('No resources yet');

      await user.click(screen.getAllByRole('button', { name: 'Add Resource' })[0]);
      expect(await screen.findByRole('heading', { name: 'Add Resource' })).toBeInTheDocument();

      const userField = screen.getByLabelText('User *');
      await user.click(userField);
      expect(await screen.findByRole('option', { name: /Pat Manager/ })).toBeInTheDocument();
      expect(screen.queryByRole('option', { name: /Inactive Ivy/ })).not.toBeInTheDocument();
    });

    it('does not fetch the user list for a non-admin', async () => {
      mockList([]);
      renderWithAuth(<Resources />, { user: pmUser });
      await screen.findByText('No resources yet');

      // GET /users is Admin-only, so a PM must not call it.
      expect(usersService.listUsers).not.toHaveBeenCalled();
    });

    it('gives a project_manager a numeric User ID field instead of the name picker', async () => {
      const user = userEvent.setup();
      mockList([]);
      renderWithAuth(<Resources />, { user: pmUser });
      await screen.findByText('No resources yet');

      await user.click(screen.getAllByRole('button', { name: 'Add Resource' })[0]);
      expect(await screen.findByRole('heading', { name: 'Add Resource' })).toBeInTheDocument();

      // No name list is available to a PM, so the id is entered directly.
      expect(screen.getByLabelText('User ID *')).toBeInTheDocument();
      expect(screen.queryByLabelText('User *')).not.toBeInTheDocument();
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
      await screen.findByText('No resources yet');

      await user.click(screen.getAllByRole('button', { name: 'Add Resource' })[0]);
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
      expect(await screen.findByText('Casey Consultant added')).toBeInTheDocument();
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
      expect(await screen.findByText('Pat Manager updated')).toBeInTheDocument();
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
