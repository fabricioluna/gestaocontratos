// api/recuperar-senha.ts
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';
import nodemailer from 'nodemailer';
import type { VercelRequest, VercelResponse } from '@vercel/node';
import { inicializarFirebaseAdmin } from './_shared/firebaseAdmin.js';

const MENSAGEM_GENERICA = 'Se este e-mail estiver cadastrado, você vai receber um link de redefinição em instantes.';

// Diferente do sendPasswordResetEmail do SDK (que chamava o Identity
// Toolkit do próprio Firebase e vinha com contenção de abuso embutida do
// lado da Google), este endpoint envia pela nossa conta Gmail — sem esse
// cooldown, alguém que soubesse um e-mail institucional real poderia
// inundar a caixa dele em loop, e ainda arriscar a conta Gmail ser
// sinalizada por comportamento anômalo (o que derrubaria também os
// e-mails de criação de usuário e alerta de vencimento que dependem
// dela). Cooldown por e-mail, guardado no Firestore via Admin SDK — não
// passa pelas Security Rules (Admin SDK sempre ignora Rules).
const COOLDOWN_MS = 60_000;

// Gera o link de redefinição pelo Admin SDK e envia o e-mail pela mesma
// conta Gmail já usada em cron-vencimentos.ts e create-user.ts, em vez do
// e-mail padrão do Firebase Auth. O remetente padrão do Firebase
// (noreply@<projeto>.firebaseapp.com) cai quase sempre em spam por falta
// de reputação e SPF/DKIM próprios; a conta Gmail já em uso para os
// alertas de vencimento tem entrega comprovada.
export default async function handler(req: VercelRequest, res: VercelResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Método não permitido.' });
  }

  const { email } = req.body as { email?: string };
  if (!email) {
    return res.status(400).json({ success: false, message: 'E-mail não fornecido.' });
  }

  try {
    inicializarFirebaseAdmin();
  } catch (error) {
    console.error('Erro ao ler a chave do Firebase:', error);
    return res.status(500).json({ success: false, message: 'Erro de configuração no servidor.' });
  }

  const emailNormalizado = email.toLowerCase().trim();
  const db = getFirestore();
  const cooldownRef = db.collection('recuperacaoSenhaCooldown').doc(emailNormalizado);

  try {
    const cooldownSnap = await cooldownRef.get();
    const ultimoEnvio = cooldownSnap.data()?.enviadoEm as FirebaseFirestore.Timestamp | undefined;
    if (ultimoEnvio && Date.now() - ultimoEnvio.toMillis() < COOLDOWN_MS) {
      return res.status(200).json({ success: true, message: MENSAGEM_GENERICA });
    }

    // Marca o cooldown antes de tentar gerar/enviar — cobre também o
    // caminho "e-mail não existe", que não passa pelo sendMail abaixo mas
    // ainda assim faz uma chamada ao Admin SDK a cada tentativa.
    await cooldownRef.set({ enviadoEm: new Date() });
  } catch (error) {
    console.error('Erro ao checar cooldown de recuperação de senha:', error);
    return res.status(500).json({ success: false, message: 'Não foi possível enviar o e-mail agora. Tente novamente em instantes.' });
  }

  try {
    const linkRedefinicao = await getAuth().generatePasswordResetLink(email, {
      url: 'https://gestaocontratospmp.vercel.app',
    });

    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
    });

    const htmlEmail = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-top: 5px solid #004a99; border-radius: 8px;">
        <h2 style="color: #004a99;">Redefinição de Senha</h2>
        <p>Olá,</p>
        <p>Recebemos um pedido para redefinir a senha da sua conta no Sistema de Gestão de Contratos da Prefeitura Municipal de Pesqueira.</p>
        <div style="background-color: #f8fafc; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 10px 0;">
            <a href="${linkRedefinicao}" style="background-color: #004a99; color: white; padding: 10px 18px; border-radius: 5px; text-decoration: none; font-weight: bold;">Redefinir minha senha</a>
          </p>
          <p style="margin: 5px 0; font-size: 12px; color: #64748b;">Se o botão não funcionar, copie e cole este link no navegador: ${linkRedefinicao}</p>
        </div>
        <p>Se você não pediu essa redefinição, pode ignorar este e-mail — a sua senha atual continua válida.</p>
        <br>
        <p style="font-size: 12px; color: #666; text-align: center;"><em>Esta é uma mensagem automática gerada pelo Sistema de Gestão de Contratos da Prefeitura Municipal de Pesqueira. Não responda a este e-mail.</em></p>
      </div>
    `;

    await transporter.sendMail({
      from: '"Gestão de Contratos PMP" <notifica.licitacao.pesqueira@gmail.com>',
      to: email,
      subject: '[Gestão de Contratos PMP] Redefinição de senha',
      html: htmlEmail
    });

    return res.status(200).json({ success: true, message: MENSAGEM_GENERICA });
  } catch (error) {
    const codigo = error instanceof Object && 'code' in error ? (error as { code?: string }).code : undefined;

    // Não revela se a conta existe ou não — mesma mensagem genérica cobre
    // sucesso real e "não encontrado" (evita enumerar contas).
    if (codigo === 'auth/user-not-found') {
      return res.status(200).json({ success: true, message: MENSAGEM_GENERICA });
    }
    if (codigo === 'auth/invalid-email') {
      return res.status(400).json({ success: false, message: 'E-mail inválido. Confira o que foi digitado.' });
    }

    console.error('Erro ao gerar/enviar link de redefinição de senha:', error);
    return res.status(500).json({ success: false, message: 'Não foi possível enviar o e-mail agora. Tente novamente em instantes.' });
  }
}
