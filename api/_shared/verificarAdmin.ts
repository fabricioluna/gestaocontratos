// api/_shared/verificarAdmin.ts
import { getAuth } from 'firebase-admin/auth';
import type { DecodedIdToken } from 'firebase-admin/auth';

// Exige um token válido cujo custom claim `perfil` seja 'admin'. Em caso de
// falha (sem token, token inválido ou perfil != admin), já escreve a
// resposta HTTP e devolve null — o chamador só precisa fazer
// `if (!admin) return;`.
//
// Fica em api/_shared/ de propósito: a Vercel exclui pastas de api/
// prefixadas com "_" do roteamento público (confirmado em produção —
// api/lib/verificarAdmin, sem o "_", virou uma rota própria que retornava
// 500 por não ter export default handler; sem risco de segurança, mas sem
// necessidade de existir).
//
// Incidente da Fase 3 (ver docs/PLANO.md): este arquivo quebrou em
// produção com FUNCTION_INVOCATION_FAILED em toda requisição de
// create-user/list-users/definir-perfil. Causa raiz real, achada nos
// Build Logs da Vercel: import relativo sem extensão. A compilação da
// Vercel para cada função de api/ usa moduleResolution node16/nodenext,
// que exige extensão .js explícita em imports relativos — mesmo
// importando um arquivo .ts (convenção do TS+ESM: a extensão é a de
// saída, não a de origem). tsconfig.node.json usa moduleResolution
// "bundler" (mais permissivo), por isso o `tsc -b` local não acusava o
// erro. Os handlers precisam importar como `./_shared/verificarAdmin.js`.
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
