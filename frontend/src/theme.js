/**
 * MUI theme for the ACME Project Management Platform.
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
import { createTheme } from '@mui/material/styles';

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

const theme = createTheme({
  // §9 Spacing — 8px grid. theme.spacing(1) === 8px, so sx={{ p: 2 }} is 16px.
  spacing: 8,

  palette: {
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
  },

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
            outline: '2px solid #194391',
            outlineOffset: 2,
          },
        },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
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
        head: { fontWeight: 600, backgroundColor: '#f1f5f9' },
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
    },
  },
});

export default theme;
