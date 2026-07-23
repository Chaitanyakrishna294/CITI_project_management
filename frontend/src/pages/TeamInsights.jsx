/**
 * Team Insights: the workshop brief's counting questions, answered live.
 *
 *   How many teams have a leader not co-located with the team?
 *   How many teams have a non-direct leader?
 *   How many teams have a non-direct staff ratio above 20%?
 *   How many teams report to an organization leader?
 *
 * The KPI row gives the counts; the table underneath shows which teams are
 * behind each number, so every headline figure can be audited at a glance.
 * "Not co-located" compares the leader's own location to the team's location.
 */
import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Link from '@mui/material/Link';

import DataTable from '../components/DataTable';
import { EmptyState, ErrorState, LoadingState } from '../components/PageState';
import * as teamsService from '../services/teamsService';
import { EmptyDataIllustration } from '../components/illustrations';
import PageHeader from '../components/PageHeader';
import StatusIndicator from '../components/StatusIndicator';
import StatBand from '../components/StatBand';

function FlagCell({ active, label }) {
  if (!active) return null;
  return <StatusIndicator color="warning.main" label={label} />;
}

function formatRatio(ratio) {
  return `${Math.round(Number(ratio) * 100)}%`;
}

const yesNo = (value) => (value ? 'Yes' : 'No');

const columns = [
  {
    id: 'name',
    label: 'Team',
    render: (row) => (
      <Link component={RouterLink} to={`/teams/${row.id}`} underline="hover">
        {row.name}
      </Link>
    ),
  },
  { id: 'location', label: 'Location' },
  {
    id: 'leader_name',
    label: 'Leader',
    render: (row) =>
      row.leader_name ? `${row.leader_name} (${row.leader_location})` : '—',
  },
  { id: 'member_count', label: 'Members', align: 'right' },
  {
    id: 'leader_not_colocated',
    label: 'Leader elsewhere',
    render: (row) => <FlagCell active={row.leader_not_colocated} label="Not co-located" />,
    sortValue: (row) => (row.leader_not_colocated ? 0 : 1),
    exportValue: (row) => yesNo(row.leader_not_colocated),
  },
  {
    id: 'leader_non_direct',
    label: 'Non-direct leader',
    render: (row) => <FlagCell active={row.leader_non_direct} label="Non-direct" />,
    sortValue: (row) => (row.leader_non_direct ? 0 : 1),
    exportValue: (row) => yesNo(row.leader_non_direct),
  },
  {
    id: 'non_direct_ratio',
    label: 'Non-direct ratio',
    align: 'right',
    render: (row) => (
      <Typography
        variant="body2"
        component="span"
        color={row.non_direct_ratio_above_20pct ? 'warning.main' : 'text.primary'}
        sx={{ fontWeight: row.non_direct_ratio_above_20pct ? 600 : 400 }}
      >
        {formatRatio(row.non_direct_ratio)}
      </Typography>
    ),
    sortValue: (row) => Number(row.non_direct_ratio),
    exportValue: (row) => formatRatio(row.non_direct_ratio),
  },
  {
    id: 'reports_to_org_leader',
    label: 'Reports to org leader',
    // In this table a dot means a status flag (the warning FlagCells to the
    // left). The old primary dot was Harbor Blue; under Ink & Porcelain it
    // would render as ink — a third apparent status hue in light, a near-white
    // dot in dark — so the mark is carried as text instead: the name, plus a
    // quiet "Org leader" tag on the teams behind the KPI count. CSV export
    // keeps the explicit Yes/No.
    render: (row) =>
      row.reports_to_name ? (
        <Box component="span" sx={{ display: 'inline-flex', alignItems: 'baseline', gap: 0.75 }}>
          <Typography component="span" variant="body2">
            {row.reports_to_name}
          </Typography>
          {row.reports_to_org_leader && (
            <Typography component="span" variant="caption" color="text.secondary">
              Org leader
            </Typography>
          )}
        </Box>
      ) : (
        '—'
      ),
    sortValue: (row) => (row.reports_to_org_leader ? 0 : 1),
    exportValue: (row) => yesNo(row.reports_to_org_leader),
  },
];

export default function TeamInsights() {
  const [reloadToken, setReloadToken] = useState(0);
  const [result, setResult] = useState({ key: null, summary: null, teams: [], error: '' });
  const requestKey = String(reloadToken);
  const loading = result.key !== requestKey;
  const { summary, teams } = result;
  const error = loading ? '' : result.error;

  function reload() {
    setReloadToken((token) => token + 1);
  }

  useEffect(() => {
    let active = true;
    teamsService
      .getInsights()
      .then((data) => {
        if (active) setResult({ key: requestKey, summary: data.summary, teams: data.teams, error: '' });
      })
      .catch((err) => {
        if (active) setResult((prev) => ({ ...prev, key: requestKey, error: err.message }));
      });
    return () => {
      active = false;
    };
  }, [requestKey]);

  return (
    <Box>
      <PageHeader
        title="Team Insights"
        summary="Team structure at a glance: co-location, staffing mix, and reporting lines across all teams."
      />

      {loading && <LoadingState variant="cards" label="Loading team insights…" />}

      {!loading && error && (
        <ErrorState title="Could not load team insights" error={error} onRetry={reload} />
      )}

      {/* Insights are a read-only view — teams are created on the Teams page,
          so the §15 call to action stays in the message rather than a button
          this page could not honour for every role. */}
      {!loading && !error && teams.length === 0 && (
        <EmptyState
          icon={<EmptyDataIllustration />}
          title="No teams to analyze"
          message="Create teams and assign leaders and members — the insights fill in from there."
        />
      )}

      {!loading && !error && teams.length > 0 && (
        <>
          <Box sx={{ mt: 1, mb: 2 }}>
            <StatBand
              items={[
                { label: 'Teams', value: summary.team_count, caption: 'Across the organization' },
                {
                  label: 'Leader not co-located',
                  value: summary.leader_not_colocated,
                  caption: 'Leader based away from the team',
                },
                {
                  label: 'Non-direct leaders',
                  value: summary.leader_non_direct,
                  caption: 'Teams led by non-direct staff',
                },
                {
                  label: 'Non-direct ratio > 20%',
                  value: summary.non_direct_ratio_above_20pct,
                  caption: 'Share of non-direct members',
                },
                {
                  label: 'Report to org leader',
                  value: summary.reporting_to_org_leader,
                  caption: 'Direct line to an org leader',
                },
              ]}
            />
          </Box>

          <DataTable
            columns={columns}
            rows={teams}
            defaultOrderBy="name"
            exportFilename="team-insights.csv"
          />
        </>
      )}
    </Box>
  );
}
