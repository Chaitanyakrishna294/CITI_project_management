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
 *     render:      (row) => <Link…/>,            // cell content (default: row[id])
 *     sortValue:   (row) => row.name.toLowerCase(),  // default: row[id]
 *     exportValue: (row) => row.name,            // default: row[id]
 *     align:       'right',
 *     sortable:    false,                        // default: true
 *   }
 */
import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
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
import DownloadIcon from '@mui/icons-material/Download';
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
  const [orderBy, setOrderBy] = useState(defaultOrderBy || columns[0]?.id);
  const [order, setOrder] = useState(defaultOrder);
  const [page, setPage] = useState(0);
  const [rowsPerPage, setRowsPerPage] = useState(initialRowsPerPage);

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
                  <TableCell key={column.id} align={column.align}>
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
