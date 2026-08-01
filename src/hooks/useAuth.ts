// src/hooks/useAuth.ts
import { useContext } from 'react';
import { AuthContext } from '../contexts/authContextBase';

export function useAuth() {
  return useContext(AuthContext);
}
