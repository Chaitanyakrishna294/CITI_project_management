import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithProviders, screen } from '../test/test-utils';
import SearchResults from '../pages/SearchResults';
import * as projectsService from '../services/projectsService';
import * as deliverablesService from '../services/deliverablesService';
import * as resourcesService from '../services/resourcesService';

vi.mock('../services/projectsService');
vi.mock('../services/deliverablesService');
vi.mock('../services/resourcesService');

beforeEach(() => {
  vi.clearAllMocks();
});

function renderAt(route) {
  return renderWithProviders(<SearchResults />, { route });
}

describe('SearchResults page', () => {
  it('with no q param, does not call any of the 3 services and shows the search empty state', async () => {
    renderAt('/search');

    expect(await screen.findByText('Search the workspace')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Search Results' })).toBeInTheDocument();
    expect(screen.queryByText(/^Projects \(/)).not.toBeInTheDocument();

    expect(projectsService.listProjects).not.toHaveBeenCalled();
    expect(deliverablesService.listDeliverables).not.toHaveBeenCalled();
    expect(resourcesService.listResources).not.toHaveBeenCalled();
  });

  it('with q=foo, calls all 3 services with {q: "foo"} and renders results from all 3 sections', async () => {
    projectsService.listProjects.mockResolvedValue({
      projects: [{ id: 1, name: 'Foo Project', manager_name: 'Mgr A', department: 'IT', status: 'active' }],
    });
    deliverablesService.listDeliverables.mockResolvedValue({
      deliverables: [{ id: 2, title: 'Foo Deliverable', project_id: 1, owner_name: 'Owner A', due_date: '2026-08-01', status: 'in_progress' }],
    });
    resourcesService.listResources.mockResolvedValue({
      resources: [{ id: 3, user_name: 'Foo Resource', title: 'Engineer', department: 'IT', total_allocation_pct: 50, weekly_capacity: 100 }],
    });

    renderAt('/search?q=foo');

    expect(await screen.findByText('Foo Project')).toBeInTheDocument();
    expect(screen.getByText('Foo Deliverable')).toBeInTheDocument();
    expect(screen.getByText('Foo Resource')).toBeInTheDocument();

    expect(projectsService.listProjects).toHaveBeenCalledWith({ q: 'foo' });
    expect(deliverablesService.listDeliverables).toHaveBeenCalledWith({ q: 'foo' });
    expect(resourcesService.listResources).toHaveBeenCalledWith({ q: 'foo' });

    expect(screen.getByText('Projects (1)')).toBeInTheDocument();
    expect(screen.getByText('Deliverables (1)')).toBeInTheDocument();
    expect(screen.getByText('Resources (1)')).toBeInTheDocument();

    // Status renders as dot+label text, never a filled chip; the summary line
    // carries the live counts.
    expect(screen.getByText('active')).toBeInTheDocument();
    expect(screen.getByText('in_progress')).toBeInTheDocument();
    expect(screen.getByText('“foo” · 1 projects · 1 deliverables · 1 resources')).toBeInTheDocument();
  });

  it('with q=foo and no matches anywhere, shows a single no-results empty state instead of sections', async () => {
    projectsService.listProjects.mockResolvedValue({ projects: [] });
    deliverablesService.listDeliverables.mockResolvedValue({ deliverables: [] });
    resourcesService.listResources.mockResolvedValue({ resources: [] });

    renderAt('/search?q=foo');

    expect(await screen.findByText('No results for “foo”')).toBeInTheDocument();
    expect(screen.queryByText(/^Projects \(/)).not.toBeInTheDocument();
  });

  // Unlike Dashboard.jsx, which catches each service call individually and
  // degrades sections independently, SearchResults uses a single Promise.all
  // with one shared .catch — so if ANY ONE of the 3 calls rejects, the whole
  // page shows an error state instead of any partial results.
  it('shows a page-level error with retry (not partial results) when any one of the 3 calls rejects, and Retry re-runs the search', async () => {
    projectsService.listProjects.mockResolvedValue({ projects: [] });
    deliverablesService.listDeliverables.mockRejectedValue(new Error('deliverables search failed'));
    resourcesService.listResources.mockResolvedValue({ resources: [] });

    renderAt('/search?q=foo');

    expect(await screen.findByText('deliverables search failed')).toBeInTheDocument();
    expect(screen.queryByText(/^Projects \(/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Deliverables \(/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Resources \(/)).not.toBeInTheDocument();

    deliverablesService.listDeliverables.mockResolvedValue({
      deliverables: [{ id: 2, title: 'Foo Deliverable', project_id: 1, owner_name: null, due_date: null, status: 'not_started' }],
    });
    await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

    expect(await screen.findByText('Foo Deliverable')).toBeInTheDocument();
    expect(deliverablesService.listDeliverables).toHaveBeenCalledTimes(2);
  });
});
