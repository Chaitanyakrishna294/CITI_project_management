/**
 * Individuals directory (team management module).
 *
 * People here are org roster entries, not login accounts — the workshop brief
 * explicitly excludes Employee Directory integration, so the roster is
 * maintained by hand. Reads are open to every role; writes are for admins and
 * project managers (the backend enforces the same rule).
 */
import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';
import { AddPersonIcon } from '../components/icons';

import DataTable from '../components/DataTable';
import StatusIndicator from '../components/StatusIndicator';
import ConfirmDialog from '../components/ConfirmDialog';
import MetadataEditor from '../components/MetadataEditor';
import { toPairs, fromPairs } from '../utils/metadata';
import { EmptyState, ErrorState, LoadingState } from '../components/PageState';
import { useAuth } from '../contexts/AuthContext';
import * as teamsService from '../services/teamsService';
import PageHeader from '../components/PageHeader';
import { EmptyPeopleIllustration } from '../components/illustrations';

const emptyForm = {
  name: '',
  email: '',
  location: '',
  is_direct_staff: true,
  is_org_leader: false,
  pairs: [],
};

export default function Individuals() {
  const { user } = useAuth();
  const canManage = user?.role === 'admin' || user?.role === 'project_manager';

  const [reloadToken, setReloadToken] = useState(0);
  const [result, setResult] = useState({ key: null, individuals: [], error: '' });
  const requestKey = String(reloadToken);
  const loading = result.key !== requestKey;
  const individuals = result.individuals;
  const error = loading ? '' : result.error;

  // One dialog serves create and edit; `editing` holds the row id when editing.
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
      .listIndividuals()
      .then((data) => {
        if (active) setResult({ key: requestKey, individuals: data.individuals, error: '' });
      })
      .catch((err) => {
        if (active) setResult((prev) => ({ key: requestKey, individuals: prev.individuals, error: err.message }));
      });
    return () => {
      active = false;
    };
  }, [requestKey]);

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
      email: row.email || '',
      location: row.location,
      is_direct_staff: row.is_direct_staff,
      is_org_leader: row.is_org_leader,
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
      email: form.email || null,
      location: form.location,
      is_direct_staff: form.is_direct_staff,
      is_org_leader: form.is_org_leader,
      metadata: fromPairs(form.pairs),
    };
    try {
      if (editing) {
        await teamsService.updateIndividual(editing, payload);
        setToast('Changes saved');
      } else {
        await teamsService.createIndividual(payload);
        setToast(`${form.name} added`);
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
    await teamsService.deleteIndividual(deleteTarget.id);
    setToast(`${deleteTarget.name} removed`);
    reload();
  }

  const columns = [
    { id: 'name', label: 'Name' },
    { id: 'email', label: 'Email' },
    { id: 'location', label: 'Location' },
    {
      id: 'is_direct_staff',
      label: 'Staff type',
      // Staff type is state, not a count, so it renders as dot+label per the
      // glow-up brief v2 §2 — the same treatment TeamInsights gives this state.
      // Only the notable value gets a mark, in neutral slate: a non-direct
      // roster entry is a fact, not a "needs acting on" signal, so the ochre
      // accent stays reserved for the insights flags.
      render: (row) =>
        row.is_direct_staff ? 'Direct' : <StatusIndicator color="secondary.main" label="Non-direct" />,
      sortValue: (row) => (row.is_direct_staff ? 0 : 1),
      exportValue: (row) => (row.is_direct_staff ? 'Direct' : 'Non-direct'),
    },
    {
      id: 'is_org_leader',
      label: 'Org leader',
      render: (row) => (row.is_org_leader ? <Chip size="small" color="primary" label="Org leader" /> : null),
      sortValue: (row) => (row.is_org_leader ? 0 : 1),
      exportValue: (row) => (row.is_org_leader ? 'Yes' : 'No'),
    },
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
        title="Individuals"
        summary={
          !loading && !error
            ? `${individuals.length} people · ${individuals.filter((i) => !i.is_direct_staff).length} non-direct · ${individuals.filter((i) => i.is_org_leader).length} org leaders`
            : undefined
        }
        action={
          canManage && (
            <Button variant="contained" startIcon={<AddPersonIcon size={18} />} onClick={openCreate}>
              Add individual
            </Button>
          )
        }
      />

      {loading && <LoadingState variant="table" label="Loading individuals…" />}

      {!loading && error && <ErrorState title="Could not load individuals" error={error} onRetry={reload} />}

      {!loading && !error && individuals.length === 0 && (
        <EmptyState
          icon={<EmptyPeopleIllustration />}
          title="No individuals yet"
          message="Add the people who make up your teams — members, leaders, and the leaders they report to."
          actionLabel={canManage ? 'Add individual' : undefined}
          onAction={canManage ? openCreate : undefined}
        />
      )}

      {!loading && !error && individuals.length > 0 && (
        <DataTable
          columns={columns}
          rows={individuals}
          defaultOrderBy="name"
          exportFilename="individuals.csv"
        />
      )}

      <Dialog
        open={dialogOpen}
        onClose={() => !saving && setDialogOpen(false)}
        fullWidth
        maxWidth="xs"
        aria-labelledby="individual-dialog-title"
      >
        <Box component="form" onSubmit={handleSave}>
          <DialogContent sx={{ pt: 4, px: 4 }}>
            <Typography id="individual-dialog-title" variant="h6" component="h2" sx={{ mb: 0.5 }}>
              {editing ? 'Edit individual' : 'Add an individual'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              Location and staff type feed the team insights.
            </Typography>

            {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}

            <Stack spacing={2}>
              <TextField
                label="Full name" fullWidth required autoFocus
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
              />
              <TextField
                label="Email" type="email" fullWidth
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
              <TextField
                label="Location" fullWidth required
                placeholder="City, e.g. Austin"
                value={form.location}
                onChange={(e) => setForm({ ...form, location: e.target.value })}
              />
            </Stack>

            <FormControlLabel
              sx={{ mt: 2, display: 'flex' }}
              control={
                <Switch
                  checked={form.is_direct_staff}
                  onChange={(e) => setForm({ ...form, is_direct_staff: e.target.checked })}
                />
              }
              label="Direct staff (employee)"
            />
            <FormControlLabel
              sx={{ display: 'flex' }}
              control={
                <Switch
                  checked={form.is_org_leader}
                  onChange={(e) => setForm({ ...form, is_org_leader: e.target.checked })}
                />
              }
              label="Organization leader"
            />

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
              {saving ? 'Saving…' : editing ? 'Save changes' : 'Add individual'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <ConfirmDialog
        open={!!deleteTarget}
        title={deleteTarget ? `Delete ${deleteTarget.name}?` : ''}
        message="They'll be removed from every team roster, and teams they lead will be left without a leader."
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
