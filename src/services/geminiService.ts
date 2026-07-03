// src/services/geminiService.ts
import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

export const extrairDadosContratoComIA = async (textoDoContrato: string) => {
  if (!API_KEY) throw new Error("Chave da API do Gemini não encontrada.");

  try {
    const genAI = new GoogleGenerativeAI(API_KEY);
    // Usamos o modelo Flash que é extremamente rápido e garantimos que a saída seja sempre um JSON estruturado
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-2.5-flash',
      generationConfig: { temperature: 0.1, responseMimeType: "application/json" }
    });

    const prompt = `
      Você é um auditor especialista em licitações e contratos públicos.
      Sua missão é extrair os dados do documento fornecido EXATAMENTE no formato JSON solicitado.
      
      REGRAS CRÍTICAS DE EXTRAÇÃO:
      1. Retorne VAZIO ("") se não encontrar a informação. NUNCA invente ou adivinhe dados (Zero Alucinação).
      2. Datas DEVEM estar no formato "YYYY-MM-DD".
      3. Valores financeiros DEVEM ser números puros (Ex: 1500.50), sem símbolo de "R$".
      4. "modalidade": Pregão Eletrônico, Pregão Presencial, Concorrência, Dispensa, Inexigibilidade, Credenciamento, etc.
      5. "cnpjFornecedor": Extraia o número completo do CNPJ ou CPF do fornecedor.
      6. "fiscalContrato": Extraia apenas o NOME da pessoa. NUNCA tente adivinhar o e-mail do fiscal ou o Fundo/Secretaria. Deixe para o humano preencher esses dados sistêmicos.
      
      ESTRUTURA JSON ESPERADA:
      {
        "numeroContrato": "string",
        "numeroProcesso": "string",
        "modalidade": "string",
        "numeroModalidade": "string",
        "numeroAta": "string",
        "fornecedor": "string",
        "cnpjFornecedor": "string",
        "objetoCompleto": "string",
        "objetoResumido": "string (versão curta do objeto com no máximo 100 caracteres)",
        "dataInicio": "YYYY-MM-DD",
        "dataFim": "YYYY-MM-DD",
        "fiscalContrato": "string",
        "valorTotal": 0.0,
        "itens": [
          { 
            "numeroLote": "string", 
            "numeroItem": "string", 
            "discriminacao": "string", 
            "unidade": "string", 
            "quantidade": 0, 
            "valorUnitario": 0, 
            "valorTotalItem": 0 
          }
        ]
      }
      
      TEXTO DO CONTRATO: 
      ${textoDoContrato}
    `;

    const result = await model.generateContent(prompt);
    let text = result.response.text();
    
    // Limpeza de segurança caso a IA retorne blocos de código Markdown
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    return JSON.parse(text);

  } catch (error: unknown) {
    console.error("Erro no Gemini Contrato:", error);
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
      Você é um auditor especialista em licitações e contratos públicos.
      Analise o Termo Aditivo fornecido e extraia os dados EXATAMENTE no formato JSON solicitado.
      
      REGRAS CRÍTICAS DE EXTRAÇÃO:
      1. Retorne VAZIO ("") se não encontrar a informação. NUNCA invente ou adivinhe dados.
      2. "novaDataFim" DEVE ser no formato "YYYY-MM-DD" (apenas se o aditivo for de prorrogação de prazo).
      3. "valorAditivado" DEVE ser número puro (Ex: 1500.50). Refere-se ao valor acrescido ou suprimido do contrato original.
      4. "tipo": DEVE ser exatamente a palavra "prazo", "valor" ou "ambos".
      
      ESTRUTURA JSON ESPERADA:
      {
        "descricao": "string (ex: 1º Termo Aditivo de Prazo e Valor)", 
        "tipo": "string", 
        "novaDataFim": "YYYY-MM-DD", 
        "valorAditivado": 0.0,
        "itens": [
          { 
            "numeroLote": "string", 
            "numeroItem": "string", 
            "discriminacao": "string", 
            "unidade": "string", 
            "quantidade": 0, 
            "valorUnitario": 0, 
            "valorTotalItem": 0 
          }
        ]
      }
      
      TEXTO DO ADITIVO: 
      ${textoDoAditivo}
    `;

    const result = await model.generateContent(prompt);
    let text = result.response.text();
    
    // Limpeza de segurança
    text = text.replace(/```json/g, '').replace(/```/g, '').trim();
    
    return JSON.parse(text);

  } catch (error: unknown) {
    console.error("Erro no Gemini Aditivo:", error);
    throw new Error("Falha ao analisar documento do Aditivo com IA.");
  }
};