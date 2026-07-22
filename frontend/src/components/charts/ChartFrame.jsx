/**
 * Shared chrome for the dashboard charts: card surface, title, legend, and the
 * accessible table fallback.
 *
 * req/UI_UX_Design&UserFlow.md §12 asks for charts on the dashboard and §14 for
 * WCAG compliance. Colour alone never carries meaning here — every chart with
 * two or more series renders a labelled legend, and each chart exposes the same
 * numbers as a real <table> that screen readers announce and sighted users can
 * reveal. That table is also the "relief" for any hue that sits below 3:1
 * contrast on the surface.
 */
import { useId, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';

/** Small colour swatch + label. Never rendered without its label. */
export function LegendItem({ color, label, value }) {
  return (
    <Stack direction="row" spacing={0.75} alignItems="center">
      <Box
        component="span"
        aria-hidden="true"
        sx={{ width: 10, height: 10, borderRadius: '2px', bgcolor: color, flexShrink: 0 }}
      />
      <Typography variant="caption" color="text.secondary">
        {label}
        {value != null && ` · ${value}`}
      </Typography>
    </Stack>
  );
}

export default function ChartFrame({
  title,
  subtitle,
  legend,
  tableColumns,
  tableRows,
  empty,
  emptyMessage = 'No data to chart yet.',
  children,
}) {
  const [showTable, setShowTable] = useState(false);
  const tableId = useId();

  return (
    <Paper sx={{ p: 2, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ mb: 1 }}>
        <Typography variant="h6" component="h2">
          {title}
        </Typography>
        {subtitle && (
          <Typography variant="caption" color="text.secondary">
            {subtitle}
          </Typography>
        )}
      </Box>

      {empty ? (
        <Typography variant="body2" color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
          {emptyMessage}
        </Typography>
      ) : (
        <>
          <Box sx={{ flexGrow: 1, minWidth: 0 }}>{children}</Box>

          {legend && legend.length > 0 && (
            <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap sx={{ mt: 1.5 }}>
              {legend.map((item) => (
                <LegendItem key={item.label} {...item} />
              ))}
            </Stack>
          )}

          {tableColumns && tableRows && (
            <Box sx={{ mt: 1 }}>
              <Button
                size="small"
                onClick={() => setShowTable((open) => !open)}
                aria-expanded={showTable}
                aria-controls={tableId}
              >
                {showTable ? 'Hide data table' : 'View as table'}
              </Button>
              <Collapse in={showTable} id={tableId}>
                <Table size="small" sx={{ mt: 1 }}>
                  <TableHead>
                    <TableRow>
                      {tableColumns.map((c) => (
                        <TableCell key={c} align={c === tableColumns[0] ? 'left' : 'right'}>
                          {c}
                        </TableCell>
                      ))}
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {tableRows.map((row, i) => (
                      <TableRow key={i}>
                        {row.map((cell, j) => (
                          <TableCell key={j} align={j === 0 ? 'left' : 'right'}>
                            {cell}
                          </TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Collapse>
            </Box>
          )}
        </>
      )}
    </Paper>
  );
}
