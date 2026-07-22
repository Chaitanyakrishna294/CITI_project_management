import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, within } from '../test/test-utils';
import SearchResults from './SearchResults';
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
  it('with no q param, does not call any of the 3 services and shows empty-result sections', async () => {
    renderAt('/search');

    await screen.findByText('Projects (0)');
    expect(screen.getByText('Deliverables (0)')).toBeInTheDocument();
    expect(screen.getByText('Resources (0)')).toBeInTheDocument();
    expect(screen.getByText('No matching projects.')).toBeInTheDocument();
    expect(screen.getByText('No matching deliverables.')).toBeInTheDocument();
    expect(screen.getByText('No matching resources.')).toBeInTheDocument();

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
  });

  // Unlike Dashboard.jsx, which catches each service call individually and
  // degrades sections independently, SearchResults uses a single Promise.all
  // with one shared .catch — so if ANY ONE of the 3 calls rejects, the whole
  // page shows an error Alert instead of any partial results.
  it('shows a page-level error Alert (not partial results) when any one of the 3 calls rejects', async () => {
    projectsService.listProjects.mockResolvedValue({ projects: [] });
    deliverablesService.listDeliverables.mockRejectedValue(new Error('deliverables search failed'));
    resourcesService.listResources.mockResolvedValue({ resources: [] });

    renderAt('/search?q=foo');

    expect(await screen.findByText('deliverables search failed')).toBeInTheDocument();
    expect(screen.queryByText(/^Projects \(/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Deliverables \(/)).not.toBeInTheDocument();
    expect(screen.queryByText(/^Resources \(/)).not.toBeInTheDocument();
  });
});
