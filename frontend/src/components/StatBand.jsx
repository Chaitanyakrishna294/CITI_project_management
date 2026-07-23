/**
 * Stat band — one continuous surface of KPI cells divided by hairlines,
 * replacing a row of separate cards. The 1px grid gap lets the divider
 * colour show through between cells, so the band reads as a single
 * instrument (Ink & Porcelain: fewer surfaces, more structure).
 *
 *   <StatBand
 *     items={[
 *       { label: 'Active Projects', value: 3, caption: '1 completed' },
 *       { label: 'Projects at Risk', value: 2, valueColor: 'error.main' },
 *     ]}
 *   />
 *
 * Each cell keeps the same DOM contract as the old KpiCard: the label and
 * value share one enclosing div, so `getByText(label).closest('div')`
 * still scopes to the cell in tests.
 */
import Paper from '@mui/material/Paper';
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import useCountUp from '../hooks/useCountUp';

function StatCell({ label, value, caption, captionColor = 'text.secondary', valueColor }) {
  const shown = useCountUp(value);
  return (
    <Box sx={{ bgcolor: 'background.paper', p: 3, minWidth: 0 }}>
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
    </Box>
  );
}

export default function StatBand({ items }) {
  return (
    <Paper sx={{ overflow: 'hidden' }}>
      <Box
        sx={{
          display: 'grid',
          gap: '1px',
          bgcolor: 'divider',
          gridTemplateColumns: {
            xs: 'repeat(auto-fit, minmax(150px, 1fr))',
            sm: `repeat(auto-fit, minmax(180px, 1fr))`,
          },
        }}
      >
        {items.map((item) => (
          <StatCell key={item.label} {...item} />
        ))}
      </Box>
    </Paper>
  );
}
