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
import Switch from '@mui/material/Switch';
import FormControlLabel from '@mui/material/FormControlLabel';

import * as usersService from '../services/usersService';

const ROLES = ['admin', 'project_manager', 'team_member', 'finance', 'viewer'];

const emptyForm = { name: '', email: '', password: '', role: 'viewer' };

export default function UserManagement() {
  // Bumping the token re-runs the fetch effect after a create/edit/deactivate.
  const [reloadToken, setReloadToken] = useState(0);

  // The result carries the request it answers, so "loading" is derived rather
  // than toggled — no state has to be written before the request is issued.
  const [result, setResult] = useState({ key: null, users: [], error: '' });
  const requestKey = String(reloadToken);
  const loading = result.key !== requestKey;
  const users = result.users;
  const error = loading ? '' : result.error;

  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState(emptyForm);
  const [createError, setCreateError] = useState('');

  const [editUser, setEditUser] = useState(null);
  const [editError, setEditError] = useState('');

  function reloadUsers() {
    setReloadToken((token) => token + 1);
  }

  useEffect(() => {
    let active = true;
    usersService
      .listUsers()
      .then((data) => {
        // The guard stops a slow response overwriting a newer one.
        if (active) setResult({ key: requestKey, users: data.users, error: '' });
      })
      .catch((err) => {
        if (active) setResult((prev) => ({ key: requestKey, users: prev.users, error: err.message }));
      });
    return () => {
      active = false;
    };
  }, [requestKey]);

  async function handleCreate(e) {
    e.preventDefault();
    setCreateError('');
    try {
      await usersService.createUser(createForm);
      setCreateOpen(false);
      setCreateForm(emptyForm);
      reloadUsers();
    } catch (err) {
      setCreateError(err.message);
    }
  }

  async function handleEditSave(e) {
    e.preventDefault();
    setEditError('');
    try {
      await usersService.updateUser(editUser.id, {
        name: editUser.name,
        role: editUser.role,
        is_active: editUser.is_active,
      });
      setEditUser(null);
      reloadUsers();
    } catch (err) {
      setEditError(err.message);
    }
  }

  async function handleDeactivate(id) {
    if (!window.confirm('Deactivate this user?')) return;
    await usersService.deactivateUser(id);
    reloadUsers();
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h4" component="h1">
          User Management
        </Typography>
        <Button variant="contained" onClick={() => setCreateOpen(true)}>
          Add User
        </Button>
      </Box>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}

      <TableContainer component={Paper}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Name</TableCell>
              <TableCell>Email</TableCell>
              <TableCell>Role</TableCell>
              <TableCell>Status</TableCell>
              <TableCell align="right">Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {!loading && users.map((u) => (
              <TableRow key={u.id}>
                <TableCell>{u.name}</TableCell>
                <TableCell>{u.email}</TableCell>
                <TableCell>
                  <Chip size="small" label={u.role} />
                </TableCell>
                <TableCell>
                  <Chip
                    size="small"
                    color={u.is_active ? 'success' : 'default'}
                    label={u.is_active ? 'Active' : 'Inactive'}
                  />
                </TableCell>
                <TableCell align="right">
                  <Button size="small" onClick={() => setEditUser({ ...u })}>
                    Edit
                  </Button>
                  {u.is_active && (
                    <Button size="small" color="error" onClick={() => handleDeactivate(u.id)}>
                      Deactivate
                    </Button>
                  )}
                </TableCell>
              </TableRow>
            ))}
            {!loading && users.length === 0 && (
              <TableRow>
                <TableCell colSpan={5} align="center">No users yet.</TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>

      {/* Create user dialog */}
      <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="xs">
        <Box component="form" onSubmit={handleCreate}>
          <DialogTitle>Add User</DialogTitle>
          <DialogContent>
            {createError && <Alert severity="error" sx={{ mb: 2 }}>{createError}</Alert>}
            <TextField
              label="Name" fullWidth required margin="dense"
              value={createForm.name}
              onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
            />
            <TextField
              label="Email" type="email" fullWidth required margin="dense"
              value={createForm.email}
              onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
            />
            <TextField
              label="Password" type="password" fullWidth required margin="dense"
              value={createForm.password}
              onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
            />
            <TextField
              select label="Role" fullWidth margin="dense"
              value={createForm.role}
              onChange={(e) => setCreateForm({ ...createForm, role: e.target.value })}
            >
              {ROLES.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
            </TextField>
          </DialogContent>
          <DialogActions>
            <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button type="submit" variant="contained">Create</Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Edit user dialog */}
      <Dialog open={!!editUser} onClose={() => setEditUser(null)} fullWidth maxWidth="xs">
        {editUser && (
          <Box component="form" onSubmit={handleEditSave}>
            <DialogTitle>Edit User</DialogTitle>
            <DialogContent>
              {editError && <Alert severity="error" sx={{ mb: 2 }}>{editError}</Alert>}
              <TextField
                label="Name" fullWidth margin="dense"
                value={editUser.name}
                onChange={(e) => setEditUser({ ...editUser, name: e.target.value })}
              />
              <TextField
                select label="Role" fullWidth margin="dense"
                value={editUser.role}
                onChange={(e) => setEditUser({ ...editUser, role: e.target.value })}
              >
                {ROLES.map((r) => <MenuItem key={r} value={r}>{r}</MenuItem>)}
              </TextField>
              <FormControlLabel
                sx={{ mt: 1 }}
                control={
                  <Switch
                    checked={editUser.is_active}
                    onChange={(e) => setEditUser({ ...editUser, is_active: e.target.checked })}
                  />
                }
                label="Active"
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setEditUser(null)}>Cancel</Button>
              <Button type="submit" variant="contained">Save</Button>
            </DialogActions>
          </Box>
        )}
      </Dialog>
    </Box>
  );
}
