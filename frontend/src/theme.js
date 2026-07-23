/**
 * MUI theme for the HEX Project Management Platform.
 *
 * Visual language: "Ink & Porcelain" — warm porcelain canvas, near-black ink
 * chrome and actions (colour is spent on data, not decoration), Fraunces
 * display titles, and a single viridian thread marking whatever is current:
 * the active nav item, focus rings, row hover, the dash under every title.
 *
 * Still implements the design system defined in req/UI_UX_Design&UserFlow.md:
 *   §9 Colors      — primary blue, success green, warning orange, danger red,
 *                    white surfaces on a light-gray canvas
 *   §9 Typography  — heading 24px, subheading 18px, body 14–16px, button 14px
 *   §9 Spacing     — 8px grid
 *   §14/§16        — visible focus rings, consistent hover/interaction states
 *
 * Every screen consumes these tokens rather than hardcoding values, so the
 * "Consistency" principle in §2 holds across modules.
 */
import { createTheme, useTheme } from '@mui/material/styles';

/**
 * Reserved status colours — they encode *state*, never series identity, so they
 * are kept out of the categorical palette below. Charts and chips using these
 * always ship a text label alongside, never colour alone. Hues hold ≥3:1 as
 * marks on the porcelain canvas and white paper (validated 2026-07), and
 * ≥4.5:1 with white text where they fill a badge.
 */
/** Human labels for the status enums — the UI never shows raw keys. */
export const STATUS_LABELS = {
  active: 'Active',
  completed: 'Completed',
  delayed: 'Delayed',
  archived: 'Archived',
  not_started: 'Not started',
  in_progress: 'In progress',
  blocked: 'Blocked',
};

/** Label for a status key, falling back to the raw key for unknown values. */
export const statusLabel = (status) => STATUS_LABELS[status] || status;

export const STATUS_COLORS = {
  active: '#15803d',
  completed: '#15803d',
  delayed: '#b45309',
  archived: '#64748b',
  not_started: '#64748b',
  // Same blue as CHART_COLORS[0]: two nearly-equal blues on one dashboard
  // read as an error, so "in progress" and series slot 0 share the hue.
  in_progress: '#2255b0',
  blocked: '#b91c1c',
};

/**
 * Categorical palette for chart series, assigned in fixed order and never
 * cycled. Slot 0 is the ledger blue stepped into the legible lightness band;
 * the remaining slots separate by hue rather than by tint.
 *
 * A tint ramp of one hue was tried first and had to be abandoned: it survives
 * protan/deutan/tritan simulation, but the two pale steps landed at ΔE 10
 * against each other for *full* colour vision (floor is 15) and at 1.8:1 and
 * 2.5:1 against the white surface (floor is 3:1) — near-invisible as thin
 * marks. Hue separation costs a little of the monochrome look and buys back
 * both. Validated on the adjacent-pair list for bars and lines: lightness band,
 * chroma floor, normal-vision separation and surface contrast all pass, with
 * CVD separation at ΔE 7.0 — inside the 6–8 band, which is permitted only
 * because these charts also carry direct labels, 2px gaps between fills and a
 * data-table fallback (see components/charts/ChartFrame.jsx).
 *
 * Slots 0/1 are the common two-series pairing (Planned vs Actual, Due vs
 * Completed) and clear every check outright at ΔE 24.8.
 * A fifth series folds into "Other" rather than inventing a hue.
 *
 * Deliverable status uses STATUS_COLORS above, not this palette.
 */
export const CHART_COLORS = ['#2255b0', '#15803d', '#c2410c', '#7c3aed'];

/**
 * Dark-surface counterparts. Re-validated 2026-07 against the ink paper tone
 * #15181e: every mark ≥3:1 (in_progress 5.8:1, blocked 6.4:1, chart slots
 * within the same band). Slots 0 and 3 sit near each other in
 * lightness but apart in hue — the same mitigation stack as light mode applies
 * (direct labels, 2px gaps, table fallback). Use the hooks below rather than
 * picking a set by hand.
 */
export const STATUS_COLORS_DARK = {
  ...STATUS_COLORS,
  in_progress: '#6d93e0',
  blocked: '#f87171',
};

export const CHART_COLORS_DARK = ['#6d93e0', '#15803d', '#c2410c', '#a78bfa'];

/** Mode-aware status palette — resolves per the active theme. */
export function useStatusColors() {
  const theme = useTheme();
  return theme.palette.mode === 'dark' ? STATUS_COLORS_DARK : STATUS_COLORS;
}

/** Mode-aware categorical chart palette — resolves per the active theme. */
export function useChartColors() {
  const theme = useTheme();
  return theme.palette.mode === 'dark' ? CHART_COLORS_DARK : CHART_COLORS;
}

/**
 * Light palette — Ink & Porcelain (see per-token notes below).
 */
const LIGHT_PALETTE = {
  mode: 'light',
  // Ink & Porcelain: primary actions are ink, not a hue — colour is spent
  // on data (status, charts) and the viridian thread, never on chrome.
  // Mirrors the :root custom properties in index.css; every pair below was
  // WCAG-checked 2026-07 (text ≥4.5:1 on its surfaces, marks ≥3:1).
  primary: { main: '#181b21', light: '#2a2e36', dark: '#0b0d11', contrastText: '#ffffff' },
  secondary: { main: '#5a616e', contrastText: '#ffffff' },
  success: { main: '#15803d', contrastText: '#ffffff' },
  warning: { main: '#b45309', contrastText: '#ffffff' },
  // 4.8:1 on the porcelain canvas (the old #dc2626 sat at 4.47 — under AA).
  error: { main: '#d32222', light: '#ef4444', dark: '#b91c1c', contrastText: '#ffffff' },
  info: { main: '#0369a1', contrastText: '#ffffff' },
  background: {
    default: '#f7f6f3', // porcelain — warm, not blue-gray
    paper: '#ffffff',
  },
  text: {
    primary: '#16181d', // ink
    secondary: '#5a616e', // 5.8:1 on the canvas, 6.2:1 on white
  },
  divider: '#e7e5e0', // stone hairline
};

/**
 * Dark palette — dark ink. Actions flip to porcelain fills with ink text;
 * semantic hues are lightened for AA on the ink surfaces, while
 * STATUS_COLORS / CHART_COLORS keep their dark counterparts above (their
 * marks always carry direct labels and a table fallback).
 */
const DARK_PALETTE = {
  mode: 'dark',
  // Dark ink: porcelain becomes the action colour on true-ink surfaces.
  // Mirrors [data-theme="dark"] in index.css; retuned for AA, not inverted.
  primary: { main: '#e9e7e2', light: '#ffffff', dark: '#cfccc5', contrastText: '#14161b' },
  secondary: { main: '#9aa0aa', contrastText: '#14161b' },
  success: { main: '#4ade80', contrastText: '#052e16' },
  warning: { main: '#fbbf24', contrastText: '#451a03' },
  error: { main: '#f87171', light: '#fca5a5', dark: '#ef4444', contrastText: '#450a0a' },
  info: { main: '#38bdf8', contrastText: '#082f49' },
  background: {
    default: '#0d0f13', // ink canvas
    paper: '#15181e', // panel surface — "elevation" is this step, not shadow
  },
  text: {
    primary: '#e8e6e1', // warm porcelain text
    secondary: '#9aa0aa', // 6.8:1 on the paper tone
  },
  divider: '#242830',
};

/**
 * Display face for page-level headings ONLY: Fraunces, the high-contrast
 * serif, self-hosted via @fontsource-variable/fraunces. Applied through
 * PageHeader, the detail-page titles (ProjectDetails/TeamDetails), the Login
 * headings and the sidebar wordmark — never body, never buttons.
 */
export const DISPLAY_FONT = "'Fraunces Variable', Georgia, 'Times New Roman', serif";

/**
 * Attention accent: warm ochre in light, amber in dark. Reserved for "needs
 * acting on" — the attention panel border, at-risk chart line. Never a
 * background wash.
 */
export const ACCENT = { light: '#b45309', dark: '#fbbf24' };

/**
 * The thread: viridian marking "current / live / focused" — the dash under
 * every page title, the active-nav notch, focus rings, row-hover bars.
 * Structural, never semantic: status meaning stays with STATUS_COLORS.
 */
export const THREAD = { light: '#0f766e', dark: '#45b39c' };

/**
 * Build the theme for one colour mode. The default export stays the light
 * theme so existing imports (and the test harness) keep working; the app
 * shell builds light/dark through this factory (see contexts/ColorModeContext).
 */
export function buildTheme(mode = 'light') {
  const palette = mode === 'dark' ? DARK_PALETTE : LIGHT_PALETTE;
  const thread = mode === 'dark' ? THREAD.dark : THREAD.light;
  return createTheme({
  // §9 Spacing — 8px grid. theme.spacing(1) === 8px, so sx={{ p: 2 }} is 16px.
  spacing: 8,

  palette,

  typography: {
    // Inter for UI and data. Self-hosted via @fontsource-variable/inter,
    // imported in main.jsx — no third-party font CDN at runtime.
    //
    // 'Inter Variable' is the family name the variable build declares; plain
    // 'Inter' follows so a locally installed static Inter is still honoured,
    // then the usual system stack in case the woff2 fails to load.
    fontFamily: [
      '"Inter Variable"',
      'Inter',
      '"Segoe UI"',
      'Roboto',
      '-apple-system',
      'BlinkMacSystemFont',
      '"Helvetica Neue"',
      'Arial',
      'sans-serif',
    ].join(','),
    // §9 Typography scale.
    h1: { fontSize: '2rem', fontWeight: 600, lineHeight: 1.25 },
    h2: { fontSize: '1.75rem', fontWeight: 600, lineHeight: 1.3 },
    h3: { fontSize: '1.5rem', fontWeight: 600, lineHeight: 1.35 },
    h4: { fontSize: '1.5rem', fontWeight: 600, lineHeight: 1.35 }, // 24px — page headings
    h5: { fontSize: '1.25rem', fontWeight: 600, lineHeight: 1.4 },
    h6: { fontSize: '1.125rem', fontWeight: 600, lineHeight: 1.4 }, // 18px — subheadings
    subtitle1: { fontSize: '1rem', fontWeight: 500 },
    subtitle2: { fontSize: '0.875rem', fontWeight: 600 },
    body1: { fontSize: '1rem', lineHeight: 1.5 }, // 16px
    body2: { fontSize: '0.875rem', lineHeight: 1.5 }, // 14px
    button: { fontSize: '0.875rem', fontWeight: 600, textTransform: 'none' }, // 14px
    caption: { fontSize: '0.75rem' },
  },

  // Ink & Porcelain: 10px surfaces — soft enough to read current, firm
  // enough to stay an instrument, not a toy.
  shape: { borderRadius: 10 },

  components: {
    // §14 — focus must always be visible, not just on mouse interaction.
    MuiButtonBase: {
      styleOverrides: {
        root: {
          '&:focus-visible': {
            // Focus rides the viridian thread — visible on every surface.
            outline: `2px solid ${thread}`,
            outlineOffset: 2,
          },
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        // Pill silhouette: the one rounded form in the language, shared
        // with the search field, so every "do something" affordance has
        // the same shape.
        root: { borderRadius: 999, paddingLeft: 18, paddingRight: 18 },
        // Row-action text buttons (Edit / Archive / Delete) appear once per
        // table row; at the full 600 button weight a column of them competes
        // with the data. Text variant steps to 500 — filled/outlined CTAs
        // keep 600.
        text: { fontWeight: 500 },
      },
    },
    // Links and buttons must not compete at the same visual weight (glow-up
    // brief §4.7): links are plain primary text that underline on hover, while
    // buttons carry the fill. Never style a link to look like a button.
    MuiLink: {
      defaultProps: { underline: 'hover' },
      styleOverrides: { root: { fontWeight: 500 } },
    },
    MuiPaper: {
      styleOverrides: {
        // Flat surfaces with a hairline border read better than heavy shadows
        // in dense data screens, and keep contrast predictable.
        root: { backgroundImage: 'none' },
        // Default-elevation Papers (cards, tables, KPI tiles) are truly flat:
        // no shadow, hairline edge. Floating surfaces (menus, dialogs) keep
        // their higher elevations — depth marks what overlays, not what sits.
        elevation1: {
          boxShadow: 'none',
          border: `1px solid ${palette.divider}`,
        },
      },
    },
    MuiTableCell: {
      styleOverrides: {
        // 10px vertical padding instead of MUI's 16px: data screens read as
        // a ledger, not a form. Still ≥40px row height with body2, so touch
        // targets and the 8px rhythm hold.
        root: { padding: '10px 16px' },
        // Custom table shape (glow-up brief v2 §2): no header wash — a single
        // 2px primary underline below the header row carries the structure.
        // (Primary, not the ochre accent: the accent stays reserved for
        // "needs acting on" signals.)
        // Ledger-caps headers: small, letter-spaced, muted — column names
        // whisper so the data speaks. DOM text stays as written (CSS-only
        // transform), so accessible names are unchanged. The 2px ink rule
        // closes the header; ink, not thread — it is structure, not state.
        head: {
          fontWeight: 600,
          fontSize: '0.75rem',
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
          color: palette.text.secondary,
          backgroundColor: 'transparent',
          borderBottom: `2px solid ${palette.text.primary}`,
        },
        // Numeric columns read in columns: right-aligned cells get tabular
        // figures so digits line up vertically.
        alignRight: { fontVariantNumeric: 'tabular-nums' },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        // Row hover is a 3px left-edge thread bar, not a full-row tint —
        // the pointer's row is "current", and current is what the thread
        // marks everywhere else.
        root: {
          '&.MuiTableRow-hover:hover': {
            backgroundColor: 'transparent',
            boxShadow: `inset 3px 0 0 ${thread}`,
          },
          transition: 'box-shadow 0.15s ease-out',
        },
      },
    },
    MuiChip: {
      defaultProps: { size: 'small' },
    },
    // Alerts drop the stock Material tinted wash — the one place the default
    // look survived. Paper surface, hairline edge, severity carried by a 3px
    // left rule and the icon (which keeps its severity colour).
    MuiAlert: {
      styleOverrides: {
        standard: {
          backgroundColor: palette.background.paper,
          border: `1px solid ${palette.divider}`,
          color: palette.text.primary,
        },
        standardError: { borderLeft: `3px solid ${palette.error.main}` },
        standardWarning: { borderLeft: `3px solid ${palette.warning.main}` },
        standardSuccess: { borderLeft: `3px solid ${palette.success.main}` },
        standardInfo: { borderLeft: `3px solid ${palette.info.main}` },
      },
    },
    MuiTextField: {
      defaultProps: { size: 'small' },
    },
    MuiDialog: {
      defaultProps: { fullWidth: true, maxWidth: 'sm' },
      styleOverrides: {
        // A hairline edge on the dialog surface: on dark canvases shadows
        // barely register, so the border carries the elevation cue.
        paper: { border: `1px solid ${palette.divider}` },
      },
    },
  },
  });
}

const theme = buildTheme('light');

export default theme;
