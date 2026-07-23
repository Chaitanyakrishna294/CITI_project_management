/**
 * Route table for the CITI Project Management Platform.
 *
 * Mirrors the sitemap in req/UI_UX_Design&UserFlow.md §6 and the screen/role
 * matrix at the end of that document. Role gating here is a UX affordance —
 * every backend service independently enforces the same rules.
 */
import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/AppLayout';
import { LoadingState } from './components/PageState';
import Login from './pages/Login';

// Each page is its own chunk so the initial bundle stays small; the Login
// page stays eager because it is the first thing an unauthenticated user sees.
const Dashboard = lazy(() => import('./pages/Dashboard'));
const Projects = lazy(() => import('./pages/Projects'));
const ProjectDetails = lazy(() => import('./pages/ProjectDetails'));
const Deliverables = lazy(() => import('./pages/Deliverables'));
const Resources = lazy(() => import('./pages/Resources'));
const Budgets = lazy(() => import('./pages/Budgets'));
const Reports = lazy(() => import('./pages/Reports'));
const SearchResults = lazy(() => import('./pages/SearchResults'));
const UserManagement = lazy(() => import('./pages/UserManagement'));
const Teams = lazy(() => import('./pages/Teams'));
const TeamDetails = lazy(() => import('./pages/TeamDetails'));
const Individuals = lazy(() => import('./pages/Individuals'));
const TeamInsights = lazy(() => import('./pages/TeamInsights'));

/** UI-08 Budget Management is limited to the roles with financial visibility. */
const BUDGET_ROLES = ['admin', 'project_manager', 'finance'];

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Suspense fallback={<LoadingState label="Loading page…" />}>
        <Routes>
          <Route path="/login" element={<Login />} />

          <Route element={<ProtectedRoute />}>
            <Route element={<AppLayout />}>
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/projects" element={<Projects />} />
              <Route path="/projects/:id" element={<ProjectDetails />} />
              <Route path="/deliverables" element={<Deliverables />} />
              <Route path="/resources" element={<Resources />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/search" element={<SearchResults />} />
              <Route path="/teams" element={<Teams />} />
              <Route path="/teams/:id" element={<TeamDetails />} />
              <Route path="/individuals" element={<Individuals />} />
              <Route path="/team-insights" element={<TeamInsights />} />

              <Route element={<ProtectedRoute allowedRoles={BUDGET_ROLES} />}>
                <Route path="/budgets" element={<Budgets />} />
              </Route>

              <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
                <Route path="/users" element={<UserManagement />} />
              </Route>
            </Route>
          </Route>

          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
        </Suspense>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
