import { describe, it, expect, vi } from 'vitest';
import userEvent from '@testing-library/user-event';
import { renderWithAuth, screen, waitFor } from '../test/test-utils';
import ConfirmDialog from '../components/ConfirmDialog';

function setup(props = {}) {
  const onConfirm = props.onConfirm || vi.fn().mockResolvedValue();
  const onClose = props.onClose || vi.fn();
  renderWithAuth(
    <ConfirmDialog
      open
      title="Archive project?"
      message="It will no longer accept new deliverables."
      confirmLabel="Archive"
      {...props}
      onConfirm={onConfirm}
      onClose={onClose}
    />
  );
  return { onConfirm, onClose };
}

describe('ConfirmDialog', () => {
  it('renders the title, message and both actions', () => {
    setup();
    expect(screen.getByRole('heading', { name: 'Archive project?' })).toBeInTheDocument();
    expect(screen.getByText('It will no longer accept new deliverables.')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Archive' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('renders nothing when closed', () => {
    const onConfirm = vi.fn();
    renderWithAuth(<ConfirmDialog open={false} onConfirm={onConfirm} onClose={vi.fn()} />);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('runs onConfirm then closes when confirmed', async () => {
    const user = userEvent.setup();
    const { onConfirm, onClose } = setup();

    await user.click(screen.getByRole('button', { name: 'Archive' }));

    expect(onConfirm).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('closes without running onConfirm when cancelled', async () => {
    const user = userEvent.setup();
    const { onConfirm, onClose } = setup();

    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onConfirm).not.toHaveBeenCalled();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('disables both buttons while the action is in flight', async () => {
    const user = userEvent.setup();
    let resolveConfirm;
    const onConfirm = vi.fn(() => new Promise((resolve) => { resolveConfirm = resolve; }));
    const { onClose } = setup({ onConfirm });

    await user.click(screen.getByRole('button', { name: 'Archive' }));

    expect(screen.getByRole('button', { name: 'Working…' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();

    resolveConfirm();
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
  });

  it('keeps the dialog open and shows the failure when onConfirm rejects', async () => {
    const user = userEvent.setup();
    const onConfirm = vi.fn().mockRejectedValue(new Error('Only managers can archive projects'));
    const { onClose } = setup({ onConfirm });

    await user.click(screen.getByRole('button', { name: 'Archive' }));

    expect(await screen.findByText('Only managers can archive projects')).toBeInTheDocument();
    expect(onClose).not.toHaveBeenCalled();
    // Re-enabled so the user can retry or back out.
    expect(screen.getByRole('button', { name: 'Archive' })).toBeEnabled();
  });

  it('uses the supplied labels', () => {
    setup({ confirmLabel: 'Delete forever', cancelLabel: 'Keep it' });
    expect(screen.getByRole('button', { name: 'Delete forever' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Keep it' })).toBeInTheDocument();
  });
});
