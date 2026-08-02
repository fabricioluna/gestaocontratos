// api/lib/verificarAdmin.ts
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';

// Exige um token válido cujo custom claim `perfil` seja 'admin'. Em caso de
// falha (sem token, token inválido ou perfil != admin), já escreve a
// resposta HTTP e devolve null — o chamador só precisa fazer
// `if (!admin) return;`.
//
// Fica em api/lib/, não api/_shared/ — a Vercel exclui do pacote publicado
// qualquer pasta de api/ prefixada com "_", o que quebrava em produção
// (FUNCTION_INVOCATION_FAILED) todo handler que importava daqui. Achado em
// produção na Fase 3, ver docs/PLANO.md.
export async function verificarAdmin(req: any, res: any): Promise<DecodedIdToken | null> {
  const authHeader = req.headers.authorization || '';
  const idToken = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null;
  if (!idToken) {
    res.status(401).json({ success: false, message: 'Não autenticado.' });
    return null;
  }

  let decodedToken: DecodedIdToken;
  try {
    decodedToken = await getAuth().verifyIdToken(idToken);
  } catch (error) {
    console.error('Token inválido:', error);
    res.status(401).json({ success: false, message: 'Não autenticado.' });
    return null;
  }

  if (decodedToken.perfil !== 'admin') {
    res.status(403).json({ success: false, message: 'Acesso restrito a administradores.' });
    return null;
  }

  return decodedToken;
}
