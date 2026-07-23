/**
 * UI-06 — Deliverables.
 *
 * Organisation-wide deliverables list. Deliverables are otherwise only reachable
 * per project (components/DeliverablesPanel.jsx); this screen is the cross-project
 * view team members use to track everything assigned to them.
 */
import { useEffect, useMemo, useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import Link from '@mui/material/Link';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import DataTable from '../components/DataTable';
import { EmptyState, ErrorState, LoadingState } from '../components/PageState';
import * as deliverablesService from '../services/deliverablesService';
import * as projectsService from '../services/projectsService';
import * as usersService from '../services/usersService';
import { useAuth } from '../contexts/AuthContext';
import { useStatusColors } from '../theme';
import PageHeader from '../components/PageHeader';
import { EmptyWorkIllustration } from '../components/illustrations';
import StatusIndicator from '../components/StatusIndicator';

const STATUSES = ['not_started', 'in_progress', 'blocked', 'completed'];

/** ISO day string, so due dates (also ISO days) can be compared as plain text. */
function today() {
  return new Date().toISOString().slice(0, 10);
}

function StatusChip({ status }) {
  const statusColors = useStatusColors();
  return <StatusIndicator color={statusColors[status] || 'grey.500'} label={status} />;
}

export default function Deliverables() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  // `null` means "not loaded yet", which is what drives the skeleton — keeping
  // it in the data itself avoids a second flag the effect would have to set
  // synchronously on every filter change.
  const [deliverables, setDeliverables] = useState(null);
  const [projects, setProjects] = useState([]);
  const [owners, setOwners] = useState([]);
  const [error, setError] = useState('');
  const [actionError, setActionError] = useState('');
  const [reloadToken, setReloadToken] = useState(0);

  const [filters, setFilters] = useState({
    q: searchParams.get('q') || '',
    status: '',
    project_id: '',
    owner_id: '',
  });

  useEffect(() => {
    let active = true;
    deliverablesService
      .listDeliverables(filters)
      .then((data) => {
        if (!active) return;
        setDeliverables(data.deliverables);
        setError('');
      })
      .catch((err) => {
        if (!active) return;
        setError(err.message);
        setDeliverables([]);
      });
    return () => {
      active = false;
    };
  }, [filters, reloadToken]);

  function retry() {
    setDeliverables(null);
    setError('');
    setReloadToken((token) => token + 1);
  }

  // The deliverables API returns project_id only, so project names (and the
  // Project filter) come from the projects list. A failure here degrades to
  // "—" rather than failing the whole screen.
  useEffect(() => {
    projectsService
      .listProjects()
      .then((data) => setProjects(data.projects))
      .catch(() => {});
  }, []);

  // /users is admin-only.
  useEffect(() => {
    if (user?.role === 'admin') {
      usersService
        .listUsers()
        .then((data) => setOwners(data.users.filter((u) => u.is_active)))
        .catch(() => {});
    }
  }, [user]);

  const projectsById = useMemo(() => new Map(projects.map((p) => [p.id, p])), [projects]);

  function projectName(d) {
    return projectsById.get(d.project_id)?.name || '—';
  }

  /** Admin, the owning project's manager, or the deliverable's own owner. */
  function canEdit(d) {
    if (!user) return false;
    if (user.role === 'admin') return true;
    if (d.owner_id && user.id === d.owner_id) return true;
    return projectsById.get(d.project_id)?.manager_id === user.id;
  }

  function isOverdue(d) {
    return d.status !== 'completed' && Boolean(d.due_date) && d.due_date < today();
  }

  async function handleStatusChange(deliverable, status) {
    setActionError('');
    try {
      await deliverablesService.updateDeliverable(deliverable.id, { status });
      setDeliverables((prev) =>
        prev.map((d) => (d.id === deliverable.id ? { ...d, status } : d))
      );
    } catch (err) {
      setActionError(err.message);
    }
  }

  const columns = [
    {
      id: 'title',
      label: 'Title',
      sortValue: (d) => d.title,
      render: (d) => (
        <Link component={RouterLink} to={`/projects/${d.project_id}`} underline="hover">
          {d.title}
        </Link>
      ),
    },
    { id: 'project', label: 'Project', sortValue: projectName },
    { id: 'owner', label: 'Owner', sortValue: (d) => d.owner_name || 'Unassigned' },
    {
      id: 'status',
      label: 'Status',
      width: 180,
      exportValue: (d) => d.status,
      render: (d) =>
        canEdit(d) ? (
          <TextField
            select
            value={d.status}
            onChange={(e) => handleStatusChange(d, e.target.value)}
            SelectProps={{ inputProps: { 'aria-label': `Status for ${d.title}` } }}
            sx={{ minWidth: 150 }}
          >
            {STATUSES.map((s) => (
              <MenuItem key={s} value={s}>
                {s}
              </MenuItem>
            ))}
          </TextField>
        ) : (
          <StatusChip status={d.status} />
        ),
    },
    {
      id: 'due_date',
      label: 'Due Date',
      exportValue: (d) => d.due_date || '',
      render: (d) => (
        <Stack direction="row" spacing={1} alignItems="center">
          <Typography
            component="span"
            variant="body2"
            color={isOverdue(d) ? 'error.main' : 'text.primary'}
            sx={{ fontWeight: isOverdue(d) ? 600 : 400 }}
          >
            {d.due_date || '—'}
          </Typography>
          {isOverdue(d) && <Chip color="error" label="Overdue" />}
        </Stack>
      ),
    },
  ];

  const rows = deliverables || [];
  const loading = deliverables === null && !error;
  const hasFilters = Object.values(filters).some(Boolean);

  return (
    <Box>
      <PageHeader
        title="Deliverables"
        summary={
          !loading && !error
            ? `${rows.length} deliverables · ${rows.filter((d) => d.status === 'in_progress').length} in progress · ${rows.filter((d) => d.status === 'blocked').length} blocked`
            : undefined
        }
      />

      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap sx={{ mb: 2 }}>
        <TextField
          label="Search"
          sx={{ minWidth: 220 }}
          placeholder="Search by title or description"
          value={filters.q}
          onChange={(e) => setFilters({ ...filters, q: e.target.value })}
        />
        <TextField
          select
          label="Status"
          sx={{ minWidth: 160 }}
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
        >
          <MenuItem value="">All</MenuItem>
          {STATUSES.map((s) => (
            <MenuItem key={s} value={s}>
              {s}
            </MenuItem>
          ))}
        </TextField>
        <TextField
          select
          label="Project"
          sx={{ minWidth: 200 }}
          value={filters.project_id}
          onChange={(e) => setFilters({ ...filters, project_id: e.target.value })}
        >
          <MenuItem value="">All</MenuItem>
          {projects.map((p) => (
            <MenuItem key={p.id} value={p.id}>
              {p.name}
            </MenuItem>
          ))}
        </TextField>
        {owners.length > 0 && (
          <TextField
            select
            label="Owner"
            sx={{ minWidth: 180 }}
            value={filters.owner_id}
            onChange={(e) => setFilters({ ...filters, owner_id: e.target.value })}
          >
            <MenuItem value="">All</MenuItem>
            {owners.map((o) => (
              <MenuItem key={o.id} value={o.id}>
                {o.name}
              </MenuItem>
            ))}
          </TextField>
        )}
      </Stack>

      {actionError && (
        <Alert severity="error" sx={{ mb: 2 }}>
          {actionError}
        </Alert>
      )}

      {loading && <LoadingState variant="table" />}
      {!loading && error && <ErrorState error={error} onRetry={retry} />}
      {!loading && !error && rows.length === 0 && (
        <EmptyState
          icon={<EmptyWorkIllustration />}
          title="No deliverables found"
          message={
            hasFilters
              ? 'No deliverables match the current filters. Try clearing them.'
              : 'Deliverables are created from a project’s Deliverables tab.'
          }
        />
      )}
      {!loading && !error && rows.length > 0 && (
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(d) => d.id}
          defaultOrderBy="due_date"
          defaultOrder="asc"
          exportFilename="deliverables.csv"
          emptyMessage="No deliverables found."
        />
      )}
    </Box>
  );
}
