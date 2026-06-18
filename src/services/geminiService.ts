// src/services/geminiService.ts
import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

// Função auxiliar para criar o modelo com fallback de nomenclatura
const getModelWithFallback = (genAI: GoogleGenerativeAI) => {
  // Utilizamos a nomenclatura -latest para evitar erros 404 em rotas atualizadas do Google
  return genAI.getGenerativeModel({ 
    model: 'gemini-1.5-flash-latest',
    generationConfig: {
      temperature: 0.1, 
      responseMimeType: "application/json",
    }
  });
};

export const extrairDadosContratoComIA = async (textoDoContrato: string) => {
  if (!API_KEY) throw new Error("Chave da API do Gemini (VITE_GEMINI_API_KEY) não encontrada no .env.");

  try {
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = getModelWithFallback(genAI);

    const prompt = `
      Você é um auditor especialista em licitações e contratos públicos.
      Sua tarefa é analisar o texto bruto extraído de um contrato e extrair os dados EXATAMENTE no formato JSON solicitado.
      
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
    
    // Tratamento de segurança e limpeza de Markdown
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
       text = jsonMatch[0];
    } else {
       text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    }

    return JSON.parse(text);

  } catch (error: any) {
    console.error("Erro no serviço Gemini Contrato:", error);
    throw new Error("Falha ao analisar documento com IA. Verifique se o texto do arquivo é legível e se a API está online.");
  }
};

// ============================================================================
// FUNÇÃO BLINDADA E COM FALLBACK PARA TERMOS ADITIVOS (PDF)
// ============================================================================
export const extrairDadosAditivoComIA = async (arquivoBase64: string, mimeType: string) => {
  if (!API_KEY) throw new Error("Chave da API do Gemini não configurada.");

  try {
    const genAI = new GoogleGenerativeAI(API_KEY);
    
    // Para PDF, o modelo PRO costuma ser mais robusto, então tentamos o Flash-latest primeiro
    // Se a sua chave for mais antiga, o Flash-latest corrige o 404.
    let model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash-latest',
      generationConfig: { temperature: 0.1, responseMimeType: "application/json" }
    });

    const prompt = `
      Você é um auditor especialista em licitações públicas.
      Sua tarefa é analisar a imagem/PDF do Termo Aditivo anexado e extrair os dados em formato JSON estrito.
      
      REGRAS CRÍTICAS:
      1. Retorne APENAS um objeto JSON válido. Não inclua textos explicativos.
      2. "novaDataFim" deve ser no formato "YYYY-MM-DD" (se não houver alteração de validade, retorne "").
      3. "valorAditivado", "quantidade", "valorUnitario" e "valorTotalItem" DEVEM ser NÚMEROS (ex: 1500.50). Remova "R$", troque a vírgula por ponto e remova pontos de milhar.
      4. Extraia todos os itens listados na tabela de acréscimo/supressão.
      
      FORMATO JSON ESPERADO (Siga esta estrutura exata):
      {
        "descricao": "Ex: 1º Termo Aditivo",
        "tipo": "valor",
        "novaDataFim": "",
        "valorAditivado": 205800.00,
        "itens": [
          {
            "numeroLote": "Único",
            "numeroItem": "1",
            "discriminacao": "ÓLEO DIESEL S10",
            "unidade": "LITRO",
            "quantidade": 25000,
            "valorUnitario": 5.84,
            "valorTotalItem": 146000.00
          }
        ]
      }
    `;

    const mimeForcado = mimeType.includes('pdf') ? 'application/pdf' : mimeType;

    let result;
    try {
      result = await model.generateContent([
        prompt,
        { inlineData: { data: arquivoBase64, mimeType: mimeForcado } }
      ]);
    } catch (err: any) {
      console.warn("Falha no gemini-1.5-flash-latest, tentando fallback para gemini-1.5-pro-latest...", err);
      // Fallback em caso de 404 da rota Flash
      model = genAI.getGenerativeModel({ 
        model: 'gemini-1.5-pro-latest',
        generationConfig: { temperature: 0.1, responseMimeType: "application/json" }
      });
      result = await model.generateContent([
        prompt,
        { inlineData: { data: arquivoBase64, mimeType: mimeForcado } }
      ]);
    }
    
    const response = await result.response;
    let text = response.text();
    
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
       text = jsonMatch[0];
    } else {
       text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    }

    return JSON.parse(text);

  } catch (error: any) {
    console.error("Erro fatal no serviço Gemini Aditivo:", error);
    throw new Error("Falha ao analisar documento do Aditivo com IA. Verifique as configurações da API.");
  }
};