// src/components/common/ProtectedRoute.tsx
import type { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';

interface ProtectedRouteProps {
  children: ReactNode;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  // Verifica se existe uma sessão ativa (o órgão logado)
  const orgaoLogado = sessionStorage.getItem('orgaoLogado');

  // Se não existir, bloqueia a renderização da tela e manda para o login (/)
  if (!orgaoLogado) {
    return <Navigate to="/" replace />;
  }

  // Se existir sessão, permite que a tela (children) seja carregada
  // Usamos um fragmento <> </> para garantir que o TypeScript aceite o retorno
  return <>{children}</>;
}