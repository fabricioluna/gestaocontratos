// api/create-user.ts
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import nodemailer from 'nodemailer';

export default async function handler(req: any, res: any) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Método não permitido.' });
  }

  // 1. INICIALIZAÇÃO BLINDADA COM CORREÇÃO DA CHAVE DA VERCEL
  try {
    if (getApps().length === 0) {
      const envVar = process.env.FIREBASE_ADMIN_CREDENTIALS;
      if (!envVar) {
         return res.status(500).json({ success: false, message: 'Falta a variável FIREBASE_ADMIN_CREDENTIALS na Vercel.' });
      }
      
      const serviceAccount = JSON.parse(envVar);
      
      // O TRUQUE DE MESTRE: Corrige as quebras de linha destruídas pela Vercel
      if (serviceAccount.private_key) {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      }

      initializeApp({
        credential: cert(serviceAccount)
      });
    }
  } catch (error: any) {
    console.error('Erro crítico ao carregar o Firebase Admin:', error);
    return res.status(500).json({ 
      success: false, 
      message: 'Falha ao processar a Chave JSON do Firebase. Verifique a variável na Vercel.', 
      error: error.message 
    });
  }

  const { email, nomeOrgao } = req.body;
  if (!email) {
    return res.status(400).json({ success: false, message: 'E-mail não fornecido.' });
  }

  try {
    const auth = getAuth();
    
    // 2. Verifica se o usuário já existe
    let userExists = false;
    try {
      await auth.getUserByEmail(email);
      userExists = true;
    } catch (error: any) {
      if (error.code !== 'auth/user-not-found') throw error;
    }

    if (userExists) {
      return res.status(200).json({ success: true, message: 'Este fiscal já possui acesso autorizado no sistema.', isNewUser: false });
    }

    // 3. Cria a conta no Firebase
    const anoAtual = new Date().getFullYear();
    const senhaPadrao = `Pmp@${anoAtual}`; // Ex: Pmp@2026
    
    await auth.createUser({
      email: email,
      password: senhaPadrao,
      displayName: `Fiscal - ${nomeOrgao || 'Prefeitura'}`,
    });

    // 4. Envia o Email com as credenciais
    try {
      const transporter = nodemailer.createTransport({
        service: 'gmail',
        auth: {
          user: process.env.EMAIL_USER,
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
          
          <p>Por favor, guarde esta senha para os seus próximos acessos. É recomendável alterá-la futuramente.</p>
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
    } catch (emailError: any) {
      console.error("Erro no envio do e-mail:", emailError);
      return res.status(201).json({ success: true, message: 'Usuário criado no sistema, mas houve falha ao enviar o e-mail de aviso.', isNewUser: true });
    }

    return res.status(201).json({ success: true, message: 'Sucesso! Novo acesso criado e credenciais enviadas ao fiscal.', isNewUser: true });

  } catch (error: any) {
    console.error('Erro na API de criação de usuário:', error);
    return res.status(500).json({ success: false, message: 'Erro interno ao processar a requisição no Firebase.', error: error.message });
  }
}