// src/utils/formatters.ts

export { parseMoeda } from '../domain/moeda';

export const extrairNumeroPlanilha = (valor: unknown): number => {
  if (typeof valor === 'number') return valor;
  if (typeof valor === 'string') {
    const limpo = valor.replace(/[^\d.,]/g, '');
    const normalizado = limpo.replace(/\./g, '').replace(',', '.');
    return Number(normalizado) || 0;
  }
  return 0;
};

export const formatarDataBr = (dataIso: string) => {
  if (!dataIso) return '-';
  const partes = dataIso.split('-');
  if (partes.length !== 3) return dataIso;
  return `${partes[2]}/${partes[1]}/${partes[0]}`;
};