/**
 * UI-05 Resources.
 *
 * The roster of people who can be allocated to projects.
 * req/UI_UX_Design&UserFlow.md §12 gets sorting, pagination and CSV export from
 * components/DataTable; §15 gets the shared loading/empty/error states.
 */
import { useEffect, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import LinearProgress from '@mui/material/LinearProgress';
import MenuItem from '@mui/material/MenuItem';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import DataTable from '../components/DataTable';
import { EmptyState, ErrorState, LoadingState } from '../components/PageState';
import * as resourcesService from '../services/resourcesService';
import * as usersService from '../services/usersService';
import { useAuth } from '../contexts/AuthContext';

const emptyForm = { user_id: '', title: '', department: '', weekly_capacity: 100 };

/** Blank controls mean "no filter", so they are dropped before the request. */
function activeFilters(filters) {
  return Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== '' && value != null));
}

function allocationOf(r) {
  return Number(r.total_allocation_pct) || 0;
}

function capacityOf(r) {
  return Number(r.weekly_capacity) || 0;
}

export default function Resources() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [filters, setFilters] = useState({ q: '', department: '' });

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');

  // Bumping the token re-runs the fetch effect after a create/edit.
  const [reloadToken, setReloadToken] = useState(0);

  // The result carries the request it answers, so "loading" is derived rather
  // than toggled — no state has to be written before the request is issued.
  const [result, setResult] = useState({ key: null, resources: [], error: '' });
  const requestKey = JSON.stringify({ ...filters, reloadToken });
  const loading = result.key !== requestKey;
  const resources = result.resources;
  const error = loading ? '' : result.error;

  // Resource records are org-wide master data, so creating/editing them is Admin-only
  // (see backend/resources-service). Project Managers manage allocations, not resources.
  const canManage = user?.role === 'admin';
  const filtered = Object.values(filters).some(Boolean);
  // Only the very first load gets the skeleton. Swapping the table out on every
  // refetch would unmount the filter controls the user is still typing into.
  const showSkeleton = loading && result.key === null;

  function load() {
    setReloadToken((token) => token + 1);
  }

  useEffect(() => {
    let active = true;
    resourcesService
      .listResources(activeFilters(filters))
      .then((data) => {
        // The guard stops a slow response overwriting a newer one.
        if (active) setResult({ key: requestKey, resources: data.resources, error: '' });
      })
      .catch((err) => {
        if (active) setResult((prev) => ({ key: requestKey, resources: prev.resources, error: err.message }));
      });
    return () => {
      active = false;
    };
  }, [filters, requestKey]);

  useEffect(() => {
    if (canManage) {
      usersService.listUsers().then((data) => setUsers(data.users.filter((u) => u.is_active))).catch(() => {});
    }
  }, [canManage]);

  function updateFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setFormError('');
    setFormOpen(true);
  }

  function openEdit(r) {
    setEditingId(r.id);
    setForm({ user_id: r.user_id, title: r.title || '', department: r.department || '', weekly_capacity: r.weekly_capacity });
    setFormError('');
    setFormOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    try {
      if (editingId) {
        await resourcesService.updateResource(editingId, {
          title: form.title, department: form.department, weekly_capacity: form.weekly_capacity,
        });
      } else {
        await resourcesService.createResource(form);
      }
      setFormOpen(false);
      load();
    } catch (err) {
      setFormError(err.message);
    }
  }

  const columns = [
    { id: 'user_name', label: 'Name' },
    { id: 'title', label: 'Title', render: (r) => r.title || '—' },
    { id: 'department', label: 'Department', render: (r) => r.department || '—' },
    {
      id: 'total_allocation_pct',
      label: 'Utilization',
      width: 220,
      sortValue: (r) => allocationOf(r),
      exportValue: (r) => `${allocationOf(r)}/${capacityOf(r)}%`,
      render: (r) => {
        const pct = allocationOf(r);
        const capacity = capacityOf(r);
        return (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
            <LinearProgress
              variant="determinate"
              value={Math.min(pct, 100)}
              color={pct > capacity ? 'error' : 'primary'}
              sx={{ flexGrow: 1, height: 8, borderRadius: 4 }}
            />
            <Typography variant="caption">{pct}/{capacity}%</Typography>
          </Box>
        );
      },
    },
    {
      id: 'over_allocated',
      label: 'Over-allocated',
      align: 'center',
      sortValue: (r) => (allocationOf(r) > capacityOf(r) ? 1 : 0),
      exportValue: (r) => (allocationOf(r) > capacityOf(r) ? 'Yes' : 'No'),
      render: (r) =>
        allocationOf(r) > capacityOf(r) ? (
          <Chip size="small" color="error" label="Over-allocated" />
        ) : (
          <Typography variant="body2" color="text.secondary">—</Typography>
        ),
    },
  ];

  if (canManage) {
    columns.push({
      id: 'actions',
      label: 'Actions',
      align: 'right',
      sortable: false,
      exportable: false,
      render: (r) => (
        <Button size="small" onClick={() => openEdit(r)}>
          Edit
        </Button>
      ),
    });
  }

  const toolbar = (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, flexGrow: 1 }}>
      <TextField
        label="Search" size="small" sx={{ minWidth: 200, flexGrow: 1 }}
        placeholder="Search by name or title"
        value={filters.q}
        onChange={(e) => updateFilter('q', e.target.value)}
      />
      <TextField
        label="Department" size="small" sx={{ minWidth: 150 }}
        value={filters.department}
        onChange={(e) => updateFilter('department', e.target.value)}
      />
    </Box>
  );

  return (
    <Box>
      <Typography variant="h4" component="h1" sx={{ mb: 2 }}>
        Resources
      </Typography>

      {showSkeleton && <LoadingState variant="table" label="Loading resources…" />}

      {!showSkeleton && error && (
        <ErrorState title="Could not load resources" error={error} onRetry={load} />
      )}

      {/* With no filters applied there is nothing to filter, so the toolbar can
          go and the §15 call to action takes the whole screen. */}
      {!showSkeleton && !error && resources.length === 0 && !filtered && (
        <EmptyState
          title="No resources yet"
          message="Add a resource to make someone available for project allocation."
          actionLabel={canManage ? 'Add Resource' : undefined}
          onAction={canManage ? openCreate : undefined}
        />
      )}

      {!showSkeleton && !error && (resources.length > 0 || filtered) && (
        <DataTable
          columns={columns}
          rows={resources}
          defaultOrderBy="user_name"
          exportFilename="resources.csv"
          emptyMessage="No resources match these filters."
          toolbar={toolbar}
          actions={
            canManage ? (
              <Button variant="contained" onClick={openCreate}>
                Add Resource
              </Button>
            ) : null
          }
        />
      )}

      <Dialog open={formOpen} onClose={() => setFormOpen(false)} fullWidth maxWidth="xs">
        <Box component="form" onSubmit={handleSubmit}>
          <DialogTitle>{editingId ? 'Edit Resource' : 'Add Resource'}</DialogTitle>
          <DialogContent>
            {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}

            {!editingId && (
              <TextField
                select label="User" fullWidth required margin="dense"
                value={form.user_id}
                onChange={(e) => setForm({ ...form, user_id: e.target.value })}
              >
                {users.map((u) => <MenuItem key={u.id} value={u.id}>{u.name} ({u.role})</MenuItem>)}
              </TextField>
            )}

            <TextField
              label="Title" fullWidth margin="dense"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <TextField
              label="Department" fullWidth margin="dense"
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
            />
            <TextField
              label="Weekly Capacity %" type="number" fullWidth margin="dense"
              value={form.weekly_capacity}
              onChange={(e) => setForm({ ...form, weekly_capacity: e.target.value })}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained">{editingId ? 'Save' : 'Create'}</Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
}
