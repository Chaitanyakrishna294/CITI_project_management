import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithAuth, screen } from '../test/test-utils';
import PageState, { LoadingState, EmptyState, ErrorState } from '../components/PageState';

describe('LoadingState', () => {
  it('exposes an accessible status region', () => {
    renderWithAuth(<LoadingState label="Loading projects" />);
    expect(screen.getByRole('status', { name: 'Loading projects' })).toBeInTheDocument();
  });

  it('renders each supported variant', () => {
    ['table', 'cards', 'text'].forEach((variant) => {
      const { unmount } = renderWithAuth(<LoadingState variant={variant} label={variant} />);
      expect(screen.getByRole('status', { name: variant })).toBeInTheDocument();
      unmount();
    });
  });
});

describe('EmptyState', () => {
  it('shows the title and message', () => {
    renderWithAuth(<EmptyState title="No projects yet" message="Create one to get started." />);
    expect(screen.getByRole('heading', { name: 'No projects yet' })).toBeInTheDocument();
    expect(screen.getByText('Create one to get started.')).toBeInTheDocument();
  });

  it('renders a call to action and invokes it', async () => {
    const user = userEvent.setup();
    const onAction = vi.fn();
    renderWithAuth(<EmptyState actionLabel="New Project" onAction={onAction} />);

    await user.click(screen.getByRole('button', { name: 'New Project' }));
    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('omits the call to action when no handler is supplied', () => {
    // Roles that cannot create records should not be offered the action.
    renderWithAuth(<EmptyState actionLabel="New Project" />);
    expect(screen.queryByRole('button', { name: 'New Project' })).not.toBeInTheDocument();
  });
});

describe('ErrorState', () => {
  it('renders a string error', () => {
    renderWithAuth(<ErrorState error="Request failed with status 500" />);
    expect(screen.getByText('Request failed with status 500')).toBeInTheDocument();
  });

  it('renders an Error instance message', () => {
    renderWithAuth(<ErrorState error={new Error('Network unreachable')} />);
    expect(screen.getByText('Network unreachable')).toBeInTheDocument();
  });

  it('falls back to generic guidance when there is no message', () => {
    renderWithAuth(<ErrorState error={null} />);
    expect(screen.getByText('Please try again.')).toBeInTheDocument();
  });

  it('offers retry only when a handler is supplied', async () => {
    const user = userEvent.setup();
    const onRetry = vi.fn();

    const { unmount } = renderWithAuth(<ErrorState error="boom" />);
    expect(screen.queryByRole('button', { name: /retry/i })).not.toBeInTheDocument();
    unmount();

    renderWithAuth(<ErrorState error="boom" onRetry={onRetry} />);
    await user.click(screen.getByRole('button', { name: /retry/i }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });
});

describe('PageState', () => {
  const child = <div>real content</div>;

  it('prefers loading over every other state', () => {
    renderWithAuth(
      <PageState loading error="boom" empty>
        {child}
      </PageState>
    );
    expect(screen.getByRole('status')).toBeInTheDocument();
    expect(screen.queryByText('boom')).not.toBeInTheDocument();
  });

  it('prefers error over empty', () => {
    renderWithAuth(
      <PageState error="boom" empty emptyTitle="Nothing here">
        {child}
      </PageState>
    );
    expect(screen.getByText('boom')).toBeInTheDocument();
    expect(screen.queryByText('Nothing here')).not.toBeInTheDocument();
  });

  it('renders the empty state when there is no data', () => {
    renderWithAuth(
      <PageState empty emptyTitle="Nothing here">
        {child}
      </PageState>
    );
    expect(screen.getByRole('heading', { name: 'Nothing here' })).toBeInTheDocument();
    expect(screen.queryByText('real content')).not.toBeInTheDocument();
  });

  it('renders children once loaded, error-free and non-empty', () => {
    renderWithAuth(<PageState>{child}</PageState>);
    expect(screen.getByText('real content')).toBeInTheDocument();
  });
});
