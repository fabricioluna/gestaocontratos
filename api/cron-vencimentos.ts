// api/cron-vencimentos.ts
import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import nodemailer from 'nodemailer';

export default async function handler(req: any, res: any) {
  // 1. USO DA VARIÁVEL REQ (Resolve o Erro do TypeScript e aumenta a segurança)
  if (req.method !== 'GET' && req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Método não permitido.' });
  }

  // A Vercel injeta este header automaticamente nas chamadas agendadas do
  // cron quando CRON_SECRET está configurado no projeto — bloqueia
  // qualquer outra origem de disparar o envio de e-mails em massa.
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.authorization !== `Bearer ${cronSecret}`) {
    return res.status(401).json({ success: false, message: 'Não autorizado.' });
  }

  try {
    // 2. Inicializa o firebase-admin (mesmo padrão dos outros handlers de /api).
    // O SDK admin lê com a service account, sem passar pelas Firestore Rules —
    // necessário aqui porque o cron precisa varrer contratos de todos os órgãos.
    if (getApps().length === 0) {
      const envVar = process.env.FIREBASE_ADMIN_CREDENTIALS;
      if (!envVar) {
        throw new Error('Falta a variável FIREBASE_ADMIN_CREDENTIALS na Vercel.');
      }
      const serviceAccount = JSON.parse(envVar);
      initializeApp({ credential: cert(serviceAccount) });
    }
    const db = getFirestore();

    // 3. Busca todos os contratos
    const snapshot = await db.collection('contratos').get();
    const contratos = snapshot.docs.map(doc => ({ id: doc.id, ...(doc.data() as any) }));

    // 4. Configura a sua conta do Gmail para enviar os alertas
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
    let emailsComFalha = 0;

    // 5. Analisa contrato a contrato
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
        const listaCopias = [emailPrincipal, emailExtra].filter(e => e !== '').join(', ');

        // try/catch por contrato: um único emailSecretaria inválido não pode
        // abortar o laço e cancelar o alerta dos demais contratos do dia —
        // como o disparo é por igualdade exata de dias (90/30/0), a janela
        // perdida não volta (achado A7 da auditoria, Fase 5).
        try {
          await transporter.sendMail({
            from: '"Gestão de Contratos PMP" <notifica.licitacao.pesqueira@gmail.com>',
            to: c.emailSecretaria,
            cc: listaCopias,
            subject: `[ALERTA PMP] O Contrato ${c.numeroContrato} ${textoUrgencia}!`,
            html: htmlEmail
          });
          emailsEnviados++;
        } catch (erroEnvio) {
          console.error(`Erro ao enviar alerta do contrato ${c.numeroContrato} (${c.emailSecretaria}):`, erroEnvio);
          emailsComFalha++;
        }
      }
    }

    res.status(200).json({
      success: true,
      message: `Rotina concluída. ${emailsEnviados} alertas enviados${emailsComFalha > 0 ? `, ${emailsComFalha} falharam` : ''}.`
    });
  } catch (error) {
    console.error("Erro no Cron Job:", error);
    res.status(500).json({ success: false, message: 'Erro interno ao processar a rotina de vencimentos.' });
  }
}