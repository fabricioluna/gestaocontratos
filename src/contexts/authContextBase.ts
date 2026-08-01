// src/contexts/authContextBase.ts
import { createContext } from 'react';
import type { User } from 'firebase/auth';

export type Perfil = 'admin' | 'viewer';

export interface AuthState {
  user: User | null;
  perfil: Perfil | null;
  orgaoId: string | null;
  carregando: boolean;
}

export const AuthContext = createContext<AuthState>({ user: null, perfil: null, orgaoId: null, carregando: true });
