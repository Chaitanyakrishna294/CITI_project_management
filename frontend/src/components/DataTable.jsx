/**
 * Reusable data table.
 *
 * req/UI_UX_Design&UserFlow.md §12 requires every table to support sorting,
 * searching, filtering, pagination and export. Search and filtering are
 * server-side per screen (they map to API query parameters), so this component
 * owns the three that are purely presentational — sorting, pagination and CSV
 * export — and renders whatever filter controls the screen passes as `toolbar`.
 *
 * Columns are declarative:
 *   {
 *     id:          'name',                       // required, unique
 *     label:       'Name',                       // header text
 *     render:      (row) => <Link…/>,            // cell content; without it the cell
 *                                                //   shows sortValue(row) if defined,
 *                                                //   else row[id] — add render when
 *                                                //   sortValue isn't display-safe
 *     sortValue:   (row) => row.name.toLowerCase(),  // default: row[id]
 *     exportValue: (row) => row.name,            // default: row[id]
 *     align:       'right',
 *     sortable:    false,                        // default: true
 *   }
 */
import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import MenuItem from '@mui/material/MenuItem';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import { useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TablePagination from '@mui/material/TablePagination';
import TableRow from '@mui/material/TableRow';
import TableSortLabel from '@mui/material/TableSortLabel';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import { DownloadIcon } from './icons';
import { toCsv, downloadCsv } from '../utils/csv';

/** Value a column sorts on, before any custom formatting. */
function rawValue(column, row) {
  return column.sortValue ? column.sortValue(row) : row[column.id];
}

function compare(a, b) {
  // Nulls sort last regardless of direction — an absent date is not "earliest".
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: 'base' });
}

export default function DataTable({
  columns,
  rows,
  getRowKey = (row) => row.id,
  title,
  toolbar,
  actions,
  defaultOrderBy,
  defaultOrder = 'asc',
  rowsPerPageOptions = [10, 25, 50],
  initialRowsPerPage = 10,
  exportFilename,
  emptyMessage = 'No records to display.',
  dense = false,
}) {
  // Default sort must land on a sortable column — the mobile Sort-by select
  // only lists sortable ones, and an out-of-range value blanks the control.
  const [orderBy, setOrderBy] = useState(
    defaultOrderBy || columns.find((c) => c.sortable !== false)?.id
  );
  const [order, setOrder] = useState(defaultOrder);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(initialRowsPerPage);

  // Below md the table becomes a card list (glow-up brief §4.1): horizontal
  // scrolling loses the identifying first column, so each row renders as a
  // stacked card instead — first column as the card title, the rest as
  // label:value lines, the actions column as a footer row.
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const sortedRows = useMemo(() => {
    const column = columns.find((c) => c.id === orderBy);
    if (!column) return rows;
    const factor = order === 'asc' ? 1 : -1;
    // Slice first: never sort the caller's array in place.
    return [...rows].sort((a, b) => factor * compare(rawValue(column, a), rawValue(column, b)));
  }, [rows, columns, orderBy, order]);

  // Clamp the page so deleting/filtering rows can't strand the user on a page
  // that no longer exists (which would render an empty table with data behind).
  const pageCount = Math.max(1, Math.ceil(sortedRows.length / rowsPerPage));
  const safePage = Math.min(page, pageCount - 1);

  const visibleRows = useMemo(
    () => sortedRows.slice(safePage * rowsPerPage, safePage * rowsPerPage + rowsPerPage),
    [sortedRows, safePage, rowsPerPage]
  );

  function handleSort(columnId) {
    if (orderBy === columnId) {
      setOrder((prev) => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setOrderBy(columnId);
      setOrder('asc');
    }
    setPage(0);
  }

  function handleExport() {
    // Export everything the current filters matched, not just the visible page.
    downloadCsv(exportFilename || 'export.csv', toCsv(columns, sortedRows));
  }

  const showToolbar = Boolean(title || toolbar || actions || exportFilename);

  return (
    <Paper>
      {showToolbar && (
        <Toolbar sx={{ gap: 2, flexWrap: 'wrap', py: 2 }}>
          {title && (
            <Typography variant="h6" component="h2" sx={{ flexShrink: 0 }}>
              {title}
            </Typography>
          )}
          {toolbar}
          <Box sx={{ flexGrow: 1 }} />
          {actions}
          {exportFilename && (
            <Button
              size="small"
              startIcon={<DownloadIcon />}
              onClick={handleExport}
              disabled={sortedRows.length === 0}
            >
              Export
            </Button>
          )}
        </Toolbar>
      )}

      {isMobile ? (
        <Box>
          {sortedRows.length > 1 && (
            <Box sx={{ px: 2, pb: 2 }}>
              <TextField
                select
                size="small"
                label="Sort by"
                value={`${orderBy}:${order}`}
                onChange={(e) => {
                  const [columnId, direction] = e.target.value.split(':');
                  setOrderBy(columnId);
                  setOrder(direction);
                  setPage(0);
                }}
                sx={{ minWidth: 200 }}
              >
                {columns
                  .filter((column) => column.sortable !== false)
                  .flatMap((column) => [
    // Direction-neutral wording: these options also cover dates,
                    // numbers and flags, where "A→Z" misdescribes the sort.
                    <MenuItem key={`${column.id}:asc`} value={`${column.id}:asc`}>
                      {column.label} · ascending
                    </MenuItem>,
                    <MenuItem key={`${column.id}:desc`} value={`${column.id}:desc`}>
                      {column.label} · descending
                    </MenuItem>,
                  ])}
              </TextField>
            </Box>
          )}

          <Box role="list">
            {visibleRows.map((row) => {
              const [titleColumn, ...restColumns] = columns;
              const actionColumns = restColumns.filter((c) => c.id === 'actions');
              const dataColumns = restColumns.filter((c) => c.id !== 'actions');
              return (
                <Box
                  key={getRowKey(row)}
                  role="listitem"
                  sx={{ px: 2, py: 1.5, borderTop: '1px solid', borderColor: 'divider' }}
                >
                  <Typography variant="body1" component="div" sx={{ fontWeight: 600 }}>
                    {titleColumn.render ? titleColumn.render(row) : rawValue(titleColumn, row)}
                  </Typography>
                  {dataColumns.map((column) => (
                    <Box
                      key={column.id}
                      sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, mt: 0.75 }}
                    >
                      <Typography variant="caption" color="text.secondary" sx={{ flexShrink: 0 }}>
                        {column.label}
                      </Typography>
                      <Typography
                        variant="body2"
                        component="div"
                        sx={{
                          textAlign: 'right',
                          // Same tabular figures the desktop alignRight cells get.
                          ...(column.align === 'right' && { fontVariantNumeric: 'tabular-nums' }),
                        }}
                      >
                        {(column.render ? column.render(row) : rawValue(column, row)) ?? '—'}
                      </Typography>
                    </Box>
                  ))}
                  {actionColumns.map((column) => (
                    <Box key={column.id} sx={{ display: 'flex', justifyContent: 'flex-end', mt: 1 }}>
                      {column.render ? column.render(row) : null}
                    </Box>
                  ))}
                </Box>
              );
            })}
          </Box>
          {sortedRows.length === 0 && (
            <Typography
              variant="body2"
              align="center"
              sx={{ py: 4, color: 'text.secondary', borderTop: '1px solid', borderColor: 'divider' }}
            >
              {emptyMessage}
            </Typography>
          )}
        </Box>
      ) : (
      <TableContainer>
        <Table size={dense ? 'small' : 'medium'}>
          <TableHead>
            <TableRow>
              {columns.map((column) => (
                <TableCell
                  key={column.id}
                  align={column.align}
                  sx={column.width ? { width: column.width } : undefined}
                  sortDirection={orderBy === column.id ? order : false}
                >
                  {column.sortable === false ? (
                    column.label
                  ) : (
                    <TableSortLabel
                      active={orderBy === column.id}
                      direction={orderBy === column.id ? order : 'asc'}
                      onClick={() => handleSort(column.id)}
                    >
                      {column.label}
                    </TableSortLabel>
                  )}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {visibleRows.map((row) => (
              <TableRow key={getRowKey(row)} hover>
                {columns.map((column) => (
                  <TableCell
                    key={column.id}
                    align={column.align}
                    sx={
                      // Row actions recede until the row is the current one
                      // (pointer or keyboard) — the data reads first, the
                      // verbs appear when reachable. Opacity only: buttons
                      // stay in the DOM, focusable and clickable throughout.
                      column.id === 'actions'
                        ? {
                            opacity: 0.4,
                            transition: 'opacity 0.15s ease-out',
                            'tr:hover > &, tr:focus-within > &': { opacity: 1 },
                          }
                        : undefined
                    }
                  >
                    {column.render ? column.render(row) : rawValue(column, row)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
            {sortedRows.length === 0 && (
              <TableRow>
                <TableCell colSpan={columns.length} align="center" sx={{ py: 4, color: 'text.secondary' }}>
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </TableContainer>
      )}

      {sortedRows.length > rowsPerPageOptions[0] && (
        <TablePagination
          component="div"
          count={sortedRows.length}
          page={safePage}
          onPageChange={(e, newPage) => setPage(newPage)}
          rowsPerPage={rowsPerPage}
          rowsPerPageOptions={rowsPerPageOptions}
          onRowsPerPageChange={(e) => {
            setRowsPerPage(parseInt(e.target.value, 10));
            setPage(0);
          }}
        />
      )}
    </Paper>
  );
}
