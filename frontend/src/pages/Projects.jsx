import { useEffect, useState } from 'react';
import { Link as RouterLink, useSearchParams } from 'react-router-dom';
import Link from '@mui/material/Link';
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
import Stack from '@mui/material/Stack';

import * as projectsService from '../services/projectsService';
import * as usersService from '../services/usersService';
import { useAuth } from '../contexts/AuthContext';

const STATUSES = ['active', 'completed', 'delayed', 'archived'];
const STATUS_COLOR = { active: 'success', completed: 'default', delayed: 'warning', archived: 'default' };

const emptyForm = { name: '', description: '', department: '', manager_id: '', start_date: '', end_date: '' };

export default function Projects() {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [projects, setProjects] = useState([]);
  const [managers, setManagers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [filters, setFilters] = useState({
    status: '',
    department: '',
    manager_id: '',
    q: searchParams.get('q') || '',
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [formError, setFormError] = useState('');

  const canCreate = user?.role === 'admin' || user?.role === 'project_manager';

  async function loadProjects() {
    setLoading(true);
    setError('');
    try {
      const data = await projectsService.listProjects(filters);
      setProjects(data.projects);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadProjects();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters]);

  useEffect(() => {
    if (user?.role === 'admin') {
      usersService
        .listUsers()
        .then((data) => setManagers(data.users.filter((u) => u.is_active && ['admin', 'project_manager'].includes(u.role))))
        .catch(() => {});
    }
  }, [user]);

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
    try {
      if (editingId) {
        await projectsService.updateProject(editingId, form);
      } else {
        await projectsService.createProject(form);
      }
      setFormOpen(false);
      loadProjects();
    } catch (err) {
      setFormError(err.message);
    }
  }

  async function handleArchive(id) {
    if (!window.confirm('Archive this project? It will no longer accept new deliverables.')) return;
    await projectsService.archiveProject(id);
    loadProjects();
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" component="h1">
          Projects
        </Typography>
        {canCreate && (
          <Button variant="contained" onClick={openCreate}>
            New Project
          </Button>
        )}
      </Box>

      <Stack direction="row" spacing={2} sx={{ mb: 2 }}>
        <TextField
          label="Search" size="small" sx={{ minWidth: 220 }}
          placeholder="Search by name or description"
          value={filters.q}
          onChange={(e) => setFilters({ ...filters, q: e.target.value })}
        />
        <TextField
          select label="Status" size="small" sx={{ minWidth: 160 }}
          value={filters.status}
          onChange={(e) => setFilters({ ...filters, status: e.target.value })}
        >
          <MenuItem value="">All</MenuItem>
          {STATUSES.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
        </TextField>
        <TextField
          label="Department" size="small"
          value={filters.department}
          onChange={(e) => setFilters({ ...filters, department: e.target.value })}
        />
        {managers.length > 0 && (
          <TextField
            select label="Manager" size="small" sx={{ minWidth: 180 }}
            value={filters.manager_id}
            onChange={(e) => setFilters({ ...filters, manager_id: e.target.value })}
          >
            <MenuItem value="">All</MenuItem>
            {managers.map((m) => <MenuItem key={m.id} value={m.id}>{m.name}</MenuItem>)}
          </TextField>
        )}
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Manager</TableCell>
              <TableCell>Department</TableCell>
              <TableCell>Status</TableCell>
              <TableCell>Start</TableCell>
              <TableCell>End</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!loading && projects.map((p) => (
              <TableRow key={p.id}>
                <TableCell>
                  <Link component={RouterLink} to={`/projects/${p.id}`} underline="hover">
                    {p.name}
                  </Link>
                </TableCell>
                <TableCell>{p.manager_name}</TableCell>
                <TableCell>{p.department || '—'}</TableCell>
                <TableCell>
                  <Chip size="small" color={STATUS_COLOR[p.status]} label={p.status} />
                </TableCell>
                <TableCell>{p.start_date || '—'}</TableCell>
                <TableCell>{p.end_date || '—'}</TableCell>
                <TableCell align="right">
                  {canManage(p) && (
                    <>
                      <Button size="small" onClick={() => openEdit(p)}>Edit</Button>
                      {p.status !== 'archived' && (
                        <Button size="small" color="error" onClick={() => handleArchive(p.id)}>
                          Archive
                        </Button>
                      )}
                    </>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!loading && projects.length === 0 && (
              <TableRow>
                <TableCell colSpan={7} align="center">No projects yet.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={formOpen} onClose={() => setFormOpen(false)} fullWidth maxWidth="sm">
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
            <Button type="submit" variant="contained">{editingId ? 'Save' : 'Create'}</Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
}
