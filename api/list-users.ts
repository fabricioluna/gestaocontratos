// api/list-users.ts
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

export default async function handler(req: any, res: any) {
  // Apenas permite pedidos de leitura (GET)
  if (req.method !== 'GET') {
    return res.status(405).json({ success: false, message: 'Método não permitido.' });
  }

  // 1. Inicializa o Firebase de forma segura (Idêntico ao create-user)
  try {
    if (getApps().length === 0) {
      const envVar = process.env.FIREBASE_ADMIN_CREDENTIALS;
      if (!envVar) {
         return res.status(500).json({ success: false, message: 'Falta a variável FIREBASE_ADMIN_CREDENTIALS na Vercel.' });
      }
      const serviceAccount = JSON.parse(envVar);
      initializeApp({ credential: cert(serviceAccount) });
    }
  } catch (error: any) {
    console.error('Erro ao ler a chave do Firebase:', error);
    return res.status(500).json({ success: false, message: 'Erro no JSON do Firebase Admin.' });
  }

  // 2. Busca a lista de utilizadores no Firebase Auth
  try {
    const listUsersResult = await getAuth().listUsers(1000); // Traz até 1000 usuários
    
    // Extrai apenas os e-mails para um array simples (ex: ["a@a.com", "b@b.com"])
    const emails = listUsersResult.users
      .map(user => user.email)
      .filter(email => email !== undefined); // Garante que não há campos vazios

    return res.status(200).json({ success: true, emails });
  } catch (error: any) {
    console.error('Erro ao buscar utilizadores:', error);
    return res.status(500).json({ success: false, message: 'Erro interno ao processar a lista.' });
  }
}