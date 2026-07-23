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
        mb: 2,
      }}
    >
      <Box>
        {/* Page titles are the ONE place the display serif appears (glow-up
            brief v2 §2) — body, data and buttons stay Inter. */}
        <Typography
          variant="h4"
          component="h1"
          sx={{ fontFamily: DISPLAY_FONT, fontWeight: 600, letterSpacing: '-0.01em' }}
        >
          {title}
        </Typography>
        {summary && (
          <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
            {summary}
          </Typography>
        )}
      </Box>
      {action}
    </Box>
  );
}
