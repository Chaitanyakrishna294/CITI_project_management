import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Alert from '@mui/material/Alert';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';

import * as resourcesService from '../services/resourcesService';
import * as usersService from '../services/usersService';
import { useAuth } from '../contexts/AuthContext';

const emptyForm = { user_id: '', title: '', department: '', weekly_capacity: 100 };

export default function Resources() {
  const { user } = useAuth();
  const [resources, setResources] = useState([]);
  const [users, setUsers] = useState([]);
  const [error, setError] = useState('');
  const [filters, setFilters] = useState({ q: '', department: '' });

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');

  const canManage = user?.role === 'admin' || user?.role === 'project_manager';

  function load() {
    resourcesService.listResources(filters).then((data) => setResources(data.resources)).catch((err) => setError(err.message));
  }

  useEffect(load, [filters]);

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

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" component="h1">Resources</Typography>
        {canManage && <Button variant="contained" onClick={openCreate}>Add Resource</Button>}
      </Box>

      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <TextField
          label="Search" size="small" sx={{ minWidth: 220 }}
          placeholder="Search by name or title"
          value={filters.q}
          onChange={(e) => setFilters({ ...filters, q: e.target.value })}
        />
        <TextField
          label="Department" size="small"
          value={filters.department}
          onChange={(e) => setFilters({ ...filters, department: e.target.value })}
        />
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Title</TableCell>
              <TableCell>Department</TableCell>
              <TableCell sx={{ width: 220 }}>Utilization</TableCell>
              {canManage && <TableCell align="right">Actions</TableCell>}
            </TableRow>
          </TableHead>
          <TableBody>
            {resources.map((r) => {
              const pct = Number(r.total_allocation_pct);
              const capacity = Number(r.weekly_capacity);
              const overAllocated = pct > capacity;
              return (
                <TableRow key={r.id}>
                  <TableCell>{r.user_name}</TableCell>
                  <TableCell>{r.title || '—'}</TableCell>
                  <TableCell>{r.department || '—'}</TableCell>
                  <TableCell>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                      <LinearProgress
                        variant="determinate"
                        value={Math.min(pct, 100)}
                        color={overAllocated ? 'error' : 'primary'}
                        sx={{ flexGrow: 1, height: 8, borderRadius: 4 }}
                      />
                      <Typography variant="caption">{pct}/{capacity}%</Typography>
                      {overAllocated && <Chip size="small" color="error" label="Over-allocated" />}
                    </Box>
                  </TableCell>
                  {canManage && (
                    <TableCell align="right">
                      <Button size="small" onClick={() => openEdit(r)}>Edit</Button>
                    </TableCell>
                  )}
                </TableRow>
              );
            })}
            {resources.length === 0 && (
              <TableRow>
                <TableCell colSpan={canManage ? 5 : 4} align="center">No resources yet.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={formOpen} onClose={() => setFormOpen(false)} fullWidth maxWidth="xs">
        <Box component="form" onSubmit={handleSubmit}>
          <DialogTitle>{editingId ? 'Edit Resource' : 'Add Resource'}</DialogTitle>
          <DialogContent>
            {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}

            {!editingId && (
              user?.role === 'admin' ? (
                <TextField
                  select label="User" fullWidth required margin="dense"
                  value={form.user_id}
                  onChange={(e) => setForm({ ...form, user_id: e.target.value })}
                >
                  {users.map((u) => <MenuItem key={u.id} value={u.id}>{u.name} ({u.role})</MenuItem>)}
                </TextField>
              ) : (
                <TextField
                  label="User ID" type="number" fullWidth required margin="dense"
                  helperText="Enter the numeric user ID for this team member"
                  value={form.user_id}
                  onChange={(e) => setForm({ ...form, user_id: e.target.value })}
                />
              )
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
