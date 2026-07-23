import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithAuth, screen, waitFor, within } from '../test/test-utils';
import Deliverables from '../pages/Deliverables';
import * as deliverablesService from '../services/deliverablesService';
import * as projectsService from '../services/projectsService';
import * as usersService from '../services/usersService';

vi.mock('../services/deliverablesService');
vi.mock('../services/projectsService');
vi.mock('../services/usersService');

const adminUser = { id: 1, name: 'Ada Admin', role: 'admin' };
const pmUser = { id: 2, name: 'Pat Manager', role: 'project_manager' };
const viewerUser = { id: 3, name: 'Vera Viewer', role: 'viewer' };
const memberUser = { id: 4, name: 'Tim Team', role: 'team_member' };

// Fixed far past/future so overdue assertions never depend on the clock.
const PAST = '2000-01-01';
const FUTURE = '2999-12-31';

const project1 = { id: 10, name: 'Website Revamp', manager_id: 2, manager_name: 'Pat Manager' };
const project2 = { id: 11, name: 'Data Migration', manager_id: 99, manager_name: 'Other Manager' };

const deliverable1 = {
  id: 100,
  project_id: 10,
  title: 'Design mockups',
  owner_id: 4,
  owner_name: 'Tim Team',
  status: 'in_progress',
  due_date: FUTURE,
};
const deliverable2 = {
  id: 101,
  project_id: 11,
  title: 'Migrate schema',
  owner_id: null,
  owner_name: null,
  status: 'not_started',
  due_date: PAST,
};
const deliverable3 = {
  id: 102,
  project_id: 11,
  title: 'Archive old data',
  owner_id: 9,
  owner_name: 'Sam Other',
  status: 'completed',
  due_date: PAST,
};

function mockList(deliverables) {
  deliverablesService.listDeliverables.mockResolvedValue({ deliverables });
}

beforeEach(() => {
  vi.clearAllMocks();
  deliverablesService.listDeliverables.mockResolvedValue({ deliverables: [] });
  deliverablesService.updateDeliverable.mockResolvedValue({});
  projectsService.listProjects.mockResolvedValue({ projects: [project1, project2] });
  usersService.listUsers.mockResolvedValue({ users: [] });
});

describe('Deliverables page', () => {
  it('renders the page heading', async () => {
    mockList([]);
    renderWithAuth(<Deliverables />, { user: viewerUser });
    expect(await screen.findByRole('heading', { name: 'Deliverables', level: 1 })).toBeInTheDocument();
  });

  it('shows a loading state while the list is in flight', () => {
    deliverablesService.listDeliverables.mockReturnValue(new Promise(() => {}));
    projectsService.listProjects.mockReturnValue(new Promise(() => {}));
    renderWithAuth(<Deliverables />, { user: viewerUser });
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('renders a row per deliverable with title/project/owner/status/due date', async () => {
    mockList([deliverable1, deliverable2]);
    renderWithAuth(<Deliverables />, { user: viewerUser });

    expect(await screen.findByText('Design mockups')).toBeInTheDocument();

    const row1 = screen.getByText('Design mockups').closest('tr');
    expect(within(row1).getByText('Website Revamp')).toBeInTheDocument();
    expect(within(row1).getByText('Tim Team')).toBeInTheDocument();
    expect(within(row1).getByText('in_progress')).toBeInTheDocument();
    expect(within(row1).getByText(FUTURE)).toBeInTheDocument();

    const row2 = screen.getByText('Migrate schema').closest('tr');
    expect(within(row2).getByText('Data Migration')).toBeInTheDocument();
    expect(within(row2).getByText('Unassigned')).toBeInTheDocument();
    expect(within(row2).getByText('not_started')).toBeInTheDocument();
  });

  it('links each title to its project', async () => {
    mockList([deliverable1]);
    renderWithAuth(<Deliverables />, { user: viewerUser });

    const link = await screen.findByRole('link', { name: 'Design mockups' });
    expect(link).toHaveAttribute('href', '/projects/10');
  });

  it('shows an error state with a retry when the list request rejects', async () => {
    deliverablesService.listDeliverables.mockRejectedValue(new Error('Service unavailable'));
    renderWithAuth(<Deliverables />, { user: viewerUser });

    expect(await screen.findByText('Service unavailable')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
  });

  it('shows an empty state when no deliverables come back', async () => {
    mockList([]);
    renderWithAuth(<Deliverables />, { user: viewerUser });
    expect(await screen.findByText('No deliverables found')).toBeInTheDocument();
  });

  it('flags a non-completed deliverable whose due date has passed as overdue', async () => {
    mockList([deliverable1, deliverable2, deliverable3]);
    renderWithAuth(<Deliverables />, { user: viewerUser });
    await screen.findByText('Design mockups');

    const overdueRow = screen.getByText('Migrate schema').closest('tr');
    expect(within(overdueRow).getByText('Overdue')).toBeInTheDocument();

    // Future due date — not overdue.
    const futureRow = screen.getByText('Design mockups').closest('tr');
    expect(within(futureRow).queryByText('Overdue')).not.toBeInTheDocument();

    // Past due date but completed — not overdue.
    const completedRow = screen.getByText('Archive old data').closest('tr');
    expect(within(completedRow).queryByText('Overdue')).not.toBeInTheDocument();
  });

  describe('filters', () => {
    it('re-queries with the selected status', async () => {
      const user = userEvent.setup();
      mockList([]);
      renderWithAuth(<Deliverables />, { user: viewerUser });
      await screen.findByText('No deliverables found');
      deliverablesService.listDeliverables.mockClear();

      await user.click(screen.getByLabelText('Status'));
      await user.click(await screen.findByRole('option', { name: 'blocked' }));

      await waitFor(() => {
        expect(deliverablesService.listDeliverables).toHaveBeenCalledWith(
          expect.objectContaining({ status: 'blocked' })
        );
      });
    });

    it('re-queries with the search text', async () => {
      const user = userEvent.setup();
      mockList([]);
      renderWithAuth(<Deliverables />, { user: viewerUser });
      await screen.findByText('No deliverables found');
      deliverablesService.listDeliverables.mockClear();

      await user.type(screen.getByLabelText('Search'), 'schema');

      await waitFor(() => {
        expect(deliverablesService.listDeliverables).toHaveBeenCalledWith(
          expect.objectContaining({ q: 'schema' })
        );
      });
    });

    it('re-queries with the selected project', async () => {
      const user = userEvent.setup();
      mockList([]);
      renderWithAuth(<Deliverables />, { user: viewerUser });
      await screen.findByText('No deliverables found');
      deliverablesService.listDeliverables.mockClear();

      await user.click(screen.getByLabelText('Project'));
      await user.click(await screen.findByRole('option', { name: 'Data Migration' }));

      await waitFor(() => {
        expect(deliverablesService.listDeliverables).toHaveBeenCalledWith(
          expect.objectContaining({ project_id: project2.id })
        );
      });
    });

    it('shows the owner filter only for admins', async () => {
      usersService.listUsers.mockResolvedValue({
        users: [{ id: 4, name: 'Tim Team', role: 'team_member', is_active: true }],
      });
      mockList([]);
      renderWithAuth(<Deliverables />, { user: adminUser });
      await screen.findByText('No deliverables found');

      expect(await screen.findByLabelText('Owner')).toBeInTheDocument();
    });

    it('does not request users or show the owner filter for non-admins', async () => {
      mockList([]);
      renderWithAuth(<Deliverables />, { user: memberUser });
      await screen.findByText('No deliverables found');

      expect(usersService.listUsers).not.toHaveBeenCalled();
      expect(screen.queryByLabelText('Owner')).not.toBeInTheDocument();
    });
  });

  describe('inline status updates', () => {
    it('lets a team member change the status of a deliverable they own', async () => {
      const user = userEvent.setup();
      mockList([deliverable1]);
      renderWithAuth(<Deliverables />, { user: memberUser });
      await screen.findByText('Design mockups');

      const row = screen.getByText('Design mockups').closest('tr');
      expect(
        within(row).getByRole('combobox', { name: 'Status for Design mockups' })
      ).toBeInTheDocument();

      await user.click(within(row).getByRole('combobox'));
      await user.click(await screen.findByRole('option', { name: 'completed' }));

      await waitFor(() => {
        expect(deliverablesService.updateDeliverable).toHaveBeenCalledWith(deliverable1.id, {
          status: 'completed',
        });
      });
      expect(within(row).getByRole('combobox')).toHaveTextContent('completed');
    });

    it('does not let a team member change a deliverable owned by someone else', async () => {
      mockList([deliverable3]);
      renderWithAuth(<Deliverables />, { user: memberUser });
      await screen.findByText('Archive old data');

      const row = screen.getByText('Archive old data').closest('tr');
      expect(within(row).queryByRole('combobox')).not.toBeInTheDocument();
      expect(within(row).getByText('completed')).toBeInTheDocument();
    });

    it('lets the project manager of the deliverable’s project change its status', async () => {
      mockList([deliverable1, deliverable3]);
      renderWithAuth(<Deliverables />, { user: pmUser });
      await screen.findByText('Design mockups');

      // Manages project 10 only.
      const managed = screen.getByText('Design mockups').closest('tr');
      expect(within(managed).getByRole('combobox')).toBeInTheDocument();

      const notManaged = screen.getByText('Archive old data').closest('tr');
      expect(within(notManaged).queryByRole('combobox')).not.toBeInTheDocument();
    });

    it('lets an admin change the status of any deliverable', async () => {
      mockList([deliverable1, deliverable3]);
      renderWithAuth(<Deliverables />, { user: adminUser });
      await screen.findByText('Design mockups');

      expect(
        within(screen.getByText('Archive old data').closest('tr')).getByRole('combobox')
      ).toBeInTheDocument();
    });

    it('shows a read-only chip and no editable control for viewers', async () => {
      mockList([deliverable1, deliverable2]);
      renderWithAuth(<Deliverables />, { user: viewerUser });
      await screen.findByText('Design mockups');

      const row = screen.getByText('Design mockups').closest('tr');
      expect(within(row).queryByRole('combobox')).not.toBeInTheDocument();
      expect(within(row).getByText('in_progress')).toBeInTheDocument();
    });

    it('surfaces an error when the status update fails', async () => {
      const user = userEvent.setup();
      mockList([deliverable1]);
      deliverablesService.updateDeliverable.mockRejectedValue(new Error('Closed project'));
      renderWithAuth(<Deliverables />, { user: adminUser });
      await screen.findByText('Design mockups');

      const row = screen.getByText('Design mockups').closest('tr');
      await user.click(within(row).getByRole('combobox'));
      await user.click(await screen.findByRole('option', { name: 'blocked' }));

      expect(await screen.findByText('Closed project')).toBeInTheDocument();
    });
  });

  it('offers a CSV export once there are rows', async () => {
    mockList([deliverable1]);
    renderWithAuth(<Deliverables />, { user: viewerUser });
    await screen.findByText('Design mockups');

    expect(screen.getByRole('button', { name: /Export/ })).toBeEnabled();
  });
});
