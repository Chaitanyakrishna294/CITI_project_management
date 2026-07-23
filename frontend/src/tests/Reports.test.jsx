import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithAuth, screen, waitFor, within } from '../test/test-utils';
import Reports from '../pages/Reports';
import * as projectsService from '../services/projectsService';
import * as budgetsService from '../services/budgetsService';
import * as resourcesService from '../services/resourcesService';
import * as deliverablesService from '../services/deliverablesService';

vi.mock('../services/projectsService');
vi.mock('../services/budgetsService');
vi.mock('../services/resourcesService');
vi.mock('../services/deliverablesService');

const adminUser = { id: 1, name: 'Ada Admin', role: 'admin' };

// Dates are deliberately far past / far future so the flag assertions do not
// depend on when the suite runs.
const projects = [
  {
    id: 10,
    name: 'Website Revamp',
    manager_id: 2,
    manager_name: 'Pat Manager',
    department: 'Marketing',
    status: 'active',
    start_date: '2026-01-01',
    end_date: '2099-12-31',
  },
  {
    id: 11,
    name: 'Data Migration',
    manager_id: 3,
    manager_name: 'Other Manager',
    department: 'IT',
    status: 'active',
    start_date: '1999-01-01',
    end_date: '2000-01-01',
  },
  {
    id: 12,
    name: 'Mobile App',
    manager_id: 2,
    manager_name: 'Pat Manager',
    department: 'IT',
    status: 'delayed',
    start_date: '2026-02-01',
    end_date: '2099-12-31',
  },
];

const budgets = [
  {
    id: 1,
    project_id: 10,
    project_name: 'Website Revamp',
    planned_amount: '200000.00',
    actual_spend: '50000.00',
    remaining_amount: '150000.00',
    currency: 'USD',
  },
  {
    id: 2,
    project_id: 11,
    project_name: 'Data Migration',
    planned_amount: '90000.00',
    actual_spend: '120000.00',
    remaining_amount: '-30000.00',
    currency: 'USD',
  },
];

// '100.00' > '80.00' is false as strings and true as numbers — these rows fail
// unless the page coerces the NUMERIC columns first.
const resources = [
  {
    id: 1,
    user_id: 5,
    user_name: 'Rita Resource',
    title: 'Engineer',
    department: 'IT',
    weekly_capacity: '80.00',
    total_allocation_pct: '100.00',
  },
  {
    id: 2,
    user_id: 6,
    user_name: 'Sam Steady',
    title: 'Analyst',
    department: 'Finance',
    weekly_capacity: '100.00',
    total_allocation_pct: '60.00',
  },
];

const deliverables = [
  { id: 100, project_id: 10, title: 'Design Mockups', owner_id: 5, owner_name: 'Tom Team', status: 'completed', due_date: '2000-05-01' },
  { id: 101, project_id: 10, title: 'API Integration', owner_id: 5, owner_name: 'Tom Team', status: 'in_progress', due_date: '2000-06-01' },
  { id: 102, project_id: 11, title: 'Schema Draft', owner_id: null, owner_name: null, status: 'not_started', due_date: '2099-01-01' },
];

function mockAll({
  projects: p = projects,
  budgets: b = budgets,
  resources: r = resources,
  deliverables: d = deliverables,
} = {}) {
  projectsService.listProjects.mockResolvedValue({ projects: p });
  budgetsService.listBudgets.mockResolvedValue({ budgets: b });
  resourcesService.listResources.mockResolvedValue({ resources: r });
  deliverablesService.listDeliverables.mockResolvedValue({ deliverables: d });
}

function row(text) {
  return screen.getByText(text).closest('tr');
}

async function openTab(user, name) {
  await user.click(screen.getByRole('tab', { name }));
}

beforeEach(() => {
  vi.clearAllMocks();
  mockAll({ projects: [], budgets: [], resources: [], deliverables: [] });
});

describe('Reports page', () => {
  it('renders the heading and a tab per report', async () => {
    mockAll();
    renderWithAuth(<Reports />, { user: adminUser });

    expect(screen.getByRole('heading', { name: 'Reports', level: 1 })).toBeInTheDocument();
    expect(await screen.findByText('Website Revamp')).toBeInTheDocument();

    ['Project Status', 'Budget Utilisation', 'Resource Utilisation', 'Deliverable Status'].forEach((name) => {
      expect(screen.getByRole('tab', { name })).toBeInTheDocument();
    });
    expect(screen.getByRole('button', { name: 'Export' })).toBeInTheDocument();
  });

  it('shows a skeleton loading state while the reports are being fetched', () => {
    const pending = new Promise(() => {});
    projectsService.listProjects.mockReturnValue(pending);
    budgetsService.listBudgets.mockReturnValue(pending);
    resourcesService.listResources.mockReturnValue(pending);
    deliverablesService.listDeliverables.mockReturnValue(pending);

    renderWithAuth(<Reports />, { user: adminUser });
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('shows an error state when the projects request rejects', async () => {
    mockAll();
    projectsService.listProjects.mockRejectedValue(new Error('Reports API is down'));
    renderWithAuth(<Reports />, { user: adminUser });

    expect(await screen.findByText('Reports API is down')).toBeInTheDocument();
    expect(screen.getByText('Something went wrong')).toBeInTheDocument();
  });

  it('shows an empty state when there is nothing to report', async () => {
    renderWithAuth(<Reports />, { user: adminUser });
    expect(await screen.findByText('No projects to report')).toBeInTheDocument();
  });

  describe('project status report', () => {
    it('renders a row per project with manager, department, status and dates', async () => {
      mockAll();
      renderWithAuth(<Reports />, { user: adminUser });
      await screen.findByText('Website Revamp');

      const first = row('Website Revamp');
      expect(within(first).getByText('Pat Manager')).toBeInTheDocument();
      expect(within(first).getByText('Marketing')).toBeInTheDocument();
      expect(within(first).getByText('active')).toBeInTheDocument();
      expect(within(first).getByText('2026-01-01')).toBeInTheDocument();
      expect(within(first).getByText('2099-12-31')).toBeInTheDocument();

      expect(screen.getByText('Data Migration')).toBeInTheDocument();
      expect(screen.getByText('Mobile App')).toBeInTheDocument();
    });

    it('counts deliverables and computes percent complete per project', async () => {
      mockAll();
      renderWithAuth(<Reports />, { user: adminUser });
      await screen.findByText('Website Revamp');

      // Project 10 has two deliverables, one of them completed.
      const first = row('Website Revamp');
      expect(within(first).getByText('2')).toBeInTheDocument();
      expect(within(first).getByText('50%')).toBeInTheDocument();

      const second = row('Data Migration');
      expect(within(second).getByText('1')).toBeInTheDocument();
      expect(within(second).getByText('0%')).toBeInTheDocument();
    });

    it('flags delayed projects and active projects past their end date as at risk', async () => {
      mockAll();
      renderWithAuth(<Reports />, { user: adminUser });
      await screen.findByText('Website Revamp');

      expect(within(row('Data Migration')).getByText('At Risk')).toBeInTheDocument();
      expect(within(row('Mobile App')).getByText('At Risk')).toBeInTheDocument();
      expect(within(row('Website Revamp')).queryByText('At Risk')).not.toBeInTheDocument();
    });
  });

  describe('budget utilisation report', () => {
    it('renders utilisation and flags budgets whose spend exceeds the plan', async () => {
      const user = userEvent.setup();
      mockAll();
      renderWithAuth(<Reports />, { user: adminUser });
      await screen.findByText('Website Revamp');

      await openTab(user, 'Budget Utilisation');

      expect(await screen.findByRole('heading', { name: 'Budget Utilisation' })).toBeInTheDocument();

      const over = row('Data Migration');
      expect(within(over).getByText('133%')).toBeInTheDocument();
      expect(within(over).getByText('Over Budget')).toBeInTheDocument();

      const under = row('Website Revamp');
      expect(within(under).getByText('25%')).toBeInTheDocument();
      expect(within(under).queryByText('Over Budget')).not.toBeInTheDocument();
    });

    it('shows an empty state when no budgets exist', async () => {
      const user = userEvent.setup();
      mockAll({ budgets: [] });
      renderWithAuth(<Reports />, { user: adminUser });
      await screen.findByText('Website Revamp');

      await openTab(user, 'Budget Utilisation');
      expect(await screen.findByText('No budgets to report')).toBeInTheDocument();
    });
  });

  describe('resource utilisation report', () => {
    it('flags resources allocated beyond their weekly capacity', async () => {
      const user = userEvent.setup();
      mockAll();
      renderWithAuth(<Reports />, { user: adminUser });
      await screen.findByText('Website Revamp');

      await openTab(user, 'Resource Utilisation');

      const over = await screen.findByText('Rita Resource');
      const overRow = over.closest('tr');
      expect(within(overRow).getByText('Engineer')).toBeInTheDocument();
      expect(within(overRow).getByText('80%')).toBeInTheDocument();
      expect(within(overRow).getByText('100%')).toBeInTheDocument();
      expect(within(overRow).getByText('Over-allocated')).toBeInTheDocument();

      const okRow = row('Sam Steady');
      expect(within(okRow).getByText('60%')).toBeInTheDocument();
      expect(within(okRow).queryByText('Over-allocated')).not.toBeInTheDocument();
    });
  });

  describe('deliverable status report', () => {
    it('joins the project name and flags incomplete deliverables past their due date', async () => {
      const user = userEvent.setup();
      mockAll();
      renderWithAuth(<Reports />, { user: adminUser });
      await screen.findByText('Website Revamp');

      await openTab(user, 'Deliverable Status');

      const overdue = (await screen.findByText('API Integration')).closest('tr');
      expect(within(overdue).getByText('Website Revamp')).toBeInTheDocument();
      expect(within(overdue).getByText('Tom Team')).toBeInTheDocument();
      expect(within(overdue).getByText('2000-06-01')).toBeInTheDocument();
      expect(within(overdue).getByText('Overdue')).toBeInTheDocument();

      // Completed deliverables are never overdue, even with a past due date.
      expect(within(row('Design Mockups')).queryByText('Overdue')).not.toBeInTheDocument();

      const future = row('Schema Draft');
      expect(within(future).getByText('Unassigned')).toBeInTheDocument();
      expect(within(future).queryByText('Overdue')).not.toBeInTheDocument();
    });
  });

  describe('filters', () => {
    it('re-queries listProjects with date_from and date_to when the range changes', async () => {
      const user = userEvent.setup();
      mockAll();
      renderWithAuth(<Reports />, { user: adminUser });
      await screen.findByText('Website Revamp');
      projectsService.listProjects.mockClear();

      await user.type(screen.getByLabelText('From'), '2026-01-01');
      await user.type(screen.getByLabelText('To'), '2026-03-01');

      await waitFor(() => {
        expect(projectsService.listProjects).toHaveBeenCalledWith(
          expect.objectContaining({ date_from: '2026-01-01', date_to: '2026-03-01' })
        );
      });
    });

    it('narrows the deliverable report by due date on the client', async () => {
      const user = userEvent.setup();
      mockAll();
      renderWithAuth(<Reports />, { user: adminUser });
      await screen.findByText('Website Revamp');

      await openTab(user, 'Deliverable Status');
      await screen.findByText('API Integration');

      await user.type(screen.getByLabelText('From'), '2000-06-01');

      await waitFor(() => {
        expect(screen.queryByText('Design Mockups')).not.toBeInTheDocument();
      });
      expect(screen.getByText('API Integration')).toBeInTheDocument();
      expect(screen.getByText('Schema Draft')).toBeInTheDocument();
    });

    it('re-queries projects and resources with the selected department', async () => {
      const user = userEvent.setup();
      mockAll();
      renderWithAuth(<Reports />, { user: adminUser });
      await screen.findByText('Website Revamp');
      projectsService.listProjects.mockClear();
      resourcesService.listResources.mockClear();

      await user.type(screen.getByLabelText('Department'), 'IT');

      await waitFor(() => {
        expect(projectsService.listProjects).toHaveBeenCalledWith(
          expect.objectContaining({ department: 'IT' })
        );
      });
      expect(resourcesService.listResources).toHaveBeenCalledWith({ department: 'IT' });
    });
  });
});
