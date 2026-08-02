// src/domain/aditivos.ts
import type { Aditivo, Contrato } from '../types/types';

export interface ResumoValorGlobal {
  valorGlobalAtualizado: number;
  totalAditivosAplicados: number;
  valorOriginal: number;
}

export const calcularResumoValorGlobal = (
  contrato: Pick<Contrato, 'valorTotal' | 'aditivos'> | null
): ResumoValorGlobal => {
  const valorGlobalAtualizado = contrato ? (Number(contrato.valorTotal) || 0) : 0;
  const totalAditivosAplicados = contrato?.aditivos
    ? contrato.aditivos.reduce((acc, ad) => acc + (ad.valorAditivado || 0), 0)
    : 0;
  const valorOriginal = valorGlobalAtualizado - totalAditivosAplicados;
  return { valorGlobalAtualizado, totalAditivosAplicados, valorOriginal };
};

export const calcularValorAlteracaoAditivo = (
  operacao: 'acrescimo' | 'supressao',
  valor: number
): number => (operacao === 'acrescimo' ? valor : -valor);

// Regra dos 25% (art. 125 da Lei 14.133/2021): hoje o sistema só avisa no
// acréscimo, não na supressão — comportamento existente preservado, não é
// o escopo desta fase corrigir a regra em si.
export const excedeLimite25 = (valorAcrescimo: number, valorBase: number): boolean =>
  valorAcrescimo > valorBase * 0.25;

// Recalcula o valorTotal do contrato ao gravar um aditivo novo ou editado:
// desfaz o efeito do aditivo anterior (0 se for um aditivo novo) e aplica o
// valor da alteração atual. Também cobre a exclusão de aditivo, passando
// valorAlteracaoNova = 0.
export const recalcularValorTotalComAditivo = (
  valorTotalAtual: number,
  valorAditivoAnterior: number,
  valorAlteracaoNova: number
): number => valorTotalAtual - valorAditivoAnterior + valorAlteracaoNova;

// `emEdicao` reflete se havia um aditivo em edição (não só se o id foi
// encontrado): se estava editando e o id não bate com nenhum item da lista,
// o comportamento original é não fazer nada (nem substituir, nem inserir) —
// preservado aqui de propósito.
export const substituirAditivo = (
  aditivos: Aditivo[] | undefined,
  novoAditivo: Aditivo,
  emEdicao: boolean,
  aditivoEmEdicaoId?: string
): Aditivo[] => {
  const lista = aditivos ? [...aditivos] : [];
  if (emEdicao) {
    const index = lista.findIndex((a) => a.id === aditivoEmEdicaoId);
    if (index !== -1) lista[index] = novoAditivo;
  } else {
    lista.push(novoAditivo);
  }
  return lista;
};
