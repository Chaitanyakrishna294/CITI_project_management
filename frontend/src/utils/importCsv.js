/**
 * Spreadsheet-import mapping for Projects.
 *
 * Mirrors data/import_projects.py exactly: headers matching a projects column
 * (after trim/lowercase/spaces->_ plus ALIASES) map onto the record; every
 * other column lands in `metadata` keyed by its original trimmed header; empty
 * cells become null and never enter metadata. Keep the two in sync — the
 * script is the reference for the semantics.
 */

// Columns the projects table accepts on import.
export const KNOWN_COLUMNS = [
  'name',
  'description',
  'status',
  'manager_id',
  'department',
  'start_date',
  'end_date',
];

export const ALIASES = {
  project_name: 'name',
  project: 'name',
  title: 'name',
  desc: 'description',
  dept: 'department',
  start: 'start_date',
  end: 'end_date',
  manager: 'manager_id',
};

export const VALID_STATUSES = ['active', 'completed', 'delayed', 'archived'];

function normalizeHeader(header) {
  const key = String(header).trim().toLowerCase().replaceAll(' ', '_');
  return ALIASES[key] ?? key;
}

/** Empty cells -> null so they skip metadata and let the backend default known columns. */
function clean(value) {
  return value == null || String(value).trim() === '' ? null : value;
}

/**
 * Parse CSV text into { headers, rows }. RFC 4180 quoting (embedded commas,
 * newlines, doubled quotes), CRLF or LF line endings, a leading UTF-8 BOM
 * (Excel adds one), and fully-empty lines skipped. Hand-rolled because the
 * grammar is small and a dependency would be heavier than the parser.
 */
export function parseCsv(text) {
  let src = String(text);
  if (src.charCodeAt(0) === 0xfeff) src = src.slice(1);
  const rows = [];
  let row = [];
  let field = '';
  let inQuotes = false;
  for (let i = 0; i < src.length; i++) {
    const ch = src[i];
    if (inQuotes) {
      if (ch === '"') {
        // A doubled quote is an escaped quote; a lone one closes the field.
        if (src[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      row.push(field);
      field = '';
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && src[i + 1] === '\n') i++;
      row.push(field);
      field = '';
      rows.push(row);
      row = [];
    } else {
      field += ch;
    }
  }
  if (field !== '' || row.length) {
    row.push(field);
    rows.push(row);
  }
  // Blank lines (including the trailing newline most editors add) carry no data.
  const kept = rows.filter((r) => r.some((cell) => cell !== ''));
  return { headers: kept[0] ?? [], rows: kept.slice(1) };
}

/**
 * Map one sheet row to { record, metadata } — the JS twin of the script's
 * map_row. Known columns absent from the file stay null.
 */
export function mapImportRow(headers, row, { defaultManagerId = null } = {}) {
  const record = Object.fromEntries(KNOWN_COLUMNS.map((column) => [column, null]));
  const metadata = {};
  const length = Math.min(headers.length, row.length);
  for (let i = 0; i < length; i++) {
    const header = headers[i];
    if (header == null || String(header).trim() === '') continue;
    const value = clean(row[i]);
    const key = normalizeHeader(header);
    if (KNOWN_COLUMNS.includes(key)) {
      record[key] = value;
    } else if (value !== null) {
      metadata[String(header).trim()] = value;
    }
  }

  if (record.status !== null) {
    const status = String(record.status).trim().toLowerCase();
    if (VALID_STATUSES.includes(status)) {
      record.status = status;
    } else {
      // Unknown status: preserve the original in metadata, default the column.
      metadata.original_status = record.status;
      record.status = null;
    }
  }

  // Postgres NUMERIC-style strings arrive as text; whole numbers parse, anything
  // else (e.g. a manager *name*) is kept in metadata and the fallback applies.
  const manager = record.manager_id === null ? NaN : Number(record.manager_id);
  if (Number.isInteger(manager)) {
    record.manager_id = manager;
  } else {
    if (record.manager_id !== null) metadata.original_manager = record.manager_id;
    record.manager_id = defaultManagerId;
  }
  return { record, metadata };
}
