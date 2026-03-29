// src/services/geminiService.ts
import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

if (!API_KEY) {
  console.error("ALERTA: Chave da API do Gemini não encontrada no arquivo .env");
}

export const extrairDadosContratoComIA = async (textoDoContrato: string) => {
  try {
    const genAI = new GoogleGenerativeAI(API_KEY || '');
    // Alterado para gemini-1.5-flash que é o modelo estável e disponível
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });

    const prompt = `
      Você é um auditor especialista em contratos públicos e licitações.
      Leia o texto do contrato abaixo e extraia as informações rigorosamente no formato JSON.
      NÃO adicione crases (\`\`\`), markdown ou qualquer texto fora do JSON. Devolva APENAS o objeto JSON puro.

      IMPORTANTE PARA O CAMPO "modalidade":
      Analise o texto e classifique a modalidade EXATAMENTE como um destes termos: 
      "Pregão Eletrônico", "Dispensa", "Concorrência Eletrônica", "Inexigibilidade", "Edital", "Credenciamento" ou "Chamamento".

      ESTRUTURA ESPERADA:
      {
        "numeroContrato": "string apenas com números (ex: '015')",
        "numeroProcesso": "string apenas com números",
        "modalidade": "string (classifique obrigatoriamente conforme as opções acima)",
        "numeroPregao": "string apenas com números (número da licitação/pregao)",
        "numeroAta": "string apenas com números (deixe vazio se não houver)",
        "fornecedor": "Nome da empresa (sem CNPJ, sede ou 'A PREFEITURA...')",
        "objetoCompleto": "Frase completa do objeto do contrato, capitalizada corretamente, sem lixo jurídico. Retire textos repetitivos no início.",
        "objetoResumido": "Versão curta do objeto",
        "dataInicio": "YYYY-MM-DD",
        "dataFim": "YYYY-MM-DD",
        "fiscalContrato": "Nome do fiscal do contrato (sem CPF)",
        "valorTotal": numero float do valor global (ex: 406144.78),
        "itens": [
          {
            "numeroLote": "string (ex: '1' ou 'Único')",
            "numeroItem": "string",
            "discriminacao": "descrição limpa do produto/serviço",
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
    
    // Limpeza de resposta para garantir que o JSON é válido
    text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    
    return JSON.parse(text);
  } catch (error) {
    console.error("Erro na Inteligência Artificial:", error);
    throw new Error("Falha ao analisar documento com IA.");
  }
};