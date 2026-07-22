import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithAuth, screen, waitFor, within } from '../test/test-utils';
import Projects from './Projects';
import * as projectsService from '../services/projectsService';
import * as usersService from '../services/usersService';

vi.mock('../services/projectsService');
vi.mock('../services/usersService');

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
};

function mockList(projects) {
  projectsService.listProjects.mockResolvedValue({ projects });
}

beforeEach(() => {
  vi.clearAllMocks();
  projectsService.listProjects.mockResolvedValue({ projects: [] });
  usersService.listUsers.mockResolvedValue({ users: [] });
});

describe('Projects page', () => {
  it('shows "No projects yet." when the list is empty', async () => {
    mockList([]);
    renderWithAuth(<Projects />, { user: viewerUser });
    expect(await screen.findByText('No projects yet.')).toBeInTheDocument();
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

  it('shows "New Project" button for admin and project_manager roles', async () => {
    mockList([]);
    renderWithAuth(<Projects />, { user: adminUser });
    expect(await screen.findByRole('button', { name: 'New Project' })).toBeInTheDocument();
  });

  it('shows "New Project" button for project_manager', async () => {
    mockList([]);
    renderWithAuth(<Projects />, { user: pmUser });
    expect(await screen.findByRole('button', { name: 'New Project' })).toBeInTheDocument();
  });

  it('hides "New Project" button for viewer', async () => {
    mockList([]);
    renderWithAuth(<Projects />, { user: viewerUser });
    await screen.findByText('No projects yet.');
    expect(screen.queryByRole('button', { name: 'New Project' })).not.toBeInTheDocument();
  });

  it('shows the manager filter dropdown only for admin users', async () => {
    mockList([]);
    usersService.listUsers.mockResolvedValue({
      users: [
        { id: 2, name: 'Pat Manager', role: 'project_manager', is_active: true },
        { id: 5, name: 'Amy Admin2', role: 'admin', is_active: true },
      ],
    });
    renderWithAuth(<Projects />, { user: adminUser });
    await screen.findByText('No projects yet.');
    expect(await screen.findByLabelText('Manager')).toBeInTheDocument();
  });

  it('does not show the manager filter dropdown for non-admin users', async () => {
    mockList([]);
    renderWithAuth(<Projects />, { user: pmUser });
    await screen.findByText('No projects yet.');
    expect(usersService.listUsers).not.toHaveBeenCalled();
    expect(screen.queryByLabelText('Manager')).not.toBeInTheDocument();
  });

  it('triggers a new listProjects call with updated filters when typing in search', async () => {
    const user = userEvent.setup();
    mockList([]);
    renderWithAuth(<Projects />, { user: viewerUser });
    await screen.findByText('No projects yet.');
    projectsService.listProjects.mockClear();

    const search = screen.getByLabelText('Search');
    await user.type(search, 'abc');

    await waitFor(() => {
      expect(projectsService.listProjects).toHaveBeenCalledWith(
        expect.objectContaining({ q: 'abc' })
      );
    });
  });

  it('triggers a new listProjects call with updated filters when changing status', async () => {
    const user = userEvent.setup();
    mockList([]);
    renderWithAuth(<Projects />, { user: viewerUser });
    await screen.findByText('No projects yet.');
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

  describe('create dialog', () => {
    it('opens the dialog when "New Project" is clicked, pre-filled+disabled manager for project_manager', async () => {
      const user = userEvent.setup();
      mockList([]);
      renderWithAuth(<Projects />, { user: pmUser });
      await screen.findByText('No projects yet.');

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
      await screen.findByText('No projects yet.');

      await user.click(screen.getByRole('button', { name: 'New Project' }));
      expect(await screen.findByRole('heading', { name: 'New Project' })).toBeInTheDocument();

      const managerField = screen.getByLabelText('Manager');
      expect(managerField).not.toBeDisabled();
      await user.click(managerField);
      expect(await screen.findByRole('option', { name: /Pat Manager/ })).toBeInTheDocument();
    });

    it('submitting the create form with fields filled calls createProject, closes dialog, and reloads list', async () => {
      const user = userEvent.setup();
      mockList([]);
      projectsService.createProject.mockResolvedValue({ project: { id: 20 } });
      renderWithAuth(<Projects />, { user: pmUser });
      await screen.findByText('No projects yet.');

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
      await screen.findByText('No projects yet.');

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
      await screen.findByText('No projects yet.');

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
    it('confirmed archive calls window.confirm then archiveProject and reloads', async () => {
      const user = userEvent.setup();
      mockList([project1]);
      projectsService.archiveProject.mockResolvedValue({});
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(true);
      renderWithAuth(<Projects />, { user: adminUser });
      await screen.findByText('Website Revamp');

      projectsService.listProjects.mockClear();
      await user.click(screen.getByRole('button', { name: 'Archive' }));

      expect(confirmSpy).toHaveBeenCalled();
      await waitFor(() => {
        expect(projectsService.archiveProject).toHaveBeenCalledWith(project1.id);
      });
      expect(projectsService.listProjects).toHaveBeenCalled();
    });

    it('cancelled confirm does NOT call archiveProject', async () => {
      const user = userEvent.setup();
      mockList([project1]);
      const confirmSpy = vi.spyOn(window, 'confirm').mockReturnValue(false);
      renderWithAuth(<Projects />, { user: adminUser });
      await screen.findByText('Website Revamp');

      await user.click(screen.getByRole('button', { name: 'Archive' }));

      expect(confirmSpy).toHaveBeenCalled();
      expect(projectsService.archiveProject).not.toHaveBeenCalled();
    });
  });
});
