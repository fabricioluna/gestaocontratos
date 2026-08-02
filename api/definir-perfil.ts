// api/definir-perfil.ts
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { verificarAdmin } from './_shared/verificarAdmin.js';

const PERFIS_VALIDOS = ['admin', 'viewer'];
const ORGAOS_VALIDOS = ['prefeitura', 'fms', 'fme', 'fmas'];

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Método não permitido.' });
  }

  try {
    if (getApps().length === 0) {
      const envVar = process.env.FIREBASE_ADMIN_CREDENTIALS;
      if (!envVar) {
        console.error('Falta a variável FIREBASE_ADMIN_CREDENTIALS na Vercel.');
        return res.status(500).json({ success: false, message: 'Erro de configuração no servidor.' });
      }
      const serviceAccount = JSON.parse(envVar);
      initializeApp({ credential: cert(serviceAccount) });
    }
  } catch (error) {
    console.error('Erro ao ler a chave do Firebase:', error);
    return res.status(500).json({ success: false, message: 'Erro de configuração no servidor.' });
  }

  const admin = await verificarAdmin(req, res);
  if (!admin) return;

  const { email, perfil, orgaoId } = req.body;
  if (!email || !PERFIS_VALIDOS.includes(perfil) || !ORGAOS_VALIDOS.includes(orgaoId)) {
    return res.status(400).json({ success: false, message: 'Dados inválidos: informe email, perfil (admin/viewer) e orgaoId válidos.' });
  }

  try {
    const auth = getAuth();
    const usuario = await auth.getUserByEmail(email);
    await auth.setCustomUserClaims(usuario.uid, { perfil, orgaoId });
    return res.status(200).json({ success: true, message: 'Perfil definido com sucesso.' });
  } catch (error) {
    console.error('Erro ao definir perfil:', error);
    return res.status(500).json({ success: false, message: 'Erro interno ao definir o perfil.' });
  }
}
