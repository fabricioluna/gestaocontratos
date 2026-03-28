// src/services/geminiService.ts
import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!API_KEY) {
  console.error("ALERTA: Chave da API do Gemini não encontrada no arquivo .env");
}

const genAI = new GoogleGenerativeAI(API_KEY || '');
const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

export const extrairDadosContratoComIA = async (textoDoContrato: string) => {
  try {
    const prompt = `
      Você é um auditor especialista em contratos públicos e licitações.
      Leia o texto do contrato abaixo e extraia as informações rigorosamente no formato JSON.
      NÃO adicione crases (\`\`\`), markdown ou qualquer texto fora do JSON. Devolva APENAS o objeto JSON.

      ESTRUTURA ESPERADA:
      {
        "numeroContrato": "string apenas com números (ex: '015')",
        "numeroProcesso": "string apenas com números",
        "numeroPregao": "string apenas com números (deixe vazio se não houver)",
        "numeroAta": "string apenas com números (deixe vazio se não houver)",
        "fornecedor": "Nome da empresa (sem CNPJ, sede ou 'A PREFEITURA...')",
        "objetoCompleto": "Frase completa do objeto do contrato, capitalizada corretamente, sem lixo jurídico. Retire textos repetitivos no início.",
        "objetoResumido": "Versão curta do objeto",
        "dataInicio": "Data de assinatura no formato YYYY-MM-DD",
        "dataFim": "Data de vigência no formato YYYY-MM-DD",
        "fiscalContrato": "Nome do fiscal do contrato (sem CPF)",
        "valorTotal": numero float do valor global (ex: 406144.78),
        "itens": [
          {
            "numeroLote": "string (ex: '1' ou 'Único')",
            "numeroItem": "string",
            "discriminacao": "descrição limpa do produto/serviço sem números e letras perdidas no final",
            "unidade": "string da unidade (ex: UND, MÊS, SERVIÇO, DIÁRIA, LOCAÇÃO)",
            "quantidade": numero float,
            "valorUnitario": numero float,
            "valorTotalItem": numero float
          }
        ]
      }

      TEXTO DO CONTRATO:
      ${textoDoContrato}
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();
    
    // Limpa a resposta para garantir que o JSON é válido
    text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    
    return JSON.parse(text);
  } catch (error) {
    console.error("Erro na Inteligência Artificial:", error);
    throw new Error("Falha ao analisar documento com IA.");
  }
};