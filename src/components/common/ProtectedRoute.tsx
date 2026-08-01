// src/components/common/ProtectedRoute.tsx
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth';

interface ProtectedRouteProps {
  children: ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const { user, perfil, orgaoId, carregando } = useAuth();

  if (carregando) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', color: '#0f172a' }}>
        <h2>A carregar sessão...</h2>
      </div>
    );
  }

  // Sem usuário autenticado ou sem custom claims (perfil/orgaoId) — nada de
  // sessionStorage aqui, é o próprio Firebase Auth quem decide.
  if (!user || !perfil || !orgaoId) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}