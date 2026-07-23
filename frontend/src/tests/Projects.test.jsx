import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithAuth, fireEvent, screen, waitFor, within } from '../test/test-utils';
import Projects from '../pages/Projects';
import * as projectsService from '../services/projectsService';
import * as usersService from '../services/usersService';
import { downloadCsv } from '../utils/csv';

vi.mock('../services/projectsService');
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

const project1 = {
  id: 10,
  name: 'Website Revamp',
  manager_id: 2,
  manager_name: 'Pat Manager',
  department: 'Marketing',
  status: 'active',
  start_date: '2026-01-01',
  end_date: '2026-06-01',
  planned_amount: null,
  actual_spend: null,
};
const project2 = {
  id: 11,
  name: 'Data Migration',
  manager_id: 99,
  manager_name: 'Other Manager',
  department: 'IT',
  status: 'archived',
  start_date: '2025-01-01',
  end_date: '2025-06-01',
  planned_amount: null,
  actual_spend: null,
};

function mockList(projects) {
  projectsService.listProjects.mockResolvedValue({ projects });
}

/** First-cell text of every body row, in the order the table renders them. */
function bodyRowNames() {
  const [, ...bodyRows] = screen.getAllByRole('row');
  return bodyRows.map((row) => within(row).getAllByRole('cell')[0].textContent);
}

/** Latest filter object handed to the service. */
function lastListCall() {
  return projectsService.listProjects.mock.calls.at(-1)[0];
}

beforeEach(() => {
  vi.clearAllMocks();
  projectsService.listProjects.mockResolvedValue({ projects: [] });
  usersService.listUsers.mockResolvedValue({ users: [] });
});

describe('Projects page', () => {
  it('shows the empty state when the list is empty', async () => {
    mockList([]);
    renderWithAuth(<Projects />, { user: viewerUser });
    expect(await screen.findByText('No projects yet')).toBeInTheDocument();
  });

  it('shows a skeleton loading state while the list is being fetched', () => {
    projectsService.listProjects.mockReturnValue(new Promise(() => {}));
    renderWithAuth(<Projects />, { user: viewerUser });

    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('No projects yet')).not.toBeInTheDocument();
  });

  it('shows a retryable error state when the fetch fails', async () => {
    const user = userEvent.setup();
    projectsService.listProjects.mockRejectedValue(new Error('Network down'));
    renderWithAuth(<Projects />, { user: viewerUser });

    expect(await screen.findByText('Could not load projects')).toBeInTheDocument();
    expect(screen.getByText('Network down')).toBeInTheDocument();

    mockList([project1]);
    await user.click(screen.getByRole('button', { name: 'Retry' }));
    expect(await screen.findByText('Website Revamp')).toBeInTheDocument();
  });

  it('renders a row per project with name/manager/department/status/dates', async () => {
    mockList([project1, project2]);
    renderWithAuth(<Projects />, { user: viewerUser });

    expect(await screen.findByText('Website Revamp')).toBeInTheDocument();
    expect(screen.getByText('Data Migration')).toBeInTheDocument();

    const row1 = screen.getByText('Website Revamp').closest('tr');
    expect(within(row1).getByText('Pat Manager')).toBeInTheDocument();
    expect(within(row1).getByText('Marketing')).toBeInTheDocument();
    expect(within(row1).getByText('active')).toBeInTheDocument();
    expect(within(row1).getByText('2026-01-01')).toBeInTheDocument();
    expect(within(row1).getByText('2026-06-01')).toBeInTheDocument();

    const row2 = screen.getByText('Data Migration').closest('tr');
    expect(within(row2).getByText('Other Manager')).toBeInTheDocument();
    expect(within(row2).getByText('IT')).toBeInTheDocument();
    expect(within(row2).getByText('archived')).toBeInTheDocument();
  });

  describe('budget column', () => {
    it('formats planned_amount as currency', async () => {
      mockList([{ ...project1, planned_amount: '125000.00' }]);
      renderWithAuth(<Projects />, { user: viewerUser });

      const row = (await screen.findByText('Website Revamp')).closest('tr');
      expect(within(row).getByText(/125,000/)).toBeInTheDocument();
    });

    it('renders an em dash when the project has no budget yet', async () => {
      mockList([project1]);
      renderWithAuth(<Projects />, { user: viewerUser });

      const row = (await screen.findByText('Website Revamp')).closest('tr');
      // Department and both dates are populated, so the only dash is the budget.
      expect(within(row).getByText('—')).toBeInTheDocument();
    });
  });

  describe('"New Project" button visibility', () => {
    it('shows "New Project" for admin', async () => {
      mockList([]);
      renderWithAuth(<Projects />, { user: adminUser });
      expect(await screen.findByRole('button', { name: 'New Project' })).toBeInTheDocument();
    });

    it('shows "New Project" for project_manager', async () => {
      mockList([]);
      renderWithAuth(<Projects />, { user: pmUser });
      expect(await screen.findByRole('button', { name: 'New Project' })).toBeInTheDocument();
    });

    it('hides "New Project" for viewer', async () => {
      mockList([]);
      renderWithAuth(<Projects />, { user: viewerUser });
      await screen.findByText('No projects yet');
      expect(screen.queryByRole('button', { name: 'New Project' })).not.toBeInTheDocument();
    });

    it('offers "New Project" from the table toolbar once projects exist', async () => {
      mockList([project1]);
      renderWithAuth(<Projects />, { user: adminUser });
      await screen.findByText('Website Revamp');
      expect(screen.getByRole('button', { name: 'New Project' })).toBeInTheDocument();
    });

    it('hides the toolbar "New Project" from a viewer once projects exist', async () => {
      mockList([project1]);
      renderWithAuth(<Projects />, { user: viewerUser });
      await screen.findByText('Website Revamp');
      expect(screen.queryByRole('button', { name: 'New Project' })).not.toBeInTheDocument();
    });
  });

  describe('filters', () => {
    it('shows the manager filter dropdown only for admin users', async () => {
      mockList([project1]);
      usersService.listUsers.mockResolvedValue({
        users: [
          { id: 2, name: 'Pat Manager', role: 'project_manager', is_active: true },
          { id: 5, name: 'Amy Admin2', role: 'admin', is_active: true },
        ],
      });
      renderWithAuth(<Projects />, { user: adminUser });
      await screen.findByText('Website Revamp');
      expect(await screen.findByLabelText('Manager')).toBeInTheDocument();
    });

    it('does not show the manager filter dropdown for non-admin users', async () => {
      mockList([project1]);
      renderWithAuth(<Projects />, { user: pmUser });
      await screen.findByText('Website Revamp');
      expect(usersService.listUsers).not.toHaveBeenCalled();
      expect(screen.queryByLabelText('Manager')).not.toBeInTheDocument();
    });

    it('omits every blank filter from the request', async () => {
      mockList([project1]);
      renderWithAuth(<Projects />, { user: viewerUser });
      await screen.findByText('Website Revamp');

      expect(projectsService.listProjects).toHaveBeenCalledWith({});
    });

    it('triggers a new listProjects call with updated filters when typing in search', async () => {
      const user = userEvent.setup();
      mockList([project1]);
      renderWithAuth(<Projects />, { user: viewerUser });
      await screen.findByText('Website Revamp');
      projectsService.listProjects.mockClear();

      await user.type(screen.getByLabelText('Search'), 'abc');

      await waitFor(() => {
        expect(projectsService.listProjects).toHaveBeenCalledWith(
          expect.objectContaining({ q: 'abc' })
        );
      });
    });

    it('triggers a new listProjects call with updated filters when changing status', async () => {
      const user = userEvent.setup();
      mockList([project1]);
      renderWithAuth(<Projects />, { user: viewerUser });
      await screen.findByText('Website Revamp');
      projectsService.listProjects.mockClear();

      await user.click(screen.getByLabelText('Status'));
      const option = await screen.findByRole('option', { name: 'active' });
      await user.click(option);

      await waitFor(() => {
        expect(projectsService.listProjects).toHaveBeenCalledWith(
          expect.objectContaining({ status: 'active' })
        );
      });
    });

    it('sends the department filter', async () => {
      const user = userEvent.setup();
      mockList([project1]);
      renderWithAuth(<Projects />, { user: viewerUser });
      await screen.findByText('Website Revamp');
      projectsService.listProjects.mockClear();

      await user.type(screen.getByLabelText('Department'), 'IT');

      await waitFor(() => {
        expect(projectsService.listProjects).toHaveBeenCalledWith(
          expect.objectContaining({ department: 'IT' })
        );
      });
    });

    it('sends the manager filter', async () => {
      const user = userEvent.setup();
      mockList([project1]);
      usersService.listUsers.mockResolvedValue({
        users: [{ id: 2, name: 'Pat Manager', role: 'project_manager', is_active: true }],
      });
      renderWithAuth(<Projects />, { user: adminUser });
      await screen.findByLabelText('Manager');
      projectsService.listProjects.mockClear();

      await user.click(screen.getByLabelText('Manager'));
      await user.click(await screen.findByRole('option', { name: 'Pat Manager' }));

      await waitFor(() => {
        expect(projectsService.listProjects).toHaveBeenCalledWith(
          expect.objectContaining({ manager_id: 2 })
        );
      });
    });

    it('sends budget_min and budget_max, and nothing else, when only the budget bounds are set', async () => {
      const user = userEvent.setup();
      mockList([project1]);
      renderWithAuth(<Projects />, { user: viewerUser });
      await screen.findByText('Website Revamp');

      await user.type(screen.getByLabelText('Min Budget'), '1000');
      await waitFor(() => {
        expect(lastListCall()).toEqual({ budget_min: '1000' });
      });

      await user.type(screen.getByLabelText('Max Budget'), '5000');
      await waitFor(() => {
        expect(lastListCall()).toEqual({ budget_min: '1000', budget_max: '5000' });
      });
    });

    it('sends date_from and date_to from the date range fields', async () => {
      mockList([project1]);
      renderWithAuth(<Projects />, { user: viewerUser });
      await screen.findByText('Website Revamp');

      fireEvent.change(screen.getByLabelText('Start From'), { target: { value: '2026-01-01' } });
      await waitFor(() => {
        expect(lastListCall()).toEqual({ date_from: '2026-01-01' });
      });

      fireEvent.change(screen.getByLabelText('End By'), { target: { value: '2026-12-31' } });
      await waitFor(() => {
        expect(lastListCall()).toEqual({ date_from: '2026-01-01', date_to: '2026-12-31' });
      });
    });

    it('keeps the filter toolbar reachable when a filter matches nothing', async () => {
      const user = userEvent.setup();
      mockList([project1]);
      renderWithAuth(<Projects />, { user: viewerUser });
      await screen.findByText('Website Revamp');

      mockList([]);
      await user.type(screen.getByLabelText('Search'), 'zzz');

      expect(await screen.findByText('No projects match these filters.')).toBeInTheDocument();
      // The user must still be able to clear the filter that emptied the table.
      expect(screen.getByLabelText('Search')).toHaveValue('zzz');
    });
  });

  describe('sorting and pagination', () => {
    it('sorts by name ascending by default and toggles to descending', async () => {
      const user = userEvent.setup();
      mockList([project1, project2]);
      renderWithAuth(<Projects />, { user: viewerUser });
      await screen.findByText('Website Revamp');

      expect(bodyRowNames()).toEqual(['Data Migration', 'Website Revamp']);

      await user.click(screen.getByRole('button', { name: /name/i }));
      expect(bodyRowNames()).toEqual(['Website Revamp', 'Data Migration']);
    });

    it('sorts the Budget column numerically, not lexicographically', async () => {
      const user = userEvent.setup();
      mockList([
        { ...project1, id: 1, name: 'Alpha', planned_amount: '1000.00' },
        { ...project1, id: 2, name: 'Beta', planned_amount: '250.00' },
        { ...project1, id: 3, name: 'Gamma', planned_amount: '90.00' },
      ]);
      renderWithAuth(<Projects />, { user: viewerUser });
      await screen.findByText('Alpha');

      await user.click(screen.getByRole('button', { name: /budget/i }));

      // Lexicographic order would put '1000.00' first.
      expect(bodyRowNames()).toEqual(['Gamma', 'Beta', 'Alpha']);
    });

    it('paginates at ten rows and shows the rest on the next page', async () => {
      const user = userEvent.setup();
      const many = Array.from({ length: 12 }, (_, i) => ({
        ...project2,
        id: 100 + i,
        name: `Project ${String(i + 1).padStart(2, '0')}`,
      }));
      mockList(many);
      renderWithAuth(<Projects />, { user: viewerUser });
      await screen.findByText('Project 01');

      expect(bodyRowNames()).toHaveLength(10);
      expect(screen.queryByText('Project 11')).not.toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Go to next page' }));

      expect(bodyRowNames()).toEqual(['Project 11', 'Project 12']);
    });
  });

  describe('CSV export', () => {
    it('exports the rows to projects.csv, without the actions column', async () => {
      const user = userEvent.setup();
      mockList([{ ...project1, planned_amount: '125000.00' }, project2]);
      renderWithAuth(<Projects />, { user: viewerUser });
      await screen.findByText('Website Revamp');

      await user.click(screen.getByRole('button', { name: /export/i }));

      expect(downloadCsv).toHaveBeenCalledTimes(1);
      const [filename, csv] = downloadCsv.mock.calls[0];
      expect(filename).toBe('projects.csv');
      expect(csv.split('\n')[0]).toBe('Name,Manager,Department,Status,Budget,Start,End');
      // The raw amount is exported, not the currency-formatted cell.
      expect(csv).toContain('Website Revamp,Pat Manager,Marketing,active,125000.00,2026-01-01,2026-06-01');
      // planned_amount is null for project2, so the Budget cell exports blank.
      expect(csv).toContain('Data Migration,Other Manager,IT,archived,,2025-01-01,2025-06-01');
    });

    it('exports only the rows the current filters matched', async () => {
      const user = userEvent.setup();
      mockList([project1, project2]);
      renderWithAuth(<Projects />, { user: viewerUser });
      await screen.findByText('Website Revamp');

      mockList([project1]);
      await user.type(screen.getByLabelText('Search'), 'Web');
      await waitFor(() => {
        expect(screen.queryByText('Data Migration')).not.toBeInTheDocument();
      });

      await user.click(screen.getByRole('button', { name: /export/i }));

      const csv = downloadCsv.mock.calls[0][1];
      expect(csv).toContain('Website Revamp');
      expect(csv).not.toContain('Data Migration');
    });
  });

  describe('create dialog', () => {
    it('opens the dialog when "New Project" is clicked, pre-filled+disabled manager for project_manager', async () => {
      const user = userEvent.setup();
      mockList([]);
      renderWithAuth(<Projects />, { user: pmUser });
      await screen.findByText('No projects yet');

      await user.click(screen.getByRole('button', { name: 'New Project' }));

      expect(await screen.findByRole('heading', { name: 'New Project' })).toBeInTheDocument();
      const managerField = screen.getByLabelText('Manager');
      expect(managerField).toHaveValue('Pat Manager');
      expect(managerField).toBeDisabled();
    });

    it('opens the dialog with an editable manager select for admin, populated from managers', async () => {
      const user = userEvent.setup();
      mockList([]);
      usersService.listUsers.mockResolvedValue({
        users: [{ id: 2, name: 'Pat Manager', role: 'project_manager', is_active: true }],
      });
      renderWithAuth(<Projects />, { user: adminUser });
      await screen.findByText('No projects yet');

      await user.click(screen.getByRole('button', { name: 'New Project' }));
      expect(await screen.findByRole('heading', { name: 'New Project' })).toBeInTheDocument();

      // The admin's dialog field is a required select, so its label carries the
      // asterisk — distinguishing it from the optional toolbar filter.
      const managerField = screen.getByLabelText('Manager *');
      expect(managerField).not.toBeDisabled();
      await user.click(managerField);
      expect(await screen.findByRole('option', { name: /Pat Manager/ })).toBeInTheDocument();
    });

    it('submitting the create form with fields filled calls createProject, closes dialog, and reloads list', async () => {
      const user = userEvent.setup();
      mockList([]);
      projectsService.createProject.mockResolvedValue({ project: { id: 20 } });
      renderWithAuth(<Projects />, { user: pmUser });
      await screen.findByText('No projects yet');

      await user.click(screen.getByRole('button', { name: 'New Project' }));
      await screen.findByRole('heading', { name: 'New Project' });

      await user.type(screen.getByLabelText('Name *'), 'New Cool Project');

      projectsService.listProjects.mockClear();
      await user.click(screen.getByRole('button', { name: 'Create' }));

      await waitFor(() => {
        expect(projectsService.createProject).toHaveBeenCalledWith(
          expect.objectContaining({ name: 'New Cool Project', manager_id: pmUser.id })
        );
      });

      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: 'New Project' })).not.toBeInTheDocument();
      });
      expect(projectsService.listProjects).toHaveBeenCalled();
    });

    it('a rejected createProject shows the error inside the dialog and does not close it', async () => {
      const user = userEvent.setup();
      mockList([]);
      projectsService.createProject.mockRejectedValue(new Error('Name already taken'));
      renderWithAuth(<Projects />, { user: pmUser });
      await screen.findByText('No projects yet');

      await user.click(screen.getByRole('button', { name: 'New Project' }));
      await screen.findByRole('heading', { name: 'New Project' });
      await user.type(screen.getByLabelText('Name *'), 'Dup Project');

      await user.click(screen.getByRole('button', { name: 'Create' }));

      expect(await screen.findByText('Name already taken')).toBeInTheDocument();
      expect(screen.getByRole('heading', { name: 'New Project' })).toBeInTheDocument();
    });

    it('submitting the create form with empty required fields does NOT call createProject', async () => {
      const user = userEvent.setup();
      mockList([]);
      renderWithAuth(<Projects />, { user: adminUser });
      await screen.findByText('No projects yet');

      await user.click(screen.getByRole('button', { name: 'New Project' }));
      await screen.findByRole('heading', { name: 'New Project' });

      // Leave Name and Manager empty and submit.
      await user.click(screen.getByRole('button', { name: 'Create' }));

      // Empirically verified: jsdom DOES enforce native HTML5 required-field
      // constraint validation on <form> submit (via user-event's realistic
      // click/submit dispatch), so the browser blocks the submit event and
      // handleSubmit/createProject is never invoked. Give it a beat to be sure.
      await new Promise((r) => setTimeout(r, 50));
      expect(projectsService.createProject).not.toHaveBeenCalled();
      // Dialog should still be open since the submit was blocked.
      expect(screen.getByRole('heading', { name: 'New Project' })).toBeInTheDocument();
    });
  });

  describe('per-row Edit/Archive visibility', () => {
    it('admin sees Edit/Archive on all non-archived rows managed by anyone, Archive hidden for archived rows', async () => {
      mockList([project1, project2]);
      renderWithAuth(<Projects />, { user: adminUser });
      await screen.findByText('Website Revamp');

      const row1 = screen.getByText('Website Revamp').closest('tr');
      expect(within(row1).getByRole('button', { name: 'Edit' })).toBeInTheDocument();
      expect(within(row1).getByRole('button', { name: 'Archive' })).toBeInTheDocument();

      const row2 = screen.getByText('Data Migration').closest('tr');
      expect(within(row2).getByRole('button', { name: 'Edit' })).toBeInTheDocument();
      expect(within(row2).queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument();
    });

    it('project_manager only sees Edit/Archive on rows they manage', async () => {
      mockList([project1, project2]);
      renderWithAuth(<Projects />, { user: pmUser });
      await screen.findByText('Website Revamp');

      const row1 = screen.getByText('Website Revamp').closest('tr');
      expect(within(row1).getByRole('button', { name: 'Edit' })).toBeInTheDocument();

      const row2 = screen.getByText('Data Migration').closest('tr');
      expect(within(row2).queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
      expect(within(row2).queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument();
    });

    it('non-manager (viewer) sees no Edit/Archive buttons at all', async () => {
      mockList([project1, project2]);
      renderWithAuth(<Projects />, { user: viewerUser });
      await screen.findByText('Website Revamp');

      expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Archive' })).not.toBeInTheDocument();
    });
  });

  describe('archive action', () => {
    async function openArchiveDialog(user) {
      await user.click(screen.getByRole('button', { name: 'Archive' }));
      return screen.findByRole('dialog');
    }

    it('opens a themed confirmation dialog instead of window.confirm', async () => {
      const user = userEvent.setup();
      mockList([project1]);
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      renderWithAuth(<Projects />, { user: adminUser });
      await screen.findByText('Website Revamp');

      const dialog = await openArchiveDialog(user);

      expect(within(dialog).getByText('Archive this project?')).toBeInTheDocument();
      expect(within(dialog).getByText('It will no longer accept new deliverables.')).toBeInTheDocument();
      expect(confirmSpy).not.toHaveBeenCalled();
      expect(projectsService.archiveProject).not.toHaveBeenCalled();
      confirmSpy.mockRestore();
    });

    it('confirming the dialog calls archiveProject, closes it and reloads', async () => {
      const user = userEvent.setup();
      mockList([project1]);
      projectsService.archiveProject.mockResolvedValue({});
      renderWithAuth(<Projects />, { user: adminUser });
      await screen.findByText('Website Revamp');

      const dialog = await openArchiveDialog(user);
      projectsService.listProjects.mockClear();
      await user.click(within(dialog).getByRole('button', { name: 'Archive' }));

      await waitFor(() => {
        expect(projectsService.archiveProject).toHaveBeenCalledWith(project1.id);
      });
      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
      expect(projectsService.listProjects).toHaveBeenCalled();
    });

    it('cancelling the dialog does NOT call archiveProject', async () => {
      const user = userEvent.setup();
      mockList([project1]);
      renderWithAuth(<Projects />, { user: adminUser });
      await screen.findByText('Website Revamp');

      const dialog = await openArchiveDialog(user);
      await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));

      await waitFor(() => {
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
      });
      expect(projectsService.archiveProject).not.toHaveBeenCalled();
    });

    it('surfaces a failed archive inside the dialog and keeps it open', async () => {
      const user = userEvent.setup();
      mockList([project1]);
      projectsService.archiveProject.mockRejectedValue(new Error('Archive failed'));
      renderWithAuth(<Projects />, { user: adminUser });
      await screen.findByText('Website Revamp');

      const dialog = await openArchiveDialog(user);
      await user.click(within(dialog).getByRole('button', { name: 'Archive' }));

      expect(await within(dialog).findByText('Archive failed')).toBeInTheDocument();
      expect(screen.getByRole('dialog')).toBeInTheDocument();
    });
  });
});
