// api/_shared/firebaseAdmin.ts
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import type { ServiceAccount } from 'firebase-admin/app';

// Inicializa o firebase-admin uma única vez por instância de função
// serverless, lendo a service account de FIREBASE_ADMIN_CREDENTIALS.
// Bloco antes duplicado em create-user, list-users, definir-perfil,
// extrair-documento e cron-vencimentos (Fase 7). Lança se a variável não
// existir ou não for um JSON válido — cada handler decide como converter
// isso numa resposta HTTP (os 4 endpoints com `res` respondem 500; o cron
// deixa o próprio try/catch externo cuidar disso).
export const inicializarFirebaseAdmin = (): void => {
  if (getApps().length > 0) return;
  const envVar = process.env.FIREBASE_ADMIN_CREDENTIALS;
  if (!envVar) {
    throw new Error('Falta a variável FIREBASE_ADMIN_CREDENTIALS na Vercel.');
  }
  const serviceAccount = JSON.parse(envVar) as ServiceAccount;
  initializeApp({ credential: cert(serviceAccount) });
};
