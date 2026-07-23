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
      {/* Overline label + large tabular figure: the same ledger-caps voice
          as table headers, so KPI rows and tables read as one system. */}
      {/* Block-level span, not a div: screens locate the enclosing card via
          label.closest('div'), which must resolve to the Paper. */}
      <Typography
        variant="overline"
        color="text.secondary"
        sx={{ display: 'block', fontSize: 11, fontWeight: 600, letterSpacing: '0.08em', lineHeight: 2 }}
      >
        {label}
      </Typography>
      <Typography
        variant="h4"
        component="p"
        color={valueColor}
        sx={{ fontVariantNumeric: 'tabular-nums', fontSize: 30, lineHeight: 1.2 }}
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
