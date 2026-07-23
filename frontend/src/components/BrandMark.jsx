/**
 * The cropped X — HEX's identity mark. A fragment of the wordmark set in
 * negative space: always partially cut by an edge, always tone-on-tone,
 * never interactive and never announced (pure decoration, aria-hidden).
 *
 * One component so every placement crops and weighs the same way:
 *
 *   <BrandMark size={580} opacity={0.11} glyphSx={{ right: -110, bottom: -170 }} />
 *   <BrandMark fixed size={480} opacity={0.04} color="text.primary"
 *              glyphSx={{ right: -90, bottom: -140 }} />
 *
 * The wrapper clips the overhang (inset 0, overflow hidden) so the glyph can
 * never add scroll; `fixed` pins it to the viewport at zIndex -1 — above the
 * canvas colour, below every surface — for the app-wide watermark.
 */
import Box from '@mui/material/Box';
import { DISPLAY_FONT } from '../theme';

export default function BrandMark({
  size = 240,
  opacity = 0.05,
  color = 'var(--color-sidebar-active-bg)',
  fixed = false,
  // Emboss mode: a hairline divider-toned edge around the glyph so a
  // paper-white mark stays perceptible against the near-white canvas.
  outlined = false,
  glyphSx = { right: -size * 0.2, bottom: -size * 0.3 },
}) {
  return (
    <Box
      aria-hidden
      sx={{
        position: fixed ? 'fixed' : 'absolute',
        inset: 0,
        overflow: 'hidden',
        pointerEvents: 'none',
        ...(fixed && { zIndex: -1 }),
      }}
    >
      <Box
        sx={{
          position: 'absolute',
          fontFamily: DISPLAY_FONT,
          fontWeight: 600,
          fontSize: size,
          lineHeight: 1,
          color,
          opacity,
          userSelect: 'none',
          ...(outlined && { WebkitTextStroke: '1px var(--color-divider)' }),
          ...glyphSx,
        }}
      >
        X
      </Box>
    </Box>
  );
}
