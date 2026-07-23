import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithAuth, screen, within } from '../test/test-utils';
import TeamInsights from '../pages/TeamInsights';
import * as teamsService from '../services/teamsService';

vi.mock('../services/teamsService');

const adminUser = { id: 1, name: 'Ada Admin', role: 'admin' };

const insights = {
  summary: {
    team_count: 3,
    leader_not_colocated: 1,
    leader_non_direct: 1,
    non_direct_ratio_above_20pct: 2,
    reporting_to_org_leader: 1,
  },
  teams: [
    {
      id: 1,
      name: 'Atlas',
      location: 'Austin',
      leader_name: 'Lena Frost',
      leader_location: 'London',
      reports_to_name: 'Olive Grant',
      member_count: 3,
      non_direct_count: 0,
      non_direct_ratio: 0,
      leader_not_colocated: true,
      leader_non_direct: false,
      non_direct_ratio_above_20pct: false,
      reports_to_org_leader: true,
    },
    {
      id: 2,
      name: 'Nimbus',
      location: 'Berlin',
      leader_name: 'Jonas Weber',
      leader_location: 'Berlin',
      reports_to_name: 'Hector Bloom',
      member_count: 4,
      non_direct_count: 2,
      non_direct_ratio: 0.5,
      leader_not_colocated: false,
      leader_non_direct: true,
      non_direct_ratio_above_20pct: true,
      reports_to_org_leader: false,
    },
  ],
};

beforeEach(() => {
  vi.clearAllMocks();
  teamsService.getInsights.mockResolvedValue(insights);
});

describe('TeamInsights page', () => {
  it('renders the workshop KPI counts', async () => {
    renderWithAuth(<TeamInsights />, { user: adminUser });

    await screen.findByText('Teams');
    function kpiValue(label) {
      return within(screen.getByText(label).closest('div')).getByText(/^\d+$/).textContent;
    }
    expect(kpiValue('Teams')).toBe('3');
    expect(kpiValue('Leader not co-located')).toBe('1');
    expect(kpiValue('Non-direct leaders')).toBe('1');
    expect(kpiValue('Non-direct ratio > 20%')).toBe('2');
    expect(kpiValue('Report to org leader')).toBe('1');
  });

  it('flags each team behind the numbers in the audit table', async () => {
    renderWithAuth(<TeamInsights />, { user: adminUser });

    await screen.findByRole('link', { name: 'Atlas' });
    const atlasRow = screen.getByRole('link', { name: 'Atlas' }).closest('tr');
    expect(within(atlasRow).getByText('Lena Frost (London)')).toBeInTheDocument();
    expect(within(atlasRow).getByText('Not co-located')).toBeInTheDocument();
    expect(within(atlasRow).getByText('Olive Grant')).toBeInTheDocument();
    expect(within(atlasRow).getByText('Org leader')).toBeInTheDocument();
    expect(within(atlasRow).getByText('0%')).toBeInTheDocument();

    const nimbusRow = screen.getByRole('link', { name: 'Nimbus' }).closest('tr');
    expect(within(nimbusRow).getByText('Non-direct')).toBeInTheDocument();
    expect(within(nimbusRow).getByText('50%')).toBeInTheDocument();
    expect(within(nimbusRow).queryByText('Not co-located')).not.toBeInTheDocument();
    expect(within(nimbusRow).getByText('Hector Bloom')).toBeInTheDocument();
    expect(within(nimbusRow).queryByText('Org leader')).not.toBeInTheDocument();
  });

  it('shows an empty state when there are no teams', async () => {
    teamsService.getInsights.mockResolvedValue({
      summary: {
        team_count: 0,
        leader_not_colocated: 0,
        leader_non_direct: 0,
        non_direct_ratio_above_20pct: 0,
        reporting_to_org_leader: 0,
      },
      teams: [],
    });
    renderWithAuth(<TeamInsights />, { user: adminUser });
    expect(await screen.findByText('No teams to analyze')).toBeInTheDocument();
  });

  it('shows an error state with retry when insights fail to load', async () => {
    teamsService.getInsights.mockRejectedValue(new Error('boom'));
    renderWithAuth(<TeamInsights />, { user: adminUser });
    expect(await screen.findByText('Could not load team insights')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument();
  });
});
