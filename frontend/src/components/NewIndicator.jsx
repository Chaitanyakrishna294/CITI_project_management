/**
 * "New" beacon: a small pulsing info-blue dot beside records created in the
 * last 24 hours, so fresh rows (hand-created or imported) are findable in a
 * long table without a filter. Recency-based, not session-based — it
 * survives reloads and also flags teammates' additions.
 *
 * The dot never carries the meaning alone (req/UI_UX §14): a visually
 * hidden "New" travels with it for assistive tech, and a tooltip explains
 * it on hover. The pulse collapses under prefers-reduced-motion via the
 * global animation kill-switch in index.css; the static dot remains.
 */
import Box from '@mui/material/Box';
import Tooltip from '@mui/material/Tooltip';
import { isNew } from '../utils/recency';

export default function NewIndicator({ createdAt }) {
  if (!isNew(createdAt)) return null;
  return (
    <Tooltip title="Added in the last 24 hours">
      <Box
        component="span"
        sx={{
          display: 'inline-block',
          width: 8,
          height: 8,
          ml: 0.75,
          borderRadius: '50%', // round bulb — deliberately not the square status dot
          bgcolor: 'info.main',
          verticalAlign: 'middle',
          flexShrink: 0,
          '@keyframes newGlow': {
            '0%': { boxShadow: '0 0 0 0 rgba(56, 189, 248, 0.55)' },
            '70%': { boxShadow: '0 0 0 6px rgba(56, 189, 248, 0)' },
            '100%': { boxShadow: '0 0 0 0 rgba(56, 189, 248, 0)' },
          },
          animation: 'newGlow 2s ease-out infinite',
        }}
      >
        <Box component="span" sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)' }}>
          New
        </Box>
      </Box>
    </Tooltip>
  );
}
