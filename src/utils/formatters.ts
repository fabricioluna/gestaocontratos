// src/utils/formatters.ts

export const parseMoeda = (valor: string | number): number => {
  if (!valor) return 0;
  if (typeof valor === 'number') return valor;
  const limpo = valor.replace(/\./g, '').replace(',', '.');
  return Number(limpo) || 0;
};

export const extrairNumeroPlanilha = (valor: any): number => {
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

// NOVA FUNÇÃO: Máscara Inteligente para CPF e CNPJ
export const formatarCpfCnpj = (valor: string): string => {
  const v = valor.replace(/\D/g, ''); // Remove tudo o que não é número
  if (v.length <= 11) {
    // Formata como CPF: 000.000.000-00
    return v
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2');
  } else {
    // Formata como CNPJ: 00.000.000/0000-00
    return v.substring(0, 14)
      .replace(/^(\d{2})(\d)/, '$1.$2')
      .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
      .replace(/\.(\d{3})(\d)/, '.$1/$2')
      .replace(/(\d{4})(\d)/, '$1-$2');
  }
};