// src/utils/formatters.ts

export const parseMoeda = (valor: string | number): number => {
  if (!valor) return 0;
  if (typeof valor === 'number') return valor;
  const strLimpa = valor.replace(/[^\d.,]/g, '');
  return Number(strLimpa.replace(/\./g, '').replace(',', '.'));
};

export const extrairNumeroPlanilha = (valor: any): number => {
  if (typeof valor === 'number') return valor;
  if (!valor) return 0;
  const str = String(valor).trim();
  if (str.includes(',')) {
    return Number(str.replace(/\./g, '').replace(',', '.'));
  }
  return Number(str);
};

export const formatarDataBr = (dataString: string): string => {
  if (!dataString) return 'N/A';
  const partes = dataString.split('-');
  if (partes.length === 3) {
    return `${partes[2]}/${partes[1]}/${partes[0]}`;
  }
  return dataString;
};