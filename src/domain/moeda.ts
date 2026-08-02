// src/domain/moeda.ts

export const parseMoeda = (valor: string | number): number => {
  if (!valor) return 0;
  if (typeof valor === 'number') return valor;
  const limpo = valor.replace(/\./g, '').replace(',', '.');
  return Number(limpo) || 0;
};
