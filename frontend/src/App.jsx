import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import { Forbidden, PageLoader } from './components/ui';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import TicketList from './pages/tickets/TicketList';
import TicketNew from './pages/tickets/TicketNew';
import TicketDetail from './pages/tickets/TicketDetail';
import Reports from './pages/Reports';
import Profile from './pages/Profile';
import Users from './pages/admin/Users';
import Teams from './pages/admin/Teams';
import Categories from './pages/admin/Categories';
import Subcategories from './pages/admin/Subcategories';
import Permissions from './pages/admin/Permissions';
import Sla from './pages/admin/Sla';
import Audit from './pages/admin/Audit';
import Settings from './pages/admin/Settings';

/** Proteção de rota na interface (a API revalida todas as permissões). */
function Guard({ perms, children }) {
  const { can } = useAuth();
  if (perms && !can(...perms)) return <Forbidden />;
  return children;
}

function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <div className="flex h-screen items-center justify-center"><PageLoader /></div>;
  if (!user) return <Navigate to="/login" state={{ from: location }} replace />;
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<RequireAuth><Layout /></RequireAuth>}>
        <Route index element={<Dashboard />} />
        <Route path="tickets/new" element={<Guard perms={['tickets.create']}><TicketNew /></Guard>} />
        <Route path="tickets/view/:id" element={<TicketDetail />} />
        <Route path="tickets/:view" element={<TicketList />} />
        <Route path="reports" element={<Guard perms={['reports.view', 'tickets.view_authorized']}><Reports /></Guard>} />
        <Route path="profile" element={<Profile />} />
        <Route path="admin/users" element={<Guard perms={['users.manage']}><Users /></Guard>} />
        <Route path="admin/teams" element={<Guard perms={['teams.manage']}><Teams /></Guard>} />
        <Route path="admin/categories" element={<Guard perms={['categories.manage']}><Categories /></Guard>} />
        <Route path="admin/subcategories" element={<Guard perms={['categories.manage']}><Subcategories /></Guard>} />
        <Route path="admin/permissions" element={<Guard perms={['permissions.manage']}><Permissions /></Guard>} />
        <Route path="admin/sla" element={<Guard perms={['sla.manage']}><Sla /></Guard>} />
        <Route path="admin/audit" element={<Guard perms={['audit.view']}><Audit /></Guard>} />
        <Route path="admin/settings" element={<Guard perms={['settings.manage']}><Settings /></Guard>} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  );
}
