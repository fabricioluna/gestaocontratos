// api/create-user.ts
import { randomBytes } from 'crypto';
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import nodemailer from 'nodemailer';
import { verificarAdmin } from './lib/verificarAdmin.js';

export default async function handler(req: any, res: any) {
  // Segurança
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Método não permitido.' });
  }

  // 1. TENTATIVA BLINDADA DE INICIALIZAR O FIREBASE
  try {
    if (getApps().length === 0) {
      const envVar = process.env.FIREBASE_ADMIN_CREDENTIALS;
      if (!envVar) {
         console.error('Falta a variável FIREBASE_ADMIN_CREDENTIALS na Vercel.');
         return res.status(500).json({ success: false, message: 'Erro de configuração no servidor.' });
      }

      // Converte o texto da Vercel num objeto JSON
      const serviceAccount = JSON.parse(envVar);
      initializeApp({
        credential: cert(serviceAccount)
      });
    }
  } catch (error) {
    console.error('Erro ao ler a chave do Firebase:', error);
    return res.status(500).json({ success: false, message: 'Erro de configuração no servidor.' });
  }

  // 2. Exige um usuário autenticado com claim de admin
  const admin = await verificarAdmin(req, res);
  if (!admin) return;

  const auth = getAuth();
  const { email, nomeOrgao } = req.body;
  if (!email) return res.status(400).json({ success: false, message: 'E-mail não fornecido.' });

  try {
    // 3. Verifica se o usuário já existe
    let userExists = false;
    try {
      await auth.getUserByEmail(email);
      userExists = true;
    } catch (error: any) {
      if (error.code !== 'auth/user-not-found') throw error;
    }

    if (userExists) {
      return res.status(200).json({ success: true, message: 'Usuário já tem cadastro no sistema.', isNewUser: false });
    }

    // 4. Cria a conta no Firebase com senha aleatória (nunca enviada ao usuário)
    // e um link de redefinição para ele escolher a própria senha.
    const senhaAleatoria = randomBytes(24).toString('base64url');

    await auth.createUser({
      email: email,
      password: senhaAleatoria,
      displayName: `Fiscal - ${nomeOrgao || 'Prefeitura'}`,
    });

    const linkRedefinicao = await auth.generatePasswordResetLink(email, {
      url: 'https://gestaocontratospmp.vercel.app',
    });

    // 5. Envia o Email de forma segura
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user: process.env.EMAIL_USER, pass: process.env.EMAIL_PASS }
      });

      const htmlEmail = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-top: 5px solid #10b981; border-radius: 8px;">
          <h2 style="color: #10b981;">Acesso ao Sistema de Contratos</h2>
          <p>Olá,</p>
          <p>O seu e-mail foi cadastrado com sucesso com perfil de <strong>Fiscal/Visualizador</strong> no Sistema de Gestão de Contratos da Prefeitura Municipal de Pesqueira.</p>
          <div style="background-color: #f8fafc; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="margin: 5px 0;"><strong>Seu E-mail:</strong> ${email}</p>
            <p style="margin: 10px 0;">
              <a href="${linkRedefinicao}" style="background-color: #004a99; color: white; padding: 10px 18px; border-radius: 5px; text-decoration: none; font-weight: bold;">Definir minha senha de acesso</a>
            </p>
            <p style="margin: 5px 0; font-size: 12px; color: #64748b;">Se o botão não funcionar, copie e cole este link no navegador: ${linkRedefinicao}</p>
          </div>
          <p>Depois de definir a senha, acesse em <a href="https://gestaocontratospmp.vercel.app">gestaocontratospmp.vercel.app</a>.</p>
        </div>
      `;

      await transporter.sendMail({
        from: '"Gestão de Contratos PMP" <notifica.licitacao.pesqueira@gmail.com>',
        to: email,
        subject: '[Acesso Liberado] Sistema de Gestão de Contratos PMP',
        html: htmlEmail
      });
    } catch (emailError) {
      console.error("Erro no envio do e-mail:", emailError);
      return res.status(201).json({ success: true, message: 'Usuário criado no Firebase, mas ocorreu um erro a enviar o e-mail de aviso.', isNewUser: true });
    }

    return res.status(201).json({ success: true, message: 'Usuário criado e e-mail enviado com sucesso!', isNewUser: true });

  } catch (error) {
    console.error('Erro geral da API:', error);
    return res.status(500).json({ success: false, message: 'Erro interno ao processar a requisição.' });
  }
}
