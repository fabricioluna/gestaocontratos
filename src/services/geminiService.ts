// src/services/geminiService.ts
import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

export const extrairDadosContratoComIA = async (textoDoContrato: string) => {
  if (!API_KEY) throw new Error("Chave da API não encontrada.");

  try {
    const genAI = new GoogleGenerativeAI(API_KEY);
    
    // Atualizado para o modelo gemini-2.0-flash que está disponível no seu projeto
    // Ativamos o modo JSON nativo (responseMimeType)
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.0-flash',
      generationConfig: {
        responseMimeType: "application/json",
      }
    });

    const prompt = `
      Você é um auditor especialista em licitações. Analise o texto do contrato e extraia os dados para JSON.
      
      IMPORTANTE PARA "modalidade":
      Classifique obrigatoriamente como: "Pregão Eletrônico", "Dispensa", "Concorrência Eletrônica", "Inexigibilidade", "Edital", "Credenciamento" ou "Chamamento".

      Estrutura JSON:
      {
        "numeroContrato": "string",
        "numeroProcesso": "string",
        "modalidade": "string",
        "numeroPregao": "string",
        "numeroAta": "string",
        "fornecedor": "string",
        "objetoCompleto": "string",
        "objetoResumido": "string",
        "dataInicio": "YYYY-MM-DD",
        "dataFim": "YYYY-MM-DD",
        "fiscalContrato": "string",
        "valorTotal": number,
        "itens": [
          {
            "numeroLote": "string",
            "numeroItem": "string",
            "discriminacao": "string",
            "unidade": "string",
            "quantidade": number,
            "valorUnitario": number,
            "valorTotalItem": number
          }
        ]
      }

      Texto do contrato: ${textoDoContrato}
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    return JSON.parse(response.text());

  } catch (error: any) {
    console.error("Erro no serviço Gemini:", error);
    throw new Error("Falha ao analisar documento. Verifique a conexão com a API.");
  }
};