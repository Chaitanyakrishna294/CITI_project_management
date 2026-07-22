/**
 * Route table for the ACME Project Management Platform.
 *
 * Mirrors the sitemap in req/UI_UX_Design&UserFlow.md §6 and the screen/role
 * matrix at the end of that document. Role gating here is a UX affordance —
 * every backend service independently enforces the same rules.
 */
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import AppLayout from './components/AppLayout';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Projects from './pages/Projects';
import ProjectDetails from './pages/ProjectDetails';
import Deliverables from './pages/Deliverables';
import Resources from './pages/Resources';
import Budgets from './pages/Budgets';
import Reports from './pages/Reports';
import SearchResults from './pages/SearchResults';
import UserManagement from './pages/UserManagement';

/** UI-08 Budget Management is limited to the roles with financial visibility. */
const BUDGET_ROLES = ['admin', 'project_manager', 'finance'];

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
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
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
