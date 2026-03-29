// src/types.ts

export interface Contrato {
  id?: string;
  orgaoId: string;
  numeroContrato: string;
  numeroProcesso: string;
  modalidade: string; // ADICIONADO: Para suportar Pregão, Dispensa, etc.
  numeroPregao: string;
  numeroAta: string;
  fornecedor: string;
  objetoCompleto: string;
  objetoResumido: string;
  dataInicio: string;
  dataFim: string;
  valorTotal: number;
  saldoContrato: number;
  fiscalContrato: string;
  observacao: string;
  dataUltimaAtualizacao?: string; // NOVO: Guarda a data/hora da última mexida
}

export interface ItemContrato {
  id?: string;
  contratoId: string;
  numeroLote: string;
  numeroItem: string;
  discriminacao: string;
  unidade: string;
  quantidade: number;
  valorUnitario: number;
  valorTotalItem: number;
  dataAdicao?: string; // NOVO: O nosso "Log" de quando o saldo foi reduzido
}