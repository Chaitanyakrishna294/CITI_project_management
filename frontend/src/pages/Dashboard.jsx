/**
 * UI-02 Dashboard — the executive summary described in req/Application_Flow.md
 * §4 and req/UI_UX_Design&UserFlow.md §7.
 *
 * Widgets: active projects, projects at risk, budget overview, resource
 * utilisation, upcoming deadlines — plus the KPI stat band and charts §12 calls for.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Link from '@mui/material/Link';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';

import * as projectsService from '../services/projectsService';
import * as budgetsService from '../services/budgetsService';
import * as resourcesService from '../services/resourcesService';
import * as deliverablesService from '../services/deliverablesService';
import { LoadingState, ErrorState } from '../components/PageState';
import ChartFrame from '../components/charts/ChartFrame';
import BarChart from '../components/charts/BarChart';
import DonutChart from '../components/charts/DonutChart';
import LineChart from '../components/charts/LineChart';
import { useChartColors, useStatusColors } from '../theme';
import StatusIndicator from '../components/StatusIndicator';
import StatBand from '../components/StatBand';
import PageHeader from '../components/PageHeader';

const DELIVERABLE_STATUSES = [
  { key: 'not_started', label: 'Not started' },
  { key: 'in_progress', label: 'In progress' },
  { key: 'blocked', label: 'Blocked' },
  { key: 'completed', label: 'Completed' },
];

// Human labels for every status enum rendered on this page — raw keys like
// "in_progress" never reach the user.
const STATUS_LABELS = {
  active: 'Active',
  delayed: 'Delayed',
  archived: 'Archived',
  ...Object.fromEntries(DELIVERABLE_STATUSES.map((s) => [s.key, s.label])),
};

const currency = new Intl.NumberFormat('en-US', {
  style: 'currency',
  currency: 'USD',
  maximumFractionDigits: 0,
});

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function isAtRisk(project, today) {
  if (project.status === 'delayed') return true;
  return project.status === 'active' && project.end_date && project.end_date < today;
}

/** "2026-07-22" -> "Jul 26" for the deadline trend axis. */
function monthKey(isoDate) {
  const [year, month] = isoDate.split('-');
  const name = new Date(Number(year), Number(month) - 1, 1).toLocaleString('en-US', { month: 'short' });
  return `${name} ${year.slice(2)}`;
}



export default function Dashboard() {
  const chartColors = useChartColors();
  const statusColors = useStatusColors();
  // Bumping the token re-runs the fetch effect; retrying never has to write
  // state before the request is issued.
  const [reloadToken, setReloadToken] = useState(0);

  // The result carries the request it answers, so "loading" is derived.
  const [result, setResult] = useState({ key: null, data: null, error: '' });
  const answered = result.key === reloadToken;
  const data = answered ? result.data : null;
  const error = answered ? result.error : '';

  const load = useCallback(() => {
    setReloadToken((token) => token + 1);
  }, []);

  useEffect(() => {
    let active = true;
    Promise.all([
      projectsService.listProjects(),
      // A role without budget/resource visibility still gets a usable dashboard.
      budgetsService.listBudgets().catch(() => ({ budgets: [] })),
      resourcesService.listResources().catch(() => ({ resources: [] })),
      deliverablesService.listDeliverables().catch(() => ({ deliverables: [] })),
    ])
      .then(([projectsRes, budgetsRes, resourcesRes, deliverablesRes]) => {
        // The guard stops a slow response overwriting a newer one.
        if (!active) return;
        setResult({
          key: reloadToken,
          error: '',
          data: {
            projects: projectsRes.projects,
            budgets: budgetsRes.budgets,
            resources: resourcesRes.resources,
            deliverables: deliverablesRes.deliverables,
          },
        });
      })
      .catch((err) => {
        if (active) setResult({ key: reloadToken, data: null, error: err.message });
      });
    return () => {
      active = false;
    };
  }, [reloadToken]);

  const summary = useMemo(() => {
    if (!data) return null;
    const today = todayISO();

    const activeProjects = data.projects.filter((p) => p.status === 'active');
    const completedProjects = data.projects.filter((p) => p.status === 'completed');
    const atRiskProjects = data.projects.filter((p) => isAtRisk(p, today));

    const totalPlanned = data.budgets.reduce((sum, b) => sum + Number(b.planned_amount), 0);
    const totalSpent = data.budgets.reduce((sum, b) => sum + Number(b.actual_spend), 0);
    const budgetPct = totalPlanned > 0 ? Math.min((totalSpent / totalPlanned) * 100, 100) : 0;

    const avgUtilization = data.resources.length
      ? data.resources.reduce((sum, r) => sum + Number(r.total_allocation_pct), 0) / data.resources.length
      : 0;
    const overAllocated = data.resources.filter(
      (r) => Number(r.total_allocation_pct) > Number(r.weekly_capacity)
    );
    const overBudget = data.budgets.filter(
      (b) => Number(b.actual_spend) > Number(b.planned_amount)
    );

    const upcomingDeadlines = data.deliverables
      .filter((d) => d.status !== 'completed' && d.due_date && d.due_date >= today)
      .sort((a, b) => a.due_date.localeCompare(b.due_date))
      .slice(0, 5);

    // Part-to-whole: how the deliverable portfolio is distributed by state.
    const statusSlices = DELIVERABLE_STATUSES.map((s) => ({
      label: s.label,
      value: data.deliverables.filter((d) => d.status === s.key).length,
      color: statusColors[s.key],
    }));

    // Magnitude comparison: planned vs actual for the largest budgets. Beyond
    // six rows the labels stop being readable, so the rest is left to Reports.
    const budgetBars = [...data.budgets]
      .sort((a, b) => Number(b.planned_amount) - Number(a.planned_amount))
      .slice(0, 6)
      .map((b) => ({
        label: b.project_name,
        values: [Number(b.planned_amount), Number(b.actual_spend)],
      }));

    // Change over time: how the open workload falls due, month by month.
    const byMonth = new Map();
    data.deliverables
      .filter((d) => d.due_date)
      .forEach((d) => {
        const key = d.due_date.slice(0, 7);
        if (!byMonth.has(key)) byMonth.set(key, { due: 0, completed: 0 });
        const bucket = byMonth.get(key);
        bucket.due += 1;
        if (d.status === 'completed') bucket.completed += 1;
      });
    const deadlineTrend = [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .slice(-6)
      .map(([key, bucket]) => ({ label: monthKey(key), values: [bucket.due, bucket.completed] }));

    return {
      activeProjects,
      completedProjects,
      atRiskProjects,
      overBudget,
      totalPlanned,
      totalSpent,
      budgetPct,
      avgUtilization,
      overAllocated,
      upcomingDeadlines,
      statusSlices,
      budgetBars,
      deadlineTrend,
    };
  }, [data, statusColors]);

  if (error) return <ErrorState title="Could not load the dashboard" error={error} onRetry={load} />;

  if (!summary) {
    return (
      <Box>
        <PageHeader title="Dashboard" />
        <Stack spacing={2}>
          <LoadingState variant="cards" rows={4} label="Loading dashboard" />
          <LoadingState variant="table" rows={4} />
        </Stack>
      </Box>
    );
  }

  const totalDeliverables = summary.statusSlices.reduce((sum, s) => sum + s.value, 0);

  return (
    <Box>
      <PageHeader
        title="Dashboard"
        summary={`${data.projects.length} projects · ${summary.atRiskProjects.length} at risk · ${summary.budgetPct.toFixed(0)}% budget consumed`}
      />

      {/* Attention tier (glow-up brief §4.4): what needs acting on today sits
          above the steady-state KPIs, not mixed in among them. */}
      {summary.atRiskProjects.length + summary.overAllocated.length + summary.overBudget.length > 0 ? (
        <Paper sx={{ mt: 2, px: 2, py: 1.5, borderLeft: '3px solid var(--color-accent)' }}>
          {/* The ochre accent border alone marks the attention tier; the
              heading stays Inter — Fraunces is reserved for page titles. */}
          <Typography variant="subtitle1" component="h2" gutterBottom sx={{ fontWeight: 600 }}>
            Needs attention
          </Typography>
          <Grid container spacing={2}>
            {summary.atRiskProjects.length > 0 && (
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" color="text.secondary">
                  Projects at risk · {summary.atRiskProjects.length}
                </Typography>
                <List dense disablePadding>
                  {summary.atRiskProjects.slice(0, 4).map((p) => (
                    <ListItem key={p.id} disableGutters>
                      <ListItemText
                        primary={
                          <Link component={RouterLink} to={`/projects/${p.id}`}>
                            {p.name}
                          </Link>
                        }
                        secondary={`${p.manager_name} · ends ${p.end_date || 'n/a'}`}
                      />
                      {/* Dot + label must agree (UI_UX §14): the risk framing
                          comes from the panel, not a recoloured status dot. */}
                      <StatusIndicator color={statusColors[p.status] || 'grey.500'} label={STATUS_LABELS[p.status] || p.status} />
                    </ListItem>
                  ))}
                </List>
              </Grid>
            )}
            {summary.overAllocated.length > 0 && (
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" color="text.secondary">
                  Over-allocated people · {summary.overAllocated.length}
                </Typography>
                <List dense disablePadding>
                  {summary.overAllocated.slice(0, 4).map((r) => (
                    <ListItem key={r.id} disableGutters>
                      <ListItemText
                        primary={r.user_name || r.title || `Resource ${r.id}`}
                        secondary={`${Number(r.total_allocation_pct).toFixed(0)}% allocated of ${Number(r.weekly_capacity).toFixed(0)}% capacity`}
                      />
                    </ListItem>
                  ))}
                </List>
              </Grid>
            )}
            {summary.overBudget.length > 0 && (
              <Grid item xs={12} md={4}>
                <Typography variant="subtitle2" color="text.secondary">
                  Over budget · {summary.overBudget.length}
                </Typography>
                <List dense disablePadding>
                  {summary.overBudget.slice(0, 4).map((b) => (
                    <ListItem key={b.id} disableGutters>
                      <ListItemText
                        primary={
                          <Link component={RouterLink} to={`/projects/${b.project_id}`}>
                            {b.project_name}
                          </Link>
                        }
                        secondary={`${currency.format(Number(b.actual_spend))} spent of ${currency.format(Number(b.planned_amount))}`}
                      />
                    </ListItem>
                  ))}
                </List>
              </Grid>
            )}
          </Grid>
        </Paper>
      ) : (
        // The all-clear state is a non-event: quiet text, no card, no border.
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>
          All clear — no projects at risk, nobody over-allocated, no budgets over plan.
        </Typography>
      )}

      <Box sx={{ mt: 2 }}>
        <StatBand
          items={[
            {
              label: 'Active Projects',
              value: summary.activeProjects.length,
              caption: `${summary.completedProjects.length} completed`,
            },
            {
              label: 'Projects at Risk',
              value: summary.atRiskProjects.length,
              valueColor: summary.atRiskProjects.length ? 'error.main' : undefined,
              caption: 'Delayed or past due date',
            },
            {
              label: 'Budget Utilization',
              value: `${summary.budgetPct.toFixed(0)}%`,
              caption: `${currency.format(summary.totalSpent)} / ${currency.format(summary.totalPlanned)}`,
            },
            {
              label: 'Resource Utilization',
              value: `${summary.avgUtilization.toFixed(0)}%`,
              caption: `${summary.overAllocated.length} over-allocated`,
              captionColor: summary.overAllocated.length ? 'error.main' : 'text.secondary',
            },
          ]}
        />
      </Box>

      {/* Disciplined two-column grid on md+ (one column on mobile). */}
      <Grid container spacing={2} sx={{ mt: 0.5 }}>
        <Grid item xs={12} md={6}>
          <ChartFrame
            title="Deliverable Status"
            subtitle="Share of deliverables in each state"
            empty={totalDeliverables === 0}
            emptyMessage="No deliverables yet."
            legend={summary.statusSlices.map((s) => ({
              color: s.color,
              label: s.label,
              value: s.value,
            }))}
            tableColumns={['Status', 'Deliverables']}
            tableRows={summary.statusSlices.map((s) => [s.label, s.value])}
          >
            <DonutChart slices={summary.statusSlices} centerLabel="deliverables" />
          </ChartFrame>
        </Grid>

        <Grid item xs={12} md={6}>
          <ChartFrame
            title="Budget: Planned vs Actual"
            subtitle="Six largest budgets"
            empty={summary.budgetBars.length === 0}
            emptyMessage="No budgets recorded yet."
            legend={[
              { color: chartColors[0], label: 'Planned' },
              { color: chartColors[1], label: 'Actual spend' },
            ]}
            tableColumns={['Project', 'Planned', 'Actual spend']}
            tableRows={summary.budgetBars.map((b) => [
              b.label,
              currency.format(b.values[0]),
              currency.format(b.values[1]),
            ])}
          >
            <BarChart
              data={summary.budgetBars}
              series={[
                { label: 'Planned', color: chartColors[0] },
                { label: 'Actual spend', color: chartColors[1] },
              ]}
              formatValue={(v) => currency.format(v)}
            />
          </ChartFrame>
        </Grid>

        <Grid item xs={12} md={6}>
          <ChartFrame
            title="Deliverables Due by Month"
            subtitle="Last six months with due dates"
            empty={summary.deadlineTrend.length === 0}
            emptyMessage="No deliverables have due dates yet."
            legend={[
              { color: chartColors[0], label: 'Due' },
              { color: chartColors[1], label: 'Completed' },
            ]}
            tableColumns={['Month', 'Due', 'Completed']}
            tableRows={summary.deadlineTrend.map((p) => [p.label, p.values[0], p.values[1]])}
          >
            <LineChart
              points={summary.deadlineTrend}
              series={[
                { label: 'Due', color: chartColors[0] },
                { label: 'Completed', color: chartColors[1] },
              ]}
            />
          </ChartFrame>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Typography variant="h6" component="h2" gutterBottom>
              Upcoming Deadlines
            </Typography>
            {summary.upcomingDeadlines.length === 0 && (
              <Typography variant="body2" color="text.secondary">
                No upcoming deliverable deadlines.
              </Typography>
            )}
            <List dense>
              {summary.upcomingDeadlines.map((d) => (
                <ListItem key={d.id} disableGutters>
                  <ListItemText
                    primary={d.title}
                    secondary={`Owner: ${d.owner_name || 'Unassigned'} · Due ${d.due_date}`}
                  />
                  <StatusIndicator color={statusColors[d.status] || 'grey.500'} label={STATUS_LABELS[d.status] || d.status} />
                </ListItem>
              ))}
            </List>
          </Paper>
        </Grid>

      </Grid>

      {/* Progress indicator for the portfolio-wide budget, per §12. */}
      <Paper sx={{ p: 3, mt: 2 }}>
        <Typography variant="subtitle2" gutterBottom>
          Overall budget consumed — {summary.budgetPct.toFixed(0)}%
        </Typography>
        <LinearProgress
          variant="determinate"
          value={summary.budgetPct}
          color={summary.budgetPct >= 100 ? 'error' : 'primary'}
          sx={{ height: 8, borderRadius: 4 }}
        />
      </Paper>
    </Box>
  );
}
