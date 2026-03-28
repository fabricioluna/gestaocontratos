// src/types.ts

export interface Contrato {
  id?: string; // O ID gerado pelo Firebase
  orgaoId: string; // Para sabermos se é da prefeitura, fms, fme ou fmas
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
  fiscalContrato: string;
  observacao: string;
}