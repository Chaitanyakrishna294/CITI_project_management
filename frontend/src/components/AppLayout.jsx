import { useState } from 'react';
import { Outlet, useNavigate, NavLink } from 'react-router-dom';
import AppBar from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
import Typography from '@mui/material/Typography';
import Button from '@mui/material/Button';
import Box from '@mui/material/Box';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import InputBase from '@mui/material/InputBase';
import SearchIcon from '@mui/icons-material/Search';
import DashboardIcon from '@mui/icons-material/Dashboard';
import FolderIcon from '@mui/icons-material/Folder';
import PeopleIcon from '@mui/icons-material/People';
import EngineeringIcon from '@mui/icons-material/Engineering';
import { useAuth } from '../contexts/AuthContext';

const DRAWER_WIDTH = 220;

const NAV_ITEMS = [
  { label: 'Dashboard', to: '/dashboard', icon: <DashboardIcon />, roles: null },
  { label: 'Projects', to: '/projects', icon: <FolderIcon />, roles: null },
  { label: 'Resources', to: '/resources', icon: <EngineeringIcon />, roles: null },
  { label: 'Users', to: '/users', icon: <PeopleIcon />, roles: ['admin'] },
];

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');

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
      navigate(`/search?q=${encodeURIComponent(searchTerm.trim())}`);
    }
  }

  const visibleItems = NAV_ITEMS.filter((item) => !item.roles || item.roles.includes(user?.role));

  return (
    <Box sx={{ minHeight: '100vh', bgcolor: 'grey.50' }}>
      <AppBar position="fixed" color="primary" sx={{ zIndex: (theme) => theme.zIndex.drawer + 1 }}>
        <Toolbar>
          <Typography variant="h6" sx={{ mr: 3, whiteSpace: 'nowrap' }}>
            ACME Project Management
          </Typography>

          <Box
            component="form"
            onSubmit={handleSearchSubmit}
            sx={{
              display: 'flex',
              alignItems: 'center',
              bgcolor: 'rgba(255,255,255,0.15)',
              borderRadius: 1,
              px: 1,
              flexGrow: 1,
              maxWidth: 360,
            }}
          >
            <SearchIcon fontSize="small" />
            <InputBase
              placeholder="Search projects, deliverables, resources…"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              sx={{ ml: 1, color: 'inherit', flexGrow: 1, fontSize: 14 }}
            />
          </Box>

          <Box sx={{ flexGrow: 1 }} />

          {user && (
            <>
              <Typography variant="body2" sx={{ mr: 2 }}>
                {user.name} · {user.role}
              </Typography>
              <Button color="inherit" onClick={handleLogout}>
                Logout
              </Button>
            </>
          )}
        </Toolbar>
      </AppBar>

      <Drawer
        variant="permanent"
        sx={{
          width: DRAWER_WIDTH,
          flexShrink: 0,
          [`& .MuiDrawer-paper`]: { width: DRAWER_WIDTH, boxSizing: 'border-box' },
        }}
      >
        <Toolbar />
        <List>
          {visibleItems.map((item) => (
            <ListItemButton
              key={item.to}
              component={NavLink}
              to={item.to}
              sx={{ '&.active': { bgcolor: 'action.selected' } }}
            >
              <ListItemIcon>{item.icon}</ListItemIcon>
              <ListItemText primary={item.label} />
            </ListItemButton>
          ))}
        </List>
      </Drawer>

      <Box component="main" sx={{ ml: `${DRAWER_WIDTH}px`, p: 3 }}>
        <Toolbar />
        <Outlet />
      </Box>
    </Box>
  );
}
