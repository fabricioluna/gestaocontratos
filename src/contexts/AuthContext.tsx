// src/contexts/AuthContext.tsx
import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { onAuthStateChanged } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { auth } from '../firebase';
import { AuthContext } from './authContextBase';
import type { AuthState, Perfil } from './authContextBase';

// Único lugar do app que ouve onAuthStateChanged e lê os custom claims
// (perfil/orgaoId) do ID token — substitui o sessionStorage.orgaoLogado/
// perfilLogado da Fase 2 e anteriores.
export function AuthProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<AuthState>({ user: null, perfil: null, orgaoId: null, carregando: true });

  useEffect(() => {
    // onAuthStateChanged espera um callback que retorna void — o Firebase
    // ignora o Promise, exatamente como um handler de evento do React,
    // então a função assíncrona real fica separada e é chamada com `void`.
    const lidarComMudancaAuth = async (user: User | null) => {
      if (!user) {
        setEstado({ user: null, perfil: null, orgaoId: null, carregando: false });
        return;
      }
      const resultado = await user.getIdTokenResult();
      const perfil = (resultado.claims.perfil as Perfil | undefined) || null;
      const orgaoId = (resultado.claims.orgaoId as string | undefined) || null;
      setEstado({ user, perfil, orgaoId, carregando: false });
    };
    const unsubscribe = onAuthStateChanged(auth, (user) => { void lidarComMudancaAuth(user); });
    return () => unsubscribe();
  }, []);

  return <AuthContext.Provider value={estado}>{children}</AuthContext.Provider>;
}
