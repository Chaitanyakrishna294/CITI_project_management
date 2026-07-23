import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithAuth, screen, within } from '../test/test-utils';
import Dashboard from '../pages/Dashboard';

vi.mock('../services/projectsService');
vi.mock('../services/budgetsService');
vi.mock('../services/resourcesService');
vi.mock('../services/deliverablesService');

import * as projectsService from '../services/projectsService';
import * as budgetsService from '../services/budgetsService';
import * as resourcesService from '../services/resourcesService';
import * as deliverablesService from '../services/deliverablesService';

const user = { id: 1, name: 'Jamie Doe', role: 'admin' };

function isoOffset(days) {
  return new Date(Date.now() + days * 86400000).toISOString().slice(0, 10);
}

function renderDashboard() {
  return renderWithAuth(<Dashboard />, { user });
}

describe('Dashboard', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('shows skeleton loaders while loading', () => {
    projectsService.listProjects.mockReturnValue(new Promise(() => {}));
    budgetsService.listBudgets.mockReturnValue(new Promise(() => {}));
    resourcesService.listResources.mockReturnValue(new Promise(() => {}));
    deliverablesService.listDeliverables.mockReturnValue(new Promise(() => {}));

    renderDashboard();
    // req/UI_UX §15 specifies skeleton loaders for the loading state.
    expect(screen.getByRole('status', { name: 'Loading dashboard' })).toBeInTheDocument();
    expect(screen.queryByText('Welcome back, Jamie Doe (admin)')).not.toBeInTheDocument();
  });

  it('offers a retry from the error state that re-issues the request', async () => {
    const interaction = userEvent.setup();
    projectsService.listProjects.mockRejectedValue(new Error('projects failed to load'));
    budgetsService.listBudgets.mockResolvedValue({ budgets: [] });
    resourcesService.listResources.mockResolvedValue({ resources: [] });
    deliverablesService.listDeliverables.mockResolvedValue({ deliverables: [] });

    renderDashboard();
    await screen.findByText('projects failed to load');

    projectsService.listProjects.mockResolvedValue({ projects: [] });
    await interaction.click(screen.getByRole('button', { name: /retry/i }));

    await screen.findByText('Welcome back, Jamie Doe (admin)');
    expect(projectsService.listProjects).toHaveBeenCalledTimes(2);
  });

  it('shows an error alert when projectsService.listProjects rejects', async () => {
    projectsService.listProjects.mockRejectedValue(new Error('projects failed to load'));
    budgetsService.listBudgets.mockResolvedValue({ budgets: [] });
    resourcesService.listResources.mockResolvedValue({ resources: [] });
    deliverablesService.listDeliverables.mockResolvedValue({ deliverables: [] });

    renderDashboard();

    const alert = await screen.findByText('projects failed to load');
    expect(alert).toBeInTheDocument();
  });

  it('still renders successfully with empty sections when budgets/resources/deliverables reject', async () => {
    projectsService.listProjects.mockResolvedValue({
      projects: [
        { id: 1, name: 'Alpha', status: 'active', manager_name: 'Mgr', end_date: isoOffset(10) },
      ],
    });
    budgetsService.listBudgets.mockRejectedValue(new Error('budgets down'));
    resourcesService.listResources.mockRejectedValue(new Error('resources down'));
    deliverablesService.listDeliverables.mockRejectedValue(new Error('deliverables down'));

    renderDashboard();

    // page renders successfully (no page-level error alert)
    await screen.findByText('Dashboard');
    const activeCard = screen.getByText('Active Projects').closest('div');
    expect(within(activeCard).getByText('1')).toBeInTheDocument(); // active projects count
    const budgetCard = screen.getByText('Budget Utilization').closest('div');
    expect(within(budgetCard).getByText('0%')).toBeInTheDocument(); // budget utilization falls back to 0
    expect(screen.getByText('No upcoming deliverable deadlines.')).toBeInTheDocument();
    expect(screen.queryByText(/failed/i)).not.toBeInTheDocument();
  });

  it('computes active/completed/at-risk project counts correctly', async () => {
    projectsService.listProjects.mockResolvedValue({
      projects: [
        { id: 1, name: 'Delayed Proj', status: 'delayed', manager_name: 'Mgr A', end_date: isoOffset(20) },
        { id: 2, name: 'Past Due Active', status: 'active', manager_name: 'Mgr B', end_date: isoOffset(-5) },
        { id: 3, name: 'On Track Active', status: 'active', manager_name: 'Mgr C', end_date: isoOffset(20) },
        { id: 4, name: 'Done Proj', status: 'completed', manager_name: 'Mgr D', end_date: isoOffset(-30) },
      ],
    });
    budgetsService.listBudgets.mockResolvedValue({ budgets: [] });
    resourcesService.listResources.mockResolvedValue({ resources: [] });
    deliverablesService.listDeliverables.mockResolvedValue({ deliverables: [] });

    renderDashboard();

    await screen.findByText('Dashboard');

    // Active Projects: Past Due Active + On Track Active = 2
    const activeCard = screen.getByText('Active Projects').closest('div');
    expect(within(activeCard).getByText('2')).toBeInTheDocument();
    expect(within(activeCard).getByText('1 completed')).toBeInTheDocument();

    // Projects at Risk: Delayed Proj + Past Due Active = 2
    // "Projects at Risk" appears both as the stat card heading and the list card heading;
    // the stat card is the first occurrence in the DOM.
    const [riskStatHeading] = screen.getAllByText('Projects at Risk');
    const riskCard = riskStatHeading.closest('div');
    expect(within(riskCard).getByText('2')).toBeInTheDocument();

    // At-risk list contains only the two at-risk projects, linked correctly
    const riskListItem1 = screen.getByRole('link', { name: 'Delayed Proj' });
    const riskListItem2 = screen.getByRole('link', { name: 'Past Due Active' });
    expect(riskListItem1).toHaveAttribute('href', '/projects/1');
    expect(riskListItem2).toHaveAttribute('href', '/projects/2');
    expect(screen.queryByRole('link', { name: 'On Track Active' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Done Proj' })).not.toBeInTheDocument();
  });

  it('caps budget utilization at 100% when spend exceeds the plan', async () => {
    projectsService.listProjects.mockResolvedValue({ projects: [] });
    budgetsService.listBudgets.mockResolvedValue({
      budgets: [{ id: 1, planned_amount: 1000, actual_spend: 1500 }],
    });
    resourcesService.listResources.mockResolvedValue({ resources: [] });
    deliverablesService.listDeliverables.mockResolvedValue({ deliverables: [] });

    renderDashboard();

    await screen.findByText('Dashboard');
    expect(screen.getByText('100%')).toBeInTheDocument();
    expect(screen.queryByText('150%')).not.toBeInTheDocument();
  });

  it('shows at most 5 upcoming deadlines, excluding completed and past-due items, sorted ascending', async () => {
    projectsService.listProjects.mockResolvedValue({ projects: [] });
    budgetsService.listBudgets.mockResolvedValue({ budgets: [] });
    resourcesService.listResources.mockResolvedValue({ resources: [] });
    deliverablesService.listDeliverables.mockResolvedValue({
      deliverables: [
        { id: 1, title: 'Due in 6 (6th, should be excluded)', status: 'in_progress', due_date: isoOffset(6), owner_name: 'A' },
        { id: 2, title: 'Due in 5', status: 'in_progress', due_date: isoOffset(5), owner_name: 'B' },
        { id: 3, title: 'Due in 4', status: 'in_progress', due_date: isoOffset(4), owner_name: 'C' },
        { id: 4, title: 'Due in 3', status: 'in_progress', due_date: isoOffset(3), owner_name: 'D' },
        { id: 5, title: 'Due in 2', status: 'in_progress', due_date: isoOffset(2), owner_name: 'E' },
        { id: 6, title: 'Due in 1', status: 'in_progress', due_date: isoOffset(1), owner_name: 'F' },
        { id: 7, title: 'Completed but due soon', status: 'completed', due_date: isoOffset(1), owner_name: 'G' },
        { id: 8, title: 'Past due', status: 'in_progress', due_date: isoOffset(-1), owner_name: 'H' },
      ],
    });

    renderDashboard();

    await screen.findByText('Dashboard');

    const deadlinesHeading = screen.getByText('Upcoming Deadlines');
    const deadlinesCard = deadlinesHeading.closest('div');
    const items = within(deadlinesCard).getAllByRole('listitem');

    expect(items).toHaveLength(5);
    // sorted ascending: Due in 1..Due in 5 (Due in 6 excluded, sliced out)
    expect(items[0]).toHaveTextContent('Due in 1');
    expect(items[1]).toHaveTextContent('Due in 2');
    expect(items[2]).toHaveTextContent('Due in 3');
    expect(items[3]).toHaveTextContent('Due in 4');
    expect(items[4]).toHaveTextContent('Due in 5');
    expect(within(deadlinesCard).queryByText(/Due in 6/)).not.toBeInTheDocument();
    expect(within(deadlinesCard).queryByText('Completed but due soon')).not.toBeInTheDocument();
    expect(within(deadlinesCard).queryByText('Past due')).not.toBeInTheDocument();
  });
});

describe('Dashboard attention tier', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('surfaces at-risk projects, over-allocation and over-budget above the KPIs', async () => {
    projectsService.listProjects.mockResolvedValue({
      projects: [
        { id: 1, name: 'Late Project', status: 'delayed', manager_name: 'Priya', end_date: isoOffset(-3) },
        { id: 2, name: 'Healthy Project', status: 'active', manager_name: 'Marco', end_date: isoOffset(30) },
      ],
    });
    budgetsService.listBudgets.mockResolvedValue({
      budgets: [
        { id: 9, project_id: 1, project_name: 'Late Project', planned_amount: '1000.00', actual_spend: '1500.00' },
      ],
    });
    resourcesService.listResources.mockResolvedValue({
      resources: [
        { id: 5, user_name: 'Sam Okafor', total_allocation_pct: '120.00', weekly_capacity: '100.00' },
      ],
    });
    deliverablesService.listDeliverables.mockResolvedValue({ deliverables: [] });

    renderDashboard();
    await screen.findByText('Needs attention');

    const tier = screen.getByText('Needs attention').closest('div');
    expect(within(tier).getByText('Projects at risk · 1')).toBeInTheDocument();
    // Linked from both the at-risk and over-budget columns.
    expect(within(tier).getAllByRole('link', { name: 'Late Project' })).toHaveLength(2);
    expect(within(tier).getByText('Over-allocated people · 1')).toBeInTheDocument();
    expect(within(tier).getByText('Sam Okafor')).toBeInTheDocument();
    expect(within(tier).getByText('Over budget · 1')).toBeInTheDocument();
    expect(within(tier).queryByText('Healthy Project')).not.toBeInTheDocument();
  });

  it('shows the all-clear strip when nothing needs attention', async () => {
    projectsService.listProjects.mockResolvedValue({
      projects: [{ id: 2, name: 'Healthy Project', status: 'active', manager_name: 'Marco', end_date: isoOffset(30) }],
    });
    budgetsService.listBudgets.mockResolvedValue({ budgets: [] });
    resourcesService.listResources.mockResolvedValue({ resources: [] });
    deliverablesService.listDeliverables.mockResolvedValue({ deliverables: [] });

    renderDashboard();
    await screen.findByText(/All clear/);
    expect(screen.queryByText('Needs attention')).not.toBeInTheDocument();
  });
});
