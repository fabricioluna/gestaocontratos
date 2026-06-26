// src/types/types.ts

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
  valorAditivado: number;
  novaDataFim?: string;
  dataRegistro: string;
  itensAditivados?: ItemAditivo[];
  urlArquivoPdf?: string;
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
  cnpjFornecedor?: string; // NOVO CAMPO
  emailSecretaria?: string; // NOVO CAMPO
  objetoResumido: string;
  objetoCompleto?: string;
  dataInicio: string;
  dataFim: string;
  valorTotal: number;
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

export type FormContratoState = {
  numeroContrato: string;
  numeroProcesso: string;
  modalidade: string;
  numeroModalidade: string;
  numeroAta: string;
  fornecedor: string;
  cnpjFornecedor: string; // NOVO CAMPO
  emailSecretaria: string; // NOVO CAMPO
  objetoCompleto: string;
  objetoResumido: string;
  dataInicio: string;
  dataFim: string;
  valorTotal: string; 
  fiscalContrato: string;
  observacao: string;
};