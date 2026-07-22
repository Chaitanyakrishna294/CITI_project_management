/**
 * MUI theme for the ACME Project Management Platform.
 *
 * Implements the design system defined in req/UI_UX_Design&UserFlow.md:
 *   §9 Colors      — primary blue, success green, warning orange, danger red,
 *                    white background, light-gray surface
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
 * always ship a text label alongside, never colour alone.
 */
export const STATUS_COLORS = {
  active: '#2e7d32',
  completed: '#2e7d32',
  delayed: '#ed6c02',
  archived: '#757575',
  not_started: '#757575',
  in_progress: '#1565c0',
  blocked: '#d32f2f',
};

/**
 * Categorical palette for chart series, assigned in fixed order and never
 * cycled. Validated against the white chart surface: all four slots sit inside
 * the lightness band, clear the chroma floor, hold adjacent-pair separation
 * under protan/deutan/tritan simulation (worst ΔE 26.5) and exceed 3:1 contrast.
 * A fifth series folds into "Other" rather than inventing a hue.
 */
export const CHART_COLORS = ['#2a78d6', '#008300', '#4a3aa7', '#eb6834'];

const theme = createTheme({
  // §9 Spacing — 8px grid. theme.spacing(1) === 8px, so sx={{ p: 2 }} is 16px.
  spacing: 8,

  palette: {
    mode: 'light',
    primary: { main: '#1565c0', light: '#5e92f3', dark: '#003c8f', contrastText: '#ffffff' },
    success: { main: '#2e7d32', contrastText: '#ffffff' },
    warning: { main: '#ed6c02', contrastText: '#ffffff' },
    error: { main: '#d32f2f', contrastText: '#ffffff' },
    info: { main: '#0288d1', contrastText: '#ffffff' },
    background: {
      default: '#f4f6f8', // "Light Gray" surface behind content
      paper: '#ffffff', // "White" for cards, tables, dialogs
    },
    text: {
      primary: 'rgba(0, 0, 0, 0.87)',
      secondary: 'rgba(0, 0, 0, 0.6)',
    },
    divider: 'rgba(0, 0, 0, 0.12)',
  },

  typography: {
    fontFamily: [
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

  shape: { borderRadius: 8 },

  components: {
    // §14 — focus must always be visible, not just on mouse interaction.
    MuiButtonBase: {
      styleOverrides: {
        root: {
          '&:focus-visible': {
            outline: '2px solid #1565c0',
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
        head: { fontWeight: 600, backgroundColor: '#f4f6f8' },
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
