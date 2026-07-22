/**
 * Line chart — dependency-free SVG.
 *
 * For change over an ordered axis (deliverables falling due month by month).
 * One value axis only: every series plotted here shares the same unit.
 *
 * points: [{ label, values: [n, …] }]   — ordered along the x axis
 * series: [{ label, color }]
 */
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import { useTheme } from '@mui/material/styles';

const WIDTH = 480;
const HEIGHT = 180;
const PAD = { top: 12, right: 12, bottom: 26, left: 30 };

export default function LineChart({ points, series, formatValue = (v) => String(v) }) {
  const theme = useTheme();

  const plotWidth = WIDTH - PAD.left - PAD.right;
  const plotHeight = HEIGHT - PAD.top - PAD.bottom;
  const max = Math.max(1, ...points.flatMap((p) => p.values.map((v) => Number(v) || 0)));

  // A single point has no span to divide; pin it to the middle of the plot.
  const xAt = (i) => (points.length === 1 ? PAD.left + plotWidth / 2 : PAD.left + (i / (points.length - 1)) * plotWidth);
  const yAt = (v) => PAD.top + plotHeight - ((Number(v) || 0) / max) * plotHeight;

  const gridLines = [0, 0.5, 1];

  return (
    <Box sx={{ width: '100%', overflowX: 'auto' }}>
      <svg
        role="img"
        aria-label={`Line chart of ${series.map((s) => s.label).join(' and ')} over time`}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        width="100%"
        height={HEIGHT}
        preserveAspectRatio="xMidYMid meet"
      >
        {/* Recessive grid: hairlines behind the data, never competing with it. */}
        {gridLines.map((fraction) => {
          const y = PAD.top + plotHeight - fraction * plotHeight;
          return (
            <g key={fraction}>
              <line
                x1={PAD.left}
                x2={WIDTH - PAD.right}
                y1={y}
                y2={y}
                stroke={theme.palette.divider}
                strokeWidth={1}
              />
              <text x={0} y={y} dominantBaseline="middle" fontSize="10" fill={theme.palette.text.secondary}>
                {Math.round(max * fraction)}
              </text>
            </g>
          );
        })}

        {series.map((s, seriesIndex) => {
          const path = points
            .map((p, i) => `${i === 0 ? 'M' : 'L'} ${xAt(i)} ${yAt(p.values[seriesIndex])}`)
            .join(' ');
          return (
            <g key={s.label}>
              <path d={path} fill="none" stroke={s.color} strokeWidth={2} strokeLinejoin="round" />
              {points.map((p, i) => (
                <Tooltip
                  key={p.label}
                  title={`${p.label} — ${s.label}: ${formatValue(p.values[seriesIndex])}`}
                  followCursor
                >
                  {/* 2px surface ring keeps markers legible where lines overlap. */}
                  <circle
                    cx={xAt(i)}
                    cy={yAt(p.values[seriesIndex])}
                    r={4}
                    fill={s.color}
                    stroke={theme.palette.background.paper}
                    strokeWidth={2}
                  />
                </Tooltip>
              ))}
            </g>
          );
        })}

        {points.map((p, i) => (
          <text
            key={p.label}
            x={xAt(i)}
            y={HEIGHT - 8}
            textAnchor="middle"
            fontSize="10"
            fill={theme.palette.text.secondary}
          >
            {p.label}
          </text>
        ))}
      </svg>
    </Box>
  );
}
