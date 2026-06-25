// src/services/geminiService.ts
import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

export const extrairDadosContratoComIA = async (textoDoContrato: string) => {
  if (!API_KEY) throw new Error("Chave da API do Gemini não encontrada.");

  try {
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: { temperature: 0.1, responseMimeType: "application/json" }
    });

    const prompt = `
      Você é um auditor especialista em licitações e contratos públicos.
      Extraia os dados EXATAMENTE no formato JSON.
      REGRAS:
      1. Vazio se não achar ("").
      2. Datas "YYYY-MM-DD".
      3. Valores decimais em número puro (Ex: 1500.50).
      4. "modalidade": Pregão Eletrônico, Presencial, Concorrência Eletrônica, Dispensa, Inexigibilidade, Credenciamento ou Chamamento.
      
      ESTRUTURA:
      {
        "numeroContrato": "string", "numeroProcesso": "string", "modalidade": "string",
        "numeroPregao": "string", "numeroAta": "string", "fornecedor": "string",
        "objetoCompleto": "string", "objetoResumido": "string",
        "dataInicio": "YYYY-MM-DD", "dataFim": "YYYY-MM-DD", "fiscalContrato": "string",
        "valorTotal": 0.0,
        "itens": [{ "numeroLote": "string", "numeroItem": "string", "discriminacao": "string", "unidade": "string", "quantidade": 0, "valorUnitario": 0, "valorTotalItem": 0 }]
      }
      TEXTO: ${textoDoContrato}
    `;

    const result = await model.generateContent(prompt);
    let text = result.response.text();
    const startIndex = text.indexOf('{');
    const endIndex = text.lastIndexOf('}');
    if (startIndex !== -1 && endIndex !== -1) {
        text = text.substring(startIndex, endIndex + 1);
    }
    return JSON.parse(text);

  } catch (error: unknown) {
    console.error("Erro no Gemini:", error);
    throw new Error("Falha ao analisar documento com IA.");
  }
};

export const extrairDadosAditivoComIA = async (textoDoAditivo: string) => {
  if (!API_KEY) throw new Error("Chave da API do Gemini não encontrada.");

  try {
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: { temperature: 0.1, responseMimeType: "application/json" }
    });

    const prompt = `
      Analise o Termo Aditivo e extraia no formato JSON.
      REGRAS:
      1. Vazio se não achar ("").
      2. "novaDataFim" "YYYY-MM-DD" ou "".
      3. Valores em número puro.
      4. "tipo": "prazo", "valor" ou "ambos".
      
      ESTRUTURA:
      {
        "descricao": "string", "tipo": "string", "novaDataFim": "YYYY-MM-DD", "valorAditivado": 0.0,
        "itens": [{ "numeroLote": "string", "numeroItem": "string", "discriminacao": "string", "unidade": "string", "quantidade": 0, "valorUnitario": 0, "valorTotalItem": 0 }]
      }
      TEXTO: ${textoDoAditivo}
    `;

    const result = await model.generateContent(prompt);
    let text = result.response.text();
    const startIndex = text.indexOf('{');
    const endIndex = text.lastIndexOf('}');
    if (startIndex !== -1 && endIndex !== -1) {
        text = text.substring(startIndex, endIndex + 1);
    }
    return JSON.parse(text);

  } catch (error: unknown) {
    console.error("Erro no Gemini Aditivo:", error);
    throw new Error("Falha ao analisar documento do Aditivo com IA.");
  }
};