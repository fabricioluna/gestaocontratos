// api/create-user.ts
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import nodemailer from 'nodemailer';

// Padrão Sênior para Serverless: Evita inicializar o app múltiplas vezes
if (getApps().length === 0) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_ADMIN_CREDENTIALS as string);
    initializeApp({
      credential: cert(serviceAccount)
    });
  } catch (error) {
    console.error('Erro ao decodificar as credenciais do Firebase Admin. Verifique a variável na Vercel.', error);
  }
}

export default async function handler(req: any, res: any) {
  // Segurança Básica: Apenas permite envios do tipo POST
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Método não permitido.' });
  }

  const { email, nomeOrgao } = req.body;

  if (!email) {
    return res.status(400).json({ success: false, message: 'E-mail não fornecido.' });
  }

  try {
    const auth = getAuth();
    
    // 1. Verifica se o utilizador já existe no Firebase Auth
    let userExists = false;
    try {
      await auth.getUserByEmail(email);
      userExists = true;
    } catch (error: any) {
      // Se o erro for 'auth/user-not-found', significa que o caminho está livre para criar
      if (error.code !== 'auth/user-not-found') {
        throw error;
      }
    }

    // Se já existir, devolvemos sucesso, mas avisamos o Front-end que não foi preciso criar
    if (userExists) {
      return res.status(200).json({ success: true, message: 'Usuário já tem cadastro no sistema.', isNewUser: false });
    }

    // 2. Se não existir, criamos o novo acesso com uma senha padrão segura
    const anoAtual = new Date().getFullYear(); // Ex: 2026
    const senhaPadrao = `Pmp@${anoAtual}`; // Ex: Pmp@2026
    
    await auth.createUser({
      email: email,
      password: senhaPadrao,
      displayName: `Fiscal - ${nomeOrgao || 'Prefeitura'}`,
    });

    // 3. Automação: Envio de e-mail ao Fiscal com as suas credenciais
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER, // Reutiliza a conta notifica.licitacao.pesqueira
        pass: process.env.EMAIL_PASS, 
      }
    });

    const htmlEmail = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-top: 5px solid #10b981; border-radius: 8px;">
        <h2 style="color: #10b981;">Acesso ao Sistema de Contratos</h2>
        <p>Olá,</p>
        <p>O seu e-mail foi cadastrado com sucesso com perfil de <strong>Fiscal/Visualizador</strong> no Sistema de Gestão de Contratos da Prefeitura Municipal de Pesqueira.</p>
        
        <div style="background-color: #f8fafc; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <p style="margin: 5px 0;"><strong>Link de Acesso:</strong> <a href="https://gestaocontratospmp.vercel.app">gestaocontratospmp.vercel.app</a></p>
          <p style="margin: 5px 0;"><strong>Seu E-mail:</strong> ${email}</p>
          <p style="margin: 5px 0;"><strong>Senha Padrão Provisória:</strong> <span style="color: #004a99; font-weight: bold;">${senhaPadrao}</span></p>
        </div>
        
        <p>Por favor, guarde esta senha para os seus próximos acessos.</p>
        <br>
        <p style="font-size: 12px; color: #666; text-align: center;"><em>Esta é uma mensagem automática do Sistema de Licitações da PMP. Não responda a este e-mail.</em></p>
      </div>
    `;

    await transporter.sendMail({
      from: '"Gestão de Contratos PMP" <notifica.licitacao.pesqueira@gmail.com>',
      to: email,
      subject: '[Acesso Liberado] Sistema de Gestão de Contratos PMP',
      html: htmlEmail
    });

    return res.status(201).json({ success: true, message: 'Usuário criado e e-mail enviado com sucesso!', isNewUser: true });

  } catch (error: any) {
    console.error('Erro na API de criação de usuário:', error);
    return res.status(500).json({ success: false, message: 'Erro interno ao processar a requisição.', error: error.message });
  }
}