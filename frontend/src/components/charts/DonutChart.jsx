/**
 * Donut chart — dependency-free SVG.
 *
 * Used only for genuine part-to-whole breakdowns with a small number of slices
 * (deliverable status has four), where the total is meaningful and belongs in
 * the middle. The slice colours are the reserved status palette, so the legend
 * always carries the status name — colour never encodes state on its own.
 *
 * Interaction (translated from a 21st.dev animated donut reference into this
 * MUI/SVG implementation — no framer-motion, no Tailwind):
 *   - segments draw in clockwise on mount, staggered per segment, and the
 *     whole entrance is skipped under prefers-reduced-motion
 *   - hovering a segment quietly dims the others and swaps the centre number
 *     to that segment's value, label and share
 * The reference's glow/drop-shadow treatment was deliberately not carried
 * over — it fights the flat, hairline-border visual language.
 *
 * slices: [{ label, value, color }]
 */
import { useState } from 'react';
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

export default function DonutChart({ slices, centerLabel, centerValue, onSliceHover }) {
  const theme = useTheme();
  const [hovered, setHovered] = useState(null);
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

  function enter(slice) {
    setHovered(slice.label);
    onSliceHover?.(slice);
  }

  function leave() {
    setHovered(null);
    onSliceHover?.(null);
  }

  const hoveredSlice = hovered != null ? drawable.find((s) => s.label === hovered) : null;
  const centreValue = hoveredSlice ? hoveredSlice.value : centerValue ?? total;
  const centreLabel = hoveredSlice ? hoveredSlice.label : centerLabel;
  const centreShare = hoveredSlice ? `${Math.round((Number(hoveredSlice.value) / total) * 100)}%` : null;

  return (
    <Box
      onMouseLeave={leave}
      sx={{
        display: 'flex',
        justifyContent: 'center',
        position: 'relative',
        // Mount entrance: each segment sweeps clockwise into place. pathLength
        // is normalised to 100, so the same keyframes serve every arc length.
        '@keyframes donutSweep': {
          from: { strokeDashoffset: 100 },
          to: { strokeDashoffset: 0 },
        },
        '& .donut-segment': {
          animation: 'donutSweep 0.2s ease-out both',
          transition: 'opacity 0.2s ease-out',
        },
        '@media (prefers-reduced-motion: reduce)': {
          '& .donut-segment': { animation: 'none' },
        },
      }}
    >
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

        {drawable.map((slice, index) => {
          // Only inset a gap when there is more than one segment to separate.
          const end = slice.start + slice.share - (drawable.length > 1 ? GAP_DEGREES : 0);
          const dimmed = hovered != null && hovered !== slice.label;

          const shared = {
            className: 'donut-segment',
            fill: 'none',
            stroke: slice.color,
            strokeWidth: STROKE,
            pathLength: 100,
            strokeDasharray: 100,
            style: {
              animationDelay: `${index * 40}ms`,
              opacity: dimmed ? 0.4 : 1,
            },
            onMouseEnter: () => enter(slice),
          };

          // A full circle can't be drawn as a single arc — use a plain circle.
          if (drawable.length === 1) {
            return (
              <Tooltip key={slice.label} title={`${slice.label}: ${slice.value}`} followCursor>
                <circle cx={SIZE / 2} cy={SIZE / 2} r={RADIUS} {...shared} />
              </Tooltip>
            );
          }

          return (
            <Tooltip
              key={slice.label}
              title={`${slice.label}: ${slice.value} (${Math.round((Number(slice.value) / total) * 100)}%)`}
              followCursor
            >
              <path d={arcPath(SIZE / 2, SIZE / 2, RADIUS, slice.start, end)} {...shared} />
            </Tooltip>
          );
        })}
      </svg>

      {/* Hero number in the hole — the total, or the hovered segment's share. */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          textAlign: 'center',
        }}
      >
        <Typography variant="h5" component="p">
          {centreValue}
        </Typography>
        {centreLabel && (
          <Typography variant="caption" color="text.secondary" sx={{ maxWidth: RADIUS * 1.6 }} noWrap>
            {centreLabel}
          </Typography>
        )}
        {centreShare && (
          <Typography variant="caption" color="text.secondary">
            {centreShare} of total
          </Typography>
        )}
      </Box>
    </Box>
  );
}
