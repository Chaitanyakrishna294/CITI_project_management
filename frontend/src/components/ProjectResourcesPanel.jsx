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
import Stack from '@mui/material/Stack';

import * as resourcesService from '../services/resourcesService';
import { useAuth } from '../contexts/AuthContext';

const emptyForm = { resource_id: '', allocation_pct: '', start_date: '', end_date: '' };

export default function ProjectResourcesPanel({ project }) {
  const { user } = useAuth();
  const [allocations, setAllocations] = useState([]);
  const [resources, setResources] = useState([]);
  const [error, setError] = useState('');
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');

  const canManage = user?.role === 'admin' || user?.role === 'project_manager';

  function load() {
    resourcesService
      .listAllocations({ project_id: project.id })
      .then((data) => setAllocations(data.allocations))
      .catch((err) => setError(err.message));
  }

  useEffect(load, [project.id]);

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
    try {
      await resourcesService.createAllocation({ ...form, project_id: project.id });
      setFormOpen(false);
      load();
    } catch (err) {
      setFormError(err.message);
    }
  }

  async function handleDelete(id) {
    if (!window.confirm('Remove this resource allocation?')) return;
    await resourcesService.deleteAllocation(id);
    load();
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        {canManage && (
          <Button variant="contained" onClick={openCreate}>Allocate Resource</Button>
        )}
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Resource</TableCell>
              <TableCell>Allocation %</TableCell>
              <TableCell>Start</TableCell>
              <TableCell>End</TableCell>
              {canManage && <TableCell align="right">Actions</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {allocations.map((a) => (
              <TableRow key={a.id}>
                <TableCell>{a.resource_name}</TableCell>
                <TableCell>{a.allocation_pct}%</TableCell>
                <TableCell>{a.start_date || '—'}</TableCell>
                <TableCell>{a.end_date || '—'}</TableCell>
                {canManage && (
                  <TableCell align="right">
                    <Button size="small" color="error" onClick={() => handleDelete(a.id)}>Remove</Button>
                  </TableCell>
                )}
              </TableRow>
            ))}
            {allocations.length === 0 && (
              <TableRow>
                <TableCell colSpan={canManage ? 5 : 4} align="center">No resources allocated yet.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

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
            <Button type="submit" variant="contained">Allocate</Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
}
