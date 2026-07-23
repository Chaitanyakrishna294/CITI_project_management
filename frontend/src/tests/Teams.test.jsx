import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithAuth, screen, waitFor, within } from '../test/test-utils';
import Teams from '../pages/Teams';
import * as teamsService from '../services/teamsService';

vi.mock('../services/teamsService');

const adminUser = { id: 1, name: 'Ada Admin', role: 'admin' };
const viewerUser = { id: 2, name: 'Vic Viewer', role: 'viewer' };

const lena = { id: 21, name: 'Lena Frost', location: 'London', is_org_leader: false };
const olive = { id: 22, name: 'Olive Grant', location: 'New York', is_org_leader: true };

const atlas = {
  id: 1,
  name: 'Atlas',
  location: 'Austin',
  leader_id: lena.id,
  leader_name: 'Lena Frost',
  reports_to_id: olive.id,
  reports_to_name: 'Olive Grant',
  member_count: 3,
  metadata: {},
};
const nimbus = {
  id: 2,
  name: 'Nimbus',
  location: 'Berlin',
  leader_id: null,
  leader_name: null,
  reports_to_id: null,
  reports_to_name: null,
  member_count: 0,
  metadata: { charter: 'Platform' },
};

beforeEach(() => {
  vi.clearAllMocks();
  teamsService.listTeams.mockResolvedValue({ teams: [atlas, nimbus] });
  teamsService.listIndividuals.mockResolvedValue({ individuals: [lena, olive] });
});

describe('Teams page', () => {
  it('renders a row per team with leader, member count, and reporting line', async () => {
    renderWithAuth(<Teams />, { user: adminUser });

    await screen.findByText('Atlas');
    const row1 = screen.getByText('Atlas').closest('tr');
    expect(within(row1).getByText('Austin')).toBeInTheDocument();
    expect(within(row1).getByText('Lena Frost')).toBeInTheDocument();
    expect(within(row1).getByText('3')).toBeInTheDocument();
    expect(within(row1).getByText('Olive Grant')).toBeInTheDocument();

    // Teams without a leader or reporting line render an em dash, not blanks.
    const row2 = screen.getByText('Nimbus').closest('tr');
    expect(within(row2).getAllByText('—')).toHaveLength(2);
  });

  it('links each team name to its details page', async () => {
    renderWithAuth(<Teams />, { user: adminUser });
    const link = await screen.findByRole('link', { name: 'Atlas' });
    expect(link).toHaveAttribute('href', '/teams/1');
  });

  it('hides all management controls from viewers', async () => {
    renderWithAuth(<Teams />, { user: viewerUser });
    await screen.findByText('Atlas');

    expect(screen.queryByRole('button', { name: 'Add team' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Delete' })).not.toBeInTheDocument();
  });

  it('creates a team with a leader picked from the individuals directory', async () => {
    const user = userEvent.setup();
    teamsService.createTeam.mockResolvedValue({ team: { id: 3 } });
    renderWithAuth(<Teams />, { user: adminUser });
    await screen.findByText('Atlas');

    await user.click(screen.getByRole('button', { name: 'Add team' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add a team' });

    await user.type(within(dialog).getByLabelText('Team name *'), 'Quartz');
    await user.type(within(dialog).getByLabelText('Location *'), 'Austin');

    await user.click(within(dialog).getByLabelText('Team leader'));
    await user.click(await screen.findByRole('option', { name: 'Lena Frost · London' }));

    await user.click(within(dialog).getByLabelText('Reports to'));
    await user.click(await screen.findByRole('option', { name: 'Olive Grant · org leader' }));

    teamsService.listTeams.mockClear();
    await user.click(within(dialog).getByRole('button', { name: 'Add team' }));

    await waitFor(() => {
      expect(teamsService.createTeam).toHaveBeenCalledWith({
        name: 'Quartz',
        location: 'Austin',
        leader_id: lena.id,
        reports_to_id: olive.id,
        metadata: {},
      });
    });
    expect(teamsService.listTeams).toHaveBeenCalled();
    expect(await screen.findByText('Quartz created')).toBeInTheDocument();
  });

  it('shows an error and stays open when the create is rejected', async () => {
    const user = userEvent.setup();
    teamsService.createTeam.mockRejectedValue(new Error('A team with this name already exists'));
    renderWithAuth(<Teams />, { user: adminUser });
    await screen.findByText('Atlas');

    await user.click(screen.getByRole('button', { name: 'Add team' }));
    const dialog = await screen.findByRole('dialog', { name: 'Add a team' });
    await user.type(within(dialog).getByLabelText('Team name *'), 'Atlas');
    await user.type(within(dialog).getByLabelText('Location *'), 'Austin');
    await user.click(within(dialog).getByRole('button', { name: 'Add team' }));

    expect(await screen.findByText('A team with this name already exists')).toBeInTheDocument();
    expect(screen.getByRole('dialog', { name: 'Add a team' })).toBeInTheDocument();
  });

  it('searches server-side and keeps the toolbar when nothing matches', async () => {
    const user = userEvent.setup();
    renderWithAuth(<Teams />, { user: adminUser });
    await screen.findByText('Atlas');

    teamsService.listTeams.mockResolvedValue({ teams: [] });
    await user.type(screen.getByLabelText('Search'), 'zz');

    await waitFor(() => {
      expect(teamsService.listTeams).toHaveBeenCalledWith('zz');
    });
    expect(await screen.findByText('No teams match this search.')).toBeInTheDocument();
    // The empty-state CTA is reserved for a truly empty directory.
    expect(screen.queryByText('No teams yet')).not.toBeInTheDocument();
  });

  it('deletes via the ConfirmDialog', async () => {
    const user = userEvent.setup();
    teamsService.deleteTeam.mockResolvedValue({ deleted: true });
    renderWithAuth(<Teams />, { user: adminUser });
    await screen.findByText('Nimbus');

    const row = screen.getByText('Nimbus').closest('tr');
    await user.click(within(row).getByRole('button', { name: 'Delete' }));

    const dialog = await screen.findByRole('dialog', { name: 'Delete Nimbus?' });
    teamsService.listTeams.mockClear();
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(teamsService.deleteTeam).toHaveBeenCalledWith(nimbus.id);
    });
    expect(teamsService.listTeams).toHaveBeenCalled();
  });
});
