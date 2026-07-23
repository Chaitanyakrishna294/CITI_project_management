/**
 * Confirmation dialog for destructive actions.
 *
 * req/UI_UX_Design&UserFlow.md §16 requires a confirmation dialog before any
 * destructive action, and §11 requires the submit control to be disabled while
 * the action is in flight. This replaces window.confirm(), which is unstyled,
 * unthemeable and not screen-reader friendly.
 *
 * <ConfirmDialog
 *   open={open}
 *   title="Archive project?"
 *   message="It will no longer accept new deliverables."
 *   confirmLabel="Archive"
 *   onConfirm={handleArchive}   // may be async; errors surface inline
 *   onClose={() => setOpen(false)}
 * />
 */
import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';

export default function ConfirmDialog({
  open,
  title = 'Are you sure?',
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  confirmColor = 'error',
  onConfirm,
  onClose,
}) {
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  async function handleConfirm() {
    setError('');
    setSubmitting(true);
    try {
      await onConfirm();
      onClose();
    } catch (err) {
      // Keep the dialog open so the user can read the failure and retry.
      setError(err.message || 'The action could not be completed.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleClose() {
    if (submitting) return; // Don't let a dismiss race an in-flight request.
    setError('');
    onClose();
  }

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      maxWidth="xs"
      aria-labelledby="confirm-dialog-title"
      // The consequence sentence is announced on open, not just the title.
      aria-describedby={message ? 'confirm-dialog-description' : undefined}
    >
      <DialogTitle id="confirm-dialog-title">{title}</DialogTitle>
      <DialogContent>
        {error && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {error}
          </Alert>
        )}
        {message && (
          <DialogContentText id="confirm-dialog-description">{message}</DialogContentText>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={handleClose} disabled={submitting}>
          {cancelLabel}
        </Button>
        <Button variant="contained" color={confirmColor} onClick={handleConfirm} disabled={submitting}>
          {submitting ? 'Working…' : confirmLabel}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
