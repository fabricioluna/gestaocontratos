// src/services/geminiService.ts
import { auth } from '../firebase';

const chamarExtracaoIA = async (texto: string, tipo: 'contrato' | 'aditivo') => {
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

  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error('Erro no servidor da Vercel.');
  }

  if (!response.ok || !data.success) {
    throw new Error(data.message || 'Falha ao analisar documento com IA.');
  }

  return data.dados;
};

export const extrairDadosContratoComIA = (textoDoContrato: string) =>
  chamarExtracaoIA(textoDoContrato, 'contrato');

export const extrairDadosAditivoComIA = (textoDoAditivo: string) =>
  chamarExtracaoIA(textoDoAditivo, 'aditivo');
