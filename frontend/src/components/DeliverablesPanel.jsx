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
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Alert from '@mui/material/Alert';

import * as deliverablesService from '../services/deliverablesService';
import * as usersService from '../services/usersService';
import { useAuth } from '../contexts/AuthContext';

const STATUSES = ['not_started', 'in_progress', 'blocked', 'completed'];
const STATUS_COLOR = { not_started: 'default', in_progress: 'info', blocked: 'error', completed: 'success' };

const emptyForm = { title: '', description: '', owner_id: '', due_date: '' };

export default function DeliverablesPanel({ project, canManage }) {
  const { user } = useAuth();
  const [deliverables, setDeliverables] = useState([]);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');

  function load() {
    deliverablesService
      .listDeliverables({ project_id: project.id })
      .then((data) => setDeliverables(data.deliverables))
      .catch((err) => setError(err.message));
  }

  useEffect(load, [project.id]);

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
    try {
      if (editingId) {
        await deliverablesService.updateDeliverable(editingId, form);
      } else {
        await deliverablesService.createDeliverable({ ...form, project_id: project.id });
      }
      setFormOpen(false);
      load();
    } catch (err) {
      setFormError(err.message);
    }
  }

  async function handleStatusChange(d, status) {
    await deliverablesService.updateDeliverable(d.id, { status });
    load();
  }

  async function handleDelete(id) {
    if (!window.confirm('Delete this deliverable?')) return;
    await deliverablesService.deleteDeliverable(id);
    load();
  }

  const isOwner = (d) => user?.id === d.owner_id;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
        {canManage && (
          <Button variant="contained" onClick={openCreate}>Add Deliverable</Button>
        )}
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

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
                      {STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
                    </TextField>
                  ) : (
                    <Chip size="small" color={STATUS_COLOR[d.status]} label={d.status} />
                  )}
                </TableCell>
                <TableCell align="right">
                  {canManage && (
                    <>
                      <Button size="small" onClick={() => openEdit(d)}>Edit</Button>
                      <Button size="small" color="error" onClick={() => handleDelete(d.id)}>Delete</Button>
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {deliverables.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center">No deliverables yet.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

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
            <Button type="submit" variant="contained">{editingId ? 'Save' : 'Create'}</Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
}
