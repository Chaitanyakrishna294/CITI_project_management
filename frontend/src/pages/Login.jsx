import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import TextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import Alert from '@mui/material/Alert';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import { ShowPasswordIcon, HidePasswordIcon } from '../components/icons';
import { DISPLAY_FONT } from '../theme';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const from = location.state?.from?.pathname || '/dashboard';

  async function handleSubmit(e) {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await login(email, password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err.message || 'Login failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Box sx={{ minHeight: '100vh', display: 'flex', bgcolor: 'background.default' }}>
      {/* Brand panel: the same ink column the app shell uses, so the first
          screen and every screen after it share one silhouette. Hidden on
          small screens, where the card carries the product name instead. */}
      <Box
        sx={{
          display: { xs: 'none', md: 'flex' },
          flexDirection: 'column',
          justifyContent: 'space-between',
          width: '40%',
          maxWidth: 480,
          bgcolor: 'var(--color-sidebar-bg)',
          p: 6,
          // The cropped X: a fragment of the wordmark bleeding off the
          // corner — most of it lives in negative space. Clipped here.
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            right: -110,
            bottom: -170,
            fontFamily: DISPLAY_FONT,
            fontWeight: 600,
            fontSize: 580,
            lineHeight: 1,
            color: 'var(--color-sidebar-active-bg)',
            opacity: 0.11,
            pointerEvents: 'none',
            userSelect: 'none',
          }}
        >
          X
        </Box>
        <Box>
          <Typography
            component="div"
            sx={{
              fontFamily: DISPLAY_FONT,
              fontWeight: 600,
              fontSize: 56,
              lineHeight: 1,
              letterSpacing: '-0.02em',
              color: 'var(--color-sidebar-active-bg)',
            }}
          >
            HEX
          </Typography>
          <Typography
            component="div"
            variant="caption"
            sx={{
              mt: 1,
              color: 'var(--color-sidebar-text)',
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}
          >
            Project Management
          </Typography>
        </Box>
        <Typography variant="body2" sx={{ color: 'var(--color-sidebar-text)', maxWidth: 300 }}>
          Projects, deliverables, resources and budgets — one ledger for the whole portfolio.
        </Typography>
      </Box>

      <Box
        sx={{
          flexGrow: 1,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          p: 2,
        }}
      >
      {/* borderRadius stays the user-set 20px, pinned as a string so the new
          theme shape scale (sx numbers multiply by shape.borderRadius) can't
          drift it. */}
      <Paper elevation={0} sx={{ p: 4, width: 360, border: '1px solid', borderColor: 'divider', borderRadius: '20px' }}>
        {/* The sign-in heading keeps the display-serif identity (glow-up brief
            v2 §2); the product name below also serves small screens, where
            the brand panel is hidden. */}
        <Typography
          variant="h5"
          component="h1"
          gutterBottom
          sx={{ fontFamily: DISPLAY_FONT, fontWeight: 600, letterSpacing: '-0.01em' }}
        >
          Sign in
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          HEX Project Management
        </Typography>

        <Box component="form" onSubmit={handleSubmit} sx={{ mt: 2 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          <TextField
            label="Email"
            type="email"
            fullWidth
            required
            margin="normal"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoFocus
          />
          <TextField
            label="Password"
            type={showPassword ? 'text' : 'password'}
            fullWidth
            required
            margin="normal"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            slotProps={{
              input: {
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      onClick={() => setShowPassword((visible) => !visible)}
                      edge="end"
                    >
                      {showPassword ? <HidePasswordIcon /> : <ShowPasswordIcon />}
                    </IconButton>
                  </InputAdornment>
                ),
              },
            }}
          />
          <Button
            type="submit"
            variant="contained"
            fullWidth
            size="large"
            disabled={submitting}
            sx={{ mt: 3 }}
          >
            {submitting ? 'Signing in…' : 'Sign in'}
          </Button>
          <Typography
            variant="caption"
            color="text.secondary"
            align="center"
            sx={{ display: 'block', mt: 3 }}
          >
            No account? Accounts are created by your administrator — ask them for access.
          </Typography>
        </Box>
      </Paper>
      </Box>
    </Box>
  );
}
