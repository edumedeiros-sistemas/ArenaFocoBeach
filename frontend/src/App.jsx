import { Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Courts from './pages/Courts';
import Agenda from './pages/Agenda';
import Championships from './pages/Championships';
import ChampionshipDetail from './pages/ChampionshipDetail';
import Leagues from './pages/Leagues';
import Finance from './pages/Finance';
import Profile from './pages/Profile';
import Users from './pages/Users';
import Configuracoes from './pages/Configuracoes';
import ConfiguracoesPapeis from './pages/ConfiguracoesPapeis';
import ConfiguracoesPlanos from './pages/ConfiguracoesPlanos';
import ConfiguracoesRoles from './pages/ConfiguracoesRoles';
import RoleGuard from './components/RoleGuard';
import { useAuth } from './context/AuthContext';

function PrivateRoute({ children, roles = [] }) {
  const { user, profile, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center">Carregando...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (!profile) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-sand-50 p-4">
        <div className="text-center max-w-sm">
          <p className="text-gray-700 mb-2">Carregando perfil...</p>
          <p className="text-sm text-gray-500">Se demorar, verifique se o backend está rodando (porta 4000) e atualize a página.</p>
        </div>
      </div>
    );
  }
  if (profile?.role === undefined) return <div className="p-4">Aguardando perfil...</div>;
  if (roles.length && profile && !roles.includes(profile.role)) {
    return <Navigate to="/" replace />;
  }
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <Layout />
          </PrivateRoute>
        }
      >
        <Route index element={<Dashboard />} />
        <Route path="quadras" element={<Courts />} />
        <Route path="agenda" element={<Agenda />} />
        <Route path="campeonatos" element={<Championships />} />
        <Route path="campeonatos/:id" element={<ChampionshipDetail />} />
        <Route path="ligas" element={<Leagues />} />
        <Route path="financeiro" element={<Finance />} />
        <Route path="perfil" element={<Profile />} />
        <Route path="configuracoes" element={<RoleGuard roles={['admin', 'instructor']}><Configuracoes /></RoleGuard>} />
        <Route path="configuracoes/roles" element={<RoleGuard roles={['admin', 'instructor', 'student']}><ConfiguracoesRoles /></RoleGuard>} />
        <Route path="configuracoes/papeis" element={<RoleGuard roles={['admin']}><ConfiguracoesPapeis /></RoleGuard>} />
        <Route path="configuracoes/planos" element={<RoleGuard roles={['admin']}><ConfiguracoesPlanos /></RoleGuard>} />
        <Route path="usuarios" element={<RoleGuard roles={['admin', 'instructor']}><Users /></RoleGuard>} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
