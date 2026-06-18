// src/services/geminiService.ts
import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

const getModelWithFallback = (genAI: GoogleGenerativeAI) => {
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
// FUNÇÃO BLINDADA COM INSTRUÇÕES EXPLÍCITAS PARA A TABELA DO ADITIVO
// ============================================================================
export const extrairDadosAditivoComIA = async (arquivoBase64: string, mimeType: string) => {
  if (!API_KEY) throw new Error("Chave da API do Gemini não configurada.");

  try {
    const genAI = new GoogleGenerativeAI(API_KEY);
    
    let model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash-latest',
      generationConfig: { temperature: 0.1, responseMimeType: "application/json" }
    });

    // PROMPT ATUALIZADO: Focado em ensinar a IA a "ler" a tabela do seu modelo de PDF
    const prompt = `
      Você é um auditor especialista em licitações públicas.
      Sua tarefa é analisar o PDF do Termo Aditivo anexado e extrair os dados em formato JSON estrito.
      
      REGRAS CRÍTICAS DE LEITURA (PRESTE MUITA ATENÇÃO):
      1. TABELA DE ITENS: Procure no documento (geralmente nas páginas centrais, no item "Descrição dos itens") uma tabela contendo as colunas: ITEM, DESCRIÇÃO, UNID, QTDE, VALOR UNIT, VALOR TOTAL.
      2. Você DEVE extrair TODAS as linhas de produtos dessa tabela e inseri-las no array "itens". Nunca retorne o array "itens" vazio se essa tabela existir.
      3. NÚMEROS: "valorAditivado", "quantidade", "valorUnitario" e "valorTotalItem" DEVEM ser extraídos como NÚMEROS decimais. Remova o "R$", troque a vírgula por ponto e remova os pontos de milhar (Exemplo: "R$ 146.000,00" vira 146000.00).
      4. DATAS: "novaDataFim" deve ser no formato "YYYY-MM-DD". Se o aditivo não alterar a validade ou prazo de vigência, retorne "".
      5. Retorne APENAS um objeto JSON válido.
      
      FORMATO JSON ESPERADO (Siga esta estrutura exata baseada na sua leitura):
      {
        "descricao": "Ex: 1º Termo Aditivo",
        "tipo": "valor",
        "novaDataFim": "",
        "valorAditivado": 205800.00,
        "itens": [
          {
            "numeroLote": "Único",
            "numeroItem": "1",
            "discriminacao": "ÓLEO DÍESEL S10",
            "unidade": "LITRO",
            "quantidade": 25000,
            "valorUnitario": 5.84,
            "valorTotalItem": 146000.00
          },
          {
            "numeroLote": "Único",
            "numeroItem": "2",
            "discriminacao": "GASOLINA COMUM",
            "unidade": "LITRO",
            "quantidade": 10000,
            "valorUnitario": 5.98,
            "valorTotalItem": 59800.00
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