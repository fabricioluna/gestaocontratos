// scripts/migrar-perfis.ts
//
// Script one-off da Fase 3: atribui os custom claims (perfil + orgaoId) aos
// 6 usuários de teste existentes no Firebase Auth (ver docs/PLANO.md, achado
// 0.3). Não roda como função HTTP — é executado manualmente pelo
// desenvolvedor, uma vez, fora do fluxo do site.
//
// Uso: copiar FIREBASE_ADMIN_CREDENTIALS da Vercel para o .env local e
// rodar `npm run migrar:perfis`.
//
// setCustomUserClaims substitui o claim inteiro a cada chamada — rodar este
// script mais de uma vez produz o mesmo resultado final, sem duplicar efeito.
import 'dotenv/config';
import { initializeApp, cert } from 'firebase-admin/app';
import type { ServiceAccount } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

interface DefinicaoPerfil {
  email: string;
  perfil: 'admin' | 'viewer';
  orgaoId: 'prefeitura' | 'fms' | 'fme' | 'fmas';
}

const USUARIOS: DefinicaoPerfil[] = [
  { email: 'prefeitura@pesqueira.pe.gov.br', perfil: 'admin', orgaoId: 'prefeitura' },
  { email: 'saude@pesqueira.pe.gov.br', perfil: 'admin', orgaoId: 'fms' },
  { email: 'educacao@pesqueira.pe.gov.br', perfil: 'admin', orgaoId: 'fme' },
  { email: 'assistencia@pesqueira.pe.gov.br', perfil: 'admin', orgaoId: 'fmas' },
  { email: 'fiscal.teste@gmail.com', perfil: 'viewer', orgaoId: 'prefeitura' },
  { email: 'fabricioluna@live.com', perfil: 'admin', orgaoId: 'prefeitura' },
];

async function main() {
  const envVar = process.env.FIREBASE_ADMIN_CREDENTIALS;
  if (!envVar) {
    console.error('Falta FIREBASE_ADMIN_CREDENTIALS no .env local.');
    process.exit(1);
  }
  const serviceAccount = JSON.parse(envVar) as ServiceAccount;
  initializeApp({ credential: cert(serviceAccount) });
  const auth = getAuth();

  for (const { email, perfil, orgaoId } of USUARIOS) {
    try {
      const usuario = await auth.getUserByEmail(email);
      await auth.setCustomUserClaims(usuario.uid, { perfil, orgaoId });
      console.log(`OK  ${email} -> perfil=${perfil} orgaoId=${orgaoId}`);
    } catch (error) {
      console.error(`FALHOU ${email}:`, error);
    }
  }
}

main().catch((error: unknown) => {
  console.error('Falha inesperada no script:', error);
  process.exit(1);
});
