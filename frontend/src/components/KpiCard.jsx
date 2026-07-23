/**
 * KPI card — the "hero number" form: one figure, its context, no plot.
 *
 * Editorial shape (glow-up brief v2 §2): a 2px hairline top rule instead of a
 * boxed-in look, tabular figures so KPI rows align digit-for-digit, and a
 * sub-200ms count-up on load (skipped under prefers-reduced-motion). Shared
 * by Dashboard and Team Insights so the steady-state row reads as one system,
 * visibly distinct from the accent-bordered attention panel above it.
 */
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';
import useCountUp from '../hooks/useCountUp';

export default function KpiCard({ label, value, caption, captionColor = 'text.secondary', valueColor }) {
  const shown = useCountUp(value);
  return (
    <Paper sx={{ p: 2, height: '100%', borderTop: '2px solid', borderTopColor: 'divider' }}>
      <Typography variant="subtitle2" color="text.secondary">
        {label}
      </Typography>
      <Typography
        variant="h4"
        component="p"
        color={valueColor}
        sx={{ fontVariantNumeric: 'tabular-nums' }}
      >
        {shown}
      </Typography>
      {caption && (
        <Typography variant="caption" color={captionColor}>
          {caption}
        </Typography>
      )}
    </Paper>
  );
}
