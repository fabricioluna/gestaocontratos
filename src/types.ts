// src/types.ts

export interface ItemAditivo {
  numeroLote: string;
  numeroItem: string;
  discriminacao: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  valorTotalItem: number;
}

export interface Aditivo {
  id: string;
  descricao: string;
  dataAditivo: string;
  tipo: 'prazo' | 'valor' | 'ambos';
  valorAditivado: number; // positivo para acréscimo, negativo para supressão
  novaDataFim?: string;
  dataRegistro: string;
  itensAditivados?: ItemAditivo[]; // Novo: itens específicos do aditivo
  urlArquivoPdf?: string; // Novo: link para o PDF do termo no Firebase Storage
}

export interface Contrato {
  id?: string;
  orgaoId: string;
  numeroContrato: string;
  numeroProcesso: string;
  
  modalidade?: string;
  numeroModalidade?: string;
  
  numeroPregao?: string; 
  numeroAta?: string;
  fornecedor: string;
  objetoResumido: string;
  objetoCompleto?: string;
  dataInicio: string;
  dataFim: string;
  valorTotal: number;
  saldoContrato: number;
  fiscalContrato?: string;
  observacao?: string;
  dataUltimaAtualizacao?: string;

  dataDistrato?: string;
  motivoDistrato?: string;
  aditivos?: Aditivo[];
}

export interface Item {
  id?: string;
  contratoId: string;
  numeroLote: string;
  numeroItem: string;
  discriminacao: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  valorTotalItem: number;
  tipoRegistro?: 'catalogo' | 'consumo';
  dataAdicao?: string;
}