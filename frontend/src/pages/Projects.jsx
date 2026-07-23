/**
 * UI-03 Projects.
 *
 * req/Application_Flow.md §9 requires Status, Department, Project Manager,
 * Budget and Date Range filters; req/UI_UX_Design&UserFlow.md §12 requires
 * sorting, pagination and CSV export on every table (all three come from
 * components/DataTable) and §15/§16 the shared loading/empty/error states and a
 * confirmation dialog before anything destructive.
 */
import { useEffect, useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Link from '@mui/material/Link';
import MenuItem from '@mui/material/MenuItem';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import ConfirmDialog from '../components/ConfirmDialog';
import DataTable from '../components/DataTable';
import { EmptyState, ErrorState, LoadingState } from '../components/PageState';
import { parseCsv, mapImportRow } from '../utils/importCsv';
import * as projectsService from '../services/projectsService';
import * as usersService from '../services/usersService';
import { useAuth } from '../contexts/AuthContext';
import { useStatusColors, statusLabel } from '../theme';
import PageHeader from '../components/PageHeader';
import NewIndicator from '../components/NewIndicator';
import StatusIndicator from '../components/StatusIndicator';
import { AddIcon, UploadIcon } from '../components/icons';
import { EmptyWorkIllustration } from '../components/illustrations';

const STATUSES = ['active', 'completed', 'delayed', 'archived'];

const emptyForm = { name: '', description: '', department: '', manager_id: '', start_date: '', end_date: '' };

const emptyFilters = {
  status: '',
  department: '',
  manager_id: '',
  q: '',
  budget_min: '',
  budget_max: '',
  date_from: '',
  date_to: '',
};

/**
 * A blank control means "no bound", so blank keys are dropped rather than sent
 * as empty strings. projectsService.listProjects also skips falsy values, so
 * this is belt-and-braces — but it keeps the mocked call args in tests honest
 * about what actually reaches the API.
 */
function activeFilters(filters) {
  return Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== '' && value != null));
}

/** planned_amount is NUMERIC (a string over the wire) and null with no budget. */
function formatBudget(value) {
  if (value == null || value === '') return '—';
  const amount = Number(value);
  if (!Number.isFinite(amount)) return '—';
  return amount.toLocaleString(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
}

export default function Projects() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  // Mode-aware status palette (glow-up brief v2 §2) — the static STATUS_COLORS
  // object would go stale when the colour mode flips.
  const statusColors = useStatusColors();
  const [managers, setManagers] = useState([]);

  const [filters, setFilters] = useState({ ...emptyFilters, q: searchParams.get('q') || '' });

  // Bumping the token re-runs the fetch effect after a create/edit/archive.
  const [reloadToken, setReloadToken] = useState(0);

  // The result carries the request it answers, so "loading" is derived rather
  // than toggled — no state has to be written before the request is issued.
  const [result, setResult] = useState({ key: null, projects: [], error: '' });
  const requestKey = JSON.stringify({ ...filters, reloadToken });
  const loading = result.key !== requestKey;
  const projects = result.projects;
  const error = loading ? '' : result.error;

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  // The project the archive confirmation is currently asking about.
  const [archiveTarget, setArchiveTarget] = useState(null);
  const [toast, setToast] = useState('');

  const [importing, setImporting] = useState(false);
  // Non-null only when an import left rows behind — it opens the results dialog.
  const [importResult, setImportResult] = useState(null);

  const canCreate = user?.role === 'admin' || user?.role === 'project_manager';
  const filtered = Object.values(filters).some(Boolean);
  // Only the very first load gets the skeleton. Swapping the table out on every
  // refetch would unmount the filter controls the user is still typing into.
  const showSkeleton = loading && result.key === null;

  function reloadProjects() {
    setReloadToken((token) => token + 1);
  }

  useEffect(() => {
    let active = true;
    projectsService
      .listProjects(activeFilters(filters))
      .then((data) => {
        // The guard stops a slow response overwriting a newer one.
        if (active) setResult({ key: requestKey, projects: data.projects, error: '' });
      })
      .catch((err) => {
        if (active) setResult((prev) => ({ key: requestKey, projects: prev.projects, error: err.message }));
      });
    return () => {
      active = false;
    };
  }, [filters, requestKey]);

  useEffect(() => {
    if (user?.role === 'admin') {
      usersService
        .listUsers()
        .then((data) => setManagers(data.users.filter((u) => u.is_active && ['admin', 'project_manager'].includes(u.role))))
        .catch(() => {});
    }
  }, [user]);

  function updateFilter(key, value) {
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function openCreate() {
    setEditingId(null);
    setForm({ ...emptyForm, manager_id: user.role === 'project_manager' ? user.id : '' });
    setFormError('');
    setFormOpen(true);
  }

  function openEdit(project) {
    setEditingId(project.id);
    setForm({
      name: project.name,
      description: project.description || '',
      department: project.department || '',
      manager_id: project.manager_id,
      start_date: project.start_date || '',
      end_date: project.end_date || '',
    });
    setFormError('');
    setFormOpen(true);
  }

  function canManage(project) {
    return user?.role === 'admin' || user?.id === project.manager_id;
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      if (editingId) {
        await projectsService.updateProject(editingId, form);
        setToast(`${form.name} saved`);
      } else {
        await projectsService.createProject(form);
        setToast(`${form.name} created`);
      }
      setFormOpen(false);
      reloadProjects();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  // jsdom (and old Safari) lack File.text(), so the tests need FileReader.
  function readFileText(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsText(file);
    });
  }

  async function handleImportFile(e) {
    const file = e.target.files[0];
    // Clear the input so picking the same file again (after fixing it) re-fires.
    e.target.value = '';
    if (!file) return;
    setImporting(true);
    let imported = 0;
    const skipped = [];
    try {
      const { headers, rows } = parseCsv(await readFileText(file));
      for (let i = 0; i < rows.length; i += 1) {
        const rowNumber = i + 2; // the file's row 1 is the header line
        const { record, metadata } = mapImportRow(headers, rows[i], { defaultManagerId: user.id });
        if (!record.name) {
          skipped.push({ row: rowNumber, reason: 'no project name' });
          continue;
        }
        const payload = { ...record, metadata };
        // A null status means "let the backend default it to active" — sending
        // the key would trip enum validation.
        if (payload.status == null) delete payload.status;
        try {
          // Sequential on purpose: keeps file order and avoids hammering the API.
          await projectsService.createProject(payload);
          imported += 1;
        } catch (err) {
          skipped.push({ row: rowNumber, reason: err.message });
        }
      }
      reloadProjects();
      setToast(`${imported} projects imported`);
      if (skipped.length > 0) setImportResult({ imported, skipped });
    } catch (err) {
      // Unreadable or unparseable file — nothing was created yet.
      setToast(err.message);
    } finally {
      setImporting(false);
    }
  }

  // ConfirmDialog surfaces a rejection inline, so no try/catch here.
  async function handleArchive() {
    await projectsService.archiveProject(archiveTarget.id);
    setToast(`${archiveTarget.name} archived`);
    reloadProjects();
  }

  const columns = [
    {
      id: 'name',
      label: 'Name',
      render: (p) => (
        <>
          <Link component={RouterLink} to={`/projects/${p.id}`}>
            {p.name}
          </Link>
          <NewIndicator createdAt={p.created_at} />
        </>
      ),
    },
    { id: 'manager_name', label: 'Manager' },
    { id: 'department', label: 'Department', render: (p) => p.department || '—' },
    {
      id: 'status',
      label: 'Status',
      // Status meaning is a dot + label (glow-up brief v2 §2); filled Chips
      // stay reserved for counts/badges.
      render: (p) => <StatusIndicator color={statusColors[p.status] || 'grey.500'} label={statusLabel(p.status)} />,
    },
    {
      id: 'planned_amount',
      label: 'Budget',
      align: 'right',
      // Nulls sort last in DataTable, which is right for "no budget yet".
      sortValue: (p) => (p.planned_amount == null ? null : Number(p.planned_amount)),
      exportValue: (p) => (p.planned_amount == null ? '' : String(p.planned_amount)),
      render: (p) => formatBudget(p.planned_amount),
    },
    { id: 'start_date', label: 'Start', render: (p) => p.start_date || '—' },
    { id: 'end_date', label: 'End', render: (p) => p.end_date || '—' },
    {
      id: 'actions',
      label: 'Actions',
      align: 'right',
      sortable: false,
      exportable: false,
      render: (p) =>
        canManage(p) ? (
          <>
            <Button size="small" onClick={() => openEdit(p)}>
              Edit
            </Button>
            {p.status !== 'archived' && (
              <Button size="small" color="error" onClick={() => setArchiveTarget(p)}>
                Archive
              </Button>
            )}
          </>
        ) : null,
    },
  ];

  // Grouped in pairs so the six controls stay legible when the main column
  // collapses to roughly 360px on mobile.
  const toolbar = (
    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 2, flexGrow: 1 }}>
      <TextField
        label="Search" size="small" sx={{ minWidth: 200, flexGrow: 1 }}
        placeholder="Search by name or description"
        value={filters.q}
        onChange={(e) => updateFilter('q', e.target.value)}
      />
      <Stack direction="row" spacing={2}>
        <TextField
          select label="Status" size="small" sx={{ minWidth: 130 }}
          value={filters.status}
          onChange={(e) => updateFilter('status', e.target.value)}
        >
          <MenuItem value="">All</MenuItem>
          {STATUSES.map((s) => <MenuItem key={s} value={s}>{statusLabel(s)}</MenuItem>)}
        </TextField>
        <TextField
          label="Department" size="small" sx={{ minWidth: 130 }}
          value={filters.department}
          onChange={(e) => updateFilter('department', e.target.value)}
        />
      </Stack>
      {managers.length > 0 && (
        <TextField
          select label="Manager" size="small" sx={{ minWidth: 160 }}
          value={filters.manager_id}
          onChange={(e) => updateFilter('manager_id', e.target.value)}
        >
          <MenuItem value="">All</MenuItem>
          {managers.map((m) => <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>)}
        </TextField>
      )}
      <Stack direction="row" spacing={2}>
        <TextField
          label="Min Budget" type="number" size="small" sx={{ minWidth: 130 }}
          value={filters.budget_min}
          onChange={(e) => updateFilter('budget_min', e.target.value)}
        />
        <TextField
          label="Max Budget" type="number" size="small" sx={{ minWidth: 130 }}
          value={filters.budget_max}
          onChange={(e) => updateFilter('budget_max', e.target.value)}
        />
      </Stack>
      <Stack direction="row" spacing={2}>
        {/* Backend semantics: start_date >= date_from, end_date <= date_to. */}
        <TextField
          label="Start From" type="date" size="small" sx={{ minWidth: 150 }}
          slotProps={{ inputLabel: { shrink: true } }}
          value={filters.date_from}
          onChange={(e) => updateFilter('date_from', e.target.value)}
        />
        <TextField
          label="End By" type="date" size="small" sx={{ minWidth: 150 }}
          slotProps={{ inputLabel: { shrink: true } }}
          value={filters.date_to}
          onChange={(e) => updateFilter('date_to', e.target.value)}
        />
      </Stack>
    </Box>
  );

  return (
    <Box>
      <PageHeader
        title="Projects"
        summary={
          !loading && !error
            ? `${projects.length} projects · ${projects.filter((p) => p.status === 'active').length} active · ${projects.filter((p) => p.status === 'delayed').length} delayed`
            : undefined
        }
        action={
          canCreate && (
            <Button variant="contained" startIcon={<AddIcon size={18} />} onClick={openCreate}>
              New Project
            </Button>
          )
        }
      />

      {showSkeleton && <LoadingState variant="table" label="Loading projects…" />}

      {!showSkeleton && error && (
        <ErrorState title="Could not load projects" error={error} onRetry={reloadProjects} />
      )}

      {/* With no filters applied there is nothing to filter, so the toolbar can
          go and the §15 call to action takes the whole screen. */}
      {!showSkeleton && !error && projects.length === 0 && !filtered && (
        <EmptyState
          icon={<EmptyWorkIllustration />}
          title="No projects yet"
          message="Create a project to start tracking its deliverables, resources and budget."
          actionLabel={canCreate ? 'New Project' : undefined}
          onAction={canCreate ? openCreate : undefined}
        />
      )}

      {!showSkeleton && !error && (projects.length > 0 || filtered) && (
        <DataTable
          columns={columns}
          rows={projects}
          defaultOrderBy="name"
          exportFilename="projects.csv"
          emptyMessage="No projects match these filters."
          toolbar={toolbar}
          actions={
            canCreate && (
              // component="label" makes the whole button the file input's label,
              // so no ref/click plumbing is needed to open the picker.
              <Button size="small" component="label" startIcon={<UploadIcon />} disabled={importing}>
                {importing ? 'Importing…' : 'Import'}
                <input
                  type="file"
                  accept=".csv"
                  hidden
                  disabled={importing}
                  aria-label="Import projects from CSV"
                  onChange={handleImportFile}
                />
              </Button>
            )
          }
        />
      )}

      <ConfirmDialog
        open={Boolean(archiveTarget)}
        title="Archive this project?"
        message="It will no longer accept new deliverables."
        confirmLabel="Archive"
        onConfirm={handleArchive}
        onClose={() => setArchiveTarget(null)}
      />

      {/* fullWidth / maxWidth="sm" come from the theme's MuiDialog defaults. */}
      <Dialog open={formOpen} onClose={() => setFormOpen(false)}>
        <Box component="form" onSubmit={handleSubmit}>
          <DialogTitle>{editingId ? 'Edit Project' : 'New Project'}</DialogTitle>
          <DialogContent>
            {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
            <TextField
              label="Name" fullWidth required margin="dense"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
            />
            <TextField
              label="Description" fullWidth multiline rows={2} margin="dense"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            <TextField
              label="Department" fullWidth margin="dense"
              value={form.department}
              onChange={(e) => setForm({ ...form, department: e.target.value })}
            />

            {user?.role === 'admin' ? (
              <TextField
                select label="Manager" fullWidth required margin="dense"
                value={form.manager_id}
                onChange={(e) => setForm({ ...form, manager_id: e.target.value })}
              >
                {managers.map((m) => (
                  <MenuItem key={m.id} value={m.id}>{m.name} ({m.role})</MenuItem>
                ))}
              </TextField>
            ) : (
              <TextField
                label="Manager" fullWidth margin="dense" disabled
                value={user?.name || ''}
              />
            )}

            <Stack direction="row" spacing={2}>
              <TextField
                label="Start Date" type="date" fullWidth margin="dense"
                slotProps={{ inputLabel: { shrink: true } }}
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              />
              <TextField
                label="End Date" type="date" fullWidth margin="dense"
                slotProps={{ inputLabel: { shrink: true } }}
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Save' : 'Create'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Dialog open={Boolean(importResult)} onClose={() => setImportResult(null)}>
        <DialogTitle>Import results</DialogTitle>
        <DialogContent>
          {importResult && (
            <>
              <Typography variant="body2" sx={{ mb: 1 }}>
                {importResult.imported} imported · {importResult.skipped.length} skipped
              </Typography>
              {importResult.skipped.map((s) => (
                <Typography key={s.row} variant="body2" color="text.secondary">
                  Row {s.row}: {s.reason}
                </Typography>
              ))}
            </>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setImportResult(null)}>Close</Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={!!toast}
        autoHideDuration={4000}
        onClose={() => setToast('')}
        message={toast}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
}
