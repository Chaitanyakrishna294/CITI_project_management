/**
 * UI-10 User Management (Admin only).
 *
 * Accounts are provisioned here by an Admin — the platform intentionally has
 * no self-service sign-up (req/Application_Flow.md §10). The "Add user" dialog
 * follows the 21st.dev Origin UI sign-up dialog pattern (icon badge, described
 * fields, single clear action) translated into the Harbor Blue MUI tokens, and
 * the role picker spells out what each role can do so the RBAC decision is
 * made with the permission model in view.
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
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import FormControl from '@mui/material/FormControl';
import FormLabel from '@mui/material/FormLabel';
import FormControlLabel from '@mui/material/FormControlLabel';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import { AddPersonIcon, ShowPasswordIcon, HidePasswordIcon } from '../components/icons';

import DataTable from '../components/DataTable';
import ConfirmDialog from '../components/ConfirmDialog';
import { EmptyState, ErrorState, LoadingState } from '../components/PageState';
import * as usersService from '../services/usersService';
import PageHeader from '../components/PageHeader';
import { EmptyPeopleIllustration } from '../components/illustrations';
import StatusIndicator from '../components/StatusIndicator';

/**
 * Role values match the backend enum; descriptions restate the RBAC table in
 * CLAUDE.md so the admin picks a role knowing what it grants.
 */
const ROLES = [
  { value: 'admin', label: 'Admin', description: 'Full access to projects, budgets, users, and settings.' },
  { value: 'project_manager', label: 'Project manager', description: 'Runs their assigned projects end to end.' },
  { value: 'team_member', label: 'Team member', description: 'Updates the deliverables assigned to them.' },
  { value: 'finance', label: 'Finance', description: 'Sees and updates budgets across projects.' },
  { value: 'viewer', label: 'Viewer', description: 'Read-only view of projects and reports.' },
];

const ROLE_LABELS = Object.fromEntries(ROLES.map((r) => [r.value, r.label]));

const emptyForm = { name: '', email: '', password: '', role: 'viewer' };

/** Radio list where every role carries its permission summary. */
function RoleRadioGroup({ value, onChange, idPrefix }) {
  const labelId = `${idPrefix}-role-label`;
  return (
    <FormControl component="fieldset" sx={{ mt: 2 }}>
      <FormLabel id={labelId} sx={{ typography: 'body2', fontWeight: 600, color: 'text.primary' }}>
        Role
      </FormLabel>
      <RadioGroup aria-labelledby={labelId} value={value} onChange={(e) => onChange(e.target.value)}>
        {ROLES.map((role) => (
          <FormControlLabel
            key={role.value}
            value={role.value}
            control={<Radio size="small" sx={{ pt: 0.5, alignSelf: 'flex-start' }} />}
            sx={{ alignItems: 'flex-start', mt: 1, mr: 0 }}
            label={
              <Box>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {role.label}
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {role.description}
                </Typography>
              </Box>
            }
          />
        ))}
      </RadioGroup>
    </FormControl>
  );
}

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
  const [creating, setCreating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const [editUser, setEditUser] = useState(null);
  const [editError, setEditError] = useState('');
  const [saving, setSaving] = useState(false);

  const [deactivateTarget, setDeactivateTarget] = useState(null);
  const [toast, setToast] = useState('');

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

  function openCreate() {
    setCreateForm(emptyForm);
    setCreateError('');
    setShowPassword(false);
    setCreateOpen(true);
  }

  async function handleCreate(e) {
    e.preventDefault();
    setCreateError('');
    setCreating(true);
    try {
      await usersService.createUser(createForm);
      setCreateOpen(false);
      setToast(`${createForm.name} added`);
      reloadUsers();
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleEditSave(e) {
    e.preventDefault();
    setEditError('');
    setSaving(true);
    try {
      await usersService.updateUser(editUser.id, {
        name: editUser.name,
        role: editUser.role,
        is_active: editUser.is_active,
      });
      setEditUser(null);
      setToast('Changes saved');
      reloadUsers();
    } catch (err) {
      setEditError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate() {
    await usersService.deactivateUser(deactivateTarget.id);
    setToast(`${deactivateTarget.name} deactivated`);
    reloadUsers();
  }

  const columns = [
    { id: 'name', label: 'Name' },
    { id: 'email', label: 'Email' },
    {
      id: 'role',
      label: 'Role',
      render: (u) => <Chip size="small" label={ROLE_LABELS[u.role] ?? u.role} />,
      exportValue: (u) => ROLE_LABELS[u.role] ?? u.role,
    },
    {
      id: 'is_active',
      label: 'Status',
      render: (u) => (
        <StatusIndicator
          color={u.is_active ? 'success.main' : 'text.disabled'}
          label={u.is_active ? 'Active' : 'Inactive'}
        />
      ),
      sortValue: (u) => (u.is_active ? 0 : 1),
      exportValue: (u) => (u.is_active ? 'Active' : 'Inactive'),
    },
    {
      id: 'actions',
      label: 'Actions',
      align: 'right',
      sortable: false,
      exportValue: () => '',
      render: (u) => (
        <>
          <Button size="small" onClick={() => setEditUser({ ...u })}>
            Edit
          </Button>
          {u.is_active && (
            <Button size="small" color="error" onClick={() => setDeactivateTarget(u)}>
              Deactivate
            </Button>
          )}
        </>
      ),
    },
  ];

  return (
    <Box>
      <PageHeader
        title="User Management"
        summary={
          !loading && !error
            ? `${users.length} accounts · ${users.filter((u) => u.is_active).length} active`
            : undefined
        }
        action={
          <Button variant="contained" startIcon={<AddPersonIcon size={18} />} onClick={openCreate}>
            Add user
          </Button>
        }
      />

      {loading && <LoadingState variant="table" label="Loading users…" />}

      {!loading && error && <ErrorState title="Could not load users" error={error} onRetry={reloadUsers} />}

      {!loading && !error && users.length === 0 && (
        <EmptyState
          icon={<EmptyPeopleIllustration />}
          title="No users yet"
          message="Everyone who should have access gets an account here."
          actionLabel="Add user"
          onAction={openCreate}
        />
      )}

      {!loading && !error && users.length > 0 && (
        <DataTable
          columns={columns}
          rows={users}
          defaultOrderBy="name"
          exportFilename="users.csv"
        />
      )}

      {/* Create user dialog — Origin UI sign-up pattern in Harbor Blue. */}
      <Dialog
        open={createOpen}
        onClose={() => !creating && setCreateOpen(false)}
        fullWidth
        maxWidth="xs"
        aria-labelledby="add-user-title"
      >
        <Box component="form" onSubmit={handleCreate}>
          <DialogContent sx={{ pt: 4, px: 4 }}>
            <Stack alignItems="center" spacing={1} sx={{ mb: 3, textAlign: 'center' }}>
              <Box
                aria-hidden
                sx={{
                  width: 44,
                  height: 44,
                  borderRadius: '50%',
                  border: '1px solid',
                  borderColor: 'divider',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'primary.main',
                }}
              >
                <AddPersonIcon />
              </Box>
              <Typography id="add-user-title" variant="h6" component="h2">
                Add a user
              </Typography>
              <Typography variant="body2" color="text.secondary">
                They&rsquo;ll sign in with this email and password.
              </Typography>
            </Stack>

            {createError && <Alert severity="error" sx={{ mb: 2 }}>{createError}</Alert>}

            <Stack spacing={2}>
              <TextField
                label="Full name" fullWidth required autoFocus
                value={createForm.name}
                onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
              />
              <TextField
                label="Email" type="email" fullWidth required
                value={createForm.email}
                onChange={(e) => setCreateForm({ ...createForm, email: e.target.value })}
              />
              <TextField
                label="Password"
                type={showPassword ? 'text' : 'password'}
                fullWidth
                required
                value={createForm.password}
                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                slotProps={{
                  input: {
                    endAdornment: (
                      <InputAdornment position="end">
                        <IconButton
                          aria-label={showPassword ? 'Hide password' : 'Show password'}
                          onClick={() => setShowPassword((visible) => !visible)}
                          edge="end"
                        >
                          {showPassword ? <HidePasswordIcon /> : <ShowPasswordIcon />}
                        </IconButton>
                      </InputAdornment>
                    ),
                  },
                }}
              />
            </Stack>

            <RoleRadioGroup
              idPrefix="create"
              value={createForm.role}
              onChange={(role) => setCreateForm({ ...createForm, role })}
            />
          </DialogContent>
          <DialogActions sx={{ px: 4, pb: 3 }}>
            <Button onClick={() => setCreateOpen(false)} disabled={creating}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={creating}>
              {creating ? 'Adding…' : 'Add user'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      {/* Edit user dialog */}
      <Dialog
        open={!!editUser}
        onClose={() => !saving && setEditUser(null)}
        fullWidth
        maxWidth="xs"
        aria-labelledby="edit-user-title"
      >
        {editUser && (
          <Box component="form" onSubmit={handleEditSave}>
            <DialogContent sx={{ pt: 4, px: 4 }}>
              <Typography id="edit-user-title" variant="h6" component="h2" sx={{ mb: 0.5 }}>
                Edit user
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
                {editUser.email}
              </Typography>

              {editError && <Alert severity="error" sx={{ mb: 2 }}>{editError}</Alert>}

              <TextField
                label="Full name" fullWidth
                value={editUser.name}
                onChange={(e) => setEditUser({ ...editUser, name: e.target.value })}
              />

              <RoleRadioGroup
                idPrefix="edit"
                value={editUser.role}
                onChange={(role) => setEditUser({ ...editUser, role })}
              />

              <FormControlLabel
                sx={{ mt: 2, display: 'flex' }}
                control={
                  <Switch
                    checked={editUser.is_active}
                    onChange={(e) => setEditUser({ ...editUser, is_active: e.target.checked })}
                  />
                }
                label="Active"
              />
            </DialogContent>
            <DialogActions sx={{ px: 4, pb: 3 }}>
              <Button onClick={() => setEditUser(null)} disabled={saving}>
                Cancel
              </Button>
              <Button type="submit" variant="contained" disabled={saving}>
                {saving ? 'Saving…' : 'Save changes'}
              </Button>
            </DialogActions>
          </Box>
        )}
      </Dialog>

      <ConfirmDialog
        open={!!deactivateTarget}
        title={deactivateTarget ? `Deactivate ${deactivateTarget.name}?` : ''}
        message="They'll no longer be able to sign in. Their work on projects and deliverables stays in place."
        confirmLabel="Deactivate"
        onConfirm={handleDeactivate}
        onClose={() => setDeactivateTarget(null)}
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
