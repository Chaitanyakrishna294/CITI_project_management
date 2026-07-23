import { useEffect, useState } from 'react';
import { useSearchParams, Link as RouterLink } from 'react-router-dom';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Link from '@mui/material/Link';
import Chip from '@mui/material/Chip';
import Alert from '@mui/material/Alert';
import LinearProgress from '@mui/material/LinearProgress';

import * as projectsService from '../services/projectsService';
import * as deliverablesService from '../services/deliverablesService';
import * as resourcesService from '../services/resourcesService';
import { DISPLAY_FONT } from '../theme';

const EMPTY_RESULTS = { projects: [], deliverables: [], resources: [] };

export default function SearchResults() {
  const [searchParams] = useSearchParams();
  const q = searchParams.get('q') || '';

  // The state carries the query it answers, so an empty query needs no request
  // and "still loading" is derived rather than written before one is issued.
  const [state, setState] = useState({ key: null, results: null, error: '' });
  const answered = state.key === q;
  const results = q ? (answered ? state.results : null) : EMPTY_RESULTS;
  const error = answered ? state.error : '';

  useEffect(() => {
    if (!q) return;
    let active = true;
    Promise.all([
      projectsService.listProjects({ q }),
      deliverablesService.listDeliverables({ q }),
      resourcesService.listResources({ q }),
    ])
      .then(([p, d, r]) => {
        // The guard stops a slow response overwriting a newer one.
        if (active) {
          setState({
            key: q,
            results: { projects: p.projects, deliverables: d.deliverables, resources: r.resources },
            error: '',
          });
        }
      })
      .catch((err) => {
        if (active) setState({ key: q, results: null, error: err.message });
      });
    return () => {
      active = false;
    };
  }, [q]);

  return (
    <Box>
      <Typography variant="h4" component="h1" gutterBottom sx={{ fontFamily: DISPLAY_FONT, fontWeight: 600, letterSpacing: '-0.01em' }}>
        Search Results {q && <Typography component="span" variant="h5" color="text.secondary">for &ldquo;{q}&rdquo;</Typography>}
      </Typography>

      {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
      {!results && !error && <LinearProgress />}

      {results && (
        <>
          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="h6" gutterBottom>Projects ({results.projects.length})</Typography>
            <List dense>
              {results.projects.map((p) => (
                <ListItem key={p.id} disableGutters>
                  <ListItemText
                    primary={<Link component={RouterLink} to={`/projects/${p.id}`}>{p.name}</Link>}
                    secondary={`${p.manager_name} · ${p.department || 'No department'}`}
                  />
                  <Chip size="small" label={p.status} />
                </ListItem>
              ))}
              {results.projects.length === 0 && (
                <Typography variant="body2" color="text.secondary">No matching projects.</Typography>
              )}
            </List>
          </Paper>

          <Paper sx={{ p: 2, mb: 2 }}>
            <Typography variant="h6" gutterBottom>Deliverables ({results.deliverables.length})</Typography>
            <List dense>
              {results.deliverables.map((d) => (
                <ListItem key={d.id} disableGutters>
                  <ListItemText
                    primary={<Link component={RouterLink} to={`/projects/${d.project_id}`}>{d.title}</Link>}
                    secondary={`Owner: ${d.owner_name || 'Unassigned'}${d.due_date ? ` · Due ${d.due_date}` : ''}`}
                  />
                  <Chip size="small" label={d.status} />
                </ListItem>
              ))}
              {results.deliverables.length === 0 && (
                <Typography variant="body2" color="text.secondary">No matching deliverables.</Typography>
              )}
            </List>
          </Paper>

          <Paper sx={{ p: 2 }}>
            <Typography variant="h6" gutterBottom>Resources ({results.resources.length})</Typography>
            <List dense>
              {results.resources.map((r) => (
                <ListItem key={r.id} disableGutters>
                  <ListItemText
                    primary={r.user_name}
                    secondary={`${r.title || 'No title'} · ${r.department || 'No department'}`}
                  />
                  <Chip size="small" label={`${r.total_allocation_pct}/${r.weekly_capacity}%`} />
                </ListItem>
              ))}
              {results.resources.length === 0 && (
                <Typography variant="body2" color="text.secondary">No matching resources.</Typography>
              )}
            </List>
          </Paper>
        </>
      )}
    </Box>
  );
}
