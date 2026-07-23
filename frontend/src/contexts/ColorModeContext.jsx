/**
 * Colour mode (light/dark) for the whole app.
 *
 * The choice persists in localStorage; first visits follow the OS preference
 * (prefers-color-scheme). The provider owns the MUI ThemeProvider, so
 * toggling rebuilds the theme through buildTheme — every token stays
 * mode-aware with zero per-screen changes.
 *
 * useColorMode() outside the provider returns a light-mode no-op, so
 * components with the toggle (AppLayout) still render under test harnesses
 * that wrap their own ThemeProvider.
 */
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import { buildTheme } from '../theme';

const STORAGE_KEY = 'hex_color_mode';

const ColorModeContext = createContext({ mode: 'light', toggleMode: () => {} });

export function useColorMode() {
  return useContext(ColorModeContext);
}

function initialMode() {
  const stored = localStorage.getItem(STORAGE_KEY);
  if (stored === 'light' || stored === 'dark') return stored;
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

export function ColorModeProvider({ children }) {
  // Lazy init reads storage/OS preference once — no effect, no flash.
  const [mode, setMode] = useState(initialMode);

  // The CSS custom properties in index.css are scoped by [data-theme] on the
  // root element, so the non-MUI styling layer flips together with the theme.
  useEffect(() => {
    document.documentElement.dataset.theme = mode;
  }, [mode]);

  const value = useMemo(
    () => ({
      mode,
      toggleMode: () =>
        setMode((previous) => {
          const next = previous === 'dark' ? 'light' : 'dark';
          localStorage.setItem(STORAGE_KEY, next);
          return next;
        }),
    }),
    [mode]
  );

  const theme = useMemo(() => buildTheme(mode), [mode]);

  return (
    <ColorModeContext.Provider value={value}>
      <ThemeProvider theme={theme}>
        {/* Normalises browser defaults and applies the theme background. */}
        <CssBaseline />
        {children}
      </ThemeProvider>
    </ColorModeContext.Provider>
  );
}
