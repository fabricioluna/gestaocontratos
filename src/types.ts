// src/types.ts

export interface Contrato {
  id?: string;
  orgaoId: string;
  numeroContrato: string;
  numeroProcesso: string;
  
  // Novos campos de Modalidade
  modalidade?: string;
  numeroModalidade?: string;
  
  numeroPregao?: string; // Mantido para compatibilidade com dados legados
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