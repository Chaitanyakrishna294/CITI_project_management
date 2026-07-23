/**
 * Status indicator: a small rounded-square dot + text label (glow-up brief v2
 * §2). Status *meaning* renders as dot+label; filled pills stay reserved for
 * counts/badges — so the two kinds of information are distinguishable at a
 * glance. The label is always present (status is never colour alone, req
 * UI_UX §14), and the dot is aria-hidden because the text carries the meaning.
 *
 *   const statusColors = useStatusColors(); // mode-aware — never the static map
 *   <StatusIndicator color={statusColors.active} label="Active" />
 *   <StatusIndicator color="warning.main" label="Not co-located" />
 */
import Box from '@mui/material/Box';
import Typography from '@mui/material/Typography';

export default function StatusIndicator({ color, label, sx }) {
  return (
    <Box
      component="span"
      sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.75, ...sx }}
    >
      <Box
        component="span"
        aria-hidden
        sx={{
          width: 9,
          height: 9,
          borderRadius: '2px', // rounded square — deliberately not a circle pill
          flexShrink: 0,
          bgcolor: color,
        }}
      />
      <Typography component="span" variant="body2">
        {label}
      </Typography>
    </Box>
  );
}
