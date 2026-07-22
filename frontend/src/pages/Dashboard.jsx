import { useEffect, useState } from 'react';
import { Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import Grid from '@mui/material/Grid';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Link from '@mui/material/Link';
import Alert from '@mui/material/Alert';
import LinearProgress from '@mui/material/LinearProgress';

import * as projectsService from '../services/projectsService';
import * as budgetsService from '../services/budgetsService';
import * as resourcesService from '../services/resourcesService';
import * as deliverablesService from '../services/deliverablesService';
import { useAuth } from '../contexts/AuthContext';

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

function isAtRisk(project, today) {
  if (project.status === 'delayed') return true;
  return project.status === 'active' && project.end_date && project.end_date < today;
}

export default function Dashboard() {
  const { user } = useAuth();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    Promise.all([
      projectsService.listProjects(),
      budgetsService.listBudgets().catch(() => ({ budgets: [] })),
      resourcesService.listResources().catch(() => ({ resources: [] })),
      deliverablesService.listDeliverables().catch(() => ({ deliverables: [] })),
    ])
      .then(([projectsRes, budgetsRes, resourcesRes, deliverablesRes]) => {
        setData({
          projects: projectsRes.projects,
          budgets: budgetsRes.budgets,
          resources: resourcesRes.resources,
          deliverables: deliverablesRes.deliverables,
        });
      })
      .catch((err) => setError(err.message));
  }, []);

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!data) return <LinearProgress />;

  const today = todayISO();
  const activeProjects = data.projects.filter((p) => p.status === 'active');
  const completedProjects = data.projects.filter((p) => p.status === 'completed');
  const atRiskProjects = data.projects.filter((p) => isAtRisk(p, today));

  const totalPlanned = data.budgets.reduce((sum, b) => sum + Number(b.planned_amount), 0);
  const totalSpent = data.budgets.reduce((sum, b) => sum + Number(b.actual_spend), 0);
  const budgetPct = totalPlanned > 0 ? Math.min((totalSpent / totalPlanned) * 100, 100) : 0;

  const avgUtilization = data.resources.length
    ? data.resources.reduce((sum, r) => sum + Number(r.total_allocation_pct), 0) / data.resources.length
    : 0;
  const overAllocated = data.resources.filter((r) => Number(r.total_allocation_pct) > Number(r.weekly_capacity));

  const upcomingDeadlines = data.deliverables
    .filter((d) => d.status !== 'completed' && d.due_date && d.due_date >= today)
    .sort((a, b) => a.due_date.localeCompare(b.due_date))
    .slice(0, 5);

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom>Dashboard</Typography>
      <Typography variant="body1" color="text.secondary" gutterBottom>
        Welcome back, {user?.name} ({user?.role})
      </Typography>

      <Grid container spacing={2} sx={{ mt: 1 }}>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="text.secondary">Active Projects</Typography>
            <Typography variant="h4">{activeProjects.length}</Typography>
            <Typography variant="caption" color="text.secondary">{completedProjects.length} completed</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="text.secondary">Projects at Risk</Typography>
            <Typography variant="h4" color={atRiskProjects.length ? 'error.main' : 'inherit'}>
              {atRiskProjects.length}
            </Typography>
            <Typography variant="caption" color="text.secondary">Delayed or past due date</Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="text.secondary">Budget Utilization</Typography>
            <Typography variant="h4">{budgetPct.toFixed(0)}%</Typography>
            <Typography variant="caption" color="text.secondary">
              ${totalSpent.toLocaleString()} / ${totalPlanned.toLocaleString()}
            </Typography>
          </Paper>
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="subtitle2" color="text.secondary">Resource Utilization</Typography>
            <Typography variant="h4">{avgUtilization.toFixed(0)}%</Typography>
            <Typography variant="caption" color={overAllocated.length ? 'error.main' : 'text.secondary'}>
              {overAllocated.length} over-allocated
            </Typography>
          </Paper>
        </Grid>
      </Grid>

      <Grid container spacing={2} sx={{ mt: 0.5 }}>
        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Projects at Risk</Typography>
            {atRiskProjects.length === 0 && (
              <Typography variant="body2" color="text.secondary">No projects currently at risk.</Typography>
            )}
            <List dense>
              {atRiskProjects.map((p) => (
                <ListItem key={p.id} disableGutters>
                  <ListItemText
                    primary={<Link component={RouterLink} to={`/projects/${p.id}`}>{p.name}</Link>}
                    secondary={`${p.manager_name} · ends ${p.end_date || 'n/a'}`}
                  />
                  <Chip size="small" color="warning" label={p.status} />
                </ListItem>
              ))}
            </List>
          </Paper>
        </Grid>

        <Grid item xs={12} md={6}>
          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Upcoming Deadlines</Typography>
            {upcomingDeadlines.length === 0 && (
              <Typography variant="body2" color="text.secondary">No upcoming deliverable deadlines.</Typography>
            )}
            <List dense>
              {upcomingDeadlines.map((d) => (
                <ListItem key={d.id} disableGutters>
                  <ListItemText primary={d.title} secondary={`Owner: ${d.owner_name || 'Unassigned'} · Due ${d.due_date}`} />
                  <Chip size="small" label={d.status} />
                </ListItem>
              ))}
            </List>
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
