// api/list-users.ts
import { getAuth } from 'firebase-admin/auth';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { verificarAdmin } from './_shared/verificarAdmin.js';
import { inicializarFirebaseAdmin } from './_shared/firebaseAdmin.js';

export default async function handler(req: VercelRequest, res: VercelResponse) {
  // Apenas permite pedidos de leitura (GET)
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Método não permitido.' });
  }

  try {
    inicializarFirebaseAdmin();
  } catch (error) {
    console.error('Erro ao ler a chave do Firebase:', error);
    return res.status(500).json({ success: false, message: 'Erro de configuração no servidor.' });
  }

  // 2. Exige um usuário autenticado com claim de admin
  const admin = await verificarAdmin(req, res);
  if (!admin) return;

  // 3. Busca a lista de utilizadores no Firebase Auth
  try {
    const auth = getAuth();
    const listUsersResult = await auth.listUsers(1000); // Traz até 1000 usuários

    // Extrai apenas os e-mails para um array simples (ex: ["a@a.com", "b@b.com"])
    const emails = listUsersResult.users
      .map(user => user.email)
      .filter(email => email !== undefined); // Garante que não há campos vazios

    return res.status(200).json({ success: true, emails });
  } catch (error) {
    console.error('Erro ao buscar utilizadores:', error);
    return res.status(500).json({ success: false, message: 'Erro interno ao processar a lista.' });
  }
}
