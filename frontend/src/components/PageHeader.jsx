/**
 * List-screen header with page identity (glow-up brief §4.5).
 *
 * Every list screen used to open with an identical h4-plus-button row; the
 * `summary` line ("24 projects · 6 active · 3 at risk") makes each screen
 * recognizable at a glance and carries its live counts. Pass summary only
 * once data is loaded — the header renders without it while loading.
 */
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';
import { DISPLAY_FONT } from '../theme';

export default function PageHeader({ title, summary, action }) {
  return (
    <Box
      sx={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        flexWrap: 'wrap',
        gap: 2,
        mb: 3.5,
      }}
    >
      <Box>
        {/* Page titles are the ONE place the display serif appears —
            body, data and buttons stay Inter. */}
        <Typography
          variant="h4"
          component="h1"
          sx={{
            fontFamily: DISPLAY_FONT,
            fontWeight: 600,
            fontSize: 32,
            letterSpacing: '-0.015em',
            lineHeight: 1.2,
          }}
        >
          {title}
        </Typography>
        {/* The thread dash: HEX's signature mark — a short viridian stroke
            under the title instead of a full-width rule. Decorative only;
            the title itself carries the semantics. */}
        <Box
          aria-hidden
          sx={{
            width: 36,
            height: 3,
            borderRadius: 2,
            bgcolor: 'var(--color-thread)',
            mt: 1.25,
          }}
        />
        {summary && (
          <Typography
            variant="body2"
            color="text.secondary"
            // Counts line up digit-for-digit as data loads and changes.
            sx={{ mt: 1.25, fontVariantNumeric: 'tabular-nums' }}
          >
            {summary}
          </Typography>
        )}
      </Box>
      {action}
    </Box>
  );
}
