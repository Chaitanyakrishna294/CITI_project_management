/**
 * Budget tab of Project Details: planned vs actual with a utilization bar
 * (req/Application_Flow.md §10). Admins, finance and the project's own
 * manager set the budget and record expenses. Uses the shared §15 states;
 * "no budget yet" is the empty state, not an error.
 */
import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import Grid from '@mui/material/Grid';
import LinearProgress from '@mui/material/LinearProgress';
import Dialog from '@mui/material/Dialog';
import DialogTitle from '@mui/material/DialogTitle';
import DialogContent from '@mui/material/DialogContent';
import DialogActions from '@mui/material/DialogActions';
import TextField from '@mui/material/TextField';
import Alert from '@mui/material/Alert';
import Snackbar from '@mui/material/Snackbar';

import * as budgetsService from '../services/budgetsService';
import { useAuth } from '../contexts/AuthContext';
import StatusIndicator from './StatusIndicator';
import { EmptyState, ErrorState, LoadingState } from './PageState';
import { EmptyWorkIllustration } from './illustrations';

export default function BudgetPanel({ project }) {
  const { user } = useAuth();
  // Bumping the token re-runs the fetch effect after a create/expense.
  const [reloadToken, setReloadToken] = useState(0);

  // The result carries the request it answers, so the in-flight state is
  // derived — no state has to be written before the request is issued.
  const [result, setResult] = useState({ key: null, budget: null, notFound: false, error: '' });
  const requestKey = `${project.id}|${reloadToken}`;
  const pending = result.key !== requestKey;
  const budget = pending ? null : result.budget;
  const notFound = pending ? false : result.notFound;
  const error = pending ? '' : result.error;

  const [createOpen, setCreateOpen] = useState(false);
  const [plannedAmount, setPlannedAmount] = useState('');
  const [createError, setCreateError] = useState('');
  const [creating, setCreating] = useState(false);

  const [expenseOpen, setExpenseOpen] = useState(false);
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseError, setExpenseError] = useState('');
  const [recording, setRecording] = useState(false);

  const [toast, setToast] = useState('');

  const canManage = user?.role === 'admin' || user?.role === 'finance' || user?.id === project.manager_id;

  function reload() {
    setReloadToken((token) => token + 1);
  }

  useEffect(() => {
    let active = true;
    budgetsService
      .getBudget(project.id)
      .then((data) => {
        // The guard stops a slow response overwriting a newer one.
        if (active) setResult({ key: requestKey, budget: data.budget, notFound: false, error: '' });
      })
      .catch((err) => {
        if (!active) return;
        if (err.message.toLowerCase().includes('not found')) {
          setResult({ key: requestKey, budget: null, notFound: true, error: '' });
        } else {
          setResult({ key: requestKey, budget: null, notFound: false, error: err.message });
        }
      });
    return () => {
      active = false;
    };
  }, [project.id, requestKey]);

  async function handleCreate(e) {
    e.preventDefault();
    setCreateError('');
    setCreating(true);
    try {
      await budgetsService.createBudget({ project_id: project.id, planned_amount: plannedAmount });
      setToast(`Budget set for ${project.name}`);
      setCreateOpen(false);
      setPlannedAmount('');
      reload();
    } catch (err) {
      setCreateError(err.message);
    } finally {
      setCreating(false);
    }
  }

  async function handleExpense(e) {
    e.preventDefault();
    setExpenseError('');
    setRecording(true);
    try {
      await budgetsService.recordExpense(project.id, Number(expenseAmount), expenseDescription);
      setToast(expenseDescription ? `${expenseDescription} recorded` : 'Expense recorded');
      setExpenseOpen(false);
      setExpenseAmount('');
      setExpenseDescription('');
      reload();
    } catch (err) {
      setExpenseError(err.message);
    } finally {
      setRecording(false);
    }
  }

  let content = null;
  if (pending) {
    content = <LoadingState variant="cards" rows={3} label="Loading budget…" />;
  } else if (error) {
    content = <ErrorState title="Could not load budget" error={error} onRetry={reload} />;
  } else if (notFound) {
    content = (
      <>
        <EmptyState
          icon={<EmptyWorkIllustration />}
          title="No budget yet"
          message="No budget has been set for this project yet."
          actionLabel={canManage ? 'Set Budget' : undefined}
          onAction={canManage ? () => setCreateOpen(true) : undefined}
        />
        <Dialog open={createOpen} onClose={() => setCreateOpen(false)} fullWidth maxWidth="xs">
          <Box component="form" onSubmit={handleCreate}>
            <DialogTitle>Set Budget</DialogTitle>
            <DialogContent>
              {createError && <Alert severity="error" sx={{ mb: 2 }}>{createError}</Alert>}
              <TextField
                label="Planned Amount (USD)" type="number" fullWidth required margin="dense"
                value={plannedAmount}
                onChange={(e) => setPlannedAmount(e.target.value)}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setCreateOpen(false)}>Cancel</Button>
              <Button type="submit" variant="contained" disabled={creating}>
                {creating ? 'Saving…' : 'Save'}
              </Button>
            </DialogActions>
          </Box>
        </Dialog>
      </>
    );
  } else if (budget) {
    // NUMERIC comes over the wire as strings — Number() before arithmetic.
    const planned = Number(budget.planned_amount);
    const spent = Number(budget.actual_spend);
    const pctSpent = planned > 0 ? Math.min((spent / planned) * 100, 100) : 0;
    const overBudget = spent > planned;

    content = (
      <>
        {canManage && (
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
            <Button variant="contained" onClick={() => setExpenseOpen(true)}>Record Expense</Button>
          </Box>
        )}

        <Paper sx={{ p: 3 }}>
          <Grid container spacing={3}>
            <Grid item xs={12} sm={4}>
              <Typography variant="subtitle2" color="text.secondary">Planned Budget</Typography>
              <Typography variant="h5">{budget.currency} {planned.toLocaleString()}</Typography>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Typography variant="subtitle2" color="text.secondary">Actual Spend</Typography>
              <Typography variant="h5">{budget.currency} {spent.toLocaleString()}</Typography>
            </Grid>
            <Grid item xs={12} sm={4}>
              <Typography variant="subtitle2" color="text.secondary">Remaining</Typography>
              <Typography variant="h5">{budget.currency} {Number(budget.remaining_amount).toLocaleString()}</Typography>
            </Grid>
          </Grid>

          <Box sx={{ mt: 3 }}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
              <Typography variant="body2">Budget utilization</Typography>
              {/* Status meaning is a dot + label (glow-up brief v2 §2), in the
                  error hue because overspend needs acting on. */}
              {overBudget && <StatusIndicator color="error.main" label="Over budget" />}
            </Box>
            <LinearProgress
              variant="determinate"
              value={pctSpent}
              color={overBudget ? 'error' : 'primary'}
              sx={{ height: 10, borderRadius: 5 }}
            />
          </Box>
        </Paper>

        <Dialog open={expenseOpen} onClose={() => setExpenseOpen(false)} fullWidth maxWidth="xs">
          <Box component="form" onSubmit={handleExpense}>
            <DialogTitle>Record Expense</DialogTitle>
            <DialogContent>
              {expenseError && <Alert severity="error" sx={{ mb: 2 }}>{expenseError}</Alert>}
              <TextField
                label="Amount" type="number" fullWidth required margin="dense"
                value={expenseAmount}
                onChange={(e) => setExpenseAmount(e.target.value)}
              />
              <TextField
                label="Description" fullWidth margin="dense"
                value={expenseDescription}
                onChange={(e) => setExpenseDescription(e.target.value)}
              />
            </DialogContent>
            <DialogActions>
              <Button onClick={() => setExpenseOpen(false)}>Cancel</Button>
              <Button type="submit" variant="contained" disabled={recording}>
                {recording ? 'Saving…' : 'Save'}
              </Button>
            </DialogActions>
          </Box>
        </Dialog>
      </>
    );
  }

  return (
    <Box>
      {content}
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
