import { describe, it, expect, vi, beforeEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { Routes, Route, useLocation } from 'react-router-dom';
import { renderWithAuth, screen, waitFor } from '../test/test-utils';
import ProjectDetails from './ProjectDetails';
import * as projectsService from '../services/projectsService';

vi.mock('../services/projectsService');

const deliverablesPanelMock = vi.fn(() => <div data-testid="deliverables-panel" />);
const resourcesPanelMock = vi.fn(() => <div data-testid="resources-panel" />);
const budgetPanelMock = vi.fn(() => <div data-testid="budget-panel" />);

vi.mock('../components/DeliverablesPanel', () => ({
  default: (props) => deliverablesPanelMock(props),
}));
vi.mock('../components/ProjectResourcesPanel', () => ({
  default: (props) => resourcesPanelMock(props),
}));
vi.mock('../components/BudgetPanel', () => ({
  default: (props) => budgetPanelMock(props),
}));

function LocationProbe() {
  const location = useLocation();
  return <div data-testid="location-probe">{location.pathname}{location.search}</div>;
}

function renderDetails({ user, id = '10' } = {}) {
  return renderWithAuth(
    <Routes>
      <Route path="/projects/:id" element={<ProjectDetails />} />
      <Route path="/projects" element={<LocationProbe />} />
    </Routes>,
    { user, initialEntries: [`/projects/${id}`] }
  );
}

const adminUser = { id: 1, name: 'Ada Admin', role: 'admin' };
const managerUser = { id: 2, name: 'Pat Manager', role: 'project_manager' };
const otherUser = { id: 3, name: 'Other Person', role: 'team_member' };

const project = {
  id: 10,
  name: 'Website Revamp',
  manager_id: 2,
  manager_name: 'Pat Manager',
  department: 'Marketing',
  status: 'active',
  description: 'Revamp the corporate website.',
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('ProjectDetails page', () => {
  it('renders nothing while loading (before getProject resolves)', async () => {
    let resolvePromise;
    projectsService.getProject.mockReturnValue(
      new Promise((resolve) => {
        resolvePromise = resolve;
      })
    );
    renderDetails({ user: adminUser });

    expect(screen.queryByText('Website Revamp')).not.toBeInTheDocument();
    expect(screen.queryByRole('heading')).not.toBeInTheDocument();

    resolvePromise({ project });
    expect(await screen.findByText('Website Revamp')).toBeInTheDocument();
  });

  it('shows an error Alert if getProject rejects', async () => {
    projectsService.getProject.mockRejectedValue(new Error('Project not found'));
    renderDetails({ user: adminUser });

    expect(await screen.findByText('Project not found')).toBeInTheDocument();
  });

  it('shows project name, status chip, manager, and description once loaded', async () => {
    projectsService.getProject.mockResolvedValue({ project });
    renderDetails({ user: adminUser });

    expect(await screen.findByText('Website Revamp')).toBeInTheDocument();
    expect(screen.getByText('active')).toBeInTheDocument();
    expect(screen.getByText(/Pat Manager/)).toBeInTheDocument();
    expect(screen.getByText(/Marketing/)).toBeInTheDocument();
    expect(screen.getByText('Revamp the corporate website.')).toBeInTheDocument();
  });

  it('does not render a description block when project has none', async () => {
    projectsService.getProject.mockResolvedValue({ project: { ...project, description: '' } });
    renderDetails({ user: adminUser });

    await screen.findByText('Website Revamp');
    expect(screen.queryByText('Revamp the corporate website.')).not.toBeInTheDocument();
  });

  it('"Back to Projects" button navigates to /projects', async () => {
    const user = userEvent.setup();
    projectsService.getProject.mockResolvedValue({ project });
    renderDetails({ user: adminUser });

    await screen.findByText('Website Revamp');
    await user.click(screen.getByRole('button', { name: /Back to Projects/ }));

    const probe = await screen.findByTestId('location-probe');
    expect(probe).toHaveTextContent('/projects');
  });

  it('shows the Deliverables panel by default', async () => {
    projectsService.getProject.mockResolvedValue({ project });
    renderDetails({ user: adminUser });

    expect(await screen.findByTestId('deliverables-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('resources-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('budget-panel')).not.toBeInTheDocument();
  });

  it('clicking the Resources tab swaps to the Resources panel', async () => {
    const user = userEvent.setup();
    projectsService.getProject.mockResolvedValue({ project });
    renderDetails({ user: adminUser });

    await screen.findByTestId('deliverables-panel');
    await user.click(screen.getByRole('tab', { name: 'Resources' }));

    expect(await screen.findByTestId('resources-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('deliverables-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('budget-panel')).not.toBeInTheDocument();
  });

  it('clicking the Budget tab swaps to the Budget panel', async () => {
    const user = userEvent.setup();
    projectsService.getProject.mockResolvedValue({ project });
    renderDetails({ user: adminUser });

    await screen.findByTestId('deliverables-panel');
    await user.click(screen.getByRole('tab', { name: 'Budget' }));

    expect(await screen.findByTestId('budget-panel')).toBeInTheDocument();
    expect(screen.queryByTestId('deliverables-panel')).not.toBeInTheDocument();
    expect(screen.queryByTestId('resources-panel')).not.toBeInTheDocument();
  });

  it('computes canManage=true and passes it to child panels for an admin', async () => {
    projectsService.getProject.mockResolvedValue({ project });
    renderDetails({ user: adminUser });

    await screen.findByTestId('deliverables-panel');
    expect(deliverablesPanelMock).toHaveBeenCalledWith(
      expect.objectContaining({ canManage: true })
    );
    expect(resourcesPanelMock).not.toHaveBeenCalled();
  });

  it('computes canManage=true and passes it to child panels for the project\'s own manager', async () => {
    projectsService.getProject.mockResolvedValue({ project });
    renderDetails({ user: managerUser });

    await screen.findByTestId('deliverables-panel');
    expect(deliverablesPanelMock).toHaveBeenCalledWith(
      expect.objectContaining({ canManage: true })
    );
  });

  it('computes canManage=false and passes it to child panels for any other user', async () => {
    projectsService.getProject.mockResolvedValue({ project });
    renderDetails({ user: otherUser });

    await screen.findByTestId('deliverables-panel');
    expect(deliverablesPanelMock).toHaveBeenCalledWith(
      expect.objectContaining({ canManage: false })
    );
  });

  it('passes canManage through to the Resources panel too when switched to', async () => {
    const user = userEvent.setup();
    projectsService.getProject.mockResolvedValue({ project });
    renderDetails({ user: otherUser });

    await screen.findByTestId('deliverables-panel');
    await user.click(screen.getByRole('tab', { name: 'Resources' }));

    await screen.findByTestId('resources-panel');
    expect(resourcesPanelMock).toHaveBeenCalledWith(
      expect.objectContaining({ canManage: false })
    );
  });
});
