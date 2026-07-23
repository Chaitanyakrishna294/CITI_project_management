/**
 * Resources tab of Project Details: who is allocated to this project and at
 * what percentage (req/Application_Flow.md §10). Admins and project managers
 * allocate/remove; everyone else reads. Uses the shared §15 states and §16
 * confirmation dialog — never window.confirm.
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
import Stack from '@mui/material/Stack';

import * as resourcesService from '../services/resourcesService';
import { useAuth } from '../contexts/AuthContext';
import ConfirmDialog from './ConfirmDialog';
import { EmptyState, ErrorState, LoadingState } from './PageState';
import { EmptyWorkIllustration } from './illustrations';

const emptyForm = { resource_id: '', allocation_pct: '', start_date: '', end_date: '' };

export default function ProjectResourcesPanel({ project }) {
  const { user } = useAuth();
  const [resources, setResources] = useState([]);

  // Bumping the token re-runs the fetch effect after an allocate/remove.
  const [reloadToken, setReloadToken] = useState(0);
  // The result carries the request it answers, so "loading" is derived rather
  // than toggled (pattern in pages/Projects.jsx).
  const [result, setResult] = useState({ key: null, allocations: [], error: '' });
  const requestKey = `${project.id}:${reloadToken}`;
  const loading = result.key !== requestKey;
  const allocations = result.allocations;
  const error = loading ? '' : result.error;
  // Only the very first load gets the skeleton; refetches keep the table up.
  const showSkeleton = loading && result.key === null;

  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');
  const [allocating, setAllocating] = useState(false);
  // The allocation the remove confirmation is currently asking about.
  const [removeTarget, setRemoveTarget] = useState(null);
  const [toast, setToast] = useState('');

  const canManage = user?.role === 'admin' || user?.role === 'project_manager';

  function reload() {
    setReloadToken((token) => token + 1);
  }

  useEffect(() => {
    let active = true;
    resourcesService
      .listAllocations({ project_id: project.id })
      .then((data) => {
        // The guard stops a slow response overwriting a newer one.
        if (active) setResult({ key: requestKey, allocations: data.allocations, error: '' });
      })
      .catch((err) => {
        if (active) setResult((prev) => ({ ...prev, key: requestKey, error: err.message }));
      });
    return () => {
      active = false;
    };
  }, [project.id, requestKey]);

  useEffect(() => {
    resourcesService.listResources().then((data) => setResources(data.resources)).catch(() => {});
  }, []);

  function openCreate() {
    setForm(emptyForm);
    setFormError('');
    setFormOpen(true);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    setFormError('');
    setAllocating(true);
    try {
      await resourcesService.createAllocation({ ...form, project_id: project.id });
      const resource = resources.find((r) => r.id === form.resource_id);
      setToast(`${resource ? resource.user_name : 'Resource'} allocated`);
      setFormOpen(false);
      reload();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setAllocating(false);
    }
  }

  // ConfirmDialog surfaces a rejection inline, so no try/catch here.
  async function handleRemove() {
    await resourcesService.deleteAllocation(removeTarget.id);
    setToast(`${removeTarget.resource_name} removed`);
    reload();
  }

  return (
    <Box>
      {canManage && allocations.length > 0 && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
          <Button variant="contained" onClick={openCreate}>Allocate Resource</Button>
        </Box>
      )}

      {showSkeleton && <LoadingState variant="table" rows={3} label="Loading allocations…" />}

      {!showSkeleton && error && (
        <ErrorState title="Could not load allocations" error={error} onRetry={reload} />
      )}

      {!showSkeleton && !error && allocations.length === 0 && (
        <EmptyState
          icon={<EmptyWorkIllustration />}
          title="No resources allocated yet"
          message="Allocate people to this project to plan its capacity."
          actionLabel={canManage ? 'Allocate Resource' : undefined}
          onAction={canManage ? openCreate : undefined}
        />
      )}

      {!showSkeleton && !error && allocations.length > 0 && (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>Resource</TableCell>
                {/* Numeric column: right-aligned, tabular figures via the
                    theme's alignRight override (glow-up brief v2 §2). */}
                <TableCell align="right">Allocation %</TableCell>
                <TableCell>Start</TableCell>
                <TableCell>End</TableCell>
                {canManage && <TableCell align="right">Actions</TableCell>}
              </TableRow>
            </TableHead>
            <TableBody>
              {allocations.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>{a.resource_name}</TableCell>
                  <TableCell align="right">{a.allocation_pct}%</TableCell>
                  <TableCell>{a.start_date || '—'}</TableCell>
                  <TableCell>{a.end_date || '—'}</TableCell>
                  {canManage && (
                    <TableCell align="right">
                      <Button size="small" color="error" onClick={() => setRemoveTarget(a)}>Remove</Button>
                    </TableCell>
                  )}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <ConfirmDialog
        open={Boolean(removeTarget)}
        title={removeTarget ? `Remove ${removeTarget.resource_name} from this project?` : ''}
        message="Their allocation is removed; the resource stays available for other projects."
        confirmLabel="Remove"
        onConfirm={handleRemove}
        onClose={() => setRemoveTarget(null)}
      />

      <Dialog open={formOpen} onClose={() => setFormOpen(false)} fullWidth maxWidth="xs">
        <Box component="form" onSubmit={handleSubmit}>
          <DialogTitle>Allocate Resource</DialogTitle>
          <DialogContent>
            {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
            <TextField
              select label="Resource" fullWidth required margin="dense"
              value={form.resource_id}
              onChange={(e) => setForm({ ...form, resource_id: e.target.value })}
            >
              {resources.map((r) => (
                <MenuItem key={r.id} value={r.id}>
                  {r.user_name} ({r.total_allocation_pct}% / {r.weekly_capacity}%)
                </MenuItem>
              ))}
            </TextField>
            <TextField
              label="Allocation %" type="number" fullWidth required margin="dense"
              value={form.allocation_pct}
              onChange={(e) => setForm({ ...form, allocation_pct: e.target.value })}
            />
            <Stack direction="row" spacing={2}>
              <TextField
                label="Start Date" type="date" fullWidth margin="dense"
                InputLabelProps={{ shrink: true }}
                value={form.start_date}
                onChange={(e) => setForm({ ...form, start_date: e.target.value })}
              />
              <TextField
                label="End Date" type="date" fullWidth margin="dense"
                InputLabelProps={{ shrink: true }}
                value={form.end_date}
                onChange={(e) => setForm({ ...form, end_date: e.target.value })}
              />
            </Stack>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setFormOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={allocating}>
              {allocating ? 'Allocating…' : 'Allocate'}
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
