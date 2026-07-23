/**
 * Loading / empty / error states shared by every data view.
 *
 * req/UI_UX_Design&UserFlow.md §15 requires all three for each data view:
 *   Loading — skeleton loaders or progress indicators
 *   Empty   — friendly message with a clear call to action
 *   Error   — human-readable message with a retry option where applicable
 *
 * Screens render <LoadingState/>, <EmptyState/> and <ErrorState/> directly, or
 * wrap their content in <PageState> to get the whole decision in one place.
 */
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Skeleton from '@mui/material/Skeleton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { EmptyInboxIcon } from './icons';

/**
 * Skeleton placeholder shaped like the content it stands in for, so the layout
 * does not jump when real data arrives.
 *
 * variant: 'table' (default) | 'cards' | 'text'
 */
export function LoadingState({ variant = 'table', rows = 5, label = 'Loading…' }) {
  if (variant === 'cards') {
    return (
      <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap role="status" aria-label={label}>
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} variant="rounded" width={220} height={104} sx={{ flexGrow: 1 }} />
        ))}
      </Stack>
    );
  }

  if (variant === 'text') {
    return (
      <Box role="status" aria-label={label}>
        {Array.from({ length: rows }).map((_, i) => (
          <Skeleton key={i} variant="text" width={i === rows - 1 ? '60%' : '100%'} height={24} />
        ))}
      </Box>
    );
  }

  return (
    <Paper role="status" aria-label={label} sx={{ p: 2 }}>
      <Skeleton variant="rectangular" height={40} sx={{ mb: 1 }} />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} variant="rectangular" height={32} sx={{ mb: 0.5 }} />
      ))}
    </Paper>
  );
}

/**
 * Shown when a request succeeded but returned nothing. `action` is the call to
 * action §15 asks for — omitted for users whose role cannot create records.
 */
export function EmptyState({ title = 'Nothing here yet', message, actionLabel, onAction, icon }) {
  return (
    <Paper sx={{ p: 6, textAlign: 'center' }}>
      <Box sx={{ color: 'text.disabled', mb: 2 }}>
        {icon || <EmptyInboxIcon size={56} />}
      </Box>
      <Typography variant="h6" gutterBottom>
        {title}
      </Typography>
      {message && (
        <Typography variant="body2" color="text.secondary" sx={{ mb: 3 }}>
          {message}
        </Typography>
      )}
      {actionLabel && onAction && (
        <Button variant="contained" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </Paper>
  );
}

/**
 * Human-readable failure with an optional retry, per §15. The raw error text is
 * shown because these are operator-facing internal tools — but it is never the
 * only thing shown, so the user always knows what failed.
 */
export function ErrorState({ title = 'Something went wrong', error, onRetry }) {
  return (
    <Alert
      severity="error"
      action={
        onRetry ? (
          <Button color="inherit" size="small" onClick={onRetry}>
            Retry
          </Button>
        ) : undefined
      }
    >
      <AlertTitle>{title}</AlertTitle>
      {typeof error === 'string' ? error : error?.message || 'Please try again.'}
    </Alert>
  );
}

/**
 * Convenience wrapper that picks the right state for a data view.
 *
 * <PageState loading={loading} error={error} empty={rows.length === 0} …>
 *   {table}
 * </PageState>
 */
export default function PageState({
  loading,
  error,
  empty,
  onRetry,
  loadingVariant,
  loadingRows,
  emptyTitle,
  emptyMessage,
  emptyActionLabel,
  onEmptyAction,
  children,
}) {
  if (loading) return <LoadingState variant={loadingVariant} rows={loadingRows} />;
  if (error) return <ErrorState error={error} onRetry={onRetry} />;
  if (empty) {
    return (
      <EmptyState
        title={emptyTitle}
        message={emptyMessage}
        actionLabel={emptyActionLabel}
        onAction={onEmptyAction}
      />
    );
  }
  return children;
}
