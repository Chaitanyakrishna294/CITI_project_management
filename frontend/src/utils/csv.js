/**
 * CSV export helpers.
 *
 * req/UI_UX_Design&UserFlow.md §12 requires export from every table, and
 * req/PRD.md §11 lists Export on the Projects screen. Kept out of the table
 * component so reports and one-off exports can reuse the same escaping.
 */

/** RFC 4180 escaping: wrap in quotes and double any embedded quote. */
export function csvCell(value) {
  const text = value == null ? '' : String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/**
 * Value a column contributes to the CSV. Deliberately falls back to the
 * underlying field rather than to `sortValue` — a sort key is often a
 * normalised form (lowercased text, a parsed number) that would be wrong in the
 * export. Computed columns with no backing field supply `exportValue`.
 */
function exportedValue(column, row) {
  return column.exportValue ? column.exportValue(row) : row[column.id];
}

/**
 * Serialise rows to CSV using the same column definitions the table renders
 * from. Columns marked `exportable: false` (action buttons and the like) are
 * skipped.
 */
export function toCsv(columns, rows) {
  const exportable = columns.filter((c) => c.exportable !== false);
  const header = exportable.map((c) => csvCell(c.label)).join(',');
  const body = rows.map((row) => exportable.map((c) => csvCell(exportedValue(c, row))).join(','));
  return [header, ...body].join('\n');
}

/** Triggers a client-side download. No-ops where the browser APIs are absent. */
export function downloadCsv(filename, csv) {
  if (typeof document === 'undefined' || typeof URL.createObjectURL !== 'function') return;
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
