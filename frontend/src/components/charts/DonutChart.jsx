/**
 * Donut chart — dependency-free SVG.
 *
 * Used only for genuine part-to-whole breakdowns with a small number of slices
 * (deliverable status has four), where the total is meaningful and belongs in
 * the middle. The slice colours are the reserved status palette, so the legend
 * always carries the status name — colour never encodes state on its own.
 *
 * slices: [{ label, value, color }]
 */
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import { useTheme } from '@mui/material/styles';

const SIZE = 180;
const RADIUS = 70;
const STROKE = 26;
const GAP_DEGREES = 2; // Surface gap so adjacent segments stay distinct marks.

function polarToCartesian(cx, cy, r, degrees) {
  const radians = ((degrees - 90) * Math.PI) / 180;
  return { x: cx + r * Math.cos(radians), y: cy + r * Math.sin(radians) };
}

function arcPath(cx, cy, r, startDeg, endDeg) {
  const start = polarToCartesian(cx, cy, r, endDeg);
  const end = polarToCartesian(cx, cy, r, startDeg);
  const largeArc = endDeg - startDeg <= 180 ? 0 : 1;
  return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}

export default function DonutChart({ slices, centerLabel, centerValue }) {
  const theme = useTheme();
  const total = slices.reduce((sum, s) => sum + (Number(s.value) || 0), 0);

  // Precompute each segment's start angle rather than advancing a cursor while
  // mapping — render must not depend on mutation order.
  const drawable = [];
  slices
    .filter((s) => Number(s.value) > 0)
    .forEach((slice) => {
      const previous = drawable[drawable.length - 1];
      const start = previous ? previous.start + previous.share : 0;
      drawable.push({ ...slice, start, share: (Number(slice.value) / total) * 360 });
    });

  return (
    <Box sx={{ display: 'flex', justifyContent: 'center', position: 'relative' }}>
      <svg
        role="img"
        aria-label={`Donut chart of ${centerLabel || 'totals'} by category`}
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        width={SIZE}
        height={SIZE}
      >
        <circle
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          fill="none"
          stroke={theme.palette.action.hover}
          strokeWidth={STROKE}
        />

        {drawable.map((slice) => {
          // Only inset a gap when there is more than one segment to separate.
          const end = slice.start + slice.share - (drawable.length > 1 ? GAP_DEGREES : 0);

          // A full circle can't be drawn as a single arc — use a plain circle.
          if (drawable.length === 1) {
            return (
              <Tooltip key={slice.label} title={`${slice.label}: ${slice.value}`} followCursor>
                <circle
                  cx={SIZE / 2}
                  cy={SIZE / 2}
                  r={RADIUS}
                  fill="none"
                  stroke={slice.color}
                  strokeWidth={STROKE}
                />
              </Tooltip>
            );
          }

          return (
            <Tooltip
              key={slice.label}
              title={`${slice.label}: ${slice.value} (${Math.round((Number(slice.value) / total) * 100)}%)`}
              followCursor
            >
              <path
                d={arcPath(SIZE / 2, SIZE / 2, RADIUS, slice.start, end)}
                fill="none"
                stroke={slice.color}
                strokeWidth={STROKE}
                strokeLinecap="butt"
              />
            </Tooltip>
          );
        })}
      </svg>

      {/* Hero number in the hole — the total the slices add up to. */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
        }}
      >
        <Typography variant="h5" component="p">
          {centerValue ?? total}
        </Typography>
        {centerLabel && (
          <Typography variant="caption" color="text.secondary">
            {centerLabel}
          </Typography>
        )}
      </Box>
    </Box>
  );
}
