/**
 * MUI theme for the CITI Project Management Platform.
 *
 * Visual language: "Harbor Blue" (21st.dev community theme by serafimcloud,
 * https://21st.dev/community/themes/harbor-blue) translated into MUI tokens —
 * deep navy primary on slate neutrals, hairline borders, Inter.
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
 * always ship a text label alongside, never colour alone. Hues are tuned to the
 * Harbor Blue neutrals and hold ≥4.5:1 with white text (status chips render
 * white-on-colour in Budgets/Reports).
 */
export const STATUS_COLORS = {
  active: '#15803d',
  completed: '#15803d',
  delayed: '#b45309',
  archived: '#64748b',
  not_started: '#64748b',
  in_progress: '#194391',
  blocked: '#b91c1c',
};

/**
 * Categorical palette for chart series, assigned in fixed order and never
 * cycled. Slot 0 is the Harbor Blue navy stepped into the legible lightness
 * band; the remaining slots separate by hue rather than by tint.
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
 * Dark-surface counterparts (glow-up brief v2 §3.1). Validated 2026-07 against
 * the dark paper tone #131c2e: every mark ≥3:1 (in_progress 5.6:1, blocked
 * 6.2:1, chart slots 5.6/3.4/3.3/6.3:1). Slots 0 and 3 sit near each other in
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
 * Light palette — the original Harbor Blue tokens (see per-token notes below).
 */
const LIGHT_PALETTE = {
  mode: 'light',
  // Harbor Blue primary #194391 (9.6:1 on white); light/dark from its ramp.
  primary: { main: '#194391', light: '#4169e1', dark: '#122f66', contrastText: '#ffffff' },
  // Slate secondary for neutral emphasis, matching the Harbor neutrals.
  secondary: { main: '#475569', contrastText: '#ffffff' },
  success: { main: '#15803d', contrastText: '#ffffff' },
  warning: { main: '#b45309', contrastText: '#ffffff' },
  // Harbor destructive is #ef4444; main sits one step darker so error text
  // on white clears AA, with the original kept as `light`.
  error: { main: '#dc2626', light: '#ef4444', dark: '#b91c1c', contrastText: '#ffffff' },
  info: { main: '#0369a1', contrastText: '#ffffff' },
  background: {
    default: '#f1f5f9', // Harbor "muted" — the canvas behind content
    paper: '#ffffff', // White for cards, tables, dialogs
  },
  text: {
    primary: '#0f172a', // Harbor foreground (slate-900)
    // Harbor muted-foreground is slate-500 (#64748b), but that lands at
    // 4.34:1 on the canvas below — under the 4.5:1 AA floor req/UI_UX §14
    // requires, and muted text lands on the canvas often (page subtitles,
    // the search placeholder). Stepped one down the same slate ramp: 6.92:1
    // on the canvas, 7.58:1 on white.
    secondary: '#475569', // slate-600
  },
  divider: '#e2e8f0', // Harbor border (slate-200)
};

/**
 * Dark palette — the same Harbor slate ramp, inverted. The navy primary is
 * stepped up to a light-blue band so text and outlines clear AA on the dark
 * canvas (#7da2e8 on #0f172a ≈ 7.5:1); contained buttons therefore flip to
 * dark text. Semantic mains keep their light-mode hues — they are used as
 * filled chip backgrounds with white text, which still reads on dark — while
 * STATUS_COLORS / CHART_COLORS stay shared across modes (their marks always
 * carry direct labels and a table fallback; see the notes above).
 */
const DARK_PALETTE = {
  mode: 'dark',
  // Mirrors the [data-theme="dark"] custom properties in index.css (glow-up
  // brief v2 §3.1) — lightened hues for AA on the dark canvas, with dark
  // contrast text wherever a light hue becomes a fill.
  primary: { main: '#6d93e0', light: '#8fabf0', dark: '#4169e1', contrastText: '#0b1220' },
  secondary: { main: '#94a3b8', contrastText: '#0b1220' },
  success: { main: '#4ade80', contrastText: '#052e16' },
  warning: { main: '#fbbf24', contrastText: '#451a03' },
  error: { main: '#f87171', light: '#fca5a5', dark: '#ef4444', contrastText: '#450a0a' },
  info: { main: '#38bdf8', contrastText: '#082f49' },
  background: {
    default: '#0b1220', // near-black navy canvas
    paper: '#131c2e', // panel surface — "elevation" is this step, not shadow
  },
  text: {
    primary: '#e2e8f0',
    secondary: '#94a3b8', // 5.9:1 on the paper tone
  },
  divider: '#1e293b',
};

/**
 * Display face for page-level headings ONLY (brief v2 §2): Fraunces, the
 * high-contrast serif, self-hosted via @fontsource-variable/fraunces. Applied
 * through PageHeader and the two dashboard titles — never body, never buttons.
 */
export const DISPLAY_FONT = "'Fraunces Variable', Georgia, 'Times New Roman', serif";

/**
 * The single accent beyond navy (brief v2 §2): warm ochre in light, amber in
 * dark. Reserved for "needs acting on" — the attention panel border, at-risk
 * chart line, table-header underline. Never a background wash.
 */
export const ACCENT = { light: '#b45309', dark: '#fbbf24' };

/**
 * Build the theme for one colour mode. The default export stays the light
 * theme so existing imports (and the test harness) keep working; the app
 * shell builds light/dark through this factory (see contexts/ColorModeContext).
 */
export function buildTheme(mode = 'light') {
  const palette = mode === 'dark' ? DARK_PALETTE : LIGHT_PALETTE;
  return createTheme({
  // §9 Spacing — 8px grid. theme.spacing(1) === 8px, so sx={{ p: 2 }} is 16px.
  spacing: 8,

  palette,

  typography: {
    // Harbor Blue ships Inter. Self-hosted via @fontsource-variable/inter,
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

  // Harbor Blue radius: 0.5rem.
  shape: { borderRadius: 8 },

  components: {
    // §14 — focus must always be visible, not just on mouse interaction.
    MuiButtonBase: {
      styleOverrides: {
        root: {
          '&:focus-visible': {
            // Focus ring follows the mode's primary so it stays visible on
            // both canvases.
            outline: `2px solid ${palette.primary.main}`,
            outlineOffset: 2,
          },
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        // Row-action text buttons (Edit / Archive / Delete) appear once per
        // table row; at the full 600 button weight a column of them competes
        // with the data. Text variant steps to 500 — filled/outlined CTAs
        // keep the documented 600.
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
        head: {
          fontWeight: 600,
          backgroundColor: 'transparent',
          borderBottom: `2px solid ${palette.primary.main}`,
        },
        // Numeric columns read in columns: right-aligned cells get tabular
        // figures so digits line up vertically.
        alignRight: { fontVariantNumeric: 'tabular-nums' },
      },
    },
    MuiTableRow: {
      styleOverrides: {
        // Row hover is a 3px left-edge primary bar, not a full-row tint —
        // the pointer's row is marked without repainting the data.
        root: {
          '&.MuiTableRow-hover:hover': {
            backgroundColor: 'transparent',
            boxShadow: `inset 3px 0 0 ${palette.primary.main}`,
          },
          transition: 'box-shadow 0.15s ease-out',
        },
      },
    },
    MuiChip: {
      defaultProps: { size: 'small' },
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
