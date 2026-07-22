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
import Chip from '@mui/material/Chip';

import * as budgetsService from '../services/budgetsService';
import { useAuth } from '../contexts/AuthContext';

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

  const [expenseOpen, setExpenseOpen] = useState(false);
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDescription, setExpenseDescription] = useState('');
  const [expenseError, setExpenseError] = useState('');

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
    try {
      await budgetsService.createBudget({ project_id: project.id, planned_amount: plannedAmount });
      setCreateOpen(false);
      setPlannedAmount('');
      reload();
    } catch (err) {
      setCreateError(err.message);
    }
  }

  async function handleExpense(e) {
    e.preventDefault();
    setExpenseError('');
    try {
      await budgetsService.recordExpense(project.id, Number(expenseAmount), expenseDescription);
      setExpenseOpen(false);
      setExpenseAmount('');
      setExpenseDescription('');
      reload();
    } catch (err) {
      setExpenseError(err.message);
    }
  }

  if (error) return <Alert severity="error">{error}</Alert>;

  if (notFound) {
    return (
      <Box>
        <Alert severity="info" sx={{ mb: 2 }}>No budget has been set for this project yet.</Alert>
        {canManage && (
          <Button variant="contained" onClick={() => setCreateOpen(true)}>Set Budget</Button>
        )}
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
              <Button type="submit" variant="contained">Save</Button>
            </DialogActions>
          </Box>
        </Dialog>
      </Box>
    );
  }

  if (!budget) return null;

  const planned = Number(budget.planned_amount);
  const spent = Number(budget.actual_spend);
  const pctSpent = planned > 0 ? Math.min((spent / planned) * 100, 100) : 0;
  const overBudget = spent > planned;

  return (
    <Box>
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
            {overBudget && <Chip size="small" color="error" label="Over budget" />}
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
            <Button type="submit" variant="contained">Save</Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
}
