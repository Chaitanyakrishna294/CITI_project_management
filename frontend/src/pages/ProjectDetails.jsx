/**
 * UI-04 Project Details: identity header plus Deliverables / Resources /
 * Budget tabs (req/Application_Flow.md §10). The three §15 data states are
 * handled here for the project record itself; each tab panel owns its own.
 */
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Button from '@mui/material/Button';

import * as projectsService from '../services/projectsService';
import { useAuth } from '../contexts/AuthContext';
import DeliverablesPanel from '../components/DeliverablesPanel';
import ProjectResourcesPanel from '../components/ProjectResourcesPanel';
import BudgetPanel from '../components/BudgetPanel';
import StatusIndicator from '../components/StatusIndicator';
import { ErrorState, LoadingState } from '../components/PageState';
import { BackIcon } from '../components/icons';
import { DISPLAY_FONT, useStatusColors, statusLabel } from '../theme';

export default function ProjectDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  // Mode-aware status palette (glow-up brief v2 §2) — the static STATUS_COLORS
  // object would go stale when the colour mode flips.
  const statusColors = useStatusColors();

  // Bumping the token re-runs the fetch effect on retry.
  const [reloadToken, setReloadToken] = useState(0);
  // The result carries the request it answers, so "loading" is derived rather
  // than toggled — no state has to be written before the request is issued
  // (pattern in pages/Projects.jsx).
  const [result, setResult] = useState({ key: null, project: null, error: '' });
  const requestKey = `${id}:${reloadToken}`;
  const loading = result.key !== requestKey;
  const project = loading ? null : result.project;
  const error = loading ? '' : result.error;

  const [tab, setTab] = useState('deliverables');

  function reload() {
    setReloadToken((token) => token + 1);
  }

  useEffect(() => {
    let active = true;
    projectsService
      .getProject(id)
      .then((data) => {
        // The guard stops a slow response overwriting a newer one.
        if (active) setResult({ key: requestKey, project: data.project, error: '' });
      })
      .catch((err) => {
        if (active) setResult({ key: requestKey, project: null, error: err.message });
      });
    return () => {
      active = false;
    };
  }, [id, requestKey]);

  const canManage = project && (user?.role === 'admin' || user?.id === project.manager_id);

  if (loading) return <LoadingState variant="text" label="Loading project…" />;
  if (error) return <ErrorState title="Could not load project" error={error} onRetry={reload} />;
  if (!project) return null;

  return (
    <Box>
      <Button
        size="small"
        startIcon={<BackIcon size={18} />}
        onClick={() => navigate('/projects')}
        sx={{ mb: 1 }}
      >
        Back to Projects
      </Button>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
        {/* Detail titles echo PageHeader: the display serif at 32px — body,
            data and buttons stay Inter. */}
        <Typography
          variant="h4"
          component="h1"
          sx={{
            fontFamily: DISPLAY_FONT,
            fontWeight: 600,
            fontSize: 32,
            letterSpacing: '-0.015em',
            lineHeight: 1.2,
          }}
        >
          {project.name}
        </Typography>
        {/* Status meaning is a dot + label (glow-up brief v2 §2); filled Chips
            stay reserved for counts/badges. */}
        <StatusIndicator color={statusColors[project.status] || 'grey.500'} label={statusLabel(project.status)} />
      </Box>
      {/* The thread dash under the title, matching PageHeader. Decorative
          only — the title itself carries the semantics. */}
      <Box
        aria-hidden
        sx={{ width: 36, height: 3, borderRadius: 2, bgcolor: 'var(--color-thread)', mt: 1.25 }}
      />
      <Typography variant="body2" color="text.secondary" gutterBottom sx={{ mt: 1.25 }}>
        Manager: {project.manager_name} {project.department ? `· ${project.department}` : ''}
      </Typography>
      {project.description && (
        <Typography variant="body1" sx={{ mt: 1, mb: 2 }}>{project.description}</Typography>
      )}

      <Tabs value={tab} onChange={(e, v) => setTab(v)} sx={{ mb: 2 }}>
        <Tab label="Deliverables" value="deliverables" />
        <Tab label="Resources" value="resources" />
        <Tab label="Budget" value="budget" />
      </Tabs>

      {tab === 'deliverables' && <DeliverablesPanel project={project} canManage={canManage} />}
      {tab === 'resources' && <ProjectResourcesPanel project={project} canManage={canManage} />}
      {tab === 'budget' && <BudgetPanel project={project} />}
    </Box>
  );
}
