// src/services/geminiService.ts
import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

export const extrairDadosContratoComIA = async (textoDoContrato: string) => {
  if (!API_KEY) throw new Error("Chave da API do Gemini (VITE_GEMINI_API_KEY) não encontrada no .env.");

  try {
    const genAI = new GoogleGenerativeAI(API_KEY);
    
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.1, 
        responseMimeType: "application/json",
      }
    });

    const prompt = `
      Você é um auditor especialista em licitações e contratos públicos.
      Sua tarefa é analisar o texto bruto extraído de um contrato (PDF/DOCX) e extrair os dados EXATAMENTE no formato JSON solicitado.
      
      REGRAS CRÍTICAS:
      1. Se não encontrar uma informação, retorne uma string vazia "" ou 0 para números. Não invente dados.
      2. As datas ("dataInicio", "dataFim") devem vir OBRIGATORIAMENTE no formato "YYYY-MM-DD".
      3. "valorTotal", "quantidade", "valorUnitario" e "valorTotalItem" DEVEM ser números decimais (Ex: 1500.50) e não strings. Não use separador de milhar.
      4. "modalidade": Classifique OBRIGATORIAMENTE como um destes: "Pregão Eletrônico", "Pregão Presencial", "Concorrência Eletrônica", "Dispensa", "Inexigibilidade", "Credenciamento" ou "Chamamento".

      ESTRUTURA JSON ESPERADA:
      {
        "numeroContrato": "string",
        "numeroProcesso": "string",
        "modalidade": "string",
        "numeroPregao": "string",
        "numeroAta": "string",
        "fornecedor": "string",
        "objetoCompleto": "string",
        "objetoResumido": "string (Máximo de 15 palavras)",
        "dataInicio": "YYYY-MM-DD",
        "dataFim": "YYYY-MM-DD",
        "fiscalContrato": "string",
        "valorTotal": number,
        "itens": [
          {
            "numeroLote": "string (Se não houver, use 'Único')",
            "numeroItem": "string",
            "discriminacao": "string",
            "unidade": "string",
            "quantidade": number,
            "valorUnitario": number,
            "valorTotalItem": number
          }
        ]
      }

      TEXTO DO CONTRATO PARA ANÁLISE:
      ${textoDoContrato}
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();
    
    const startIndex = text.indexOf('{');
    const endIndex = text.lastIndexOf('}');
    if (startIndex !== -1 && endIndex !== -1) {
        text = text.substring(startIndex, endIndex + 1);
    }
    
    return JSON.parse(text);

  } catch (error: any) {
    console.error("Erro no serviço Gemini:", error);
    throw new Error("Falha ao analisar documento com IA. Verifique se o texto do arquivo é legível e se a API está online.");
  }
};

export const extrairDadosAditivoComIA = async (textoDoAditivo: string) => {
  if (!API_KEY) throw new Error("Chave da API do Gemini (VITE_GEMINI_API_KEY) não encontrada no .env.");

  try {
    const genAI = new GoogleGenerativeAI(API_KEY);
    
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.1, 
        responseMimeType: "application/json",
      }
    });

    const prompt = `
      Você é um auditor especialista em licitações e contratos públicos.
      Sua tarefa é analisar o texto limpo de um Termo Aditivo e extrair os dados EXATAMENTE no formato JSON solicitado.
      
      REGRAS CRÍTICAS:
      1. Se não encontrar uma informação, retorne uma string vazia "" ou 0 para números. Não invente dados.
      2. "novaDataFim" deve vir OBRIGATORIAMENTE no formato "YYYY-MM-DD" (se o aditivo não alterar a validade, deixe "").
      3. "valorAditivado", "quantidade", "valorUnitario" e "valorTotalItem" DEVEM ser números decimais (Ex: 1500.50). Remova o R$, tire pontos de milhar e troque vírgula por ponto.
      4. "tipo" deve ser classificado como "prazo", "valor" ou "ambos".
      5. Procure pela tabela de itens (Ex: ÓLEO DIESEL, GASOLINA, etc.) e preencha todos no array "itens".

      ESTRUTURA JSON ESPERADA:
      {
        "descricao": "string (Ex: 1º Termo Aditivo)",
        "tipo": "string",
        "novaDataFim": "YYYY-MM-DD",
        "valorAditivado": number,
        "itens": [
          {
            "numeroLote": "string (Se não houver, use 'Único')",
            "numeroItem": "string",
            "discriminacao": "string",
            "unidade": "string",
            "quantidade": number,
            "valorUnitario": number,
            "valorTotalItem": number
          }
        ]
      }

      TEXTO DO ADITIVO PARA ANÁLISE:
      ${textoDoAditivo}
    `;

    const result = await model.generateContent(prompt);
    const response = await result.response;
    let text = response.text();
    
    const startIndex = text.indexOf('{');
    const endIndex = text.lastIndexOf('}');
    if (startIndex !== -1 && endIndex !== -1) {
        text = text.substring(startIndex, endIndex + 1);
    }
    
    return JSON.parse(text);

  } catch (error: any) {
    console.error("Erro no serviço Gemini Aditivo:", error);
    throw new Error("Falha ao analisar documento do Aditivo com IA.");
  }
};