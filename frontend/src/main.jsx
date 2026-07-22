import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { ThemeProvider } from '@mui/material/styles'
import CssBaseline from '@mui/material/CssBaseline'
// Inter, served from our own origin rather than a third-party CDN. Vite
// fingerprints the woff2 files into the bundle, so there is no external
// request at runtime. The weight axis alone covers 400-700 in one file, and
// each subset carries a unicode-range so a browser fetches only what the page
// actually needs (~48KB for latin).
import '@fontsource-variable/inter/wght.css'
import './index.css'
import theme from './theme.js'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      {/* Normalises browser defaults and applies the theme background. */}
      <CssBaseline />
      <App />
    </ThemeProvider>
  </StrictMode>,
)
