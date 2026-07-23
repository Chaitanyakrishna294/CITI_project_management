import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
// Inter, served from our own origin rather than a third-party CDN. Vite
// fingerprints the woff2 files into the bundle, so there is no external
// request at runtime. The weight axis alone covers 400-700 in one file, and
// each subset carries a unicode-range so a browser fetches only what the page
// actually needs (~48KB for latin).
import '@fontsource-variable/inter/wght.css'
// Fraunces — the display serif for page-level headings only (self-hosted,
// same zero-CDN policy as Inter).
import '@fontsource-variable/fraunces/index.css'
import './index.css'
import { ColorModeProvider } from './contexts/ColorModeContext.jsx'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {/* Owns the light/dark choice and the MUI ThemeProvider + CssBaseline. */}
    <ColorModeProvider>
      <App />
    </ColorModeProvider>
  </StrictMode>,
)
