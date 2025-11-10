import { Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from '../../stores/authStore';
import logger from '../../utils/logger';

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();

  if (!isAuthenticated) {
    logger.debug('ProtectedRoute: Redirecting to login', { from: location.pathname });
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
} 