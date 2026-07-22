/**
 * Application shell: top bar, global search, and role-aware navigation.
 *
 * Navigation mirrors req/UI_UX_Design&UserFlow.md §4 (Dashboard, Projects,
 * Deliverables, Resources, Budgets, Reports, Administration) and the responsive
 * behaviour in §13:
 *   Desktop (md+)  — permanent sidebar alongside a multi-column layout
 *   Tablet/Mobile  — hamburger button opening a temporary drawer, single column
 */
import { useState } from 'react';
import { Outlet, useNavigate, NavLink } from 'react-router-dom';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
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
import MenuIcon from '@mui/icons-material/Menu';
import SearchIcon from '@mui/icons-material/Search';
import DashboardIcon from '@mui/icons-material/Dashboard';
import FolderIcon from '@mui/icons-material/Folder';
import AssignmentIcon from '@mui/icons-material/Assignment';
import EngineeringIcon from '@mui/icons-material/Engineering';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import AssessmentIcon from '@mui/icons-material/Assessment';
import PeopleIcon from '@mui/icons-material/People';
import LogoutIcon from '@mui/icons-material/Logout';
import { useAuth } from '../contexts/AuthContext';

const DRAWER_WIDTH = 232;

/**
 * `roles: null` means every authenticated role sees the item. Role gating here
 * is presentational only — ProtectedRoute and the backend enforce real access.
 */
const NAV_ITEMS = [
  { label: 'Dashboard', to: '/dashboard', icon: <DashboardIcon />, roles: null },
  { label: 'Projects', to: '/projects', icon: <FolderIcon />, roles: null },
  { label: 'Deliverables', to: '/deliverables', icon: <AssignmentIcon />, roles: null },
  { label: 'Resources', to: '/resources', icon: <EngineeringIcon />, roles: null },
  {
    label: 'Budgets',
    to: '/budgets',
    icon: <AccountBalanceIcon />,
    roles: ['admin', 'project_manager', 'finance'],
  },
  { label: 'Reports', to: '/reports', icon: <AssessmentIcon />, roles: null },
  { label: 'Users', to: '/users', icon: <PeopleIcon />, roles: ['admin'] },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
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

  const visibleItems = NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(user?.role));

  const navigation = (
    <>
      <Toolbar />
      <List component="nav" aria-label="Main navigation" sx={{ px: 1 }}>
        {visibleItems.map((item) => (
          <ListItemButton
            key={item.to}
            component={NavLink}
            to={item.to}
            onClick={() => setMobileOpen(false)}
            sx={{
              borderRadius: 1,
              mb: 0.5,
              color: 'text.primary',
              '& .MuiListItemIcon-root': { color: 'text.secondary' },
              // Harbor Blue active state: a soft navy tint (secondary #dce6f9)
              // with navy text, rather than a solid filled pill.
              '&.active': {
                bgcolor: '#dce6f9',
                color: 'primary.main',
                '& .MuiListItemIcon-root': { color: 'inherit' },
                '& .MuiListItemText-primary': { fontWeight: 600 },
                '&:hover': { bgcolor: '#cfdcf5' },
              },
            }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} primaryTypographyProps={{ variant: 'body2' }} />
          </ListItemButton>
        ))}
      </List>
    </>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', bgcolor: 'background.default' }}>
      {/* Harbor Blue chrome: white bar with a hairline border instead of a
          filled primary bar — the navy is reserved for the brand and actions. */}
      <AppBar
        position="fixed"
        color="inherit"
        elevation={0}
        sx={{
          zIndex: (t) => t.zIndex.drawer + 1,
          bgcolor: 'background.paper',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        <Toolbar sx={{ gap: 1 }}>
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

          <Typography
            variant="h6"
            component="div"
            sx={{
              mr: 3,
              whiteSpace: 'nowrap',
              display: { xs: 'none', sm: 'block' },
              color: 'primary.main',
              fontWeight: 700,
            }}
          >
            ACME Project Management
          </Typography>

          <Box
            component="form"
            role="search"
            onSubmit={handleSearchSubmit}
            sx={{
              display: 'flex',
              alignItems: 'center',
              bgcolor: 'background.default',
              '&:hover': { bgcolor: (t) => alpha(t.palette.primary.main, 0.08) },
              border: '1px solid',
              borderColor: 'divider',
              borderRadius: 1,
              px: 1,
              flexGrow: 1,
              maxWidth: 360,
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

          {user && (
            <>
              <Typography variant="body2" sx={{ mr: 2, display: { xs: 'none', md: 'block' } }}>
                {user.name} · {user.role}
              </Typography>
              {isDesktop ? (
                <Button color="inherit" startIcon={<LogoutIcon />} onClick={handleLogout}>
                  Logout
                </Button>
              ) : (
                <Tooltip title="Logout">
                  <IconButton color="inherit" aria-label="Logout" onClick={handleLogout}>
                    <LogoutIcon />
                  </IconButton>
                </Tooltip>
              )}
            </>
          )}
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        {isDesktop ? (
          <Drawer
            variant="permanent"
            open
            sx={{
              '& .MuiDrawer-paper': {
                width: DRAWER_WIDTH,
                boxSizing: 'border-box',
                bgcolor: '#f8fafc', // Harbor sidebar tone
                borderRight: '1px solid',
                borderColor: 'divider',
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
            sx={{ '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box', bgcolor: '#f8fafc' } }}
          >
            {navigation}
          </Drawer>
        )}
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          // minWidth:0 lets wide tables scroll inside the main column instead of
          // forcing the whole page to scroll sideways on small screens.
          minWidth: 0,
          p: { xs: 2, md: 3 },
        }}
      >
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
}
