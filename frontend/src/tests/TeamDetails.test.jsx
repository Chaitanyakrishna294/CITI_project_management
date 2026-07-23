import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { Routes, Route } from 'react-router-dom';
import { renderWithAuth, screen, waitFor, within } from '../test/test-utils';
import TeamDetails from '../pages/TeamDetails';
import * as teamsService from '../services/teamsService';

vi.mock('../services/teamsService');

const adminUser = { id: 1, name: 'Ada Admin', role: 'admin' };
const viewerUser = { id: 2, name: 'Vic Viewer', role: 'viewer' };

const mia = { id: 31, name: 'Mia Torres', location: 'Austin', is_direct_staff: true };
const jonas = { id: 32, name: 'Jonas Weber', location: 'Berlin', is_direct_staff: false };
const spare = { id: 33, name: 'Spare Person', location: 'Tokyo', is_direct_staff: true };

const team = {
  id: 7,
  name: 'Atlas',
  location: 'Austin',
  leader_id: 21,
  leader_name: 'Lena Frost',
  reports_to_id: 22,
  reports_to_name: 'Olive Grant',
  member_count: 2,
  metadata: { charter: 'Payments' },
  members: [mia, jonas],
  achievements: [
    { id: 41, team_id: 7, month: '2026-06-01', title: 'Shipped billing v2', description: 'Migrated invoicing.' },
  ],
};

function renderDetails({ user = adminUser, id = '7' } = {}) {
  return renderWithAuth(
    <Routes>
      <Route path="/teams/:id" element={<TeamDetails />} />
    </Routes>,
    { user, initialEntries: [`/teams/${id}`] }
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  teamsService.getTeam.mockResolvedValue({ team });
  teamsService.listIndividuals.mockResolvedValue({ individuals: [mia, jonas, spare] });
});

describe('TeamDetails page', () => {
  it('renders identity, metadata, roster and achievements', async () => {
    renderDetails();

    await screen.findByRole('heading', { name: 'Atlas' });
    expect(screen.getByText('Lena Frost')).toBeInTheDocument();
    expect(screen.getByText('Olive Grant')).toBeInTheDocument();
    expect(screen.getByText('charter: Payments')).toBeInTheDocument();

    expect(screen.getByText('Mia Torres')).toBeInTheDocument();
    expect(screen.getByText('Berlin · non-direct')).toBeInTheDocument();

    expect(screen.getByText('Shipped billing v2')).toBeInTheDocument();
    expect(screen.getByText('June 2026')).toBeInTheDocument();
  });

  it('shows an error state with retry when the team fails to load', async () => {
    teamsService.getTeam.mockRejectedValue(new Error('Team not found'));
    renderDetails({ id: '999' });
    expect(await screen.findByText('Could not load team')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });

  it('hides roster and achievement controls from viewers', async () => {
    renderDetails({ user: viewerUser });
    await screen.findByRole('heading', { name: 'Atlas' });

    expect(screen.queryByLabelText('Add member')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Record achievement' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Remove Mia Torres' })).not.toBeInTheDocument();
  });

  it('adds a member picked from individuals not already on the roster', async () => {
    const user = userEvent.setup();
    teamsService.addTeamMember.mockResolvedValue({ members: [] });
    renderDetails();
    await screen.findByRole('heading', { name: 'Atlas' });

    await user.click(screen.getByLabelText('Add member'));
    // Current members are filtered out of the picker.
    expect(screen.queryByRole('option', { name: /Mia Torres/ })).not.toBeInTheDocument();
    await user.click(await screen.findByRole('option', { name: 'Spare Person · Tokyo' }));
    await user.click(screen.getByRole('button', { name: 'Add' }));

    await waitFor(() => {
      expect(teamsService.addTeamMember).toHaveBeenCalledWith(team.id, spare.id);
    });
    expect(await screen.findByText('Spare Person added to Atlas')).toBeInTheDocument();
  });

  it('removes a member via the ConfirmDialog', async () => {
    const user = userEvent.setup();
    teamsService.removeTeamMember.mockResolvedValue({ members: [] });
    renderDetails();
    await screen.findByRole('heading', { name: 'Atlas' });

    await user.click(screen.getByRole('button', { name: 'Remove Mia Torres' }));
    const dialog = await screen.findByRole('dialog', { name: 'Remove Mia Torres from Atlas?' });
    await user.click(within(dialog).getByRole('button', { name: 'Remove' }));

    await waitFor(() => {
      expect(teamsService.removeTeamMember).toHaveBeenCalledWith(team.id, mia.id);
    });
  });

  it('records an achievement for a month', async () => {
    const user = userEvent.setup();
    teamsService.createAchievement.mockResolvedValue({ achievement: { id: 42 } });
    renderDetails();
    await screen.findByRole('heading', { name: 'Atlas' });

    await user.click(screen.getByRole('button', { name: 'Record achievement' }));
    const dialog = await screen.findByRole('dialog', { name: 'Record an achievement' });

    // userEvent.type doesn't drive <input type="month">; fill it directly.
    const monthField = within(dialog).getByLabelText('Month *');
    await user.click(monthField);
    await user.keyboard('2026-07');
    if (!monthField.value) {
      // Some environments don't accept keyboard input on month fields.
      const { fireEvent } = await import('@testing-library/react');
      fireEvent.change(monthField, { target: { value: '2026-07' } });
    }
    await user.type(within(dialog).getByLabelText('Title *'), 'Launched partner sandbox');
    await user.click(within(dialog).getByRole('button', { name: 'Record achievement' }));

    await waitFor(() => {
      expect(teamsService.createAchievement).toHaveBeenCalledWith(team.id, {
        month: '2026-07',
        title: 'Launched partner sandbox',
        description: '',
      });
    });
    expect(await screen.findByText('Achievement recorded')).toBeInTheDocument();
  });

  it('deletes an achievement via the ConfirmDialog', async () => {
    const user = userEvent.setup();
    teamsService.deleteAchievement.mockResolvedValue({ deleted: true });
    renderDetails();
    await screen.findByRole('heading', { name: 'Atlas' });

    await user.click(screen.getByRole('button', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog', { name: 'Delete this achievement?' });
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

    await waitFor(() => {
      expect(teamsService.deleteAchievement).toHaveBeenCalledWith(41);
    });
  });
});
