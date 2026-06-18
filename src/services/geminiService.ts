// src/services/geminiService.ts
import { GoogleGenerativeAI } from '@google/generative-ai';

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

export const extrairDadosContratoComIA = async (textoDoContrato: string) => {
  if (!API_KEY) throw new Error("Chave da API do Gemini (VITE_GEMINI_API_KEY) não encontrada no .env.");

  try {
    const genAI = new GoogleGenerativeAI(API_KEY);
    
    // CORREÇÃO DEFINITIVA: Usando o modelo exato listado pela sua nova API Key
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature: 0.1, // Temperatura baixa para não inventar dados
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
    
    // Tratamento de segurança: limpar blocos markdown caso a IA os envie
    text = text.replace(/```json/gi, '').replace(/```/g, '').trim();

    return JSON.parse(text);

  } catch (error: any) {
    console.error("Erro no serviço Gemini:", error);
    throw new Error("Falha ao analisar documento com IA. Verifique se o texto do arquivo é legível e se a API está online.");
  }
};

// ============================================================================
// NOVA FUNÇÃO: EXTRAÇÃO AVANÇADA MULTIMODAL PARA TERMOS ADITIVOS
// ============================================================================
export const extrairDadosAditivoComIA = async (arquivoBase64: string, mimeType: string) => {
  if (!API_KEY) throw new Error("Chave da API do Gemini (VITE_GEMINI_API_KEY) não encontrada no .env.");

  try {
    const genAI = new GoogleGenerativeAI(API_KEY);
    
    // Usamos o modelo 1.5 Flash que tem suporte nativo a leitura de arquivos (Visão Multimodal)
    const model = genAI.getGenerativeModel({ 
      model: 'gemini-1.5-flash',
      generationConfig: {
        temperature: 0.1,
        responseMimeType: "application/json",
      }
    });

    const prompt = `
      Você é um auditor especialista em licitações e contratos públicos.
      Sua tarefa é analisar o documento em anexo (um Termo Aditivo de Contrato) e extrair os dados EXATAMENTE no formato JSON solicitado.
      
      REGRAS CRÍTICAS:
      1. Se não encontrar uma informação, retorne uma string vazia "" ou 0 para números. Não invente dados.
      2. As datas devem vir OBRIGATORIAMENTE no formato "YYYY-MM-DD". Se o aditivo alterar a data de validade/vencimento (Prorrogação), preencha "novaDataFim".
      3. "valorAditivado", "quantidade", "valorUnitario" e "valorTotalItem" DEVEM ser números decimais. Remova o "R$" e pontos de milhar, e troque a vírgula decimal por ponto (Exemplo: 1.500,50 vira 1500.50).
      4. Verifique cuidadosamente a tabela de itens. O aditivo geralmente tem uma tabela listando os itens sendo acrescidos ou suprimidos. Extraia todos eles.
      5. Classifique o "tipo" estritamente como "prazo", "valor" ou "ambos".
      
      ESTRUTURA JSON ESPERADA:
      {
        "descricao": "string (Ex: 1º Termo Aditivo)",
        "tipo": "string (prazo, valor ou ambos)",
        "novaDataFim": "YYYY-MM-DD",
        "valorAditivado": number,
        "itens": [
          {
            "numeroLote": "string (Se não houver, use 'Único')",
            "numeroItem": "string",
            "discriminacao": "string (nome ou descrição detalhada do item)",
            "unidade": "string",
            "quantidade": number,
            "valorUnitario": number,
            "valorTotalItem": number
          }
        ]
      }
    `;

    // Mapeamento de fallback para formatos que o Gemini pode interpretar
    let tipoMimeEnviado = mimeType;
    if (mimeType.includes('wordprocessingml')) {
      // Alguns DOCX não são suportados nativamente como inlineData sem File API, forçamos tentativa
      tipoMimeEnviado = 'text/plain'; 
    } else if (!mimeType.includes('pdf') && !mimeType.includes('image')) {
      tipoMimeEnviado = 'application/pdf'; // Tenta forçar leitura PDF se estiver ambíguo
    }

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: arquivoBase64,
          mimeType: tipoMimeEnviado
        }
      }
    ]);
    
    const response = await result.response;
    let text = response.text();
    
    // Tratamento de limpeza do JSON
    text = text.replace(/```json/gi, '').replace(/```/g, '').trim();
    return JSON.parse(text);

  } catch (error: any) {
    console.error("Erro no serviço Gemini Aditivo:", error);
    throw new Error("Falha ao analisar documento do Aditivo com IA. Para melhores resultados, certifique-se de usar arquivos em formato PDF.");
  }
};