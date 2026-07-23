/**
 * UI-09 Reports.
 *
 * Phase 7 of req/Implementation_plan.md pairs the Dashboard's charts with a
 * reporting screen: the same four domains (projects, budgets, resources,
 * deliverables) rendered as sortable, paginated, CSV-exportable tables so the
 * business objectives in req/PRD.md (BO-01..BO-07) can be evidenced offline.
 *
 * Flag definitions are kept identical to Dashboard.jsx so the two screens never
 * disagree about which projects are at risk or who is over-allocated.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import DataTable from '../components/DataTable';
import PageState from '../components/PageState';
import { useStatusColors, DISPLAY_FONT } from '../theme';
import { useAuth } from '../contexts/AuthContext';
import * as projectsService from '../services/projectsService';
import * as budgetsService from '../services/budgetsService';
import * as resourcesService from '../services/resourcesService';
import * as deliverablesService from '../services/deliverablesService';
import StatusIndicator from '../components/StatusIndicator';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

/** Same rule as Dashboard.jsx: explicitly delayed, or active past its end date. */
function isAtRisk(project, today) {
  if (project.status === 'delayed') return true;
  return project.status === 'active' && project.end_date && project.end_date < today;
}

function formatMoney(value, currency = 'USD') {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '—';
  return amount.toLocaleString(undefined, { style: 'currency', currency, maximumFractionDigits: 0 });
}

function formatPercent(value) {
  return `${Math.round(Number(value) || 0)}%`;
}

function yesNo(value) {
  return value ? 'Yes' : 'No';
}

function StatusChip({ status }) {
  const statusColors = useStatusColors();
  return <StatusIndicator color={statusColors[status] || 'grey.500'} label={status} />;
}

function FlagCell({ active, label }) {
  if (!active) {
    return (
      <Typography variant="body2" color="text.secondary">
        —
      </Typography>
    );
  }
  return <Chip size="small" color="error" label={label} />;
}

const PROJECT_COLUMNS = [
  {
    id: 'name',
    label: 'Name',
    render: (row) => (
      <Link component={RouterLink} to={`/projects/${row.id}`}>
        {row.name}
      </Link>
    ),
  },
  { id: 'manager_name', label: 'Manager', render: (row) => row.manager_name || '—' },
  { id: 'department', label: 'Department', render: (row) => row.department || '—' },
  { id: 'status', label: 'Status', render: (row) => <StatusChip status={row.status} /> },
  { id: 'start_date', label: 'Start', render: (row) => row.start_date || '—' },
  { id: 'end_date', label: 'End', render: (row) => row.end_date || '—' },
  {
    id: 'deliverable_count',
    label: 'Deliverables',
    align: 'right',
    sortValue: (row) => row.deliverable_count,
  },
  {
    id: 'complete_pct',
    label: '% Complete',
    align: 'right',
    sortValue: (row) => row.complete_pct,
    render: (row) => formatPercent(row.complete_pct),
  },
  {
    id: 'at_risk',
    label: 'At Risk',
    align: 'center',
    sortValue: (row) => (row.at_risk ? 1 : 0),
    exportValue: (row) => yesNo(row.at_risk),
    render: (row) => <FlagCell active={row.at_risk} label="At Risk" />,
  },
];

const BUDGET_COLUMNS = [
  { id: 'project_name', label: 'Project', render: (row) => row.project_name || '—' },
  {
    id: 'planned',
    label: 'Planned',
    align: 'right',
    sortValue: (row) => row.planned,
    render: (row) => formatMoney(row.planned, row.currency),
  },
  {
    id: 'actual',
    label: 'Actual Spend',
    align: 'right',
    sortValue: (row) => row.actual,
    render: (row) => formatMoney(row.actual, row.currency),
  },
  {
    id: 'remaining',
    label: 'Remaining',
    align: 'right',
    sortValue: (row) => row.remaining,
    render: (row) => formatMoney(row.remaining, row.currency),
  },
  {
    id: 'utilisation_pct',
    label: 'Utilisation %',
    align: 'right',
    sortValue: (row) => row.utilisation_pct,
    render: (row) => formatPercent(row.utilisation_pct),
  },
  {
    id: 'over_budget',
    label: 'Over Budget',
    align: 'center',
    sortValue: (row) => (row.over_budget ? 1 : 0),
    exportValue: (row) => yesNo(row.over_budget),
    render: (row) => <FlagCell active={row.over_budget} label="Over Budget" />,
  },
];

const RESOURCE_COLUMNS = [
  { id: 'user_name', label: 'Name' },
  { id: 'title', label: 'Title', render: (row) => row.title || '—' },
  { id: 'department', label: 'Department', render: (row) => row.department || '—' },
  {
    id: 'capacity',
    label: 'Weekly Capacity',
    align: 'right',
    sortValue: (row) => row.capacity,
    render: (row) => formatPercent(row.capacity),
  },
  {
    id: 'allocation',
    label: 'Total Allocation',
    align: 'right',
    sortValue: (row) => row.allocation,
    render: (row) => formatPercent(row.allocation),
  },
  {
    id: 'over_allocated',
    label: 'Over-allocated',
    align: 'center',
    sortValue: (row) => (row.over_allocated ? 1 : 0),
    exportValue: (row) => yesNo(row.over_allocated),
    render: (row) => <FlagCell active={row.over_allocated} label="Over-allocated" />,
  },
];

const DELIVERABLE_COLUMNS = [
  { id: 'title', label: 'Title' },
  { id: 'project_name', label: 'Project', render: (row) => row.project_name || '—' },
  { id: 'owner_name', label: 'Owner', render: (row) => row.owner_name || 'Unassigned' },
  { id: 'status', label: 'Status', render: (row) => <StatusChip status={row.status} /> },
  { id: 'due_date', label: 'Due Date', render: (row) => row.due_date || '—' },
  {
    id: 'overdue',
    label: 'Overdue',
    align: 'center',
    sortValue: (row) => (row.overdue ? 1 : 0),
    exportValue: (row) => yesNo(row.overdue),
    render: (row) => <FlagCell active={row.overdue} label="Overdue" />,
  },
];

const REPORTS = [
  {
    key: 'project-status',
    label: 'Project Status',
    title: 'Project Status',
    columns: PROJECT_COLUMNS,
    defaultOrderBy: 'name',
    exportFilename: 'project-status-report.csv',
    emptyTitle: 'No projects to report',
    emptyMessage: 'No projects match the selected date range or department.',
  },
  {
    key: 'budget-utilisation',
    label: 'Budget Utilisation',
    title: 'Budget Utilisation',
    columns: BUDGET_COLUMNS,
    defaultOrderBy: 'utilisation_pct',
    defaultOrder: 'desc',
    exportFilename: 'budget-utilisation-report.csv',
    emptyTitle: 'No budgets to report',
    emptyMessage: 'No project budgets have been created yet.',
  },
  {
    key: 'resource-utilisation',
    label: 'Resource Utilisation',
    title: 'Resource Utilisation',
    columns: RESOURCE_COLUMNS,
    defaultOrderBy: 'allocation',
    defaultOrder: 'desc',
    exportFilename: 'resource-utilisation-report.csv',
    emptyTitle: 'No resources to report',
    emptyMessage: 'No resources match the selected department.',
  },
  {
    key: 'deliverable-status',
    label: 'Deliverable Status',
    title: 'Deliverable Status',
    columns: DELIVERABLE_COLUMNS,
    defaultOrderBy: 'due_date',
    exportFilename: 'deliverable-status-report.csv',
    emptyTitle: 'No deliverables to report',
    emptyMessage: 'No deliverables fall inside the selected date range.',
  },
];

export default function Reports() {
  const { user } = useAuth();
  const [tab, setTab] = useState(0);
  const [filters, setFilters] = useState({ dateFrom: '', dateTo: '', department: '' });
  const [reloadToken, setReloadToken] = useState(0);
  const [result, setResult] = useState({ key: null, data: null, error: '' });

  // The result carries the request it answers, so "loading" is derived rather
  // than toggled — no state has to be written before the request is issued.
  const requestKey = `${filters.dateFrom}|${filters.dateTo}|${filters.department}|${reloadToken}`;
  const loading = result.key !== requestKey;
  const { data, error } = result;

  useEffect(() => {
    let active = true;
    // Projects drive the headline report, so a failure there is fatal; the other
    // three degrade to an empty section rather than blanking the whole screen.
    Promise.all([
      projectsService.listProjects({
        date_from: filters.dateFrom,
        date_to: filters.dateTo,
        department: filters.department,
      }),
      budgetsService.listBudgets().catch(() => ({ budgets: [] })),
      resourcesService.listResources({ department: filters.department }).catch(() => ({ resources: [] })),
      deliverablesService.listDeliverables().catch(() => ({ deliverables: [] })),
    ])
      .then(([projectsRes, budgetsRes, resourcesRes, deliverablesRes]) => {
        if (!active) return;
        setResult({
          key: requestKey,
          error: '',
          data: {
            projects: projectsRes?.projects || [],
            budgets: budgetsRes?.budgets || [],
            resources: resourcesRes?.resources || [],
            deliverables: deliverablesRes?.deliverables || [],
          },
        });
      })
      .catch((err) => {
        if (!active) return;
        setResult({ key: requestKey, data: null, error: err.message || 'Unable to load report data.' });
      });
    return () => {
      active = false;
    };
  }, [filters, requestKey]);

  const projectRows = useMemo(() => {
    if (!data) return [];
    const today = todayISO();
    return data.projects.map((project) => {
      const items = data.deliverables.filter((d) => d.project_id === project.id);
      const done = items.filter((d) => d.status === 'completed').length;
      return {
        ...project,
        deliverable_count: items.length,
        complete_pct: items.length ? (done / items.length) * 100 : 0,
        at_risk: Boolean(isAtRisk(project, today)),
      };
    });
  }, [data]);

  const budgetRows = useMemo(() => {
    if (!data) return [];
    // NUMERIC columns arrive as strings — coerce before any arithmetic.
    return data.budgets.map((budget) => {
      const planned = Number(budget.planned_amount) || 0;
      const actual = Number(budget.actual_spend) || 0;
      const remaining = budget.remaining_amount != null ? Number(budget.remaining_amount) : planned - actual;
      return {
        ...budget,
        planned,
        actual,
        remaining,
        utilisation_pct: planned > 0 ? (actual / planned) * 100 : 0,
        over_budget: actual > planned,
      };
    });
  }, [data]);

  const resourceRows = useMemo(() => {
    if (!data) return [];
    return data.resources.map((resource) => {
      const allocation = Number(resource.total_allocation_pct) || 0;
      const capacity = Number(resource.weekly_capacity) || 0;
      return { ...resource, allocation, capacity, over_allocated: allocation > capacity };
    });
  }, [data]);

  const deliverableRows = useMemo(() => {
    if (!data) return [];
    const today = todayISO();
    const projectNames = new Map(data.projects.map((p) => [p.id, p.name]));
    return data.deliverables
      .filter((d) => {
        // The deliverables API has no date filter, so the shared range is
        // applied here; an undated deliverable cannot satisfy a range.
        if (!filters.dateFrom && !filters.dateTo) return true;
        if (!d.due_date) return false;
        if (filters.dateFrom && d.due_date < filters.dateFrom) return false;
        if (filters.dateTo && d.due_date > filters.dateTo) return false;
        return true;
      })
      .map((d) => ({
        ...d,
        project_name: projectNames.get(d.project_id) || '',
        overdue: d.status !== 'completed' && Boolean(d.due_date) && d.due_date < today,
      }));
  }, [data, filters]);

  const rowsByReport = [projectRows, budgetRows, resourceRows, deliverableRows];
  const report = REPORTS[tab];
  const rows = rowsByReport[tab];

  function updateFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom sx={{ fontFamily: DISPLAY_FONT, fontWeight: 600, letterSpacing: '-0.01em' }}>
        Reports
      </Typography>
      <Typography variant="body1" color="text.secondary">
        Project, budget, resource and deliverable reports. Every table can be sorted, paged and exported to CSV.
      </Typography>
      {user && (
        <Typography variant="caption" color="text.secondary">
          Showing the data visible to {user.name} ({user.role}).
        </Typography>
      )}

      <Paper sx={{ p: 2, mt: 2 }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          <TextField
            label="From"
            type="date"
            value={filters.dateFrom}
            onChange={(e) => updateFilter('dateFrom', e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label="To"
            type="date"
            value={filters.dateTo}
            onChange={(e) => updateFilter('dateTo', e.target.value)}
            slotProps={{ inputLabel: { shrink: true } }}
          />
          <TextField
            label="Department"
            placeholder="All departments"
            value={filters.department}
            onChange={(e) => updateFilter('department', e.target.value)}
            sx={{ minWidth: 200 }}
          />
        </Stack>
      </Paper>

      <Tabs
        value={tab}
        onChange={(e, value) => setTab(value)}
        aria-label="Report type"
        variant="scrollable"
        scrollButtons="auto"
        sx={{ mt: 2, mb: 2, borderBottom: 1, borderColor: 'divider' }}
      >
        {REPORTS.map((r) => (
          <Tab key={r.key} label={r.label} id={`report-tab-${r.key}`} aria-controls={`report-panel-${r.key}`} />
        ))}
      </Tabs>

      <Box role="tabpanel" id={`report-panel-${report.key}`} aria-labelledby={`report-tab-${report.key}`}>
        <PageState
          loading={loading}
          error={error}
          empty={rows.length === 0}
          onRetry={() => setReloadToken((n) => n + 1)}
          emptyTitle={report.emptyTitle}
          emptyMessage={report.emptyMessage}
        >
          <DataTable
            key={report.key}
            title={report.title}
            columns={report.columns}
            rows={rows}
            defaultOrderBy={report.defaultOrderBy}
            defaultOrder={report.defaultOrder || 'asc'}
            exportFilename={report.exportFilename}
            emptyMessage={report.emptyMessage}
            dense
          />
        </PageState>
      </Box>
    </Box>
  );
}
