/**
 * Team details: identity, metadata, roster, and monthly achievements.
 *
 * Answers the workshop's "who is on each team" and "what did they achieve
 * each month" questions for one team. Reads are open to every role; roster
 * and achievement writes are for admins and project managers.
 */
import { useEffect, useState } from 'react';
import { Link as RouterLink, useParams } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid';
import Link from '@mui/material/Link';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Dialog from '@mui/material/Dialog';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';
import Stack from '@mui/material/Stack';
import IconButton from '@mui/material/IconButton';
import { BackIcon, RemovePersonIcon } from '../components/icons';

import ConfirmDialog from '../components/ConfirmDialog';
import { EmptyState, ErrorState, LoadingState } from '../components/PageState';
import { useAuth } from '../contexts/AuthContext';
import { formatMonth } from '../utils/metadata';
import * as teamsService from '../services/teamsService';
import { EmptyDataIllustration } from '../components/illustrations';
import { DISPLAY_FONT } from '../theme';

/** '2026-07-01' -> '2026-07' for <input type="month">. */
function toMonthInput(isoDate) {
  return String(isoDate).slice(0, 7);
}

const emptyAchievement = { month: '', title: '', description: '' };

export default function TeamDetails() {
  const { id } = useParams();
  const { user } = useAuth();
  const canManage = user?.role === 'admin' || user?.role === 'project_manager';

  const [reloadToken, setReloadToken] = useState(0);
  const [result, setResult] = useState({ key: null, team: null, individuals: [], error: '' });
  const requestKey = `${id}:${reloadToken}`;
  const loading = result.key !== requestKey;
  const { team, individuals } = result;
  const error = loading ? '' : result.error;

  const [memberToAdd, setMemberToAdd] = useState('');
  const [memberError, setMemberError] = useState('');
  const [addingMember, setAddingMember] = useState(false);
  const [memberToRemove, setMemberToRemove] = useState(null);

  const [achievementDialog, setAchievementDialog] = useState(false);
  const [editingAchievement, setEditingAchievement] = useState(null);
  const [achievementForm, setAchievementForm] = useState(emptyAchievement);
  const [achievementError, setAchievementError] = useState('');
  const [savingAchievement, setSavingAchievement] = useState(false);
  const [achievementToDelete, setAchievementToDelete] = useState(null);

  const [toast, setToast] = useState('');

  function reload() {
    setReloadToken((token) => token + 1);
  }

  useEffect(() => {
    let active = true;
    Promise.all([teamsService.getTeam(id), teamsService.listIndividuals()])
      .then(([teamData, individualsData]) => {
        if (active) {
          setResult({
            key: requestKey,
            team: teamData.team,
            individuals: individualsData.individuals,
            error: '',
          });
        }
      })
      .catch((err) => {
        if (active) {
          setResult((prev) => ({ ...prev, key: requestKey, error: err.message }));
        }
      });
    return () => {
      active = false;
    };
  }, [id, requestKey]);

  async function handleAddMember(e) {
    e.preventDefault();
    if (memberToAdd === '') return;
    setMemberError('');
    setAddingMember(true);
    try {
      await teamsService.addTeamMember(team.id, memberToAdd);
      setMemberToAdd('');
      setToast('Member added');
      reload();
    } catch (err) {
      setMemberError(err.message);
    } finally {
      setAddingMember(false);
    }
  }

  async function handleRemoveMember() {
    await teamsService.removeTeamMember(team.id, memberToRemove.id);
    setToast(`${memberToRemove.name} removed from ${team.name}`);
    reload();
  }

  function openCreateAchievement() {
    setEditingAchievement(null);
    setAchievementForm(emptyAchievement);
    setAchievementError('');
    setAchievementDialog(true);
  }

  function openEditAchievement(achievement) {
    setEditingAchievement(achievement.id);
    setAchievementForm({
      month: toMonthInput(achievement.month),
      title: achievement.title,
      description: achievement.description || '',
    });
    setAchievementError('');
    setAchievementDialog(true);
  }

  async function handleSaveAchievement(e) {
    e.preventDefault();
    setAchievementError('');
    setSavingAchievement(true);
    const payload = {
      month: achievementForm.month,
      title: achievementForm.title,
      description: achievementForm.description,
    };
    try {
      if (editingAchievement) {
        await teamsService.updateAchievement(editingAchievement, payload);
        setToast('Achievement updated');
      } else {
        await teamsService.createAchievement(team.id, payload);
        setToast('Achievement recorded');
      }
      setAchievementDialog(false);
      reload();
    } catch (err) {
      setAchievementError(err.message);
    } finally {
      setSavingAchievement(false);
    }
  }

  async function handleDeleteAchievement() {
    await teamsService.deleteAchievement(achievementToDelete.id);
    setToast('Achievement deleted');
    reload();
  }

  if (loading) return <LoadingState variant="text" label="Loading team…" />;
  if (error) return <ErrorState title="Could not load team" error={error} onRetry={reload} />;
  if (!team) return null;

  const memberIds = new Set(team.members.map((m) => m.id));
  const addable = individuals.filter((person) => !memberIds.has(person.id));
  const metadataEntries = Object.entries(team.metadata || {});

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 2 }}>
        <IconButton component={RouterLink} to="/teams" aria-label="Back to teams">
          <BackIcon />
        </IconButton>
        <Typography variant="h4" component="h1" sx={{ fontFamily: DISPLAY_FONT, fontWeight: 600, letterSpacing: '-0.01em' }}>
          {team.name}
        </Typography>
        <Chip size="small" label={team.location} />
      </Stack>

      <Grid container spacing={2}>
        <Grid item xs={12} md={5}>
          <Paper sx={{ p: 3, mb: 2 }}>
            <Typography variant="h6" component="h2" gutterBottom>
              About
            </Typography>
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              <strong>Leader:</strong> {team.leader_name || 'None yet'}
            </Typography>
            <Typography variant="body2" sx={{ mb: 0.5 }}>
              <strong>Reports to:</strong> {team.reports_to_name || 'Nobody'}
            </Typography>
            {metadataEntries.length > 0 && (
              <Box sx={{ mt: 2 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, mb: 1 }}>
                  Metadata
                </Typography>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {metadataEntries.map(([key, value]) => (
                    <Chip key={key} size="small" variant="outlined" label={`${key}: ${value}`} />
                  ))}
                </Stack>
              </Box>
            )}
          </Paper>

          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" component="h2" gutterBottom>
              Members ({team.members.length})
            </Typography>

            {team.members.length === 0 ? (
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                Nobody on the roster yet.
              </Typography>
            ) : (
              <List dense disablePadding>
                {team.members.map((member) => (
                  <ListItem
                    key={member.id}
                    disableGutters
                    secondaryAction={
                      canManage && (
                        <IconButton
                          edge="end"
                          aria-label={`Remove ${member.name}`}
                          onClick={() => setMemberToRemove(member)}
                        >
                          <RemovePersonIcon size={18} />
                        </IconButton>
                      )
                    }
                  >
                    <ListItemText
                      primary={member.name}
                      secondary={`${member.location}${member.is_direct_staff ? '' : ' · non-direct'}`}
                    />
                  </ListItem>
                ))}
              </List>
            )}

            {canManage && (
              <Box component="form" onSubmit={handleAddMember} sx={{ mt: 2 }}>
                {memberError && <Alert severity="error" sx={{ mb: 1 }}>{memberError}</Alert>}
                <Stack direction="row" spacing={1}>
                  <TextField
                    select fullWidth size="small" label="Add member"
                    value={memberToAdd}
                    onChange={(e) => setMemberToAdd(e.target.value)}
                  >
                    {addable.length === 0 && <MenuItem value="" disabled>Everyone is already on this team</MenuItem>}
                    {addable.map((person) => (
                      <MenuItem key={person.id} value={person.id}>
                        {person.name} · {person.location}
                      </MenuItem>
                    ))}
                  </TextField>
                  <Button type="submit" variant="outlined" disabled={addingMember || memberToAdd === ''}>
                    {addingMember ? 'Adding…' : 'Add'}
                  </Button>
                </Stack>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
                  Missing someone? Add them under{' '}
                  <Link component={RouterLink} to="/individuals">Individuals</Link> first.
                </Typography>
              </Box>
            )}
          </Paper>
        </Grid>

        <Grid item xs={12} md={7}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
              <Typography variant="h6" component="h2">
                Monthly achievements
              </Typography>
              {canManage && (
                <Button variant="contained" size="small" onClick={openCreateAchievement}>
                  Record achievement
                </Button>
              )}
            </Box>

            {team.achievements.length === 0 ? (
              <EmptyState
          icon={<EmptyDataIllustration />}
                title="Nothing recorded yet"
                message="Capture what this team shipped, fixed, or improved each month."
                actionLabel={canManage ? 'Record achievement' : undefined}
                onAction={canManage ? openCreateAchievement : undefined}
              />
            ) : (
              <List disablePadding>
                {team.achievements.map((achievement) => (
                  <ListItem
                    key={achievement.id}
                    disableGutters
                    alignItems="flex-start"
                    secondaryAction={
                      canManage && (
                        <Stack direction="row" spacing={0.5}>
                          <Button size="small" onClick={() => openEditAchievement(achievement)}>
                            Edit
                          </Button>
                          <Button size="small" color="error" onClick={() => setAchievementToDelete(achievement)}>
                            Delete
                          </Button>
                        </Stack>
                      )
                    }
                  >
                    <ListItemText
                      primary={
                        <Stack direction="row" spacing={1} alignItems="center">
                          <Chip size="small" variant="outlined" label={formatMonth(achievement.month)} />
                          <Typography variant="body1">{achievement.title}</Typography>
                        </Stack>
                      }
                      secondary={achievement.description}
                      secondaryTypographyProps={{ sx: { mt: 0.5 } }}
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Paper>
        </Grid>
      </Grid>

      {/* Achievement dialog */}
      <Dialog
        open={achievementDialog}
        onClose={() => !savingAchievement && setAchievementDialog(false)}
        fullWidth
        maxWidth="xs"
        aria-labelledby="achievement-dialog-title"
      >
        <Box component="form" onSubmit={handleSaveAchievement}>
          <DialogContent sx={{ pt: 4, px: 4 }}>
            <Typography id="achievement-dialog-title" variant="h6" component="h2" sx={{ mb: 0.5 }}>
              {editingAchievement ? 'Edit achievement' : 'Record an achievement'}
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
              {team.name} · achievements are tracked by month.
            </Typography>

            {achievementError && <Alert severity="error" sx={{ mb: 2 }}>{achievementError}</Alert>}

            <Stack spacing={2}>
              <TextField
                label="Month" type="month" fullWidth required
                value={achievementForm.month}
                onChange={(e) => setAchievementForm({ ...achievementForm, month: e.target.value })}
                slotProps={{ inputLabel: { shrink: true } }}
              />
              <TextField
                label="Title" fullWidth required
                value={achievementForm.title}
                onChange={(e) => setAchievementForm({ ...achievementForm, title: e.target.value })}
              />
              <TextField
                label="Description" fullWidth multiline minRows={3}
                value={achievementForm.description}
                onChange={(e) => setAchievementForm({ ...achievementForm, description: e.target.value })}
              />
            </Stack>
          </DialogContent>
          <DialogActions sx={{ px: 4, pb: 3 }}>
            <Button onClick={() => setAchievementDialog(false)} disabled={savingAchievement}>
              Cancel
            </Button>
            <Button type="submit" variant="contained" disabled={savingAchievement}>
              {savingAchievement ? 'Saving…' : editingAchievement ? 'Save changes' : 'Record achievement'}
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <ConfirmDialog
        open={!!memberToRemove}
        title={memberToRemove ? `Remove ${memberToRemove.name} from ${team.name}?` : ''}
        message="They stay in the Individuals directory and can be re-added later."
        confirmLabel="Remove"
        onConfirm={handleRemoveMember}
        onClose={() => setMemberToRemove(null)}
      />

      <ConfirmDialog
        open={!!achievementToDelete}
        title="Delete this achievement?"
        message={achievementToDelete ? `"${achievementToDelete.title}" will be removed from ${team.name}'s history.` : ''}
        confirmLabel="Delete"
        onConfirm={handleDeleteAchievement}
        onClose={() => setAchievementToDelete(null)}
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
