// src/services/geminiService.ts
import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

export const extrairDadosContratoComIA = async (textoDoContrato: string) => {
  if (!API_KEY) {
    throw new Error("ALERTA: Chave da API do Gemini não encontrada no arquivo .env");
  }

  try {
    const genAI = new GoogleGenerativeAI(API_KEY);
    
    // Configuração Profissional: 
    // 1. Usamos o modelo 1.5-flash (estável)
    // 2. Forçamos o responseMimeType para JSON, eliminando erros de crases/markdown
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    const prompt = `
      Você é um auditor especialista em contratos públicos e licitações brasileiras.
      Analise o texto do contrato administrativo fornecido e extraia as informações estritamente no formato JSON.

      REGRAS PARA O CAMPO "modalidade":
      Você deve identificar no texto qual foi o formato de contratação e classificar EXATAMENTE como um destes termos: 
      "Pregão Eletrônico", "Dispensa", "Concorrência Eletrônica", "Inexigibilidade", "Edital", "Credenciamento" ou "Chamamento".

      ESTRUTURA JSON ESPERADA:
      {
        "numeroContrato": "string apenas com números",
        "numeroProcesso": "string apenas com números",
        "modalidade": "string (conforme as opções acima)",
        "numeroPregao": "string apenas com números (número da licitação/pregao)",
        "numeroAta": "string apenas com números (deixe vazio se não houver)",
        "fornecedor": "Nome da empresa (sem CNPJ ou textos jurídicos)",
        "objetoCompleto": "Frase completa do objeto do contrato",
        "objetoResumido": "Versão curta do objeto (máximo 60 caracteres)",
        "dataInicio": "Data de assinatura YYYY-MM-DD",
        "dataFim": "Data de vigência YYYY-MM-DD",
        "fiscalContrato": "Nome do fiscal (sem CPF)",
        "valorTotal": numero float,
        "itens": [
          {
            "numeroLote": "string",
            "numeroItem": "string",
            "discriminacao": "descrição limpa do produto/serviço",
            "unidade": "string (ex: UND, MÊS, SERVIÇO)",
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
    const text = response.text();
    
    // Como configuramos o model para JSON, o parse é direto e seguro
    return JSON.parse(text);

  } catch (error: any) {
    console.error("Erro detalhado na IA:", error);
    
    // Tratamento específico para o erro 404 que você está enfrentando
    if (error.message?.includes('404')) {
      throw new Error("Erro 404: O modelo não foi encontrado. Por favor, verifique se a 'Generative Language API' está ativada no Google Cloud Console para o projeto da sua chave.");
    }
    
    throw new Error("Falha ao analisar documento com IA.");
  }
};