/**
 * Teams list (team management module).
 *
 * Lists every team with its rollups (leader, member count, reporting line) and
 * owns the create/edit/delete dialogs. Rosters and achievements live on the
 * team details page. Reads are open to every role; writes are for admins and
 * project managers (the backend enforces the same rule).
 */
import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Link from '@mui/material/Link';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import { AddIcon } from '../components/icons';

import DataTable from '../components/DataTable';
import ConfirmDialog from '../components/ConfirmDialog';
import MetadataEditor from '../components/MetadataEditor';
import { toPairs, fromPairs } from '../utils/metadata';
import { EmptyState, ErrorState, LoadingState } from '../components/PageState';
import { useAuth } from '../contexts/AuthContext';
import * as teamsService from '../services/teamsService';
import PageHeader from '../components/PageHeader';
import { EmptyPeopleIllustration } from '../components/illustrations';

const emptyForm = { name: '', location: '', leader_id: '', reports_to_id: '', pairs: [] };

export default function Teams() {
  const { user } = useAuth();
  const canManage = user?.role === 'admin' || user?.role === 'project_manager';

  // Server-side search (req/UI_UX_Design&UserFlow.md §12) — the teams API
  // matches on name or location.
  const [search, setSearch] = useState('');

  const [reloadToken, setReloadToken] = useState(0);
  const [result, setResult] = useState({ key: null, teams: [], error: '' });
  const requestKey = JSON.stringify({ search, reloadToken });
  const loading = result.key !== requestKey;
  const { teams } = result;
  const error = loading ? '' : result.error;
  // Only the very first load gets the skeleton — swapping the table out on
  // every keystroke would unmount the search field the user is typing into.
  const showSkeleton = loading && result.key === null;

  // Individuals feed the leader / reports-to selects in the dialog; a failure
  // here just leaves those selects empty, it shouldn't sink the list.
  const [individuals, setIndividuals] = useState([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState(null);
  const [toast, setToast] = useState('');

  function reload() {
    setReloadToken((token) => token + 1);
  }

  useEffect(() => {
    let active = true;
    teamsService
      .listTeams(search)
      .then((data) => {
        // The guard stops a slow response overwriting a newer one.
        if (active) setResult({ key: requestKey, teams: data.teams, error: '' });
      })
      .catch((err) => {
        if (active) setResult((prev) => ({ key: requestKey, teams: prev.teams, error: err.message }));
      });
    return () => {
      active = false;
    };
  }, [search, requestKey]);

  useEffect(() => {
    teamsService
      .listIndividuals()
      .then((data) => setIndividuals(data.individuals))
      .catch(() => {});
  }, []);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError('');
    setDialogOpen(true);
  }

  function openEdit(row) {
    setEditing(row.id);
    setForm({
      name: row.name,
      location: row.location,
      leader_id: row.leader_id ?? '',
      reports_to_id: row.reports_to_id ?? '',
      pairs: toPairs(row.metadata),
    });
    setFormError('');
    setDialogOpen(true);
  }

  async function handleSave(e) {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    const payload = {
      name: form.name,
      location: form.location,
      leader_id: form.leader_id === '' ? null : form.leader_id,
      reports_to_id: form.reports_to_id === '' ? null : form.reports_to_id,
      metadata: fromPairs(form.pairs),
    };
    try {
      if (editing) {
        await teamsService.updateTeam(editing, payload);
        setToast(`${form.name} saved`);
      } else {
        await teamsService.createTeam(payload);
        setToast(`${form.name} created`);
      }
      setDialogOpen(false);
      reload();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete() {
    await teamsService.deleteTeam(deleteTarget.id);
    setToast(`${deleteTarget.name} deleted`);
    reload();
  }

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
    { id: 'leader_name', label: 'Leader', render: (row) => row.leader_name || '—' },
    { id: 'member_count', label: 'Members', align: 'right' },
    { id: 'reports_to_name', label: 'Reports to', render: (row) => row.reports_to_name || '—' },
    ...(canManage
      ? [
          {
            id: 'actions',
            label: 'Actions',
            align: 'right',
            sortable: false,
            exportable: false,
            render: (row) => (
              <>
                <Button size="small" onClick={() => openEdit(row)}>
                  Edit
                </Button>
                <Button size="small" color="error" onClick={() => setDeleteTarget(row)}>
                  Delete
                </Button>
              </>
            ),
          },
        ]
      : []),
  ];

  return (
    <Box>
      <PageHeader
        title="Teams"
        summary={
          !loading && !error
            ? `${teams.length} teams · ${teams.reduce((sum, t) => sum + Number(t.member_count || 0), 0)} members across ${new Set(teams.map((t) => t.location)).size} locations`
            : undefined
        }
        action={
          canManage && (
            <Button variant="contained" startIcon={<AddIcon size={18} />} onClick={openCreate}>
              Add team
            </Button>
          )
        }
      />

      {showSkeleton && <LoadingState variant="table" label="Loading teams…" />}

      {!showSkeleton && error && <ErrorState title="Could not load teams" error={error} onRetry={reload} />}

      {/* With no search applied there is nothing to filter, so the toolbar can
          go and the §15 call to action takes the whole screen. */}
      {!showSkeleton && !error && teams.length === 0 && !search && (
        <EmptyState
          icon={<EmptyPeopleIllustration />}
          title="No teams yet"
          message="Create your first team, then add members and monthly achievements from its page."
          actionLabel={canManage ? 'Add team' : undefined}
          onAction={canManage ? openCreate : undefined}
        />
      )}

      {!showSkeleton && !error && (teams.length > 0 || search) && (
        <DataTable
          columns={columns}
          rows={teams}
          defaultOrderBy="name"
          exportFilename="teams.csv"
          emptyMessage="No teams match this search."
          toolbar={
            <TextField
              label="Search" size="small" sx={{ minWidth: 200, flexGrow: 1 }}
              placeholder="Search by name or location"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          }
        />
      )}

      <Dialog
        open={dialogOpen}
        onClose={() => !saving && setDialogOpen(false)}
        fullWidth
        maxWidth="xs"
        aria-labelledby="team-dialog-title"
      >
        <Box component="form" onSubmit={handleSave}>
          <DialogContent sx={{ pt: 4, px: 4 }}>
            <Typography id="team-dialog-title" variant="h6" component="h2" sx={{ mb: 0.5 }}>
              {editing ? 'Edit team' : 'Add a team'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              The leader and reporting line come from the Individuals directory.
            </Typography>

            {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}

            <Stack spacing={2}>
              <TextField
                label="Team name" fullWidth required autoFocus
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <TextField
                label="Location" fullWidth required
                placeholder="City, e.g. Austin"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
              <TextField
                select label="Team leader" fullWidth
                value={form.leader_id}
                onChange={(e) => setForm({ ...form, leader_id: e.target.value })}
              >
                <MenuItem value="">No leader yet</MenuItem>
                {individuals.map((person) => (
                  <MenuItem key={person.id} value={person.id}>
                    {person.name} · {person.location}
                  </MenuItem>
                ))}
              </TextField>
              <TextField
                select label="Reports to" fullWidth
                value={form.reports_to_id}
                onChange={(e) => setForm({ ...form, reports_to_id: e.target.value })}
              >
                <MenuItem value="">Nobody</MenuItem>
                {individuals.map((person) => (
                  <MenuItem key={person.id} value={person.id}>
                    {person.name}
                    {person.is_org_leader ? ' · org leader' : ''}
                  </MenuItem>
                ))}
              </TextField>
            </Stack>

            <MetadataEditor
              pairs={form.pairs}
              onChange={(pairs) => setForm({ ...form, pairs })}
            />
          </DialogContent>
          <DialogActions sx={{ px: 4, pb: 3 }}>
            <Button onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={saving}>
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add team'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        title={deleteTarget ? `Delete ${deleteTarget.name}?` : ''}
        message="Its roster and achievement history will be deleted with it."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />

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
