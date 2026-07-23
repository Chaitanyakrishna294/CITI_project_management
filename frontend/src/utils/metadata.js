/**
 * Helpers for the free-form `metadata` JSONB carried by individuals and teams.
 * Dialogs edit metadata as an ordered list of {key, value} rows (see
 * components/MetadataEditor.jsx); these convert at the dialog boundary.
 */

export function toPairs(metadata) {
  return Object.entries(metadata || {}).map(([key, value]) => ({ key, value: String(value) }));
}

/** Rows with an empty key are dropped on save rather than rejected. */
export function fromPairs(pairs) {
  const metadata = {};
  for (const { key, value } of pairs) {
    const trimmed = key.trim();
    if (trimmed) metadata[trimmed] = value;
  }
  return metadata;
}

/** '2026-07-01' -> 'July 2026' (achievements are stored on the first of the month). */
export function formatMonth(isoDate) {
  const [year, month] = String(isoDate).split('-').map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}
