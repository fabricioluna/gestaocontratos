// src/services/geminiService.ts
import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

export const extrairDadosContratoComIA = async (textoDoContrato: string) => {
  if (!API_KEY) throw new Error("Chave da API do Gemini (VITE_GEMINI_API_KEY) não encontrada no .env.");

  try {
    const genAI = new GoogleGenerativeAI(API_KEY);
    
    // CORREÇÃO: Utilizando a versão estável e recomendada gemini-1.5-flash
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
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
    
    // Tratamento para limpar possíveis blocos de formatação markdown
    text = text.replace(/```json/gi, '').replace(/```/g, '').trim();

    return JSON.parse(text);

  } catch (error: any) {
    console.error("Erro no serviço Gemini:", error);
    throw new Error("Falha ao analisar documento com IA. Verifique se o texto do arquivo é legível e se a API está online.");
  }
};