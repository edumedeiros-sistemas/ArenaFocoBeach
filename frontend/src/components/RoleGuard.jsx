import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function RoleGuard({ children, roles = [] }) {
  const { profile } = useAuth();
  if (!profile || !roles.length) return children;
  if (!roles.includes(profile.role)) return <Navigate to="/" replace />;
  return children;
}
