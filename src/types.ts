// src/types.ts

export interface Contrato {
  id?: string;
  orgaoId: string;
  numeroContrato: string;
  numeroProcesso: string;
  numeroPregao: string;
  numeroAta: string;
  fornecedor: string;
  objetoCompleto: string;
  objetoResumido: string;
  dataInicio: string;
  dataFim: string;
  valorTotal: number;
  saldoContrato: number; // NOVO: Saldo que será atualizado automaticamente
  fiscalContrato: string;
  observacao: string;
}

// NOVO: Molde para os Itens do Contrato
export interface ItemContrato {
  id?: string;
  contratoId: string; // Para sabermos a qual contrato este item pertence
  numeroLote: string;
  numeroItem: string;
  discriminacao: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  valorTotalItem: number;
}