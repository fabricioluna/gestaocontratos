// api/cron-vencimentos.ts
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import nodemailer from 'nodemailer';

// O Backend da Vercel lê as variáveis usando process.env em vez de import.meta.env
const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID,
};

// Inicializa a conexão invisível ao Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);
const auth = getAuth(app);

export default async function handler(req: any, res: any) {
  try {
    // 1. O robô faz login no Firebase para ter permissão de ler os dados
    const emailBot = process.env.BOT_EMAIL || '';
    const senhaBot = process.env.BOT_PASS || '';
    
    if (!emailBot || !senhaBot) {
      throw new Error("Credenciais do BOT não configuradas na Vercel.");
    }
    await signInWithEmailAndPassword(auth, emailBot, senhaBot);

    // 2. Busca todos os contratos
    const snapshot = await getDocs(collection(db, 'contratos'));
    const contratos = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));

    // 3. Configura a sua conta do Gmail para enviar os alertas
    const transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: process.env.EMAIL_USER, // notifica.licitacao.pesqueira@gmail.com
        pass: process.env.EMAIL_PASS, // A senha de 16 dígitos
      }
    });

    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0); // Zera a hora para fazer conta de dias exatos
    let emailsEnviados = 0;

    // 4. Analisa contrato a contrato
    for (const c of contratos) {
      // Ignora contratos que não têm data de fim, já distratados ou sem e-mail de secretaria
      if (!c.dataFim || c.dataDistrato || !c.emailSecretaria) continue;

      const partesData = c.dataFim.split('-');
      const vencimento = new Date(parseInt(partesData[0]), parseInt(partesData[1]) - 1, parseInt(partesData[2]));
      vencimento.setHours(0, 0, 0, 0);

      const diferencaTempo = vencimento.getTime() - hoje.getTime();
      const diferencaDias = Math.ceil(diferencaTempo / (1000 * 60 * 60 * 24));

      // Se faltarem exatos 90 dias, 30 dias ou se vencer HOJE (0 dias)
      if (diferencaDias === 90 || diferencaDias === 30 || diferencaDias === 0) {
        
        const textoUrgencia = diferencaDias === 0 ? 'vence HOJE' : `vence em ${diferencaDias} dias`;
        const dataBr = c.dataFim.split('-').reverse().join('/');

        // HTML do E-mail atualizado com os novos textos
        const htmlEmail = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-top: 5px solid #004a99; border-radius: 8px;">
            <h2 style="color: #004a99;">Alerta de Vencimento de Contrato</h2>
            <p>Olá,</p>
            <p>O Sistema de Gestão de Contratos da Prefeitura Municipal de Pesqueira identificou que o seguinte contrato requer a sua atenção:</p>
            
            <div style="background-color: #f8fafc; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p style="margin: 5px 0;"><strong>Nº do Contrato:</strong> ${c.numeroContrato}</p>
              <p style="margin: 5px 0;"><strong>Fornecedor:</strong> ${c.fornecedor}</p>
              <p style="margin: 5px 0;"><strong>Objeto:</strong> ${c.objetoResumido}</p>
              <p style="margin: 5px 0; color: #dc3545;"><strong>Data de Validade:</strong> ${dataBr}</p>
              <p style="margin: 5px 0; color: #dc3545; font-weight: bold;"><strong>Status:</strong> ${textoUrgencia}</p>
            </div>
            
            <p>Por favor, providencie as medidas administrativas necessárias (Aditivo, encerramento ou novo processo).</p>
            <br>
            <p style="font-size: 12px; color: #666; text-align: center;"><em>Esta é uma mensagem automática gerada pelo Sistema de Gestão de Contratos da Prefeitura Municipal de Pesqueira. Não responda a este e-mail.</em></p>
          </div>
        `;

        // Prepara as cópias (CC)
        const emailPrincipal = process.env.EMAIL_USER || '';
        const emailExtra = process.env.EMAIL_CC || '';
        // Junta os e-mails separados por vírgula. Se o emailExtra estiver vazio, ignora-o.
        const listaCopias = [emailPrincipal, emailExtra].filter(e => e !== '').join(', ');

        await transporter.sendMail({
          from: '"Gestão de Contratos PMP" <notifica.licitacao.pesqueira@gmail.com>',
          to: c.emailSecretaria,
          cc: listaCopias, 
          subject: `[ALERTA PMP] O Contrato ${c.numeroContrato} ${textoUrgencia}!`,
          html: htmlEmail
        });

        emailsEnviados++;
      }
    }

    res.status(200).json({ success: true, message: `Rotina concluída. ${emailsEnviados} alertas enviados.` });
  } catch (error: any) {
    console.error("Erro no Cron Job:", error);
    res.status(500).json({ success: false, error: error.message });
  }
}