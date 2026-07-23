/**
 * Horizontal grouped bar chart — dependency-free SVG.
 *
 * Horizontal because the category labels are project names, which need room to
 * read; comparing magnitude across a handful of named things is exactly the job
 * bars do best. Both series share one value axis (currency), so there is a
 * single scale — never two.
 *
 * data:   [{ label, values: [n, n] }]
 * series: [{ label, color }]          — one entry per value slot
 */
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import { useTheme } from '@mui/material/styles';

const ROW_HEIGHT = 34;
const BAR_HEIGHT = 11;
const BAR_GAP = 2; // Surface gap keeps adjacent fills from reading as one mark.
const LABEL_WIDTH = 132;
const VALUE_WIDTH = 76;

export default function BarChart({ data, series, formatValue = (v) => String(v), height }) {
  const theme = useTheme();
  const max = Math.max(1, ...data.flatMap((d) => d.values.map((v) => Number(v) || 0)));
  const chartHeight = height || data.length * ROW_HEIGHT + 8;

  return (
    <Box sx={{ width: '100%', overflowX: 'auto' }}>
      <svg
        role="img"
        aria-label={`Bar chart comparing ${series.map((s) => s.label).join(' and ')}`}
        viewBox={`0 0 480 ${chartHeight}`}
        width="100%"
        height={chartHeight}
        preserveAspectRatio="xMidYMid meet"
      >
        {data.map((row, rowIndex) => {
          // Category labels come from joined data, so tolerate a missing name
          // rather than tearing down the dashboard around one bad row.
          const label = row.label ?? '—';
          const groupTop = rowIndex * ROW_HEIGHT + 4;
          const trackWidth = 480 - LABEL_WIDTH - VALUE_WIDTH;
          // Centre the stack of bars within the row.
          const stackHeight = series.length * BAR_HEIGHT + (series.length - 1) * BAR_GAP;
          const stackTop = groupTop + (ROW_HEIGHT - stackHeight) / 2;

          return (
            // Keyed by position, not label: two missing labels both coerce to
            // '—' and duplicate keys would drop a row.
            <g key={rowIndex}>
              <title>{label}</title>
              <text
                x={0}
                y={stackTop + stackHeight / 2}
                dominantBaseline="middle"
                fontSize="12"
                fill={theme.palette.text.primary}
              >
                {label.length > 20 ? `${label.slice(0, 19)}…` : label}
              </text>

              {row.values.map((value, seriesIndex) => {
                const numeric = Number(value) || 0;
                const width = Math.max(numeric > 0 ? 2 : 0, (numeric / max) * trackWidth);
                const y = stackTop + seriesIndex * (BAR_HEIGHT + BAR_GAP);
                return (
                  <Tooltip
                    key={series[seriesIndex].label}
                    title={`${label} — ${series[seriesIndex].label}: ${formatValue(numeric)}`}
                    followCursor
                  >
                    <rect
                      x={LABEL_WIDTH}
                      y={y}
                      width={width}
                      height={BAR_HEIGHT}
                      rx={4} // Rounded data-end; the baseline end is covered by the next bar's origin.
                      fill={series[seriesIndex].color}
                    />
                  </Tooltip>
                );
              })}

              {/* Direct label on the leading series only — never a number on every mark. */}
              <text
                x={480}
                y={stackTop + stackHeight / 2}
                textAnchor="end"
                dominantBaseline="middle"
                fontSize="11"
                fill={theme.palette.text.secondary}
              >
                {formatValue(Number(row.values[0]) || 0)}
              </text>
            </g>
          );
        })}
      </svg>
    </Box>
  );
}
