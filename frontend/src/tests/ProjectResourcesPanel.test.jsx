import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithAuth, screen } from '../test/test-utils';
import ProjectResourcesPanel from '../components/ProjectResourcesPanel';

vi.mock('../services/resourcesService');

import * as resourcesService from '../services/resourcesService';

const project = { id: 1, manager_id: 5, name: 'X' };

function renderPanel(user) {
  return renderWithAuth(<ProjectResourcesPanel project={project} />, { user });
}

describe('ProjectResourcesPanel', () => {
  beforeEach(() => {
    vi.resetAllMocks();
    resourcesService.listResources.mockResolvedValue({ resources: [] });
  });

  it('shows "No resources allocated yet." when empty', async () => {
    resourcesService.listAllocations.mockResolvedValue({ allocations: [] });
    renderPanel({ id: 1, role: 'team_member' });

    expect(await screen.findByText('No resources allocated yet.')).toBeInTheDocument();
  });

  it.each(['admin', 'project_manager'])(
    'shows "Allocate Resource" and "Remove" buttons for %s',
    async (role) => {
      resourcesService.listAllocations.mockResolvedValue({
        allocations: [{ id: 1, resource_name: 'Bob', allocation_pct: 50 }],
      });
      renderPanel({ id: 1, role });

      await screen.findByText('Bob');
      expect(screen.getByRole('button', { name: 'Allocate Resource' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
    }
  );

  it.each(['team_member', 'viewer', 'finance'])(
    'hides "Allocate Resource" and "Remove" buttons for %s',
    async (role) => {
      resourcesService.listAllocations.mockResolvedValue({
        allocations: [{ id: 1, resource_name: 'Bob', allocation_pct: 50 }],
      });
      renderPanel({ id: 1, role });

      await screen.findByText('Bob');
      expect(screen.queryByRole('button', { name: 'Allocate Resource' })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Remove' })).not.toBeInTheDocument();
    }
  );

  it('submitting the allocate form calls createAllocation with form + project_id', async () => {
    const user = userEvent.setup();
    resourcesService.listAllocations.mockResolvedValue({ allocations: [] });
    resourcesService.listResources.mockResolvedValue({
      resources: [{ id: 7, user_name: 'Carol', total_allocation_pct: 20, weekly_capacity: 100 }],
    });
    resourcesService.createAllocation.mockResolvedValue({});

    renderPanel({ id: 1, role: 'admin' });

    await screen.findByText('No resources allocated yet.');
    await user.click(screen.getByRole('button', { name: 'Allocate Resource' }));

    const resourceSelect = await screen.findByLabelText(/^Resource/);
    await user.click(resourceSelect);
    await user.click(await screen.findByRole('option', { name: /Carol/ }));

    await user.type(screen.getByLabelText(/^Allocation %/), '25');
    await user.click(screen.getByRole('button', { name: 'Allocate' }));

    expect(resourcesService.createAllocation).toHaveBeenCalledWith({
      resource_id: 7,
      allocation_pct: '25',
      start_date: '',
      end_date: '',
      project_id: project.id,
    });
  });

  describe('remove confirmation', () => {
    let confirmSpy;
    beforeEach(() => {
      confirmSpy = vi.spyOn(window, 'confirm');
    });
    afterEach(() => {
      confirmSpy.mockRestore();
    });

    it('does not remove when window.confirm returns false', async () => {
      const user = userEvent.setup();
      confirmSpy.mockReturnValue(false);
      resourcesService.listAllocations.mockResolvedValue({
        allocations: [{ id: 1, resource_name: 'Bob', allocation_pct: 50 }],
      });
      renderPanel({ id: 1, role: 'admin' });

      await screen.findByText('Bob');
      await user.click(screen.getByRole('button', { name: 'Remove' }));

      expect(confirmSpy).toHaveBeenCalled();
      expect(resourcesService.deleteAllocation).not.toHaveBeenCalled();
    });

    it('removes via deleteAllocation when window.confirm returns true', async () => {
      const user = userEvent.setup();
      confirmSpy.mockReturnValue(true);
      resourcesService.listAllocations.mockResolvedValue({
        allocations: [{ id: 1, resource_name: 'Bob', allocation_pct: 50 }],
      });
      resourcesService.deleteAllocation.mockResolvedValue({});
      renderPanel({ id: 1, role: 'admin' });

      await screen.findByText('Bob');
      await user.click(screen.getByRole('button', { name: 'Remove' }));

      expect(confirmSpy).toHaveBeenCalled();
      expect(resourcesService.deleteAllocation).toHaveBeenCalledWith(1);
    });
  });

  it('shows the error message in the dialog Alert and keeps the dialog open when createAllocation rejects', async () => {
    const user = userEvent.setup();
    resourcesService.listAllocations.mockResolvedValue({ allocations: [] });
    resourcesService.listResources.mockResolvedValue({
      resources: [{ id: 7, user_name: 'Carol', total_allocation_pct: 90, weekly_capacity: 100 }],
    });
    resourcesService.createAllocation.mockRejectedValue(new Error('Allocation exceeds weekly capacity'));

    renderPanel({ id: 1, role: 'admin' });

    await screen.findByText('No resources allocated yet.');
    await user.click(screen.getByRole('button', { name: 'Allocate Resource' }));

    const resourceSelect = await screen.findByLabelText(/^Resource/);
    await user.click(resourceSelect);
    await user.click(await screen.findByRole('option', { name: /Carol/ }));
    await user.type(screen.getByLabelText(/^Allocation %/), '50');
    await user.click(screen.getByRole('button', { name: 'Allocate' }));

    expect(await screen.findByText('Allocation exceeds weekly capacity')).toBeInTheDocument();
    // dialog stays open: the "Allocate" submit button (dialog-scoped) is still present
    expect(screen.getByRole('button', { name: 'Allocate' })).toBeInTheDocument();
  });

  it(
    "any project_manager (not just the project's own manager) can manage allocations - current behavior, may be worth revisiting",
    async () => {
      // project.manager_id (5) belongs to a different user than the logged-in project_manager (id 999)
      resourcesService.listAllocations.mockResolvedValue({
        allocations: [{ id: 1, resource_name: 'Bob', allocation_pct: 50 }],
      });
      renderPanel({ id: 999, role: 'project_manager' });

      await screen.findByText('Bob');
      // canManage is computed purely from role, with no per-project ownership check
      expect(screen.getByRole('button', { name: 'Allocate Resource' })).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Remove' })).toBeInTheDocument();
    }
  );
});
