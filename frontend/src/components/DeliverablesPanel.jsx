/**
 * Deliverables tab of Project Details. Owners (or managers) update status in
 * place; managers add, edit and delete (req/Application_Flow.md §10). Uses the
 * shared §15 states and §16 confirmation dialog — never window.confirm.
 */
import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';

import * as deliverablesService from '../services/deliverablesService';
import * as usersService from '../services/usersService';
import { useAuth } from '../contexts/AuthContext';
import ConfirmDialog from './ConfirmDialog';
import StatusIndicator from './StatusIndicator';
import { EmptyState, ErrorState, LoadingState } from './PageState';
import { EmptyWorkIllustration } from './illustrations';
import { useStatusColors, statusLabel } from '../theme';

const STATUSES = ['not_started', 'in_progress', 'blocked', 'completed'];

const emptyForm = { title: '', description: '', owner_id: '', due_date: '' };

export default function DeliverablesPanel({ project, canManage }) {
  const { user } = useAuth();
  // Mode-aware status palette (glow-up brief v2 §2).
  const statusColors = useStatusColors();
  const [users, setUsers] = useState([]);

  // Bumping the token re-runs the fetch effect after a create/edit/delete.
  const [reloadToken, setReloadToken] = useState(0);
  // The result carries the request it answers, so "loading" is derived rather
  // than toggled (pattern in pages/Projects.jsx).
  const [result, setResult] = useState({ key: null, deliverables: [], error: '' });
  const requestKey = `${project.id}:${reloadToken}`;
  const loading = result.key !== requestKey;
  const deliverables = result.deliverables;
  const error = loading ? '' : result.error;
  // Only the very first load gets the skeleton; refetches keep the table up.
  const showSkeleton = loading && result.key === null;

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [statusError, setStatusError] = useState('');
  // The deliverable the delete confirmation is currently asking about.
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [toast, setToast] = useState('');

  function reload() {
    setReloadToken((token) => token + 1);
  }

  useEffect(() => {
    let active = true;
    deliverablesService
      .listDeliverables({ project_id: project.id })
      .then((data) => {
        // The guard stops a slow response overwriting a newer one.
        if (active) setResult({ key: requestKey, deliverables: data.deliverables, error: '' });
      })
      .catch((err) => {
        if (active) setResult((prev) => ({ ...prev, key: requestKey, error: err.message }));
      });
    return () => {
      active = false;
    };
  }, [project.id, requestKey]);

  useEffect(() => {
    if (user?.role === 'admin') {
      usersService.listUsers().then((data) => setUsers(data.users.filter((u) => u.is_active))).catch(() => {});
    }
  }, [user]);

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setFormError('');
    setFormOpen(true);
  }

  function openEdit(d) {
    setEditingId(d.id);
    setForm({ title: d.title, description: d.description || '', owner_id: d.owner_id || '', due_date: d.due_date || '' });
    setFormError('');
    setFormOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    setSaving(true);
    try {
      if (editingId) {
        await deliverablesService.updateDeliverable(editingId, form);
        setToast(`${form.title} saved`);
      } else {
        await deliverablesService.createDeliverable({ ...form, project_id: project.id });
        setToast(`${form.title} created`);
      }
      setFormOpen(false);
      reload();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleStatusChange(d, status) {
    setStatusError('');
    try {
      await deliverablesService.updateDeliverable(d.id, { status });
      setToast(`${d.title} updated`);
      reload();
    } catch (err) {
      setStatusError(err.message);
    }
  }

  // ConfirmDialog surfaces a rejection inline, so no try/catch here.
  async function handleDelete() {
    await deliverablesService.deleteDeliverable(deleteTarget.id);
    setToast(`${deleteTarget.title} deleted`);
    reload();
  }

  const isOwner = (d) => user?.id === d.owner_id;

  return (
    <Box>
      {canManage && deliverables.length > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
          <Button variant="contained" onClick={openCreate}>Add Deliverable</Button>
        </Box>
      )}

      {statusError && <Alert severity="error" sx={{ mb: 2 }}>{statusError}</Alert>}

      {showSkeleton && <LoadingState variant="table" rows={3} label="Loading deliverables…" />}

      {!showSkeleton && error && (
        <ErrorState title="Could not load deliverables" error={error} onRetry={reload} />
      )}

      {!showSkeleton && !error && deliverables.length === 0 && (
        <EmptyState
          icon={<EmptyWorkIllustration />}
          title="No deliverables yet"
          message="Break the project into trackable pieces of work."
          actionLabel={canManage ? 'Add Deliverable' : undefined}
          onAction={canManage ? openCreate : undefined}
        />
      )}

      {!showSkeleton && !error && deliverables.length > 0 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Title</TableCell>
                <TableCell>Owner</TableCell>
                <TableCell>Due Date</TableCell>
                <TableCell>Status</TableCell>
                <TableCell align="right">Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {deliverables.map((d) => (
                <TableRow key={d.id}>
                  <TableCell>{d.title}</TableCell>
                  <TableCell>{d.owner_name || '—'}</TableCell>
                  <TableCell>{d.due_date || '—'}</TableCell>
                  <TableCell>
                    {(canManage || isOwner(d)) ? (
                      <TextField
                        select size="small" value={d.status}
                        onChange={(e) => handleStatusChange(d, e.target.value)}
                      >
                        {STATUSES.map((s) => <MenuItem key={s} value={s}>{statusLabel(s)}</MenuItem>)}
                      </TextField>
                    ) : (
                      // Status meaning is a dot + label (glow-up brief v2 §2);
                      // filled Chips stay reserved for counts/badges.
                      <StatusIndicator color={statusColors[d.status] || 'grey.500'} label={statusLabel(d.status)} />
                    )}
                  </TableCell>
                  <TableCell align="right">
                    {canManage && (
                      <>
                        <Button size="small" onClick={() => openEdit(d)}>Edit</Button>
                        <Button size="small" color="error" onClick={() => setDeleteTarget(d)}>Delete</Button>
                      </>
                    )}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title={deleteTarget ? `Delete "${deleteTarget.title}"?` : ''}
        message="It will be permanently removed from this project."
        confirmLabel="Delete"
        onConfirm={handleDelete}
        onClose={() => setDeleteTarget(null)}
      />

      <Dialog open={formOpen} onClose={() => setFormOpen(false)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={handleSubmit}>
          <DialogTitle>{editingId ? 'Edit Deliverable' : 'Add Deliverable'}</DialogTitle>
          <DialogContent>
            {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
            <TextField
              label="Title" fullWidth required margin="dense"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
            />
            <TextField
              label="Description" fullWidth multiline rows={2} margin="dense"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
            />
            {user?.role === 'admin' ? (
              <TextField
                select label="Owner" fullWidth margin="dense"
                value={form.owner_id}
                onChange={(e) => setForm({ ...form, owner_id: e.target.value })}
              >
                <MenuItem value="">Unassigned</MenuItem>
                {users.map((u) => <MenuItem key={u.id} value={u.id}>{u.name} ({u.role})</MenuItem>)}
              </TextField>
            ) : (
              <TextField
                label="Owner User ID" fullWidth margin="dense" type="number"
                helperText="Enter the numeric user ID of the team member to assign"
                value={form.owner_id}
                onChange={(e) => setForm({ ...form, owner_id: e.target.value })}
              />
            )}
            <TextField
              label="Due Date" type="date" fullWidth margin="dense"
              InputLabelProps={{ shrink: true }}
              value={form.due_date}
              onChange={(e) => setForm({ ...form, due_date: e.target.value })}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={saving}>
              {saving ? 'Saving…' : editingId ? 'Save' : 'Create'}
            </Button>
          </DialogActions>
        </Box>
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
