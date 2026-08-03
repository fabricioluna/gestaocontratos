// src/services/geminiService.ts
import { auth } from '../firebase';
import type { ItemAditivado } from '../types/types';

interface ItemExtraidoIA {
  numeroLote?: string;
  numeroItem?: string;
  discriminacao?: string;
  unidade?: string;
  quantidade?: number;
  valorUnitario?: number;
  valorTotalItem?: number;
}

export interface DadosContratoExtraidos {
  numeroContrato?: string;
  numeroProcesso?: string;
  modalidade?: string;
  numeroModalidade?: string;
  numeroPregao?: string;
  numeroAta?: string;
  fornecedor?: string;
  cnpjFornecedor?: string;
  objetoCompleto?: string;
  objetoResumido?: string;
  dataInicio?: string;
  dataFim?: string;
  fiscalContrato?: string;
  valorTotal?: number | string;
  itens?: ItemExtraidoIA[];
}

export interface DadosAditivoExtraidos {
  descricao?: string;
  tipo?: 'prazo' | 'valor' | 'ambos';
  novaDataFim?: string;
  valorAditivado?: number;
  itens?: ItemAditivado[];
}

interface RespostaExtracaoIA<T> {
  success: boolean;
  message?: string;
  dados?: T;
}

// Genérica em `T` para que cada chamador (contrato vs aditivo) receba o
// shape correto sem precisar de `any` — antes `data`/o retorno não tinham
// tipo nenhum, o que propagava `any` para useDetalhesContrato.ts e
// ModalNovoContrato.tsx (achado do ESLint type-aware, Fase 7).
async function chamarExtracaoIA<T>(texto: string, tipo: 'contrato' | 'aditivo'): Promise<T> {
  const idToken = await auth.currentUser?.getIdToken();
  if (!idToken) throw new Error('Sessão expirada. Faça login novamente.');

  const response = await fetch('/api/extrair-documento', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${idToken}`,
    },
    body: JSON.stringify({ texto, tipo }),
  });

  let data: RespostaExtracaoIA<T>;
  try {
    data = await response.json() as RespostaExtracaoIA<T>;
  } catch {
    throw new Error('Erro no servidor da Vercel.');
  }

  if (!response.ok || !data.success || !data.dados) {
    throw new Error(data.message || 'Falha ao analisar documento com IA.');
  }

  return data.dados;
}

export const extrairDadosContratoComIA = (textoDoContrato: string) =>
  chamarExtracaoIA<DadosContratoExtraidos>(textoDoContrato, 'contrato');

export const extrairDadosAditivoComIA = (textoDoAditivo: string) =>
  chamarExtracaoIA<DadosAditivoExtraidos>(textoDoAditivo, 'aditivo');
