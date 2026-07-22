import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithAuth, screen } from '../test/test-utils';
import BudgetPanel from './BudgetPanel';

vi.mock('../services/budgetsService');

import * as budgetsService from '../services/budgetsService';

const project = { id: 1, manager_id: 5, name: 'X' };

function renderPanel(user) {
  return renderWithAuth(<BudgetPanel project={project} />, { user });
}

describe('BudgetPanel', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('shows the info alert when the budget is not found', async () => {
    budgetsService.getBudget.mockRejectedValue(new Error('Budget not found'));
    renderPanel({ id: 99, role: 'team_member' });

    expect(await screen.findByText('No budget has been set for this project yet.')).toBeInTheDocument();
  });

  it('shows "Set Budget" for the project\'s own manager', async () => {
    budgetsService.getBudget.mockRejectedValue(new Error('Budget not found'));
    renderPanel({ id: 5, role: 'project_manager' });

    await screen.findByText('No budget has been set for this project yet.');
    expect(screen.getByRole('button', { name: 'Set Budget' })).toBeInTheDocument();
  });

  it('does not show "Set Budget" for a non-manager/non-admin/non-finance user', async () => {
    budgetsService.getBudget.mockRejectedValue(new Error('Budget not found'));
    renderPanel({ id: 99, role: 'team_member' });

    await screen.findByText('No budget has been set for this project yet.');
    expect(screen.queryByRole('button', { name: 'Set Budget' })).not.toBeInTheDocument();
  });

  it('shows an error alert (not the no-budget state) for a generic rejection', async () => {
    budgetsService.getBudget.mockRejectedValue(new Error('Server exploded'));
    renderPanel({ id: 5, role: 'project_manager' });

    expect(await screen.findByText('Server exploded')).toBeInTheDocument();
    expect(screen.queryByText('No budget has been set for this project yet.')).not.toBeInTheDocument();
  });

  it('renders planned/spent/remaining amounts once a budget loads', async () => {
    budgetsService.getBudget.mockResolvedValue({
      budget: { currency: 'USD', planned_amount: 1000, actual_spend: 400, remaining_amount: 600 },
    });
    renderPanel({ id: 5, role: 'project_manager' });

    expect(await screen.findByText('USD 1,000')).toBeInTheDocument();
    expect(screen.getByText('USD 400')).toBeInTheDocument();
    expect(screen.getByText('USD 600')).toBeInTheDocument();
  });

  it('caps the progress bar at 100 but still shows the Over budget chip when spent > planned', async () => {
    budgetsService.getBudget.mockResolvedValue({
      budget: { currency: 'USD', planned_amount: 1000, actual_spend: 1500, remaining_amount: -500 },
    });
    renderPanel({ id: 5, role: 'project_manager' });

    await screen.findByText('USD 1,500');
    const progressbar = screen.getByRole('progressbar');
    expect(progressbar).toHaveAttribute('aria-valuenow', '100');
    expect(screen.getByText('Over budget')).toBeInTheDocument();
  });

  it('submits "Set Budget" with the right payload and reloads', async () => {
    const user = userEvent.setup();
    budgetsService.getBudget
      .mockRejectedValueOnce(new Error('Budget not found'))
      .mockResolvedValueOnce({
        budget: { currency: 'USD', planned_amount: 2000, actual_spend: 0, remaining_amount: 2000 },
      });
    budgetsService.createBudget.mockResolvedValue({});

    renderPanel({ id: 5, role: 'project_manager' });

    await screen.findByText('No budget has been set for this project yet.');
    await user.click(screen.getByRole('button', { name: 'Set Budget' }));

    const input = await screen.findByLabelText(/Planned Amount \(USD\)/);
    await user.type(input, '2000');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await screen.findByText('Planned Budget');
    expect(screen.getAllByText('USD 2,000').length).toBeGreaterThan(0);
    expect(budgetsService.createBudget).toHaveBeenCalledWith({ project_id: project.id, planned_amount: '2000' });
    expect(budgetsService.getBudget).toHaveBeenCalledTimes(2);
  });

  it('"Record Expense" visibility follows canManage, and submitting coerces amount to a Number', async () => {
    const user = userEvent.setup();
    budgetsService.getBudget.mockResolvedValue({
      budget: { currency: 'USD', planned_amount: 1000, actual_spend: 200, remaining_amount: 800 },
    });
    budgetsService.recordExpense.mockResolvedValue({});

    renderPanel({ id: 5, role: 'project_manager' });

    const recordBtn = await screen.findByRole('button', { name: 'Record Expense' });
    await user.click(recordBtn);

    await user.type(screen.getByLabelText(/^Amount/), '150');
    await user.type(screen.getByLabelText('Description'), 'Software license');
    await user.click(screen.getByRole('button', { name: 'Save' }));

    await screen.findByText('USD 1,000');
    expect(budgetsService.recordExpense).toHaveBeenCalledWith(project.id, 150, 'Software license');
    expect(typeof budgetsService.recordExpense.mock.calls[0][1]).toBe('number');
  });

  it('does not show "Record Expense" for a user who cannot manage the budget', async () => {
    budgetsService.getBudget.mockResolvedValue({
      budget: { currency: 'USD', planned_amount: 1000, actual_spend: 200, remaining_amount: 800 },
    });
    renderPanel({ id: 99, role: 'team_member' });

    await screen.findByText('USD 1,000');
    expect(screen.queryByRole('button', { name: 'Record Expense' })).not.toBeInTheDocument();
  });
});
