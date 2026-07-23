import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Tabs from '@mui/material/Tabs';
import Tab from '@mui/material/Tab';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';

import * as projectsService from '../services/projectsService';
import { useAuth } from '../contexts/AuthContext';
import DeliverablesPanel from '../components/DeliverablesPanel';
import ProjectResourcesPanel from '../components/ProjectResourcesPanel';
import BudgetPanel from '../components/BudgetPanel';
import { DISPLAY_FONT } from '../theme';

const STATUS_COLOR = { active: 'success', completed: 'default', delayed: 'warning', archived: 'default' };

export default function ProjectDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [project, setProject] = useState(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('deliverables');

  useEffect(() => {
    projectsService
      .getProject(id)
      .then((data) => setProject(data.project))
      .catch((err) => setError(err.message));
  }, [id]);

  const canManage = project && (user?.role === 'admin' || user?.id === project.manager_id);

  if (error) return <Alert severity="error">{error}</Alert>;
  if (!project) return null;

  return (
    <Box>
      <Button size="small" onClick={() => navigate('/projects')} sx={{ mb: 1 }}>
        ← Back to Projects
      </Button>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 2, mb: 1 }}>
        <Typography variant="h4" component="h1" sx={{ fontFamily: DISPLAY_FONT, fontWeight: 600, letterSpacing: '-0.01em' }}>{project.name}</Typography>
        <Chip color={STATUS_COLOR[project.status]} label={project.status} />
      </Box>
      <Typography variant="body2" color="text.secondary" gutterBottom>
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
