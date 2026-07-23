import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithAuth, screen, waitFor, within } from '../test/test-utils';
import Individuals from '../pages/Individuals';
import * as teamsService from '../services/teamsService';

vi.mock('../services/teamsService');

const adminUser = { id: 1, name: 'Ada Admin', role: 'admin' };
const viewerUser = { id: 2, name: 'Vic Viewer', role: 'viewer' };

const alice = {
  id: 11,
  name: 'Alice Berlin',
  email: 'alice@example.com',
  location: 'Berlin',
  is_direct_staff: true,
  is_org_leader: true,
  metadata: {},
};
const bob = {
  id: 12,
  name: 'Bob Austin',
  email: 'bob@example.com',
  location: 'Austin',
  is_direct_staff: false,
  is_org_leader: false,
  metadata: { skills: 'SQL' },
};

beforeEach(() => {
  vi.clearAllMocks();
  teamsService.listIndividuals.mockResolvedValue({ individuals: [alice, bob] });
});

describe('Individuals page', () => {
  it('renders a row per individual with location, staff type and org-leader flag', async () => {
    renderWithAuth(<Individuals />, { user: adminUser });

    await screen.findByText('Alice Berlin');
    const row1 = screen.getByText('Alice Berlin').closest('tr');
    expect(within(row1).getByText('Berlin')).toBeInTheDocument();
    expect(within(row1).getByText('Direct')).toBeInTheDocument();
    expect(within(row1).getByText('Org leader')).toBeInTheDocument();

    const row2 = screen.getByText('Bob Austin').closest('tr');
    expect(within(row2).getByText('Non-direct')).toBeInTheDocument();
  });

  it('shows the empty state when there are no individuals', async () => {
    teamsService.listIndividuals.mockResolvedValue({ individuals: [] });
    renderWithAuth(<Individuals />, { user: adminUser });
    expect(await screen.findByText('No individuals yet')).toBeInTheDocument();
  });

  it('hides all management controls from viewers', async () => {
    renderWithAuth(<Individuals />, { user: viewerUser });
    await screen.findByText('Alice Berlin');

    expect(screen.queryByRole('button', { name: 'Add individual' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });

  it('creates an individual with metadata and confirms with a toast', async () => {
    const user = userEvent.setup();
    teamsService.createIndividual.mockResolvedValue({ individual: { id: 20 } });
    renderWithAuth(<Individuals />, { user: adminUser });
    await screen.findByText('Alice Berlin');

    await user.click(screen.getByRole('button', { name: 'Add individual' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add an individual' });

    await user.type(within(dialog).getByLabelText('Full name *'), 'Nia Park');
    await user.type(within(dialog).getByLabelText('Location *'), 'Tokyo');
    await user.click(within(dialog).getByRole('checkbox', { name: 'Direct staff (employee)' }));

    await user.click(within(dialog).getByRole('button', { name: 'Add field' }));
    await user.type(within(dialog).getByLabelText('Key'), 'skills');
    await user.type(within(dialog).getByLabelText('Value'), 'Terraform');

    teamsService.listIndividuals.mockClear();
    await user.click(within(dialog).getByRole('button', { name: 'Add individual' }));

    await waitFor(() => {
      expect(teamsService.createIndividual).toHaveBeenCalledWith({
        name: 'Nia Park',
        email: null,
        location: 'Tokyo',
        is_direct_staff: false,
        is_org_leader: false,
        metadata: { skills: 'Terraform' },
      });
    });
    expect(teamsService.listIndividuals).toHaveBeenCalled();
    expect(await screen.findByText('Nia Park added')).toBeInTheDocument();
  });

  it('shows an error and stays open when the create is rejected', async () => {
    const user = userEvent.setup();
    teamsService.createIndividual.mockRejectedValue(new Error('An individual with this email already exists'));
    renderWithAuth(<Individuals />, { user: adminUser });
    await screen.findByText('Alice Berlin');

    await user.click(screen.getByRole('button', { name: 'Add individual' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add an individual' });
    await user.type(within(dialog).getByLabelText('Full name *'), 'Dup');
    await user.type(within(dialog).getByLabelText('Location *'), 'Berlin');
    await user.click(within(dialog).getByRole('button', { name: 'Add individual' }));

    expect(await screen.findByText('An individual with this email already exists')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Add an individual' })).toBeInTheDocument();
  });

  it('edits an individual with pre-filled values', async () => {
    const user = userEvent.setup();
    teamsService.updateIndividual.mockResolvedValue({ individual: bob });
    renderWithAuth(<Individuals />, { user: adminUser });
    await screen.findByText('Bob Austin');

    const row = screen.getByText('Bob Austin').closest('tr');
    await user.click(within(row).getByRole('button', { name: 'Edit' }));
    const dialog = await screen.findByRole('dialog', { name: 'Edit individual' });

    expect(within(dialog).getByLabelText('Full name *')).toHaveValue('Bob Austin');
    expect(within(dialog).getByLabelText('Key')).toHaveValue('skills');

    const locationField = within(dialog).getByLabelText('Location *');
    await user.clear(locationField);
    await user.type(locationField, 'Denver');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));

    await waitFor(() => {
      expect(teamsService.updateIndividual).toHaveBeenCalledWith(bob.id, {
        name: 'Bob Austin',
        email: 'bob@example.com',
        location: 'Denver',
        is_direct_staff: false,
        is_org_leader: false,
        metadata: { skills: 'SQL' },
      });
    });
  });

  it('deletes via the ConfirmDialog', async () => {
    const user = userEvent.setup();
    teamsService.deleteIndividual.mockResolvedValue({ deleted: true });
    renderWithAuth(<Individuals />, { user: adminUser });
    await screen.findByText('Alice Berlin');

    const row = screen.getByText('Alice Berlin').closest('tr');
    await user.click(within(row).getByRole('button', { name: 'Delete' }));

    const dialog = await screen.findByRole('dialog', { name: 'Delete Alice Berlin?' });
    teamsService.listIndividuals.mockClear();
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(teamsService.deleteIndividual).toHaveBeenCalledWith(alice.id);
    });
    expect(teamsService.listIndividuals).toHaveBeenCalled();
  });
});
