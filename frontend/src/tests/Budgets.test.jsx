import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithAuth, screen, waitFor, within } from '../test/test-utils';
import Budgets from '../pages/Budgets';

vi.mock('../services/budgetsService');

import * as budgetsService from '../services/budgetsService';

const adminUser = { id: 1, name: 'Ada Admin', role: 'admin' };
const financeUser = { id: 4, name: 'Fin Ance', role: 'finance' };
const pmUser = { id: 2, name: 'Pat Manager', role: 'project_manager' };
const viewerUser = { id: 3, name: 'Vera Viewer', role: 'viewer' };

// Numerics arrive as strings from Postgres NUMERIC.
const budgetA = {
  id: 1,
  project_id: 10,
  project_name: 'Website Revamp',
  project_status: 'active',
  manager_id: 2,
  planned_amount: '1000.00',
  actual_spend: '400.00',
  remaining_amount: '600.00',
  currency: 'USD',
};
const budgetB = {
  id: 2,
  project_id: 11,
  project_name: 'Data Migration',
  project_status: 'delayed',
  manager_id: 99,
  planned_amount: '2000.50',
  actual_spend: '2500.50',
  remaining_amount: '-500.00',
  currency: 'USD',
};

function mockList(budgets) {
  budgetsService.listBudgets.mockResolvedValue({ budgets });
}

function rowFor(name) {
  return screen.getByText(name).closest('tr');
}

beforeEach(() => {
  vi.clearAllMocks();
  budgetsService.listBudgets.mockResolvedValue({ budgets: [] });
});

describe('Budgets page', () => {
  it('shows a loading state while the request is in flight', () => {
    budgetsService.listBudgets.mockReturnValue(new Promise(() => {}));
    renderWithAuth(<Budgets />, { user: viewerUser });

    expect(screen.getByRole('heading', { name: 'Budget Management' })).toBeInTheDocument();
    expect(screen.getByRole('status', { name: 'Loading budgets…' })).toBeInTheDocument();
  });

  it('shows an error state when the request rejects', async () => {
    budgetsService.listBudgets.mockRejectedValue(new Error('Budgets service exploded'));
    renderWithAuth(<Budgets />, { user: viewerUser });

    expect(await screen.findByText('Could not load budgets')).toBeInTheDocument();
    expect(screen.getByText('Budgets service exploded')).toBeInTheDocument();
  });

  it('shows an empty state when no budgets exist', async () => {
    mockList([]);
    renderWithAuth(<Budgets />, { user: viewerUser });

    expect(await screen.findByText('No budgets yet')).toBeInTheDocument();
    expect(screen.queryByText('Total Planned')).not.toBeInTheDocument();
  });

  it('computes the KPI totals from the string numerics', async () => {
    mockList([budgetA, budgetB]);
    renderWithAuth(<Budgets />, { user: viewerUser });

    await screen.findByText('Total Planned');
    expect(screen.getByText('$3,000.50')).toBeInTheDocument(); // planned
    expect(screen.getByText('$2,900.50')).toBeInTheDocument(); // actual spend
    expect(screen.getByText('$100.00')).toBeInTheDocument(); // remaining

    const overCard = screen.getByText('Over Budget').parentElement;
    expect(within(overCard).getByText('1')).toBeInTheDocument();
  });

  it('renders a row per budget with project link, status, amounts and utilisation', async () => {
    mockList([budgetA, budgetB]);
    renderWithAuth(<Budgets />, { user: viewerUser });

    await screen.findByText('Website Revamp');

    const row1 = rowFor('Website Revamp');
    expect(within(row1).getByRole('link', { name: 'Website Revamp' })).toHaveAttribute(
      'href',
      '/projects/10'
    );
    expect(within(row1).getByText('active')).toBeInTheDocument();
    expect(within(row1).getByText('$1,000.00')).toBeInTheDocument();
    expect(within(row1).getByText('$400.00')).toBeInTheDocument();
    expect(within(row1).getByText('$600.00')).toBeInTheDocument();
    expect(within(row1).getByText('40%')).toBeInTheDocument();

    const row2 = rowFor('Data Migration');
    expect(within(row2).getByText('delayed')).toBeInTheDocument();
    expect(within(row2).getByText('-$500.00')).toBeInTheDocument();
    expect(within(row2).getByText('125%')).toBeInTheDocument();
  });

  describe('permissions', () => {
    it('a finance user sees management actions on every row', async () => {
      mockList([budgetA, budgetB]);
      renderWithAuth(<Budgets />, { user: financeUser });

      await screen.findByText('Website Revamp');
      expect(within(rowFor('Website Revamp')).getByRole('button', { name: 'Edit Planned' })).toBeInTheDocument();
      expect(within(rowFor('Data Migration')).getByRole('button', { name: 'Record Expense' })).toBeInTheDocument();
    });

    it('an admin sees management actions on every row', async () => {
      mockList([budgetA, budgetB]);
      renderWithAuth(<Budgets />, { user: adminUser });

      await screen.findByText('Website Revamp');
      expect(screen.getAllByRole('button', { name: 'Edit Planned' })).toHaveLength(2);
    });

    it('a viewer sees no management actions and no Actions column', async () => {
      mockList([budgetA, budgetB]);
      renderWithAuth(<Budgets />, { user: viewerUser });

      await screen.findByText('Website Revamp');
      expect(screen.queryByRole('button', { name: 'Edit Planned' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Record Expense' })).not.toBeInTheDocument();
      expect(screen.queryByRole('columnheader', { name: 'Actions' })).not.toBeInTheDocument();
    });

    it('a project_manager sees actions only on budgets of projects they manage', async () => {
      mockList([budgetA, budgetB]);
      renderWithAuth(<Budgets />, { user: pmUser });

      await screen.findByText('Website Revamp');
      expect(within(rowFor('Website Revamp')).getByRole('button', { name: 'Edit Planned' })).toBeInTheDocument();
      expect(within(rowFor('Data Migration')).queryByRole('button', { name: 'Edit Planned' })).not.toBeInTheDocument();
      expect(within(rowFor('Data Migration')).queryByRole('button', { name: 'Record Expense' })).not.toBeInTheDocument();
    });
  });

  describe('edit planned amount', () => {
    it('rejects a negative amount inline and does not call updateBudget', async () => {
      const user = userEvent.setup();
      mockList([budgetA]);
      renderWithAuth(<Budgets />, { user: financeUser });

      await screen.findByText('Website Revamp');
      await user.click(screen.getByRole('button', { name: 'Edit Planned' }));

      const input = await screen.findByRole('spinbutton', { name: /Planned Amount/ });
      await user.clear(input);
      await user.type(input, '-500');
      await user.click(screen.getByRole('button', { name: 'Save' }));

      expect(await screen.findByText('Budget cannot be negative.')).toBeInTheDocument();
      expect(budgetsService.updateBudget).not.toHaveBeenCalled();
      expect(screen.getByRole('heading', { name: 'Edit Planned Amount' })).toBeInTheDocument();
    });

    it('submits a valid amount as a Number and refreshes the list', async () => {
      const user = userEvent.setup();
      mockList([budgetA]);
      budgetsService.updateBudget.mockResolvedValue({});
      renderWithAuth(<Budgets />, { user: financeUser });

      await screen.findByText('Website Revamp');
      await user.click(screen.getByRole('button', { name: 'Edit Planned' }));

      const input = await screen.findByRole('spinbutton', { name: /Planned Amount/ });
      await user.clear(input);
      await user.type(input, '2500');
      await user.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(budgetsService.updateBudget).toHaveBeenCalledWith(10, { planned_amount: 2500 });
      });
      await waitFor(() => expect(budgetsService.listBudgets).toHaveBeenCalledTimes(2));
      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: 'Edit Planned Amount' })).not.toBeInTheDocument();
      });
    });
  });

  describe('record expense', () => {
    it('rejects a non-positive amount inline and does not call recordExpense', async () => {
      const user = userEvent.setup();
      mockList([budgetA]);
      renderWithAuth(<Budgets />, { user: financeUser });

      await screen.findByText('Website Revamp');
      await user.click(screen.getByRole('button', { name: 'Record Expense' }));

      await user.type(await screen.findByLabelText(/^Amount/), '0');
      await user.click(screen.getByRole('button', { name: 'Save' }));

      expect(await screen.findByText('Expense amount must be a positive number.')).toBeInTheDocument();
      expect(budgetsService.recordExpense).not.toHaveBeenCalled();
    });

    it('records a valid expense and refreshes the list', async () => {
      const user = userEvent.setup();
      mockList([budgetA]);
      budgetsService.recordExpense.mockResolvedValue({});
      renderWithAuth(<Budgets />, { user: financeUser });

      await screen.findByText('Website Revamp');
      await user.click(screen.getByRole('button', { name: 'Record Expense' }));

      await user.type(await screen.findByLabelText(/^Amount/), '150');
      await user.type(screen.getByLabelText('Description'), 'Software license');
      await user.click(screen.getByRole('button', { name: 'Save' }));

      await waitFor(() => {
        expect(budgetsService.recordExpense).toHaveBeenCalledWith(10, 150, 'Software license');
      });
      expect(typeof budgetsService.recordExpense.mock.calls[0][1]).toBe('number');
      await waitFor(() => expect(budgetsService.listBudgets).toHaveBeenCalledTimes(2));
      await waitFor(() => {
        expect(screen.queryByRole('heading', { name: 'Record Expense' })).not.toBeInTheDocument();
      });
    });
  });
});
