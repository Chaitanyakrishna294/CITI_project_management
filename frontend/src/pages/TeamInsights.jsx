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
import Grid from '@mui/material/Grid';
import Link from '@mui/material/Link';

import DataTable from '../components/DataTable';
import { EmptyState, ErrorState, LoadingState } from '../components/PageState';
import * as teamsService from '../services/teamsService';
import { EmptyDataIllustration } from '../components/illustrations';
import PageHeader from '../components/PageHeader';
import StatusIndicator from '../components/StatusIndicator';
import KpiCard from '../components/KpiCard';



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
    // Status meaning is dot+label, never a filled pill (glow-up brief v2 §2):
    // the primary dot marks the teams behind the "report to org leader" count,
    // under the column heading that names the state. Primary, not the ochre
    // accent — a reporting line is structure, not something to act on.
    render: (row) =>
      row.reports_to_org_leader ? (
        <StatusIndicator color="primary.main" label={row.reports_to_name} />
      ) : (
        row.reports_to_name || '—'
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
          <Grid container spacing={2} sx={{ mt: 1, mb: 2 }}>
            <Grid item xs={12} sm={6} md={2.4}>
              <KpiCard label="Teams" value={summary.team_count} caption="Across the organization" />
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <KpiCard
                label="Leader not co-located"
                value={summary.leader_not_colocated}
                caption="Leader based away from the team"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <KpiCard
                label="Non-direct leaders"
                value={summary.leader_non_direct}
                caption="Teams led by non-direct staff"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <KpiCard
                label="Non-direct ratio > 20%"
                value={summary.non_direct_ratio_above_20pct}
                caption="Share of non-direct members"
              />
            </Grid>
            <Grid item xs={12} sm={6} md={2.4}>
              <KpiCard
                label="Report to org leader"
                value={summary.reporting_to_org_leader}
                caption="Direct line to an org leader"
              />
            </Grid>
          </Grid>

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
