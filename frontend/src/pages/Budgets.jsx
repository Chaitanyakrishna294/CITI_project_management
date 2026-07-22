/**
 * UI-08 Budget Management — organisation-wide budget view.
 *
 * req/Application_Flow.md §8 and req/PRD.md §11: planned budget, recorded
 * expenses, actual spend and remaining budget for every project in one place.
 * Per-project editing still lives in components/BudgetPanel.jsx.
 */
import { useCallback, useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import Grid from '@mui/material/Grid';
import LinearProgress from '@mui/material/LinearProgress';
import Link from '@mui/material/Link';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';

import DataTable from '../components/DataTable';
import { EmptyState, ErrorState, LoadingState } from '../components/PageState';
import * as budgetsService from '../services/budgetsService';
import { useAuth } from '../contexts/AuthContext';
import { STATUS_COLORS } from '../theme';

/** Postgres NUMERIC arrives as a string, so every amount is coerced first. */
function formatCurrency(value, currency = 'USD') {
  const amount = Number(value);
  return new Intl.NumberFormat(undefined, {
    style: 'currency',
    currency: currency || 'USD',
  }).format(Number.isFinite(amount) ? amount : 0);
}

/** Percentage of the planned budget already spent; uncapped so >100% shows. */
function utilisation(budget) {
  const planned = Number(budget.planned_amount);
  const spent = Number(budget.actual_spend);
  if (planned > 0) return (spent / planned) * 100;
  return spent > 0 ? 100 : 0;
}

function isOverBudget(budget) {
  return Number(budget.actual_spend) > Number(budget.planned_amount);
}

function KpiCard({ label, value }) {
  return (
    <Paper sx={{ p: 2, height: '100%' }}>
      <Typography variant="subtitle2" color="text.secondary" gutterBottom>
        {label}
      </Typography>
      <Typography variant="h5">{value}</Typography>
    </Paper>
  );
}

export default function Budgets() {
  const { user } = useAuth();
  const [budgets, setBudgets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // One dialog at a time: 'planned' | 'expense' | null, acting on `target`.
  const [dialog, setDialog] = useState(null);
  const [target, setTarget] = useState(null);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [plannedAmount, setPlannedAmount] = useState('');
  const [expenseAmount, setExpenseAmount] = useState('');
  const [expenseDescription, setExpenseDescription] = useState('');

  // Bumping the token re-runs the fetch effect; the effect itself never sets
  // state synchronously, so a reload cannot cascade renders.
  const [reloadToken, setReloadToken] = useState(0);

  const refresh = useCallback(() => {
    setLoading(true);
    setError('');
    setReloadToken((token) => token + 1);
  }, []);

  useEffect(() => {
    let active = true;
    budgetsService
      .listBudgets()
      .then((data) => {
        if (!active) return;
        setBudgets(data.budgets || []);
        setError('');
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [reloadToken]);

  /** Mirrors backend/budgets-service/function.py `_can_manage_budget`. */
  function canManage(budget) {
    if (user?.role === 'admin' || user?.role === 'finance') return true;
    return user?.role === 'project_manager' && user.id === budget.manager_id;
  }

  const totals = budgets.reduce(
    (acc, b) => ({
      planned: acc.planned + Number(b.planned_amount),
      actual: acc.actual + Number(b.actual_spend),
      remaining: acc.remaining + Number(b.remaining_amount),
      over: acc.over + (isOverBudget(b) ? 1 : 0),
    }),
    { planned: 0, actual: 0, remaining: 0, over: 0 }
  );
  // Totals assume a single reporting currency; fall back to USD when empty.
  const totalsCurrency = budgets[0]?.currency || 'USD';

  function closeDialog() {
    setDialog(null);
    setTarget(null);
    setFormError('');
  }

  function openPlanned(budget) {
    setTarget(budget);
    setPlannedAmount(String(budget.planned_amount));
    setFormError('');
    setDialog('planned');
  }

  function openExpense(budget) {
    setTarget(budget);
    setExpenseAmount('');
    setExpenseDescription('');
    setFormError('');
    setDialog('expense');
  }

  async function handlePlannedSubmit(e) {
    e.preventDefault();
    const amount = Number(plannedAmount);
    if (plannedAmount === '' || Number.isNaN(amount)) {
      setFormError('Enter a valid amount.');
      return;
    }
    if (amount < 0) {
      setFormError('Budget cannot be negative.');
      return;
    }
    setFormError('');
    setSaving(true);
    try {
      await budgetsService.updateBudget(target.project_id, { planned_amount: amount });
      closeDialog();
      refresh();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleExpenseSubmit(e) {
    e.preventDefault();
    const amount = Number(expenseAmount);
    if (expenseAmount === '' || Number.isNaN(amount) || amount <= 0) {
      setFormError('Expense amount must be a positive number.');
      return;
    }
    setFormError('');
    setSaving(true);
    try {
      await budgetsService.recordExpense(target.project_id, amount, expenseDescription);
      closeDialog();
      refresh();
    } catch (err) {
      setFormError(err.message);
    } finally {
      setSaving(false);
    }
  }

  const showActions = budgets.some(canManage);

  const columns = [
    {
      id: 'project_name',
      label: 'Project',
      render: (b) => (
        <Link component={RouterLink} to={`/projects/${b.project_id}`} underline="hover">
          {b.project_name}
        </Link>
      ),
    },
    {
      id: 'project_status',
      label: 'Status',
      render: (b) => (
        <Chip
          size="small"
          label={b.project_status}
          sx={{ bgcolor: STATUS_COLORS[b.project_status] || 'grey.500', color: 'common.white' }}
        />
      ),
    },
    {
      id: 'planned_amount',
      label: 'Planned',
      align: 'right',
      sortValue: (b) => Number(b.planned_amount),
      render: (b) => formatCurrency(b.planned_amount, b.currency),
    },
    {
      id: 'actual_spend',
      label: 'Actual Spend',
      align: 'right',
      sortValue: (b) => Number(b.actual_spend),
      render: (b) => formatCurrency(b.actual_spend, b.currency),
    },
    {
      id: 'remaining_amount',
      label: 'Remaining',
      align: 'right',
      sortValue: (b) => Number(b.remaining_amount),
      render: (b) => (
        <Typography variant="body2" color={isOverBudget(b) ? 'error' : 'text.primary'}>
          {formatCurrency(b.remaining_amount, b.currency)}
        </Typography>
      ),
    },
    {
      id: 'utilisation',
      label: 'Utilisation',
      width: 160,
      sortValue: utilisation,
      exportValue: (b) => `${Math.round(utilisation(b))}%`,
      render: (b) => {
        const pct = utilisation(b);
        const over = pct > 100;
        return (
          <Box>
            <LinearProgress
              variant="determinate"
              value={Math.min(pct, 100)}
              color={over ? 'error' : 'primary'}
              sx={{ height: 8, borderRadius: 4, mb: 0.5 }}
            />
            <Typography variant="caption" color={over ? 'error' : 'text.secondary'}>
              {Math.round(pct)}%
            </Typography>
          </Box>
        );
      },
    },
  ];

  if (showActions) {
    columns.push({
      id: 'actions',
      label: 'Actions',
      align: 'right',
      sortable: false,
      exportable: false,
      render: (b) =>
        canManage(b) ? (
          <Stack direction="row" spacing={1} justifyContent="flex-end">
            <Button size="small" onClick={() => openPlanned(b)}>
              Edit Planned
            </Button>
            <Button size="small" onClick={() => openExpense(b)}>
              Record Expense
            </Button>
          </Stack>
        ) : null,
    });
  }

  return (
    <Box>
      <Typography variant="h4" component="h1" sx={{ mb: 3 }}>
        Budget Management
      </Typography>

      {loading && <LoadingState variant="cards" rows={4} label="Loading budgets…" />}

      {!loading && error && (
        <ErrorState title="Could not load budgets" error={error} onRetry={refresh} />
      )}

      {!loading && !error && budgets.length === 0 && (
        <EmptyState
          title="No budgets yet"
          message="Budgets are created per project from the project's Budget tab."
        />
      )}

      {!loading && !error && budgets.length > 0 && (
        <>
          <Grid container spacing={2} sx={{ mb: 3 }}>
            <Grid item xs={12} sm={6} md={3}>
              <KpiCard label="Total Planned" value={formatCurrency(totals.planned, totalsCurrency)} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <KpiCard label="Total Actual Spend" value={formatCurrency(totals.actual, totalsCurrency)} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <KpiCard label="Total Remaining" value={formatCurrency(totals.remaining, totalsCurrency)} />
            </Grid>
            <Grid item xs={12} sm={6} md={3}>
              <KpiCard label="Over Budget" value={String(totals.over)} />
            </Grid>
          </Grid>

          <DataTable
            title="Project Budgets"
            columns={columns}
            rows={budgets}
            getRowKey={(b) => b.id}
            defaultOrderBy="project_name"
            exportFilename="budgets.csv"
            emptyMessage="No budgets to display."
          />
        </>
      )}

      <Dialog open={dialog === 'planned'} onClose={closeDialog} maxWidth="xs">
        <Box component="form" onSubmit={handlePlannedSubmit}>
          <DialogTitle>Edit Planned Amount</DialogTitle>
          <DialogContent>
            {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {target?.project_name}
            </Typography>
            <TextField
              label={`Planned Amount (${target?.currency || 'USD'})`}
              type="number"
              fullWidth
              margin="dense"
              value={plannedAmount}
              onChange={(e) => setPlannedAmount(e.target.value)}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={closeDialog}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={saving}>
              Save
            </Button>
          </DialogActions>
        </Box>
      </Dialog>

      <Dialog open={dialog === 'expense'} onClose={closeDialog} maxWidth="xs">
        <Box component="form" onSubmit={handleExpenseSubmit}>
          <DialogTitle>Record Expense</DialogTitle>
          <DialogContent>
            {formError && <Alert severity="error" sx={{ mb: 2 }}>{formError}</Alert>}
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {target?.project_name}
            </Typography>
            <TextField
              label={`Amount (${target?.currency || 'USD'})`}
              type="number"
              fullWidth
              margin="dense"
              value={expenseAmount}
              onChange={(e) => setExpenseAmount(e.target.value)}
            />
            <TextField
              label="Description"
              fullWidth
              margin="dense"
              value={expenseDescription}
              onChange={(e) => setExpenseDescription(e.target.value)}
            />
          </DialogContent>
          <DialogActions>
            <Button onClick={closeDialog}>Cancel</Button>
            <Button type="submit" variant="contained" disabled={saving}>
              Save
            </Button>
          </DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
}
