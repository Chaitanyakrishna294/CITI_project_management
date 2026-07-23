/**
 * Purpose-built empty-state illustrations (glow-up brief §4.6).
 *
 * Three line drawings, reused across related screens instead of one generic
 * inbox icon everywhere. They share the icon set's language: 1.75 stroke,
 * round caps, currentColor. The dashed strokes are the "missing thing" the
 * empty state invites the user to create.
 *
 *   EmptyWorkIllustration   — projects, deliverables, resources, budgets
 *   EmptyPeopleIllustration — teams, individuals, users
 *   EmptyDataIllustration   — insights, reports, search results
 */

const STROKE = {
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  fill: 'none',
};

const DASHED = { ...STROKE, strokeDasharray: '3.5 4', opacity: 0.55 };

export function EmptyWorkIllustration({ size = 64, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden {...props}>
      {/* Folder, open and waiting */}
      <path d="M8 20a4 4 0 0 1 4-4h11l5 6h24a4 4 0 0 1 4 4v22a4 4 0 0 1-4 4H12a4 4 0 0 1-4-4V20z" {...STROKE} />
      {/* The documents that aren't there yet */}
      <path d="M22 36h20" {...DASHED} />
      <path d="M22 42h13" {...DASHED} />
    </svg>
  );
}

export function EmptyPeopleIllustration({ size = 64, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden {...props}>
      {/* One person present… */}
      <circle cx="25" cy="22" r="7" {...STROKE} />
      <path d="M11 50c0-8 6.3-14 14-14s14 6 14 14" {...STROKE} />
      {/* …the next seat open */}
      <circle cx="46" cy="25" r="5.5" {...DASHED} />
      <path d="M40 48c1.2-5.5 5.4-9 10.5-9 2.6 0 5 .9 6.9 2.5" {...DASHED} />
    </svg>
  );
}

export function EmptyDataIllustration({ size = 64, ...props }) {
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" aria-hidden {...props}>
      {/* Axes ready for data */}
      <path d="M12 10v42h42" {...STROKE} />
      {/* Bars yet to be earned */}
      <path d="M22 52V38h7v14" {...DASHED} />
      <path d="M35 52V28h7v24" {...DASHED} />
      <path d="M48 52V20" {...DASHED} />
    </svg>
  );
}
