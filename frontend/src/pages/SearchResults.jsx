/**
 * UI-08 Search Results.
 *
 * req/Application_Flow.md §13 — the global search fans out across projects,
 * deliverables and resources and presents the three result sets together.
 * States follow req/UI_UX_Design&UserFlow.md §15 via the shared PageState
 * components; status renders as dot+label per the glow-up brief v2 §2.
 */
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

import PageHeader from '../components/PageHeader';
import StatusIndicator from '../components/StatusIndicator';
import { EmptyState, ErrorState, LoadingState } from '../components/PageState';
import { EmptyDataIllustration } from '../components/illustrations';
import * as projectsService from '../services/projectsService';
import * as deliverablesService from '../services/deliverablesService';
import * as resourcesService from '../services/resourcesService';
import { useStatusColors } from '../theme';

const EMPTY_RESULTS = { projects: [], deliverables: [], resources: [] };

export default function SearchResults() {
  const [searchParams] = useSearchParams();
  const q = searchParams.get('q') || '';
  // Mode-aware status palette (glow-up brief v2 §2) — the static STATUS_COLORS
  // object would go stale when the colour mode flips.
  const statusColors = useStatusColors();

  // The state carries the request key it answers, so an empty query needs no
  // request and "still loading" is derived rather than written before one is
  // issued. The reload token folds into the key so Retry re-runs the effect.
  const [reloadToken, setReloadToken] = useState(0);
  const requestKey = `${reloadToken}:${q}`;
  const [state, setState] = useState({ key: null, results: null, error: '' });
  const answered = state.key === requestKey;
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
            key: requestKey,
            results: { projects: p.projects, deliverables: d.deliverables, resources: r.resources },
            error: '',
          });
        }
      })
      .catch((err) => {
        if (active) setState({ key: requestKey, results: null, error: err.message });
      });
    return () => {
      active = false;
    };
  }, [q, requestKey]);

  const total = results
    ? results.projects.length + results.deliverables.length + results.resources.length
    : 0;

  return (
    <Box>
      <PageHeader
        title="Search Results"
        summary={
          results && q
            ? `“${q}” · ${results.projects.length} projects · ${results.deliverables.length} deliverables · ${results.resources.length} resources`
            : undefined
        }
      />

      {!results && !error && <LoadingState label={`Searching for “${q}”…`} />}

      {error && <ErrorState title="Search failed" error={error} onRetry={() => setReloadToken((t) => t + 1)} />}

      {results && total === 0 && (
        // The call to action here is the ever-present global search bar, so the
        // empty state carries guidance rather than a button (§15).
        <EmptyState
          icon={<EmptyDataIllustration />}
          title={q ? `No results for “${q}”` : 'Search the workspace'}
          message={
            q
              ? 'Try a different term, or search by project name, deliverable title or person.'
              : 'Use the search bar above to find projects, deliverables and resources.'
          }
        />
      )}

      {results && total > 0 && (
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
                  <StatusIndicator color={statusColors[p.status] || 'grey.500'} label={p.status} />
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
                  <StatusIndicator color={statusColors[d.status] || 'grey.500'} label={d.status} />
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
                  {/* Allocation is a figure, not a state — a count/badge chip
                      stays a chip (glow-up brief v2 §2). */}
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
