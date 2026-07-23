/**
 * Application shell: top bar, global search, and role-aware navigation.
 *
 * Navigation mirrors req/UI_UX_Design&UserFlow.md §4 (Dashboard, Projects,
 * Deliverables, Resources, Budgets, Reports, Administration) and the responsive
 * behaviour in §13:
 *   Desktop (md+)  — permanent sidebar alongside a multi-column layout
 *   Tablet/Mobile  — hamburger button opening a temporary drawer, single column
 */
import { cloneElement, useState } from 'react';
import { Outlet, useNavigate, NavLink } from 'react-router-dom';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import InputBase from '@mui/material/InputBase';
import Tooltip from '@mui/material/Tooltip';
import { alpha, useTheme } from '@mui/material/styles';
import useMediaQuery from '@mui/material/useMediaQuery';
import {
  MenuIcon,
  SearchIcon,
  DashboardIcon,
  ProjectsIcon,
  DeliverablesIcon,
  ResourcesIcon,
  BudgetsIcon,
  ReportsIcon,
  TeamsIcon,
  IndividualsIcon,
  InsightsIcon,
  UsersIcon,
  LogoutIcon,
  LightModeIcon,
  DarkModeIcon,
} from './icons';
import { useAuth } from '../contexts/AuthContext';
import { useColorMode } from '../contexts/ColorModeContext';
import { DISPLAY_FONT } from '../theme';
import BrandMark from './BrandMark';

const DRAWER_WIDTH = 220;
// Slimmer than MUI's 64px default: the bar holds utilities, not identity.
const BAR_HEIGHT = 56;
// Data reads better in a measured column than edge-to-edge on wide monitors.
const CONTENT_MAX_WIDTH = 1240;

/**
 * Navigation grouped into sections (glow-up brief §4.3): Work is the project
 * domain, Teams the team-management domain, Admin the accounts area. A section
 * renders only when at least one of its items is visible for the role.
 *
 * `roles: null` means every authenticated role sees the item. Role gating here
 * is presentational only — ProtectedRoute and the backend enforce real access.
 */
const NAV_SECTIONS = [
  {
    label: 'Work',
    items: [
      { label: 'Dashboard', to: '/dashboard', icon: <DashboardIcon />, roles: null },
      { label: 'Projects', to: '/projects', icon: <ProjectsIcon />, roles: null },
      { label: 'Deliverables', to: '/deliverables', icon: <DeliverablesIcon />, roles: null },
      { label: 'Resources', to: '/resources', icon: <ResourcesIcon />, roles: null },
      {
        label: 'Budgets',
        to: '/budgets',
        icon: <BudgetsIcon />,
        roles: ['admin', 'project_manager', 'finance'],
      },
      { label: 'Reports', to: '/reports', icon: <ReportsIcon />, roles: null },
    ],
  },
  {
    label: 'Teams',
    items: [
      { label: 'Teams', to: '/teams', icon: <TeamsIcon />, roles: null },
      { label: 'Individuals', to: '/individuals', icon: <IndividualsIcon />, roles: null },
      { label: 'Team Insights', to: '/team-insights', icon: <InsightsIcon />, roles: null },
    ],
  },
  {
    label: 'Admin',
    items: [{ label: 'Users', to: '/users', icon: <UsersIcon />, roles: ['admin'] }],
  },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const { mode, toggleMode } = useColorMode();
  const navigate = useNavigate();
  const theme = useTheme();
  const isDesktop = useMediaQuery(theme.breakpoints.up('md'));
  const [searchTerm, setSearchTerm] = useState('');
  const [mobileOpen, setMobileOpen] = useState(false);

  async function handleLogout() {
    try {
      await logout();
    } finally {
      navigate('/login', { replace: true });
    }
  }

  function handleSearchSubmit(e) {
    e.preventDefault();
    if (searchTerm.trim()) {
      setMobileOpen(false);
      navigate(`/search?q=${encodeURIComponent(searchTerm.trim())}`);
    }
  }

  const visibleSections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.roles || item.roles.includes(user?.role)),
  })).filter((section) => section.items.length > 0);

  const navigation = (
    <>
      {/* The brand lives at the head of the ink column, not in the top bar —
          the sidebar runs floor to ceiling and owns the app's identity, so
          the bar above the content can stay a quiet utility strip. */}
      <Box sx={{ px: 2.5, pt: 3, pb: 2 }}>
        <Typography
          component="div"
          sx={{
            fontFamily: DISPLAY_FONT,
            fontWeight: 600,
            fontSize: 26,
            lineHeight: 1.1,
            letterSpacing: '-0.01em',
            color: 'var(--color-sidebar-active-bg)',
          }}
        >
          HEX
        </Typography>
        <Typography
          component="div"
          variant="caption"
          sx={{
            color: 'var(--color-sidebar-text)',
            letterSpacing: '0.1em',
            textTransform: 'uppercase',
          }}
        >
          Project Management
        </Typography>
      </Box>
      {/* The brand mark echoed as a whisper at the foot of the rail; nav
          items (positioned) paint over it. */}
      <BrandMark size={220} opacity={0.05} glyphSx={{ left: -48, bottom: -70 }} />
      {/* Solid ink sidebar: the app's silhouette
          comes from this surface, not from a tinted white list. Colours ride
          the --color-sidebar-* custom properties so dark mode retunes them
          without any component logic. */}
      <Box component="nav" aria-label="Main navigation" sx={{ px: 1.5, pb: 3 }}>
        {visibleSections.map((section, sectionIndex) => (
          <List
            key={section.label}
            subheader={
              <Typography
                component="div"
                variant="caption"
                sx={{
                  px: 1,
                  pt: sectionIndex === 0 ? 2 : 3,
                  pb: 1,
                  color: 'var(--color-sidebar-text)',
                  opacity: 0.75,
                  fontWeight: 600,
                  letterSpacing: '0.1em',
                  textTransform: 'uppercase',
                }}
              >
                {section.label}
              </Typography>
            }
            dense
            disablePadding
            sx={{
              // A thin inset rule separates groups — structure, not just labels.
              ...(sectionIndex > 0 && {
                borderTop: '1px solid var(--color-sidebar-rule)',
                mt: 2,
              }),
            }}
          >
            {section.items.map((item) => (
              <ListItemButton
                key={item.to}
                component={NavLink}
                to={item.to}
                onClick={() => setMobileOpen(false)}
                sx={{
                  borderRadius: 1,
                  mb: 0.5,
                  color: 'var(--color-sidebar-text)',
                  '& .MuiListItemIcon-root': { color: 'inherit', opacity: 0.85 },
                  '&:hover': { bgcolor: 'var(--color-sidebar-hover)' },
                  // A dark focus ring vanishes on ink — use the porcelain plate tone.
                  '&:focus-visible': {
                    outline: '2px solid var(--color-sidebar-active-bg)',
                    outlineOffset: -2,
                  },
                  // Active state: porcelain plate with ink text plus the
                  // viridian thread notch — "current" wears the same mark
                  // here as it does on focus rings and row hover.
                  '&.active': {
                    bgcolor: 'var(--color-sidebar-active-bg)',
                    color: 'var(--color-sidebar-active-text)',
                    boxShadow: 'inset 3px 0 0 var(--color-thread)',
                    '& .MuiListItemIcon-root': { color: 'inherit', opacity: 1 },
                    '& .MuiListItemText-primary': { fontWeight: 600 },
                    '&:hover': { bgcolor: 'var(--color-sidebar-active-bg)' },
                  },
                }}
              >
                {/* 18px icons at 32px inset: quieter than body text, per the
                    tightened rail. */}
                <ListItemIcon sx={{ minWidth: 32 }}>
                  {cloneElement(item.icon, { size: 18 })}
                </ListItemIcon>
                <ListItemText primary={item.label} primaryTypographyProps={{ variant: 'body2' }} />
              </ListItemButton>
            ))}
          </List>
        ))}
      </Box>
    </>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* App-wide watermark: the brand X cropped by the viewport's own
          corner, pinned at zIndex -1 — above the canvas colour, below every
          surface. Paper-white on the cream canvas reads as an emboss (a
          brighter shape pressed into the page), and disappears seamlessly
          wherever a white card covers it. Same trick holds in dark mode,
          where paper sits one step lighter than the ink canvas. */}
      <BrandMark
        fixed
        size={560}
        opacity={0.9}
        color="background.paper"
        glyphSx={{ right: -100, bottom: -160 }}
      />
      {/* WCAG 2.4.1 bypass block: first focusable element jumps past the bar
          and sidebar. Visually hidden until keyboard focus lands on it. */}
      <Box
        component="a"
        href="#main-content"
        sx={{
          position: 'fixed',
          top: 8,
          left: 8,
          zIndex: (t) => t.zIndex.tooltip + 1,
          bgcolor: 'background.paper',
          color: 'primary.main',
          px: 2,
          py: 1,
          borderRadius: 1,
          border: '1px solid',
          borderColor: 'divider',
          transform: 'translateY(-200%)',
          '&:focus-visible': { transform: 'none' },
        }}
      >
        Skip to main content
      </Box>
      {/* Sleek chrome: the bar sits beside the sidebar (not over it), rides
          the canvas colour with a hairline rule, and carries only utilities —
          the ink column owns the brand. */}
      <AppBar
        position="fixed"
        color="inherit"
        elevation={0}
        sx={{
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { md: `${DRAWER_WIDTH}px` },
          bgcolor: 'background.default',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Toolbar sx={{ gap: 1, minHeight: BAR_HEIGHT, '@media (min-width:0px)': { minHeight: BAR_HEIGHT } }}>
          {!isDesktop && (
            <IconButton
              color="inherit"
              edge="start"
              aria-label="Open navigation menu"
              onClick={() => setMobileOpen(true)}
            >
              <MenuIcon />
            </IconButton>
          )}

          <Box
            component="form"
            role="search"
            onSubmit={handleSearchSubmit}
            sx={{
              display: 'flex',
              alignItems: 'center',
              bgcolor: 'background.paper',
              '&:hover': { bgcolor: (t) => alpha(t.palette.primary.main, 0.06) },
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 999, // pill — same silhouette as buttons
              px: 1.5,
              flexGrow: 1,
              maxWidth: 400,
              // The thread marks the live control while typing.
              '&:focus-within': { borderColor: 'var(--color-thread)' },
            }}
          >
            <SearchIcon fontSize="small" sx={{ color: 'text.secondary' }} />
            <InputBase
              placeholder="Search projects, deliverables, resources…"
              inputProps={{ 'aria-label': 'Search projects, deliverables and resources' }}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{ ml: 1, color: 'inherit', flexGrow: 1, fontSize: 14 }}
            />
          </Box>

          <Box sx={{ flexGrow: 1 }} />

          <Tooltip title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
            <IconButton
              color="inherit"
              aria-label={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              onClick={toggleMode}
            >
              {mode === 'dark' ? <LightModeIcon /> : <DarkModeIcon />}
            </IconButton>
          </Tooltip>

          {user && (
            <>
              {/* Name over role, right-aligned — reads as one quiet block
                  instead of a sentence competing with the page title. */}
              <Box sx={{ textAlign: 'right', display: { xs: 'none', md: 'block' }, ml: 1 }}>
                <Typography variant="body2" sx={{ fontWeight: 500, lineHeight: 1.2 }}>
                  {user.name}
                </Typography>
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ lineHeight: 1, display: 'block' }}
                >
                  {/* Human words, not enum values: project_manager → Project manager. */}
                  {user.role.charAt(0).toUpperCase() + user.role.slice(1).replaceAll('_', ' ')}
                </Typography>
              </Box>
              <Tooltip title="Logout">
                <IconButton color="inherit" aria-label="Logout" onClick={handleLogout}>
                  <LogoutIcon />
                </IconButton>
              </Tooltip>
            </>
          )}
        </Toolbar>
      </AppBar>

      {/* Plain Box: the labelled <nav> landmark lives inside the drawer —
          a second, unnamed nav wrapper would announce twice. */}
      <Box sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        {isDesktop ? (
          <Drawer
            variant="permanent"
            open
            sx={{
              '& .MuiDrawer-paper': {
                width: DRAWER_WIDTH,
                boxSizing: 'border-box',
                bgcolor: 'var(--color-sidebar-bg)',
                borderRight: 'none',
              },
            }}
          >
            {navigation}
          </Drawer>
        ) : (
          <Drawer
            variant="temporary"
            open={mobileOpen}
            onClose={() => setMobileOpen(false)}
            ModalProps={{ keepMounted: true }} // Faster reopen on mobile.
            sx={{ '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box', bgcolor: 'var(--color-sidebar-bg)' } }}
          >
            {navigation}
          </Drawer>
        )}
      </Box>

      <Box
        component="main"
        id="main-content"
        sx={{
          flexGrow: 1,
          // minWidth:0 lets wide tables scroll inside the main column instead of
          // forcing the whole page to scroll sideways on small screens.
          minWidth: 0,
          p: { xs: 2, md: 4 },
        }}
      >
        <Toolbar sx={{ minHeight: BAR_HEIGHT, '@media (min-width:0px)': { minHeight: BAR_HEIGHT } }} />
        <Box sx={{ maxWidth: CONTENT_MAX_WIDTH, mx: 'auto' }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
